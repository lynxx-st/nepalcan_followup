const { Task } = require('../../../database/models');
const {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  assignTaskSchema,
  listTasksSchema,
} = require('../validation/task.schema');
const taskService = require('../service/task.service');

async function createTask(req, res, next) {
  try {
    const task = await taskService.createTask(req.validatedBody);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

async function getTaskById(req, res, next) {
  try {
    const task = await taskService.getTaskWithTimeline(req.params.id);
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

async function addNote(req, res, next) {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Note content is required' },
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found' },
      });
    }

    task.notes.push({
      actor: req.user?.userId ? 'staff' : 'system',
      note: note.trim(),
    });

    await task.save();

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

async function listTasks(req, res, next) {
  try {
    const { error, value } = listTasksSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { message: error.details.map((d) => d.message) },
      });
    }

    const result = await taskService.listTasks({
      ...value,
      assigneeId: req.user?.userId || value.assigneeId,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function assignTask(req, res, next) {
  try {
    const updated = await taskService.assignTask(req.params.id, req.validatedBody);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

async function completeTask(req, res, next) {
  try {
    const updated = await taskService.completeTask(req.params.id, {
      ...req.validatedBody,
      completedBy: req.user?.userId,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

async function skipTask(req, res, next) {
  try {
    const updated = await taskService.skipTask(req.params.id, {
      ...req.body,
      skippedBy: req.user?.name || req.user?.userId || 'staff',
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const updated = await taskService.updateTask(req.params.id, req.validatedBody);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    await taskService.deleteTask(req.params.id);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
}

async function getNextTask(req, res, next) {
  try {
    const task = await taskService.getNextTask(req.user?.userId);
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
}

async function scheduleTask(req, res, next) {
  try {
    const { scheduledDate } = req.body;
    if (!scheduledDate) return res.status(400).json({ success: false, error: { message: 'scheduledDate is required' } });
    const newTask = await taskService.scheduleTask(req.params.id, scheduledDate, req.user?.userId || 'staff');
    res.json({ success: true, data: newTask });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTask,
  getTaskById,
  addNote,
  listTasks,
  assignTask,
  completeTask,
  skipTask,
  updateTask,
  deleteTask,
  getNextTask,
  scheduleTask,
};