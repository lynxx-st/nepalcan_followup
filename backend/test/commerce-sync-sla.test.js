const assert = require('assert');
const { commerceSync } = require('../modules/commerce/service/commerce.sync.service.js');

commerceSync.deliveryZones = [
  { key: 'same-city', slaHours: 24, branches: [] },
  { key: 'major', slaHours: 48, branches: [] },
  { key: 'third-tier', slaHours: 72, branches: [] },
];

const H = 3600000;
const t0 = new Date('2026-08-01T00:00:00Z');

// Window A only (creation).
let s = commerceSync.computeSla({ created: t0, pickup: null, zone: 'major' }, new Date(t0.getTime() + 49 * H));
assert.strictEqual(s.slaStatus, 'breached');
assert.strictEqual(s.slaDeliveryDeadline.getTime(), t0.getTime() + 48 * H);
assert.strictEqual(s.deadlineA.getTime(), t0.getTime() + 48 * H);
assert.strictEqual(s.deadlineB, null);

// Both windows: pickup at +10h → deadlineB at +58h, min stays +48h.
s = commerceSync.computeSla({ created: t0, pickup: new Date(t0.getTime() + 10 * H), zone: 'major' }, new Date(t0.getTime() + 20 * H));
assert.strictEqual(s.deadlineB.getTime(), t0.getTime() + 58 * H);
assert.strictEqual(s.slaDeliveryDeadline.getTime(), t0.getTime() + 48 * H);
assert.strictEqual(s.slaStatus, 'pending');

// Breach after the operative deadline.
s = commerceSync.computeSla({ created: t0, pickup: new Date(t0.getTime() + 10 * H), zone: 'major' }, new Date(t0.getTime() + 49 * H));
assert.strictEqual(s.slaStatus, 'breached');

// Delivered → ok regardless of deadline.
s = commerceSync.computeSla({ created: t0, pickup: null, zone: 'same-city', delivered: true }, new Date(t0.getTime() + 100 * H));
assert.strictEqual(s.slaStatus, 'ok');

// 'other' zone falls back to third-tier hours (72).
s = commerceSync.computeSla({ created: t0, pickup: null, zone: 'other' }, new Date(t0.getTime() + 73 * H));
assert.strictEqual(s.slaStatus, 'breached');
assert.strictEqual(s.slaDeliveryDeadline.getTime(), t0.getTime() + 72 * H);

console.log('commerce-sync-sla OK');
