import { Router } from 'express';
import { getDB } from '../db/connection.js';

const router = Router();

// GET /api/price-table
router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM price_table ORDER BY method, geology').all();
  res.json(rows);
});

// POST /api/price-table
router.post('/', (req, res) => {
  const db = getDB();
  const b = req.body;
  const amt = b.amount || (b.qty || 0) * (b.price || 0);
  const result = db.prepare(`
    INSERT INTO price_table (gongjong, hogi, method, geology, unit, qty, price, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(b.gongjong, b.hogi, b.method, b.geology, b.unit || 'm', b.qty || 0, b.price || 0, amt);
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/price-table/:id
router.put('/:id', (req, res) => {
  const db = getDB();
  const b = req.body;
  const amt = b.amount || (b.qty || 0) * (b.price || 0);
  db.prepare(`
    UPDATE price_table SET gongjong=?, hogi=?, method=?, geology=?, unit=?, qty=?, price=?, amount=?
    WHERE id=?
  `).run(b.gongjong, b.hogi, b.method, b.geology, b.unit || 'm', b.qty || 0, b.price || 0, amt, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/price-table/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM price_table WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
