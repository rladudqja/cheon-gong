import { Router } from 'express';
import { getDB } from '../db/connection.js';

const router = Router();

// GET /api/equipment — 전체 장비 목록
router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM equipment ORDER BY hogi, equip_type').all();
  res.json(rows);
});

// GET /api/equipment/by-hogi — 호기별 그룹
router.get('/by-hogi', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM equipment ORDER BY hogi, equip_type').all();
  const map = {};
  for (const r of rows) {
    if (!map[r.hogi]) map[r.hogi] = [];
    map[r.hogi].push(r);
  }
  res.json(map);
});

// POST /api/equipment — 장비 추가
router.post('/', (req, res) => {
  const db = getDB();
  const b = req.body;
  const result = db.prepare(`
    INSERT INTO equipment (hogi, equip_type, car_no, equip_name, spec, company, driver,
      start_date, end_date, monthly_rent, daily_rent, apply_days, set_group, drill_diameter, adjust_factor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    b.hogi, b.equip_type, b.car_no, b.equip_name, b.spec, b.company, b.driver,
    b.start_date, b.end_date, b.monthly_rent || 0, b.daily_rent || 0,
    b.apply_days || 0, b.set_group, b.drill_diameter || 0, b.adjust_factor || 1.0
  );
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/equipment/:id
router.put('/:id', (req, res) => {
  const db = getDB();
  const b = req.body;
  db.prepare(`
    UPDATE equipment SET hogi=?, equip_type=?, car_no=?, equip_name=?, spec=?, company=?, driver=?,
      start_date=?, end_date=?, monthly_rent=?, daily_rent=?, apply_days=?, set_group=?,
      drill_diameter=?, adjust_factor=?
    WHERE id=?
  `).run(
    b.hogi, b.equip_type, b.car_no, b.equip_name, b.spec, b.company, b.driver,
    b.start_date, b.end_date, b.monthly_rent || 0, b.daily_rent || 0,
    b.apply_days || 0, b.set_group, b.drill_diameter || 0, b.adjust_factor || 1.0,
    req.params.id
  );
  res.json({ ok: true });
});

// DELETE /api/equipment/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM equipment WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
