"""
LinkedIn Jobs guest API scraper (no authentication required).
Uses LinkedIn's public job search endpoint that returns HTML fragments.
"""
import logging
import time
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from .base import Job
from config import DEFAULT_HEADERS, REQUEST_TIMEOUT, REQUEST_DELAY, SEARCH_KEYWORDS

logger = logging.getLogger(__name__)

# LinkedIn guest jobs search API
_SEARCH_URL = (
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    "?keywords={keywords}&f_WT=2&f_JT=P%2CC%2CF%2CT&start={start}&count=25"
)
# f_WT=2 = remote
# f_JT = P(part-time), C(contract), F(full-time), T(temporary)


def scrape_linkedin(keywords: list[str] | None = None) -> list[Job]:
    if keywords is None:
        keywords = SEARCH_KEYWORDS

    results: list[Job] = []
    seen: set[str] = set()

    for kw in keywords[:5]:  # limit to top 5 keywords to avoid rate limiting
        jobs = _search_linkedin(kw)
        for job in jobs:
            if job.url in seen:
                continue
            seen.add(job.url)
            results.append(job)
        time.sleep(REQUEST_DELAY * 2)  # extra polite for LinkedIn

    logger.info(f"[LinkedIn] Found {len(results)} relevant jobs")
    return results


def _search_linkedin(keyword: str, max_pages: int = 2) -> list[Job]:
    results = []
    encoded = keyword.replace(" ", "%20")

    for page in range(max_pages):
        start = page * 25
        url = _SEARCH_URL.format(keywords=encoded, start=start)

        try:
            resp = requests.get(
                url,
                headers={**DEFAULT_HEADERS, "Accept": "text/html"},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 429:
                logger.warning("[LinkedIn] Rate limited, backing off")
                time.sleep(10)
                break
            if resp.status_code != 200:
                break
        except Exception as e:
            logger.warning(f"[LinkedIn] Request failed for '{keyword}': {e}")
            break

        jobs = _parse_linkedin_html(resp.text)
        if not jobs:
            break

        results.extend(jobs)
        time.sleep(REQUEST_DELAY)

    return results


def _parse_linkedin_html(html: str) -> list[Job]:
    soup = BeautifulSoup(html, "html.parser")
    jobs = []

    for card in soup.find_all("div", class_=re.compile(r"job-search-card|base-card")):
        title_el = card.find(["h3", "h4"], class_=re.compile(r"title|job-title"))
        company_el = card.find(class_=re.compile(r"company|subtitle"))
        location_el = card.find(class_=re.compile(r"location"))
        link_el = card.find("a", href=True)
        date_el = card.find("time")

        title = title_el.get_text(strip=True) if title_el else ""
        company = company_el.get_text(strip=True) if company_el else ""
        location = location_el.get_text(strip=True) if location_el else ""
        url = link_el["href"].split("?")[0] if link_el else ""
        if url and not url.startswith("http"):
            url = "https://www.linkedin.com" + url

        if not title or not url:
            continue

        # Parse relative date from datetime attribute
        posted = None
        if date_el and date_el.get("datetime"):
            try:
                posted = datetime.fromisoformat(date_el["datetime"])
            except Exception:
                pass

        # Determine job type from location text
        job_type = "remote" if "remote" in location.lower() else ""

        jobs.append(Job(
            title=title,
            company=company,
            url=url,
            source="LinkedIn",
            job_type=job_type,
            location=location,
            posted_date=posted,
        ))

    return jobs
