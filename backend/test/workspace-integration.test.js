const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET = "integration-test-key-only";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/unused";
process.env.NODE_ENV = "test";
process.env.CRON_SECRET = "integration-cron-secret-at-least-24";
const { MongoMemoryServer } = require("mongodb-memory-server");
const {
  mongoose,
  Admin,
  Task,
  Setting,
  CommerceOrder,
  CallLog,
  OrderReturn,
} = require("../database/models");
const S = require("../modules/workspace/service");
const { app } = require("../server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
let mongo, server, base, a, b, admin, token;
before(
  async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all([Admin.init(), Task.init()]);
    const passwordHash = await bcrypt.hash("testing-password", 4);
    [a, b, admin] = await Admin.create([
      {
        username: "employee-a",
        name: "Employee A",
        passwordHash,
        isActive: true,
        profile: "casual",
        joinedOn: "2025-01-01",
        team: "Follow up",
      },
      {
        username: "employee-b",
        name: "Employee B",
        passwordHash,
        isActive: true,
        profile: "casual",
        joinedOn: "2025-01-01",
        team: "Follow up",
      },
      {
        username: "owner",
        name: "Owner",
        passwordHash,
        role: "super-admin",
        acceptsTasks: false,
      },
    ]);
    await Setting.create({
      key: "workspace",
      value: { requireCheckIn: false, graceMinutes: 30, retryMinutes: 120 },
    });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}`;
    token = jwt.sign(
      { sub: String(a._id), type: "admin", role: "staff" },
      process.env.JWT_SECRET,
    );
  },
  { timeout: 180000 },
);
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
const call = async (path, method = "GET", body, auth = token) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      authorization: `Bearer ${auth}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
};
const make = (extra) =>
  Task.create({
    type: "customer-confirmation",
    reason: "Verify customer order",
    assigneeId: a._id,
    assigneeName: a.name,
    priority: "medium",
    dueAt: new Date(Date.now() + 3600000),
    ...extra,
  });
test("outcomes cannot bypass the task's required workflow", async () => {
  for (const [type, outcome] of [
    ["review-call", "customer-confirmed"],
    ["vendor-call", "resolved"],
    ["customer-confirmation", "review-collected"],
  ]) {
    const task = await make({ type });
    const r = await call(
      `/api/v1/workspace/tasks/${task._id}/outcome`,
      "POST",
      {
        requestId: `invalid-outcome-${task._id}`,
        outcome,
        notes: "Test outcome",
      },
    );
    assert.equal(r.status, 400);
    assert.equal((await Task.findById(task._id)).attempts.length, 0);
  }
});
test("optional email accounts coexist and username login works", async () => {
  assert.equal(await Admin.countDocuments({ email: { $exists: false } }), 3);
  const r = await call("/api/v1/auth/login", "POST", {
    email: "employee-a",
    password: "testing-password",
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.data.token);
});
test("portal advancement retires stale confirmation and retains attempts", async () => {
  const key = String(new mongoose.Types.ObjectId());
  await CommerceOrder.create({
    commerceOrderId: key,
    orderId: "STAGE-TEST",
    commerce: { orderStatus: "Processing", paymentStatus: "Pending" },
    customer: { confirmationStatus: "pending", phone: "9800000001" },
  });
  const old = await make({
    sourceOrder: { orderId: key },
    attempts: [{ requestId: "past-attempt-for-stage", outcome: "no-answer" }],
  });
  await S.reconcileOrderStages();
  const retired = await Task.findById(old._id);
  assert.equal(retired.status, "skipped");
  assert.equal(retired.attempts.length, 1);
  const next = await Task.findOne({
    "sourceOrder.orderId": key,
    status: "pending",
  });
  assert.equal(next.type, "logistics-followup");
  await S.reconcileOrderStages();
  assert.equal(
    await Task.countDocuments({
      "sourceOrder.orderId": key,
      status: "pending",
    }),
    1,
  );
  await CommerceOrder.updateOne(
    { commerceOrderId: key },
    { $set: { "commerce.orderStatus": "Delivered" } },
  );
  await S.reconcileOrderStages();
  assert.equal(
    (await Task.findOne({ "sourceOrder.orderId": key, status: "pending" }))
      .type,
    "review-call",
  );
  await CommerceOrder.updateOne(
    { commerceOrderId: key },
    { $set: { review: { text: "Good delivery" } } },
  );
  await S.reconcileOrderStages();
  assert.equal(
    await Task.countDocuments({
      "sourceOrder.orderId": key,
      status: "pending",
    }),
    0,
  );
});
test("employees cannot read or change another employee task, including old API", async () => {
  const t = await make({ assigneeId: b._id });
  assert.equal(
    (await call(`/api/v1/workspace/tasks/${t._id}/start`, "POST", {})).status,
    404,
  );
  assert.equal((await call(`/api/v1/tasks/${t._id}`)).status, 404);
  assert.equal((await call("/api/v1/workspace/employees")).status, 403);
  assert.equal((await call("/api/v1/admin/reset", "POST", {})).status, 403);
});
test("no answer records one attempt and schedules retry without completing", async () => {
  const t = await make({}),
    body = {
      requestId: "attempt-idempotency-0001",
      outcome: "no-answer",
      notes: "Rang but no pickup",
      durationMinutes: 0.5,
    };
  const one = await call(
    `/api/v1/workspace/tasks/${t._id}/outcome`,
    "POST",
    body,
  );
  assert.equal(one.status, 200, JSON.stringify(one.body));
  const two = await call(
    `/api/v1/workspace/tasks/${t._id}/outcome`,
    "POST",
    body,
  );
  assert.equal(two.status, 200);
  const saved = await Task.findById(t._id);
  assert.equal(saved.attempts.length, 1);
  assert.equal(saved.status, "pending");
  assert.ok(saved.nextAttemptAt > new Date());
  assert.equal(saved.completedAt, null);
});
test("call-later requires a valid future callback time", async () => {
  const t = await make({});
  const r = await call(`/api/v1/workspace/tasks/${t._id}/outcome`, "POST", {
    requestId: "callback-request-001",
    outcome: "call-later",
  });
  assert.equal(r.status, 400);
  assert.equal((await Task.findById(t._id)).attempts.length, 0);
});
test("completed call creates the next vendor step and keeps the saved attempt", async () => {
  const order = await CommerceOrder.create({
    commerceOrderId: "test-order-one",
    orderId: "ORDER-ONE",
    customer: { name: "Test customer" },
    vendor: { name: "Test vendor" },
  });
  const t = await make({ sourceOrder: { orderId: order.commerceOrderId } });
  const r = await call(`/api/v1/workspace/tasks/${t._id}/outcome`, "POST", {
    requestId: "customer-confirmed-01",
    outcome: "customer-confirmed",
    durationMinutes: 2,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await Task.findById(t._id)).status, "completed");
  assert.equal(
    await Task.countDocuments({
      type: "vendor-call",
      "sourceOrder.orderId": order.commerceOrderId,
    }),
    1,
  );
  await S.reconcile();
  assert.equal(
    await Task.countDocuments({
      type: "vendor-call",
      "sourceOrder.orderId": order.commerceOrderId,
    }),
    1,
  );
});
test("persistent lease rejects a concurrent dispatcher", async () => {
  let unblock;
  const gate = new Promise((r) => {
    unblock = r;
  });
  let acquired;
  const ready = new Promise((r) => {
    acquired = r;
  });
  const first = S.lease("test-lock", async () => {
    acquired();
    await gate;
  });
  await ready;
  await assert.rejects(
    S.lease("test-lock", async () => {}),
    (e) => e.statusCode === 409,
  );
  unblock();
  await first;
});
test("expired and deactivated accounts cannot access the workspace", async () => {
  await Admin.updateOne({ _id: a._id }, { $set: { isActive: false } });
  assert.equal((await call("/api/v1/workspace/tasks")).status, 401);
  await Admin.updateOne({ _id: a._id }, { $set: { isActive: true } });
});
test("cron rejects missing credentials without starting commerce calls", async () => {
  assert.equal(
    (await call("/api/v1/workspace/cron", "POST", {}, "wrong")).status,
    401,
  );
});
test("one unanswered vendor call schedules the whole group and counts as one call", async () => {
  const group = await Promise.all([
    make({ type: "vendor-call", vendorKey: "batch-test" }),
    make({ type: "vendor-call", vendorKey: "batch-test" }),
  ]);
  const body = {
    requestId: "vendor-batch-request-0001",
    outcome: "no-answer",
    applyToGroup: true,
    durationMinutes: 1,
  };
  const path = `/api/v1/workspace/tasks/${group[0]._id}/outcome`;
  assert.equal((await call(path, "POST", body)).status, 200);
  assert.equal((await call(path, "POST", body)).status, 200);
  const saved = await Task.find({ vendorKey: "batch-test" }).lean();
  assert.ok(saved.every((t) => t.attempts.length === 1 && t.nextAttemptAt));
  assert.equal(await CallLog.countDocuments({ requestId: body.requestId }), 1);
});
test("manual reassignment moves an entire vendor group and rejects day-one callers", async () => {
  const ownerToken = jwt.sign(
    { sub: String(admin._id), type: "admin", role: "super-admin" },
    process.env.JWT_SECRET,
  );
  const group = await Promise.all([
    make({ type: "vendor-call", vendorKey: "manual-batch" }),
    make({ type: "vendor-call", vendorKey: "manual-batch" }),
  ]);
  const r = await call(
    `/api/v1/workspace/tasks/${group[0]._id}/assign`,
    "POST",
    { assigneeId: String(b._id) },
    ownerToken,
  );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(
    await Task.countDocuments({ vendorKey: "manual-batch", assigneeId: b._id }),
    2,
  );
  await Admin.updateOne(
    { _id: a._id },
    {
      $set: {
        newlyJoined: true,
        joinedOn: require("../modules/workspace/engine").dateKey(),
      },
    },
  );
  const blocked = await call(
    `/api/v1/workspace/tasks/${group[0]._id}/assign`,
    "POST",
    { assigneeId: String(a._id) },
    ownerToken,
  );
  assert.equal(blocked.status, 400);
  await Admin.updateOne({ _id: a._id }, { $set: { newlyJoined: false } });
});
test("employee creation API accepts no email and stores onboarding and leave", async () => {
  const ownerToken = jwt.sign(
    { sub: String(admin._id), type: "admin", role: "super-admin" },
    process.env.JWT_SECRET,
  );
  const body = {
    name: "New employee",
    username: "new-employee",
    email: "",
    password: "integration-only-password",
    role: "staff",
    profile: "intern",
    team: "Follow up",
    acceptsTasks: true,
    isActive: true,
    newlyJoined: true,
    joinedOn: "2026-09-21",
    leave: [{ from: "2026-10-01", until: "2026-10-02" }],
    levelMode: "auto",
    manualLevel: 1,
  };
  const response = await call(
    "/api/v1/workspace/employees",
    "POST",
    body,
    ownerToken,
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const saved = await Admin.findOne({ username: "new-employee" }).lean();
  assert.equal(saved.email, undefined);
  assert.equal(saved.newlyJoined, true);
  assert.equal(saved.leave.length, 1);
  const login = await call("/api/v1/auth/login", "POST", {
    email: body.username,
    password: body.password,
  });
  assert.equal(login.status, 200);
});
test("active return survives its parent order being delivered", async () => {
  const key = "return-parent-delivered";
  await CommerceOrder.create({
    commerceOrderId: key,
    orderId: "RETURN-PARENT",
    commerce: { orderStatus: "Delivered" },
  });
  await OrderReturn.create({
    externalReturnId: "test-return-active",
    commerceOrderId: key,
    orderId: "RETURN-PARENT",
    status: "Initiated",
    workflowStage: "customer_response",
    isActive: true,
  });
  await S.rebalance();
  const task = await Task.findOne({
    "metadata.returnId": "test-return-active",
  }).lean();
  assert.ok(task);
  assert.equal(task.closedAt, undefined);
  assert.equal(task.status, "pending");
  await OrderReturn.updateOne(
    { externalReturnId: "test-return-active" },
    { $set: { status: "Return Delivered" } },
  );
  await S.rebalance();
  assert.equal((await Task.findById(task._id)).status, "skipped");
});
test("return follows customer response then vendor response before closing", async () => {
  const returned = await OrderReturn.create({
    externalReturnId: "return-flow-test",
    commerceOrderId: String(new mongoose.Types.ObjectId()),
    workflowStage: "customer_response",
    customerResponseStatus: "pending",
    vendorResponseStatus: "pending",
    status: "Initiated",
  });
  const task = await make({
    type: "return-followup",
    metadata: { returnId: returned.externalReturnId },
    sourceOrder: { orderId: returned.commerceOrderId },
  });
  const actor = { userId: a._id, role: "staff", name: a.name };
  await S.recordOutcome(
    String(task._id),
    {
      outcome: "return-customer-confirmed",
      requestId: "return-customer-step-0001",
    },
    actor,
  );
  assert.equal(
    (await OrderReturn.findById(returned._id)).workflowStage,
    "vendor_response",
  );
  assert.equal((await Task.findById(task._id)).status, "pending");
  await S.recordOutcome(
    String(task._id),
    {
      outcome: "return-vendor-accepted",
      requestId: "return-vendor-step-00002",
    },
    actor,
  );
  assert.equal(
    (await OrderReturn.findById(returned._id)).workflowStage,
    "completed",
  );
  assert.equal((await Task.findById(task._id)).status, "completed");
  assert.equal((await Task.findById(task._id)).attempts.length, 2);
});
test("vendor-first setting leads stock confirmation to customer then dispatch", async () => {
  await Setting.updateOne(
    { key: "confirmationOrder" },
    { $set: { value: "vendor_first" } },
    { upsert: true },
  );
  const {
    commerceSync,
  } = require("../modules/commerce/service/commerce.sync.service");
  await commerceSync.loadSettings();
  const key = String(new mongoose.Types.ObjectId());
  const order = await CommerceOrder.create({
    commerceOrderId: key,
    orderId: "VENDOR-FIRST",
    commerce: { orderStatus: "Pending" },
    customer: { confirmationStatus: "pending" },
    vendor: { vendorStatus: "unassigned" },
  });
  assert.equal(commerceSync.getPriorityForOrder(order).taskType, "vendor-call");
  const initial = await make({ sourceOrder: { orderId: key } });
  await S.reconcileOrderStages();
  assert.equal((await Task.findById(initial._id)).status, "skipped");
  const vendor = await Task.findOne({
    "sourceOrder.orderId": key,
    status: "pending",
  });
  const actor = { userId: a._id, role: "staff", name: a.name };
  await S.recordOutcome(
    String(vendor._id),
    { outcome: "vendor-accepted", requestId: "vendor-first-confirmation-01" },
    actor,
  );
  const customer = await Task.findOne({
    "sourceOrder.orderId": key,
    type: "customer-confirmation",
    status: "pending",
  });
  assert.ok(customer);
  await Task.updateOne({ _id: customer._id }, { $set: { assigneeId: a._id } });
  await S.recordOutcome(
    String(customer._id),
    {
      outcome: "customer-confirmed",
      requestId: "vendor-first-confirmation-02",
    },
    actor,
  );
  assert.ok(
    await Task.exists({
      "sourceOrder.orderId": key,
      type: "logistics-followup",
      status: "pending",
    }),
  );
  assert.equal(
    (await CommerceOrder.findById(order._id)).workflowStage,
    "confirmed_unprocessed",
  );
  await Setting.updateOne(
    { key: "confirmationOrder" },
    { $set: { value: "customer_first" } },
  );
  await commerceSync.loadSettings();
});
test("settings API validates and persists confirmation order", async () => {
  const auth = jwt.sign(
    { sub: String(admin._id), type: "admin", role: "super-admin" },
    process.env.JWT_SECRET,
  );
  assert.equal(
    (
      await call(
        "/api/v1/settings",
        "PUT",
        { confirmationOrder: "invalid" },
        auth,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/v1/settings",
        "PUT",
        { confirmationOrder: "vendor_first" },
        auth,
      )
    ).status,
    200,
  );
  assert.equal(
    (await Setting.findOne({ key: "confirmationOrder" })).value,
    "vendor_first",
  );
  assert.equal(
    (
      await call(
        "/api/v1/settings",
        "PUT",
        { confirmationOrder: "customer_first" },
        auth,
      )
    ).status,
    200,
  );
});
test("Orders list exposes portal status, confirmations, contacts and current task deadline", async () => {
  const key = String(new mongoose.Types.ObjectId());
  const due = new Date(Date.now() + 3600000);
  await CommerceOrder.create({ commerceOrderId: key, orderId: "LIST-FLOW-CHECK", workflowStage: "collected_by_logistics", commerce: { orderStatus: "Processing" }, customer: { confirmationStatus: "confirmed", phone: "9800000001" }, vendor: { vendorStatus: "accepted", phone: "9800000002" } });
  const followup = await make({ type: "logistics-followup", sourceOrder: { orderId: key }, nextAttemptAt: due, slaMinutes: 120 });
  await make({ type: "order-check", sourceOrder: { orderId: key } });
  const { commerceSync } = require("../modules/commerce/service/commerce.sync.service");
  const result = await commerceSync.getOrders({ search: "LIST-FLOW-CHECK" });
  const row = result.orders[0];
  assert.equal(row.orderStatus, "Processing");
  assert.equal(row.confirmationStatus, "confirmed");
  assert.equal(row.vendorStatus, "accepted");
  assert.equal(row.customerPhone, "9800000001");
  assert.equal(String(row.taskId), String(followup._id));
  assert.equal(+new Date(row.dueAt), +due);
});
