"""
RemoteOK public JSON API scraper.
API: https://remoteok.io/api
"""
import logging
import time
import requests
from datetime import datetime, timezone
from .base import Job
from config import DEFAULT_HEADERS, REMOTEOK_API, REQUEST_TIMEOUT, SEARCH_KEYWORDS

logger = logging.getLogger(__name__)


def scrape_remoteok(keywords: list[str] | None = None) -> list[Job]:
    if keywords is None:
        keywords = SEARCH_KEYWORDS

    kw_lower = [k.lower() for k in keywords]
    results = []

    try:
        headers = {**DEFAULT_HEADERS, "Accept": "application/json"}
        resp = requests.get(REMOTEOK_API, headers=headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f"[RemoteOK] Fetch failed: {e}")
        return []

    # First element is a legal notice dict
    raw_jobs = [j for j in data if isinstance(j, dict) and j.get("position")]

    for job in raw_jobs:
        title = job.get("position", "").strip()
        company = job.get("company", "").strip()
        tags = [t.lower() for t in (job.get("tags") or [])]
        description = job.get("description", "") or ""
        job_url = job.get("url", "") or f"https://remoteok.io/remote-jobs/{job.get('id', '')}"

        # Relevance filter
        searchable = f"{title} {' '.join(tags)} {description}".lower()
        if not any(kw in searchable for kw in kw_lower):
            continue

        # Salary
        salary_min = _safe_float(job.get("salary_min"))
        salary_max = _safe_float(job.get("salary_max"))
        if salary_min and salary_max:
            salary_text = f"${salary_min:,.0f} – ${salary_max:,.0f}/yr"
        elif salary_min:
            salary_text = f"${salary_min:,.0f}+/yr"
        else:
            salary_text = ""

        # Date
        posted = _parse_iso(job.get("date"))

        results.append(Job(
            title=title,
            company=company,
            url=job_url,
            source="RemoteOK",
            salary_text=salary_text,
            salary_min=salary_min,
            salary_max=salary_max,
            job_type="remote",
            location="Remote",
            description=_clean_html(description)[:1000],
            tags=tags,
            posted_date=posted,
        ))

    logger.info(f"[RemoteOK] Found {len(results)} relevant jobs")
    return results


def _safe_float(val) -> float | None:
    try:
        return float(val) if val else None
    except (TypeError, ValueError):
        return None


def _parse_iso(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        return None


def _clean_html(text: str) -> str:
    import re
    return re.sub(r"<[^>]+>", " ", text).strip()
