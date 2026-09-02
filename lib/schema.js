const { query } = require('./db');

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS monthly_staff_baselines (
      staff_email TEXT NOT NULL,
      month TEXT NOT NULL,
      referrals INTEGER NOT NULL CHECK (referrals >= 0),
      PRIMARY KEY (staff_email, month)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS monthly_baselines (
      month TEXT PRIMARY KEY,
      referrals INTEGER NOT NULL CHECK (referrals >= 0)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS referrals (
      referee_user_id BIGINT PRIMARY KEY,
      staff_email TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS referrals_occurred_at_idx ON referrals (occurred_at)');
  await query(`
    CREATE TABLE IF NOT EXISTS webhook_receipts (
      event_key TEXT PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS sync_state (
      sync_name TEXT PRIMARY KEY,
      last_successful_at TIMESTAMPTZ,
      last_started_at TIMESTAMPTZ,
      locked_until TIMESTAMPTZ,
      last_summary JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

module.exports = { ensureSchema };