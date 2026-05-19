"""
Configuration: CV profile, search settings, scoring weights.
"""

CV_PROFILE = {
    "name": "Trong Nguyen Thanh",
    "title": "Senior Power Platform Developer",
    "experience_years": 4,
    "email": "tony.it.777@gmail.com",
    "summary": (
        "Senior Power Platform Developer with 4+ years building enterprise solutions "
        "on Microsoft Power Platform. Expert in Power Apps (Canvas & Model-Driven), "
        "Power Automate, Power BI, SharePoint Online, Dataverse, Power Pages, "
        "Copilot Studio, AI Builder. Strong integration skills: REST API, Custom Connectors, "
        "JSON, SharePoint. Programming: Python, SQL, JavaScript. "
        "Industry: Banking (HSBC HongKong, HDBank), FMCG (P&G, Aqua, First Solar). "
        "International project experience (Vietnam, India, China)."
    ),
    "skills": {
        "primary": [
            "Power Platform",
            "Power Apps",
            "Power Automate",
            "Power BI",
            "SharePoint",
            "Dataverse",
        ],
        "secondary": [
            "Power Pages",
            "Copilot Studio",
            "AI Builder",
            "SharePoint Online",
            "Microsoft 365",
            "Canvas App",
            "Model-Driven App",
            "Low Code",
            "No Code",
        ],
        "integration": [
            "REST API",
            "Custom Connectors",
            "JSON",
            "HTTP",
            "Webhook",
            "Azure",
            "Teams",
        ],
        "programming": [
            "Python",
            "SQL",
            "JavaScript",
            "HTML",
            "CSS",
        ],
        "tools": [
            "ALM",
            "Agile",
            "Scrum",
            "DevOps",
            "Git",
        ],
    },
}

# Keywords to search across job boards
SEARCH_KEYWORDS = [
    "Power Platform",
    "Power Apps",
    "Power Automate",
    "Power BI",
    "SharePoint",
    "SharePoint Online",
    "Microsoft 365 developer",
    "Low Code developer",
    "Dataverse",
]

# Job type filter keywords (OR logic)
JOB_TYPE_KEYWORDS = [
    "remote",
    "part-time",
    "part time",
    "freelance",
    "contract",
    "consultant",
    "hybrid",
]

# Scoring config
SCORING = {
    "primary_skill_pts": 12,      # pts per primary skill match
    "secondary_skill_pts": 6,     # pts per secondary skill match
    "integration_skill_pts": 3,   # pts per integration skill
    "title_bonus_pts": 20,        # bonus if keyword in job title
    "min_match_to_send": 20,      # skip jobs below this threshold (%)
    "max_jobs_per_run": 30,       # max jobs in Telegram message
    "active_days_threshold": 30,  # consider job active if posted within N days
}

# Remote OK API
REMOTEOK_API = "https://remoteok.io/api"

# Jobicy API
JOBICY_API = "https://jobicy.com/api/v2/remote-jobs"

# We Work Remotely RSS feeds
WWR_FEEDS = [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
]

# LinkedIn guest search URL template
LINKEDIN_SEARCH_URL = (
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    "?keywords={keywords}&f_WT=2&f_JT=P%2CC%2CF&start={start}"
)

# ITViec search URL
ITVIEC_SEARCH_URL = "https://itviec.com/it-jobs?search[keywords]={keywords}"

# TopDev search URL
TOPDEV_SEARCH_URL = "https://topdev.vn/it-jobs?q={keywords}"

# Request headers (rotate to avoid bans)
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/json,*/*;q=0.9",
}

REQUEST_TIMEOUT = 20    # seconds
REQUEST_DELAY = 1.5     # seconds between requests (be polite)
