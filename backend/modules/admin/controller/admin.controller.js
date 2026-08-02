const bcrypt = require('bcryptjs');
const { Admin, CommerceOrder } = require('../../../database/models');

const SAFE_FIELDS = 'email role branches team isActive lastLoginAt createdAt';

function sanitize(admin) {
  return {
    id: admin._id,
    email: admin.email,
    role: admin.role,
    branches: admin.branches || [],
    team: admin.team || null,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt,
  };
}

async function listUsers(req, res) {
  try {
    const admins = await Admin.find({}).select(SAFE_FIELDS).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: admins.map(sanitize) });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function createUser(req, res) {
  try {
    const { email, password, name, role, branches, team } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: { message: 'email and password required' } });
    }
    if (role && !['admin', 'manager', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid role' } });
    }
    if (await Admin.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ success: false, error: { message: 'Email already exists' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await Admin.create({
      email: email.toLowerCase(),
      name: name || null,
      passwordHash,
      role: role || 'staff',
      branches: Array.isArray(branches) ? branches : [],
      team: team || null,
    });

    res.json({ success: true, data: sanitize(admin) });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function updateUser(req, res) {
  try {
    const { role, branches, team, isActive, name } = req.body;
    const update = {};

    if (name !== undefined) update.name = name;
    if (role !== undefined) {
      if (!['super-admin', 'admin', 'manager', 'staff'].includes(role)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid role' } });
      }
      update.role = role;
    }
    if (branches !== undefined) update.branches = Array.isArray(branches) ? branches : [];
    if (team !== undefined) update.team = team;
    if (isActive !== undefined) update.isActive = !!isActive;

    const admin = await Admin.findByIdAndUpdate(req.params.id, update, { new: true }).select(SAFE_FIELDS);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    res.json({ success: true, data: sanitize(admin) });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function resetPassword(req, res) {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: { message: 'Password must be at least 8 characters' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { passwordHash },
      { new: true }
    ).select(SAFE_FIELDS);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    res.json({ success: true, data: sanitize(admin) });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

async function listBranches(req, res) {
  try {
    const [nestedName, topLevelName, nestedStr, topLevelStr] = await Promise.all([
      CommerceOrder.distinct('commerce.branch.name', { 'commerce.branch.name': { $ne: null } }),
      CommerceOrder.distinct('branch.name', { 'branch.name': { $ne: null } }),
      CommerceOrder.distinct('commerce.branch', { 'commerce.branch': { $type: 'string', $ne: '' } }),
      CommerceOrder.distinct('branch', { branch: { $type: 'string', $ne: '' } }),
    ]);
    // ponytail: drop ObjectId-hex values — legacy logistics sync stored commerce.branch
    // as a bare _id string; only real branch names are useful here.
    const isOidHex = (v) => /^[0-9a-f]{24}$/.test(v);
    const branches = [...new Set([...nestedName, ...topLevelName, ...nestedStr, ...topLevelStr])]
      .filter((b) => b && !isOidHex(b))
      .sort();
    res.json({ success: true, data: branches });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

module.exports = { listUsers, createUser, updateUser, resetPassword, listBranches };
