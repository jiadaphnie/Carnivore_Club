const { query } = require('./db');
const { listUsers } = require('./eber');
const { syncReferrals } = require('./referrals');

const SYNC_NAME = 'referral_import';
const FRESHNESS_MS = 15 * 60 * 1000;

function hongKongParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit', month: '2-digit', timeZone: 'Asia/Hong_Kong', year: 'numeric',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function dateForEber(date) {
  const parts = hongKongParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function getSyncState() {
  const rows = await query('SELECT last_successful_at, locked_until, last_summary FROM sync_state WHERE sync_name = $1', [SYNC_NAME]);
  return rows[0] || null;
}

function isFresh(state) {
  return state && state.last_successful_at
    && Date.now() - new Date(state.last_successful_at).getTime() < FRESHNESS_MS;
}

async function acquireLock() {
  const rows = await query(`
    INSERT INTO sync_state (sync_name, last_started_at, locked_until, updated_at)
    VALUES ($1, NOW(), NOW() + INTERVAL '2 minutes', NOW())
    ON CONFLICT (sync_name) DO UPDATE
      SET last_started_at = NOW(), locked_until = NOW() + INTERVAL '2 minutes', updated_at = NOW()
      WHERE sync_state.locked_until IS NULL OR sync_state.locked_until < NOW()
    RETURNING last_successful_at
  `, [SYNC_NAME]);
  return rows[0] || null;
}

async function ensureFreshReferrals() {
  const state = await getSyncState();
  if (isFresh(state)) return { state, sync_in_progress: false };

  const lock = await acquireLock();
  if (!lock) return { state, sync_in_progress: true };

  try {
    const startedAt = new Date();
    const previous = lock.last_successful_at ? new Date(lock.last_successful_at) : startedAt;
    const overlapStart = new Date(previous.getTime() - 30 * 60 * 1000);
    const users = await listUsers({ fromDate: dateForEber(overlapStart), toDate: dateForEber(startedAt) });
    const summary = await syncReferrals(users);
    if (summary.failures) throw new Error(`Referral sync had ${summary.failures} failed records`);
    const rows = await query(`
      UPDATE sync_state
      SET last_successful_at = NOW(), locked_until = NULL, last_summary = $2::jsonb, updated_at = NOW()
      WHERE sync_name = $1
      RETURNING last_successful_at, locked_until, last_summary
    `, [SYNC_NAME, JSON.stringify(summary)]);
    return { state: rows[0], sync_in_progress: false, summary };
  } catch (error) {
    await query('UPDATE sync_state SET locked_until = NULL, updated_at = NOW() WHERE sync_name = $1', [SYNC_NAME]);
    throw error;
  }
}

module.exports = { ensureFreshReferrals, getSyncState };