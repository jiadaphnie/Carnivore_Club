const { audit, hashPassword, requireAdmin, validCsrf } = require('../../../../lib/auth');
const { query } = require('../../../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res, true);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const password = String(req.body && req.body.password || '');
  if (password.length < 12) return res.status(400).json({ error: 'Temporary password must have at least 12 characters' });
  const target = await query('UPDATE admins SET password_hash = $2, must_change_password = TRUE, updated_at = NOW() WHERE id = $1 RETURNING username', [req.query.id, await hashPassword(password)]);
  if (!target.length) return res.status(404).json({ error: 'Admin not found' });
  await query('DELETE FROM admin_sessions WHERE admin_id = $1', [req.query.id]);
  await audit(admin.id, 'password_reset', 'admin', req.query.id, { username: target[0].username });
  res.status(200).json({ ok: true });
};