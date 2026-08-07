const assert = require('assert');
const { normalizeAttachment } = require('../modules/commerce/service/commerce.sync.service.js');

// String attachment -> url only
let a = normalizeAttachment('https://cdn.example.com/photo.jpg');
assert.strictEqual(a.url, 'https://cdn.example.com/photo.jpg');
assert.strictEqual(a.type, 'jpg');
assert.strictEqual(a.zoomable, true);

// Object attachment -> url/name/type preserved
a = normalizeAttachment({ url: 'https://cdn.example.com/a.png', name: 'receipt.png', type: 'png' });
assert.deepStrictEqual(a, { url: 'https://cdn.example.com/a.png', name: 'receipt.png', type: 'png', zoomable: true });

// Fallback fields + missing type inferred from url
a = normalizeAttachment({ imageUrl: 'https://cdn.example.com/return.jpg?x=1', filename: 'return.jpg' });
assert.strictEqual(a.url, 'https://cdn.example.com/return.jpg?x=1');
assert.strictEqual(a.name, 'return.jpg');
assert.strictEqual(a.type, 'jpg');

// Junk filtered
assert.strictEqual(normalizeAttachment(null), null);
assert.strictEqual(normalizeAttachment(undefined), null);

console.log('attachments-normalize OK');
