import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/irsaliye'
});

const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  notify_numbers TEXT[] NOT NULL DEFAULT '{}',
  carrier_unmatched_minutes INTEGER NOT NULL DEFAULT 60,
  supplier_unmatched_minutes INTEGER NOT NULL DEFAULT 60,
  amount_tolerance NUMERIC NOT NULL DEFAULT 0.5,
  percent_tolerance NUMERIC NOT NULL DEFAULT 2,
  cooldown_hours INTEGER NOT NULL DEFAULT 6,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('depo','musteri')),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  plate TEXT UNIQUE NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS docs (
  id SERIAL PRIMARY KEY,
  doc_type TEXT NOT NULL CHECK(doc_type IN ('carrier','supplier')),
  doc_datetime TIMESTAMP NOT NULL,
  location_id INTEGER REFERENCES locations(id),
  amount_value NUMERIC NOT NULL,
  amount_unit TEXT NOT NULL CHECK(amount_unit IN ('ton','m3')),
  plate TEXT,
  driver_name TEXT,
  serial_no TEXT,
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK(status IN ('matched','needs_review','unmatched')),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  doc_id INTEGER NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  mime TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  carrier_doc_id INTEGER UNIQUE REFERENCES docs(id),
  supplier_doc_id INTEGER UNIQUE REFERENCES docs(id),
  status TEXT NOT NULL CHECK(status IN ('matched','needs_review','unmatched')),
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id SERIAL PRIMARY KEY,
  doc_id INTEGER REFERENCES docs(id),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_serial ON docs(serial_no);
CREATE INDEX IF NOT EXISTS idx_docs_datetime ON docs(doc_datetime);
CREATE INDEX IF NOT EXISTS idx_docs_status ON docs(status);
CREATE INDEX IF NOT EXISTS idx_docs_plate ON docs(plate);
`;

const scoreMatch = (doc, candidate) => {
  let score = 0;
  if (doc.serial_no && candidate.serial_no && doc.serial_no === candidate.serial_no) score += 80;

  const dateDiffHours = Math.abs(new Date(doc.doc_datetime) - new Date(candidate.doc_datetime)) / (1000 * 60 * 60);
  if (dateDiffHours <= 24) score += 10;

  const amountDiff = Math.abs(Number(doc.amount_value) - Number(candidate.amount_value));
  const pctDiff = (amountDiff / Number(candidate.amount_value || 1)) * 100;
  if (amountDiff <= 0.5 || pctDiff <= 2) score += 10;

  if (doc.location_id && candidate.location_id && doc.location_id === candidate.location_id) score += 10;
  if (doc.plate && candidate.plate && doc.plate === candidate.plate) score += 10;

  return Math.min(score, 100);
};

const syncDocStatus = async (docId, status) => {
  await pool.query('UPDATE docs SET status = $1 WHERE id = $2', [status, docId]);
};

async function autoMatch(docId) {
  const docRes = await pool.query('SELECT * FROM docs WHERE id = $1', [docId]);
  const doc = docRes.rows[0];
  if (!doc) return null;

  const targetType = doc.doc_type === 'carrier' ? 'supplier' : 'carrier';

  if (doc.serial_no) {
    const exact = await pool.query(
      `SELECT * FROM docs WHERE doc_type = $1 AND serial_no = $2 AND status != 'matched' ORDER BY created_at ASC LIMIT 1`,
      [targetType, doc.serial_no]
    );

    if (exact.rows[0]) {
      const paired = exact.rows[0];
      const carrierId = doc.doc_type === 'carrier' ? doc.id : paired.id;
      const supplierId = doc.doc_type === 'supplier' ? doc.id : paired.id;

      await pool.query(
        `INSERT INTO matches (carrier_doc_id, supplier_doc_id, status, confidence_score, notes)
         VALUES ($1, $2, 'matched', 100, 'Serial no exact match')
         ON CONFLICT (carrier_doc_id) DO NOTHING`,
        [carrierId, supplierId]
      );

      await syncDocStatus(doc.id, 'matched');
      await syncDocStatus(paired.id, 'matched');
      return { status: 'matched', confidence: 100, pairedDoc: paired.id };
    }
  }

  const candidates = await pool.query(
    `SELECT * FROM docs
     WHERE doc_type = $1
       AND status = 'unmatched'
       AND doc_datetime BETWEEN $2::timestamp - interval '1 day' AND $2::timestamp + interval '1 day'`,
    [targetType, doc.doc_datetime]
  );

  let best = null;
  for (const candidate of candidates.rows) {
    const confidence = scoreMatch(doc, candidate);
    if (!best || confidence > best.confidence) best = { candidate, confidence };
  }

  if (best && best.confidence >= 60) {
    const carrierId = doc.doc_type === 'carrier' ? doc.id : best.candidate.id;
    const supplierId = doc.doc_type === 'supplier' ? doc.id : best.candidate.id;

    await pool.query(
      `INSERT INTO matches (carrier_doc_id, supplier_doc_id, status, confidence_score, notes)
       VALUES ($1, $2, 'needs_review', $3, 'Auto suggestion')
       ON CONFLICT (carrier_doc_id) DO NOTHING`,
      [carrierId, supplierId, best.confidence]
    );

    await syncDocStatus(doc.id, 'needs_review');
    await syncDocStatus(best.candidate.id, 'needs_review');
    return { status: 'needs_review', confidence: best.confidence, pairedDoc: best.candidate.id };
  }

  return { status: 'unmatched', confidence: 0 };
}

async function queueWhatsAppAlerts() {
  const settingsRes = await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
  const settings = settingsRes.rows[0];
  if (!settings) return;

  const staleCarrier = await pool.query(
    `SELECT * FROM docs WHERE doc_type = 'carrier' AND status = 'unmatched' AND created_at < NOW() - ($1 || ' minutes')::interval`,
    [settings.carrier_unmatched_minutes]
  );

  const staleSupplier = await pool.query(
    `SELECT * FROM docs WHERE doc_type = 'supplier' AND status = 'unmatched' AND created_at < NOW() - ($1 || ' minutes')::interval`,
    [settings.supplier_unmatched_minutes]
  );

  for (const doc of [...staleCarrier.rows, ...staleSupplier.rows]) {
    for (const recipient of settings.notify_numbers) {
      const alreadySent = await pool.query(
        `SELECT 1 FROM whatsapp_outbox WHERE doc_id = $1 AND recipient = $2 AND created_at > NOW() - ($3 || ' hours')::interval LIMIT 1`,
        [doc.id, recipient, settings.cooldown_hours]
      );
      if (alreadySent.rowCount) continue;

      const msg = `⚠️ Açıkta İrsaliye: ${doc.doc_type} Seri: ${doc.serial_no || '-'} Tarih: ${new Date(doc.doc_datetime).toLocaleString('tr-TR')} Miktar: ${doc.amount_value} ${doc.amount_unit}`;
      await pool.query(
        'INSERT INTO whatsapp_outbox (doc_id, recipient, message) VALUES ($1, $2, $3)',
        [doc.id, recipient, msg]
      );
    }
  }
}

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.get('/api/dashboard', async (_req, res) => {
  const data = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_total,
      COUNT(*) FILTER (WHERE status = 'unmatched') as unmatched,
      COUNT(*) FILTER (WHERE status = 'needs_review') as needs_review,
      COUNT(*) FILTER (WHERE status = 'matched') as matched
    FROM docs WHERE is_deleted = false
  `);

  res.json(data.rows[0]);
});

app.get('/api/docs', async (req, res) => {
  const { type, status, q } = req.query;
  const values = [];
  let where = 'WHERE d.is_deleted = false';

  if (type) {
    values.push(type);
    where += ` AND d.doc_type = $${values.length}`;
  }
  if (status) {
    values.push(status);
    where += ` AND d.status = $${values.length}`;
  }
  if (q) {
    values.push(`%${q}%`);
    where += ` AND (d.serial_no ILIKE $${values.length} OR d.plate ILIKE $${values.length})`;
  }

  const docs = await pool.query(
    `SELECT d.*, l.name as location_name
     FROM docs d
     LEFT JOIN locations l ON l.id = d.location_id
     ${where}
     ORDER BY d.created_at DESC`,
    values
  );

  res.json(docs.rows);
});

app.post('/api/docs/:type', upload.single('file'), async (req, res) => {
  const type = req.params.type;
  if (!['carrier', 'supplier'].includes(type)) return res.status(400).json({ error: 'invalid type' });

  const { doc_datetime, location_id, amount_value, amount_unit, plate, driver_name, serial_no } = req.body;
  if (!doc_datetime || !amount_value || !amount_unit) {
    return res.status(400).json({ error: 'required fields missing' });
  }

  if (serial_no && !/^[-A-Z0-9/.]{3,30}$/i.test(serial_no)) {
    return res.status(400).json({ error: 'invalid serial format' });
  }

  if (serial_no) {
    const dupe = await pool.query('SELECT id FROM docs WHERE serial_no = $1 AND doc_type = $2 AND is_deleted = false', [serial_no, type]);
    if (dupe.rowCount > 0) return res.status(409).json({ error: 'duplicate serial_no' });
  }

  const inserted = await pool.query(
    `INSERT INTO docs (doc_type, doc_datetime, location_id, amount_value, amount_unit, plate, driver_name, serial_no)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [type, doc_datetime, location_id || null, amount_value, amount_unit, plate || null, driver_name || null, serial_no || null]
  );

  if (req.file) {
    await pool.query(
      'INSERT INTO attachments (doc_id, file_path, mime) VALUES ($1, $2, $3)',
      [inserted.rows[0].id, `/uploads/${req.file.filename}`, req.file.mimetype]
    );
  }

  const matchResult = await autoMatch(inserted.rows[0].id);
  await queueWhatsAppAlerts();

  res.status(201).json({ doc: inserted.rows[0], match: matchResult });
});

app.get('/api/matches', async (_req, res) => {
  const rows = await pool.query(`
    SELECT m.*, c.serial_no AS carrier_serial, s.serial_no AS supplier_serial
    FROM matches m
    LEFT JOIN docs c ON c.id = m.carrier_doc_id
    LEFT JOIN docs s ON s.id = m.supplier_doc_id
    ORDER BY m.created_at DESC
  `);
  res.json(rows.rows);
});

app.post('/api/matches/:id/confirm', async (req, res) => {
  const { status } = req.body;
  if (!['matched', 'unmatched'].includes(status)) return res.status(400).json({ error: 'invalid status' });

  const matchRes = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
  const match = matchRes.rows[0];
  if (!match) return res.status(404).json({ error: 'not found' });

  await pool.query('UPDATE matches SET status = $1 WHERE id = $2', [status, req.params.id]);
  await syncDocStatus(match.carrier_doc_id, status);
  await syncDocStatus(match.supplier_doc_id, status);

  res.json({ ok: true });
});

app.get('/api/settings', async (_req, res) => {
  const row = await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
  res.json(row.rows[0] || null);
});

app.post('/api/settings', async (req, res) => {
  const { notify_numbers = [], carrier_unmatched_minutes = 60, supplier_unmatched_minutes = 60, amount_tolerance = 0.5, percent_tolerance = 2, cooldown_hours = 6 } = req.body;

  const row = await pool.query(
    `INSERT INTO settings (notify_numbers, carrier_unmatched_minutes, supplier_unmatched_minutes, amount_tolerance, percent_tolerance, cooldown_hours)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [notify_numbers, carrier_unmatched_minutes, supplier_unmatched_minutes, amount_tolerance, percent_tolerance, cooldown_hours]
  );

  res.json(row.rows[0]);
});

app.get('/api/whatsapp/qr', async (_req, res) => {
  const fakeQr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const row = await pool.query(
    `INSERT INTO whatsapp_sessions (status, qr_code)
     VALUES ('waiting_qr', $1)
     RETURNING *`,
    [fakeQr]
  );
  res.json(row.rows[0]);
});

app.post('/api/whatsapp/send', async (req, res) => {
  const { recipient, message } = req.body;
  if (!recipient || !message) return res.status(400).json({ error: 'recipient and message required' });

  const out = await pool.query('INSERT INTO whatsapp_outbox (recipient, message, status, sent_at) VALUES ($1,$2,\'sent\', NOW()) RETURNING *', [recipient, message]);
  res.json(out.rows[0]);
});

(async () => {
  await pool.query(createTablesSQL);
  const hasSettings = await pool.query('SELECT 1 FROM settings LIMIT 1');
  if (!hasSettings.rowCount) {
    await pool.query("INSERT INTO settings (notify_numbers) VALUES (ARRAY['+905xxxxxxxxx'])");
  }

  await pool.query("INSERT INTO locations (name, type) SELECT * FROM (VALUES ('Ana Depo', 'depo'), ('Merkez Şantiye', 'musteri')) AS t(name, type) WHERE NOT EXISTS (SELECT 1 FROM locations)");

  app.listen(port, () => {
    console.log(`API listening on ${port}`);
  });
})();
