const { audit, requireAdmin, validCsrf } = require('../../lib/auth');
const { query } = require('../../lib/db');
const { findEligibleStaff } = require('../../lib/roster');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const email = String(req.body && req.body.staff_email || '');
  const date = String(req.body && req.body.referral_date || '');
  const note = String(req.body && req.body.note || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || note.length < 3 || note.length > 500) return res.status(400).json({ error: 'Staff, a valid referral date, and a 3-500 character reason are required' });
  const staff = findEligibleStaff(email);
  if (!staff) return res.status(400).json({ error: 'Choose an eligible staff member' });
  try {
    const rows = await query(`INSERT INTO manual_referrals (staff_email, occurred_at, note, created_by)
      VALUES ($1, $2, $3, $4) RETURNING id`, [staff.email, `${date}T12:00:00+08:00`, note, admin.id]);
    await audit(admin.id, 'manual_referral_created', 'manual_referral', rows[0].id, { staff: staff.display_name, branch: staff.branch, referral_date: date, note });
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (error) {
    console.error('Manual referral error:', error.message);
    res.status(500).json({ error: 'Manual referral could not be saved' });
  }
};