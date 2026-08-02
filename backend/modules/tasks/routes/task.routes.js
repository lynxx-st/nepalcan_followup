const express = require('express');
const router = express.Router();
const taskController = require('../controller/task.controller');
const { authenticate } = require('../../../src/middleware/auth');
const { validate } = require('../../../src/middleware/validate');

router.post('/', authenticate, validate(require('../validation/task.schema').createTaskSchema), taskController.createTask);
router.get('/next', authenticate, taskController.getNextTask);
router.get('/today-summary', authenticate, taskController.listTasks);
router.get('/by-order/:orderId', authenticate, taskController.getTasksByOrder);
router.get('/:id', authenticate, taskController.getTaskById);
router.post('/:id/notes', authenticate, taskController.addNote);
router.get('/', authenticate, taskController.listTasks);
router.put('/:id/schedule', authenticate, taskController.scheduleTask);
router.put('/:id/assign', authenticate, validate(require('../validation/task.schema').assignTaskSchema), taskController.assignTask);
router.put('/:id/complete', authenticate, validate(require('../validation/task.schema').completeTaskSchema), taskController.completeTask);
router.put('/:id/skip', authenticate, taskController.skipTask);
router.put('/:id', authenticate, validate(require('../validation/task.schema').updateTaskSchema), taskController.updateTask);
router.delete('/:id', authenticate, taskController.deleteTask);

module.exports = router;