const { audit, requireAdmin, validCsrf } = require('../../../../lib/auth');
const { query } = require('../../../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res, true);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const targetId = req.query.id;
  if (targetId === admin.id) return res.status(400).json({ error: 'You cannot disable your own account' });
  const target = await query('UPDATE admins SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING username', [targetId]);
  if (!target.length) return res.status(404).json({ error: 'Admin not found' });
  await query('DELETE FROM admin_sessions WHERE admin_id = $1', [targetId]);
  await audit(admin.id, 'admin_disabled', 'admin', targetId, { username: target[0].username });
  res.status(200).json({ ok: true });
};