const bcrypt = require('bcryptjs');
const Admin = require('../../../database/models').Admin;

async function seedSuperAdmin() {
  const email = process.env.ADMIN_EMAIL || 'sabeen684@gmail.com';
  const password = process.env.ADMIN_PASSWORD || 'Password@12';

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log(`Super admin ${email} already exists`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.create({
    email,
    name: 'Super Admin',
    passwordHash,
    role: 'super-admin',
  });

  console.log(`Super admin created: ${email}`);
  return admin;
}

module.exports = seedSuperAdmin;