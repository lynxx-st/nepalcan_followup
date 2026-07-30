const authService = require('../service/auth.service');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password are required' },
      });
    }

    const token = await authService.login(email, password);

    if (token.user) {
      res.json({ success: true, data: { token: token.token, user: token.user } });
    } else {
      res.json({ success: true, data: { token } });
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { message: error.message || 'Authentication failed' },
    });
  }
}

module.exports = { login };