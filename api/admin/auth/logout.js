const { clearSessionCookie, hashToken, SESSION_COOKIE } = require('../../../lib/auth');
const { query } = require('../../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = String(req.headers.cookie || '').match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (token) await query('DELETE FROM admin_sessions WHERE token_hash = $1', [hashToken(decodeURIComponent(token[1]))]);
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
};