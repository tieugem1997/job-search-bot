"""
CV match percentage calculator.

Two modes:
  1. Keyword scoring (fast, free) — always available
  2. Claude AI scoring (accurate) — requires ANTHROPIC_API_KEY in .env
"""
import json
import logging
import os
from scrapers.base import Job
from config import CV_PROFILE, SCORING

logger = logging.getLogger(__name__)

# Flat list of (keyword, points) for scoring
_SKILL_WEIGHTS: list[tuple[str, int]] = (
    [(s.lower(), SCORING["primary_skill_pts"]) for s in CV_PROFILE["skills"]["primary"]]
    + [(s.lower(), SCORING["secondary_skill_pts"]) for s in CV_PROFILE["skills"]["secondary"]]
    + [(s.lower(), SCORING["integration_skill_pts"]) for s in CV_PROFILE["skills"]["integration"]]
)

_CV_SUMMARY = CV_PROFILE["summary"]


def calculate_match(job: Job) -> tuple[int, str]:
    """
    Returns (match_percent: 0-100, reason: str).
    Uses Claude AI if ANTHROPIC_API_KEY is set, otherwise keyword scoring.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if api_key:
        try:
            return _claude_match(job, api_key)
        except Exception as e:
            logger.warning(f"Claude match failed for '{job.title}': {e}. Using keyword fallback.")

    return _keyword_match(job)


def rank_jobs(jobs: list[Job]) -> list[Job]:
    """
    Score all jobs, filter by min threshold, sort descending by match %.
    """
    min_match = SCORING["min_match_to_send"]
    scored = []

    for job in jobs:
        pct, reason = calculate_match(job)
        job.match_percent = pct
        job.match_reason = reason
        if pct >= min_match:
            scored.append(job)

    scored.sort(key=lambda j: j.match_percent, reverse=True)
    return scored[: SCORING["max_jobs_per_run"]]


# ── Keyword scoring ────────────────────────────────────────────────────────────

def _keyword_match(job: Job) -> tuple[int, str]:
    searchable = f"{job.title} {job.description} {' '.join(job.tags)}".lower()
    title_lower = job.title.lower()

    raw_score = 0
    matched_skills: list[str] = []

    for skill, pts in _SKILL_WEIGHTS:
        if skill in searchable:
            raw_score += pts
            matched_skills.append(skill)

    # Title bonus
    title_bonus = 0
    for skill, _ in _SKILL_WEIGHTS[:6]:  # primary skills only
        if skill in title_lower:
            title_bonus = SCORING["title_bonus_pts"]
            break

    total = min(raw_score + title_bonus, 100)
    reason = f"Matched: {', '.join(matched_skills[:5])}" if matched_skills else "No direct skill match"
    return total, reason


# ── Claude AI scoring ──────────────────────────────────────────────────────────

def _claude_match(job: Job, api_key: str) -> tuple[int, str]:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)

    prompt = (
        f"CV Summary:\n{_CV_SUMMARY}\n\n"
        f"Job Title: {job.title}\n"
        f"Company: {job.company}\n"
        f"Type: {job.job_type}\n"
        f"Description (first 600 chars):\n{job.description[:600]}\n"
        f"Tags: {', '.join(job.tags)}\n\n"
        "How well does this CV match this job? "
        'Reply with ONLY valid JSON: {"percent": <0-100>, "reason": "<max 12 words>"}'
    )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=80,
        system="You are a senior recruiter. Respond ONLY with compact JSON, no extra text.",
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    # Extract JSON even if there's surrounding text
    import re
    match = re.search(r'\{.*?\}', text, re.DOTALL)
    if match:
        data = json.loads(match.group())
        return int(data.get("percent", 0)), str(data.get("reason", ""))

    raise ValueError(f"Unexpected response: {text}")
