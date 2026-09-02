const { requireAdmin } = require('../../lib/auth');
const { getRosterData } = require('../../lib/roster');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const staff = getRosterData().staff.filter(member => !member.is_manager).map(({ email, display_name, role, branch }) => ({ email, display_name, role, branch }));
  res.status(200).json({ staff });
};