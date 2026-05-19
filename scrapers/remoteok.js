import axios from "axios";
import { Job } from "./base.js";
import { DEFAULT_HEADERS, REMOTEOK_API, REQUEST_TIMEOUT_MS, SEARCH_KEYWORDS } from "../config.js";

export async function scrapeRemoteOK(keywords = SEARCH_KEYWORDS) {
  const kwLower = keywords.map((k) => k.toLowerCase());

  let data;
  try {
    const res = await axios.get(REMOTEOK_API, {
      headers: { ...DEFAULT_HEADERS, Accept: "application/json" },
      timeout: REQUEST_TIMEOUT_MS,
    });
    data = res.data;
  } catch (err) {
    console.error(`[RemoteOK] Fetch failed: ${err.message}`);
    return [];
  }

  const rawJobs = Array.isArray(data) ? data.filter((j) => j?.position) : [];
  const results = [];

  for (const j of rawJobs) {
    const title = (j.position || "").trim();
    const company = (j.company || "").trim();
    const tags = (j.tags || []).map((t) => String(t).toLowerCase());
    const description = stripHtml(j.description || "");
    const jobUrl = j.url || `https://remoteok.io/remote-jobs/${j.id || ""}`;

    const searchable = `${title} ${tags.join(" ")} ${description}`.toLowerCase();
    if (!kwLower.some((kw) => searchable.includes(kw))) continue;

    const salaryMin = parseFloat(j.salary_min) || null;
    const salaryMax = parseFloat(j.salary_max) || null;
    let salaryText = "";
    if (salaryMin && salaryMax) salaryText = `$${fmtNum(salaryMin)} – $${fmtNum(salaryMax)}/yr`;
    else if (salaryMin) salaryText = `$${fmtNum(salaryMin)}+/yr`;

    results.push(
      new Job({
        title,
        company,
        url: jobUrl,
        source: "RemoteOK",
        salaryText,
        salaryMin,
        salaryMax,
        jobType: "remote",
        location: "Remote",
        description: description.slice(0, 1000),
        tags,
        postedDate: parseIso(j.date),
      })
    );
  }

  console.log(`[RemoteOK] ${results.length} relevant jobs`);
  return results;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function fmtNum(n) {
  return Number(n).toLocaleString("en-US");
}

function parseIso(str) {
  if (!str) return null;
  try {
    return new Date(str);
  } catch {
    return null;
  }
}
