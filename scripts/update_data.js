// Applies the Aug 1-20, 2026 Eber XM referral pull to dashboard_data.json.
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'dashboard_data.json');
const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// email -> { referrals, vouchers }, staff-matched rows only (non-staff / team account excluded)
const updates = {
  'roqueaia415@gmail.com': { referrals: 11, vouchers: 5 },
  'bhabeangeles@gmail.com': { referrals: 8, vouchers: 0 },
  'shiela.may.calbario@gmail.com': { referrals: 8, vouchers: 1 },
  'samual.salvator61@gmail.com': { referrals: 3, vouchers: 1 },
  'grgkamal777@gmail.com': { referrals: 2, vouchers: 1 },
  'kimberlymatan80@gmail.com': { referrals: 1, vouchers: 0 },
  'nymphrai01@gmail.com': { referrals: 1, vouchers: 0 },
  'rajusubedimala@gmail.com': { referrals: 1, vouchers: 0 },
  'raii.aditi01@gmail.com': { referrals: 1, vouchers: 0 },
};

const monthKey = '2026-08';
const bonusPerReferral = d.bonus_per_referral;

for (const s of d.staff) {
  const u = updates[s.email];
  const referrals = u ? u.referrals : 0;
  s.referrals = referrals;
  s.bonus = referrals * bonusPerReferral;
  s.vouchers = u ? u.vouchers : 0;
  s.by_month = referrals > 0 ? { [monthKey]: referrals } : {};
  s.referrals_this_month = referrals;
  s.bonus_this_month = referrals * bonusPerReferral;
}

// Recompute branch_summary_current from staff
for (const branch of Object.keys(d.branch_summary_current)) {
  const totalStaff = d.branch_summary_current[branch].total_staff;
  const branchStaff = d.staff.filter(s => s.branch === branch);
  const referrals = branchStaff.reduce((sum, s) => sum + s.referrals_this_month, 0);
  const activeReferrers = branchStaff.filter(s => s.referrals_this_month > 0).length;
  d.branch_summary_current[branch] = {
    total_staff: totalStaff,
    referrals,
    bonus: referrals * bonusPerReferral,
    active_referrers: activeReferrers,
  };
}

// Recompute monthly aggregate
const totalReferrals = d.staff.reduce((sum, s) => sum + s.referrals_this_month, 0);
const activeReferrers = d.staff.filter(s => s.referrals_this_month > 0).length;
d.monthly[monthKey] = {
  referrals: totalReferrals,
  bonus: totalReferrals * bonusPerReferral,
  active_referrers: activeReferrers,
};

fs.writeFileSync(dataPath, JSON.stringify(d, null, 2) + '\n');
console.log('Updated. Total referrals:', totalReferrals, 'Active referrers:', activeReferrers);
