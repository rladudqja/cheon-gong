import { Router } from 'express';
import { getDB } from '../db/connection.js';

const router = Router();

// ── 범용 CRUD 헬퍼 ──
function crudRouter(table, columns, orderBy) {
  const r = Router();

  r.get('/', (req, res) => {
    const db = getDB();
    let sql = `SELECT * FROM ${table} WHERE 1=1`;
    const params = [];
    if (req.query.date) { sql += ' AND date = ?'; params.push(req.query.date); }
    if (req.query.from) { sql += ' AND date >= ?'; params.push(req.query.from); }
    if (req.query.to) { sql += ' AND date <= ?'; params.push(req.query.to); }
    if (req.query.month) { sql += ' AND month = ?'; params.push(req.query.month); }
    if (req.query.gongjong) { sql += ' AND gongjong = ?'; params.push(req.query.gongjong); }
    if (req.query.hogi) { sql += ' AND hogi = ?'; params.push(req.query.hogi); }
    sql += ` ORDER BY ${orderBy}`;
    res.json(db.prepare(sql).all(...params));
  });

  r.post('/', (req, res) => {
    const db = getDB();
    const b = req.body;
    const cols = columns.map(c => c.name);
    const placeholders = cols.map(() => '?').join(',');
    const vals = cols.map(c => b[c] ?? columns.find(x => x.name === c).default ?? null);
    const result = db.prepare(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`
    ).run(...vals);
    res.json({ id: result.lastInsertRowid });
  });

  r.put('/:id', (req, res) => {
    const db = getDB();
    const b = req.body;
    const cols = columns.map(c => c.name);
    const sets = cols.map(c => `${c}=?`).join(',');
    const vals = cols.map(c => b[c] ?? null);
    vals.push(req.params.id);
    db.prepare(`UPDATE ${table} SET ${sets} WHERE id=?`).run(...vals);
    res.json({ ok: true });
  });

  r.delete('/:id', (req, res) => {
    const db = getDB();
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.json({ ok: true });
  });

  return r;
}

// ── 장비대 ──
const equipCostCols = [
  { name: 'equip_type' }, { name: 'equip_name' }, { name: 'spec' },
  { name: 'car_no' }, { name: 'company' }, { name: 'date' },
  { name: 'hours', default: 0 }, { name: 'price', default: 0 },
  { name: 'amount', default: 0 }, { name: 'month' },
  { name: 'gongjong' }, { name: 'hogi' }
];
router.use('/equip-cost', crudRouter('equip_cost', equipCostCols, 'date DESC'));

// ── 유류비 ──
const fuelCostCols = [
  { name: 'fuel_type' }, { name: 'station' }, { name: 'equip_name' },
  { name: 'spec' }, { name: 'car_no' }, { name: 'company' },
  { name: 'date' }, { name: 'fuel_qty', default: 0 },
  { name: 'price', default: 0 }, { name: 'amount', default: 0 },
  { name: 'month' }, { name: 'gongjong' }, { name: 'hogi' }
];
router.use('/fuel-cost', crudRouter('fuel_cost', fuelCostCols, 'date DESC'));

// ── 자재비 ──
const materialCostCols = [
  { name: 'mat_type' }, { name: 'company' }, { name: 'date' },
  { name: 'month' }, { name: 'item' }, { name: 'unit' },
  { name: 'qty', default: 0 }, { name: 'price', default: 0 },
  { name: 'amount', default: 0 }, { name: 'gongjong' }
];
router.use('/material-cost', crudRouter('material_cost', materialCostCols, 'date DESC'));

// ── 노무비 ──
const laborCostCols = [
  { name: 'lab_type' }, { name: 'company' }, { name: 'task' },
  { name: 'name' }, { name: 'date' }, { name: 'hours', default: 0 },
  { name: 'price', default: 0 }, { name: 'amount', default: 0 },
  { name: 'month' }, { name: 'gongjong' }
];
router.use('/labor-cost', crudRouter('labor_cost', laborCostCols, 'date DESC'));

// GET /api/costs/summary?to=2025-06-01&gongjong=...
router.get('/summary', (req, res) => {
  const db = getDB();
  const to = req.query.to || '9999-12-31';
  const gj = req.query.gongjong;

  function sumTable(table, gjCol) {
    let sql = `SELECT COALESCE(SUM(amount), 0) as total FROM ${table} WHERE date <= ?`;
    const p = [to];
    if (gj && gjCol) { sql += ` AND ${gjCol} = ?`; p.push(gj); }
    return db.prepare(sql).get(...p).total;
  }

  const equipment = sumTable('equip_cost', 'gongjong');
  const fuel = sumTable('fuel_cost', 'gongjong');
  const material = sumTable('material_cost', 'gongjong');
  const labor = sumTable('labor_cost', 'gongjong');

  res.json({
    equipment, fuel, material, labor,
    total: equipment + fuel + material + labor
  });
});

export default router;
