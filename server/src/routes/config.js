import { Router } from 'express';
import { getDB } from '../db/connection.js';

const router = Router();

// GET /api/config — 전체 설정 조회
router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM project_config').all();
  const config = {};
  for (const r of rows) config[r.key] = r.value;
  res.json(config);
});

// PUT /api/config — 설정 일괄 저장
router.put('/', (req, res) => {
  const db = getDB();
  const upsert = db.prepare(
    'INSERT INTO project_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      upsert.run(k, String(v));
    }
  });
  tx(Object.entries(req.body));
  res.json({ ok: true });
});

export default router;
