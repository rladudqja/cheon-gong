import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDBConnection } from './db/connection.js';

import configRouter from './routes/config.js';
import equipmentRouter from './routes/equipment.js';
import workLogRouter from './routes/workLog.js';
import costsRouter from './routes/costs.js';
import priceTableRouter from './routes/priceTable.js';
import reportsRouter from './routes/reports.js';
import importRouter from './routes/import.js';
import syncRouter from './routes/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API 라우트
app.use('/api/config', configRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/work-log', workLogRouter);
app.use('/api/costs', costsRouter);
app.use('/api/price-table', priceTableRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/import', importRouter);
app.use('/api/sync', syncRouter);

// 프론트엔드 정적 파일
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

initDBConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`서버 시작: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('DB 초기화 실패:', err);
  process.exit(1);
});
