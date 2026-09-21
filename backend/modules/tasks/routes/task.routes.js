const express = require('express');
const router = express.Router();
const taskController = require('../controller/task.controller');
const { authenticate } = require('../../../src/middleware/auth');
const { validate } = require('../../../src/middleware/validate');
const workspace = require('../../workspace/service');
router.use(authenticate);
router.use(async (req,res,next) => {
  try {
    const isManager = workspace.manager(req.user);
    if (!isManager && ((req.method === 'POST' && req.path === '/') || req.method === 'DELETE' || (req.method === 'PUT' && (req.path.endsWith('/assign') || /^\/[^/]+$/.test(req.path))))) return res.status(403).json({success:false,error:{message:'Manager access required'}});
    const match = req.path.match(/^\/([a-f0-9]{24})(?:\/|$)/i);
    if (match) await workspace.owned(match[1],req.user);
    next();
  } catch(e) { res.status(e.statusCode || 500).json({success:false,error:{message:e.message}}); }
});


router.post('/', validate(require('../validation/task.schema').createTaskSchema), taskController.createTask);
router.get('/next', taskController.getNextTask);
router.get('/next-advanced', taskController.getNextAdvanced);
router.get('/today-summary', taskController.listTasks);
router.get('/assigned-to-me', taskController.getAssignedToMe);
router.get('/workload', taskController.getWorkload);
router.get('/by-order/:orderId', taskController.getTasksByOrder);
router.get('/:id', taskController.getTaskById);
router.post('/:id/notes', taskController.addNote);
router.get('/', taskController.listTasks);
router.put('/:id/schedule', taskController.scheduleTask);
router.put('/:id/assign', validate(require('../validation/task.schema').assignTaskSchema), taskController.assignTask);
router.put('/:id/complete', validate(require('../validation/task.schema').completeTaskSchema), taskController.completeTask);
router.put('/:id/skip', taskController.skipTask);
router.put('/:id', validate(require('../validation/task.schema').updateTaskSchema), taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;