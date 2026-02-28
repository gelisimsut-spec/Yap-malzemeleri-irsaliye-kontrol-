import { prisma } from '../prisma.js';
import { calculateSuggestionScore, normalizeSerial } from '../utils/scoring.js';
import { audit } from './auditService.js';

export async function attemptMatchForCarrier(carrierDocId) {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const carrier = await prisma.carrierDoc.findUnique({ where: { id: carrierDocId } });
  if (!carrier) return null;

  const normalized = normalizeSerial(carrier.serialNo);
  let supplier = null;
  let status = 'unmatched';
  let confidenceScore = 0;
  let notes = null;

  if (normalized) {
    supplier = await prisma.supplierDoc.findFirst({
      where: { serialNo: normalized, status: 'unmatched', deletedAt: null }
    });
  }

  if (!supplier) {
    const candidates = await prisma.supplierDoc.findMany({
      where: {
        status: 'unmatched',
        deletedAt: null
      },
      take: 30
    });

    for (const candidate of candidates) {
      const score = calculateSuggestionScore(carrier, candidate, settings);
      if (score > confidenceScore) {
        confidenceScore = score;
        supplier = candidate;
      }
    }

    status = confidenceScore >= 85 ? 'matched' : confidenceScore >= 55 ? 'needs_review' : 'unmatched';
    notes = status === 'needs_review' ? 'Sistem öneri eşleşmesi' : null;
  } else {
    status = 'matched';
    confidenceScore = 100;
    notes = 'Seri no birebir eşleşti';
  }

  if (!supplier || status === 'unmatched') {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.upsert({
      where: { carrierDocId: carrier.id },
      update: {
        supplierDocId: supplier.id,
        status,
        confidenceScore,
        notes
      },
      create: {
        carrierDocId: carrier.id,
        supplierDocId: supplier.id,
        status,
        confidenceScore,
        notes
      }
    });

    await tx.carrierDoc.update({ where: { id: carrier.id }, data: { status } });
    await tx.supplierDoc.update({ where: { id: supplier.id }, data: { status } });
  });

  await audit('system', 'AUTO_MATCH', 'carrierDoc', carrier.id, { supplierDocId: supplier.id, status, confidenceScore });

  return { carrierDocId: carrier.id, supplierDocId: supplier.id, status, confidenceScore, notes };
}

export async function reviewMatch(matchId, approve) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error('Eşleşme bulunamadı');

  const status = approve ? 'matched' : 'unmatched';

  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data: { status } });
    await tx.carrierDoc.update({ where: { id: match.carrierDocId }, data: { status } });
    await tx.supplierDoc.update({ where: { id: match.supplierDocId }, data: { status } });
  });

  await audit('user', approve ? 'APPROVE_MATCH' : 'REJECT_MATCH', 'match', matchId, {});
}
