const W = require('./work-window');
const crypto = require("crypto");
const {
  Task,
  Admin,
  CallLog,
  CommerceOrder,
  OrderReturn,
  UserAttendance,
  Setting,
  mongoose,
} = require("../../database/models");
const E = require("./engine");
const manager = (user) =>
  ["super-admin", "admin", "manager"].includes(user.role);
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), {
    statusCode: status,
    isOperational: true,
  });
};
const actorId = (user) => E.id(user.userId || user.sub || user.id);
const activeQuery = { status: { $in: E.WORK }, closedAt: null };
function scope(user) {
  return manager(user)
    ? user.role === "manager"
      ? { "metadata.team": user.team || "__no_team__" }
      : {}
    : { assigneeId: actorId(user) };
}
async function owned(taskId, user) {
  if (!mongoose.isValidObjectId(taskId)) fail("Task not found", 404);
  const task = await Task.findOne({ _id: taskId, ...scope(user) }).lean();
  if (!task) fail("Task not found or not assigned to you", 404);
  if (!(await Task.exists(W.and({ _id: task._id }, await W.taskFilter()))))
    fail("This task is outside the workspace start date. Refresh your tasks.", 409);
  if (task.metadata?.returnId && E.WORK.includes(task.status)) {
    const returned = await OrderReturn.findOne({
      externalReturnId: task.metadata.returnId,
    }).lean();
    if (
      returned &&
      (/delivered/i.test(returned.status || "") ||
        returned.workflowStage === "completed")
    )
      fail("This return is already closed. Refresh your tasks.", 409);
  }
  if (E.WORK.includes(task.status) && !task.metadata?.returnId) {
    const order = await CommerceOrder.findOne({
      commerceOrderId: String(task.sourceOrder?.orderId || task.orderId),
    }).lean();
    if (order && !taskFitsOrder(task, order))
      fail("The portal has moved this order forward. Refresh your tasks.", 409);
  }
  return task;
}
function taskFitsOrder(task, order) {
  const { commerceSync } = require("../commerce/service/commerce.sync.service");
  const stage = commerceSync.computeWorkflowStage(order);
  if (
    [
      "cancelled",
      "returned",
      "reviewed",
      "collected_by_logistics",
      "shipped",
    ].includes(stage)
  )
    return false;
  if (task.type === "order-check") return stage === "collected_by_logistics";
  if (task.type === "escalation")
    return ["pending_confirmation", "done", "hold", "rescheduled"].includes(
      stage,
    );
  const expected = commerceSync.getTaskTypeForStage(stage, order);
  return (
    task.type === expected ||
    (expected === "vendor-call" && task.type === "vendor-delay")
  );
}
async function reconcileOrderStages(orderKeys) {
  const { commerceSync } = require("../commerce/service/commerce.sync.service");
  await commerceSync.loadSettings();
  const active = await Task.find({
    ...activeQuery,
    "metadata.returnId": { $exists: false },
  }).lean();
  const orders = await CommerceOrder.find(
    orderKeys ? { commerceOrderId: { $in: orderKeys } } : {},
  ).lean();
  for (const order of orders) {
    const stage = commerceSync.computeWorkflowStage(order);
    if (order.workflowStage !== stage)
      await CommerceOrder.updateOne(
        { _id: order._id },
        { $set: { workflowStage: stage } },
      );
    const obsolete = active.filter(
      (t) =>
        String(t.sourceOrder?.orderId || t.orderId) === order.commerceOrderId &&
        !taskFitsOrder(t, order),
    );
    if (!obsolete.length && order.workflowStage === stage) continue;
    await Task.updateMany(
      { _id: { $in: obsolete.map((t) => t._id) }, ...activeQuery },
      {
        $set: {
          status: "skipped",
          closedAt: new Date(),
          closedReason: `Portal advanced to ${order.commerce?.orderStatus || stage}`,
          activeUntil: null,
        },
      },
    );
    const next = commerceSync.getPriorityForOrder(order);
    if (!next) continue;
    if (
      await Task.exists({
        "sourceOrder.orderId": order.commerceOrderId,
        type: next.taskType,
        status: { $in: [...E.WORK, "completed"] },
        closedAt: null,
      })
    )
      continue;
    await ensureTask(
      `lifecycle:${order.commerceOrderId}:${stage}:${obsolete[0]?._id || "stage"}`,
      {
        type: next.taskType,
        priority: next.priority,
        reason:
          stage === "pending_review"
            ? "Order delivered. Ask the customer for a review."
            : `Order is ${order.commerce?.orderStatus || stage}. Follow up on the current order stage.`,
        sourceOrder: {
          orderId: order.commerceOrderId,
          orderNumber: order.orderId,
        },
        slaMinutes: next.slaMinutes,
        dueAt: new Date(Date.now() + next.slaMinutes * 60000),
        assigneeId: obsolete[0]?.assigneeId,
        assigneeName: obsolete[0]?.assigneeName,
        assignedAt: new Date(),
        metadata: { team: obsolete[0]?.metadata?.team },
      },
    );
  }
}
async function refreshContact(taskId, user) {
  const task = await owned(taskId, user);
  const key = String(task.sourceOrder?.orderId || task.orderId || "");
  if (!/^[a-f0-9]{24}$/i.test(key))
    fail("This task has no linked portal order");
  const client = await import("./commerce-client.mjs");
  const detail = await client.commerce(`/marketplace-orders/${key}`);
  const c = client.normalizeContacts(detail.data || detail, key);
  const fields = { contactCheckedAt: new Date() };
  const source = detail.data || detail;
  if (Array.isArray(source.items) && source.items.length)
    fields["commerce.items"] = source.items;
  for (const key of ["totalAmount", "shippingAmount", "paymentMethod"]) {
    if (source[key] !== undefined && source[key] !== null)
      fields[`commerce.${key}`] = source[key];
  }
  if (c.customerPhone) fields["customer.phone"] = c.customerPhone;
  if (c.vendorPhone) fields["vendor.phone"] = c.vendorPhone;
  await CommerceOrder.updateOne({ commerceOrderId: key }, { $set: fields });
  await OrderReturn.updateMany(
    { commerceOrderId: key },
    {
      $set: {
        ...(c.customerPhone
          ? {
              customerPhone: c.customerPhone,
              "customerProfile.phone": c.customerPhone,
            }
          : {}),
        ...(c.vendorPhone ? { "vendor.phone": c.vendorPhone } : {}),
      },
    },
  );
  await Task.updateMany(
    { "sourceOrder.orderId": key },
    {
      $set: {
        ...(c.customerPhone ? { customerPhone: c.customerPhone } : {}),
        ...(c.vendorPhone ? { vendorPhone: c.vendorPhone } : {}),
      },
    },
  );
  return c;
}
async function lease(name, action) {
  const collection = mongoose.connection.collection("workspace_locks"),
    token = crypto.randomUUID(),
    now = new Date();
  try {
    const result = await collection.findOneAndUpdate(
      {
        _id: name,
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      { $set: { token, expiresAt: new Date(+now + 120000) } },
      { upsert: true, returnDocument: "after" },
    );
    if ((result?.value || result)?.token !== token)
      fail("Another update is running. Retry shortly.", 409);
  } catch (error) {
    if (error.code === 11000)
      fail("Another update is running. Retry shortly.", 409);
    throw error;
  }
  const heartbeat = setInterval(
    () =>
      collection
        .updateOne(
          { _id: name, token },
          { $set: { expiresAt: new Date(Date.now() + 120000) } },
        )
        .catch(() => {}),
    20000,
  );
  try {
    return await action();
  } finally {
    clearInterval(heartbeat);
    await collection.deleteOne({ _id: name, token });
  }
}
async function options() {
  const row = await Setting.findOne({ key: "workspace" }).lean();
  return {
    graceMinutes: 30,
    retryMinutes: 120,
    requireCheckIn: true,
    ...(row?.value || {}),
  };
}
async function rebalanceUnlocked() {
  await reconcile();
  const now = new Date(),
    [tasks, members, shifts, settings] = await Promise.all([
      Task.find(W.and(activeQuery, await W.taskFilter())).lean(),
      Admin.find({ isActive: true, deletedAt: null }).lean(),
      UserAttendance.find({
        status: "checked-in",
        checkInTime: { $gte: new Date(Date.now() - 16 * 3600000) },
      }).lean(),
      options(),
    ]);
  const keys = [
    ...new Set(
      tasks
        .map((t) => String(t.sourceOrder?.orderId || t.orderId || ""))
        .filter(Boolean),
    ),
  ];
  const orders = await CommerceOrder.find({
    commerceOrderId: { $in: keys },
  }).lean();
  const byOrder = new Map(orders.map((o) => [String(o.commerceOrderId), o]));
  const updates = [];
  for (const task of tasks) {
    const order = byOrder.get(
      String(task.sourceOrder?.orderId || task.orderId),
    );
    if (order) {
      const status = String(
        order.commerce?.orderStatus || order.orderStatus || "",
      ).toLowerCase();
      if (
        !task.metadata?.returnId &&
        (["cancelled", "return delivered"].includes(status) ||
          (status === "delivered" && task.type !== "review-call"))
      ) {
        updates.push({
          updateOne: {
            filter: { _id: task._id, ...activeQuery },
            update: {
              $set: {
                closedAt: now,
                closedReason: "Portal order closed",
                status: "skipped",
              },
            },
          },
        });
        task.status = "skipped";
        continue;
      }
      const vendor = order.vendor || {};
      const key = String(
        vendor.info?._id ||
          vendor._id ||
          order.commerce?.vendor?._id ||
          vendor.phone ||
          vendor.name ||
          "",
      )
        .trim()
        .toLowerCase();
      if (key && key !== task.vendorKey) {
        task.vendorKey = key;
        updates.push({
          updateOne: {
            filter: { _id: task._id },
            update: { $set: { vendorKey: key } },
          },
        });
      }
    }
  }
  if (updates.length) await Task.bulkWrite(updates);
  const completed = await Task.aggregate([
    { $match: { status: "completed", completedBy: { $ne: null } } },
    { $group: { _id: "$completedBy", count: { $sum: 1 } } },
  ]);
  const worked = await Task.find({
    "attempts.at": { $gte: new Date(`${E.dateKey(now)}T00:00:00+05:45`) },
  })
    .select("attempts")
    .lean();
  const conversations = [
    ...new Map(
      worked
        .flatMap((t) => t.attempts || [])
        .filter((a) => E.dateKey(a.at) === E.dateKey(now))
        .map((a) => [a.callSessionId || a.requestId, a]),
    ).values(),
  ];
  members.forEach((m) => {
    m.checkedIn = shifts.some((s) => E.id(s.userId) === E.id(m));
    m.completedCount =
      completed.find((c) => E.id(c._id) === E.id(m))?.count || 0;
    m.workToday = conversations
      .filter((a) => a.actorId === E.id(m))
      .reduce(
        (sum, a) =>
          sum +
          (["no-answer", "wrong-number"].includes(a.outcome) ? 0.25 : 0.5) +
          Math.min(2, (a.durationMinutes || 0) / 30),
        0,
      );
  });
  const changes = E.allocate(tasks, members, now, settings);
  for (const change of changes)
    await Task.updateOne(
      {
        _id: change.taskId,
        ...activeQuery,
        assigneeId: change.previous || null,
      },
      {
        $set: {
          assigneeId: change.assigneeId,
          assigneeName: change.assigneeName,
          assignedAt: now,
          startedAt: null,
          activeUntil: null,
          "metadata.team":
            members.find((m) => E.id(m) === change.assigneeId)?.team || null,
        },
        $push: { assignmentHistory: { ...change, at: now } },
      },
    );
  return {
    changed: changes.length,
    unassigned: await Task.countDocuments(W.and({ ...activeQuery, assigneeId: null }, await W.taskFilter())),
  };
}
const rebalance = () => lease("assignments", rebalanceUnlocked);
async function queue(user, team = false) {
  if (team && !manager(user)) fail("Manager access required", 403);
  // Sync/assignment reconciliation repairs stages. A read must not scan and mutate
  // every order before returning the employee's queue.
  const tasks = await Task.find({
    $and: [await W.taskFilter()],
    ...(team ? scope(user) : { assigneeId: actorId(user) }),
    $or: [
      { ...activeQuery },
      {
        status: "completed",
        completedAt: { $gte: new Date(Date.now() - 7 * 86400000) },
      },
    ],
  })
    .sort({ dueAt: 1 })
    .limit(2000)
    .lean();
  const keys = [
    ...new Set(
      tasks
        .map((t) => String(t.sourceOrder?.orderId || t.orderId || ""))
        .filter(Boolean),
    ),
  ];
  const orders = await CommerceOrder.find({
    commerceOrderId: { $in: keys },
  }).lean();
  const returns = await OrderReturn.find({
    externalReturnId: {
      $in: tasks.map((t) => t.metadata?.returnId).filter(Boolean),
    },
  }).lean();
  const map = new Map(orders.map((o) => [String(o.commerceOrderId), o]));
  const { decodePhone } = await import("./commerce-client.mjs");
  return tasks
    .filter(t => {
      if (!E.WORK.includes(t.status)) return true;
      if (t.metadata?.returnId) {
        const returned = returns.find(r => r.externalReturnId === t.metadata.returnId);
        return !returned || (!/delivered/i.test(returned.status || "") && returned.workflowStage !== "completed");
      }
      const order = map.get(String(t.sourceOrder?.orderId || t.orderId));
      return !order || taskFitsOrder(t, order);
    })
    .map((t) => {
      const returned = returns.find(
        (r) => r.externalReturnId === t.metadata?.returnId,
      );
      const order = returned
        ? {
            ...map.get(returned.commerceOrderId),
            ...returned,
            commerce: map.get(returned.commerceOrderId)?.commerce,
            customer: {
              ...returned.customerProfile,
              phone:
                decodePhone(
                  returned.customerPhone || returned.customerProfile?.phone,
                ) || map.get(returned.commerceOrderId)?.customer?.phone,
            },
            vendor: {
              ...returned.vendor,
              phone:
                decodePhone(returned.vendor?.phone) ||
                map.get(returned.commerceOrderId)?.vendor?.phone,
            },
            orderStatus: returned.status,
          }
        : map.get(String(t.sourceOrder?.orderId || t.orderId));
      return {
        ...t,
        order: order
          ? {
              commerceOrderId: order.commerceOrderId,
              orderId: order.orderId,
              customer: order.customer,
              customerProfile: order.customerProfile,
              vendor: order.vendor,
              workflowStage: returned
                ? returned.workflowStage
                : require("../commerce/service/commerce.sync.service").commerceSync.computeWorkflowStage(
                    order,
                  ),
              followUpOrder: returned?.followUpOrder,
              orderStatus: returned ? returned.status : order.commerce?.orderStatus || order.orderStatus,
              amount: order.commerce?.totalAmount ?? order.totalAmount,
              paymentMethod:
                order.commerce?.paymentMethod || order.paymentMethod,
              shippingAmount:
                order.commerce?.shippingAmount ?? order.shippingAmount,
              items: order.commerce?.items || order.items,
            }
          : null,
        score: E.rank(t),
        groupKey: E.groupKey(t),
      };
    })
    .sort((a, b) => b.score - a.score);
}
const OUTCOMES = [
  "customer-confirmed",
  "vendor-accepted",
  "vendor-rejected",
  "vendor-delayed",
  "no-answer",
  "wrong-number",
  "call-later",
  "requested-tomorrow",
  "review-collected",
  "return-customer-confirmed",
  "return-customer-rejected",
  "return-vendor-accepted",
  "return-vendor-rejected",
  "resolved",
  "recovered",
  "lost",
  "other",
];
async function recordOutcome(taskId, input, user) {
  const {
    outcome,
    notes = "",
    requestId,
    nextAttemptAt,
    durationMinutes = 0,
  } = input;
  if (!OUTCOMES.includes(outcome) || !/^[\w-]{16,100}$/.test(requestId || ""))
    fail("Select an outcome and supply a request ID");
  if (
    typeof notes !== "string" ||
    notes.length > 10000 ||
    !Number.isFinite(Number(durationMinutes)) ||
    Number(durationMinutes) < 0 ||
    Number(durationMinutes) > 480
  )
    fail("Check the notes and call duration");
  return lease("assignments", async () => {
    const task = await owned(taskId, user);
    const returned = task.metadata?.returnId
      ? await OrderReturn.findOne({
          externalReturnId: task.metadata.returnId,
        }).lean()
      : null;
    const repeated = task.attempts?.some((a) => a.requestId === requestId);
    if (outcome.startsWith("return-") && !repeated) {
      if (!returned) fail("This is not a return task");
      const stage =
        require("../commerce/controller/commerce.controller").computeReturnStage(
          returned,
        );
      if (
        (outcome.startsWith("return-vendor-")
          ? "vendor_response"
          : "customer_response") !== stage
      )
        fail(
          "The return has moved to another response stage. Refresh your tasks.",
        );
    }
    if (returned && outcome === "resolved")
      fail("Record the customer or vendor response for this return");

    if ((!E.WORK.includes(task.status) || task.closedAt) && !repeated)
      fail("This task is already closed", 409);
    const employee = await Admin.findById(actorId(user)).lean();
    if (employee && E.profile(employee).noCalls && task.type !== "order-check")
      fail("No calling tasks on the first onboarding day");
    if (outcome === "review-collected" && !notes.trim())
      fail("Enter the customer review");
    if (task.type === "order-check" && outcome !== "resolved")
      fail("Complete the order check without a call outcome");
    if (
      outcome.startsWith("vendor-") &&
      !["vendor-call", "vendor-delay"].includes(task.type)
    )
      fail("This is not a vendor task");
    if (outcome === "review-collected" && task.type !== "review-call")
      fail("This is not a review task");
    if (
      outcome === "customer-confirmed" &&
      task.type !== "customer-confirmation"
    )
      fail("This is not a customer confirmation task");
    if (
      outcome === "resolved" &&
      [
        "customer-confirmation",
        "review-call",
        "vendor-call",
        "vendor-delay",
      ].includes(task.type)
    )
      fail("Select the specific result for this task");
    const settings = await options(),
      now = new Date();
    const waiting = [
      "no-answer",
      "call-later",
      "requested-tomorrow",
      "vendor-delayed",
      "wrong-number",
      "other",
    ].includes(outcome);
    let next = waiting
      ? new Date(nextAttemptAt || +now + settings.retryMinutes * 60000)
      : null;
    if (
      ["call-later", "requested-tomorrow", "vendor-delayed"].includes(
        outcome,
      ) &&
      !nextAttemptAt
    )
      fail("Choose the agreed follow-up time");
    if (next && (!Number.isFinite(+next) || next <= now))
      fail("Follow-up must be in the future");
    const batch =
      input.applyToGroup &&
      task.vendorKey &&
      ["vendor-call", "vendor-delay"].includes(task.type) &&
      ["no-answer", "call-later", "vendor-delayed", "wrong-number"].includes(
        outcome,
      );
    const group = batch
      ? await Task.find({
          $and: [await W.taskFilter()],
          vendorKey: task.vendorKey,
          type: { $in: ["vendor-call", "vendor-delay"] },
          assigneeId: task.assigneeId,
          ...activeQuery,
        }).lean()
      : [task];
    let updated = task;
    const callSessionId =
      new Date(task.activeUntil || 0) > now && task.callSessionId
        ? task.callSessionId
        : requestId;
    for (const item of group) {
      const itemRequestId =
        E.id(item) === E.id(task) ? requestId : `${requestId}-${E.id(item)}`;
      if (item.attempts?.some((a) => a.requestId === itemRequestId)) continue;
      const attempt = {
        requestId: itemRequestId,
        callSessionId,
        outcome,
        notes: notes.trim(),
        durationMinutes: Number(durationMinutes),
        at: now,
        actorId: actorId(user),
        actorName: user.name || "Employee",
        nextAttemptAt: next,
        isCall: task.type !== "order-check",
        contactParty: returned
          ? outcome.startsWith("return-vendor-") ||
            returned.workflowStage === "vendor_response"
            ? "vendor"
            : "customer"
          : ["logistics-followup", "escalation"].includes(task.type) &&
              ["vendor", "customer"].includes(input.contactParty)
            ? input.contactParty
            : ["vendor-call", "vendor-delay"].includes(task.type)
              ? "vendor"
              : "customer",
      };
      const saved = await Task.findOneAndUpdate(
        {
          _id: item._id,
          status: item.status,
          "attempts.requestId": { $ne: itemRequestId },
        },
        {
          $push: { attempts: attempt },
          $set: {
            status: waiting ? "pending" : "completed",
            nextAttemptAt: next,
            activeUntil: null,
            completedAt: waiting ? null : now,
            completedBy: waiting ? null : actorId(user),
            "metadata.projected": false,
          },
        },
        { new: true },
      );
      if (!saved) fail("Task changed. Refresh and retry.", 409);
      if (E.id(item) === E.id(task)) updated = saved;
    }

    // Reconciliation is retryable: the saved attempt is the source of truth.
    await reconcile().catch((error) =>
      console.error("Follow-up reconciliation pending:", error.message),
    );
    return updated;
  });
}
async function start(taskId, user) {
  return lease("assignments", async () => {
    const task = await owned(taskId, user);
    if (!E.WORK.includes(task.status) || task.closedAt)
      fail("This task is closed");
    const now = new Date();
    if (task.nextAttemptAt && new Date(task.nextAttemptAt) > now)
      fail("This follow-up is scheduled for later");
    const employee = await Admin.findById(actorId(user)).lean();
    if (!employee || !E.eligible(employee, task, now))
      fail("You are not available for this task");
    const query = E.groupKey(task).startsWith("vendor:")
      ? {
          vendorKey: task.vendorKey,
          type: { $in: ["vendor-call", "vendor-delay"] },
          assigneeId: task.assigneeId,
          ...activeQuery,
        }
      : { _id: taskId };
    query.$and = [await W.taskFilter()];
    const callSessionId = crypto.randomUUID();
    await Task.updateMany(query, {
      $set: {
        startedAt: now,
        activeUntil: new Date(+now + 20 * 60000),
        callSessionId,
        status: "in-progress",
      },
    });
    return Task.findById(taskId);
  });
}
async function assign(taskId, assigneeId, user) {
  if (!manager(user)) fail("Manager access required", 403);
  return lease("assignments", async () => {
    const task = await owned(taskId, user),
      employee = await Admin.findById(assigneeId).lean();
    const query = E.groupKey(task).startsWith("vendor:")
      ? {
          vendorKey: task.vendorKey,
          type: { $in: ["vendor-call", "vendor-delay"] },
          ...activeQuery,
        }
      : { _id: taskId, ...activeQuery };
    query.$and = [await W.taskFilter()];
    const group = await Task.find(query).lean();
    if (
      !employee ||
      !group.length ||
      !group.every((t) => E.eligible(employee, t, new Date())) ||
      (user.role === "manager" && employee.team !== user.team)
    )
      fail("Employee is not eligible for this group");
    if (group.some((t) => new Date(t.activeUntil || 0) > new Date()))
      fail("A call is in progress. Wait until it finishes.", 409);
    const now = new Date();
    return Task.updateMany(query, {
      $set: {
        assigneeId,
        assigneeName: employee.name,
        manualAssignment: true,
        assignedAt: now,
      },
      $push: {
        assignmentHistory: {
          at: now,
          assigneeId,
          actorId: actorId(user),
          reason: "Manager transferred this vendor group or task",
        },
      },
    });
  });
}
async function reports(user) {
  const members = await Admin.find(
    user.role === "manager" ? { team: user.team || "__no_team__" } : {},
  )
    .select("-passwordHash")
    .lean();
  const visibleIds = new Set((await Task.find(W.and(scope(user), await W.taskFilter())).select("_id").lean()).map(t => String(t._id)));
  const tasks = await Task.find(scope(user))
    .select(
      "assigneeId status attempts completedBy completedAt assignedAt createdAt dueAt nextAttemptAt",
    )
    .lean();
  const cutoff = Date.now() - 30 * 86400000;
  return members.map((m) => {
    const completed = tasks.filter(
      (t) => t.status === "completed" && E.id(t.completedBy) === E.id(m),
    );
    const records = tasks
      .flatMap((t) => t.attempts || [])
      .filter(
        (a) =>
          a.actorId === E.id(m) &&
          +new Date(a.at) >= cutoff &&
          a.isCall !== false,
      );
    const attempts = [
      ...new Map(
        records.map((a) => [a.callSessionId || a.requestId, a]),
      ).values(),
    ];
    const connected = attempts.filter(
      (a) => !["no-answer", "wrong-number"].includes(a.outcome),
    ).length;
    const p = E.profile(m, new Date(), completed.length);
    const leadTimes = completed
      .filter((t) => +new Date(t.completedAt) >= cutoff && t.assignedAt)
      .map((t) =>
        Math.max(0, (new Date(t.completedAt) - new Date(t.assignedAt)) / 60000),
      )
      .sort((a, b) => a - b);
    const medianResolutionMinutes = leadTimes.length
      ? Math.round(leadTimes[Math.floor(leadTimes.length / 2)])
      : null;
    return {
      ...m,
      id: E.id(m),
      ...p,
      medianResolutionMinutes,
      open: tasks.filter(
        (t) => visibleIds.has(String(t._id)) && E.WORK.includes(t.status) && E.id(t.assigneeId) === E.id(m),
      ).length,
      completed: completed.filter((t) => +new Date(t.completedAt) >= cutoff)
        .length,
      calls: attempts.length,
      connected,
      connectionRate: attempts.length
        ? Math.round((connected / attempts.length) * 100)
        : null,
      handlingMinutes: attempts.reduce(
        (sum, a) => sum + (a.durationMinutes || 0),
        0,
      ),
      overdue: tasks.filter(
        (t) =>
          visibleIds.has(String(t._id)) &&
          E.WORK.includes(t.status) &&
          E.id(t.assigneeId) === E.id(m) &&
          new Date(t.nextAttemptAt || t.dueAt) < new Date(),
      ).length,
    };
  });
}
async function ensureTask(key, data) {
  if (await Task.exists({ automationKey: key })) return;
  try {
    await Task.create({ ...data, automationKey: key });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}
async function reconcile() {
  const unprojected = await Task.find({
    "attempts.0": { $exists: true },
    $expr: {
      $gt: [
        { $size: { $ifNull: ["$attempts", []] } },
        { $ifNull: ["$metadata.projectedAttempts", 0] },
      ],
    },
  }).lean();
  for (const task of unprojected) {
    for (const a of task.attempts) {
      if (a.isCall === false) continue;
      const orderId = task.sourceOrder?.orderId || task.orderId;
      await CallLog.updateOne(
        { requestId: a.callSessionId || a.requestId },
        {
          $setOnInsert: {
            taskId: task._id,
            ...(mongoose.isValidObjectId(orderId) ? { orderId } : {}),
            assignedTo: a.actorId,
            outcome: a.outcome,
            notes: a.notes,
            durationMinutes: a.durationMinutes,
            createdAt: new Date(a.at),
          },
        },
        { upsert: true },
      );
    }
    await Task.updateOne(
      { _id: task._id },
      { $set: { "metadata.projectedAttempts": task.attempts.length } },
    );
  }
  const pending = await Task.find({
    status: "completed",
    "attempts.0": { $exists: true },
    "metadata.projected": { $ne: true },
  }).lean();
  for (const task of pending) {
    const a = task.attempts.at(-1),
      orderId = task.sourceOrder?.orderId || task.orderId;
    const update =
      a.outcome === "customer-confirmed"
        ? { "customer.confirmationStatus": "confirmed" }
        : a.outcome === "vendor-accepted"
          ? { "vendor.vendorStatus": "accepted" }
          : a.outcome === "review-collected"
            ? { review: { text: a.notes }, workflowStage: "reviewed" }
            : {};
    if (Object.keys(update).length)
      await CommerceOrder.updateOne(
        { commerceOrderId: orderId },
        { $set: update },
      );
    if (
      ["customer-confirmed", "vendor-accepted", "vendor-rejected"].includes(
        a.outcome,
      )
    ) {
      const {
        commerceSync,
      } = require("../commerce/service/commerce.sync.service");
      await commerceSync.loadSettings();
      const order = await CommerceOrder.findOne({
        commerceOrderId: orderId,
      }).lean();
      const next = order && commerceSync.getPriorityForOrder(order);
      const type =
        a.outcome === "vendor-rejected" ? "escalation" : next?.taskType;
      if (order)
        await CommerceOrder.updateOne(
          { _id: order._id },
          { $set: { workflowStage: commerceSync.computeWorkflowStage(order) } },
        );
      if (
        type &&
        !(await Task.exists({
          "sourceOrder.orderId": orderId,
          type,
          status: { $in: [...E.WORK, "completed"] },
          closedAt: null,
        }))
      )
        await ensureTask(`${type}:${task._id}`, {
          type,
          priority: type === "escalation" ? "critical" : "medium",
          reason:
            type === "escalation"
              ? "Vendor cannot supply this order. Find an alternative or contact the customer."
              : type === "customer-confirmation"
                ? "Vendor confirmed stock. Confirm the order with the customer."
                : type === "vendor-call"
                  ? "Customer confirmed. Check stock and dispatch with the vendor."
                  : "Customer and vendor confirmed. Follow up on pickup and dispatch.",
          sourceOrder: task.sourceOrder,
          vendorPhone: task.vendorPhone,
          customerPhone: task.customerPhone,
          vendorKey: task.vendorKey,
          slaMinutes: 120,
          dueAt: new Date(Date.now() + 120 * 60000),
          metadata: { team: task.metadata?.team },
        });
    }
    if (task.metadata?.returnId) {
      const returned = await OrderReturn.findOne({
        externalReturnId: task.metadata.returnId,
      }).lean();
      if (returned && a.outcome.startsWith("return-")) {
        const response = a.outcome.startsWith("return-customer-")
          ? {
              customerResponseStatus: a.outcome.endsWith("confirmed")
                ? "confirmed"
                : "rejected",
            }
          : {
              vendorResponseStatus: a.outcome.endsWith("accepted")
                ? "accepted"
                : "rejected",
            };
        const stage =
          require("../commerce/controller/commerce.controller").computeReturnStage(
            { ...returned, ...response },
          );
        await OrderReturn.updateOne(
          { _id: returned._id },
          { $set: { ...response, workflowStage: stage } },
        );
        if (stage !== "completed")
          await Task.updateOne(
            { _id: task._id },
            {
              $set: {
                status: "pending",
                completedAt: null,
                completedBy: null,
                "metadata.returnStage": stage,
                reason:
                  "Customer confirmed the return. Contact the vendor for their response.",
                dueAt: new Date(Date.now() + 120 * 60000),
              },
            },
          );
      }
    }
    await Task.updateOne(
      { _id: task._id },
      { $set: { "metadata.projected": true } },
    );
  }
  await reconcileOrderStages();
  const returns = await OrderReturn.find({ isActive: { $ne: false } }).lean();
  for (const r of returns) {
    if (/delivered/i.test(r.status || "") || r.workflowStage === "completed") {
      await Task.updateMany(
        { "metadata.returnId": r.externalReturnId, ...activeQuery },
        {
          $set: {
            closedAt: new Date(),
            closedReason: "Return completed",
            status: "skipped",
          },
        },
      );
      continue;
    }
    await ensureTask(`return:${r.externalReturnId}`, {
      type: "return-followup",
      priority: "high",
      reason: r.returnReason || "Follow up on the return request",
      sourceOrder: { orderId: r.commerceOrderId, orderNumber: r.orderId },
      customerPhone: r.customerPhone,
      vendorPhone: r.vendor?.phone,
      slaMinutes: 120,
      metadata: { returnId: r.externalReturnId, returnStage: r.workflowStage },
    });
    await Task.updateMany(
      {
        "metadata.returnId": r.externalReturnId,
        status: { $in: ["completed", "skipped"] },
      },
      {
        $set: {
          status: "pending",
          closedAt: null,
          closedReason: null,
          completedAt: null,
          completedBy: null,
          dueAt: new Date(Date.now() + 120 * 60000),
          "metadata.returnStage": r.workflowStage,
          "metadata.projected": true,
        },
      },
    );
  }
}
module.exports = {
  manager,
  scope,
  owned,
  fail,
  actorId,
  lease,
  options,
  rebalance,
  rebalanceUnlocked,
  queue,
  recordOutcome,
  start,
  assign,
  reports,
  activeQuery,
  reconcile,
  reconcileOrderStages,
  refreshContact,
};
