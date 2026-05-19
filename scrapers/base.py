"""
Base Job dataclass shared across all scrapers.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import hashlib


@dataclass
class Job:
    title: str
    company: str
    url: str
    source: str

    # Salary
    salary_text: str = ""
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: str = "USD"

    # Job meta
    job_type: str = ""          # remote / part-time / contract / freelance
    location: str = ""
    description: str = ""
    tags: list = field(default_factory=list)

    # Dates
    posted_date: Optional[datetime] = None
    deadline: Optional[datetime] = None

    # Computed after matching
    match_percent: int = 0
    match_reason: str = ""

    def job_id(self) -> str:
        """Stable unique ID for deduplication (based on URL)."""
        key = self.url.strip().lower()
        return hashlib.md5(key.encode()).hexdigest()[:16]

    def is_active(self, threshold_days: int = 30) -> bool:
        """True if job is likely still open."""
        now = datetime.utcnow()
        # Explicit deadline check
        if self.deadline and self.deadline < now:
            return False
        # Age check
        if self.posted_date:
            age_days = (now - self.posted_date.replace(tzinfo=None)).days
            return age_days <= threshold_days
        # No date info → assume active (include it)
        return True

    def salary_display(self) -> str:
        if self.salary_text:
            return self.salary_text
        if self.salary_min and self.salary_max:
            return f"{self.salary_currency} {self.salary_min:,.0f}–{self.salary_max:,.0f}"
        if self.salary_min:
            return f"{self.salary_currency} {self.salary_min:,.0f}+"
        return "Negotiable"

    def posted_display(self) -> str:
        if self.posted_date:
            return self.posted_date.strftime("%d/%m/%Y")
        return "N/A"

    def deadline_display(self) -> str:
        if self.deadline:
            return self.deadline.strftime("%d/%m/%Y")
        return "N/A"
