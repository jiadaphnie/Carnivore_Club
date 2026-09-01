const { query } = require('../lib/db');
const { getUser } = require('../lib/eber');
const { recordReferral } = require('../lib/referrals');
const { ensureSchema } = require('../lib/schema');
const { hasMatchingSecret } = require('../lib/security');

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
    const result = await recordReferral(referee);

    await query('INSERT INTO webhook_receipts (event_key) VALUES ($1) ON CONFLICT DO NOTHING', [eventKey]);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error('Eber webhook error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};