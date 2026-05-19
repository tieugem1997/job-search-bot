"""
We Work Remotely RSS feed scraper.
"""
import logging
import feedparser
from bs4 import BeautifulSoup
from datetime import datetime
from .base import Job
from config import WWR_FEEDS, SEARCH_KEYWORDS

logger = logging.getLogger(__name__)


def scrape_weworkremotely(keywords: list[str] | None = None) -> list[Job]:
    if keywords is None:
        keywords = SEARCH_KEYWORDS

    kw_lower = [k.lower() for k in keywords]
    results: list[Job] = []
    seen: set[str] = set()

    for feed_url in WWR_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
        except Exception as e:
            logger.warning(f"[WWR] Feed {feed_url} error: {e}")
            continue

        for entry in feed.entries:
            title_raw = entry.get("title", "")
            description_html = entry.get("summary", "") or ""
            link = entry.get("link", "")

            if link in seen:
                continue

            # Title format: "Company: Position"
            company, title = _split_title(title_raw)

            description = BeautifulSoup(description_html, "html.parser").get_text(
                separator=" ", strip=True
            )[:1000]

            searchable = f"{title} {company} {description}".lower()
            if not any(kw in searchable for kw in kw_lower):
                continue

            posted = _parse_struct_time(getattr(entry, "published_parsed", None))

            seen.add(link)
            results.append(Job(
                title=title,
                company=company,
                url=link,
                source="WeWorkRemotely",
                job_type="remote",
                location="Remote",
                description=description,
                posted_date=posted,
            ))

    logger.info(f"[WeWorkRemotely] Found {len(results)} relevant jobs")
    return results


def _split_title(raw: str) -> tuple[str, str]:
    """'Company: Position' → (company, position)."""
    if ": " in raw:
        parts = raw.split(": ", 1)
        return parts[0].strip(), parts[1].strip()
    if " - " in raw:
        parts = raw.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    return "", raw.strip()


def _parse_struct_time(st) -> datetime | None:
    if st is None:
        return None
    try:
        return datetime(*st[:6])
    except Exception:
        return None
