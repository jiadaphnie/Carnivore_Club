// Regenerates the dynamic sections of index.html from data/dashboard_data.json.
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'dashboard_data.json');
const htmlPath = path.join(__dirname, '..', 'index.html');
const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const monthKey = d.current_month;
const monthName = d.month_names[monthKey];
const monthStats = d.monthly[monthKey];
const branchOrder = Object.keys(d.store_targets); // fixed display order used across the page

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pct(n, denom) {
  if (!denom) return '0.0';
  return (n / denom * 100).toFixed(1);
}

// ---------- KPI grid ----------
const kpiHtml = `
    <div class="kpi-tile">
      <div class="kpi-value">${monthStats.referrals}</div>
      <div class="kpi-label">Referrals this month</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-value">HKD ${monthStats.bonus}</div>
      <div class="kpi-label">Total referral bonus</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-value">${monthStats.active_referrers} <span style="font-size:14px;color:var(--text-secondary);font-weight:500;">/ ${d.staff.length}</span></div>
      <div class="kpi-label">Staff on the board</div>
    </div>`;

// ---------- MVP card ----------
const ranked = d.staff.filter(s => s.referrals_this_month > 0)
  .sort((a, b) => b.referrals_this_month - a.referrals_this_month || b.bonus_this_month - a.bonus_this_month);
const mvp = ranked[0];
const mvpHtml = mvp ? `
      <div class="mvp-card">
        <div class="mvp-avatar">${esc(mvp.display_name[0])}</div>
        <div class="mvp-info">
          <div class="mvp-label">👑 ${esc(monthName)} MVP</div>
          <div class="mvp-name">${esc(mvp.display_name)}</div>
          <div class="mvp-meta">${esc(mvp.branch)} · ${esc(mvp.role)}</div>
        </div>
        <div class="mvp-stats">
          <div class="mvp-stat"><div class="mvp-stat-value">${mvp.referrals_this_month}</div><div class="mvp-stat-label">referrals</div></div>
          <div class="mvp-stat"><div class="mvp-stat-value">HKD ${mvp.bonus_this_month}</div><div class="mvp-stat-label">referral bonus</div></div>
        </div>
      </div>
` : '';

// ---------- Branch leaderboard ----------
const branchRanked = branchOrder
  .map(name => ({ name, ...d.branch_summary_current[name] }))
  .sort((a, b) => b.referrals - a.referrals); // stable: JS sort is stable, ties keep branchOrder order

const medals = ['gold', 'silver', 'bronze'];
const medalIcons = ['🥇', '🥈', '🥉'];

const branchListHtml = branchRanked.map((b, i) => {
  const target = d.store_targets[b.name];
  const targetShare = pct(b.referrals, target);
  const targetMet = b.referrals >= target;
  const emptyNote = b.referrals === 0
    ? `\n          <div class="empty-note">No referrals logged yet this month. First one on the board wins bragging rights 👀</div>`
    : '';
  const value = b.referrals === 0 ? 'n/a' : `HKD ${b.bonus} bonus`;
  const label = b.referrals === 1 ? 'referral' : 'referrals';
  return `      <li class="branch-card">
        <div class="rank-badge${i < 3 ? ' ' + medals[i] : (b.referrals === 0 ? ' muted-badge' : '')}">${i < 3 ? medalIcons[i] : i + 1}</div>
        <div class="branch-main">
          <div class="branch-name-line">
            <span class="branch-name">${esc(b.name)}</span>
            <span class="branch-sub">${b.active_referrers} of ${b.total_staff} staff on the board · target ${target.toLocaleString()}/mo</span>
          </div>
          <div class="track"><div class="fill" style="width:${Math.min(Number(targetShare), 100)}%"></div></div>${emptyNote}
        </div>
        <div class="branch-stats">
          <div class="lb-count">${b.referrals}</div>
          <div class="lb-count-label">${label}</div>
          <div class="lb-value">${value}</div>
          <div class="target-badge${targetMet ? ' met' : ''}">${targetShare}% of target</div>
        </div>
      </li>`;
}).join('\n');

// ---------- Top referrers (top 3 only, condensed podium) ----------
const top3 = ranked.slice(0, 3);
const topHtml = top3.map((s, i) => {
  const label = s.referrals_this_month === 1 ? 'referral' : 'referrals';
  return `      <li class="top3-card">
        <div class="rank-badge ${medals[i]}">${medalIcons[i]}</div>
        <div class="avatar">${esc(s.display_name[0])}</div>
        <div class="top3-name">${esc(s.display_name)}</div>
        <div class="top3-meta">${esc(s.branch)} · ${esc(s.role)}</div>
        <div class="top3-count">${s.referrals_this_month}</div>
        <div class="top3-count-label">${label}</div>
        <div class="top3-value">HKD ${s.bonus_this_month} bonus</div>
      </li>`;
}).join('\n');

// ---------- Monthly trend ----------
const monthKeys = Object.keys(d.monthly).sort();
const maxMonthly = Math.max(...monthKeys.map(k => d.monthly[k].referrals), 1);
const trendHtml = monthKeys.map(k => {
  const isCurrent = k === monthKey;
  const height = Math.round(d.monthly[k].referrals / maxMonthly * 100);
  return `      <div class="trend-col${isCurrent ? ' current' : ''}">
        <div class="trend-bar-track">
          <div class="trend-bar" style="height:${height}%"></div>
        </div>
        <div class="trend-value">${d.monthly[k].referrals}</div>
        <div class="trend-label">${esc(d.month_names[k])}</div>
      </div>`;
}).join('\n');
const trendHint = monthKeys.length <= 1
  ? 'Only one month on record so far. This chart will fill in as more months of referral data come through Eber.'
  : `Referrals per month across ${monthKeys.length} months on record.`;

// ---------- Full roster ----------
// Roster sections are ordered by referral count desc (most active branch first), matching leaderboard order
const rosterOrder = branchRanked.map(b => b.name);
const rosterHtmlOrdered = rosterOrder.map((name, idx) => {
  const branchStaff = d.staff.filter(s => s.branch === name)
    .sort((a, b) => b.referrals_this_month - a.referrals_this_month);
  const b = d.branch_summary_current[name];
  const rows = branchStaff.map(s => {
    return `          <tr class="${s.referrals_this_month === 0 ? 'zero' : ''}">
            <td class="col-name">${esc(s.display_name)} <span class="row-role">${esc(s.role)}</span></td>
            <td class="col-num">${s.referrals_this_month}</td>
            <td class="col-num">${s.referrals_this_month > 0 ? 'HKD ' + s.bonus_this_month : 'n/a'}</td>
          </tr>`;
  }).join('\n');
  const label = b.referrals === 1 ? 'referral' : 'referrals';
  return `      <details class="branch-detail"${idx === 0 ? ' open' : ''}>
        <summary>
          <span class="summary-name">${esc(name)}</span>
          <span class="summary-stats">${b.referrals} ${label} · ${b.total_staff} staff</span>
        </summary>
        <table class="roster-table">
          <thead><tr><th>Name</th><th>Referrals</th><th>Referral bonus</th></tr></thead>
          <tbody>
${rows}</tbody>
        </table>
      </details>`;
}).join('\n');

// ---------- Splice into index.html ----------
let html = fs.readFileSync(htmlPath, 'utf8');

function replaceBetween(html, startMarker, endMarker, newInner) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) throw new Error('start marker not found: ' + startMarker);
  const contentStart = startIdx + startMarker.length;
  const endIdx = html.indexOf(endMarker, contentStart);
  if (endIdx === -1) throw new Error('end marker not found: ' + endMarker);
  return html.slice(0, contentStart) + newInner + html.slice(endIdx);
}

html = replaceBetween(html, '<div class="kpi-grid">', '\n  </div>', kpiHtml);
html = replaceBetween(html, '<!-- MVP_START -->', '<!-- MVP_END -->', mvpHtml);
html = replaceBetween(html, '<ul class="branch-list">', '\n    </ul>', '\n' + branchListHtml + '\n    ');
html = replaceBetween(html, '<ul class="top3-grid">', '\n    </ul>', '\n' + topHtml + '\n    ');
html = replaceBetween(html, '<div class="trend-row">', '\n      </div>', '\n' + trendHtml + '\n      ');
html = html.replace(/<div class="section-hint">Only one month on record so far\..*?<\/div>/,
  `<div class="section-hint">${esc(trendHint)}</div>`);
html = replaceBetween(html, '<!-- ROSTER_START -->', '<!-- ROSTER_END -->', '\n' + rosterHtmlOrdered + '\n    ');

// Update month-title headings and meta line
html = html.replace(/Showing [A-Za-z]+ \d{4} · resets each month/, `Showing ${esc(monthName)} · resets each month`);
html = html.replace(/Branch leaderboard · [A-Za-z]+ \d{4}/, `Branch leaderboard · ${esc(monthName)}`);
html = html.replace(/Top 3 referrers · [A-Za-z]+ \d{4}/, `Top 3 referrers · ${esc(monthName)}`);
html = html.replace(/Full roster by branch · [A-Za-z]+ \d{4}/, `Full roster by branch · ${esc(monthName)}`);
html = html.replace(/<p class="last-updated">Last updated .*?<\/p>/, `<p class="last-updated">Last updated ${esc(d.last_updated)}</p>`);

fs.writeFileSync(htmlPath, html);
console.log('index.html regenerated.');
