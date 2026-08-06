const assert = require('assert');
const { commerceSync } = require('../modules/commerce/service/commerce.sync.service.js');

commerceSync.deliveryZones = [
  { key: 'same-city', slaHours: 24, branches: ['TINKUNE', 'SURYABINAYAK'] },
  { key: 'major', slaHours: 48, branches: ['POKHARA', 'BIRATNAGAR'] },
  { key: 'third-tier', slaHours: 72, branches: ['AARUGHAT', 'JOMSOM'] },
];

const cz = (branch) => commerceSync.computeDeliveryZone(branch);
assert.strictEqual(cz({ name: 'SURYABINAYAK' }), 'same-city');
assert.strictEqual(cz({ name: 'POKHARA' }), 'major');
assert.strictEqual(cz('aaruGHat'), 'third-tier');
assert.strictEqual(cz({ name: 'NOWHERE' }), 'other');
assert.strictEqual(cz(null), 'other');
assert.strictEqual(cz({}), 'other');
assert.strictEqual(cz({ code: 'SURY1' }), 'other');

console.log('commerce-sync-zone OK');
