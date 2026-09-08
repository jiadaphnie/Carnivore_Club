const fs = require('fs');
const path = require('path');
const { query } = require('./db');

const dataPath = path.join(__dirname, '..', 'data', 'dashboard_data.json');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Branch names, KPI targets, and bonus config change rarely and stay file-based.
function getConfig() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return {
    bonusPerReferral: data.bonus_per_referral,
    currentMonth: data.current_month,
    monthNames: data.month_names,
    monthly: data.monthly,
    storeTargets: data.store_targets,
  };
}

function getBranches() {
  return Object.keys(getConfig().storeTargets);
}

async function getRosterData() {
  const config = getConfig();
  const rows = await query(`SELECT email, branch, full_name, preferred_name, display_name, role, is_manager
    FROM staff WHERE active = TRUE ORDER BY branch, display_name`);
  const staff = rows.map(member => ({ ...member, email: normalizeEmail(member.email) }));
  return { ...config, staff };
}

async function findEligibleStaff(email) {
  const rows = await query(`SELECT email, branch, full_name, preferred_name, display_name, role, is_manager
    FROM staff WHERE email = $1 AND active = TRUE AND is_manager = FALSE`, [normalizeEmail(email)]);
  return rows[0] || null;
}

module.exports = { findEligibleStaff, getBranches, getConfig, getRosterData, normalizeEmail };
