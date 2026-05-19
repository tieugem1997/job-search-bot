import axios from "axios";
import { load } from "cheerio";
import { Job } from "./base.js";
import { DEFAULT_HEADERS, REQUEST_TIMEOUT_MS, REQUEST_DELAY_MS, SEARCH_KEYWORDS } from "../config.js";

// LinkedIn guest: Vietnam (geoId=104195383), remote+hybrid (f_WT=2,3), part-time+contract (f_JT=P,C)
const SEARCH_URL =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search" +
  "?keywords={kw}&geoId=104195383&f_WT=2%2C3&f_JT=P%2CC&start={start}&count=25";

const DEFAULT_KEYWORDS = [
  "Power Platform", "Power BI", "SharePoint", "Power Automate",
  "Data Engineer", "Microsoft 365",
];

export async function scrapeLinkedIn(keywords = DEFAULT_KEYWORDS) {
  const results = [];
  const seen = new Set();
  const searchList = (keywords === SEARCH_KEYWORDS ? DEFAULT_KEYWORDS : keywords).slice(0, 6);

  for (const kw of searchList) {
    const jobs = await searchLinkedIn(kw);
    for (const job of jobs) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      results.push(job);
    }
    await sleep(REQUEST_DELAY_MS * 2);
  }

  console.log(`[LinkedIn] ${results.length} relevant jobs`);
  return results;
}

async function searchLinkedIn(keyword, maxPages = 2) {
  const results = [];
  const encoded = encodeURIComponent(keyword);

  for (let page = 0; page < maxPages; page++) {
    const start = page * 25;
    const url = SEARCH_URL.replace("{kw}", encoded).replace("{start}", start);

    try {
      const res = await axios.get(url, {
        headers: { ...DEFAULT_HEADERS, Accept: "text/html" },
        timeout: REQUEST_TIMEOUT_MS,
      });
      if (res.status === 429) {
        console.warn("[LinkedIn] Rate limited");
        break;
      }
      const jobs = parseLinkedInHtml(res.data);
      if (!jobs.length) break;
      results.push(...jobs);
      await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      console.warn(`[LinkedIn] '${keyword}' page ${page}: ${err.message}`);
      break;
    }
  }

  return results;
}

function parseLinkedInHtml(html) {
  const $ = load(html);
  const jobs = [];

  $("div.job-search-card, div.base-card").each((_, el) => {
    const card = $(el);
    const title = card.find(".base-search-card__title, h3, h4").first().text().trim();
    const company = card.find(".base-search-card__subtitle, .job-search-card__company-name").first().text().trim();
    const location = card.find(".job-search-card__location").first().text().trim();
    const linkEl = card.find("a[href]").first();
    let url = linkEl.attr("href") || "";
    if (url && !url.startsWith("http")) url = "https://www.linkedin.com" + url;
    url = url.split("?")[0];

    const dateEl = card.find("time");
    let postedDate = null;
    const datetime = dateEl.attr("datetime");
    if (datetime) {
      try { postedDate = new Date(datetime); } catch { /* ignore */ }
    }

    if (!title || !url) return;

    const jobType = location.toLowerCase().includes("remote") ? "remote" : "";

    jobs.push(
      new Job({
        title,
        company,
        url,
        source: "LinkedIn",
        jobType,
        location,
        postedDate,
      })
    );
  });

  return jobs;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
