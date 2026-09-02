const { getDashboard } = require('../lib/dashboard');
const { ensureSchema } = require('../lib/schema');
const { ensureFreshReferrals, getSyncState } = require('../lib/sync');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await ensureSchema();
    const sync = req.query.month ? { state: await getSyncState(), sync_in_progress: false } : await ensureFreshReferrals();
    const dashboard = await getDashboard(req.query.month);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ...dashboard,
      last_successful_sync_at: sync.state && sync.state.last_successful_at,
      sync_in_progress: sync.sync_in_progress,
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Dashboard is temporarily unavailable' });
  }
};