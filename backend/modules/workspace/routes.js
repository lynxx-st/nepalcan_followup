const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { authenticate, requireAdmin } = require("../../src/middleware/auth");
const {
  Admin,
  Task,
  Setting,
  CommerceOrder,
  OrderReturn,
  mongoose,
} = require("../../database/models");
const S = require("./service");
const E = require("./engine");
const wrap = (fn) => async (req, res, next) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json({ success: true, data });
  } catch (error) {
    if (error.code === 11000)
      error = Object.assign(new Error("Username or email is already in use"), {
        statusCode: 409,
      });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        message: error.statusCode
          ? error.message
          : "Unable to save. Please retry.",
      },
    });
  }
};
function requireManager(req, res, next) {
  if (!S.manager(req.user))
    return res
      .status(403)
      .json({ success: false, error: { message: "Manager access required" } });
  next();
}
function cronAuth(req, res, next) {
  const expected = process.env.CRON_SECRET || "",
    actual = String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (
    expected.length < 24 ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return res.status(401).json({
      success: false,
      error: { message: "Valid cron bearer token required" },
    });
  next();
}
async function runAutomation() {
  return S.lease("commerce-sync", async () => {
    const {
      commerceSync,
    } = require("../commerce/service/commerce.sync.service");
    const state = mongoose.connection.collection("workspace_runs");
    await state.updateOne(
      { _id: "latest" },
      { $set: { startedAt: new Date(), running: true, error: null } },
      { upsert: true },
    );
    try {
      const client = await import("./commerce-client.mjs");
      const [orders, returns] = await Promise.all([
        client.paginate(
          "/marketplace-orders/super-admin/list?status=Active&unattendedOrders=",
        ),
        client.paginate(
          "/order-return/provider/list?status=Active&keywords=&vendor=&from=&to=&returnStatus=",
        ),
      ]);
      for (let offset = 0; offset < orders.length; offset += 100)
        await commerceSync.processOrders(orders.slice(offset, offset + 100));
      for (const item of returns) {
        const o = item.order || {};
        await OrderReturn.updateOne(
          { externalReturnId: String(item._id) },
          {
            $setOnInsert: {
              customerResponseStatus: "pending",
              vendorResponseStatus: "pending",
              workflowStage: "customer_response",
            },
            $set: {
              commerceOrderId: o._id,
              orderId: o.orderId,
              order: o,
              vendor: o.vendor,
              customerProfile: o.customerProfile,
              customerPhone: client.decodePhone(o.customerProfile?.phone),
              items: item.items || [],
              returnReason: item.returnReason || "",
              status: item.status,
              isActive: item.isActive !== false,
              attachments: (item.attachments || [])
                .map(
                  require("../commerce/service/commerce.sync.service")
                    .normalizeAttachment,
                )
                .filter(Boolean),
            },
          },
          { upsert: true },
        );
      }
      const cached = await CommerceOrder.find({
        commerceOrderId: { $in: orders.map((o) => String(o._id)) },
      })
        .select("commerceOrderId contactCheckedAt")
        .lean();
      const states = Object.fromEntries(
        cached
          .filter((o) => o.contactCheckedAt)
          .map((o) => [
            o.commerceOrderId,
            new Date(o.contactCheckedAt).toISOString(),
          ]),
      );
      const details = await client.fetchContacts(orders, returns, states);
      for (const c of details.contacts)
        await CommerceOrder.updateOne(
          { commerceOrderId: c.id },
          {
            $set: {
              ...(c.vendorPhone ? { "vendor.phone": c.vendorPhone } : {}),
              ...(c.customerPhone ? { "customer.phone": c.customerPhone } : {}),
              contactCheckedAt: new Date(c.checkedAt),
            },
          },
        );
      await state.updateOne(
        { _id: "latest" },
        {
          $set: {
            orders: orders.length,
            returns: returns.length,
            contactFailures: details.failures,
          },
        },
      );
      const assignment = await S.rebalance();
      await state.updateOne(
        { _id: "latest" },
        {
          $set: {
            running: false,
            finishedAt: new Date(),
            lastSuccessAt: new Date(),
            assignment,
          },
        },
      );
      return { synced: true, ...assignment };
    } catch (error) {
      await state.updateOne(
        { _id: "latest" },
        {
          $set: {
            running: false,
            finishedAt: new Date(),
            error: "Sync failed. Check server logs and commerce credentials.",
          },
        },
      );
      throw error;
    }
  });
}
router.post("/cron", cronAuth, (req, res) => {
  runAutomation().catch((error) => {
    if (error.statusCode !== 409)
      console.error("Scheduled sync failed:", error.message);
  });
  res.status(202).json({
    success: true,
    data: {
      accepted: true,
      message: "Sync requested. Check Automation for the completed result.",
    },
  });
});
router.use(authenticate);
router.get(
  "/me",
  wrap(async (req) => {
    const member = await Admin.findById(S.actorId(req.user))
      .select("-passwordHash")
      .lean();
    return {
      ...req.user,
      employee: member,
      training: member
        ? E.profile(
            member,
            new Date(),
            await Task.countDocuments({
              status: "completed",
              completedBy: member._id,
            }),
          )
        : null,
    };
  }),
);
router.get(
  "/tasks",
  wrap((req) => S.queue(req.user, req.query.team === "true")),
);
router.post(
  "/tasks/:id/contact",
  wrap((req) => S.refreshContact(req.params.id, req.user)),
);
router.post(
  "/tasks/:id/start",
  wrap((req) => S.start(req.params.id, req.user)),
);
router.post(
  "/tasks/:id/outcome",
  wrap((req) => S.recordOutcome(req.params.id, req.body, req.user)),
);
router.post(
  "/tasks/:id/assign",
  requireManager,
  wrap((req) => S.assign(req.params.id, req.body.assigneeId, req.user)),
);
router.get(
  "/employees",
  requireManager,
  wrap((req) => S.reports(req.user)),
);
router.post(
  "/rebalance",
  requireAdmin,
  wrap(() => S.rebalance()),
);
function employeeInput(body) {
  const fields = [
    "name",
    "username",
    "email",
    "role",
    "profile",
    "team",
    "acceptsTasks",
    "isActive",
    "newlyJoined",
    "joinedOn",
    "leave",
    "unavailableOn",
    "levelMode",
    "manualLevel",
  ];
  const value = Object.fromEntries(
    fields.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]),
  );
  if (!String(value.name || "").trim()) S.fail("Employee name is required");
  value.name = value.name.trim();
  if (!["staff", "manager", "admin"].includes(value.role))
    S.fail("Choose a valid access role");
  if (!["intern", "casual", "executive"].includes(value.profile))
    S.fail("Choose an employee profile");
  if (
    !["auto", "manual"].includes(value.levelMode) ||
    !Number.isInteger(Number(value.manualLevel)) ||
    value.manualLevel < 1 ||
    value.manualLevel > 10
  )
    S.fail("Level must be between 1 and 10");
  if (!/^[a-z0-9._-]{3,50}$/.test(value.username || ""))
    S.fail(
      "Username needs 3–50 lowercase letters, numbers, dots, underscores or hyphens",
    );
  const validDate = (d) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d || "") &&
    Number.isFinite(+new Date(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  if (!validDate(value.joinedOn) || value.joinedOn < "2000-01-01")
    S.fail("Enter a valid joining date");
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    S.fail("Enter a valid email or leave it blank");
  value.email = value.email ? value.email.trim().toLowerCase() : undefined;
  if (
    !Array.isArray(value.leave) ||
    value.leave.some(
      (l) => !validDate(l.from) || !validDate(l.until) || l.until < l.from,
    )
  )
    S.fail("Check leave start and end dates");
  for (const key of ["acceptsTasks", "isActive", "newlyJoined"])
    if (typeof value[key] !== "boolean")
      S.fail("Invalid employee availability");
  return value;
}
async function refreshAssignments() {
  try {
    return await S.rebalance();
  } catch (error) {
    console.error("Employee saved; assignment refresh pending:", error.message);
    return { pending: true };
  }
}
router.post(
  "/employees",
  requireAdmin,
  wrap(async (req) => {
    const input = employeeInput(req.body);
    if (typeof req.body.password !== "string" || req.body.password.length < 8)
      S.fail("Use a password of at least 8 characters");
    const member = await Admin.create({
      ...input,
      passwordHash: await bcrypt.hash(req.body.password, 12),
    });
    const assignment = await refreshAssignments();
    return { id: E.id(member), assignmentPending: !!assignment.pending };
  }),
);
router.put(
  "/employees/:id",
  requireAdmin,
  wrap(async (req) => {
    const old = await Admin.findById(req.params.id).lean();
    if (!old) S.fail("Employee not found", 404);
    if (
      old.role === "super-admin" ||
      (old.role === "admin" && req.user.role !== "super-admin")
    )
      S.fail("Only the owner may manage administrators", 403);
    const input = employeeInput(req.body);
    if (
      E.id(old) === S.actorId(req.user) &&
      (!input.isActive || input.role !== old.role)
    )
      S.fail("You cannot disable or change your own access");
    const unset = input.email ? {} : { email: 1 };
    delete input.email;
    if (req.body.email) input.email = req.body.email.trim().toLowerCase();
    if (req.body.password) {
      if (typeof req.body.password !== "string" || req.body.password.length < 8)
        S.fail("Use a password of at least 8 characters");
      input.passwordHash = await bcrypt.hash(req.body.password, 12);
    }
    await Admin.updateOne(
      { _id: old._id },
      { $set: input, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { runValidators: true },
    );
    const assignment = await refreshAssignments();
    return { saved: true, assignmentPending: !!assignment.pending };
  }),
);
router.delete(
  "/employees/:id",
  requireAdmin,
  wrap(async (req) => {
    const member = await Admin.findById(req.params.id).lean();
    if (
      !member ||
      member.role === "super-admin" ||
      E.id(member) === S.actorId(req.user) ||
      (member.role === "admin" && req.user.role !== "super-admin")
    )
      S.fail("This account cannot be removed");
    await Admin.updateOne(
      { _id: member._id },
      { $set: { isActive: false, deletedAt: new Date() } },
    );
    const assignment = await refreshAssignments();
    return { removed: true, assignmentPending: !!assignment.pending };
  }),
);
router.get(
  "/automation",
  requireAdmin,
  wrap(async () => ({
    settings: await S.options(),
    status: await mongoose.connection
      .collection("workspace_runs")
      .findOne({ _id: "latest" }),
    cronConfigured: (process.env.CRON_SECRET || "").length >= 24,
    endpoint: "/api/v1/workspace/cron",
  })),
);
router.put(
  "/automation",
  requireAdmin,
  wrap(async (req) => {
    const { graceMinutes, retryMinutes, requireCheckIn } = req.body;
    if (
      ![graceMinutes, retryMinutes].every(
        (n) => Number.isInteger(n) && n >= 5 && n <= 1440,
      ) ||
      typeof requireCheckIn !== "boolean"
    )
      S.fail("Minutes must be between 5 and 1440");
    await Setting.updateOne(
      { key: "workspace" },
      { $set: { value: { graceMinutes, retryMinutes, requireCheckIn } } },
      { upsert: true },
    );
    return S.options();
  }),
);
router.post(
  "/sync",
  requireAdmin,
  wrap(() => runAutomation()),
);
router.get(
  "/archive",
  requireManager,
  wrap((req) =>
    Task.find({
      ...S.scope(req.user),
      $or: [{ closedAt: { $ne: null } }, { status: "completed" }],
    })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean(),
  ),
);
module.exports = { router, runAutomation, cronAuth, employeeInput };
