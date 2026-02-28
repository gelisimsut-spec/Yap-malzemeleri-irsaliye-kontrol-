import express from 'express';
import { query } from '../db.js';

export const demoRouter = express.Router();

demoRouter.post('/seed', async (_req, res) => {
  await query(`INSERT INTO locations (name,type,address) VALUES
    ('Merkez Depo','depo','Ankara Ostim'),
    ('Şantiye A','musteri','İzmir Bornova')
    ON CONFLICT DO NOTHING`);

  await query(`INSERT INTO vehicles (plate,driver_name) VALUES
    ('06ABC123','Ahmet'),
    ('35XYZ987','Mehmet')
    ON CONFLICT DO NOTHING`);

  res.json({ ok: true });
});
