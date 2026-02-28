import express from 'express';
import { query } from '../db.js';

export const settingsRouter = express.Router();

settingsRouter.get('/', async (_req, res) => {
  const { rows } = await query('SELECT * FROM settings WHERE id=1');
  res.json(rows[0]);
});

settingsRouter.put('/', async (req, res) => {
  const {
    whatsapp_recipients = [],
    carrier_unmatched_minutes,
    supplier_unmatched_minutes,
    quantity_tolerance,
    percentage_tolerance,
    notify_cooldown_hours
  } = req.body;

  const { rows } = await query(
    `UPDATE settings SET
      whatsapp_recipients=$1,
      carrier_unmatched_minutes=$2,
      supplier_unmatched_minutes=$3,
      quantity_tolerance=$4,
      percentage_tolerance=$5,
      notify_cooldown_hours=$6,
      updated_at=now()
     WHERE id=1 RETURNING *`,
    [
      whatsapp_recipients,
      carrier_unmatched_minutes,
      supplier_unmatched_minutes,
      quantity_tolerance,
      percentage_tolerance,
      notify_cooldown_hours
    ]
  );

  res.json(rows[0]);
});
