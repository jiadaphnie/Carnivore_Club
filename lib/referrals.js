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

module.exports = { recordReferral };