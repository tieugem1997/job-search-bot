import RSSParser from "rss-parser";
import { load } from "cheerio";
import { Job } from "./base.js";
import { WWR_FEEDS, SEARCH_KEYWORDS } from "../config.js";

const parser = new RSSParser({ timeout: 20000 });

export async function scrapeWeWorkRemotely(keywords = SEARCH_KEYWORDS) {
  const kwLower = keywords.map((k) => k.toLowerCase());
  const results = [];
  const seen = new Set();

  for (const feedUrl of WWR_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const entry of feed.items || []) {
        const link = entry.link || "";
        if (seen.has(link)) continue;

        const [company, title] = splitTitle(entry.title || "");
        const descHtml = entry.content || entry.summary || entry["content:encoded"] || "";
        const description = load(descHtml).text().trim().slice(0, 1000);

        const searchable = `${title} ${company} ${description}`.toLowerCase();
        if (!kwLower.some((kw) => searchable.includes(kw))) continue;

        seen.add(link);
        results.push(
          new Job({
            title,
            company,
            url: link,
            source: "WeWorkRemotely",
            jobType: "remote",
            location: "Remote",
            description,
            postedDate: entry.pubDate ? new Date(entry.pubDate) : null,
          })
        );
      }
    } catch (err) {
      console.warn(`[WWR] Feed error ${feedUrl}: ${err.message}`);
    }
  }

  console.log(`[WeWorkRemotely] ${results.length} relevant jobs`);
  return results;
}

function splitTitle(raw) {
  if (raw.includes(": ")) {
    const [co, ...rest] = raw.split(": ");
    return [co.trim(), rest.join(": ").trim()];
  }
  if (raw.includes(" - ")) {
    const idx = raw.indexOf(" - ");
    return [raw.slice(0, idx).trim(), raw.slice(idx + 3).trim()];
  }
  return ["", raw.trim()];
}
