function decodeBase64(str) {
  if (!str || typeof str !== 'string') return str;
  try {
    const decoded = Buffer.from(str, 'base64').toString('utf8');
    return decoded.length > 0 && !decoded.includes('\uFFFD') ? decoded : str;
  } catch { return str; }
}

module.exports = { decodeBase64 };
