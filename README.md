# Carnivore Club Referral Leaderboard

A monthly, branch-by-branch referral leaderboard for Carnivore Club FOH staff, built from Eber XM referral transaction data joined against the FOH Staff Directory.

## What it shows
- This month's referral count, total bonus pool (HKD 10 per referral), and staff participation
- Branch leaderboard and individual top-referrers leaderboard
- Store KPI targets vs. referral-driven share
- Monthly trend (grows as more months of data are pulled)
- Full roster by branch, including staff with zero referrals so far

Managers (Manager, Assistant Manager, Restaurant Manager, Floor Manager, and the AM/RM/BM role codes) are excluded from the competition.

## Live updates
The deployed dashboard loads its live data from `/api/dashboard`. Eber sends a `user_create` webhook whenever a member is created. The webhook handler fetches that member from Eber's API, reads `referral_user_id`, resolves the staff referrer, and records one referral in Neon Postgres.

Eber webhook provisioning is not currently available for this account. Instead, the first visit after 15 minutes automatically checks Eber for members added since the last successful sync, with a 30-minute overlap for delayed records. The visitor sees the saved dashboard while the sync runs, then the page refreshes its data. If nobody visits, no sync runs.

The current `data/dashboard_data.json` is retained as the source roster/configuration and as the one-time seed for the existing historical totals. New webhook referrals are added to those seeded totals. Staff eligibility, branch, role, and display name come from this versioned roster; Eber staff tiers/tags are checked as a second eligibility signal.

Referrals count immediately in the `Asia/Hong_Kong` month. Cancellation/reversal reconciliation is intentionally out of scope.

### Historical months
The dashboard opens on the current Hong Kong month. Select a prior month from the dashboard control, or link directly with `?month=YYYY-MM`, for example `/?month=2026-08`.

### One-time September 2026 backfill
The `POST /api/admin/backfill` route imports members created in September 2026 from Eber and applies the same eligible-staff and duplicate rules as the webhook. It is disabled unless `BACKFILL_ENABLED=true` is set in Vercel.

1. Set `BACKFILL_ENABLED=true` in Vercel Production environment variables and redeploy.
2. Run the endpoint once with `X-Admin-Secret` set to `ADMIN_SECRET`.
3. Check the returned `scanned`, `recorded`, `duplicate`, `no_referrer`, `ineligible_referrer`, and `failures` totals. Do not treat a response with failures as complete.
4. Compare `/api/dashboard?month=2026-09` against Eber's Referral Transactions report.
5. Set `BACKFILL_ENABLED=false`, redeploy, and remove the endpoint in a later cleanup change.

The import is safe to retry because each Eber referee ID is stored once. It imports only referrals represented by Eber's `referral_user_id`; it does not recreate manually verified referrals absent from Eber.

## Admin console
Visit `/admin/` to add manual referrals and review the audit log. Manual entries require an eligible staff member, referral date, and a reason; they are included in the leaderboard immediately.

To create the first super-admin, set these Vercel Production environment variables and deploy:

```text
BOOTSTRAP_ADMIN_USERNAME
BOOTSTRAP_ADMIN_PASSWORD
BOOTSTRAP_ENABLED=true
```

Sign in once at `/admin/` to create the super-admin account. That account can create named administrators, reset their passwords, and disable their access. New administrators receive a temporary password and must change it after signing in. Set `BOOTSTRAP_ENABLED=false` and redeploy after the first account exists.

Admin passwords and sessions are stored as hashes in Neon. Every manual referral and account-management action is recorded in the admin audit log.

### One-time deployment setup
1. Create a Neon Postgres database and set its pooled connection string as `DATABASE_URL` in Vercel.
2. In Vercel, add `EBER_API_KEY`, `EBER_WEBHOOK_SECRET`, and `ADMIN_SECRET`. Generate the last two as unique long random values.
3. Deploy this repository to Vercel.
4. Create an Eber webhook with topic `user_create`, address `https://referral-dashboard-sable.vercel.app/api/eber-webhook`, and custom header `X-Eber-Webhook-Secret` set to the same value as `EBER_WEBHOOK_SECRET`.
5. Seed the existing snapshot once by POSTing to `/api/admin/seed` with header `X-Admin-Secret` set to `ADMIN_SECRET`.
6. Create one controlled Eber referral and verify the live leaderboard increments once.

The API key uses HTTP Basic Auth with the key as the username and an empty password. The incoming webhook uses a shared custom header because the supplied Eber HMAC documentation applies to web-app login URLs, not webhook request signing.

### Local development
Install Node.js 20 or later, then run:

```bash
npm install
cp .env.example .env
npm run dev
```

Set real values only in `.env` and Vercel Environment Variables. Do not commit API keys, database URLs, webhook secrets, Eber user-response captures, or staff/customer contact data beyond the minimum roster fields already used by the dashboard.

## Deploying
Vercel hosts the page and serverless API endpoints. A static host alone cannot receive Eber webhooks or provide live dashboard data.
