const assert = require('assert');
const { normalizeExternalComments } = require('../modules/commerce/service/commerce.sync.service.js');

const raw = [
  { orderid: 134, comments: 'Please provide us with the correct phone number?', addedBy: 'NCM Staff', added_time: '2019-11-02T16:43:15.687200+05:45' },
  { orderid: 134, comments: 'Test comments', addedBy: 'Vendor', added_time: '2019-10-15T12:22:15.989560+05:45' },
];

const out = normalizeExternalComments(raw);
assert.strictEqual(out.length, 2);
assert.strictEqual(out[0].note, 'Please provide us with the correct phone number?');
assert.strictEqual(out[0].actor, 'NCM Staff');
assert.strictEqual(out[0].createdAt, '2019-11-02T16:43:15.687200+05:45');
assert.strictEqual(out[1].actor, 'Vendor');
assert.strictEqual(normalizeExternalComments(null).length, 0);
assert.strictEqual(normalizeExternalComments([]).length, 0);

console.log('external-comments-normalize OK');
