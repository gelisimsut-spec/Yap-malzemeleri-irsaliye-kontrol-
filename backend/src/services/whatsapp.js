import { query } from '../db.js';

const base = process.env.WHATSAPP_API_BASE_URL;

export async function proxyWhatsApp(path, options = {}) {
  if (!base) throw new Error('WHATSAPP_API_BASE_URL missing');
  const response = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${text}`);
  }

  return response.json().catch(() => ({}));
}

export async function enqueueMessage(toNumber, message, attachmentUrl = null) {
  await query(
    `INSERT INTO whatsapp_outbox (to_number, message, attachment_url) VALUES ($1,$2,$3)`,
    [toNumber, message, attachmentUrl]
  );
}

export async function processOutbox() {
  const { rows } = await query(
    `SELECT * FROM whatsapp_outbox WHERE status='queued' ORDER BY created_at ASC LIMIT 20`
  );

  for (const row of rows) {
    try {
      await proxyWhatsApp('/send-message', {
        method: 'POST',
        body: JSON.stringify({
          phone: row.to_number,
          message: row.attachment_url ? `${row.message}\nEk: ${row.attachment_url}` : row.message
        })
      });

      await query(`UPDATE whatsapp_outbox SET status='sent', sent_at=now() WHERE id=$1`, [row.id]);
    } catch (err) {
      await query(
        `UPDATE whatsapp_outbox SET status='failed', retries=retries+1, last_error=$2 WHERE id=$1`,
        [row.id, err.message]
      );
    }
  }
}
