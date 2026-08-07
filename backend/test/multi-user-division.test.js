const assert = require('assert');
const { pickLowestLoad, resolveAssignee, taskGenerator } = require('../modules/tasks/generator/task-generator.service');

const members = [{ _id: 'a', name: 'A' }, { _id: 'b', name: 'B' }, { _id: 'c', name: 'C' }];
const loadMap = new Map([['a', 5], ['b', 0], ['c', 1]]);
assert.strictEqual(pickLowestLoad(members, loadMap).name, 'B');
const loadMap2 = new Map([['a', 2], ['c', 1]]);
assert.strictEqual(pickLowestLoad(members, loadMap2).name, 'B');
assert.strictEqual(pickLowestLoad([{ _id: 'x' }], new Map())._id, 'x');

assert.strictEqual(typeof resolveAssignee, 'function');
assert.strictEqual(typeof taskGenerator.generateFromOrder, 'function');

require('../modules/tasks/routes/task.routes');
require('../modules/rules/routes/rule.routes');
require('../modules/rules/validation/rule.schema');
console.log('multi-user-division OK');
