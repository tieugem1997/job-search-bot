import axios from "axios";
import { load } from "cheerio";
import { Job } from "./base.js";
import { DEFAULT_HEADERS, REQUEST_TIMEOUT_MS, REQUEST_DELAY_MS, SEARCH_KEYWORDS } from "../config.js";

const BASE_URL = "https://itviec.com";
// Daily auto search: filter remote/part-time/freelance
const SEARCH_URL_FILTERED =
  `${BASE_URL}/it-jobs?search[keywords]={kw}` +
  `&search[job_types][]=remote-job` +
  `&search[job_types][]=parttime-job` +
  `&search[job_types][]=freelance`;
// Custom /search: no job type filter — catches all types (intern, full-time, etc.)
const SEARCH_URL_ALL = `${BASE_URL}/it-jobs?search[keywords]={kw}`;

const DEFAULT_KEYWORDS = ["Power Platform", "SharePoint", "Power BI", "Data Engineer", "Power Automate"];

export async function scrapeITViec(keywords = DEFAULT_KEYWORDS, { customSearch = false } = {}) {
  const results = [];
  const seen = new Set();
  const searchList = keywords === SEARCH_KEYWORDS ? DEFAULT_KEYWORDS : keywords;
  const urlTemplate = customSearch ? SEARCH_URL_ALL : SEARCH_URL_FILTERED;

  for (const kw of searchList) {
    const jobs = await fetchITViec(kw, urlTemplate);
    for (const job of jobs) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      results.push(job);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`[ITViec] ${results.length} relevant jobs`);
  return results;
}

async function fetchITViec(keyword, urlTemplate = SEARCH_URL_FILTERED) {
  const url = urlTemplate.replace("{kw}", encodeURIComponent(keyword));
  try {
    const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: REQUEST_TIMEOUT_MS });
    const jobs = extractNextData(res.data);
    if (jobs.length) return jobs;
    return parseHtmlCards(res.data);
  } catch (err) {
    console.warn(`[ITViec] '${keyword}': ${err.message}`);
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
    deepGet(data, "props", "pageProps", "jobList") ||
    deepGet(data, "props", "pageProps", "data", "jobs") ||
    [];

  if (!Array.isArray(jobsData)) return [];

  return jobsData.map((j) => {
    const title = j.title || j.job_title || "";
    const company = j.company?.name || j.company_name || "";
    const slug = j.slug || j.id || "";
    const url = slug ? `${BASE_URL}/it-jobs/${slug}` : "";
    if (!title || !url) return null;

    return new Job({
      title,
      company,
      url,
      source: "ITViec",
      salaryText: j.salary || j.salary_range || "",
      jobType: j.remote ? "remote" : j.job_type || "onsite",
      location: j.location || "Vietnam",
      postedDate: parseDate(j.posted_at || j.created_at),
      deadline: parseDate(j.expired_at || j.deadline),
    });
  }).filter(Boolean);
}

function parseHtmlCards(html) {
  const $ = load(html);
  const results = [];

  $("div.job-card, div[class*='itp_job']").each((_, el) => {
    const card = $(el);
    const title = card.find("h2, h3").first().text().trim();
    const company = card.find("[class*='company']").first().text().trim();
    const linkEl = card.find("a[href]").first();
    const href = linkEl.attr("href") || "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const salaryText = card.find("[class*='salary']").first().text().trim();

    if (!title || !url) return;
    results.push(new Job({ title, company, url, source: "ITViec", salaryText, location: "Vietnam" }));
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
