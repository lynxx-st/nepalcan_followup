const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const logger = require('../../../utils/logger');

const TOKEN_FILE = path.join(__dirname, '..', '..', '..', '.commerce-token');

class CommerceAuthService {
  constructor() {
    this.apiBase = config.authApiUrl;
    this.email = config.authEmail;
    this.password = config.authPassword;
    this.token = null;
  }

  async getToken() {
    if (this.token && !this.isTokenExpired(this.token)) {
      return this.token;
    }

    const savedToken = this.loadTokenFromFile();
    if (savedToken && !this.isTokenExpired(savedToken)) {
      this.token = savedToken;
      return savedToken;
    }

    await this.login();
    return this.token;
  }

  async login() {
    try {
      const response = await axios.post(
        this.apiBase,
        { email: this.email, password: this.password },
        { timeout: 10000 }
      );

      const token = response.data?.token;
      if (!token) {
        throw new Error('No token received from commerce API');
      }

      this.token = token;
      this.saveTokenToFile(token);
      logger.info('Commerce auth successful');
      return token;
    } catch (error) {
      logger.error('Commerce login failed', { message: error.message });
      throw new Error(`Commerce authentication failed: ${error.message}`);
    }
  }

  isTokenExpired(token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  saveTokenToFile(token) {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, expiresAt: Date.now() + 3600000 }));
    } catch (error) {
      logger.warn('Could not save token to file', { message: error.message });
    }
  }

  loadTokenFromFile() {
    try {
      if (!fs.existsSync(TOKEN_FILE)) return null;
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      if (data.expiresAt > Date.now()) {
        return data.token;
      }
      return null;
    } catch {
      return null;
    }
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.token || ''}`,
      'Content-Type': 'application/json',
    };
  }
}

module.exports = new CommerceAuthService();