import express from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { computeMatchScore, isValidSerial, normalizeSerial } from '../services/matching.js';

const upload = multer({ dest: 'uploads/' });
export const docsRouter = express.Router();

async function getSettings() {
  const { rows } = await query('SELECT * FROM settings WHERE id=1');
  return rows[0];
}

async function writeAudit(action, entityType, entityId, payload = {}) {
  await query(
    `INSERT INTO audit_log (action, entity_type, entity_id, payload) VALUES ($1,$2,$3,$4)`,
    [action, entityType, entityId, payload]
  );
}

async function runAutoMatchingForCarrier(carrierId) {
  const settings = await getSettings();
  const { rows: carrierRows } = await query(`SELECT * FROM carrier_docs WHERE id=$1`, [carrierId]);
  const carrier = carrierRows[0];
  if (!carrier) return null;

  const { rows: supplierRows } = await query(`SELECT * FROM supplier_docs WHERE status!='matched' AND is_deleted=false`);
  let best = null;

  for (const s of supplierRows) {
    const res = computeMatchScore(carrier, s, settings);
    if (!best || res.score > best.score) {
      best = { supplier: s, ...res };
    }
  }

  if (!best || best.score < 50) return null;

  const status = best.score >= 85 ? 'matched' : 'needs_review';

  await query(
    `INSERT INTO matches (carrier_doc_id, supplier_doc_id, status, confidence_score, notes)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (carrier_doc_id)
     DO UPDATE SET supplier_doc_id=EXCLUDED.supplier_doc_id, status=EXCLUDED.status, confidence_score=EXCLUDED.confidence_score, notes=EXCLUDED.notes`,
    [carrier.id, best.supplier.id, status, best.score, best.reason]
  );

  await query(`UPDATE carrier_docs SET status=$2 WHERE id=$1`, [carrier.id, status]);
  await query(`UPDATE supplier_docs SET status=$2 WHERE id=$1`, [best.supplier.id, status]);

  return { status, score: best.score, supplierId: best.supplier.id };
}

docsRouter.get('/carrier', async (_req, res) => {
  const { rows } = await query(
    `SELECT c.*, l.name as location_name FROM carrier_docs c LEFT JOIN locations l ON l.id=c.location_id WHERE c.is_deleted=false ORDER BY c.created_at DESC`
  );
  res.json(rows);
});

docsRouter.get('/supplier', async (_req, res) => {
  const { rows } = await query(
    `SELECT s.*, l.name as location_name FROM supplier_docs s LEFT JOIN locations l ON l.id=s.location_id WHERE s.is_deleted=false ORDER BY s.created_at DESC`
  );
  res.json(rows);
});

docsRouter.post('/carrier', upload.single('file'), async (req, res) => {
  const { doc_datetime, location_id, quantity_value, quantity_unit, plate, driver_name, serial_no } = req.body;
  if (!doc_datetime || !quantity_value || !quantity_unit) return res.status(400).json({ error: 'required fields missing' });
  if (serial_no && !isValidSerial(serial_no)) return res.status(400).json({ error: 'invalid serial format' });

  const normSerial = normalizeSerial(serial_no);
  if (normSerial) {
    const { rowCount } = await query(`SELECT 1 FROM carrier_docs WHERE serial_no=$1 AND is_deleted=false`, [normSerial]);
    if (rowCount > 0) return res.status(409).json({ error: 'duplicate serial no' });
  }

  const { rows } = await query(
    `INSERT INTO carrier_docs (doc_datetime, location_id, quantity_value, quantity_unit, plate, driver_name, serial_no)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [doc_datetime, location_id || null, quantity_value, quantity_unit, plate || null, driver_name || null, normSerial]
  );

  const inserted = rows[0];

  if (req.file) {
    await query(`INSERT INTO attachments (doc_type, doc_id, file_path, mime) VALUES ('carrier',$1,$2,$3)`, [inserted.id, req.file.path, req.file.mimetype]);
  }

  await writeAudit('create', 'carrier_doc', inserted.id, inserted);
  const matchResult = await runAutoMatchingForCarrier(inserted.id);

  res.status(201).json({ data: inserted, autoMatch: matchResult });
});

docsRouter.post('/supplier', upload.single('file'), async (req, res) => {
  const { doc_datetime, location_id, quantity_value, quantity_unit, serial_no } = req.body;
  if (!doc_datetime || !quantity_value || !quantity_unit) return res.status(400).json({ error: 'required fields missing' });
  if (serial_no && !isValidSerial(serial_no)) return res.status(400).json({ error: 'invalid serial format' });

  const normSerial = normalizeSerial(serial_no);

  const { rows } = await query(
    `INSERT INTO supplier_docs (doc_datetime, location_id, quantity_value, quantity_unit, serial_no)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [doc_datetime, location_id || null, quantity_value, quantity_unit, normSerial]
  );

  const inserted = rows[0];

  if (req.file) {
    await query(`INSERT INTO attachments (doc_type, doc_id, file_path, mime) VALUES ('supplier',$1,$2,$3)`, [inserted.id, req.file.path, req.file.mimetype]);
  }

  await writeAudit('create', 'supplier_doc', inserted.id, inserted);
  res.status(201).json({ data: inserted });
});

docsRouter.get('/matches', async (_req, res) => {
  const { rows } = await query(
    `SELECT m.*, c.serial_no as carrier_serial, s.serial_no as supplier_serial
     FROM matches m
     JOIN carrier_docs c ON c.id=m.carrier_doc_id
     JOIN supplier_docs s ON s.id=m.supplier_doc_id
     ORDER BY m.created_at DESC`
  );
  res.json(rows);
});

docsRouter.post('/matches/:id/decision', async (req, res) => {
  const { id } = req.params;
  const { accept } = req.body;

  const { rows } = await query(`SELECT * FROM matches WHERE id=$1`, [id]);
  const item = rows[0];
  if (!item) return res.status(404).json({ error: 'not found' });

  const status = accept ? 'matched' : 'rejected';
  await query(`UPDATE matches SET status=$2 WHERE id=$1`, [id, status]);
  await query(`UPDATE carrier_docs SET status=$2 WHERE id=$1`, [item.carrier_doc_id, accept ? 'matched' : 'unmatched']);
  await query(`UPDATE supplier_docs SET status=$2 WHERE id=$1`, [item.supplier_doc_id, accept ? 'matched' : 'unmatched']);

  await writeAudit('match_decision', 'match', Number(id), { accept });
  res.json({ ok: true });
});
