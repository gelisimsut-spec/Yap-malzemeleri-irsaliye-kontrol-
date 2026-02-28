import express from 'express';
import { prisma } from '../prisma.js';
import { reviewMatch } from '../services/matchingService.js';

const router = express.Router();

router.get('/', async (_, res) => {
  const matches = await prisma.match.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(matches);
});

router.get('/needs-review', async (_, res) => {
  const matches = await prisma.match.findMany({ where: { status: 'needs_review' }, orderBy: { createdAt: 'desc' } });
  res.json(matches);
});

router.post('/:id/review', async (req, res) => {
  await reviewMatch(Number(req.params.id), Boolean(req.body.approve));
  res.json({ ok: true });
});

export default router;
