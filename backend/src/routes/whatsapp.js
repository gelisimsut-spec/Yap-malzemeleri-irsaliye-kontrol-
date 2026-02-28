import express from 'express';
import { proxyWhatsApp } from '../services/whatsapp.js';

export const whatsappRouter = express.Router();

whatsappRouter.get('/qr', async (_req, res) => {
  try {
    const data = await proxyWhatsApp('/qr');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

whatsappRouter.get('/status', async (_req, res) => {
  try {
    const data = await proxyWhatsApp('/status');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

whatsappRouter.post('/send', async (req, res) => {
  const { phone, message } = req.body;
  try {
    const data = await proxyWhatsApp('/send-message', {
      method: 'POST',
      body: JSON.stringify({ phone, message })
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
