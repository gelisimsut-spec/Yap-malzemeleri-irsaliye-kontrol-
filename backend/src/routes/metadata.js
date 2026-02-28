import express from 'express';
import { prisma } from '../prisma.js';

const router = express.Router();

router.get('/locations', async (_, res) => {
  res.json(await prisma.location.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }));
});

router.post('/locations', async (req, res) => {
  const location = await prisma.location.create({ data: req.body });
  res.status(201).json(location);
});

router.get('/vehicles', async (_, res) => {
  res.json(await prisma.vehicle.findMany({ where: { deletedAt: null }, orderBy: { plate: 'asc' } }));
});

router.post('/vehicles', async (req, res) => {
  const vehicle = await prisma.vehicle.create({ data: req.body });
  res.status(201).json(vehicle);
});

export default router;
