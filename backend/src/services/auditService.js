import { prisma } from '../prisma.js';

export async function audit(actor, action, entityType, entityId, payload) {
  await prisma.auditLog.create({
    data: {
      actor,
      action,
      entityType,
      entityId: String(entityId),
      payload
    }
  });
}
