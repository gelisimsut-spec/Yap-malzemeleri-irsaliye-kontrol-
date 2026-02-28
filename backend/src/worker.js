import { query } from './db.js';
import { enqueueMessage, processOutbox } from './services/whatsapp.js';

function formatAlert(type, doc) {
  return `⚠️ Açıkta İrsaliye: ${type} Seri: ${doc.serial_no || '-'} Tarih: ${new Date(doc.doc_datetime).toLocaleString('tr-TR')} Miktar: ${doc.quantity_value} ${doc.quantity_unit} Adres: ${doc.location_name || '-'}`;
}

export function startWorker() {
  setInterval(async () => {
    try {
      const { rows: settingsRows } = await query('SELECT * FROM settings WHERE id=1');
      const settings = settingsRows[0];

      const { rows: carrierOpen } = await query(
        `SELECT c.*, l.name as location_name FROM carrier_docs c
         LEFT JOIN locations l ON l.id=c.location_id
         WHERE c.status='unmatched' AND c.created_at < now() - ($1 || ' minutes')::interval
           AND (c.last_notified_at IS NULL OR c.last_notified_at < now() - ($2 || ' hours')::interval)`,
        [String(settings.carrier_unmatched_minutes), String(settings.notify_cooldown_hours)]
      );

      const { rows: supplierOpen } = await query(
        `SELECT s.*, l.name as location_name FROM supplier_docs s
         LEFT JOIN locations l ON l.id=s.location_id
         WHERE s.status='unmatched' AND s.created_at < now() - ($1 || ' minutes')::interval
           AND (s.last_notified_at IS NULL OR s.last_notified_at < now() - ($2 || ' hours')::interval)`,
        [String(settings.supplier_unmatched_minutes), String(settings.notify_cooldown_hours)]
      );

      for (const doc of [...carrierOpen, ...supplierOpen]) {
        for (const recipient of settings.whatsapp_recipients || []) {
          await enqueueMessage(recipient, formatAlert(doc.plate ? 'Nakliyeci' : 'Kum Ocağı', doc));
        }

        await query(
          `UPDATE ${doc.plate ? 'carrier_docs' : 'supplier_docs'} SET last_notified_at=now() WHERE id=$1`,
          [doc.id]
        );
      }

      await processOutbox();
    } catch (err) {
      console.error('[worker]', err.message);
    }
  }, 30_000);
}
