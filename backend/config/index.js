require('dotenv').config();

function validateRequiredEnv() {
  const required = ['JWT_SECRET', 'MONGO_URI'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `[FATAL] Missing required environment variables: ${missing.join(', ')}`
    );
    console.error('[FATAL] Please set these in your .env file before starting the server.');
    process.exit(1);
  }
}

validateRequiredEnv();

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: process.env.JWT_EXPIRY || '24h',
  nodeEnv: process.env.NODE_ENV || 'development',
  slaCheckIntervalMs: parseInt(process.env.SLA_CHECK_INTERVAL_MS, 10) || 60000,
  authEmail: process.env.AUTH_EMAIL || '',
  authPassword: process.env.AUTH_PASSWORD || '',
  authApiUrl: process.env.AUTH_API_URL || 'https://commerce.thecanbrand.com/api/users/login',
  commerceApiBase: process.env.COMMERCE_API_BASE || 'https://commerce.thecanbrand.com/api/marketplace-orders',
  ncmApiBase: process.env.NCM_API_BASE || 'https://demo.nepalcanmove.com',
  ncmApiToken: process.env.NCM_API_TOKEN || '',
};

module.exports = config;
