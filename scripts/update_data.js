// Applies the Aug 1-20, 2026 Eber XM referral pull to dashboard_data.json.
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'dashboard_data.json');
const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Roster corrections against the FOH Staff Directory (Google Sheet):
// - Justin Briva's email was stored as brivajustinwork@gmail.com, but the sheet
//   (cell G38) has brivajustin@gmail.com. The wrong email misattributed his
//   referrals to a non-staff "customer" account.
// - Tanny (Kitiyayam Wimonwan) and Leny (Vega Leny Carreon), both FIS - Wan Chai,
//   had blank emails in the roster; the sheet has real addresses for both.
// - Marilyn (Espiritu, Marilyn Cabatbat), TLF, updated her email; the sheet
//   (row 6) now shows Jesycabatbat@gmail.com, replacing jesucabatbat@gmail.com.
// - Myles (Estiva Leong Jerilee Myles), TLF & FIS- Macau, confirmed by the user
//   to now be using mimosa.summerholics@gmail.com (was jmyles.leong@gmail.com,
//   which the sheet had not yet been updated to reflect).
for (const s of d.staff) {
  if (s.email === 'brivajustinwork@gmail.com') {
    s.email = 'brivajustin@gmail.com';
  }
  if (s.full_name === 'Kitiyayam Wimonwan' && !s.email) {
    s.email = 'wimonwankitiyayam@gmail.com';
  }
  if (s.full_name === 'Vega Leny Carreon' && !s.email) {
    s.email = 'lenykc@gmail.com';
  }
  if (s.email === 'jesucabatbat@gmail.com') {
    s.email = 'jesycabatbat@gmail.com';
  }
  if (s.email === 'jmyles.leong@gmail.com') {
    s.email = 'mimosa.summerholics@gmail.com';
  }
}

// email -> { referrals, vouchers }, staff-matched rows only (non-staff / team
// account excluded). Covers Aug 1-24, 2026, plus 6 manually-verified referrals
// from the sheet's "Untracked" tab (Anita +1, Raju +3, Aia +1, Ramos +1) that
// the automated Eber report never recorded.
//
// A systemic gap was found and closed: any transaction dated Aug 21 after
// ~16:19 (when the first Aug 1-21 pull was taken) had been missed by both
// that pull and the later Aug 22-24 delta pull, which started at Aug 22
// 00:00. Confirmed by re-pulling each affected person's full history
// directly (Nee, Nabi, Justin) and by re-scanning the whole Aug 21 16:19-
// 23:59 window (Mausam, Kim, Nora, Tanny, Raquel, Best, Myles).
const updates = {
  'roqueaia415@gmail.com': { referrals: 39, vouchers: 25 },
  'brivajustin@gmail.com': { referrals: 77, vouchers: 28 },
  'bhabeangeles@gmail.com': { referrals: 13, vouchers: 0 },
  'shiela.may.calbario@gmail.com': { referrals: 14, vouchers: 2 },
  'samual.salvator61@gmail.com': { referrals: 10, vouchers: 3 },
  'grgkamal777@gmail.com': { referrals: 6, vouchers: 5 },
  'kimberlymatan80@gmail.com': { referrals: 10, vouchers: 1 },
  'nymphrai01@gmail.com': { referrals: 1, vouchers: 0 },
  'rajusubedimala@gmail.com': { referrals: 32, vouchers: 22 },
  'raii.aditi01@gmail.com': { referrals: 1, vouchers: 0 },
  'bernadete.francia@gmail.com': { referrals: 9, vouchers: 5 },
  'nurainibassam34@gmail.com': { referrals: 12, vouchers: 2 },
  'wimonwankitiyayam@gmail.com': { referrals: 10, vouchers: 4 },
  'christianjpadua@gmail.com': { referrals: 1, vouchers: 1 },
  'kellisip08@gmail.com': { referrals: 14, vouchers: 1 },
  'omonuwabest00@gmail.com': { referrals: 8, vouchers: 2 },
  'lenykc@gmail.com': { referrals: 1, vouchers: 1 },
  'limbu.neeyara123@gmail.com': { referrals: 14, vouchers: 4 },
  'punmarina99852@gmail.com': { referrals: 15, vouchers: 10 },
  'chadanigauchan@gmail.com': { referrals: 3, vouchers: 3 },
  'sharmaanita2746@gmail.com': { referrals: 3, vouchers: 1 },
  'veegabion@gmail.com': { referrals: 3, vouchers: 3 },
  'princessjaireen17michelle@gmail.com': { referrals: 4, vouchers: 3 },
  'kangmang456@icloud.com': { referrals: 3, vouchers: 1 },
  'jesycabatbat@gmail.com': { referrals: 1, vouchers: 1 },
  'dewansujasna22@gmail.com': { referrals: 2, vouchers: 1 },
  'melndm@yahoo.com': { referrals: 1, vouchers: 0 },
  'nozomitsuchiya092218@gmail.com': { referrals: 1, vouchers: 0 },
  'mimosa.summerholics@gmail.com': { referrals: 13, vouchers: 2 },
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
