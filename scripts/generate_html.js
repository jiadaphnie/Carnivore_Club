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

const maxBranchReferrals = Math.max(...branchRanked.map(b => b.referrals), 1);
const medals = ['gold', 'silver', 'bronze'];
const medalIcons = ['🥇', '🥈', '🥉'];

const branchListHtml = branchRanked.map((b, i) => {
  const rankBadge = i < 3
    ? `<div class="rank-badge ${medals[i]}">${medalIcons[i]}</div>`
    : `<div class="rank-badge${b.referrals === 0 ? ' muted-badge' : ''}">${i + 1}</div>`;
  const width = Math.round(b.referrals / maxBranchReferrals * 100);
  const targetShare = pct(b.referrals, d.store_targets[b.name]);
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
            <span class="branch-sub">${b.active_referrers} of ${b.total_staff} staff on the board</span>
          </div>
          <div class="track"><div class="fill" style="width:${width}%"></div></div>${emptyNote}
        </div>
        <div class="branch-stats">
          <div class="lb-count">${b.referrals}</div>
          <div class="lb-count-label">${label}</div>
          <div class="lb-value">${value}</div>
          <div class="lb-target">${targetShare}% of target</div>
        </div>
      </li>`;
}).join('\n');

// ---------- Top referrers ----------
const topHtml = ranked.map((s, i) => {
  const rankBadge = i < 3 ? `<div class="rank-badge ${medals[i]}">${medalIcons[i]}</div>` : `<div class="rank-badge">${i + 1}</div>`;
  const width = Math.round(s.referrals_this_month / ranked[0].referrals_this_month * 100);
  const voucherTag = s.vouchers > 0
    ? `\n            <span class="tag tag-voucher">🎁 ${s.vouchers} voucher${s.vouchers > 1 ? 's' : ''}</span>`
    : '';
  const label = s.referrals_this_month === 1 ? 'referral' : 'referrals';
  return `      <li class="lb-row">
        ${rankBadge}
        <div class="avatar">${esc(s.display_name[0])}</div>
        <div class="lb-main">
          <div class="lb-name-line">
            <span class="lb-name">${esc(s.display_name)}</span>${voucherTag}
          </div>
          <div class="lb-meta">${esc(s.branch)} · ${esc(s.role)}</div>
          <div class="track"><div class="fill" style="width:${width}%"></div></div>
        </div>
        <div class="lb-stats">
          <div class="lb-count">${s.referrals_this_month}</div>
          <div class="lb-count-label">${label}</div>
          <div class="lb-value">HKD ${s.bonus_this_month} bonus</div>
        </div>
      </li>`;
}).join('\n');

// ---------- Analytics table ----------
const analyticsRows = branchOrder.map(name => {
  const b = d.branch_summary_current[name];
  const target = d.store_targets[name];
  const share = pct(b.referrals, target);
  const barWidth = Math.round(b.referrals / target * 100);
  return `      <tr>
        <td class="col-name">${esc(name)}</td>
        <td class="col-num">${target}</td>
        <td class="col-num">${b.referrals}</td>
        <td class="col-num">${share}%</td>
        <td class="col-bar"><div class="track track-sm"><div class="fill" style="width:${barWidth}%"></div></div></td>
      </tr>`;
}).join('\n');

const totalTarget = Object.values(d.store_targets).reduce((a, b) => a + b, 0);
const totalShare = pct(monthStats.referrals, totalTarget);
const analyticsFoot = `        <tr>
            <td class="col-name"><strong>TOTAL</strong></td>
            <td class="col-num"><strong>${totalTarget.toLocaleString()}</strong></td>
            <td class="col-num"><strong>${monthStats.referrals}</strong></td>
            <td class="col-num"><strong>${totalShare}%</strong></td>
            <td></td>
          </tr>`;

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
const rosterHtml = branchOrder.map((name, idx) => {
  const branchStaff = d.staff.filter(s => s.branch === name)
    .sort((a, b) => b.referrals_this_month - a.referrals_this_month);
  const b = d.branch_summary_current[name];
  const rows = branchStaff.map(s => {
    const voucherTag = s.vouchers > 0 ? ` <span class="tag tag-voucher">🎁×${s.vouchers}</span>` : '';
    return `          <tr class="${s.referrals_this_month === 0 ? 'zero' : ''}">
            <td class="col-name">${esc(s.display_name)} <span class="row-role">${esc(s.role)}</span>${voucherTag}</td>
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

// Sort roster sections by referral count desc (most active branch first), matching leaderboard order
const rosterOrder = branchRanked.map(b => b.name);
const rosterHtmlOrdered = rosterOrder.map((name, idx) => {
  const branchStaff = d.staff.filter(s => s.branch === name)
    .sort((a, b) => b.referrals_this_month - a.referrals_this_month);
  const b = d.branch_summary_current[name];
  const rows = branchStaff.map(s => {
    const voucherTag = s.vouchers > 0 ? ` <span class="tag tag-voucher">🎁×${s.vouchers}</span>` : '';
    return `          <tr class="${s.referrals_this_month === 0 ? 'zero' : ''}">
            <td class="col-name">${esc(s.display_name)} <span class="row-role">${esc(s.role)}</span>${voucherTag}</td>
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
html = replaceBetween(html, '<ul class="lb-list">', '\n    </ul>', '\n' + topHtml + '\n    ');
html = replaceBetween(html, '<tbody>\n', '</tbody>\n        <tfoot>', analyticsRows + '\n      ');
html = replaceBetween(html, '<tfoot>\n', '</tfoot>', '          ' + analyticsFoot.trim() + '\n        ');
html = replaceBetween(html, '<div class="trend-row">', '\n      </div>', '\n' + trendHtml + '\n      ');
html = html.replace(/<div class="section-hint">Only one month on record so far\..*?<\/div>/,
  `<div class="section-hint">${esc(trendHint)}</div>`);
html = replaceBetween(html, '<!-- ROSTER_START -->', '<!-- ROSTER_END -->', '\n' + rosterHtmlOrdered + '\n    ');

// Update month-title headings and meta line
html = html.replace(/Showing [A-Za-z]+ \d{4} · resets each month/, `Showing ${esc(monthName)} · resets each month`);
html = html.replace(/Branch leaderboard · [A-Za-z]+ \d{4}/, `Branch leaderboard · ${esc(monthName)}`);
html = html.replace(/Top referrers · [A-Za-z]+ \d{4}/, `Top referrers · ${esc(monthName)}`);
html = html.replace(/Full roster by branch · [A-Za-z]+ \d{4}/, `Full roster by branch · ${esc(monthName)}`);

fs.writeFileSync(htmlPath, html);
console.log('index.html regenerated.');
