// Preview by default. --apply changes only the account indexes and backfills safe defaults.
const { mongoose, Admin } = require("../database/models");
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const indexes = await Admin.collection.indexes();
  const old = indexes.find((i) => i.key.email === 1 && !i.sparse);
  console.log(
    JSON.stringify({
      mode: process.argv.includes("--apply") ? "apply" : "preview",
      emailIndexNeedsUpdate: !!old,
      accounts: await Admin.countDocuments(),
    }),
  );
  if (process.argv.includes("--apply")) {
    // A sparse unique index permits multiple employees without an email address.
    await Admin.updateMany(
      { $or: [{ email: null }, { email: "" }] },
      { $unset: { email: 1 } },
    );
    if (old) await Admin.collection.dropIndex(old.name);
    await Admin.collection.createIndex(
      { email: 1 },
      { unique: true, sparse: true },
    );
    await Admin.collection.createIndex(
      { username: 1 },
      { unique: true, sparse: true },
    );
    await Admin.updateMany(
      {
        role: { $in: ["admin", "super-admin"] },
        acceptsTasks: { $exists: false },
      },
      { $set: { acceptsTasks: false } },
    );
    console.log(
      "Account migration complete. Existing passwords and roles preserved.",
    );
  }
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
