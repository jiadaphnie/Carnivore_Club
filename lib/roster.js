const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'dashboard_data.json');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getRosterData() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const staff = data.staff.map(member => ({
    branch: member.branch,
    display_name: member.display_name,
    email: normalizeEmail(member.email),
    full_name: member.full_name,
    is_manager: Boolean(member.is_manager),
    preferred_name: member.preferred_name,
    role: member.role,
  })).filter(member => member.email);

  return {
    bonusPerReferral: data.bonus_per_referral,
    currentMonth: data.current_month,
    monthNames: data.month_names,
    monthly: data.monthly,
    staff,
    storeTargets: data.store_targets,
  };
}

function findEligibleStaff(email) {
  const member = getRosterData().staff.find(staff => staff.email === normalizeEmail(email));
  return member && !member.is_manager ? member : null;
}

module.exports = { findEligibleStaff, getRosterData, normalizeEmail };