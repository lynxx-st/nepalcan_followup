const assert = require('assert');
const { getQueueVisibility, setQueueVisibility } = require('../modules/settings/controller/settings.controller');

assert.strictEqual(typeof getQueueVisibility, 'function');
assert.strictEqual(typeof setQueueVisibility, 'function');

const routes = require('../modules/settings/routes/settings.routes');
assert.ok(routes, 'settings routes load');
console.log('queue-visibility OK');
