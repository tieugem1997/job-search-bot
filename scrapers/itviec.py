"""
ITViec Vietnam job board scraper.
ITViec uses Next.js SSR — job data is embedded in __NEXT_DATA__.
"""
import json
import logging
import re
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import quote
from .base import Job
from config import DEFAULT_HEADERS, REQUEST_TIMEOUT, REQUEST_DELAY, SEARCH_KEYWORDS

logger = logging.getLogger(__name__)

_BASE_URL = "https://itviec.com"
_SEARCH_URL = "https://itviec.com/it-jobs?search[keywords]={kw}&search[job_types][]=remote-job"


def scrape_itviec(keywords: list[str] | None = None) -> list[Job]:
    if keywords is None:
        keywords = SEARCH_KEYWORDS

    results: list[Job] = []
    seen: set[str] = set()
    # Use combined query to reduce requests
    combined_kw = " OR ".join(keywords[:3])

    for kw in [combined_kw, "SharePoint", "Power BI"]:
        jobs = _fetch_itviec(kw)
        for job in jobs:
            if job.url in seen:
                continue
            seen.add(job.url)
            results.append(job)
        time.sleep(REQUEST_DELAY)

    logger.info(f"[ITViec] Found {len(results)} relevant jobs")
    return results


def _fetch_itviec(keyword: str) -> list[Job]:
    url = _SEARCH_URL.format(kw=quote(keyword))
    try:
        resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"[ITViec] Fetch failed for '{keyword}': {e}")
        return []

    # Try __NEXT_DATA__ first (Next.js SSR)
    jobs = _extract_next_data(resp.text)
    if jobs:
        return jobs

    # Fallback: parse HTML job cards
    return _parse_html_cards(resp.text)


def _extract_next_data(html: str) -> list[Job]:
    """Extract jobs from Next.js __NEXT_DATA__ JSON blob."""
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    if not script:
        return []

    try:
        data = json.loads(script.string)
    except Exception:
        return []

    # Try common paths in the data structure
    jobs_data = (
        _deep_get(data, "props", "pageProps", "jobs")
        or _deep_get(data, "props", "pageProps", "jobList")
        or _deep_get(data, "props", "pageProps", "data", "jobs")
        or []
    )

    if not isinstance(jobs_data, list):
        return []

    results = []
    for j in jobs_data:
        title = j.get("title") or j.get("job_title") or ""
        company = (j.get("company") or {}).get("name") or j.get("company_name") or ""
        slug = j.get("slug") or j.get("id") or ""
        url = f"{_BASE_URL}/it-jobs/{slug}" if slug else ""
        salary_text = j.get("salary") or j.get("salary_range") or ""
        posted_str = j.get("posted_at") or j.get("created_at") or ""
        deadline_str = j.get("expired_at") or j.get("deadline") or ""
        location = j.get("location") or "Vietnam"
        job_type = j.get("remote") and "remote" or j.get("job_type") or "onsite"

        if not title or not url:
            continue

        posted = _parse_date(posted_str)
        deadline = _parse_date(deadline_str)

        results.append(Job(
            title=title,
            company=company,
            url=url,
            source="ITViec",
            salary_text=salary_text,
            job_type=job_type,
            location=location,
            posted_date=posted,
            deadline=deadline,
        ))

    return results


def _parse_html_cards(html: str) -> list[Job]:
    """Fallback HTML parser for ITViec job cards."""
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for card in soup.find_all("div", class_=re.compile(r"job-card|itp_job")):
        title_el = card.find(["h2", "h3"], class_=re.compile(r"title"))
        company_el = card.find(class_=re.compile(r"company"))
        link_el = card.find("a", href=True)
        salary_el = card.find(class_=re.compile(r"salary"))

        title = title_el.get_text(strip=True) if title_el else ""
        company = company_el.get_text(strip=True) if company_el else ""
        href = link_el["href"] if link_el else ""
        url = href if href.startswith("http") else f"{_BASE_URL}{href}"
        salary_text = salary_el.get_text(strip=True) if salary_el else ""

        if not title or not url:
            continue

        results.append(Job(
            title=title,
            company=company,
            url=url,
            source="ITViec",
            salary_text=salary_text,
            location="Vietnam",
        ))

    return results


def _deep_get(d: dict, *keys):
    for key in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(key)
    return d


def _parse_date(val) -> datetime | None:
    if not val:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(val), fmt)
        except ValueError:
            continue
    return None
