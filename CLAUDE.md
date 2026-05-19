# Job Search Automation - Project Documentation

## Mục Tiêu
Tự động tìm kiếm job remote/part-time liên quan đến SharePoint, PowerBI, Power Platform **lúc 8:00 AM hàng ngày**, gửi kết quả qua Telegram sắp xếp theo % match với CV.

## Owner
- **Name**: Trong Nguyen Thanh
- **Email**: tony.it.777@gmail.com
- **CV**: D:\Trong\CV\CV_Power Platform Developer_TrongNguyenThanh_Mar2026.docx

---

## Tech Stack
- **Language**: Python 3.10+
- **Scheduler**: Windows Task Scheduler
- **Notification**: Telegram Bot API
- **AI Matching**: Claude Haiku API (optional, fallback to keyword matching)
- **Scraping**: requests + BeautifulSoup4 + feedparser

## Project Structure
```
job-search-automation/
├── CLAUDE.md                  # This file
├── main.py                    # Entry point
├── config.py                  # CV profile + settings
├── requirements.txt
├── .env                       # Secrets (create from .env.example)
├── .env.example
├── setup_scheduler.ps1        # Windows Task Scheduler setup
├── scrapers/
│   ├── base.py                # Job dataclass
│   ├── remoteok.py            # RemoteOK public API
│   ├── jobicy.py              # Jobicy public API
│   ├── weworkremotely.py      # We Work Remotely RSS
│   ├── linkedin.py            # LinkedIn guest API
│   ├── itviec.py              # ITViec Vietnam
│   └── topdev.py              # TopDev Vietnam
├── processors/
│   └── cv_matcher.py          # CV match % calculation
├── notifiers/
│   └── telegram.py            # Telegram sender
└── data/
    └── sent_jobs.json         # Deduplication cache (auto-created)
```

---

## Job Sources
| Source | Type | Reliability | Region |
|--------|------|-------------|--------|
| RemoteOK | Public JSON API | High | Global |
| Jobicy | Public JSON API | High | Global |
| We Work Remotely | RSS Feed | High | Global |
| LinkedIn | Guest HTML API | Medium | Global |
| ITViec | HTML Scraping | Medium | Vietnam |
| TopDev | HTML Scraping | Medium | Vietnam |

## Search Keywords
- Power Platform, Power Apps, Power Automate, Power BI
- SharePoint, SharePoint Online, Microsoft 365
- Low Code, No Code, Dataverse, Copilot Studio

## Job Type Filter
- remote, part-time, freelance, contract, hybrid

---

## CV Profile Summary (for matching)
- **Title**: Senior Power Platform Developer
- **Experience**: 4+ years
- **Primary Skills**: Power Apps (Canvas & Model-Driven), Power Automate, Power BI, SharePoint, Dataverse
- **Secondary Skills**: Power Pages, Copilot Studio, AI Builder, Power Platform ALM
- **Integration**: REST API, Custom Connectors, JSON, SharePoint Online, Teams
- **Programming**: Python, SQL, JavaScript, HTML/CSS
- **Domain**: Banking (HSBC), FMCG (P&G), Enterprise IT

---

## Match % Calculation
### Keyword Scoring (fast, default)
- Primary skill match: 10 pts each (Power Apps, Power Automate, Power BI, SharePoint, Dataverse)
- Secondary skill match: 5 pts each
- Title keyword match: bonus 20 pts
- Max score: 100%

### Claude AI Scoring (accurate, requires ANTHROPIC_API_KEY)
- Send job description + CV summary to claude-haiku-4-5
- Returns 0-100% with brief reason
- Used for top 20 candidates after keyword pre-filter

---

## Telegram Message Format
```
📊 Job Search Results - 2026-05-05 08:00
Found 12 new jobs | Sorted by Match %
━━━━━━━━━━━━━━━━━━━━
🎯 95% | Power Platform Consultant
🏢 Microsoft | 💰 $80k-$100k
📍 Remote | Part-time | ⏰ Posted: 01/05
🔗 Apply: https://...
━━━━━━━━━━━━━━━━━━━━
```

---

## Setup Instructions

### 1. Python Environment
```powershell
cd D:\Trong\Project\Claude\job-search-automation
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Telegram Bot Setup
1. Open Telegram → search @BotFather
2. Send `/newbot` → follow instructions → get **BOT_TOKEN**
3. Send a message to your bot
4. Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates` → get **CHAT_ID**

### 3. Configure .env
```
cp .env.example .env
# Edit .env with your Telegram token and chat ID
```

### 4. Test Run
```powershell
python main.py --test        # Test Telegram connection
python main.py               # Run job search now
```

### 5. Schedule Daily 8 AM (Windows)
```powershell
# Run as Administrator
.\setup_scheduler.ps1
```

---

## Active Job Threshold
- Jobs posted within **30 days** are considered active
- Jobs with explicit deadlines that have passed are skipped
- Dedup: already-sent job URLs are tracked in `data/sent_jobs.json`

---

## Quality Requirements
- [ ] Only show jobs that are still active (≤ 30 days old)
- [ ] No duplicate jobs across runs (URL-based dedup)
- [ ] Minimum 5% match threshold (avoid irrelevant jobs)
- [ ] Telegram message max 4096 chars (batch if needed)
- [ ] Graceful error handling (if one scraper fails, others continue)
- [ ] Log file saved to `data/logs/` for debugging

---

*Last updated: 2026-05-05*
