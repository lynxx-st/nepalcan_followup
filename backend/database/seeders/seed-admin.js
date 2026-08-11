require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDatabase, disconnectDatabase, Admin } = require('../models');

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('[seed] ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  await connectDatabase(process.env.MONGO_URI);

  const existing = await Admin.findOne({ email });
  if (existing) {
    let needsUpdate = false;
    if (!existing.isActive) { existing.isActive = true; needsUpdate = true; }
    if (!existing.isVerified) { existing.isVerified = true; needsUpdate = true; }
    if (needsUpdate) { await existing.save(); console.log(`[seed] Admin ${email} updated (isActive + isVerified)`); }
    else { console.log(`[seed] Admin ${email} already exists (id: ${existing._id})`); }
    await disconnectDatabase();
    return;
  }

  await Admin.create({
    email,
    name: 'Super Admin',
    passwordHash: await bcrypt.hash(password, 12),
    role: 'super-admin',
    isActive: true,
    isVerified: true,
  });

  console.log(`[seed] Super admin created: ${email}`);
  await disconnectDatabase();
}

seedAdmin().catch((err) => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
