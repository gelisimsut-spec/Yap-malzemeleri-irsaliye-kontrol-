import cron from 'node-cron';
import dayjs from 'dayjs';
import { prisma } from '../prisma.js';

function composeMessage(type, doc) {
  return `⚠️ Açıkta İrsaliye: ${type} Seri: ${doc.serialNo || '-'} Tarih: ${dayjs(doc.docDate).format('DD.MM.YYYY HH:mm')} Miktar: ${doc.amountValue} ${doc.amountUnit} Adres: ${doc.location?.name || '-'}`;
}

export function startUnmatchedNotifier() {
  cron.schedule('*/5 * * * *', async () => {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings || settings.notifyPhones.length === 0) return;

    const now = dayjs();
    const carrierCutoff = now.subtract(settings.carrierThresholdMinutes, 'minute').toDate();
    const supplierCutoff = now.subtract(settings.supplierThresholdMinutes, 'minute').toDate();
    const cooldownCutoff = now.subtract(settings.reminderCooldownHours, 'hour').toDate();

    const carriers = await prisma.carrierDoc.findMany({
      where: {
        status: 'unmatched',
        docDate: { lte: carrierCutoff },
        OR: [{ notifiedAt: null }, { notifiedAt: { lte: cooldownCutoff } }]
      },
      include: { location: true }
    });

    const suppliers = await prisma.supplierDoc.findMany({
      where: {
        status: 'unmatched',
        docDate: { lte: supplierCutoff },
        OR: [{ notifiedAt: null }, { notifiedAt: { lte: cooldownCutoff } }]
      },
      include: { location: true }
    });

    for (const doc of carriers) {
      for (const recipient of settings.notifyPhones) {
        await prisma.whatsappOutbox.create({
          data: {
            recipient,
            message: composeMessage('Nakliyeci', doc)
          }
        });
      }

      await prisma.carrierDoc.update({ where: { id: doc.id }, data: { notifiedAt: new Date() } });
    }

    for (const doc of suppliers) {
      for (const recipient of settings.notifyPhones) {
        await prisma.whatsappOutbox.create({
          data: {
            recipient,
            message: composeMessage('Kum Ocağı', doc)
          }
        });
      }

      await prisma.supplierDoc.update({ where: { id: doc.id }, data: { notifiedAt: new Date() } });
    }
  });
}
