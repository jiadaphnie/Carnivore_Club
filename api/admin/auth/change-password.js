const { audit, hashPassword, requireAdmin, validCsrf, verifyPassword } = require('../../../lib/auth');
const { query } = require('../../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const currentPassword = String(req.body && req.body.current_password || '');
  const newPassword = String(req.body && req.body.new_password || '');
  if (newPassword.length < 12) return res.status(400).json({ error: 'New password must have at least 12 characters' });
  const rows = await query('SELECT password_hash FROM admins WHERE id = $1', [admin.id]);
  if (!rows.length || !await verifyPassword(currentPassword, rows[0].password_hash)) return res.status(401).json({ error: 'Current password is incorrect' });
  await query('UPDATE admins SET password_hash = $2, must_change_password = FALSE, updated_at = NOW() WHERE id = $1', [admin.id, await hashPassword(newPassword)]);
  await query('DELETE FROM admin_sessions WHERE admin_id = $1 AND csrf_token <> $2', [admin.id, admin.csrf_token]);
  await audit(admin.id, 'password_changed', 'admin', admin.id);
  res.status(200).json({ ok: true });
};