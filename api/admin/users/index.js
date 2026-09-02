const { audit, hashPassword, normalizeUsername, requireAdmin, validCsrf } = require('../../../lib/auth');
const { query } = require('../../../lib/db');

module.exports = async (req, res) => {
  const admin = await requireAdmin(req, res, true);
  if (!admin) return;
  if (req.method === 'GET') {
    const users = await query('SELECT id, username, role, active, must_change_password, created_at FROM admins ORDER BY created_at');
    return res.status(200).json({ users });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const username = normalizeUsername(req.body && req.body.username);
  const password = String(req.body && req.body.password || '');
  if (!/^[a-z0-9._-]{3,50}$/.test(username) || password.length < 12) return res.status(400).json({ error: 'Use a 3-50 character username and a password of at least 12 characters' });
  try {
    const created = await query("INSERT INTO admins (username, password_hash, role, must_change_password) VALUES ($1, $2, 'admin', TRUE) RETURNING id, username", [username, await hashPassword(password)]);
    await audit(admin.id, 'admin_created', 'admin', created[0].id, { username });
    res.status(201).json({ user: created[0] });
  } catch (error) {
    res.status(409).json({ error: 'That username is already in use' });
  }
};