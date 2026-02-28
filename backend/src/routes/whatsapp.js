import express from 'express';
import { getWhatsappSessionStatus, sendWhatsappMessage } from '../services/whatsappService.js';

const router = express.Router();

router.get('/session-status', async (_, res) => {
  try {
    const status = await getWhatsappSessionStatus();
    res.json(status);
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

router.post('/send-test', async (req, res) => {
  const { recipient, message } = req.body;
  await sendWhatsappMessage(recipient, message || 'Test bildirimi');
  res.json({ ok: true });
});

export default router;
