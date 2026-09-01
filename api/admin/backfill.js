const { listUsers } = require('../../lib/eber');
const { recordReferral } = require('../../lib/referrals');
const { ensureSchema } = require('../../lib/schema');
const { hasMatchingSecret } = require('../../lib/security');

const SEPTEMBER_2026 = { fromDate: '2026-09-01', toDate: '2026-09-30' };

function enrolledInSeptember(user) {
  const enrolledAt = user.enrolled_at || user.created_at;
  return typeof enrolledAt === 'string' && enrolledAt.startsWith('2026-09-');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (process.env.BACKFILL_ENABLED !== 'true') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!hasMatchingSecret(req.headers['x-admin-secret'], process.env.ADMIN_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await ensureSchema();
    const users = await listUsers(SEPTEMBER_2026);
    const summary = { duplicate: 0, failures: 0, ineligible_referrer: 0, no_referrer: 0, outside_period: 0, recorded: 0, scanned: users.length };
    for (const user of users) {
      try {
        if (!enrolledInSeptember(user)) {
          summary.outside_period += 1;
          continue;
        }
        const result = await recordReferral(user);
        summary[result] += 1;
      } catch (error) {
        console.error('Backfill user failed:', user.id, error.message);
        summary.failures += 1;
      }
    }
    res.status(summary.failures ? 500 : 200).json(summary);
  } catch (error) {
    console.error('Backfill error:', error.message);
    res.status(500).json({ error: 'Backfill failed' });
  }
};