import express from 'express';
import { prisma } from '../prisma.js';

const router = express.Router();

router.get('/', async (_, res) => {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  res.json(settings);
});

router.put('/', async (req, res) => {
  const updated = await prisma.settings.upsert({
    where: { id: 1 },
    update: req.body,
    create: { id: 1, ...req.body }
  });

  res.json(updated);
});

export default router;
