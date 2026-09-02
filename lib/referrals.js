const { query } = require('./db');
const { getTierNames, getUser } = require('./eber');
const { findEligibleStaff, normalizeEmail } = require('./roster');

function isStaffAccount(user) {
  const tiers = getTierNames(user);
  return (user.tags || []).includes('Steak King Staff')
    || tiers.some(tier => tier.startsWith('STAFF-'));
}

function hongKongTimestamp(timestamp) {
  return `${timestamp.replace(' ', 'T')}+08:00`;
}

async function recordReferral(referee) {
  if (!referee.referral_user_id) return 'no_referrer';

  const referrer = await getUser(referee.referral_user_id);
  const staff = findEligibleStaff(normalizeEmail(referrer.email));
  if (!staff || !isStaffAccount(referrer)) return 'ineligible_referrer';

  const inserted = await query(
    `INSERT INTO referrals (referee_user_id, staff_email, occurred_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (referee_user_id) DO NOTHING
     RETURNING referee_user_id`,
    [referee.id, staff.email, hongKongTimestamp(referee.enrolled_at || referee.created_at)],
  );
  return inserted.length ? 'recorded' : 'duplicate';
}

async function syncReferrals(users) {
  const summary = { duplicate: 0, failures: 0, ineligible_referrer: 0, no_referrer: 0, recorded: 0, scanned: users.length };
  for (const user of users) {
    try {
      summary[await recordReferral(user)] += 1;
    } catch (error) {
      console.error('Referral sync user failed:', user.id, error.message);
      summary.failures += 1;
    }
  }
  return summary;
}

module.exports = { recordReferral, syncReferrals };