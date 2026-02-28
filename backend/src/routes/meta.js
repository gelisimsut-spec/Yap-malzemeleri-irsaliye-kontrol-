import express from 'express';
import { query } from '../db.js';

export const metaRouter = express.Router();

metaRouter.get('/locations', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM locations WHERE is_deleted=false ORDER BY name`);
  res.json(rows);
});

metaRouter.post('/locations', async (req, res) => {
  const { name, type, address } = req.body;
  const { rows } = await query(
    `INSERT INTO locations (name,type,address) VALUES ($1,$2,$3) RETURNING *`,
    [name, type, address]
  );
  res.status(201).json(rows[0]);
});

metaRouter.get('/vehicles', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM vehicles WHERE is_deleted=false ORDER BY plate`);
  res.json(rows);
});

metaRouter.post('/vehicles', async (req, res) => {
  const { plate, driver_name } = req.body;
  const { rows } = await query(
    `INSERT INTO vehicles (plate,driver_name) VALUES ($1,$2) RETURNING *`,
    [plate.toUpperCase(), driver_name || null]
  );
  res.status(201).json(rows[0]);
});
