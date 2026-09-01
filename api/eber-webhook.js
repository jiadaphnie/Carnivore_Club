const { query } = require('../lib/db');
const { getTierNames, getUser } = require('../lib/eber');
const { findEligibleStaff, normalizeEmail } = require('../lib/roster');
const { ensureSchema } = require('../lib/schema');
const { hasMatchingSecret } = require('../lib/security');

function isStaffAccount(user) {
  const tiers = getTierNames(user);
  return (user.tags || []).includes('Steak King Staff')
    || tiers.some(tier => tier.startsWith('STAFF-'));
}

function hongKongTimestamp(timestamp) {
  return `${timestamp.replace(' ', 'T')}+08:00`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!hasMatchingSecret(req.headers['x-eber-webhook-secret'], process.env.EBER_WEBHOOK_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const refereeUserId = Number(req.body && req.body.id);
  if (!Number.isInteger(refereeUserId)) {
    res.status(400).json({ error: 'Missing Eber member ID' });
    return;
  }

  const eventKey = String((req.body && req.body.webhook_event_uuid) || `user:${refereeUserId}`);
  try {
    await ensureSchema();
    const existing = await query('SELECT 1 FROM webhook_receipts WHERE event_key = $1', [eventKey]);
    if (existing.length) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    const referee = await getUser(refereeUserId);
    let result = 'ignored';
    if (referee.referral_user_id) {
      const referrer = await getUser(referee.referral_user_id);
      const staff = findEligibleStaff(normalizeEmail(referrer.email));
      if (staff && isStaffAccount(referrer)) {
        const inserted = await query(
          `INSERT INTO referrals (referee_user_id, staff_email, occurred_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (referee_user_id) DO NOTHING
           RETURNING referee_user_id`,
          [refereeUserId, staff.email, hongKongTimestamp(referee.enrolled_at || referee.created_at)],
        );
        result = inserted.length ? 'recorded' : 'duplicate';
      }
    }

    await query('INSERT INTO webhook_receipts (event_key) VALUES ($1) ON CONFLICT DO NOTHING', [eventKey]);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error('Eber webhook error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};