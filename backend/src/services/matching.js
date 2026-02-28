export function normalizeSerial(serialNo) {
  if (!serialNo) return null;
  return String(serialNo).replace(/\s+/g, '').toUpperCase();
}

export function isValidSerial(serialNo) {
  if (!serialNo) return true;
  return /^[A-Z0-9\-/]{3,30}$/.test(normalizeSerial(serialNo));
}

function daysBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

export function computeMatchScore(carrier, supplier, settings) {
  const cSerial = normalizeSerial(carrier.serial_no);
  const sSerial = normalizeSerial(supplier.serial_no);

  if (cSerial && sSerial && cSerial === sSerial) {
    return { score: 100, reason: 'serial_exact' };
  }

  let score = 0;

  const dateDiffDays = daysBetween(carrier.doc_datetime, supplier.doc_datetime);
  if (dateDiffDays <= 1) score += 35;
  else if (dateDiffDays <= 2) score += 15;

  const cQty = Number(carrier.quantity_value);
  const sQty = Number(supplier.quantity_value);
  const absDiff = Math.abs(cQty - sQty);
  const pctDiff = sQty === 0 ? 100 : (absDiff / sQty) * 100;

  if (absDiff <= Number(settings.quantity_tolerance) || pctDiff <= Number(settings.percentage_tolerance)) score += 35;
  else if (absDiff <= Number(settings.quantity_tolerance) * 2) score += 15;

  if (carrier.location_id && supplier.location_id && carrier.location_id === supplier.location_id) score += 20;

  if (carrier.plate && supplier.plate && carrier.plate.toUpperCase() === supplier.plate.toUpperCase()) score += 10;

  return { score, reason: 'heuristic' };
}
