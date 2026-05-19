"""
Telegram Bot notification sender.
Uses HTML parse mode for formatting.
Handles Telegram's 4096-char limit by batching messages.
"""
import logging
import os
import time
from datetime import datetime
from scrapers.base import Job

logger = logging.getLogger(__name__)

_TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
_MAX_CHARS = 4000   # safe limit below Telegram's 4096


def send_results(jobs: list[Job], run_date: datetime | None = None) -> bool:
    """Send all ranked jobs to Telegram. Returns True on success."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        logger.error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in .env")
        return False

    run_date = run_date or datetime.now()
    messages = _build_messages(jobs, run_date)

    success = True
    for msg in messages:
        ok = _send(token, chat_id, msg)
        if not ok:
            success = False
        time.sleep(0.5)

    return success


def send_test_message() -> bool:
    """Send a test ping to verify Telegram config."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        logger.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID")
        return False

    msg = (
        "✅ <b>Job Search Bot - Test OK</b>\n\n"
        "Bot đang hoạt động bình thường.\n"
        f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    return _send(token, chat_id, msg)


def _build_messages(jobs: list[Job], run_date: datetime) -> list[str]:
    """Split jobs into Telegram-sized message batches."""
    if not jobs:
        header = (
            f"📊 <b>Job Search - {run_date.strftime('%d/%m/%Y %H:%M')}</b>\n"
            "⚠️ Không tìm thấy job mới phù hợp hôm nay."
        )
        return [header]

    header = (
        f"📊 <b>Job Search Results - {run_date.strftime('%d/%m/%Y %H:%M')}</b>\n"
        f"🔍 Tìm thấy <b>{len(jobs)}</b> jobs mới | Sắp xếp theo % Match\n"
    )

    messages = []
    current = header

    for i, job in enumerate(jobs, 1):
        block = _format_job(i, job)
        if len(current) + len(block) > _MAX_CHARS:
            messages.append(current)
            current = f"📄 <b>Tiếp theo ({i}/{len(jobs)})</b>\n"
        current += block

    messages.append(current)
    return messages


def _format_job(index: int, job: Job) -> str:
    """Format one job as a Telegram HTML block."""
    # Match indicator
    pct = job.match_percent
    if pct >= 80:
        match_icon = "🟢"
    elif pct >= 60:
        match_icon = "🟡"
    elif pct >= 40:
        match_icon = "🟠"
    else:
        match_icon = "🔴"

    # Build lines
    lines = [
        f"\n{'━' * 28}",
        f"{match_icon} <b>{pct}% Match</b>  |  #{index}",
        f"💼 <b>{_esc(job.title)}</b>",
        f"🏢 {_esc(job.company or 'N/A')}",
        f"💰 {_esc(job.salary_display())}",
        f"📍 {_esc(job.location or 'N/A')}  |  🏷 {_esc(job.job_type or 'N/A')}",
        f"📅 Posted: {job.posted_display()}  |  ⏰ Deadline: {job.deadline_display()}",
        f"🔗 <a href=\"{job.url}\">Apply → {_esc(job.source)}</a>",
    ]

    if job.match_reason:
        lines.append(f"💡 {_esc(job.match_reason)}")

    return "\n".join(lines) + "\n"


def _esc(text: str) -> str:
    """Escape HTML special chars for Telegram HTML mode."""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _send(token: str, chat_id: str, text: str) -> bool:
    import requests
    url = _TELEGRAM_API.format(token=token)
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        resp = requests.post(url, json=payload, timeout=15)
        if not resp.ok:
            logger.error(f"Telegram API error {resp.status_code}: {resp.text[:200]}")
            return False
        return True
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")
        return False
