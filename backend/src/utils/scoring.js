import dayjs from 'dayjs';

export function normalizeSerial(serialNo) {
  return serialNo?.trim().toUpperCase() || null;
}

export function validateSerial(serialNo) {
  if (!serialNo) return true;
  return /^[A-Z0-9-]{3,30}$/i.test(serialNo);
}

export function calculateSuggestionScore(carrierDoc, supplierDoc, settings) {
  let score = 0;

  const dayDiff = Math.abs(dayjs(carrierDoc.docDate).diff(dayjs(supplierDoc.docDate), 'day'));
  if (dayDiff === 0) score += 30;
  else if (dayDiff <= 1) score += 20;

  const amountDiff = Math.abs(carrierDoc.amountValue - supplierDoc.amountValue);
  const percentDiff = (amountDiff / Math.max(1, supplierDoc.amountValue)) * 100;
  if (amountDiff <= settings.amountToleranceAbsolute || percentDiff <= settings.amountTolerancePercent) {
    score += 35;
  }

  if (carrierDoc.locationId === supplierDoc.locationId) score += 25;
  if (carrierDoc.plate) score += 10;

  return Math.min(score, 100);
}
