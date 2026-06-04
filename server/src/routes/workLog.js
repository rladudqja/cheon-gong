import { Router } from 'express';
import { getDB } from '../db/connection.js';

const router = Router();

// GET /api/work-log?date=2025-06-01&hogi=1호기&from=&to=
router.get('/', (req, res) => {
  const db = getDB();
  let sql = 'SELECT * FROM work_log WHERE 1=1';
  const params = [];

  if (req.query.date) {
    sql += ' AND date = ?';
    params.push(req.query.date);
  }
  if (req.query.from) {
    sql += ' AND date >= ?';
    params.push(req.query.from);
  }
  if (req.query.to) {
    sql += ' AND date <= ?';
    params.push(req.query.to);
  }
  if (req.query.hogi) {
    sql += ' AND hogi = ?';
    params.push(req.query.hogi);
  }
  if (req.query.gongjong) {
    sql += ' AND gongjong = ?';
    params.push(req.query.gongjong);
  }

  sql += ' ORDER BY date DESC, hogi, method';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/work-log/summary?to=2025-06-01 — 누계 요약
router.get('/summary', (req, res) => {
  const db = getDB();
  const to = req.query.to || '9999-12-31';
  const gongjong = req.query.gongjong || '';

  let where = 'date <= ?';
  const params = [to];
  if (gongjong) {
    where += ' AND gongjong = ?';
    params.push(gongjong);
  }

  // 전체 누계
  const total = db.prepare(`
    SELECT COALESCE(SUM(qty), 0) as total_qty,
           COUNT(DISTINCT date) as work_days,
           COUNT(DISTINCT hogi) as hogi_count
    FROM work_log WHERE ${where}
  `).get(...params);

  // 공법별
  const byMethod = db.prepare(`
    SELECT method, COALESCE(SUM(qty), 0) as qty
    FROM work_log WHERE ${where}
    GROUP BY method ORDER BY method
  `).all(...params);

  // 지질별
  const byGeology = db.prepare(`
    SELECT geology, COALESCE(SUM(qty), 0) as qty
    FROM work_log WHERE ${where}
    GROUP BY geology ORDER BY geology
  `).all(...params);

  // 호기별
  const byHogi = db.prepare(`
    SELECT hogi, COALESCE(SUM(qty), 0) as qty,
           COUNT(DISTINCT date) as days
    FROM work_log WHERE ${where}
    GROUP BY hogi ORDER BY hogi
  `).all(...params);

  // 일별
  const byDate = db.prepare(`
    SELECT date, COALESCE(SUM(qty), 0) as qty
    FROM work_log WHERE ${where}
    GROUP BY date ORDER BY date
  `).all(...params);

  res.json({ total, byMethod, byGeology, byHogi, byDate });
});

// POST /api/work-log — 작업일지 추가
router.post('/', (req, res) => {
  const db = getDB();
  const b = req.body;
  const month = b.date ? b.date.substring(0, 7) : '';
  const result = db.prepare(`
    INSERT INTO work_log (gongjong, hogi, company, spec, date, month, method, geology, qty, time_min, memo, section, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    b.gongjong, b.hogi, b.company, b.spec, b.date, month,
    b.method, b.geology, b.qty || 0, b.time_min || 0,
    b.memo, b.section, b.status || '정상'
  );
  res.json({ id: result.lastInsertRowid });
});

// POST /api/work-log/batch — 일괄 추가
router.post('/batch', (req, res) => {
  const db = getDB();
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Array expected' });

  const insert = db.prepare(`
    INSERT INTO work_log (gongjong, hogi, company, spec, date, month, method, geology, qty, time_min, memo, section, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((rows) => {
    for (const b of rows) {
      const month = b.date ? b.date.substring(0, 7) : '';
      insert.run(
        b.gongjong, b.hogi, b.company, b.spec, b.date, month,
        b.method, b.geology, b.qty || 0, b.time_min || 0,
        b.memo, b.section, b.status || '정상'
      );
    }
  });
  tx(items);
  res.json({ ok: true, count: items.length });
});

// PUT /api/work-log/:id
router.put('/:id', (req, res) => {
  const db = getDB();
  const b = req.body;
  const month = b.date ? b.date.substring(0, 7) : '';
  db.prepare(`
    UPDATE work_log SET gongjong=?, hogi=?, company=?, spec=?, date=?, month=?,
      method=?, geology=?, qty=?, time_min=?, memo=?, section=?, status=?
    WHERE id=?
  `).run(
    b.gongjong, b.hogi, b.company, b.spec, b.date, month,
    b.method, b.geology, b.qty || 0, b.time_min || 0,
    b.memo, b.section, b.status || '정상', req.params.id
  );
  res.json({ ok: true });
});

// DELETE /api/work-log/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM work_log WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
