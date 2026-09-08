const { audit, bootstrapAdmin, clearSessionCookie, hashPassword, hashToken, normalizeUsername, randomToken, requireAdmin, SESSION_COOKIE, setSessionCookie, validCsrf, verifyPassword } = require('../lib/auth');
const { query } = require('../lib/db');
const { findEligibleStaff, getBranches, getRosterData, normalizeEmail } = require('../lib/roster');
const { ensureSchema } = require('../lib/schema');

function route(req) {
  return String(req.query.route || '');
}

function methodNotAllowed(res) {
  res.status(405).json({ error: 'Method not allowed' });
}

async function signIn(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const username = normalizeUsername(req.body && req.body.username);
  const password = String((req.body && req.body.password) || '');
  const rows = await query('SELECT id, username, password_hash, role, active, must_change_password FROM admins WHERE username = $1', [username]);
  const admin = rows[0];
  if (!admin || !admin.active || !await verifyPassword(password, admin.password_hash)) {
    if (admin) await audit(admin.id, 'login_failed', 'admin', admin.id);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  await query(`INSERT INTO admin_sessions (token_hash, admin_id, csrf_token, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '12 hours')`, [hashToken(sessionToken), admin.id, csrfToken]);
  await audit(admin.id, 'login', 'admin', admin.id);
  setSessionCookie(res, sessionToken);
  res.status(200).json({ admin: { username: admin.username, role: admin.role, must_change_password: admin.must_change_password }, csrf_token: csrfToken });
}

async function session(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (admin) res.status(200).json({ admin: { username: admin.username, role: admin.role }, csrf_token: admin.csrf_token });
}

async function signOut(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const match = String(req.headers.cookie || '').match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (match) await query('DELETE FROM admin_sessions WHERE token_hash = $1', [hashToken(decodeURIComponent(match[1]))]);
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

async function changePassword(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const currentPassword = String(req.body && req.body.current_password || '');
  const newPassword = String(req.body && req.body.new_password || '');
  if (newPassword.length < 12) return res.status(400).json({ error: 'New password must have at least 12 characters' });
  const rows = await query('SELECT password_hash FROM admins WHERE id = $1', [admin.id]);
  if (!rows.length || !await verifyPassword(currentPassword, rows[0].password_hash)) return res.status(401).json({ error: 'Current password is incorrect' });
  await query('UPDATE admins SET password_hash = $2, must_change_password = FALSE, updated_at = NOW() WHERE id = $1', [admin.id, await hashPassword(newPassword)]);
  await query('DELETE FROM admin_sessions WHERE admin_id = $1 AND csrf_token <> $2', [admin.id, admin.csrf_token]);
  await audit(admin.id, 'password_changed', 'admin', admin.id);
  res.status(200).json({ ok: true });
}

async function roster(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const staff = (await getRosterData()).staff.filter(member => !member.is_manager).map(({ email, display_name, role, branch }) => ({ email, display_name, role, branch }));
  res.status(200).json({ staff });
}

function validStaffFields(body) {
  const branch = String(body && body.branch || '');
  const fullName = String(body && body.full_name || '').trim();
  const preferredName = String(body && body.preferred_name || '').trim();
  const displayName = String(body && body.display_name || '').trim();
  const email = normalizeEmail(body && body.email);
  const role = String(body && body.role || '').trim();
  const isManager = Boolean(body && body.is_manager);
  if (!getBranches().includes(branch)) return { error: 'Choose a valid branch' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'A valid email is required' };
  if (!fullName || !displayName || !role) return { error: 'Full name, display name, and role are required' };
  return { fields: { branch, displayName, email, fullName, isManager, preferredName, role } };
}

function validMonthlyBaselines(body) {
  const rows = Array.isArray(body && body.monthly_baselines) ? body.monthly_baselines : [];
  const baselines = [];
  for (const row of rows) {
    const month = String(row && row.month || '');
    const referrals = Number(row && row.referrals);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(referrals) || referrals < 0) return null;
    baselines.push({ month, referrals });
  }
  return baselines;
}

async function staffList(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const staff = await query(`SELECT email, branch, full_name, preferred_name, display_name, role, is_manager, active
    FROM staff ORDER BY active DESC, branch, display_name`);
  res.status(200).json({ branches: getBranches(), staff });
}

async function createStaff(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const { error, fields } = validStaffFields(req.body);
  if (error) return res.status(400).json({ error });
  const baselines = validMonthlyBaselines(req.body);
  if (baselines === null) return res.status(400).json({ error: 'Each past referral row needs a YYYY-MM month and a non-negative whole number' });
  try {
    await query(`INSERT INTO staff (email, branch, full_name, preferred_name, display_name, role, is_manager, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [fields.email, fields.branch, fields.fullName, fields.preferredName, fields.displayName, fields.role, fields.isManager, admin.id]);
  } catch {
    return res.status(409).json({ error: 'That email is already registered to a staff member' });
  }
  for (const baseline of baselines) {
    await query(`INSERT INTO monthly_staff_baselines (staff_email, month, referrals)
      VALUES ($1, $2, $3) ON CONFLICT (staff_email, month) DO UPDATE SET referrals = EXCLUDED.referrals`,
      [fields.email, baseline.month, baseline.referrals]);
  }
  await audit(admin.id, 'staff_created', 'staff', fields.email, { branch: fields.branch, display_name: fields.displayName });
  res.status(201).json({ ok: true, email: fields.email });
}

async function updateStaff(req, res, email) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const { error, fields } = validStaffFields({ ...req.body, email });
  if (error) return res.status(400).json({ error });
  const target = await query(`UPDATE staff SET branch = $2, full_name = $3, preferred_name = $4, display_name = $5, role = $6, is_manager = $7, updated_at = NOW()
    WHERE email = $1 RETURNING email`, [normalizeEmail(email), fields.branch, fields.fullName, fields.preferredName, fields.displayName, fields.role, fields.isManager]);
  if (!target.length) return res.status(404).json({ error: 'Staff member not found' });
  await audit(admin.id, 'staff_updated', 'staff', email, { branch: fields.branch, display_name: fields.displayName });
  res.status(200).json({ ok: true });
}

async function setStaffActive(req, res, email, active) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const target = await query('UPDATE staff SET active = $2, updated_at = NOW() WHERE email = $1 RETURNING email',
    [normalizeEmail(email), active]);
  if (!target.length) return res.status(404).json({ error: 'Staff member not found' });
  await audit(admin.id, active ? 'staff_reactivated' : 'staff_deactivated', 'staff', email);
  res.status(200).json({ ok: true });
}

async function manualReferral(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const email = String(req.body && req.body.staff_email || '');
  const date = String(req.body && req.body.referral_date || '');
  const note = String(req.body && req.body.note || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || note.length < 3 || note.length > 500) return res.status(400).json({ error: 'Staff, a valid referral date, and a 3-500 character reason are required' });
  const staff = await findEligibleStaff(email);
  if (!staff) return res.status(400).json({ error: 'Choose an eligible staff member' });
  const rows = await query(`INSERT INTO manual_referrals (staff_email, occurred_at, note, created_by)
    VALUES ($1, $2, $3, $4) RETURNING id`, [staff.email, `${date}T12:00:00+08:00`, note, admin.id]);
  await audit(admin.id, 'manual_referral_created', 'manual_referral', rows[0].id, { staff: staff.display_name, branch: staff.branch, referral_date: date, note });
  res.status(201).json({ ok: true, id: rows[0].id });
}

async function auditLog(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const entries = await query(`SELECT l.id, l.action, l.target_type, l.details, l.created_at, a.username
    FROM audit_log l LEFT JOIN admins a ON a.id = l.admin_id ORDER BY l.created_at DESC LIMIT 100`);
  res.status(200).json({ entries });
}

async function users(req, res) {
  const admin = await requireAdmin(req, res, true);
  if (!admin) return;
  if (req.method === 'GET') {
    const entries = await query('SELECT id, username, role, active, must_change_password, created_at FROM admins ORDER BY created_at');
    return res.status(200).json({ users: entries });
  }
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  const username = normalizeUsername(req.body && req.body.username);
  const password = String(req.body && req.body.password || '');
  if (!/^[a-z0-9._-]{3,50}$/.test(username) || password.length < 12) return res.status(400).json({ error: 'Use a 3-50 character username and a password of at least 12 characters' });
  try {
    const created = await query("INSERT INTO admins (username, password_hash, role, must_change_password) VALUES ($1, $2, 'admin', TRUE) RETURNING id, username", [username, await hashPassword(password)]);
    await audit(admin.id, 'admin_created', 'admin', created[0].id, { username });
    res.status(201).json({ user: created[0] });
  } catch {
    res.status(409).json({ error: 'That username is already in use' });
  }
}

async function manageUser(req, res, action, targetId) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const admin = await requireAdmin(req, res, true);
  if (!admin) return;
  if (!validCsrf(req, admin)) return res.status(403).json({ error: 'Invalid request token' });
  if (action === 'disable') {
    if (targetId === admin.id) return res.status(400).json({ error: 'You cannot disable your own account' });
    const target = await query('UPDATE admins SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING username', [targetId]);
    if (!target.length) return res.status(404).json({ error: 'Admin not found' });
    await query('DELETE FROM admin_sessions WHERE admin_id = $1', [targetId]);
    await audit(admin.id, 'admin_disabled', 'admin', targetId, { username: target[0].username });
    return res.status(200).json({ ok: true });
  }
  const password = String(req.body && req.body.password || '');
  if (password.length < 12) return res.status(400).json({ error: 'Temporary password must have at least 12 characters' });
  const target = await query('UPDATE admins SET password_hash = $2, must_change_password = TRUE, updated_at = NOW() WHERE id = $1 RETURNING username', [targetId, await hashPassword(password)]);
  if (!target.length) return res.status(404).json({ error: 'Admin not found' });
  await query('DELETE FROM admin_sessions WHERE admin_id = $1', [targetId]);
  await audit(admin.id, 'password_reset', 'admin', targetId, { username: target[0].username });
  res.status(200).json({ ok: true });
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();
    await bootstrapAdmin();
    const path = route(req);
    if (path === 'auth/login') return signIn(req, res);
    if (path === 'auth/me') return session(req, res);
    if (path === 'auth/logout') return signOut(req, res);
    if (path === 'auth/change-password') return changePassword(req, res);
    if (path === 'roster') return roster(req, res);
    if (path === 'manual-referrals') return manualReferral(req, res);
    if (path === 'audit-log') return auditLog(req, res);
    if (path === 'users') return users(req, res);
    const match = path.match(/^users\/([^/]+)\/(disable|reset-password)$/);
    if (match) return manageUser(req, res, match[2], match[1]);
    if (path === 'staff') return req.method === 'GET' ? staffList(req, res) : createStaff(req, res);
    const staffMatch = path.match(/^staff\/([^/]+)\/(update|deactivate|reactivate)$/);
    if (staffMatch) {
      const [, email, action] = staffMatch;
      if (action === 'update') return updateStaff(req, res, decodeURIComponent(email));
      return setStaffActive(req, res, decodeURIComponent(email), action === 'reactivate');
    }
    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Admin API error:', error.message);
    res.status(500).json({ error: 'Admin service is temporarily unavailable' });
  }
};