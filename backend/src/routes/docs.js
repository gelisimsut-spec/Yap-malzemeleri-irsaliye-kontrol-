import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../prisma.js';
import { attemptMatchForCarrier } from '../services/matchingService.js';
import { normalizeSerial, validateSerial } from '../utils/scoring.js';
import { audit } from '../services/auditService.js';

const router = express.Router();
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`)
});
const upload = multer({ storage });

router.post('/carrier', upload.single('file'), async (req, res) => {
  const { docDate, locationId, amountValue, amountUnit, plate, driver, serialNo } = req.body;
  if (!docDate || !locationId || !amountValue || !amountUnit) return res.status(400).json({ error: 'Zorunlu alanlar eksik' });
  if (!validateSerial(serialNo)) return res.status(400).json({ error: 'Seri no formatı geçersiz' });

  const normalizedSerial = normalizeSerial(serialNo);
  if (normalizedSerial) {
    const exists = await prisma.carrierDoc.findFirst({ where: { serialNo: normalizedSerial, deletedAt: null } });
    if (exists) return res.status(409).json({ error: 'Bu seri no daha önce girilmiş' });
  }

  const doc = await prisma.carrierDoc.create({
    data: {
      docDate: new Date(docDate),
      locationId: Number(locationId),
      amountValue: Number(amountValue),
      amountUnit,
      plate: plate || null,
      driver: driver || null,
      serialNo: normalizedSerial
    }
  });

  if (req.file) {
    await prisma.attachment.create({ data: { docType: 'carrier', docId: doc.id, filePath: path.join(uploadDir, req.file.filename), mime: req.file.mimetype } });
  }

  const matchResult = await attemptMatchForCarrier(doc.id);
  await audit('user', 'CREATE_CARRIER_DOC', 'carrierDoc', doc.id, req.body);
  return res.status(201).json({ doc, matchResult });
});

router.post('/supplier', upload.single('file'), async (req, res) => {
  const { docDate, locationId, amountValue, amountUnit, serialNo } = req.body;
  if (!docDate || !locationId || !amountValue || !amountUnit) return res.status(400).json({ error: 'Zorunlu alanlar eksik' });
  if (!validateSerial(serialNo)) return res.status(400).json({ error: 'Seri no formatı geçersiz' });

  const normalizedSerial = normalizeSerial(serialNo);
  const doc = await prisma.supplierDoc.create({
    data: { docDate: new Date(docDate), locationId: Number(locationId), amountValue: Number(amountValue), amountUnit, serialNo: normalizedSerial }
  });

  if (req.file) {
    await prisma.attachment.create({ data: { docType: 'supplier', docId: doc.id, filePath: path.join(uploadDir, req.file.filename), mime: req.file.mimetype } });
  }

  const candidateCarriers = await prisma.carrierDoc.findMany({ where: { status: 'unmatched', deletedAt: null }, take: 25, orderBy: { createdAt: 'desc' } });
  for (const carrier of candidateCarriers) {
    await attemptMatchForCarrier(carrier.id);
  }

  await audit('user', 'CREATE_SUPPLIER_DOC', 'supplierDoc', doc.id, req.body);
  return res.status(201).json({ doc });
});

router.get('/unmatched', async (req, res) => {
  const q = req.query.q?.toString().trim();
  const serialFilter = q ? { contains: q, mode: 'insensitive' } : undefined;

  const [carrier, supplier] = await Promise.all([
    prisma.carrierDoc.findMany({ where: { status: 'unmatched', deletedAt: null, serialNo: serialFilter }, include: { location: true }, orderBy: { docDate: 'desc' } }),
    prisma.supplierDoc.findMany({ where: { status: 'unmatched', deletedAt: null, serialNo: serialFilter }, include: { location: true }, orderBy: { docDate: 'desc' } })
  ]);

  res.json({ carrier, supplier });
});

export default router;
