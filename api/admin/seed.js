const fs = require('fs');
const path = require('path');
const { query } = require('../../lib/db');
const { normalizeEmail } = require('../../lib/roster');
const { ensureSchema } = require('../../lib/schema');
const { hasMatchingSecret } = require('../../lib/security');

const dataPath = path.join(process.cwd(), 'data', 'dashboard_data.json');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!hasMatchingSecret(req.headers['x-admin-secret'], process.env.ADMIN_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    await ensureSchema();

    for (const member of data.staff) {
      const email = normalizeEmail(member.email);
      for (const [month, referrals] of Object.entries(member.by_month || {})) {
        await query(
          `INSERT INTO monthly_staff_baselines (staff_email, month, referrals)
           VALUES ($1, $2, $3)
           ON CONFLICT (staff_email, month) DO UPDATE SET referrals = EXCLUDED.referrals`,
          [email, month, referrals],
        );
      }
    }

    for (const [month, values] of Object.entries(data.monthly || {})) {
      await query(
        `INSERT INTO monthly_baselines (month, referrals)
         VALUES ($1, $2)
         ON CONFLICT (month) DO UPDATE SET referrals = EXCLUDED.referrals`,
        [month, values.referrals],
      );
    }

    res.status(200).json({ ok: true, seeded_months: Object.keys(data.monthly || {}) });
  } catch (error) {
    console.error('Seed error:', error.message);
    res.status(500).json({ error: 'Seed failed' });
  }
};