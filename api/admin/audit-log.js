const { requireAdmin } = require('../../lib/auth');
const { query } = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const rows = await query(`SELECT l.id, l.action, l.target_type, l.details, l.created_at, a.username
    FROM audit_log l LEFT JOIN admins a ON a.id = l.admin_id
    ORDER BY l.created_at DESC LIMIT 100`);
  res.status(200).json({ entries: rows });
};