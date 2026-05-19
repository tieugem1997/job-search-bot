import axios from "axios";
import { load } from "cheerio";
import { Job } from "./base.js";
import { DEFAULT_HEADERS, REQUEST_TIMEOUT_MS, REQUEST_DELAY_MS, SEARCH_KEYWORDS } from "../config.js";

const BASE_URL = "https://topdev.vn";
const JOB_TYPES_FILTERED = ["remote-jobs", "part-time", "freelance"];
const SEARCH_URL_FILTERED = `${BASE_URL}/it-jobs?q={kw}&type={type}`;
const SEARCH_URL_ALL = `${BASE_URL}/it-jobs?q={kw}`;

const DEFAULT_KEYWORDS = ["Power Platform", "SharePoint", "Power BI", "Data Engineer", "Power Automate"];

export async function scrapeTopDev(keywords = DEFAULT_KEYWORDS, { customSearch = false } = {}) {
  const results = [];
  const seen = new Set();
  const searchList = keywords === SEARCH_KEYWORDS ? DEFAULT_KEYWORDS : keywords;

  for (const kw of searchList) {
    if (customSearch) {
      const jobs = await fetchTopDev(kw, null, SEARCH_URL_ALL);
      for (const job of jobs) {
        if (seen.has(job.url)) continue;
        seen.add(job.url);
        results.push(job);
      }
      await sleep(REQUEST_DELAY_MS);
    } else {
      for (const type of JOB_TYPES_FILTERED) {
        const jobs = await fetchTopDev(kw, type, SEARCH_URL_FILTERED);
        for (const job of jobs) {
          if (seen.has(job.url)) continue;
          seen.add(job.url);
          results.push(job);
        }
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  console.log(`[TopDev] ${results.length} relevant jobs`);
  return results;
}

async function fetchTopDev(keyword, type = null, urlTemplate = SEARCH_URL_ALL) {
  let url = urlTemplate.replace("{kw}", encodeURIComponent(keyword));
  if (type) url = url.replace("{type}", type);
  try {
    const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: REQUEST_TIMEOUT_MS });
    const jobs = extractNextData(res.data);
    if (jobs.length) return jobs;
    return parseHtmlCards(res.data);
  } catch (err) {
    console.warn(`[TopDev] '${keyword}': ${err.message}`);
    return [];
  }
}

function extractNextData(html) {
  const $ = load(html);
  const script = $("#__NEXT_DATA__").text();
  if (!script) return [];

  let data;
  try { data = JSON.parse(script); } catch { return []; }

  const jobsData =
    deepGet(data, "props", "pageProps", "jobs") ||
    deepGet(data, "props", "pageProps", "data", "jobs") ||
    deepGet(data, "props", "pageProps", "listJob") ||
    [];

  if (!Array.isArray(jobsData)) return [];

  return jobsData.map((j) => {
    const title = j.title || j.name || "";
    const company = j.company?.name || j.company?.title || j.company_name || "";
    const slug = j.slug || j.alias || j.id || "";
    const url = slug ? `${BASE_URL}/it-jobs/${slug}` : "";
    if (!title || !url) return null;

    return new Job({
      title,
      company,
      url,
      source: "TopDev",
      salaryText: j.salary || j.salary_range || "",
      jobType: j.is_remote || j.remote ? "remote" : j.job_type || "onsite",
      location: j.location || j.address || "Vietnam",
      postedDate: parseDate(j.published_at || j.created_at),
      deadline: parseDate(j.expired_at || j.end_date),
    });
  }).filter(Boolean);
}

function parseHtmlCards(html) {
  const $ = load(html);
  const results = [];

  $("div[class*='job-item'], div[class*='card-job'], article[class*='job']").each((_, el) => {
    const card = $(el);
    const title = card.find("h3, h2, a[class*='title']").first().text().trim();
    const company = card.find("[class*='company'], [class*='employer']").first().text().trim();
    const linkEl = card.find("a[href]").first();
    const href = linkEl.attr("href") || "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const salaryText = card.find("[class*='salary']").first().text().trim();

    if (!title || !url) return;
    results.push(new Job({ title, company, url, source: "TopDev", salaryText, location: "Vietnam" }));
  });

  return results;
}

function deepGet(obj, ...keys) {
  return keys.reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
}

function parseDate(val) {
  if (!val) return null;
  try { return new Date(val); } catch { return null; }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
