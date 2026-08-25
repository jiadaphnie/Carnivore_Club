// Receives Eber XM webhook events and stores them for later processing.
//
// SECURITY NOTE: signature verification is not implemented yet - we don't
// have the HMAC signing secret confirmed from Eber. Until that's added,
// anyone who discovers this URL could POST fake events to it. Low real-world
// risk right now (nobody outside us knows the URL, and the dashboard math
// isn't being trusted from this table yet), but this must be added before
// this data is treated as authoritative. See the HMAC tab on Eber's API page.
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS eber_webhook_events (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      eber_user_id BIGINT,
      referral_user_id BIGINT,
      store_id BIGINT,
      email TEXT,
      source_created_at TIMESTAMPTZ,
      payload JSONB NOT NULL
    )
  `;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Lets us check what's arrived without needing direct database access.
    try {
      await ensureTable();
      const rows = await sql`
        SELECT id, received_at, eber_user_id, referral_user_id, store_id, email, source_created_at
        FROM eber_webhook_events
        ORDER BY received_at DESC
        LIMIT 20
      `;
      res.status(200).json({ count: rows.length, events: rows });
    } catch (err) {
      console.error('Webhook read error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body;
    await ensureTable();

    await sql`
      INSERT INTO eber_webhook_events
        (eber_user_id, referral_user_id, store_id, email, source_created_at, payload)
      VALUES (
        ${body.id || null},
        ${body.referral_user_id || null},
        ${body.store_id || null},
        ${body.email || null},
        ${body.created_at || null},
        ${JSON.stringify(body)}
      )
    `;

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
};
