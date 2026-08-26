// Applies the Aug 1-25, 2026 Eber XM referral pull to dashboard_data.json.
// Source: a full "Referral Transactions" CSV export from Eber XM (job_id_120069,
// pulled 2026-08-25), not the paginated report UI - so this is a complete,
// transaction-level rebuild rather than an incremental delta.
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
// - Benedict Buendia (Buendia B B Z), FIS - Soho, was stored as
//   benedictbuendia@gmail.com, but the sheet (row 36) has benedictbuendia3@gmail.com.
//   The wrong email left 44 referrals sitting unattributed under a non-staff
//   "customer" account (Benedict Bosco Buendia) - found while cross-checking the
//   fresh Aug 25 export against unmatched referral emails.
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
  if (s.email === 'benedictbuendia@gmail.com') {
    s.email = 'benedictbuendia3@gmail.com';
  }
}

// New staff member reported by the user (not yet in the FOH Staff Directory
// sheet at the time of this pull): Samita Bhandari, FIS - Soho,
// shamita.bhandari30@gmail.com. Her 5 referrals (Aug 20-21, code WS08HS) had
// been sitting unattributed as a non-staff "customer" account since she
// wasn't in the roster yet. Role defaulted to "Server" (most common role on
// this branch) since it wasn't specified - confirm/correct if wrong.
if (!d.staff.some(s => s.email === 'shamita.bhandari30@gmail.com')) {
  d.staff.push({
    branch: 'FIS - Soho',
    full_name: 'Samita Bhandari',
    role: 'Server',
    preferred_name: 'Samita',
    email: 'shamita.bhandari30@gmail.com',
    is_manager: false,
    display_name: 'Samita',
    referrals: 0,
    bonus: 0,
    vouchers: 0,
    by_month: {},
    referrals_this_month: 0,
    bonus_this_month: 0,
  });
  // total_staff isn't derived from d.staff.length elsewhere in this script,
  // so it has to be bumped here too or "X of Y staff on the board" is wrong.
  d.branch_summary_current['FIS - Soho'].total_staff += 1;
}

// email -> { referrals, vouchers }, staff-matched rows only (non-staff / team
// account / customer word-of-mouth codes excluded). Baseline counted from the
// Aug 1-25 (through 09:57) transaction export by REFERRAL EMAIL, plus 6
// manually-verified referrals from the sheet's "Untracked" tab (Anita +1,
// Raju +3, Aia +1, Ramos +1) that still do not appear anywhere in Eber's own
// export even now - confirmed by searching for all 4 untracked referee
// addresses and finding none of them, so this is a genuine gap in Eber's
// system, not a timing/pagination issue. Updated again with a second export
// (job_id_120115, transaction IDs 606544-607090) covering Aug 24 09:57
// through Aug 25 21:21 - all 48 new rows matched staff, no unattributed
// accounts this round.
//
// A further 19 untracked referrals were reported directly by the TLF
// manager (a "Membership Signup Email" listing referee emails per staff).
// Cross-checked every listed referee email against both raw Eber exports
// before adding anything: Best's all 7 were already fully accounted for
// (not double-counted), Kim had 2 of 4 already tracked (added the other 2),
// Jess's 9 and Karishma's 8 were entirely absent from Eber - none were
// found attributed to a different referrer either, so no conflicts.
//
// Of those 19, individually searched each one in Eber's own People/
// Consumers database (not just the transactions export) to confirm they're
// real registered members. 11 returned zero results - no Eber account
// exists under those emails at all - so per the user's decision they are
// NOT counted as valid referrals: Kim -2 (isahuiowo@gmail.com,
// 1713223231@99.com), Jess -4 (yonghong2024@gmail.com,
// remce_tsang@yahoo.com.hk, cecilialokyee@yahoo.com, chansuny2@hotmail.com),
// Karishma -5 (dlyyyychrisre@gmail.com, sarah.ny.poon@gmail.com,
// kapoernanya213@gmail.com, justison1@gmail.com, jimmy094@dontsp.am - the
// last uses a disposable email domain). The remaining 8 (Kim's other 0,
// Jess's other 5, Karishma's other 3) ARE real Eber members with a
// verified Member Since date and stay counted.
const updates = {
  'shamita.bhandari30@gmail.com': { referrals: 5, vouchers: 4 },
  'jesycabatbat@gmail.com': { referrals: 7, vouchers: 1 },
  'kimberlymatan80@gmail.com': { referrals: 10, vouchers: 1 },
  'karishmarai833@gmail.com': { referrals: 3, vouchers: 0 },
  'omonuwabest00@gmail.com': { referrals: 8, vouchers: 2 },
  'nymphrai01@gmail.com': { referrals: 1, vouchers: 0 },
  'roqueaia415@gmail.com': { referrals: 47, vouchers: 32 },
  'rajusubedimala@gmail.com': { referrals: 61, vouchers: 39 },
  'kangmang456@icloud.com': { referrals: 17, vouchers: 12 },
  'chadanigauchan@gmail.com': { referrals: 5, vouchers: 4 },
  'limbu.neeyara123@gmail.com': { referrals: 15, vouchers: 4 },
  'punmarina99852@gmail.com': { referrals: 17, vouchers: 12 },
  'benedictbuendia3@gmail.com': { referrals: 45, vouchers: 19 },
  'samual.salvator61@gmail.com': { referrals: 10, vouchers: 3 },
  'brivajustin@gmail.com': { referrals: 78, vouchers: 28 },
  'dewansujasna22@gmail.com': { referrals: 2, vouchers: 1 },
  'sharmaanita2746@gmail.com': { referrals: 8, vouchers: 2 },
  'grgkamal777@gmail.com': { referrals: 17, vouchers: 10 },
  'christianjpadua@gmail.com': { referrals: 1, vouchers: 1 },
  'nozomitsuchiya092218@gmail.com': { referrals: 1, vouchers: 0 },
  'wimonwankitiyayam@gmail.com': { referrals: 12, vouchers: 4 },
  'lenykc@gmail.com': { referrals: 6, vouchers: 4 },
  'kellisip08@gmail.com': { referrals: 14, vouchers: 1 },
  'bhabeangeles@gmail.com': { referrals: 16, vouchers: 0 },
  'shiela.may.calbario@gmail.com': { referrals: 17, vouchers: 2 },
  'raii.aditi01@gmail.com': { referrals: 3, vouchers: 2 },
  'bernadete.francia@gmail.com': { referrals: 9, vouchers: 5 },
  'mimosa.summerholics@gmail.com': { referrals: 14, vouchers: 2 },
  'veegabion@gmail.com': { referrals: 3, vouchers: 3 },
  'nurainibassam34@gmail.com': { referrals: 15, vouchers: 2 },
  'princessjaireen17michelle@gmail.com': { referrals: 10, vouchers: 3 },
  'melndm@yahoo.com': { referrals: 1, vouchers: 0 },
  'harronbumagat1@gmail.com': { referrals: 3, vouchers: 2 },
  'rob.doctura@gmail.com': { referrals: 1, vouchers: 0 },
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

// Records when this data was last regenerated (i.e. when this script was run),
// not the timestamp of the latest underlying Eber transaction.
d.last_updated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

fs.writeFileSync(dataPath, JSON.stringify(d, null, 2) + '\n');
console.log('Updated. Total referrals:', totalReferrals, 'Active referrers:', activeReferrers);
