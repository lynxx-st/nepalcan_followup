const W = require('../../workspace/work-window');
const { Task, Admin, CommerceOrder } = require('../../../database/models');
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
      assigneeId: ['super-admin','admin'].includes(req.userRole) ? value.assigneeId : req.userId,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function getAssignedToMe(req, res, next) {
  try {
    const result = await taskService.listTasks({
      assigneeId: req.userId,
      status: req.query.status,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      sortBy: req.query.sortBy || 'createdAt',
      sortDir: req.query.sortDir || 'desc',
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function getWorkload(req, res, next) {
  try {
    const [byAssignee, unassigned, admins] = await Promise.all([
      Task.aggregate([
        { $match: W.and({ status: { $in: ['pending', 'in-progress', 'overdue'] } }, await W.taskFilter()) },
        { $group: { _id: '$assigneeId', active: { $sum: 1 } } },
      ]),
      Task.countDocuments({
        $and: [await W.taskFilter()],
        status: { $in: ['pending', 'in-progress', 'overdue'] },
        assigneeId: null,
      }),
      Admin.find({ isActive: true, role: { $ne: 'super-admin' } })
        .select('name email team')
        .lean(),
    ]);

    const agents = [];
    for (const row of byAssignee) {
      const admin = admins.find((a) => String(a._id) === String(row._id));
      agents.push({
        assigneeId: row._id,
        name: admin ? admin.name || admin.email : 'Unknown',
        team: admin ? admin.team || '' : '',
        active: row.active,
      });
    }
    for (const admin of admins) {
      if (!agents.some((a) => String(a.assigneeId) === String(admin._id))) {
        agents.push({ assigneeId: admin._id, name: admin.name || admin.email, team: admin.team || '', active: 0 });
      }
    }
    agents.sort((a, b) => b.active - a.active);

    res.json({ success: true, data: { agents, unassigned } });
  } catch (error) {
    next(error);
  }
}

async function assignTask(req, res, next) {
  try {
    const updated = await require('../../workspace/service').assign(req.params.id, req.validatedBody.assigneeId, req.user);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

async function completeTask(req, res, next) {
  try {
    const updated = await require('../../workspace/service').recordOutcome(req.params.id, {
      ...req.validatedBody,
      requestId: require('crypto').randomUUID(), outcome: req.validatedBody.outcome || 'other',
    }, req.user);
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
    if (updated?.sourceOrder?.orderId) {
      const role = req.user?.role || 'staff';
      await CommerceOrder.updateOne(
        { commerceOrderId: updated.sourceOrder.orderId },
        {
          $push: {
            notes: {
              actor: role === 'admin' || role === 'super-admin' ? 'admin' : 'staff',
              actorName: req.user?.name || req.user?.email || 'staff',
              note: `Task skipped: ${req.body?.notes || updated.type || 'task'}`,
              createdAt: new Date(),
            },
          },
        }
      );
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    if (req.validatedBody.status || req.validatedBody.assigneeId) return res.status(400).json({success:false,error:{message:'Use the call outcome or transfer action to change task state or ownership'}});
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

async function getNextAdvanced(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 1, 200);
    const result = await taskService.getNextAdvanced((['super-admin','admin'].includes(req.userRole) ? req.query.assigneeId : null) || req.userId, limit);
    res.json({ success: true, data: result });
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

async function getTasksByOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    const { status } = req.query;
    const tasks = await Task.find({ $and: [await W.taskFilter()], 'sourceOrder.orderId':orderId, ...require('../../workspace/service').scope(req.user), ...(status ? {status} : {}) }).lean();
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTask,
  getTaskById,
  addNote,
  listTasks,
  getAssignedToMe,
  getWorkload,
  assignTask,
  completeTask,
  skipTask,
  updateTask,
  deleteTask,
  getNextTask,
  getNextAdvanced,
  scheduleTask,
  getTasksByOrder,
};