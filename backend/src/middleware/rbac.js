const { UnauthorizedError } = require('./errorHandler');

const ROLES = {
  admin: 'admin',
  manager: 'manager',
  staff: 'staff',
  user: 'user',
};

const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    const userRole = req.userRole || 'user';
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: { message: `Requires one of: ${roles.join(', ')}` },
      });
    }
    next();
  };
};

module.exports = { ROLES, requireRole };