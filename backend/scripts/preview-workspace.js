// Disposable local preview. Never connects to the configured production database.
process.env.JWT_SECRET = "disposable-workspace-preview-only";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/unused";
process.env.NODE_ENV = "test";
const { MongoMemoryServer } = require("mongodb-memory-server");
const {
  mongoose,
  Admin,
  Task,
  CommerceOrder,
  Setting,
  UserAttendance,
} = require("../database/models");
const bcrypt = require("bcryptjs");
async function main() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const hash = await bcrypt.hash("Preview-only-2026", 4);
  const people = await Admin.create([
    {
      name: "Preview Manager",
      username: "preview",
      passwordHash: hash,
      role: "super-admin",
      acceptsTasks: true,
      isActive: true,
      profile: "executive",
      joinedOn: "2026-06-01",
      team: "Follow up",
    },
    {
      name: "Training Employee",
      username: "training",
      passwordHash: hash,
      role: "staff",
      isActive: true,
      profile: "intern",
      joinedOn: new Date().toISOString().slice(0, 10),
      newlyJoined: true,
      team: "Follow up",
    },
  ]);
  await Setting.create({
    key: "workspace",
    value: { graceMinutes: 30, retryMinutes: 120, requireCheckIn: false },
  });
  await UserAttendance.create({
    userId: people[0]._id,
    userName: people[0].name,
    checkInTime: new Date(),
    status: "checked-in",
  });
  for (let i = 0; i < 6; i++) {
    const oid = String(new mongoose.Types.ObjectId());
    await CommerceOrder.create({
      commerceOrderId: oid,
      orderId: `PREVIEW-${100 + i}`,
      customer: {
        confirmationStatus: i < 3 ? "confirmed" : "pending",
        name: [
          "Preview Customer A",
          "Preview Customer B",
          "Preview Customer C",
        ][i % 3],
        phone: "9800000000",
      },
      vendor: {
        name: i < 3 ? "Preview Home Store" : "Preview Clothing Store",
        phone: i < 3 ? "9800000001" : "9800000002",
      },
      commerce: {
        orderStatus: i === 5 ? "Delivered" : "Pending",
        totalAmount: 1350,
        shippingAmount: 150,
        paymentMethod: "Cash",
        items: [{ product: { productName: "Cotton shirt", productImages: [{ url: "/preview-shirt.svg" }, { url: "/preview-shirt.svg?back" }] }, variant: { title: "Blue / M" }, quantity: 2, price: 600 }],
      },
    });
    await Task.create({
      type:
        i < 3
          ? "vendor-call"
          : i === 5
            ? "review-call"
            : "customer-confirmation",
      priority: i === 0 ? "high" : "medium",
      reason:
        i < 3
          ? "Confirm availability and agree a dispatch time for these orders."
          : "Confirm the address and preferred delivery time.",
      sourceOrder: { orderId: oid, orderNumber: `PREVIEW-${100 + i}` },
      assigneeId: people[0]._id,
      assigneeName: people[0].name,
      vendorKey: i < 3 ? "preview-home" : undefined,
      dueAt: new Date(Date.now() + (i - 1) * 3600000),
      customerPhone: "9800000000",
      vendorPhone: "9800000001",
      metadata: { team: "Follow up" },
    });
  }
  const { app } = require("../server");
  const previewPort = Number(process.env.PREVIEW_PORT || 3011);
  const server = app.listen(previewPort, "127.0.0.1", () =>
    console.log(
      `Disposable workspace preview ready on port ${previewPort}. Synthetic data only.`,
    ),
  );
  const stop = async () => {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
