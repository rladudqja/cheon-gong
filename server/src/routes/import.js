import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { getDB } from '../db/connection.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ══════════════════════════════════════════════════
// POST /api/import/excel — 스프레드시트 Excel 파일 업로드
// GAS COL 인덱스 기반으로 각 시트 자동 매핑
// ══════════════════════════════════════════════════
router.post('/excel', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });

  const db = getDB();
  const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const sheetNames = wb.SheetNames;
  const results = {};
  const errors = [];

  // 날짜 변환 헬퍼
  function fmtDate(v) {
    if (!v) return null;
    if (v instanceof Date) {
      const y = v.getFullYear(), m = v.getMonth() + 1, d = v.getDate();
      if (y < 2000 || y > 2100) return null;
      return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
    }
    const s = String(v).trim();
    // yyyy-MM-dd, yyyy/MM/dd, yyyy.MM.dd
    let match = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    // yyyyMMdd
    match = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return null;
  }

  function num(v) {
    if (typeof v === 'number' && !isNaN(v)) return v;
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function str(v) { return v == null ? '' : String(v).trim(); }

  function parseMonth(v) {
    if (!v) return '';
    if (v instanceof Date) {
      const y = v.getFullYear(), m = v.getMonth() + 1;
      return `${y}-${m < 10 ? '0' + m : m}`;
    }
    const s = String(v).trim();
    let match = s.match(/^(\d{4})[-./](\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}`;
    match = s.match(/(\d{4})\s*년?\s*(\d{1,2})\s*월/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}`;
    return '';
  }

  // 시트 데이터 읽기 (1행=헤더, 나머지=데이터)
  function readSheet(name) {
    const ws = wb.Sheets[name];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
  }

  // 날짜가 있는 raw 데이터도 읽기
  function readSheetRaw(name) {
    const ws = wb.Sheets[name];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  }

  // ── 1. 기본정보 시트 ──
  function importConfig(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows) return;
    const upsert = db.prepare('INSERT INTO project_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const keyMap = {
      '현장명': 'name', '공종': 'gongjong', '계약물량': 'contract_qty',
      '공사시작일': 'start_date', '공사종료일': 'end_date',
      '정산일': 'settlement_day', '예상월대': 'est_monthly_rent', '예상일대': 'est_daily_rent'
    };
    let cnt = 0;
    rows.forEach(r => {
      const label = str(r[0]);
      for (const [k, dbKey] of Object.entries(keyMap)) {
        if (label.includes(k)) {
          let val = r[1];
          if (dbKey.includes('date')) val = fmtDate(val) || str(val);
          else val = str(val);
          upsert.run(dbKey, val);
          cnt++;
        }
      }
      if (label.includes('작업일수')) upsert.run('work_days_per_month', str(num(r[1]) || 25));
      if (label.includes('일일목표')) upsert.run('daily_target', str(num(r[1])));
    });
    results['기본정보'] = cnt;
  }

  // ── 2. 장비구분표 시트 (COL.equipment) ──
  // hogi:0, type:1, carNo:2, equipName:3, spec:4, company:5, driver:6,
  // startDate:7, endDate:8, monthlyRent:9, dailyRent:10, applyDays:11,
  // setGroup:12, drillDiameter:13, adjustFactor:14
  function importEquipment(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM equipment').run();
    const ins = db.prepare(`INSERT INTO equipment (hogi, equip_type, car_no, equip_name, spec, company, driver,
      start_date, end_date, monthly_rent, daily_rent, apply_days, set_group, drill_diameter, adjust_factor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const hogi = str(r[0]);
      if (!hogi || !hogi.match(/\d+\s*호기/)) continue;
      ins.run(hogi, str(r[1]), str(r[2]), str(r[3]), str(r[4]), str(r[5]), str(r[6]),
        fmtDate(r[7]) || '', fmtDate(r[8]) || '', num(r[9]), num(r[10]), num(r[11]),
        str(r[12]), num(r[13]), num(r[14]) || 1);
      cnt++;
    }
    results['장비구분표'] = cnt;
  }

  // ── 3. 기성양식 시트 (COL.price) ──
  // gongjong:0, hogi:1, method:2, geology:3, unit:4, qty:5, price:6, amount:7
  // + 8열~ 월별 확정물량
  function importPriceTable(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM price_table').run();
    db.prepare('DELETE FROM confirmed_qty').run();
    const ins = db.prepare('INSERT INTO price_table (gongjong, hogi, method, geology, unit, qty, price, amount) VALUES (?,?,?,?,?,?,?,?)');
    const insConf = db.prepare('INSERT INTO confirmed_qty (gongjong, method, geology, month, qty) VALUES (?,?,?,?,?)');

    // 헤더에서 월 컬럼 찾기
    const hdr = rows[0];
    const monthCols = [];
    for (let c = 8; c < hdr.length; c++) {
      const m = parseMonth(hdr[c]);
      if (m) monthCols.push({ col: c, month: m });
    }

    let cnt = 0, confCnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const gongjong = str(r[0]), method = str(r[2]);
      if (!method) continue;
      const geo = str(r[3]), unit = str(r[4]) || 'm';
      const qty = num(r[5]), price = num(r[6]), amount = num(r[7]) || qty * price;
      ins.run(gongjong, str(r[1]), method, geo, unit, qty, price, amount);
      cnt++;

      // 월별 확정물량
      for (const mc of monthCols) {
        const mQty = num(r[mc.col]);
        if (mQty > 0) {
          insConf.run(gongjong, method, geo, mc.month, mQty);
          confCnt++;
        }
      }
    }
    results['기성양식'] = cnt;
    if (confCnt > 0) results['확정물량'] = confCnt;
  }

  // ── 4. 작업일지 시트 (COL.work) ──
  // gongjong:0, hogi:1, company:2, spec:3, date:4, month:5,
  // method:6, geology:7, qty:8, memo:9, section:10, status:12
  function importWorkLog(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM work_log').run();
    const ins = db.prepare(`INSERT INTO work_log (gongjong, hogi, company, spec, date, month, method, geology, qty, time_min, memo, section, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const date = fmtDate(r[4]);
      if (!date) continue;
      const qty = num(r[8]);
      if (!qty) continue;
      const month = date.substring(0, 7);
      const timMin = num(r[9]); // J열: 소요시간 (있으면)
      const memo = str(r[10]);  // K열: 메모/특이사항
      const section = str(r[11]); // L열: 구간 (있으면)
      const status = str(r[12]) || '정상'; // M열
      ins.run(str(r[0]), str(r[1]), str(r[2]), str(r[3]), date, month,
        str(r[6]), str(r[7]), qty, timMin, memo, section, status);
      cnt++;
    }
    results['작업일지'] = cnt;
  }

  // ── 5. 장비대 시트 (COL.equipCost) ──
  // type:0, equipName:3, spec:4, carNo:6, company:8, date:10, hours:11, price:12, amount:13, month:14, gongjong:15, hogi:20
  function importEquipCost(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM equip_cost').run();
    const ins = db.prepare(`INSERT INTO equip_cost (equip_type, equip_name, spec, car_no, company, date, hours, price, amount, month, gongjong, hogi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const date = fmtDate(r[10]);
      if (!date) continue;
      const amount = num(r[13]);
      if (!amount) continue;
      ins.run(str(r[0]), str(r[3]), str(r[4]), str(r[6]), str(r[8]),
        date, num(r[11]), num(r[12]), amount,
        parseMonth(r[14]) || date.substring(0, 7), str(r[15]), str(r[20]));
      cnt++;
    }
    results['장비대'] = cnt;
  }

  // ── 6. 유류비 시트 (COL.fuel) ──
  // type:0, station:2, equipName:3, spec:4, carNo:5, fuelType:6, company:7,
  // date:9, fuelQty:10, price:11, amount:13, month:14, gongjong:15, hogi:20
  function importFuelCost(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM fuel_cost').run();
    const ins = db.prepare(`INSERT INTO fuel_cost (fuel_type, station, equip_name, spec, car_no, company, date, fuel_qty, price, amount, month, gongjong, hogi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const date = fmtDate(r[9]);
      if (!date) continue;
      const amount = num(r[13]);
      if (!amount && !num(r[10])) continue;
      ins.run(str(r[6]), str(r[2]), str(r[3]), str(r[4]), str(r[5]), str(r[7]),
        date, num(r[10]), num(r[11]), amount,
        parseMonth(r[14]) || date.substring(0, 7), str(r[15]), str(r[20]));
      cnt++;
    }
    results['유류비'] = cnt;
  }

  // ── 7. 자재비 시트 (COL.material) ──
  // type:1, company:5, date:6, month:7, item:8, unit:10, qty:11, price:12, amount:13, gongjong:17
  function importMaterialCost(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM material_cost').run();
    const ins = db.prepare(`INSERT INTO material_cost (mat_type, company, date, month, item, unit, qty, price, amount, gongjong) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const date = fmtDate(r[6]);
      if (!date) continue;
      const amount = num(r[13]);
      if (!amount) continue;
      ins.run(str(r[1]), str(r[5]), date, parseMonth(r[7]) || date.substring(0, 7),
        str(r[8]), str(r[10]), num(r[11]), num(r[12]), amount, str(r[17]));
      cnt++;
    }
    results['자재비'] = cnt;
  }

  // ── 8. 노무비 시트 (COL.labor) ──
  // type:0, company:1, task:2, name:3, date:5, hours:6, price:7, amount:8, month:9, gongjong:10
  function importLaborCost(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM labor_cost').run();
    const ins = db.prepare(`INSERT INTO labor_cost (lab_type, company, task, name, date, hours, price, amount, month, gongjong) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const date = fmtDate(r[5]);
      if (!date) continue;
      const amount = num(r[8]);
      if (!amount) continue;
      ins.run(str(r[0]), str(r[1]), str(r[2]), str(r[3]),
        date, num(r[6]), num(r[7]), amount,
        parseMonth(r[9]) || date.substring(0, 7), str(r[10]));
      cnt++;
    }
    results['노무비'] = cnt;
  }

  // ── 9. 변경계약 시트 ──
  // gongjong:0, method:1, geology:2, unit:3, price:4, qty_orig:5, amt_orig:6, qty_mod:7, amt_mod:8, price_exec:9, amt_exec:10
  function importContractChange(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM contract_change').run();
    const ins = db.prepare(`INSERT INTO contract_change (gongjong, method, geology, unit, price, qty_orig, amt_orig, qty_mod, amt_mod, price_exec, amt_exec) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const method = str(r[1]);
      if (!method) continue;
      ins.run(str(r[0]), method, str(r[2]), str(r[3]) || 'm',
        num(r[4]), num(r[5]), num(r[6]), num(r[7]), num(r[8]), num(r[9]), num(r[10]));
      cnt++;
    }
    results['변경계약'] = cnt;
  }

  // ── 10. 간접비 시트 ──
  function importIndirect(sheetName) {
    const rows = readSheetRaw(sheetName);
    if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM indirect_config').run();
    const ins = db.prepare('INSERT INTO indirect_config (item, gubun, rate, formula) VALUES (?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const item = str(r[0]), gubun = str(r[1]);
      if (!item || !gubun) continue;
      ins.run(item, gubun, num(r[2]), str(r[3]));
      cnt++;
    }
    results['간접비'] = cnt;
  }

  // ══════════════════════════════════════
  // 시트명 매칭 후 임포트 실행
  // ══════════════════════════════════════
  const sheetMap = {
    '기본정보': importConfig,
    '장비구분표': importEquipment,
    '기성양식': importPriceTable,
    '작업일지': importWorkLog,
    '장비대': importEquipCost,
    '유류비': importFuelCost,
    '자재비': importMaterialCost,
    '노무비': importLaborCost,
    '변경계약': importContractChange,
    '간접비': importIndirect,
  };

  const tx = db.transaction(() => {
    for (const sn of sheetNames) {
      const importer = sheetMap[sn];
      if (importer) {
        try {
          importer(sn);
        } catch (e) {
          errors.push(`${sn}: ${e.message}`);
        }
      }
    }
  });

  try {
    tx();
    db.save();
  } catch (e) {
    errors.push('트랜잭션 오류: ' + e.message);
  }

  res.json({
    ok: errors.length === 0,
    sheetsFound: sheetNames,
    imported: results,
    errors,
    skipped: sheetNames.filter(sn => !sheetMap[sn])
  });
});

// GET /api/import/template-info — 시트 매핑 정보 (안내용)
router.get('/template-info', (req, res) => {
  res.json({
    sheets: [
      { name: '기본정보', desc: 'A열=항목명, B열=값', required: true },
      { name: '장비구분표', desc: 'A:호기 B:타입 C:차량번호 D:장비명 E:규격 F:업체 G:운전자 H:시작일 I:종료일 J:월대 K:일대 ...', required: true },
      { name: '기성양식', desc: 'A:공종 B:호기 C:공법 D:지질 E:단위 F:수량 G:단가 H:금액 I~:월별확정물량', required: true },
      { name: '작업일지', desc: 'A:공종 B:호기 C:업체 D:규격 E:날짜 F:월 G:공법 H:지질 I:수량 J:시간 K:메모 L:구간 M:상태', required: true },
      { name: '장비대', desc: 'A:타입 D:장비명 E:규격 G:차량번호 I:업체 K:날짜 L:시간 M:단가 N:금액 O:월 P:공종 U:호기', required: false },
      { name: '유류비', desc: 'A:타입 C:주유소 D:장비명 E:규격 F:차량번호 G:유종 H:업체 J:날짜 K:수량 L:단가 N:금액 O:월 P:공종 U:호기', required: false },
      { name: '자재비', desc: 'B:타입 F:업체 G:날짜 H:월 I:품명 K:단위 L:수량 M:단가 N:금액 R:공종', required: false },
      { name: '노무비', desc: 'A:타입 B:업체 C:직종 D:성명 F:날짜 G:시간 H:단가 I:금액 J:월 K:공종', required: false },
      { name: '변경계약', desc: 'A:공종 B:공법 C:지질 D:단위 E:단가 F:당초수량 G:당초금액 H:변경수량 I:변경금액 J:실행단가 K:실행금액', required: false },
      { name: '간접비', desc: 'A:항목 B:구분(기성/투입) C:비율 D:계산방식', required: false },
    ]
  });
});

export default router;
