"""Save a screenshot of a finished week's branch results to weekly-results/.

Usage: python scripts/capture_week.py [YYYY-MM-DD]
The date can be any day in the week to capture; default is yesterday (Hong Kong), i.e.
the Sunday that just ended when run on Monday. Weeks are Monday-Sunday.
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

SITE = "https://referral-dashboard-sable.vercel.app/"
OUT = Path(__file__).resolve().parent.parent / "weekly-results"

hk_now = datetime.now(timezone(timedelta(hours=8)))
day = datetime.strptime(sys.argv[1], "%Y-%m-%d").date() if len(sys.argv) > 1 else (hk_now - timedelta(days=1)).date()
monday = day - timedelta(days=day.weekday())
sunday = monday + timedelta(days=6)

OUT.mkdir(exist_ok=True)
target = OUT / f"week_{monday.isoformat()}_to_{sunday.isoformat()}.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 920, "height": 1200}, device_scale_factor=2)
    page.goto(f"{SITE}?week={day.isoformat()}", wait_until="networkidle")
    page.wait_for_selector("#week-view .wk-card", timeout=60000)
    page.add_style_tag(content="#carnivy {display:none !important}")
    section = page.locator("section", has=page.locator("#week-view"))
    section.screenshot(path=str(target))
    browser.close()
print(target)
