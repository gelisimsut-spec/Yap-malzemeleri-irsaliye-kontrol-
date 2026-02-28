import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMatchScore, normalizeSerial, isValidSerial } from '../services/matching.js';

test('serial exact should be 100', () => {
  const result = computeMatchScore(
    { serial_no: 'ab-123', doc_datetime: new Date(), quantity_value: 10, location_id: 1 },
    { serial_no: 'AB-123', doc_datetime: new Date(), quantity_value: 12, location_id: 2 },
    { quantity_tolerance: 0.5, percentage_tolerance: 2 }
  );
  assert.equal(result.score, 100);
});

test('normalize/validate serial', () => {
  assert.equal(normalizeSerial(' ab 1 '), 'AB1');
  assert.equal(isValidSerial('AB/123-1'), true);
  assert.equal(isValidSerial('??'), false);
});
