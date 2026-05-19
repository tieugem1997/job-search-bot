"""
TopDev Vietnam job board scraper.
TopDev also uses Next.js SSR.
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

_BASE_URL = "https://topdev.vn"
_SEARCH_URL = "https://topdev.vn/it-jobs?q={kw}&type=remote-jobs"


def scrape_topdev(keywords: list[str] | None = None) -> list[Job]:
    if keywords is None:
        keywords = SEARCH_KEYWORDS

    results: list[Job] = []
    seen: set[str] = set()

    for kw in keywords[:4]:
        jobs = _fetch_topdev(kw)
        for job in jobs:
            if job.url in seen:
                continue
            seen.add(job.url)
            results.append(job)
        time.sleep(REQUEST_DELAY)

    logger.info(f"[TopDev] Found {len(results)} relevant jobs")
    return results


def _fetch_topdev(keyword: str) -> list[Job]:
    url = _SEARCH_URL.format(kw=quote(keyword))
    try:
        resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"[TopDev] Fetch failed for '{keyword}': {e}")
        return []

    jobs = _extract_next_data(resp.text)
    if jobs:
        return jobs
    return _parse_html_cards(resp.text)


def _extract_next_data(html: str) -> list[Job]:
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    if not script:
        return []

    try:
        data = json.loads(script.string)
    except Exception:
        return []

    # Explore common paths
    jobs_data = (
        _deep_get(data, "props", "pageProps", "jobs")
        or _deep_get(data, "props", "pageProps", "data", "jobs")
        or _deep_get(data, "props", "pageProps", "listJob")
        or []
    )

    if not isinstance(jobs_data, list):
        return []

    results = []
    for j in jobs_data:
        title = j.get("title") or j.get("name") or ""
        company_obj = j.get("company") or {}
        company = (
            company_obj.get("name")
            or company_obj.get("title")
            or j.get("company_name")
            or ""
        )
        slug = j.get("slug") or j.get("alias") or j.get("id") or ""
        url = f"{_BASE_URL}/it-jobs/{slug}" if slug else ""
        salary_text = j.get("salary") or j.get("salary_range") or ""
        posted_str = j.get("published_at") or j.get("created_at") or ""
        deadline_str = j.get("expired_at") or j.get("end_date") or ""
        location = j.get("location") or j.get("address") or "Vietnam"
        is_remote = j.get("is_remote") or j.get("remote") or False
        job_type = "remote" if is_remote else j.get("job_type") or "onsite"

        if not title or not url:
            continue

        posted = _parse_date(posted_str)
        deadline = _parse_date(deadline_str)

        results.append(Job(
            title=title,
            company=company,
            url=url,
            source="TopDev",
            salary_text=salary_text,
            job_type=job_type,
            location=location,
            posted_date=posted,
            deadline=deadline,
        ))

    return results


def _parse_html_cards(html: str) -> list[Job]:
    soup = BeautifulSoup(html, "html.parser")
    results = []

    selectors = [
        ("div", re.compile(r"job-item|card-job")),
        ("article", re.compile(r"job")),
    ]

    cards = []
    for tag, pattern in selectors:
        cards = soup.find_all(tag, class_=pattern)
        if cards:
            break

    for card in cards:
        title_el = card.find(["h3", "h2", "a"], class_=re.compile(r"title|name"))
        company_el = card.find(class_=re.compile(r"company|employer"))
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
            source="TopDev",
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
