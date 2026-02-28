import cron from 'node-cron';
import { prisma } from '../prisma.js';
import { sendWhatsappMessage } from '../services/whatsappService.js';

export function startOutboxWorker() {
  cron.schedule('*/1 * * * *', async () => {
    const items = await prisma.whatsappOutbox.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: 20
    });

    for (const item of items) {
      try {
        await sendWhatsappMessage(item.recipient, item.message, item.fileUrl);
        await prisma.whatsappOutbox.update({
          where: { id: item.id },
          data: { status: 'sent', sentAt: new Date() }
        });
      } catch (error) {
        const retryCount = item.retryCount + 1;
        await prisma.whatsappOutbox.update({
          where: { id: item.id },
          data: {
            status: retryCount >= 3 ? 'failed' : 'queued',
            retryCount,
            lastError: error.message
          }
        });
      }
    }
  });
}
