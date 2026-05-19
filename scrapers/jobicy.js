import axios from "axios";
import { Job } from "./base.js";
import { DEFAULT_HEADERS, JOBICY_API, REQUEST_TIMEOUT_MS, SEARCH_KEYWORDS } from "../config.js";

export async function scrapeJobicy(keywords = SEARCH_KEYWORDS) {
  const kwLower = keywords.map((k) => k.toLowerCase());
  const results = [];

  try {
    const res = await axios.get(JOBICY_API, {
      params: { count: 50 },
      headers: { ...DEFAULT_HEADERS, Accept: "application/json" },
      timeout: REQUEST_TIMEOUT_MS,
    });
    const rawJobs = res.data?.jobs || [];
    for (const j of rawJobs) {
      const job = parseJobicyJob(j);
      if (!job) continue;
      const searchable = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
      if (kwLower.some((kw) => searchable.includes(kw))) results.push(job);
    }
  } catch (err) {
    console.warn(`[Jobicy] failed: ${err.message}`);
  }

  console.log(`[Jobicy] ${results.length} relevant jobs`);
  return results;
}

function parseJobicyJob(j) {
  const title = (j.jobTitle || j.title || "").trim();
  const company = (j.companyName || j.company || "").trim();
  const url = (j.url || j.jobUrl || "").trim();
  if (!title || !url) return null;

  const description = (j.jobDescription || j.description || "").slice(0, 1000);
  const tags = Array.isArray(j.jobIndustry) ? j.jobIndustry : j.jobIndustry ? [j.jobIndustry] : [];
  const salaryText =
    j.annualSalaryMin && j.annualSalaryMax
      ? `$${Number(j.annualSalaryMin).toLocaleString()} – $${Number(j.annualSalaryMax).toLocaleString()}/yr`
      : j.salaryRange || "";

  return new Job({
    title,
    company,
    url,
    source: "Jobicy",
    salaryText,
    jobType: (Array.isArray(j.jobType) ? j.jobType[0] : j.jobType || "remote").toString().toLowerCase(),
    location: j.jobGeo || "Remote",
    description,
    tags: tags.map((t) => String(t).toLowerCase()),
    postedDate: parseDate(j.pubDate || j.postDate),
  });
}

function parseDate(val) {
  if (!val) return null;
  try {
    return new Date(val);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
