const { query } = require('./db');
const { getRosterData } = require('./roster');

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function monthName(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Hong_Kong' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

async function getDashboard(selectedMonth) {
  const config = getRosterData();
  const currentMonth = currentMonthKey();
  if (selectedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
    const error = new Error('Invalid month');
    error.statusCode = 400;
    throw error;
  }
  const [staffRows, monthlyRows] = await Promise.all([
    query(`
      SELECT staff_email, month, SUM(referrals)::int AS referrals
      FROM (
        SELECT staff_email, month, referrals FROM monthly_staff_baselines
        UNION ALL
        SELECT staff_email, to_char(occurred_at AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM'), 1 FROM referrals
        UNION ALL
        SELECT staff_email, to_char(occurred_at AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM'), 1 FROM manual_referrals
      ) totals
      GROUP BY staff_email, month
    `),
    query(`
      SELECT month, SUM(referrals)::int AS referrals
      FROM monthly_baselines
      GROUP BY month
    `),
  ]);

  const counts = new Map(staffRows.map(row => [`${row.staff_email}:${row.month}`, Number(row.referrals)]));
  const monthly = new Map();
  for (const [key, count] of counts) {
    const month = key.slice(-7);
    monthly.set(month, (monthly.get(month) || 0) + count);
  }
  for (const row of monthlyRows) {
    if (!monthly.has(row.month)) {
      monthly.set(row.month, Number(row.referrals));
    }
  }

  if (!monthly.has(currentMonth)) {
    monthly.set(currentMonth, 0);
  }
  const month = selectedMonth || currentMonth;
  if (!monthly.has(month)) {
    const error = new Error('Month not found');
    error.statusCode = 404;
    throw error;
  }

  const staff = config.staff.map(member => {
    const referralsThisMonth = counts.get(`${member.email}:${month}`) || 0;
    return {
      ...member,
      bonus_this_month: referralsThisMonth * config.bonusPerReferral,
      referrals_this_month: referralsThisMonth,
    };
  });

  const branchSummary = Object.fromEntries(Object.keys(config.storeTargets).map(branch => {
    const branchStaff = staff.filter(member => member.branch === branch);
    const referrals = branchStaff.reduce((total, member) => total + member.referrals_this_month, 0);
    return [branch, {
      active_referrers: branchStaff.filter(member => member.referrals_this_month > 0).length,
      bonus: referrals * config.bonusPerReferral,
      referrals,
      total_staff: branchStaff.length,
    }];
  }));

  const months = Object.fromEntries([...monthly.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, referrals]) => [month, {
    active_referrers: staff.filter(member => (counts.get(`${member.email}:${month}`) || 0) > 0).length,
    bonus: referrals * config.bonusPerReferral,
    referrals,
  }]));
  return {
    available_months: Object.keys(months).sort().reverse(),
    bonus_per_referral: config.bonusPerReferral,
    branch_summary_current: branchSummary,
    current_month: currentMonth,
    last_updated: new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Hong_Kong' }).format(new Date()),
    month_names: Object.fromEntries(Object.keys(months).map(month => [month, config.monthNames[month] || monthName(month)])),
    monthly: months,
    selected_month: month,
    staff,
    store_targets: config.storeTargets,
  };
}

module.exports = { getDashboard };