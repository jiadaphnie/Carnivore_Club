const fs = require('fs');
const path = require('path');
const { query } = require('./db');

const dataPath = path.join(__dirname, '..', 'data', 'dashboard_data.json');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Bonus config and month labels change rarely and stay file-based; branches live in the database.
function getConfig() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return {
    bonusPerReferral: data.bonus_per_referral,
    currentMonth: data.current_month,
    monthNames: data.month_names,
    monthly: data.monthly,
  };
}

async function getBranchList() {
  return query('SELECT id, name, monthly_target FROM branches ORDER BY id');
}

async function getBranches() {
  return (await getBranchList()).map(branch => branch.name);
}

async function getRosterData() {
  const config = getConfig();
  const branches = await getBranchList();
  const storeTargets = Object.fromEntries(branches.map(branch => [branch.name, branch.monthly_target]));
  const rows = await query(`SELECT email, branch, full_name, preferred_name, display_name, role, is_manager
    FROM staff WHERE active = TRUE ORDER BY branch, display_name`);
  const staff = rows.map(member => ({ ...member, email: normalizeEmail(member.email) }));
  return { ...config, storeTargets, staff };
}

async function findEligibleStaff(email) {
  const rows = await query(`SELECT email, branch, full_name, preferred_name, display_name, role, is_manager
    FROM staff WHERE email = $1 AND active = TRUE AND is_manager = FALSE`, [normalizeEmail(email)]);
  return rows[0] || null;
}

module.exports = { findEligibleStaff, getBranchList, getBranches, getConfig, getRosterData, normalizeEmail };
