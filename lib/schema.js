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
  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS manual_referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_email TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      note TEXT NOT NULL CHECK (char_length(note) BETWEEN 3 AND 500),
      created_by UUID NOT NULL REFERENCES admins(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS manual_referrals_occurred_at_idx ON manual_referrals (occurred_at)');
  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      admin_id UUID REFERENCES admins(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC)');
}

module.exports = { ensureSchema };