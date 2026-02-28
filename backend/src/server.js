import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import docsRoutes from './routes/docs.js';
import matchesRoutes from './routes/matches.js';
import settingsRoutes from './routes/settings.js';
import metadataRoutes from './routes/metadata.js';
import dashboardRoutes from './routes/dashboard.js';
import whatsappRoutes from './routes/whatsapp.js';
import { startUnmatchedNotifier } from './jobs/unmatchedNotifier.js';
import { startOutboxWorker } from './jobs/outboxWorker.js';
import { seedDefaults } from './services/seedService.js';

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/api/docs', docsRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/whatsapp', whatsappRoutes);

seedDefaults()
  .then(() => {
    startUnmatchedNotifier();
    startOutboxWorker();
    app.listen(port, () => {
      console.log(`API listening on :${port}`);
    });
  })
  .catch((error) => {
    console.error('Startup error', error);
    process.exit(1);
  });
