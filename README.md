# Carnivore Club Referral Leaderboard

A monthly, branch-by-branch referral leaderboard for Carnivore Club FOH staff, built from Eber XM referral transaction data joined against the FOH Staff Directory.

## What it shows
- This month's referral count, total bonus pool (HKD 10 per referral), and staff participation
- Branch leaderboard and individual top-referrers leaderboard
- Store KPI targets vs. referral-driven share
- Monthly trend (grows as more months of data are pulled)
- Full roster by branch, including staff with zero referrals so far

Managers (Manager, Assistant Manager, Restaurant Manager, Floor Manager, and the AM/RM/BM role codes) are excluded from the competition.

## Refreshing the data
This is currently a static snapshot, refreshed manually: re-pull the Referral Transactions report (Eber XM → Insights → Referral → Referral Transactions, All Time), update the transaction list and staff export, regenerate `data/dashboard_data.json`, and rebuild `index.html`.

**In progress:** an unattended Python/Playwright script to automate this pull on a schedule, since Eber XM has no API or webhooks. See `EBER_LIVE_DASHBOARD_PROGRESS.md` in the parent `Carnivore_Club` folder for the current plan, decisions made, and next steps.

## Deploying
This is a single self-contained `index.html` — no build step. Deploy as a static site on Vercel (or any static host).
