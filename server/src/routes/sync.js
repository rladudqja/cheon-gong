import { Router } from 'express';
import XLSX from 'xlsx';
import { getDB } from '../db/connection.js';

const router = Router();

// ══════════════════════════════════════════════════════════
// Google Sheets 자동 동기화
//
// 사용법:
//   1. 스프레드시트 → 공유 → "링크가 있는 모든 사용자" → 뷰어 설정
//   2. 웹앱 → 기본정보 → spreadsheet_id에 스프레드시트 ID 입력
//      (URL에서 /d/ 뒤의 긴 문자열)
//
// 구조:
//   GET /api/sync/status    — 현재 동기화 상태
//   POST /api/sync/now      — 즉시 동기화 실행
//   POST /api/sync/auto     — 자동 동기화 on/off
// ══════════════════════════════════════════════════════════

let syncInterval = null;
let lastSync = null;
let lastError = null;
let syncing = false;

// ── 스프레드시트 ID에서 Excel 다운로드 ──
async function downloadSheet(spreadsheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`다운로드 실패: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// ── 임포트 로직 (import.js와 동일) ──
function importFromBuffer(buffer, selectedSheets) {
  const db = getDB();
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const results = {};
  const errors = [];

  function fmtDate(v) {
    if (!v) return null;
    if (v instanceof Date) {
      const y = v.getFullYear(), m = v.getMonth() + 1, d = v.getDate();
      if (y < 2000 || y > 2100) return null;
      return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
    }
    const s = String(v).trim();
    let match = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    match = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return null;
  }
  function num(v) { if (typeof v === 'number' && !isNaN(v)) return v; if (!v) return 0; const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function parseMonth(v) {
    if (!v) return '';
    if (v instanceof Date) { const y = v.getFullYear(), m = v.getMonth() + 1; return `${y}-${m < 10 ? '0' + m : m}`; }
    const s = String(v).trim();
    let match = s.match(/^(\d{4})[-./](\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}`;
    match = s.match(/(\d{4})\s*년?\s*(\d{1,2})\s*월/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}`;
    return '';
  }
  function readSheetRaw(name) {
    const ws = wb.Sheets[name];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  }

  // ── 각 시트 임포트 함수 ──
  function importConfig(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows) return;
    const upsert = db.prepare('INSERT INTO project_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const keyMap = { '현장명': 'name', '공종': 'gongjong', '계약물량': 'contract_qty', '공사시작일': 'start_date', '공사종료일': 'end_date', '정산일': 'settlement_day', '예상월대': 'est_monthly_rent', '예상일대': 'est_daily_rent' };
    let cnt = 0;
    rows.forEach(r => {
      const label = str(r[0]);
      for (const [k, dbKey] of Object.entries(keyMap)) {
        if (label.includes(k)) { let val = r[1]; val = dbKey.includes('date') ? (fmtDate(val) || str(val)) : str(val); upsert.run(dbKey, val); cnt++; }
      }
      if (label.includes('작업일수')) upsert.run('work_days_per_month', str(num(r[1]) || 25));
      if (label.includes('일일목표')) upsert.run('daily_target', str(num(r[1])));
    });
    results['기본정보'] = cnt;
  }

  function importEquipment(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM equipment').run();
    const ins = db.prepare('INSERT INTO equipment (hogi,equip_type,car_no,equip_name,spec,company,driver,start_date,end_date,monthly_rent,daily_rent,apply_days,set_group,drill_diameter,adjust_factor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], hogi = str(r[0]);
      if (!hogi || !hogi.match(/\d+\s*호기/)) continue;
      ins.run(hogi, str(r[1]), str(r[2]), str(r[3]), str(r[4]), str(r[5]), str(r[6]), fmtDate(r[7]) || '', fmtDate(r[8]) || '', num(r[9]), num(r[10]), num(r[11]), str(r[12]), num(r[13]), num(r[14]) || 1);
      cnt++;
    }
    results['장비구분표'] = cnt;
  }

  function importPriceTable(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM price_table').run();
    db.prepare('DELETE FROM confirmed_qty').run();
    const ins = db.prepare('INSERT INTO price_table (gongjong,hogi,method,geology,unit,qty,price,amount) VALUES (?,?,?,?,?,?,?,?)');
    const insConf = db.prepare('INSERT INTO confirmed_qty (gongjong,method,geology,month,qty) VALUES (?,?,?,?,?)');
    const hdr = rows[0], monthCols = [];
    for (let c = 8; c < hdr.length; c++) { const m = parseMonth(hdr[c]); if (m) monthCols.push({ col: c, month: m }); }
    let cnt = 0, confCnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], method = str(r[2]); if (!method) continue;
      const qty = num(r[5]), price = num(r[6]);
      ins.run(str(r[0]), str(r[1]), method, str(r[3]), str(r[4]) || 'm', qty, price, num(r[7]) || qty * price);
      cnt++;
      for (const mc of monthCols) { const mQty = num(r[mc.col]); if (mQty > 0) { insConf.run(str(r[0]), method, str(r[3]), mc.month, mQty); confCnt++; } }
    }
    results['기성양식'] = cnt;
    if (confCnt > 0) results['확정물량'] = confCnt;
  }

  function importWorkLog(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM work_log').run();
    const ins = db.prepare('INSERT INTO work_log (gongjong,hogi,company,spec,date,month,method,geology,qty,time_min,memo,section,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], date = fmtDate(r[4]); if (!date) continue;
      const qty = num(r[8]); if (!qty) continue;
      ins.run(str(r[0]), str(r[1]), str(r[2]), str(r[3]), date, date.substring(0, 7), str(r[6]), str(r[7]), qty, num(r[9]), str(r[10]), str(r[11]), str(r[12]) || '정상');
      cnt++;
    }
    results['작업일지'] = cnt;
  }

  function importEquipCost(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM equip_cost').run();
    const ins = db.prepare('INSERT INTO equip_cost (equip_type,equip_name,spec,car_no,company,date,hours,price,amount,month,gongjong,hogi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], date = fmtDate(r[10]); if (!date) continue;
      const amount = num(r[13]); if (!amount) continue;
      ins.run(str(r[0]), str(r[3]), str(r[4]), str(r[6]), str(r[8]), date, num(r[11]), num(r[12]), amount, parseMonth(r[14]) || date.substring(0, 7), str(r[15]), str(r[20]));
      cnt++;
    }
    results['장비대'] = cnt;
  }

  function importFuelCost(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM fuel_cost').run();
    const ins = db.prepare('INSERT INTO fuel_cost (fuel_type,station,equip_name,spec,car_no,company,date,fuel_qty,price,amount,month,gongjong,hogi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], date = fmtDate(r[9]); if (!date) continue;
      if (!num(r[13]) && !num(r[10])) continue;
      ins.run(str(r[6]), str(r[2]), str(r[3]), str(r[4]), str(r[5]), str(r[7]), date, num(r[10]), num(r[11]), num(r[13]), parseMonth(r[14]) || date.substring(0, 7), str(r[15]), str(r[20]));
      cnt++;
    }
    results['유류비'] = cnt;
  }

  function importMaterialCost(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM material_cost').run();
    const ins = db.prepare('INSERT INTO material_cost (mat_type,company,date,month,item,unit,qty,price,amount,gongjong) VALUES (?,?,?,?,?,?,?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], date = fmtDate(r[6]); if (!date) continue;
      if (!num(r[13])) continue;
      ins.run(str(r[1]), str(r[5]), date, parseMonth(r[7]) || date.substring(0, 7), str(r[8]), str(r[10]), num(r[11]), num(r[12]), num(r[13]), str(r[17]));
      cnt++;
    }
    results['자재비'] = cnt;
  }

  function importLaborCost(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM labor_cost').run();
    const ins = db.prepare('INSERT INTO labor_cost (lab_type,company,task,name,date,hours,price,amount,month,gongjong) VALUES (?,?,?,?,?,?,?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], date = fmtDate(r[5]); if (!date) continue;
      if (!num(r[8])) continue;
      ins.run(str(r[0]), str(r[1]), str(r[2]), str(r[3]), date, num(r[6]), num(r[7]), num(r[8]), parseMonth(r[9]) || date.substring(0, 7), str(r[10]));
      cnt++;
    }
    results['노무비'] = cnt;
  }

  function importContractChange(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM contract_change').run();
    const ins = db.prepare('INSERT INTO contract_change (gongjong,method,geology,unit,price,qty_orig,amt_orig,qty_mod,amt_mod,price_exec,amt_exec) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], method = str(r[1]); if (!method) continue;
      ins.run(str(r[0]), method, str(r[2]), str(r[3]) || 'm', num(r[4]), num(r[5]), num(r[6]), num(r[7]), num(r[8]), num(r[9]), num(r[10]));
      cnt++;
    }
    results['변경계약'] = cnt;
  }

  function importIndirect(sheetName) {
    const rows = readSheetRaw(sheetName); if (!rows || rows.length < 2) return;
    db.prepare('DELETE FROM indirect_config').run();
    const ins = db.prepare('INSERT INTO indirect_config (item,gubun,rate,formula) VALUES (?,?,?,?)');
    let cnt = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], item = str(r[0]), gubun = str(r[1]); if (!item || !gubun) continue;
      ins.run(item, gubun, num(r[2]), str(r[3])); cnt++;
    }
    results['간접비'] = cnt;
  }

  const sheetMap = {
    '기본정보': importConfig, '장비구분표': importEquipment, '기성양식': importPriceTable,
    '작업일지': importWorkLog, '장비대': importEquipCost, '유류비': importFuelCost,
    '자재비': importMaterialCost, '노무비': importLaborCost, '변경계약': importContractChange,
    '간접비': importIndirect,
  };

  // ★ selectedSheets가 지정되면 해당 시트만 임포트
  const sheetsToImport = selectedSheets && selectedSheets.length > 0
    ? selectedSheets
    : wb.SheetNames;

  const tx = db.transaction(() => {
    for (const sn of sheetsToImport) {
      const importer = sheetMap[sn];
      if (importer) { try { importer(sn); } catch (e) { errors.push(`${sn}: ${e.message}`); } }
    }
  });

  tx();
  db.save();

  const skipped = wb.SheetNames.filter(sn => !sheetsToImport.includes(sn) || !sheetMap[sn]);
  return { ok: errors.length === 0, imported: results, errors, sheets: wb.SheetNames, skipped };
}

// ── 동기화 실행 ──
async function runSync(selectedSheets) {
  if (syncing) return { ok: false, error: '이미 동기화 중' };
  syncing = true;

  const db = getDB();
  const idRow = db.prepare("SELECT value FROM project_config WHERE key = 'spreadsheet_id'").get();
  const spreadsheetId = idRow?.value;
  // 저장된 선택 시트 (selectedSheets 파라미터 없으면)
  const savedSheets = db.prepare("SELECT value FROM project_config WHERE key = 'sync_sheets'").get();
  const sheets = selectedSheets || (savedSheets?.value ? JSON.parse(savedSheets.value) : null);

  if (!spreadsheetId) {
    syncing = false;
    return { ok: false, error: 'spreadsheet_id가 설정되지 않았습니다.' };
  }

  try {
    const buffer = await downloadSheet(spreadsheetId);
    const result = importFromBuffer(buffer, sheets);
    // spreadsheet_id, sync_sheets 복원
    db.prepare("INSERT INTO project_config (key, value) VALUES ('spreadsheet_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(spreadsheetId);
    if (savedSheets?.value) {
      db.prepare("INSERT INTO project_config (key, value) VALUES ('sync_sheets', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(savedSheets.value);
    }
    db.save();

    lastSync = new Date().toISOString();
    lastError = null;
    syncing = false;
    return { ok: true, ...result, syncedAt: lastSync };
  } catch (e) {
    lastError = e.message;
    lastSync = new Date().toISOString();
    syncing = false;
    return { ok: false, error: e.message };
  }
}

// GET /api/sync/status
router.get('/status', (req, res) => {
  const db = getDB();
  const idRow = db.prepare("SELECT value FROM project_config WHERE key = 'spreadsheet_id'").get();
  const intervalRow = db.prepare("SELECT value FROM project_config WHERE key = 'sync_interval'").get();
  const sheetsRow = db.prepare("SELECT value FROM project_config WHERE key = 'sync_sheets'").get();
  res.json({
    spreadsheetId: idRow?.value || '',
    autoSync: !!syncInterval,
    intervalMinutes: parseInt(intervalRow?.value) || 0,
    selectedSheets: sheetsRow?.value ? JSON.parse(sheetsRow.value) : [],
    lastSync,
    lastError,
    syncing
  });
});

// POST /api/sync/select-sheets — 동기화할 시트 선택 저장 { sheets: ['작업일지','장비대'] }
router.post('/select-sheets', (req, res) => {
  const { sheets } = req.body;
  const db = getDB();
  db.prepare("INSERT INTO project_config (key, value) VALUES ('sync_sheets', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(sheets || []));
  db.save();
  res.json({ ok: true, selected: sheets });
});

// GET /api/sync/preview — 스프레드시트 시트(탭) 목록 미리보기
router.get('/preview', async (req, res) => {
  const db = getDB();
  const idRow = db.prepare("SELECT value FROM project_config WHERE key = 'spreadsheet_id'").get();
  if (!idRow?.value) return res.json({ ok: false, error: '스프레드시트 미연결' });

  try {
    const buffer = await downloadSheet(idRow.value);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const IMPORTABLE = ['기본정보','장비구분표','기성양식','작업일지','장비대','유류비','자재비','노무비','변경계약','간접비'];
    const sheets = wb.SheetNames.map(name => ({
      name,
      importable: IMPORTABLE.includes(name),
      rows: wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 }).length - 1 : 0
    }));
    res.json({ ok: true, sheets });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// POST /api/sync/now — 즉시 동기화 { sheets: ['작업일지','장비대'] } (선택사항)
router.post('/now', async (req, res) => {
  const { sheets } = req.body || {};
  const result = await runSync(sheets && sheets.length > 0 ? sheets : null);
  res.json(result);
});

// POST /api/sync/auto — 자동 동기화 설정 { enabled: true, intervalMinutes: 30 }
router.post('/auto', (req, res) => {
  const { enabled, intervalMinutes } = req.body;
  const db = getDB();

  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }

  if (enabled && intervalMinutes > 0) {
    const ms = intervalMinutes * 60 * 1000;
    syncInterval = setInterval(() => runSync(), ms);
    db.prepare("INSERT INTO project_config (key, value) VALUES ('sync_interval', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(intervalMinutes));
    db.save();
    res.json({ ok: true, message: `${intervalMinutes}분 간격 자동 동기화 시작` });
  } else {
    db.prepare("INSERT INTO project_config (key, value) VALUES ('sync_interval', '0') ON CONFLICT(key) DO UPDATE SET value = '0'").run();
    db.save();
    res.json({ ok: true, message: '자동 동기화 중지' });
  }
});

// POST /api/sync/set-sheet — 스프레드시트 ID 설정 { spreadsheetId: "..." }
router.post('/set-sheet', (req, res) => {
  const { spreadsheetId } = req.body;
  if (!spreadsheetId) return res.status(400).json({ error: 'spreadsheetId 필요' });
  const db = getDB();
  db.prepare("INSERT INTO project_config (key, value) VALUES ('spreadsheet_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(spreadsheetId);
  db.save();
  res.json({ ok: true });
});

export default router;
