const { bootstrapAdmin, requireAdmin } = require('../../../lib/auth');
const { ensureSchema } = require('../../../lib/schema');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await ensureSchema();
    await bootstrapAdmin();
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.status(200).json({ admin: { username: admin.username, role: admin.role }, csrf_token: admin.csrf_token });
  } catch (error) {
    console.error('Admin session error:', error.message);
    res.status(500).json({ error: 'Session check failed' });
  }
};