import { Router } from 'express';
import { getDB } from '../db/connection.js';

const router = Router();

// ══════════════════════════════════════════
// GET /api/reports/drilling?to=&gongjong=
// ══════════════════════════════════════════
router.get('/drilling', (req, res) => {
  const db = getDB();
  const to = req.query.to || '9999-12-31';
  const gj = req.query.gongjong || '';
  let where = 'date <= ?';
  const params = [to];
  if (gj) { where += ' AND gongjong = ?'; params.push(gj); }

  const details = db.prepare(`SELECT date, hogi, method, geology, qty, section, memo FROM work_log WHERE ${where} AND qty > 0 ORDER BY date, hogi, method`).all(...params);
  const byDate = db.prepare(`SELECT date, COALESCE(SUM(qty),0) as total, GROUP_CONCAT(DISTINCT hogi) as hogis FROM work_log WHERE ${where} AND qty > 0 GROUP BY date ORDER BY date`).all(...params);
  const byHogi = db.prepare(`SELECT hogi, COALESCE(SUM(qty),0) as total, COUNT(DISTINCT date) as days FROM work_log WHERE ${where} AND qty > 0 GROUP BY hogi ORDER BY hogi`).all(...params);
  const byGeology = db.prepare(`SELECT geology, COALESCE(SUM(qty),0) as total FROM work_log WHERE ${where} AND qty > 0 GROUP BY geology ORDER BY geology`).all(...params);
  const byMethod = db.prepare(`SELECT method, COALESCE(SUM(qty),0) as total FROM work_log WHERE ${where} AND qty > 0 GROUP BY method ORDER BY method`).all(...params);
  const dateHogi = db.prepare(`SELECT date, hogi, COALESCE(SUM(qty),0) as qty FROM work_log WHERE ${where} AND qty > 0 GROUP BY date, hogi ORDER BY date, hogi`).all(...params);
  const dateGeology = db.prepare(`SELECT date, geology, COALESCE(SUM(qty),0) as qty FROM work_log WHERE ${where} AND qty > 0 GROUP BY date, geology ORDER BY date, geology`).all(...params);
  const dateMethod = db.prepare(`SELECT date, method, COALESCE(SUM(qty),0) as qty FROM work_log WHERE ${where} AND qty > 0 GROUP BY date, method ORDER BY date, method`).all(...params);
  const grand = db.prepare(`SELECT COALESCE(SUM(qty),0) as total, COUNT(*) as count, COUNT(DISTINCT date) as days, COUNT(DISTINCT hogi) as hogis FROM work_log WHERE ${where} AND qty > 0`).get(...params);

  res.json({ grand, details, byDate, byHogi, byGeology, byMethod, dateHogi, dateGeology, dateMethod });
});

// ══════════════════════════════════════════
// 헬퍼: 투입비 집계
// ══════════════════════════════════════════
function getCostBreakdown(db, dateWhere, dateParams) {
  const sumTbl = (table) => db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM ${table} WHERE ${dateWhere}`).get(...dateParams).t;
  const eq = sumTbl('equip_cost'), fu = sumTbl('fuel_cost'), mt = sumTbl('material_cost'), lb = sumTbl('labor_cost');
  return { equipment: eq, fuel: fu, material: mt, labor: lb, total: eq + fu + mt + lb };
}

function getCostByHogi(db, dateWhere, dateParams) {
  const map = {};
  ['equip_cost', 'fuel_cost'].forEach(tbl => {
    const rows = db.prepare(`SELECT hogi, COALESCE(SUM(amount),0) as amt FROM ${tbl} WHERE ${dateWhere} AND hogi != '' GROUP BY hogi`).all(...dateParams);
    rows.forEach(r => {
      if (!map[r.hogi]) map[r.hogi] = { equipment: 0, fuel: 0, material: 0, labor: 0, total: 0 };
      map[r.hogi][tbl === 'equip_cost' ? 'equipment' : 'fuel'] += r.amt;
      map[r.hogi].total += r.amt;
    });
  });
  return map;
}

// ══════════════════════════════════════════
// GET /api/reports/daily-profit?date=&gongjong=
// 일일손익분석 — GAS 03_일일손익 전체 대응
// ══════════════════════════════════════════
router.get('/daily-profit', (req, res) => {
  const db = getDB();
  const date = req.query.date;
  const gj = req.query.gongjong || '';
  if (!date) return res.status(400).json({ error: 'date required' });

  const gjW = gj ? ' AND gongjong = ?' : '';
  const gjP = gj ? [gj] : [];

  // ── 단가표 ──
  const prices = db.prepare('SELECT method, geology, price, qty as contract_qty FROM price_table').all();
  const priceMap = {};
  let contractQty = 0, contractAmt = 0;
  prices.forEach(p => {
    if (p.geology) {
      priceMap[p.method + '|' + p.geology] = p.price;
      contractQty += p.contract_qty || 0;
      contractAmt += (p.contract_qty || 0) * p.price;
    }
  });
  // 부대항목 (근입 등)
  const subItems = prices.filter(p => !p.geology || ['근입', '타설', '케이싱설치'].some(s => p.method?.includes(s)));

  // project config
  const cfgRows = db.prepare('SELECT key, value FROM project_config').all();
  const cfg = {};
  cfgRows.forEach(r => cfg[r.key] = r.value);
  if (parseFloat(cfg.contract_qty) > 0) contractQty = parseFloat(cfg.contract_qty);

  // ── 당일 천공 (공법+지질별) ──
  const dailyWork = db.prepare(`SELECT method, geology, COALESCE(SUM(qty),0) as qty FROM work_log WHERE date = ? ${gjW} AND qty > 0 GROUP BY method, geology`).all(date, ...gjP);

  // ── 누계 천공 (공법+지질별) ──
  const totalWork = db.prepare(`SELECT method, geology, COALESCE(SUM(qty),0) as qty FROM work_log WHERE date <= ? ${gjW} AND qty > 0 GROUP BY method, geology`).all(date, ...gjP);

  // 기성 계산
  let dailyQty = 0, dailyRevenue = 0, totalQty = 0, totalRevenue = 0;
  const dailyByMG = {}, totalByMG = {};
  dailyWork.forEach(w => {
    const p = priceMap[w.method + '|' + w.geology] || 0;
    dailyRevenue += w.qty * p; dailyQty += w.qty;
    dailyByMG[w.method + '|' + w.geology] = { method: w.method, geology: w.geology, qty: w.qty, amount: w.qty * p };
  });
  totalWork.forEach(w => {
    const p = priceMap[w.method + '|' + w.geology] || 0;
    totalRevenue += w.qty * p; totalQty += w.qty;
    totalByMG[w.method + '|' + w.geology] = { method: w.method, geology: w.geology, qty: w.qty, amount: w.qty * p };
  });

  // ── 호기별 당일/누계 천공 ──
  const dailyByHogi = db.prepare(`SELECT hogi, COALESCE(SUM(qty),0) as qty FROM work_log WHERE date = ? ${gjW} AND qty > 0 GROUP BY hogi ORDER BY hogi`).all(date, ...gjP);
  const totalByHogi = db.prepare(`SELECT hogi, COALESCE(SUM(qty),0) as qty, COUNT(DISTINCT date) as days FROM work_log WHERE date <= ? ${gjW} AND qty > 0 GROUP BY hogi ORDER BY hogi`).all(date, ...gjP);

  // ── 호기별 공법 분포 (누계) ──
  const hogiMethodRows = db.prepare(`SELECT hogi, method, COALESCE(SUM(qty),0) as qty FROM work_log WHERE date <= ? ${gjW} AND qty > 0 GROUP BY hogi, method`).all(date, ...gjP);
  const hogiMethodMap = {};
  hogiMethodRows.forEach(r => {
    if (!hogiMethodMap[r.hogi]) hogiMethodMap[r.hogi] = {};
    hogiMethodMap[r.hogi][r.method] = r.qty;
  });

  // ── 투입비 ──
  const dailyCost = getCostBreakdown(db, `date = ? ${gjW}`, [date, ...gjP]);
  const totalCost = getCostBreakdown(db, `date <= ? ${gjW}`, [date, ...gjP]);
  const costByHogi = getCostByHogi(db, `date <= ? ${gjW}`, [date, ...gjP]);

  // ── 누계 통계 ──
  const workDays = db.prepare(`SELECT COUNT(DISTINCT date) as d FROM work_log WHERE date <= ? ${gjW} AND qty > 0`).get(date, ...gjP).d;
  const dailyAvg = workDays > 0 ? totalQty / workDays : 0;

  // ── 잔여 분석 ──
  const remainQty = contractQty - totalQty;
  const progressRate = contractQty > 0 ? totalQty / contractQty : 0;

  // 잔여 공사일수 (일요일 제외)
  const endDate = cfg.end_date ? new Date(cfg.end_date) : null;
  const rptDate = new Date(date);
  let remainDays = 0;
  if (endDate && endDate > rptDate) {
    let cur = new Date(rptDate); cur.setDate(cur.getDate() + 1);
    while (cur <= endDate) {
      if (cur.getDay() !== 0) remainDays++;
      cur.setDate(cur.getDate() + 1);
    }
  }
  const requiredDaily = remainDays > 0 ? remainQty / remainDays : 0;

  // 호기별 일평균 (1대 기준)
  const totalHogiDays = totalByHogi.reduce((s, h) => s + h.days, 0);
  const perUnitAvg = totalHogiDays > 0 ? totalQty / totalHogiDays : 0;

  // ── 공법별 비율 (누계) ──
  const byMethod = db.prepare(`SELECT method, COALESCE(SUM(qty),0) as qty FROM work_log WHERE date <= ? ${gjW} AND qty > 0 GROUP BY method`).all(date, ...gjP);

  // ── 지질별 비율 (누계) ──
  const byGeology = db.prepare(`SELECT geology, COALESCE(SUM(qty),0) as qty FROM work_log WHERE date <= ? ${gjW} AND qty > 0 GROUP BY geology`).all(date, ...gjP);

  // ── 일별 추이 (최근 14일) ──
  const trend = db.prepare(`SELECT date, COALESCE(SUM(qty),0) as qty FROM work_log WHERE date <= ? AND date > date(?, '-14 days') ${gjW} AND qty > 0 GROUP BY date ORDER BY date`).all(date, date, ...gjP);

  // ── 호기별 상세 (장비정보 결합) ──
  const equipList = db.prepare('SELECT * FROM equipment ORDER BY hogi').all();
  const equipByHogi = {};
  equipList.forEach(e => {
    if (!equipByHogi[e.hogi]) equipByHogi[e.hogi] = [];
    equipByHogi[e.hogi].push(e);
  });

  const hogiDetails = totalByHogi.map(h => {
    const eqs = equipByHogi[h.hogi] || [];
    const mainEq = eqs.find(e => e.equip_type?.includes('메인') || e.equip_name?.includes('항타')) || eqs[0] || {};
    const costH = costByHogi[h.hogi] || { equipment: 0, fuel: 0, total: 0 };
    const dailyH = dailyByHogi.find(d => d.hogi === h.hogi);
    const methods = hogiMethodMap[h.hogi] || {};
    return {
      hogi: h.hogi,
      company: mainEq.company || '-',
      spec: mainEq.spec || '-',
      driver: mainEq.driver || '-',
      startDate: mainEq.start_date || '',
      endDate: mainEq.end_date || '',
      dailyQty: dailyH?.qty || 0,
      totalQty: h.qty,
      workDays: h.days,
      dailyAvg: h.days > 0 ? h.qty / h.days : 0,
      cost: costH,
      methods
    };
  });

  // 호기 중 일평균 최고
  const maxAvg = Math.max(...hogiDetails.map(h => h.dailyAvg), 0);

  res.json({
    date,
    config: cfg,
    contract: { qty: contractQty, amount: contractAmt },
    daily: {
      qty: dailyQty,
      revenue: dailyRevenue,
      cost: dailyCost,
      profit: dailyRevenue - dailyCost.total,
      byMethodGeo: dailyByMG,
      byHogi: dailyByHogi,
      unitCount: dailyByHogi.length
    },
    total: {
      qty: totalQty,
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalRevenue - totalCost.total,
      byMethodGeo: totalByMG,
      byHogi: totalByHogi,
      workDays,
      dailyAvg,
      perUnitAvg,
      hogiCount: totalByHogi.length,
      totalHogiDays
    },
    progress: {
      remainQty,
      remainDays,
      progressRate,
      requiredDaily,
      avgVsRequired: dailyAvg - requiredDaily
    },
    byMethod,
    byGeology,
    trend,
    hogiDetails,
    maxAvg
  });
});

// ══════════════════════════════════════════
// GET /api/reports/hogi-analysis?to=&gongjong=
// 호기별분석 — GAS 04_호기별 대응
// ══════════════════════════════════════════
router.get('/hogi-analysis', (req, res) => {
  const db = getDB();
  const to = req.query.to || '9999-12-31';
  const gj = req.query.gongjong || '';
  const gjW = gj ? ' AND gongjong = ?' : '';
  const gjP = gj ? [gj] : [];

  // config
  const cfgRows = db.prepare('SELECT key, value FROM project_config').all();
  const cfg = {}; cfgRows.forEach(r => cfg[r.key] = r.value);
  const wdpm = parseInt(cfg.work_days_per_month) || 25;

  // 단가표
  const prices = db.prepare('SELECT method, geology, price FROM price_table WHERE geology IS NOT NULL AND geology != ""').all();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.method + '|' + p.geology] = p.price; });

  // 부대항목
  const subPrices = db.prepare("SELECT method, price FROM price_table WHERE geology IS NULL OR geology = ''").all();

  // 장비 정보
  const equipAll = db.prepare('SELECT * FROM equipment ORDER BY hogi').all();
  const equipByHogi = {};
  equipAll.forEach(e => {
    if (!equipByHogi[e.hogi]) equipByHogi[e.hogi] = [];
    equipByHogi[e.hogi].push(e);
  });

  // ── 호기별 천공 (누계) ──
  const workByHogi = db.prepare(`
    SELECT hogi, method, geology,
           COALESCE(SUM(qty), 0) as qty,
           COUNT(DISTINCT date) as days
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY hogi, method, geology
  `).all(to, ...gjP);

  // 호기별 날짜별 (가동일 계산용)
  const workDates = db.prepare(`
    SELECT hogi, date, COALESCE(SUM(qty), 0) as qty
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY hogi, date
  `).all(to, ...gjP);

  // 호기별 공법별 가동일/물량
  const workByHogiMethod = db.prepare(`
    SELECT hogi, method,
           COALESCE(SUM(qty), 0) as qty,
           COUNT(DISTINCT date) as days
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY hogi, method
  `).all(to, ...gjP);

  // 호기별 상태별 (정상/비정상)
  const workStatus = db.prepare(`
    SELECT hogi, date, status, COALESCE(SUM(qty), 0) as qty
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY hogi, date, status
  `).all(to, ...gjP);

  // ── 투입비 (호기별 + 장비타입별) ──
  const equipCostByHogi = db.prepare(`
    SELECT hogi, equip_name, COALESCE(SUM(amount), 0) as amount
    FROM equip_cost WHERE date <= ? ${gjW} AND hogi != ''
    GROUP BY hogi, equip_name
  `).all(to, ...gjP);

  const fuelByHogi = db.prepare(`
    SELECT hogi, equip_name, fuel_type,
           COALESCE(SUM(fuel_qty), 0) as fuel_qty,
           COALESCE(SUM(amount), 0) as amount
    FROM fuel_cost WHERE date <= ? ${gjW} AND hogi != ''
    GROUP BY hogi, equip_name, fuel_type
  `).all(to, ...gjP);

  // 전체 투입비
  const totalCostAll = getCostBreakdown(db, `date <= ? ${gjW}`, [to, ...gjP]);

  // ── 기간별 효율 (5/10/20/30일) ──
  const periods = [5, 10, 20, 30];
  const periodData = {};
  for (const days of periods) {
    const fromDate = new Date(to);
    fromDate.setDate(fromDate.getDate() - days);
    const fromStr = fromDate.toISOString().slice(0, 10);
    periodData['d' + days] = db.prepare(`
      SELECT hogi, method,
             COALESCE(SUM(qty), 0) as qty,
             COUNT(DISTINCT date) as days
      FROM work_log WHERE date > ? AND date <= ? ${gjW} AND qty > 0
      GROUP BY hogi, method
    `).all(fromStr, to, ...gjP);
  }

  // ── 집계 ──
  const hogiSet = new Set();
  workByHogi.forEach(r => hogiSet.add(r.hogi));
  const hogiList = [...hogiSet].sort();

  // 호기별 상세 조립
  const hogiDetails = hogiList.map(hogi => {
    const eqs = equipByHogi[hogi] || [];
    const mainEq = eqs.find(e => e.equip_type?.includes('메인') || e.equip_name?.includes('항타')) || eqs[0] || {};

    // 천공 집계
    const workRows = workByHogi.filter(r => r.hogi === hogi);
    let totalQty = 0, revenue = 0;
    const byMethodGeo = {};
    workRows.forEach(r => {
      totalQty += r.qty;
      const p = priceMap[r.method + '|' + r.geology] || 0;
      revenue += r.qty * p;
      byMethodGeo[r.method + '|' + r.geology] = { method: r.method, geology: r.geology, qty: r.qty, amount: r.qty * p };
    });

    // 가동일
    const dates = workDates.filter(r => r.hogi === hogi);
    const workDayCount = dates.length;
    const dailyAvg = workDayCount > 0 ? totalQty / workDayCount : 0;

    // 공법별
    const methodRows = workByHogiMethod.filter(r => r.hogi === hogi);
    const byMethod = {};
    methodRows.forEach(r => { byMethod[r.method] = { qty: r.qty, days: r.days, avg: r.days > 0 ? r.qty / r.days : 0 }; });

    // 정상/비정상
    const statusRows = workStatus.filter(r => r.hogi === hogi);
    const dateStatusMap = {};
    statusRows.forEach(r => {
      if (!dateStatusMap[r.date]) dateStatusMap[r.date] = { status: '정상', qty: 0 };
      dateStatusMap[r.date].qty += r.qty;
      if (r.status !== '정상') dateStatusMap[r.date].status = r.status;
    });
    let normalDays = 0, normalQty = 0, abnormalDays = 0, abnormalQty = 0;
    const abnormalDetails = {};
    Object.values(dateStatusMap).forEach(d => {
      if (d.status === '정상') { normalDays++; normalQty += d.qty; }
      else {
        abnormalDays++; abnormalQty += d.qty;
        if (!abnormalDetails[d.status]) abnormalDetails[d.status] = { days: 0, qty: 0 };
        abnormalDetails[d.status].days++; abnormalDetails[d.status].qty += d.qty;
      }
    });

    // 투입비
    const eqCostRows = equipCostByHogi.filter(r => r.hogi === hogi);
    const fuelRows = fuelByHogi.filter(r => r.hogi === hogi);
    let equipCost = 0, fuelCost = 0, fuelQtyTotal = 0;
    const costByEquipType = {};
    eqCostRows.forEach(r => {
      equipCost += r.amount;
      const t = normalizeEquipName(r.equip_name);
      if (!costByEquipType[t]) costByEquipType[t] = { equipCost: 0, fuelCost: 0, fuelQty: 0 };
      costByEquipType[t].equipCost += r.amount;
    });
    fuelRows.forEach(r => {
      fuelCost += r.amount;
      const isGyeongyu = r.fuel_type?.includes('경유');
      const fq = isGyeongyu ? r.fuel_qty : 0;
      fuelQtyTotal += fq;
      const t = normalizeEquipName(r.equip_name);
      if (!costByEquipType[t]) costByEquipType[t] = { equipCost: 0, fuelCost: 0, fuelQty: 0 };
      costByEquipType[t].fuelCost += r.amount;
      costByEquipType[t].fuelQty += fq;
    });
    const directCost = equipCost + fuelCost;

    // 투입일수 (기간 비례)
    let deployDays = 0;
    if (mainEq.start_date) {
      const sD = new Date(mainEq.start_date);
      const eD = mainEq.end_date ? new Date(mainEq.end_date) : new Date(to);
      const rD = new Date(to);
      const effEnd = eD < rD ? eD : rD;
      if (sD <= effEnd) {
        const calDays = Math.floor((effEnd - sD) / 86400000) + 1;
        deployDays = Math.round(calDays / 30 * wdpm);
      }
    }

    // 기간별 효율
    const periodStats = {};
    for (const days of periods) {
      const key = 'd' + days;
      const rows = periodData[key].filter(r => r.hogi === hogi);
      const t4 = rows.find(r => r.method === 'T4') || { qty: 0, days: 0 };
      const tor = rows.find(r => r.method === '토네이도') || { qty: 0, days: 0 };
      const totalP = rows.reduce((s, r) => s + r.qty, 0);
      const totalD = new Set(rows.map(r => r.hogi + r.method)).size > 0
        ? Math.max(...rows.map(r => r.days), 0) : 0;
      // 실제 가동일 계산 (기간 내 날짜수)
      const fromDate2 = new Date(to); fromDate2.setDate(fromDate2.getDate() - days);
      const fromStr2 = fromDate2.toISOString().slice(0, 10);
      const periodDates = dates.filter(d => d.date > fromStr2 && d.date <= to);
      const actualDays = periodDates.length;
      periodStats[key] = {
        t4: { qty: t4.qty, days: t4.days, avg: t4.days > 0 ? t4.qty / t4.days : 0 },
        tornado: { qty: tor.qty, days: tor.days, avg: tor.days > 0 ? tor.qty / tor.days : 0 },
        total: { qty: totalP, days: actualDays, avg: actualDays > 0 ? totalP / actualDays : 0 }
      };
    }

    // 추세 판단
    const d5Avg = periodStats.d5?.total.avg || 0;
    const d30Avg = periodStats.d30?.total.avg || 0;
    let trend = '→', trendLabel = '안정';
    if (d5Avg > 0 && d30Avg > 0) {
      const change = (d5Avg - d30Avg) / d30Avg * 100;
      if (change > 10) { trend = '↑↑'; trendLabel = '개선'; }
      else if (change > 0) { trend = '↑'; trendLabel = '개선'; }
      else if (change > -10) { trend = '→'; trendLabel = '안정'; }
      else if (change > -20) { trend = '↓'; trendLabel = '주의'; }
      else { trend = '↓↓'; trendLabel = '악화'; }
    }

    // L/m (경유 L ÷ 천공 m)
    const lPerM = totalQty > 0 ? fuelQtyTotal / totalQty : 0;

    // 구경 보정
    const adjFactor = mainEq.adjust_factor || 1;
    const diameter = mainEq.drill_diameter || 0;
    const adjAvg = dailyAvg * adjFactor;

    return {
      hogi,
      company: mainEq.company || '-',
      spec: mainEq.spec || '-',
      driver: mainEq.driver || '-',
      diameter,
      adjFactor,
      startDate: mainEq.start_date || '',
      endDate: mainEq.end_date || '',
      equipCount: eqs.length,
      totalQty,
      revenue,
      workDays: workDayCount,
      deployDays,
      dailyAvg,
      adjAvg,
      byMethod,
      byMethodGeo,
      normal: { days: normalDays, qty: normalQty, avg: normalDays > 0 ? normalQty / normalDays : 0 },
      abnormal: { days: abnormalDays, qty: abnormalQty, details: abnormalDetails },
      cost: {
        equipment: equipCost,
        fuel: fuelCost,
        fuelQty: fuelQtyTotal,
        direct: directCost,
        byEquipType: costByEquipType
      },
      mPerDanga: totalQty > 0 ? Math.round(directCost / totalQty) : 0,
      avgDailyRent: deployDays > 0 ? Math.round(directCost / deployDays) : 0,
      lPerM: Math.round(lPerM * 100) / 100,
      periodStats,
      trend,
      trendLabel
    };
  });

  // ── 전체 합산 ──
  const allTotalQty = hogiDetails.reduce((s, h) => s + h.totalQty, 0);
  const allRevenue = hogiDetails.reduce((s, h) => s + h.revenue, 0);
  const allWorkDays = hogiDetails.reduce((s, h) => s + h.workDays, 0);
  const allDeployDays = hogiDetails.reduce((s, h) => s + h.deployDays, 0);
  const allDirectCost = hogiDetails.reduce((s, h) => s + h.cost.direct, 0);
  const allFuelQty = hogiDetails.reduce((s, h) => s + h.cost.fuelQty, 0);

  // 미배분 비용 (전체 - 호기배분)
  const unassignedCost = totalCostAll.total - allDirectCost;

  // 순위 (보정 일평균 기준)
  const sorted = [...hogiDetails].sort((a, b) => b.adjAvg - a.adjAvg);
  const bestAdjAvg = sorted.length > 0 ? sorted[0].adjAvg : 0;
  sorted.forEach((h, i) => {
    h.rank = i + 1;
    h.efficiency = bestAdjAvg > 0 ? h.adjAvg / bestAdjAvg * 100 : 0;
  });

  // L/m 순위 (낮을수록 좋음)
  const sortedLM = [...hogiDetails].filter(h => h.lPerM > 0).sort((a, b) => a.lPerM - b.lPerM);
  const bestLM = sortedLM.length > 0 ? sortedLM[0].lPerM : 0;
  sortedLM.forEach((h, i) => {
    h.lmRank = i + 1;
    h.lmEff = bestLM > 0 ? bestLM / h.lPerM * 100 : 0;
  });
  // lmRank 없는 호기에 기본값
  hogiDetails.forEach(h => { if (!h.lmRank) { h.lmRank = '-'; h.lmEff = 0; } });

  // 공통분배 비율
  hogiDetails.forEach(h => {
    const share = allWorkDays > 0 ? Math.round(unassignedCost * h.workDays / allWorkDays) : 0;
    h.commonCost = share;
    h.totalCost = h.cost.direct + share;
  });

  res.json({
    reportDate: to,
    config: cfg,
    hogiList,
    hogiDetails,
    summary: {
      totalQty: allTotalQty,
      totalRevenue: allRevenue,
      totalWorkDays: allWorkDays,
      totalDeployDays: allDeployDays,
      totalDirectCost: allDirectCost,
      totalCostAll: totalCostAll.total,
      unassignedCost,
      totalFuelQty: allFuelQty,
      hogiCount: hogiList.length,
      bestAdjAvg,
      bestLM
    }
  });
});

// ══════════════════════════════════════════
// GET /api/reports/gisung?to=&date=&gongjong=
// 기성산출 — GAS 07_기성산출 대응
// 계약단가 × 실적물량 = 기성금액 (전체 + 호기별)
// ══════════════════════════════════════════
router.get('/gisung', (req, res) => {
  const db = getDB();
  const to = req.query.to || req.query.date || '9999-12-31';
  const gj = req.query.gongjong || '';
  const gjW = gj ? ' AND gongjong = ?' : '';
  const gjP = gj ? [gj] : [];

  // config
  const cfgRows = db.prepare('SELECT key, value FROM project_config').all();
  const cfg = {}; cfgRows.forEach(r => cfg[r.key] = r.value);

  // 단가표 (천공 항목)
  const priceRows = db.prepare(`
    SELECT id, gongjong, method, geology, unit, qty as contract_qty, price, amount as contract_amount
    FROM price_table WHERE geology IS NOT NULL AND geology != ''
    ORDER BY method, geology
  `).all();

  // 부대항목 (근입/타설/케이싱설치)
  const subItemRows = db.prepare(`
    SELECT method, geology, qty as contract_qty, price
    FROM price_table WHERE geology IS NULL OR geology = ''
  `).all();

  const priceMap = {};
  priceRows.forEach(p => { priceMap[p.method + '|' + p.geology] = p.price; });

  // 부대항목 판별
  const isSubItem = (m) => ['근입', '타설', '케이싱'].some(s => m?.includes(s));
  const getSubQtyType = (m) => m?.includes('케이싱') ? '토사' : 'all';

  // 당일 실적 (공법+지질별 + 호기별)
  const dailyWork = db.prepare(`
    SELECT hogi, method, geology, COALESCE(SUM(qty),0) as qty
    FROM work_log WHERE date = ? ${gjW} AND qty > 0
    GROUP BY hogi, method, geology
  `).all(to, ...gjP);

  // 누계 실적
  const totalWork = db.prepare(`
    SELECT hogi, method, geology, COALESCE(SUM(qty),0) as qty
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY hogi, method, geology
  `).all(to, ...gjP);

  // 호기 목록
  const hogiSet = new Set();
  totalWork.forEach(r => hogiSet.add(r.hogi));
  const hogiList = [...hogiSet].sort();

  // ── 키별 집계 함수 ──
  function buildKeyMap(rows) {
    // { 'ALL|T4|토사': qty, '1호기|T4|토사': qty, ... }
    const map = {};
    rows.forEach(r => {
      const hogiKey = r.hogi + '|' + r.method + '|' + r.geology;
      const allKey = 'ALL|' + r.method + '|' + r.geology;
      map[hogiKey] = (map[hogiKey] || 0) + r.qty;
      map[allKey] = (map[allKey] || 0) + r.qty;
    });
    return map;
  }

  const dailyMap = buildKeyMap(dailyWork);
  const totalMap = buildKeyMap(totalWork);

  // 전체 누계 수량 (천공)
  let totalActualQty = 0;
  priceRows.forEach(p => {
    totalActualQty += totalMap['ALL|' + p.method + '|' + p.geology] || 0;
  });

  // ── 블록 빌더 (전체 or 호기별) ──
  function buildBlock(prefix, label) {
    const GEO_ORDER = ['토사', '풍화암', '연암', '보통암', '경암'];
    const geoSort = (a, b) => {
      const ia = GEO_ORDER.indexOf(a); const ib = GEO_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    };

    // 지질별 그룹핑
    const geoGroups = {};
    priceRows.forEach(p => {
      const g = p.geology || '-';
      if (!geoGroups[g]) geoGroups[g] = [];
      geoGroups[g].push(p);
    });
    const geoOrder = Object.keys(geoGroups).sort(geoSort);

    const items = [];
    let sumContractQty = 0, sumContractAmt = 0;
    let sumDailyQty = 0, sumDailyAmt = 0;
    let sumTotalQty = 0, sumTotalAmt = 0;
    let sumRemainQty = 0, sumRemainAmt = 0;

    // 공법별 소계
    const methodSums = {};

    for (const geo of geoOrder) {
      const geoItems = geoGroups[geo];
      let gSumCQ = 0, gSumCA = 0, gSumDQ = 0, gSumDA = 0, gSumTQ = 0, gSumTA = 0;

      for (const p of geoItems) {
        const key = prefix + '|' + p.method + '|' + p.geology;
        const dQty = dailyMap[key] || 0;
        const tQty = totalMap[key] || 0;
        const dAmt = dQty * p.price;
        const tAmt = tQty * p.price;
        const rQty = p.contract_qty - tQty;
        const rAmt = rQty * p.price;

        // 비율 (전체 누계 대비)
        const blockTotalQty = prefix === 'ALL' ? totalActualQty :
          priceRows.reduce((s, pr) => s + (totalMap[prefix + '|' + pr.method + '|' + pr.geology] || 0), 0);
        const ratio = blockTotalQty > 0 && tQty > 0 ? tQty / blockTotalQty : 0;

        items.push({
          type: 'item',
          gongjong: p.gongjong, hogi: label, method: p.method, geology: p.geology,
          unit: p.unit || 'm',
          contractQty: p.contract_qty, contractPrice: p.price, contractAmount: p.contract_amount,
          dailyQty: dQty, dailyAmount: dAmt,
          totalQty: tQty, totalAmount: tAmt,
          ratio,
          remainQty: rQty, remainAmount: rAmt
        });

        // 공법별 소계
        if (!methodSums[p.method]) methodSums[p.method] = { cQ: 0, cA: 0, dQ: 0, dA: 0, tQ: 0, tA: 0, rQ: 0, rA: 0 };
        const ms = methodSums[p.method];
        ms.cQ += p.contract_qty; ms.cA += p.contract_amount;
        ms.dQ += dQty; ms.dA += dAmt; ms.tQ += tQty; ms.tA += tAmt;
        ms.rQ += rQty; ms.rA += rAmt;

        gSumCQ += p.contract_qty; gSumCA += p.contract_amount;
        gSumDQ += dQty; gSumDA += dAmt; gSumTQ += tQty; gSumTA += tAmt;
      }

      // 지질 소계
      const gRQ = gSumCQ - gSumTQ;
      items.push({
        type: 'geoSubtotal', geology: geo,
        contractQty: gSumCQ, contractAmount: gSumCA,
        dailyQty: gSumDQ, dailyAmount: gSumDA,
        totalQty: gSumTQ, totalAmount: gSumTA,
        remainQty: gRQ, remainAmount: gRQ * (gSumCA > 0 && gSumCQ > 0 ? gSumCA / gSumCQ : 0)
      });

      sumContractQty += gSumCQ; sumContractAmt += gSumCA;
      sumDailyQty += gSumDQ; sumDailyAmt += gSumDA;
      sumTotalQty += gSumTQ; sumTotalAmt += gSumTA;
    }

    sumRemainQty = sumContractQty - sumTotalQty;
    sumRemainAmt = sumContractAmt - sumTotalAmt;

    // 공법별 소계 행
    const methodSubtotals = Object.entries(methodSums).map(([method, ms]) => ({
      type: 'methodSubtotal', method,
      contractQty: ms.cQ, contractAmount: ms.cA,
      dailyQty: ms.dQ, dailyAmount: ms.dA,
      totalQty: ms.tQ, totalAmount: ms.tA,
      remainQty: ms.rQ, remainAmount: ms.rA
    }));

    // 천공 합계
    const drillTotal = {
      type: 'drillTotal',
      contractQty: sumContractQty, contractAmount: sumContractAmt,
      dailyQty: sumDailyQty, dailyAmount: sumDailyAmt,
      totalQty: sumTotalQty, totalAmount: sumTotalAmt,
      remainQty: sumRemainQty, remainAmount: sumRemainAmt
    };

    // 부대항목
    const subItemResults = subItemRows.map(sub => {
      const qtyType = getSubQtyType(sub.method);
      // 부대항목 수량 = 천공물량 전체 or 특정 지질
      let dSubQty = 0, tSubQty = 0;
      if (qtyType === 'all') {
        dSubQty = sumDailyQty; tSubQty = sumTotalQty;
      } else {
        // 특정 지질 물량만
        priceRows.forEach(p => {
          if (p.geology === qtyType || p.geology?.includes(qtyType)) {
            dSubQty += dailyMap[prefix + '|' + p.method + '|' + p.geology] || 0;
            tSubQty += totalMap[prefix + '|' + p.method + '|' + p.geology] || 0;
          }
        });
      }
      const cQty = sub.contract_qty || (qtyType === 'all' ? sumContractQty : 0);
      return {
        type: 'subItem',
        method: sub.method, geology: sub.geology || '', price: sub.price,
        qtyType,
        contractQty: cQty, contractAmount: cQty * sub.price,
        dailyQty: dSubQty, dailyAmount: dSubQty * sub.price,
        totalQty: tSubQty, totalAmount: tSubQty * sub.price,
        remainQty: cQty - tSubQty, remainAmount: (cQty - tSubQty) * sub.price
      };
    });

    // 총합계 (천공 + 부대항목)
    const subDailyAmt = subItemResults.reduce((s, si) => s + si.dailyAmount, 0);
    const subTotalAmt = subItemResults.reduce((s, si) => s + si.totalAmount, 0);
    const subContractAmt = subItemResults.reduce((s, si) => s + si.contractAmount, 0);
    const subRemainAmt = subItemResults.reduce((s, si) => s + si.remainAmount, 0);

    const grandTotal = {
      type: 'grandTotal',
      contractAmount: sumContractAmt + subContractAmt,
      dailyQty: sumDailyQty, dailyAmount: sumDailyAmt + subDailyAmt,
      totalQty: sumTotalQty, totalAmount: sumTotalAmt + subTotalAmt,
      remainAmount: sumRemainAmt + subRemainAmt,
      progress: sumContractQty > 0 ? sumTotalQty / sumContractQty : 0
    };

    return { label, prefix, items, methodSubtotals, drillTotal, subItems: subItemResults, grandTotal };
  }

  // ── 전체 합계 블록 ──
  const allBlock = buildBlock('ALL', '전체');

  // ── 호기별 블록 ──
  const hogiBlocks = hogiList.map(hogi => buildBlock(hogi, hogi));

  // ── 공법별 · 지질별 비율 매트릭스 ──
  const ratioMatrix = {};
  const methods = [...new Set(priceRows.map(p => p.method))].sort();
  const geologies = [...new Set(priceRows.map(p => p.geology))].sort((a, b) => {
    const GO = ['토사', '풍화암', '연암', '보통암', '경암'];
    return (GO.indexOf(a) < 0 ? 99 : GO.indexOf(a)) - (GO.indexOf(b) < 0 ? 99 : GO.indexOf(b));
  });

  methods.forEach(m => {
    ratioMatrix[m] = {};
    geologies.forEach(g => {
      const tQty = totalMap['ALL|' + m + '|' + g] || 0;
      ratioMatrix[m][g] = {
        qty: tQty,
        ratio: totalActualQty > 0 ? tQty / totalActualQty : 0
      };
    });
  });

  res.json({
    reportDate: to,
    config: cfg,
    hogiList,
    allBlock,
    hogiBlocks,
    ratioMatrix,
    methods,
    geologies,
    totalActualQty,
    priceCount: priceRows.length,
    subItemCount: subItemRows.length
  });
});

// ══════════════════════════════════════════
// GET /api/reports/monthly-profit?month=2025-06&gongjong=
// 월간손익 — GAS 10_월간손익 대응
// 정산일 기준 전월/금월/누계 기성·투입·손익
// ══════════════════════════════════════════
router.get('/monthly-profit', (req, res) => {
  const db = getDB();
  const targetMonth = req.query.month; // 'yyyy-MM'
  if (!targetMonth) return res.status(400).json({ error: 'month required (yyyy-MM)' });
  const gj = req.query.gongjong || '';
  const gjW = gj ? ' AND gongjong = ?' : '';
  const gjP = gj ? [gj] : [];

  // config
  const cfgRows = db.prepare('SELECT key, value FROM project_config').all();
  const cfg = {}; cfgRows.forEach(r => cfg[r.key] = r.value);
  const settlementDay = parseInt(cfg.settlement_day) || 25;

  // 정산기간 계산
  const [yr, mo] = targetMonth.split('-').map(Number);
  const curEnd = new Date(yr, mo - 1, settlementDay);
  const curEndStr = curEnd.toISOString().slice(0, 10);
  const prevEnd = new Date(yr, mo - 2, settlementDay);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);
  const curStart = new Date(prevEnd); curStart.setDate(curStart.getDate() + 1);
  const curStartStr = curStart.toISOString().slice(0, 10);

  // 단가표
  const prices = db.prepare('SELECT method, geology, price, qty as contract_qty FROM price_table').all();
  const priceMap = {};
  let contractAmt = 0;
  prices.forEach(p => {
    if (p.geology) {
      priceMap[p.method + '|' + p.geology] = p.price;
      contractAmt += (p.contract_qty || 0) * p.price;
    }
  });
  // 부대항목
  const subPrices = prices.filter(p => !p.geology || ['근입','타설','케이싱'].some(s => p.method?.includes(s)));
  subPrices.forEach(sp => { contractAmt += (sp.contract_qty || 0) * sp.price; });

  // 간접비 설정
  const indRows = db.prepare('SELECT item, gubun, rate FROM indirect_config').all();
  let gisungIndRate = 0, toipIndRate = 0;
  const gisungIndItems = [], toipIndItems = [];
  indRows.forEach(r => {
    const rate = r.rate >= 1 ? r.rate / 100 : r.rate;
    if (r.gubun?.includes('기성')) { gisungIndRate += rate; gisungIndItems.push({ item: r.item, rate }); }
    else if (r.gubun?.includes('투입')) { toipIndRate += rate; toipIndItems.push({ item: r.item, rate }); }
  });

  // ── 실기성: 작업일지 기반 (정산일 기준 전월/금월) ──
  function calcRevenue(dateWhere, dateParams) {
    const rows = db.prepare(`
      SELECT method, geology, COALESCE(SUM(qty),0) as qty
      FROM work_log WHERE ${dateWhere} ${gjW} AND qty > 0
      GROUP BY method, geology
    `).all(...dateParams, ...gjP);
    let qty = 0, amt = 0;
    const byMethodGeo = [];
    rows.forEach(r => {
      const p = priceMap[r.method + '|' + r.geology] || 0;
      qty += r.qty; amt += r.qty * p;
      byMethodGeo.push({ method: r.method, geology: r.geology, qty: r.qty, amount: r.qty * p });
    });
    // 부대항목 금액 추가
    let subAmt = 0;
    subPrices.forEach(sp => {
      const qtyType = sp.method?.includes('케이싱') ? '토사' : 'all';
      let subQty = 0;
      if (qtyType === 'all') subQty = qty;
      else rows.forEach(r => { if (r.geology?.includes(qtyType)) subQty += r.qty; });
      subAmt += subQty * sp.price;
    });
    return { qty, directAmt: amt + subAmt, byMethodGeo };
  }

  const prevRevenue = calcRevenue('date <= ?', [prevEndStr]);
  const curRevenue = calcRevenue('date > ? AND date <= ?', [prevEndStr, curEndStr]);
  const totalRevenue = calcRevenue('date <= ?', [curEndStr]);

  // ── 투입비 (월별) ──
  function calcCost(dateWhere, dateParams) {
    const sumT = (table) => db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM ${table} WHERE ${dateWhere} ${gjW}`).get(...dateParams, ...gjP).t;
    const eq = sumT('equip_cost'), fu = sumT('fuel_cost'), mt = sumT('material_cost'), lb = sumT('labor_cost');
    return { equipment: eq, fuel: fu, material: mt, labor: lb, total: eq + fu + mt + lb };
  }

  const prevCost = calcCost('date <= ?', [prevEndStr]);
  const curCost = calcCost('date > ? AND date <= ?', [prevEndStr, curEndStr]);
  const totalCost = calcCost('date <= ?', [curEndStr]);

  // ── 간접비 계산 ──
  function calcIndirect(directRevenue, directCost) {
    const gInd = Math.round(directRevenue * gisungIndRate);
    const tInd = Math.round(directCost * toipIndRate);
    return {
      gisungDirect: directRevenue,
      gisungIndirect: gInd,
      gisungTotal: directRevenue + gInd,
      toipDirect: directCost,
      toipIndirect: tInd,
      toipTotal: directCost + tInd,
      profit: (directRevenue + gInd) - (directCost + tInd),
      profitRate: (directRevenue + gInd) > 0 ? ((directRevenue + gInd) - (directCost + tInd)) / (directRevenue + gInd) : 0
    };
  }

  const prevInd = calcIndirect(prevRevenue.directAmt, prevCost.total);
  const curInd = calcIndirect(curRevenue.directAmt, curCost.total);
  const totalInd = calcIndirect(totalRevenue.directAmt, totalCost.total);

  // ── 월별 목표 대비 실적 ──
  const dailyTarget = parseFloat(cfg.daily_target) || 0;
  const wdpm = parseInt(cfg.work_days_per_month) || 25;
  const monthTarget = dailyTarget * wdpm;

  // 금월 가동 호기/일수
  const unitInfo = db.prepare(`
    SELECT COUNT(DISTINCT hogi) as units, COUNT(DISTINCT date) as days
    FROM work_log WHERE date > ? AND date <= ? ${gjW} AND qty > 0
  `).get(prevEndStr, curEndStr, ...gjP);

  const hogiDays = db.prepare(`
    SELECT hogi, COUNT(DISTINCT date) as days
    FROM work_log WHERE date > ? AND date <= ? ${gjW} AND qty > 0
    GROUP BY hogi
  `).all(prevEndStr, curEndStr, ...gjP);

  // 총 목표 = Σ(호기별 가동일수 × 일일목표)
  const totalTarget = hogiDays.reduce((s, h) => s + h.days * dailyTarget, 0);
  const achRate = totalTarget > 0 ? curRevenue.qty / totalTarget : 0;

  // ── 월별 추이 (전체 월) ──
  const allMonthWork = db.prepare(`
    SELECT substr(date,1,7) as month,
           COALESCE(SUM(qty),0) as qty
    FROM work_log WHERE qty > 0 ${gjW}
    GROUP BY substr(date,1,7) ORDER BY month
  `).all(...gjP);

  const allMonthCost = {};
  ['equip_cost','fuel_cost','material_cost','labor_cost'].forEach(tbl => {
    const rows = db.prepare(`
      SELECT month, COALESCE(SUM(amount),0) as amt
      FROM ${tbl} WHERE month IS NOT NULL AND month != '' ${gjW}
      GROUP BY month
    `).all(...gjP);
    rows.forEach(r => {
      if (!allMonthCost[r.month]) allMonthCost[r.month] = 0;
      allMonthCost[r.month] += r.amt;
    });
  });

  const monthlyTrend = allMonthWork.map(mw => {
    const cost = allMonthCost[mw.month] || 0;
    const revenue = mw.qty; // 대략적 — 실제 단가 적용은 복잡
    // 간단화: 평균단가 적용
    const avgPrice = totalRevenue.qty > 0 ? totalRevenue.directAmt / totalRevenue.qty : 0;
    const rev = mw.qty * avgPrice;
    const gInd = Math.round(rev * gisungIndRate);
    const tInd = Math.round(cost * toipIndRate);
    const profit = (rev + gInd) - (cost + tInd);
    return {
      month: mw.month,
      qty: mw.qty,
      revenue: rev,
      gisungTotal: rev + gInd,
      cost,
      toipTotal: cost + tInd,
      profit
    };
  });

  // 누적 손익 계산
  let cumProfit = 0;
  monthlyTrend.forEach(m => {
    cumProfit += m.profit;
    m.cumProfit = cumProfit;
  });

  // ── 공법/지질별 비율 (금월) ──
  const curByMethod = db.prepare(`
    SELECT method, COALESCE(SUM(qty),0) as qty
    FROM work_log WHERE date > ? AND date <= ? ${gjW} AND qty > 0
    GROUP BY method
  `).all(prevEndStr, curEndStr, ...gjP);

  const curByGeology = db.prepare(`
    SELECT geology, COALESCE(SUM(qty),0) as qty
    FROM work_log WHERE date > ? AND date <= ? ${gjW} AND qty > 0
    GROUP BY geology
  `).all(prevEndStr, curEndStr, ...gjP);

  // ── 투입비 비목별 비율 ──
  const costBreakdown = {
    prev: prevCost,
    cur: curCost,
    total: totalCost
  };

  res.json({
    targetMonth,
    config: cfg,
    period: { start: curStartStr, end: curEndStr, prevEnd: prevEndStr, settlementDay },
    contractAmt,
    prev: { revenue: prevRevenue, cost: prevCost, indirect: prevInd },
    cur: { revenue: curRevenue, cost: curCost, indirect: curInd },
    total: { revenue: totalRevenue, cost: totalCost, indirect: totalInd },
    target: {
      dailyTarget, monthTarget, totalTarget,
      unitCount: unitInfo?.units || 0,
      workDays: unitInfo?.days || 0,
      achRate,
      hogiDays
    },
    monthlyTrend,
    curByMethod,
    curByGeology,
    costBreakdown,
    indirectConfig: { gisungIndRate, toipIndRate, gisungIndItems, toipIndItems }
  });
});

// ══════════════════════════════════════════
// GET /api/reports/settlement?to=2025-06&gongjong=
// 정산보고서 — GAS 11_정산보고 대응
// 당초→변경→실기성 비교 + 손익 + 월별추이 + 호기별효율 + 총평
// ══════════════════════════════════════════
router.get('/settlement', (req, res) => {
  const db = getDB();
  const endMonth = req.query.to || req.query.month;
  if (!endMonth) return res.status(400).json({ error: 'to (yyyy-MM) required' });
  const gj = req.query.gongjong || '';
  const gjW = gj ? ' AND gongjong = ?' : '';
  const gjP = gj ? [gj] : [];

  // 마감일 (해당월 말일)
  const [yr, mo] = endMonth.split('-').map(Number);
  const endDate = new Date(yr, mo, 0);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // config
  const cfgRows = db.prepare('SELECT key, value FROM project_config').all();
  const cfg = {}; cfgRows.forEach(r => cfg[r.key] = r.value);
  const wdpm = parseInt(cfg.work_days_per_month) || 25;

  // 단가표
  const priceAll = db.prepare('SELECT method, geology, price, qty as contract_qty FROM price_table').all();
  const priceMap = {};
  priceAll.forEach(p => { if (p.geology) priceMap[p.method + '|' + p.geology] = p.price; });
  const isSubItem = (m) => ['근입','타설','케이싱'].some(s => m?.includes(s));

  // 변경계약
  const contractRows = db.prepare('SELECT * FROM contract_change ORDER BY method, geology').all();
  const contractItems = {}, contractSub = [];
  let sumA0 = 0, sumA1 = 0, sumAE = 0;
  contractRows.forEach(r => {
    if (isSubItem(r.method)) {
      contractSub.push(r);
      sumA0 += r.amt_orig; sumA1 += r.amt_mod; sumAE += r.amt_exec || 0;
    } else if (r.method && r.geology) {
      const key = r.method + '|' + r.geology;
      contractItems[key] = r;
      sumA0 += r.amt_orig; sumA1 += r.amt_mod; sumAE += r.amt_exec || 0;
    }
  });
  const hasContract = contractRows.length > 0;
  const hasExec = sumAE > 0;

  // 간접비
  const indRows = db.prepare('SELECT item, gubun, rate FROM indirect_config').all();
  let gIndRate = 0, tIndRate = 0;
  const gIndItems = [], tIndItems = [];
  indRows.forEach(r => {
    const rate = r.rate >= 1 ? r.rate / 100 : r.rate;
    if (r.gubun?.includes('기성')) { gIndRate += rate; gIndItems.push({ item: r.item, rate }); }
    else if (r.gubun?.includes('투입')) { tIndRate += rate; tIndItems.push({ item: r.item, rate }); }
  });

  // 실기성 (누계)
  const actWork = db.prepare(`
    SELECT method, geology, COALESCE(SUM(qty),0) as qty
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY method, geology
  `).all(endDateStr, ...gjP);
  let actTotalQty = 0, actTotalAmt = 0;
  const actItems = {};
  actWork.forEach(r => {
    const p = priceMap[r.method + '|' + r.geology] || 0;
    actTotalQty += r.qty; actTotalAmt += r.qty * p;
    actItems[r.method + '|' + r.geology] = { qty: r.qty, amount: r.qty * p };
  });
  // 부대항목 실기성
  let actSubAmt = 0;
  priceAll.filter(p => isSubItem(p.method)).forEach(sp => {
    const qt = sp.method?.includes('케이싱') ? '토사' : 'all';
    let sq = qt === 'all' ? actTotalQty : actWork.filter(r => r.geology?.includes(qt)).reduce((s, r) => s + r.qty, 0);
    actSubAmt += sq * sp.price;
  });
  const actDirectTotal = actTotalAmt + actSubAmt;

  // 투입비 (누계)
  const costTotal = getCostBreakdown(db, `date <= ? ${gjW}`, [endDateStr, ...gjP]);

  // 간접비 계산
  const gInd0 = Math.round(sumA0 * gIndRate);
  const gInd1 = Math.round(sumA1 * gIndRate);
  const gIndAct = Math.round(actDirectTotal * gIndRate);
  const tInd = Math.round(costTotal.total * tIndRate);

  const gTotal0 = sumA0 + gInd0;
  const gTotal1 = sumA1 + gInd1;
  const gTotalAct = actDirectTotal + gIndAct;
  const tTotal = costTotal.total + tInd;

  const profit = gTotal1 - tTotal;
  const profitRate = gTotal1 > 0 ? profit / gTotal1 : 0;

  // ── 1. 계약 비교 테이블 (공법+지질별) ──
  const GEO_ORDER = ['토사','풍화암','연암','보통암','경암'];
  const geoSort = (a, b) => {
    const ia = GEO_ORDER.indexOf(a); const ib = GEO_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  };

  const allKeys = new Set();
  Object.keys(contractItems).forEach(k => allKeys.add(k));
  Object.keys(actItems).forEach(k => allKeys.add(k));
  priceAll.filter(p => p.geology && !isSubItem(p.method)).forEach(p => allKeys.add(p.method + '|' + p.geology));

  const mOrd = ['T4','토네이도','트리콘'];
  const sortedKeys = [...allKeys].sort((a, b) => {
    const pa = a.split('|'), pb = b.split('|');
    const mi = mOrd.indexOf(pa[0]) < 0 ? 99 : mOrd.indexOf(pa[0]);
    const mj = mOrd.indexOf(pb[0]) < 0 ? 99 : mOrd.indexOf(pb[0]);
    if (mi !== mj) return mi - mj;
    return geoSort(pa[1], pb[1]);
  });

  const comparison = sortedKeys.map(key => {
    const [method, geo] = key.split('|');
    const ci = contractItems[key];
    const ai = actItems[key];
    const price = ci?.price || priceMap[key] || 0;
    const q0 = ci?.qty_orig || 0, a0 = ci?.amt_orig || (q0 * price);
    const q1 = ci?.qty_mod || 0, a1 = ci?.amt_mod || (q1 * price);
    const priceE = ci?.price_exec || 0, aE = ci?.amt_exec || 0;
    const qA = ai?.qty || 0, aA = ai?.amount || 0;
    return { method, geology: geo, price, q0, a0, q1, a1, priceE, aE, qA, aA };
  });

  // 공법별 소계
  const methodSums = {};
  comparison.forEach(r => {
    if (!methodSums[r.method]) methodSums[r.method] = { q0: 0, a0: 0, q1: 0, a1: 0, aE: 0, qA: 0, aA: 0 };
    const ms = methodSums[r.method];
    ms.q0 += r.q0; ms.a0 += r.a0; ms.q1 += r.q1; ms.a1 += r.a1;
    ms.aE += r.aE; ms.qA += r.qA; ms.aA += r.aA;
  });

  // 지질별 소계 (공법별 비교용)
  const geoSums = {};
  comparison.forEach(r => {
    if (!geoSums[r.geology]) geoSums[r.geology] = { q0: 0, q1: 0 };
    geoSums[r.geology].q0 += r.q0; geoSums[r.geology].q1 += r.q1;
  });

  // ── 2. 호기별 효율 ──
  const hogiWork = db.prepare(`
    SELECT hogi, COALESCE(SUM(qty),0) as qty, COUNT(DISTINCT date) as days
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY hogi ORDER BY hogi
  `).all(endDateStr, ...gjP);

  const hogiCostMap = getCostByHogi(db, `date <= ? ${gjW}`, [endDateStr, ...gjP]);
  const equipAll = db.prepare('SELECT * FROM equipment ORDER BY hogi').all();
  const equipByHogi = {};
  equipAll.forEach(e => { if (!equipByHogi[e.hogi]) equipByHogi[e.hogi] = []; equipByHogi[e.hogi].push(e); });

  const hogiAnalysis = hogiWork.map(h => {
    const eqs = equipByHogi[h.hogi] || [];
    const mainEq = eqs.find(e => e.equip_type?.includes('메인') || e.equip_name?.includes('항타')) || eqs[0] || {};
    const costH = hogiCostMap[h.hogi] || { total: 0 };
    const cpm = h.qty > 0 ? costH.total / h.qty : 0;
    const avg = h.days > 0 ? h.qty / h.days : 0;
    return {
      hogi: h.hogi, company: mainEq.company || '-', spec: mainEq.spec || '-',
      qty: h.qty, days: h.days, avg, cost: costH.total, cpm
    };
  });
  hogiAnalysis.sort((a, b) => b.avg - a.avg);
  hogiAnalysis.forEach((h, i) => h.rank = i + 1);
  const bestAvg = hogiAnalysis.length > 0 ? hogiAnalysis[0].avg : 0;

  // ── 3. 월별 손익 추이 ──
  const monthWork = db.prepare(`
    SELECT substr(date,1,7) as month, COALESCE(SUM(qty),0) as qty
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY substr(date,1,7) ORDER BY month
  `).all(endDateStr, ...gjP);

  const monthCost = {};
  ['equip_cost','fuel_cost','material_cost','labor_cost'].forEach(tbl => {
    db.prepare(`SELECT month, COALESCE(SUM(amount),0) as amt FROM ${tbl} WHERE month IS NOT NULL AND month != '' AND month <= ? ${gjW} GROUP BY month`).all(endMonth, ...gjP)
      .forEach(r => { monthCost[r.month] = (monthCost[r.month] || 0) + r.amt; });
  });

  const avgPrice = actTotalQty > 0 ? actDirectTotal / actTotalQty : 0;
  let cumGisung = 0, cumCost = 0;
  const monthlyTrend = monthWork.filter(m => m.month <= endMonth).map(mw => {
    const rev = mw.qty * avgPrice;
    const gI = Math.round(rev * gIndRate);
    const cost = monthCost[mw.month] || 0;
    const tI = Math.round(cost * tIndRate);
    const gT = rev + gI, tT = cost + tI;
    cumGisung += gT; cumCost += tT;
    return {
      month: mw.month, qty: mw.qty,
      gisungTotal: gT, toipTotal: tT,
      profit: gT - tT, cumProfit: cumGisung - cumCost
    };
  });

  // ── 4. 정상/비정상 가동일 (상단 KPI) ──
  const workStats = db.prepare(`
    SELECT status, COUNT(DISTINCT date || '|' || hogi) as cnt,
           COALESCE(SUM(qty),0) as qty
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    GROUP BY status
  `).all(endDateStr, ...gjP);
  let totalDays = 0, normalDays = 0, normalQty = 0;
  workStats.forEach(r => {
    totalDays += r.cnt;
    if (r.status === '정상') { normalDays = r.cnt; normalQty = r.qty; }
  });
  const normalAvg = normalDays > 0 ? normalQty / normalDays : 0;
  const totalAvg = totalDays > 0 ? actTotalQty / totalDays : 0;
  const normalRate = normalAvg > 0 ? totalAvg / normalAvg * 100 : 0;

  // 투입일수 합계
  let totalDeployDays = 0;
  hogiWork.forEach(h => {
    const eqs = equipByHogi[h.hogi] || [];
    const me = eqs.find(e => e.equip_type?.includes('메인') || e.equip_name?.includes('항타')) || eqs[0];
    if (me?.start_date) {
      const sD = new Date(me.start_date);
      const eD = me.end_date ? new Date(me.end_date) : endDate;
      const eff = eD < endDate ? eD : endDate;
      if (sD <= eff) totalDeployDays += Math.round((Math.floor((eff - sD) / 86400000) + 1) / 30 * wdpm);
    }
  });
  const avgDailyRent = totalDeployDays > 0 ? Math.round(costTotal.total / totalDeployDays) : 0;

  // ── 5. 총평 자동생성 ──
  const comments = [];
  const changeAmt = gTotal1 - gTotal0;
  if (changeAmt !== 0) comments.push('당초계약 대비 변경계약 ' + (changeAmt >= 0 ? '+' : '') + Math.round(changeAmt).toLocaleString() + '원 (' + (changeAmt >= 0 ? '증가' : '감소') + ')');
  const qChange = (methodSums[mOrd[0]]?.q1 || 0) + (methodSums[mOrd[1]]?.q1 || 0) + (methodSums[mOrd[2]]?.q1 || 0) - (methodSums[mOrd[0]]?.q0 || 0) - (methodSums[mOrd[1]]?.q0 || 0) - (methodSums[mOrd[2]]?.q0 || 0);
  if (qChange !== 0) comments.push('총 물량 ' + (qChange > 0 ? '+' : '') + Math.round(qChange) + 'm ' + (qChange > 0 ? '증가' : '감소'));
  const mChanges = mOrd.map(m => {
    const ms = methodSums[m]; if (!ms) return null;
    const d = ms.q1 - ms.q0; if (d === 0) return null;
    return m + ' ' + (d > 0 ? '+' : '') + Math.round(d) + 'm';
  }).filter(Boolean);
  if (mChanges.length > 0) comments.push('공법별: ' + mChanges.join(', '));
  comments.push('최종 손익률 ' + (profitRate * 100).toFixed(1) + '% — ' + (profit >= 0 ? '흑자' : '적자'));
  comments.push('일평균 천공 ' + totalAvg.toFixed(1) + 'm/일 (정상 ' + normalAvg.toFixed(1) + 'm/일, 효율 ' + normalRate.toFixed(1) + '%)');

  res.json({
    endMonth, endDateStr,
    config: cfg,
    hasContract, hasExec,
    contract: { sumA0, sumA1, sumAE, items: comparison, subItems: contractSub, methodSums, geoSums },
    gisung: {
      direct0: sumA0, direct1: sumA1, directAct: actDirectTotal,
      ind0: gInd0, ind1: gInd1, indAct: gIndAct,
      total0: gTotal0, total1: gTotal1, totalAct: gTotalAct,
      indItems: gIndItems
    },
    cost: { ...costTotal, indirect: tInd, grandTotal: tTotal, indItems: tIndItems },
    profit, profitRate,
    actTotalQty, actDirectTotal,
    kpi: {
      totalDays, normalDays, normalAvg, totalAvg, normalRate,
      totalDeployDays, avgDailyRent
    },
    hogiAnalysis,
    bestAvg,
    monthlyTrend,
    comments
  });
});

// ══════════════════════════════════════════
// GET /api/reports/time-analysis?to=&gongjong=
// 시간분석 — GAS 09_시간분석 대응
// 소요시간 기반 투입비 배분 → 공법+지질별 원가단가
// ══════════════════════════════════════════
router.get('/time-analysis', (req, res) => {
  const db = getDB();
  const to = req.query.to || '9999-12-31';
  const gj = req.query.gongjong || '';
  const gjW = gj ? ' AND gongjong = ?' : '';
  const gjP = gj ? [gj] : [];

  // config
  const cfgRows = db.prepare('SELECT key, value FROM project_config').all();
  const cfg = {}; cfgRows.forEach(r => cfg[r.key] = r.value);

  // 단가표 (공법+지질 키만)
  const prices = db.prepare("SELECT method, geology, price FROM price_table WHERE geology IS NOT NULL AND geology != ''").all();
  const priceMap = {};
  const validKeys = new Set();
  prices.forEach(p => { priceMap[p.method + '|' + p.geology] = p.price; validKeys.add(p.method + '|' + p.geology); });

  // 작업일지 (시간 포함)
  const workRows = db.prepare(`
    SELECT hogi, method, geology, qty, time_min, date
    FROM work_log WHERE date <= ? ${gjW} AND qty > 0
    ORDER BY hogi, method, geology
  `).all(to, ...gjP);

  // ── 공법키 정규화 ──
  function getMethodKey(m) {
    if (!m) return 'T4';
    const n = m.toUpperCase().replace(/\s/g, '');
    if (n.includes('토네이도') || n.includes('TORNADO')) return '토네이도';
    if (n.includes('트리콘') || n.includes('TRI')) return '트리콘';
    return 'T4';
  }

  // ── 호기별 + 공법|지질별 시간/물량 집계 ──
  const byHogi = {};   // { '1호기': { items: { 'T4|토사': { qty, totalTime, count } }, totalQty } }
  const byMethodGeo = {}; // 전체 평균
  let timeDateCount = 0;
  const timeDates = new Set();

  workRows.forEach(r => {
    const mk = getMethodKey(r.method);
    const key = mk + '|' + r.geology;
    if (!validKeys.has(key)) return; // 단가표에 없는 조합 무시

    // 호기별
    if (!byHogi[r.hogi]) byHogi[r.hogi] = { items: {}, totalQty: 0, hasTime: false };
    if (!byHogi[r.hogi].items[key]) byHogi[r.hogi].items[key] = { method: mk, geo: r.geology, qty: 0, totalTime: 0, count: 0, times: [] };
    const hi = byHogi[r.hogi].items[key];
    hi.qty += r.qty;
    byHogi[r.hogi].totalQty += r.qty;
    if (r.time_min > 0) {
      hi.totalTime += r.time_min;
      hi.count++;
      hi.times.push(r.time_min);
      byHogi[r.hogi].hasTime = true;
      timeDates.add(r.date + '|' + r.hogi);
    }

    // 전체
    if (!byMethodGeo[key]) byMethodGeo[key] = { method: mk, geo: r.geology, qty: 0, totalTime: 0, count: 0 };
    byMethodGeo[key].qty += r.qty;
    if (r.time_min > 0) { byMethodGeo[key].totalTime += r.time_min; byMethodGeo[key].count++; }
  });
  timeDateCount = timeDates.size;

  // 평균시간 계산
  Object.values(byMethodGeo).forEach(mg => { mg.avgTime = mg.count > 0 ? mg.totalTime / mg.count : 0; });
  Object.values(byHogi).forEach(h => {
    Object.values(h.items).forEach(it => { it.avgTime = it.count > 0 ? it.totalTime / it.count : 0; });
  });

  // ── 호기별 투입비 ──
  const costByHogi = getCostByHogi(db, `date <= ? ${gjW}`, [to, ...gjP]);
  const totalCostAll = getCostBreakdown(db, `date <= ? ${gjW}`, [to, ...gjP]);

  // 호기별 미배분 비용 분배 (가동일 비례)
  const workDates = db.prepare(`SELECT hogi, COUNT(DISTINCT date) as days FROM work_log WHERE date <= ? ${gjW} AND qty > 0 GROUP BY hogi`).all(to, ...gjP);
  const hogiDaysMap = {}; let totalDays = 0;
  workDates.forEach(r => { hogiDaysMap[r.hogi] = r.days; totalDays += r.days; });

  let assignedCost = 0;
  Object.values(costByHogi).forEach(c => { assignedCost += c.total; });
  const unassigned = totalCostAll.total - assignedCost;

  const hogiList = Object.keys(byHogi).sort();
  const hogisWithTime = hogiList.filter(h => byHogi[h].hasTime);
  const hogisNoTime = hogiList.filter(h => !byHogi[h].hasTime);

  // ── 시간비율 기반 투입비 배분 ──
  const hogiAlloc = {};

  hogiList.forEach(hogi => {
    const hData = byHogi[hogi];
    const hCostDirect = (costByHogi[hogi]?.total || 0);
    const hCommon = totalDays > 0 ? Math.round(unassigned * (hogiDaysMap[hogi] || 0) / totalDays) : 0;
    const hCost = hCostDirect + hCommon;

    // 가중치 계산
    let totalWeight = 0;
    const weights = {};
    const itemKeys = Object.keys(hData.items);

    itemKeys.forEach(key => {
      const it = hData.items[key];
      let t;
      if (hData.hasTime) {
        t = it.avgTime > 0 ? it.avgTime : 0; // 시간 없는 항목은 0
      } else {
        t = 1; // 전체 시간 없으면 물량 균등
      }
      const w = t * it.qty;
      weights[key] = w;
      totalWeight += w;
    });

    // 배분
    const items = {};
    let allocSum = 0;
    itemKeys.forEach((key, ki) => {
      const it = hData.items[key];
      const ratio = totalWeight > 0 ? weights[key] / totalWeight : 0;
      const allocated = ki === itemKeys.length - 1 ? hCost - allocSum : Math.round(hCost * ratio);
      allocSum += allocated;
      const unitCost = it.qty > 0 ? Math.round(allocated / it.qty) : 0;
      const contractPrice = priceMap[key] || 0;

      items[key] = {
        method: it.method, geo: it.geo, qty: it.qty,
        avgTime: it.avgTime,
        timeSource: hData.hasTime ? (it.avgTime > 0 ? 'own' : 'none') : 'no_data',
        timeRatio: ratio,
        allocated, unitCost,
        contractPrice,
        diff: contractPrice - unitCost,
        judge: contractPrice === 0 ? '-' : (contractPrice >= unitCost ? '이익' : '손실')
      };
    });

    hogiAlloc[hogi] = {
      hogi, hasTime: hData.hasTime,
      totalQty: hData.totalQty, totalCost: hCost,
      directCost: hCostDirect, commonCost: hCommon,
      items
    };
  });

  // ── 전체 합산 (공법+지질별) ──
  const allItems = {};
  hogiList.forEach(hogi => {
    Object.entries(hogiAlloc[hogi].items).forEach(([key, it]) => {
      if (!allItems[key]) allItems[key] = { method: it.method, geo: it.geo, qty: 0, cost: 0 };
      allItems[key].qty += it.qty;
      allItems[key].cost += it.allocated;
    });
  });
  Object.values(allItems).forEach(it => {
    it.unitCost = it.qty > 0 ? Math.round(it.cost / it.qty) : 0;
    it.contractPrice = priceMap[it.method + '|' + it.geo] || 0;
    it.diff = it.contractPrice - it.unitCost;
    it.judge = it.contractPrice === 0 ? '-' : (it.diff >= 0 ? '이익' : '손실');
  });

  // ── 호기별 효율 순위 (평균원가/m 낮을수록 좋음) ──
  const ranks = hogiList.map(hogi => {
    const ha = hogiAlloc[hogi];
    const avgUC = ha.totalQty > 0 ? Math.round(ha.totalCost / ha.totalQty) : 999999;
    return { hogi, avgUC, hasTime: ha.hasTime };
  }).sort((a, b) => a.avgUC - b.avgUC);
  const bestUC = ranks.length > 0 ? ranks[0].avgUC : 1;
  ranks.forEach((r, i) => {
    r.rank = i + 1;
    r.efficiency = bestUC > 0 ? bestUC / r.avgUC : 0;
  });

  // ── 호기별 평균 소요시간 비교 테이블 ──
  const mgKeys = Object.keys(byMethodGeo).sort((a, b) => {
    const MOrd = ['T4', '토네이도', '트리콘'];
    const GOrd = ['토사', '풍화암', '연암', '보통암', '경암'];
    const pa = a.split('|'), pb = b.split('|');
    const mi = MOrd.indexOf(pa[0]) < 0 ? 99 : MOrd.indexOf(pa[0]);
    const mj = MOrd.indexOf(pb[0]) < 0 ? 99 : MOrd.indexOf(pb[0]);
    if (mi !== mj) return mi - mj;
    return (GOrd.indexOf(pa[1]) < 0 ? 99 : GOrd.indexOf(pa[1])) - (GOrd.indexOf(pb[1]) < 0 ? 99 : GOrd.indexOf(pb[1]));
  });

  const timeComparison = mgKeys.map(key => {
    const mg = byMethodGeo[key];
    const hogiTimes = {};
    hogiList.forEach(hogi => {
      const hi = byHogi[hogi]?.items[key];
      hogiTimes[hogi] = hi?.avgTime || 0;
    });
    return { key, method: mg.method, geo: mg.geo, globalAvg: mg.avgTime, hogiTimes };
  });

  res.json({
    reportDate: to,
    config: cfg,
    timeDateCount,
    hogiList,
    hogisWithTime,
    hogisNoTime,
    timeComparison,
    hogiAlloc,
    allItems,
    ranks,
    totalCost: totalCostAll.total,
    totalQty: hogiList.reduce((s, h) => s + byHogi[h].totalQty, 0)
  });
});

// ══════════════════════════════════════════
// GET /api/reports/cost-summary?to=&gongjong=
// 투입비집계 — GAS 06_투입비 대응
// 비목별/호기별/날짜별 종합집계 + 상세내역
// ══════════════════════════════════════════
router.get('/cost-summary', (req, res) => {
  const db = getDB();
  const to = req.query.to || '9999-12-31';
  const gj = req.query.gongjong || '';
  const gjW = gj ? ' AND gongjong = ?' : '';
  const gjP = gj ? [gj] : [];

  // ── 비목별 합계 (당일/누계) ──
  const dailyCost = getCostBreakdown(db, `date = ? ${gjW}`, [to, ...gjP]);
  const totalCost = getCostBreakdown(db, `date <= ? ${gjW}`, [to, ...gjP]);

  // ── 호기별 투입비 ──
  function hogiSum(table, amtCol) {
    return db.prepare(`
      SELECT hogi, COALESCE(SUM(amount),0) as amt
      FROM ${table} WHERE date <= ? ${gjW} AND hogi IS NOT NULL AND hogi != ''
      GROUP BY hogi
    `).all(to, ...gjP);
  }
  const hogiMap = {};
  const types = [
    ['equip_cost', 'equipment'],
    ['fuel_cost', 'fuel'],
  ];
  types.forEach(([tbl, key]) => {
    hogiSum(tbl).forEach(r => {
      if (!hogiMap[r.hogi]) hogiMap[r.hogi] = { equipment: 0, fuel: 0, material: 0, labor: 0, total: 0 };
      hogiMap[r.hogi][key] += r.amt;
      hogiMap[r.hogi].total += r.amt;
    });
  });
  // 자재/노무 — 호기 컬럼 없을 수 있음
  const hogiList = Object.keys(hogiMap).sort();

  // ── 날짜별 투입비 ──
  function dateSum(table) {
    return db.prepare(`
      SELECT date, COALESCE(SUM(amount),0) as amt
      FROM ${table} WHERE date <= ? ${gjW}
      GROUP BY date
    `).all(to, ...gjP);
  }
  const dateMap = {};
  ['equip_cost', 'fuel_cost', 'material_cost', 'labor_cost'].forEach(tbl => {
    const key = tbl.replace('_cost', '');
    dateSum(tbl).forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = { equipment: 0, fuel: 0, material: 0, labor: 0, total: 0 };
      const k = key === 'equip' ? 'equipment' : key;
      dateMap[r.date][k] = (dateMap[r.date][k] || 0) + r.amt;
      dateMap[r.date].total += r.amt;
    });
  });
  const dateList = Object.keys(dateMap).sort();
  const byDate = dateList.map(d => ({ date: d, ...dateMap[d] }));

  // ── 월별 투입비 ──
  const monthMap = {};
  ['equip_cost', 'fuel_cost', 'material_cost', 'labor_cost'].forEach(tbl => {
    const key = tbl.replace('_cost', '');
    db.prepare(`
      SELECT month, COALESCE(SUM(amount),0) as amt
      FROM ${tbl} WHERE date <= ? AND month IS NOT NULL AND month != '' ${gjW}
      GROUP BY month
    `).all(to, ...gjP).forEach(r => {
      if (!monthMap[r.month]) monthMap[r.month] = { equipment: 0, fuel: 0, material: 0, labor: 0, total: 0 };
      const k = key === 'equip' ? 'equipment' : key;
      monthMap[r.month][k] = (monthMap[r.month][k] || 0) + r.amt;
      monthMap[r.month].total += r.amt;
    });
  });
  const monthList = Object.keys(monthMap).sort();
  const byMonth = monthList.map(m => ({ month: m, ...monthMap[m] }));

  // ── 상세내역 (최근 100건) ──
  function getDetails(table, typeLabel, cols) {
    return db.prepare(`
      SELECT '${typeLabel}' as type, ${cols} FROM ${table}
      WHERE date <= ? ${gjW}
      ORDER BY date DESC LIMIT 200
    `).all(to, ...gjP);
  }
  const details = [
    ...getDetails('equip_cost', '장비대', 'date, company, equip_name as item, hours as qty, price, amount, hogi'),
    ...getDetails('fuel_cost', '유류비', 'date, company, equip_name as item, fuel_qty as qty, price, amount, hogi'),
    ...getDetails('material_cost', '자재비', 'date, company, item, qty, price, amount, "" as hogi'),
    ...getDetails('labor_cost', '노무비', 'date, company, task as item, hours as qty, price, amount, "" as hogi'),
  ].sort((a, b) => b.date.localeCompare(a.date));

  res.json({
    reportDate: to,
    daily: dailyCost,
    total: totalCost,
    byHogi: hogiMap,
    hogiList,
    byDate,
    byMonth,
    details: details.slice(0, 500),
    detailCount: details.length
  });
});

function normalizeEquipName(name) {
  if (!name) return '기타';
  if (name.includes('항타') || name.includes('천공')) return '항타기';
  if (name.includes('압축') || name.includes('콤프') || name.includes('컴프')) return '압축기';
  if (name.includes('굴삭') || name.includes('굴착')) return '굴삭기';
  if (name.includes('크레인')) return '크레인';
  if (name.includes('발전기')) return '발전기';
  if (name.includes('펌프')) return '펌프';
  return name;
}

export default router;
