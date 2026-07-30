const jwt = require('jsonwebtoken');
const config = require('../../config');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new (require('./errorHandler').UnauthorizedError)(
        'Access token required'
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    req.user = decoded;
    req.user.userId = decoded.sub || decoded.userId;
    req.userId = req.user.userId;
    req.userRole = decoded.role || 'user';

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid or expired token' },
      });
    }
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { message: 'Admin access required' },
    });
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
      req.user.userId = decoded.sub || decoded.userId;
      req.userId = req.user.userId;
      req.userRole = decoded.role || 'user';
    }
  } catch (error) {
  }

  next();
};

module.exports = { authenticate, requireAdmin, optionalAuth };