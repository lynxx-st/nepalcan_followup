// JSON snapshot importer. Usage: node scripts/import-sheets.js path/to/export.json [--apply]
// No Google dependency: read a local snapshot exported from the old workspace.
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { mongoose, Admin, Task } = require("../database/models");
async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--"))
    throw new Error("Supply a JSON snapshot file. Preview is the default.");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")),
    data = raw.data || raw;
  if (!Array.isArray(data.members) || !Array.isArray(data.orders))
    throw new Error(
      "Expected a snapshot containing members and orders arrays.",
    );
  const records = [
    ...data.orders.map((r) => ({ ...r, kind: "order" })),
    ...(data.returns || []).map((r) => ({ ...r, kind: "return" })),
  ];
  if (data.members.some((m) => !m.id || !m.name) || records.some((r) => !r.id))
    throw new Error(
      "Every member requires an ID and name; every order requires an ID.",
    );
  if (new Set(data.members.map((m) => m.id)).size !== data.members.length)
    throw new Error("Duplicate employee IDs in export.");
  console.log(
    JSON.stringify({
      mode: process.argv.includes("--apply") ? "apply" : "preview",
      employees: data.members.length,
      orders: data.orders.length,
      returns: (data.returns || []).length,
      closed: records.filter(
        (r) =>
          r.reviewClosedAt ||
          r.orderClosedAt ||
          /cancelled|return delivered/i.test(r.portalStatus || ""),
      ).length,
      existingRecords:
        "Matched by original ID; repeat imports do not overwrite records",
      accounts:
        "Imported accounts start disabled; set passwords before activation",
    }),
  );
  if (!process.argv.includes("--apply")) return;
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Admin.init(), Task.init()]);
  const mapping = new Map();
  for (const m of data.members) {
    let user = await Admin.findOne({ legacyMemberId: m.id });
    if (!user)
      user = await Admin.create({
        legacyMemberId: m.id,
        username: `import-${crypto.createHash("sha256").update(m.id).digest("hex").slice(0, 12)}`,
        name: m.name,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
        isActive: false,
        acceptsTasks: true,
        role: "staff",
        team: "Follow up",
        profile: String(m.profile || "casual").toLowerCase(),
        newlyJoined: !!m.newlyJoined,
        joinedOn: m.joinedOn,
        levelMode: m.levelMode || "auto",
        manualLevel: Number(m.manualLevel) || 1,
        leave:
          m.leaveFrom && m.leaveTo
            ? [{ from: m.leaveFrom, until: m.leaveTo }]
            : [],
      });
    mapping.set(m.id, user);
  }
  for (const r of records) {
    const key = `sheets:${r.kind}:${r.id}`;
    if (await Task.exists({ automationKey: key })) continue;
    const closed =
      r.reviewClosedAt ||
      r.orderClosedAt ||
      /cancelled|return delivered/i.test(r.portalStatus || "");
    const type =
      r.kind === "return"
        ? "return-followup"
        : r.portalStatus === "Delivered"
          ? "review-call"
          : r.stockStatus && r.stockStatus !== "Not checked"
            ? "vendor-call"
            : "customer-confirmation";
    await Task.create({
      automationKey: key,
      type,
      reason: r.notes || "Imported follow-up",
      orderNumber: r.orderId,
      sourceOrder: { orderId: r.orderKey || r.id, orderNumber: r.orderId },
      vendorKey: r.vendorKey,
      customerPhone: r.customerPhone,
      vendorPhone: r.vendorPhone,
      assigneeId: mapping.get(r.assignee)?.id,
      assigneeName: mapping.get(r.assignee)?.name,
      status: closed
        ? "skipped"
        : r.followUpStatus === "Resolved"
          ? "completed"
          : "pending",
      closedAt: closed
        ? new Date(r.reviewClosedAt || r.orderClosedAt || Date.now())
        : undefined,
      closedReason: closed ? "Imported closed history" : undefined,
      nextAttemptAt: r.nextFollowUp || undefined,
      metadata: { team: "Follow up", legacy: r },
      notes: [
        {
          actor: "system",
          note: `Imported original record ${r.id}. Historical notes, review and attempt totals preserved in metadata. No individual calls inferred.`,
        },
      ],
    });
  }
  console.log(
    "Import complete. Review account mappings and history before disabling Sheets.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
