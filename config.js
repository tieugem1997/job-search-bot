// Configuration: CV profile, search settings, scoring weights.
export const CV_PROFILE = {
  name: "Trong Nguyen Thanh",
  title: "Senior Power Platform / Data Engineer",
  experienceYears: 4,
  email: "tony.it.777@gmail.com",
  summary:
    "Senior Power Platform Developer & Data Engineer with 4+ years building enterprise solutions " +
    "on Microsoft Power Platform. Expert in Power Apps (Canvas & Model-Driven), " +
    "Power Automate, Power BI, SharePoint Online, Dataverse, Power Pages, " +
    "Copilot Studio, AI Builder. Data Engineering: ETL pipelines, SQL, Python, Azure Data Factory. " +
    "Integration: REST API, Custom Connectors, JSON. " +
    "Industry: Banking (HSBC HongKong, HDBank), FMCG (P&G, Aqua, First Solar). " +
    "International projects (Vietnam, India, China). " +
    "Open to Remote, Part-time, Freelance opportunities in Vietnam.",
  skills: {
    primary: [
      "Power Platform", "Power Apps", "Power Automate", "Power BI",
      "SharePoint", "Dataverse", "Data Engineer", "Data Engineering",
    ],
    secondary: [
      "Power Pages", "Copilot Studio", "AI Builder", "SharePoint Online",
      "Microsoft 365", "Canvas App", "Model-Driven App", "Low Code", "No Code",
      "ETL", "Data Pipeline", "Azure Data Factory", "Power BI Developer",
    ],
    integration: ["REST API", "Custom Connectors", "JSON", "HTTP", "Webhook", "Azure", "Teams"],
    programming: ["Python", "SQL", "JavaScript", "HTML", "CSS"],
    tools: ["ALM", "Agile", "Scrum", "DevOps", "Git"],
  },
};

export const SEARCH_KEYWORDS = [
  "Power Platform",
  "Power Apps",
  "Power Automate",
  "Power BI",
  "SharePoint",
  "SharePoint Online",
  "Microsoft 365 developer",
  "Low Code developer",
  "Dataverse",
  "Data Engineer",
  "Power BI Developer",
  "Data Pipeline",
];

export const SCORING = {
  primarySkillPts: 12,
  secondarySkillPts: 6,
  integrationSkillPts: 3,
  titleBonusPts: 20,
  minMatchToSend: 20,        // skip jobs below this %
  maxJobsPerRun: 30,
  activeDaysThreshold: 30,   // jobs older than this are skipped
};

// API endpoints
export const REMOTEOK_API = "https://remoteok.io/api";
export const JOBICY_API = "https://jobicy.com/api/v2/remote-jobs";

export const WWR_FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
];

export const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
  Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.9",
};

export const REQUEST_TIMEOUT_MS = 20_000;
export const REQUEST_DELAY_MS = 1_500;
