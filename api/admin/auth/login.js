const { query } = require('../../../lib/db');
const { audit, bootstrapAdmin, hashToken, normalizeUsername, randomToken, setSessionCookie, verifyPassword } = require('../../../lib/auth');
const { ensureSchema } = require('../../../lib/schema');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await ensureSchema();
    await bootstrapAdmin();
    const username = normalizeUsername(req.body && req.body.username);
    const password = String((req.body && req.body.password) || '');
    const rows = await query('SELECT id, username, password_hash, role, active, must_change_password FROM admins WHERE username = $1', [username]);
    const admin = rows[0];
    if (!admin || !admin.active || !await verifyPassword(password, admin.password_hash)) {
      if (admin) await audit(admin.id, 'login_failed', 'admin', admin.id);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    await query(`INSERT INTO admin_sessions (token_hash, admin_id, csrf_token, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '12 hours')`, [hashToken(sessionToken), admin.id, csrfToken]);
    await audit(admin.id, 'login', 'admin', admin.id);
    setSessionCookie(res, sessionToken);
    res.status(200).json({ admin: { username: admin.username, role: admin.role, must_change_password: admin.must_change_password }, csrf_token: csrfToken });
  } catch (error) {
    console.error('Admin login error:', error.message);
    res.status(500).json({ error: 'Sign in is temporarily unavailable' });
  }
};