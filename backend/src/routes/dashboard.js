import express from 'express';
import dayjs from 'dayjs';
import { prisma } from '../prisma.js';

const router = express.Router();

router.get('/', async (_, res) => {
  const start = dayjs().startOf('day').toDate();
  const [carrierToday, supplierToday, unmatchedCarrier, unmatchedSupplier, needsReview] = await Promise.all([
    prisma.carrierDoc.count({ where: { createdAt: { gte: start }, deletedAt: null } }),
    prisma.supplierDoc.count({ where: { createdAt: { gte: start }, deletedAt: null } }),
    prisma.carrierDoc.count({ where: { status: 'unmatched', deletedAt: null } }),
    prisma.supplierDoc.count({ where: { status: 'unmatched', deletedAt: null } }),
    prisma.match.count({ where: { status: 'needs_review' } })
  ]);

  res.json({
    carrierToday,
    supplierToday,
    unmatchedTotal: unmatchedCarrier + unmatchedSupplier,
    needsReview
  });
});

export default router;
