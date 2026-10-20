// Weekly competition windows: Monday-Sunday weeks in Asia/Hong_Kong, clipped to the month.
// A branch's weekly target is its monthly target pro-rated by days in the window, rounded up.

function hkToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit', month: '2-digit', timeZone: 'Asia/Hong_Kong', year: 'numeric',
  }).formatToParts(now);
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { day: Number(v.day), month: `${v.year}-${v.month}` };
}

const pad = n => String(n).padStart(2, '0');

// Returns { start, end, days, daysInMonth, daysLeft, label, isCurrent } with ISO dates (YYYY-MM-DD).
// anchorDay picks any day of the month to find its week; defaults to today (or the month's last day for past months).
function weekWindow(monthKey, now = new Date(), anchorDay) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = hkToday(now);
  const anchor = anchorDay || (today.month === monthKey ? today.day : daysInMonth);
  const weekday = (new Date(Date.UTC(year, month - 1, anchor)).getUTCDay() + 6) % 7; // Mon=0
  const startDay = Math.max(anchor - weekday, 1);
  const endDay = Math.min(anchor - weekday + 6, daysInMonth);
  const isCurrent = today.month === monthKey && today.day >= startDay && today.day <= endDay;
  const iso = day => `${monthKey}-${pad(day)}`;
  const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
  return {
    days: endDay - startDay + 1,
    daysInMonth,
    daysLeft: isCurrent ? endDay - today.day : 0,
    end: iso(endDay),
    isCurrent,
    label: `${startDay} \u2013 ${endDay} ${monthShort}`,
    start: iso(startDay),
  };
}

function weeklyTarget(monthlyTarget, window) {
  return Math.ceil(monthlyTarget * window.days / window.daysInMonth);
}

module.exports = { weekWindow, weeklyTarget };
