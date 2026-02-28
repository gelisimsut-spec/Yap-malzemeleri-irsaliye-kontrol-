import { prisma } from '../prisma.js';

export async function seedDefaults() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      notifyPhones: ['905551112233'],
      carrierThresholdMinutes: 90,
      supplierThresholdMinutes: 90,
      amountToleranceAbsolute: 0.5,
      amountTolerancePercent: 2,
      reminderCooldownHours: 6
    }
  });

  if ((await prisma.location.count()) === 0) {
    await prisma.location.createMany({
      data: [
        { name: 'Merkez Depo', address: 'Merkez depo adresi', type: 'depo' },
        { name: 'Yılmaz İnşaat Şantiye', address: 'Şantiye adresi', type: 'müşteri' }
      ]
    });
  }

  if ((await prisma.vehicle.count()) === 0) {
    await prisma.vehicle.createMany({
      data: [
        { plate: '34ABC123', driver: 'Ahmet' },
        { plate: '06XYZ789', driver: 'Mehmet' }
      ]
    });
  }
}
