"""
Job Search Automation - Main Entry Point
Run manually: python main.py
Test mode:    python main.py --test
Schedule:     .\setup_scheduler.ps1  (runs daily at 08:00)
"""
import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ── Logging setup ──────────────────────────────────────────────────────────────
LOG_DIR = Path("data/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)
log_file = LOG_DIR / f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ],
)
logger = logging.getLogger("main")

# ── Deduplication cache ────────────────────────────────────────────────────────
SENT_JOBS_FILE = Path("data/sent_jobs.json")


def load_sent_ids() -> set[str]:
    if SENT_JOBS_FILE.exists():
        try:
            return set(json.loads(SENT_JOBS_FILE.read_text(encoding="utf-8")))
        except Exception:
            return set()
    return set()


def save_sent_ids(ids: set[str]) -> None:
    SENT_JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    # Keep last 2000 IDs to prevent file bloat
    trimmed = list(ids)[-2000:]
    SENT_JOBS_FILE.write_text(json.dumps(trimmed, indent=2), encoding="utf-8")


# ── Scraper runner ─────────────────────────────────────────────────────────────

def run_scrapers() -> list:
    from scrapers import (
        scrape_remoteok,
        scrape_jobicy,
        scrape_weworkremotely,
        scrape_linkedin,
        scrape_itviec,
        scrape_topdev,
    )

    scraper_funcs = [
        ("RemoteOK", scrape_remoteok),
        ("Jobicy", scrape_jobicy),
        ("WeWorkRemotely", scrape_weworkremotely),
        ("LinkedIn", scrape_linkedin),
        ("ITViec", scrape_itviec),
        ("TopDev", scrape_topdev),
    ]

    all_jobs = []
    for name, fn in scraper_funcs:
        try:
            logger.info(f"Scraping {name}...")
            jobs = fn()
            logger.info(f"  → {len(jobs)} jobs from {name}")
            all_jobs.extend(jobs)
        except Exception as e:
            logger.error(f"  ✗ {name} failed: {e}")
        time.sleep(1.5)

    return all_jobs


# ── Main pipeline ──────────────────────────────────────────────────────────────

def run_job_search() -> None:
    run_time = datetime.now()
    logger.info(f"{'='*50}")
    logger.info(f"Job search started at {run_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"{'='*50}")

    # 1. Scrape
    all_jobs = run_scrapers()
    logger.info(f"Total raw jobs collected: {len(all_jobs)}")

    if not all_jobs:
        logger.warning("No jobs collected from any source.")

    # 2. Deduplicate by URL
    seen_urls: dict[str, object] = {}
    for job in all_jobs:
        if job.url and job.url not in seen_urls:
            seen_urls[job.url] = job
    unique_jobs = list(seen_urls.values())
    logger.info(f"After URL dedup: {len(unique_jobs)} jobs")

    # 3. Filter active jobs only
    from config import SCORING
    active_jobs = [j for j in unique_jobs if j.is_active(SCORING["active_days_threshold"])]
    logger.info(f"Active jobs (≤{SCORING['active_days_threshold']} days old): {len(active_jobs)}")

    # 4. Filter already sent
    sent_ids = load_sent_ids()
    new_jobs = [j for j in active_jobs if j.job_id() not in sent_ids]
    logger.info(f"New (not previously sent): {len(new_jobs)} jobs")

    # 5. Match & rank
    from processors import rank_jobs
    ranked = rank_jobs(new_jobs)
    logger.info(f"After match filter (≥{SCORING['min_match_to_send']}%): {len(ranked)} jobs")

    # 6. Send via Telegram
    from notifiers import send_results
    success = send_results(ranked, run_time)

    if success:
        # Save sent IDs only if Telegram succeeded
        new_ids = {j.job_id() for j in ranked}
        save_sent_ids(sent_ids | new_ids)
        logger.info(f"✓ Sent {len(ranked)} jobs via Telegram")
    else:
        logger.error("✗ Telegram send failed — jobs NOT saved to sent cache")

    logger.info(f"Run completed. Log: {log_file}")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Job Search Automation")
    parser.add_argument("--test", action="store_true", help="Send test Telegram message")
    parser.add_argument(
        "--reset-cache", action="store_true", help="Clear dedup cache (resend all)"
    )
    args = parser.parse_args()

    if args.reset_cache:
        if SENT_JOBS_FILE.exists():
            SENT_JOBS_FILE.unlink()
        logger.info("Dedup cache cleared.")

    if args.test:
        from notifiers import send_test_message
        ok = send_test_message()
        sys.exit(0 if ok else 1)

    run_job_search()


if __name__ == "__main__":
    main()
