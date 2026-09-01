const { getDashboard } = require('../lib/dashboard');
const { ensureSchema } = require('../lib/schema');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await ensureSchema();
    const dashboard = await getDashboard();
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json(dashboard);
  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ error: 'Dashboard is temporarily unavailable' });
  }
};