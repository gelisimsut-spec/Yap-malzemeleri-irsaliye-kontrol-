import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { docsRouter } from './routes/docs.js';
import { settingsRouter } from './routes/settings.js';
import { whatsappRouter } from './routes/whatsapp.js';
import { metaRouter } from './routes/meta.js';
import { demoRouter } from './routes/demo.js';
import { startWorker } from './worker.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/docs', docsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/meta', metaRouter);
app.use('/api/demo', demoRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Backend running on ${port}`);
  startWorker();
});
