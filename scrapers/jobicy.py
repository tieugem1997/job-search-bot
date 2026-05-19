"""
Jobicy public REST API scraper.
API: https://jobicy.com/api/v2/remote-jobs
"""
import logging
import requests
from datetime import datetime
from .base import Job
from config import DEFAULT_HEADERS, JOBICY_API, REQUEST_TIMEOUT, SEARCH_KEYWORDS

logger = logging.getLogger(__name__)

# Tags to search on Jobicy
JOBICY_TAGS = [
    "power-bi",
    "sharepoint",
    "microsoft",
    "power-platform",
    "power-automate",
]


def scrape_jobicy(keywords: list[str] | None = None) -> list[Job]:
    if keywords is None:
        keywords = SEARCH_KEYWORDS

    kw_lower = [k.lower() for k in keywords]
    results: list[Job] = []
    seen_urls: set[str] = set()

    for tag in JOBICY_TAGS:
        jobs = _fetch_jobicy_tag(tag)
        for job in jobs:
            if job.url in seen_urls:
                continue

            searchable = f"{job.title} {job.description} {' '.join(job.tags)}".lower()
            if not any(kw in searchable for kw in kw_lower):
                continue

            seen_urls.add(job.url)
            results.append(job)

    logger.info(f"[Jobicy] Found {len(results)} relevant jobs")
    return results


def _fetch_jobicy_tag(tag: str) -> list[Job]:
    params = {"count": 50, "geo": "worldwide", "tag": tag}
    try:
        resp = requests.get(
            JOBICY_API,
            params=params,
            headers={**DEFAULT_HEADERS, "Accept": "application/json"},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning(f"[Jobicy] tag={tag} failed: {e}")
        return []

    raw_jobs = data.get("jobs", [])
    if not isinstance(raw_jobs, list):
        return []

    results = []
    for j in raw_jobs:
        title = (j.get("jobTitle") or j.get("title") or "").strip()
        company = (j.get("companyName") or j.get("company") or "").strip()
        url = (j.get("url") or j.get("jobUrl") or "").strip()
        description = (j.get("jobDescription") or j.get("description") or "").strip()
        tags = j.get("jobIndustry") or []
        if isinstance(tags, str):
            tags = [tags]
        job_type_raw = (j.get("jobType") or "").lower()
        salary_text = (j.get("annualSalaryMin") and j.get("annualSalaryMax") and
                       f"${j['annualSalaryMin']:,} – ${j['annualSalaryMax']:,}/yr") or \
                      j.get("salaryRange") or ""

        posted = _parse_date(j.get("pubDate") or j.get("postDate"))

        if not title or not url:
            continue

        results.append(Job(
            title=title,
            company=company,
            url=url,
            source="Jobicy",
            salary_text=salary_text,
            job_type=job_type_raw or "remote",
            location=j.get("jobGeo") or "Remote",
            description=description[:1000],
            tags=[t.lower() for t in tags],
            posted_date=posted,
        ))

    return results


def _parse_date(val) -> datetime | None:
    if not val:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            return datetime.strptime(str(val), fmt)
        except ValueError:
            continue
    return None
