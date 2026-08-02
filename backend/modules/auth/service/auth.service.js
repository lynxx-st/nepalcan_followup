const https = require('https');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../../../config');
const Admin = require('../../../database/models').Admin;

class AuthService {
  async login(email, password) {
    const admin = await Admin.findOne({ email: email.toLowerCase(), isActive: true });

    if (admin) {
      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) {
        throw new Error('Invalid email or password');
      }
      admin.lastLoginAt = new Date();
      await admin.save();

      const token = jwt.sign(
        { 
          sub: admin._id, 
          name: admin.name || null,
          email: admin.email, 
          role: admin.role, 
          type: 'admin',
          branches: admin.branches || [],
          team: admin.team || null
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiry }
      );
      return { token, user: { id: admin._id, name: admin.name || null, email: admin.email, role: admin.role, type: 'admin', branches: admin.branches || [], team: admin.team || null } };
    }

    const body = JSON.stringify({ email, password });
    const url = new URL(config.authApiUrl);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 10000,
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              if (parsed.token) return resolve(parsed.token);
              reject(new Error(parsed.message || 'No token in response'));
            } catch {
              reject(new Error('Invalid response from auth server'));
            }
          });
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = new AuthService();