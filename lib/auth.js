const crypto = require('crypto');
const { query } = require('./db');

const SESSION_COOKIE = 'cc_admin_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, value) => error ? reject(error) : resolve(value)));
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt);
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !expected) return false;
  const actual = await scrypt(password, salt);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return expectedBuffer.length === actual.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(value => value.trim().split('=').map(decodeURIComponent)).filter(([name]) => name));
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

async function audit(adminId, action, targetType, targetId, details = {}) {
  await query('INSERT INTO audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5::jsonb)', [adminId, action, targetType, targetId, JSON.stringify(details)]);
}

async function bootstrapAdmin() {
  if (process.env.BOOTSTRAP_ENABLED !== 'true') return;
  const username = normalizeUsername(process.env.BOOTSTRAP_ADMIN_USERNAME);
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!username || !password) throw new Error('Bootstrap admin credentials are not configured');
  const existing = await query('SELECT id FROM admins LIMIT 1');
  if (existing.length) return;
  const passwordHash = await hashPassword(password);
  const created = await query("INSERT INTO admins (username, password_hash, role) VALUES ($1, $2, 'super_admin') RETURNING id", [username, passwordHash]);
  await audit(created[0].id, 'bootstrap_admin', 'admin', created[0].id, { username });
}

async function requireAdmin(req, res, superAdmin = false) {
  const token = cookies(req)[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'Sign in required' });
    return null;
  }
  const rows = await query(`SELECT a.id, a.username, a.role, a.active, s.csrf_token
    FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()`, [hashToken(token)]);
  const admin = rows[0];
  if (!admin || !admin.active || (superAdmin && admin.role !== 'super_admin')) {
    res.status(superAdmin && admin ? 403 : 401).json({ error: superAdmin && admin ? 'Super-admin access required' : 'Sign in required' });
    return null;
  }
  await query('UPDATE admin_sessions SET last_used_at = NOW() WHERE token_hash = $1', [hashToken(token)]);
  return admin;
}

function validCsrf(req, admin) {
  const token = req.headers['x-csrf-token'];
  const actual = Buffer.from(String(token || ''));
  const expected = Buffer.from(String(admin.csrf_token || ''));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { SESSION_COOKIE, audit, bootstrapAdmin, clearSessionCookie, hashPassword, hashToken, normalizeUsername, randomToken, requireAdmin, setSessionCookie, validCsrf, verifyPassword };