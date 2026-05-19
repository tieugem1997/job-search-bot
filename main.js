/**
 * Job Search Automation - Main Entry Point
 *
 * Usage:
 *   node main.js              # Run full job search
 *   node main.js --test       # Test Telegram connection
 *   node main.js --reset-cache # Clear dedup cache
 */
import "dotenv/config";
import { createWriteStream, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Logging ────────────────────────────────────────────────────────────────────
const LOG_DIR = join(__dir, "data", "logs");
mkdirSync(LOG_DIR, { recursive: true });

const logFile = join(LOG_DIR, `run_${fmtTimestamp()}.log`);
const logStream = createWriteStream(logFile, { flags: "a" });

function log(level, ...args) {
  const ts = new Date().toISOString();
  const line = `${ts} [${level}] ${args.join(" ")}`;
  console.log(line);
  logStream.write(line + "\n");
}

const logger = {
  info: (...a) => log("INFO", ...a),
  warn: (...a) => log("WARN", ...a),
  error: (...a) => log("ERROR", ...a),
};

// ── Dedup cache ────────────────────────────────────────────────────────────────
const SENT_FILE = join(__dir, "data", "sent_jobs.json");

function loadSentIds() {
  if (!existsSync(SENT_FILE)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(SENT_FILE, "utf8")));
  } catch {
    return new Set();
  }
}

function saveSentIds(ids) {
  mkdirSync(dirname(SENT_FILE), { recursive: true });
  const trimmed = [...ids].slice(-2000);
  writeFileSync(SENT_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

// ── Scraper runner ─────────────────────────────────────────────────────────────
async function runScrapers() {
  const { scrapeRemoteOK, scrapeJobicy, scrapeWeWorkRemotely, scrapeLinkedIn, scrapeITViec, scrapeTopDev } =
    await import("./scrapers/index.js");

  const scrapers = [
    ["RemoteOK", scrapeRemoteOK],
    ["Jobicy", scrapeJobicy],
    ["WeWorkRemotely", scrapeWeWorkRemotely],
    ["LinkedIn", scrapeLinkedIn],
    ["ITViec", scrapeITViec],
    ["TopDev", scrapeTopDev],
  ];

  const allJobs = [];
  for (const [name, fn] of scrapers) {
    try {
      logger.info(`Scraping ${name}...`);
      const jobs = await fn();
      logger.info(`  → ${jobs.length} jobs from ${name}`);
      allJobs.push(...jobs);
    } catch (err) {
      logger.error(`  ✗ ${name} failed: ${err.message}`);
    }
    await sleep(1500);
  }
  return allJobs;
}

// ── Main pipeline ──────────────────────────────────────────────────────────────
async function runJobSearch() {
  const runTime = new Date();
  logger.info("=".repeat(50));
  logger.info(`Job search started at ${runTime.toISOString()}`);
  logger.info("=".repeat(50));

  // 1. Scrape
  const allJobs = await runScrapers();
  logger.info(`Total raw jobs: ${allJobs.length}`);

  // 2. URL dedup
  const urlMap = new Map();
  for (const job of allJobs) {
    if (job.url && !urlMap.has(job.url)) urlMap.set(job.url, job);
  }
  const uniqueJobs = [...urlMap.values()];
  logger.info(`After URL dedup: ${uniqueJobs.length}`);

  // 3. Active filter
  const { SCORING } = await import("./config.js");
  const activeJobs = uniqueJobs.filter((j) => j.isActive(SCORING.activeDaysThreshold));
  logger.info(`Active (≤${SCORING.activeDaysThreshold} days): ${activeJobs.length}`);

  // 4. Already-sent dedup
  const sentIds = loadSentIds();
  const newJobs = activeJobs.filter((j) => !sentIds.has(j.jobId()));
  logger.info(`New (not previously sent): ${newJobs.length}`);

  // 5. Match & rank
  const { rankJobs } = await import("./processors/cvMatcher.js");
  const ranked = await rankJobs(newJobs);
  logger.info(`After match filter (≥${SCORING.minMatchToSend}%): ${ranked.length}`);

  // 6. Send via Telegram
  const { sendResults } = await import("./notifiers/telegram.js");
  const ok = await sendResults(ranked, runTime);

  if (ok) {
    const newIds = new Set(ranked.map((j) => j.jobId()));
    saveSentIds(new Set([...sentIds, ...newIds]));
    logger.info(`✓ Sent ${ranked.length} jobs via Telegram`);
  } else {
    logger.error("✗ Telegram send failed — dedup cache NOT updated");
  }

  logger.info(`Run complete. Log: ${logFile}`);
  logStream.end();
}

// ── CLI ────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--reset-cache")) {
    if (existsSync(SENT_FILE)) {
      writeFileSync(SENT_FILE, "[]", "utf8");
      logger.info("Dedup cache cleared.");
    } else {
      logger.info("No cache file found.");
    }
    if (!args.includes("--test") && !args.includes("--run")) {
      logStream.end();
      return;
    }
  }

  if (args.includes("--test")) {
    const { sendTestMessage } = await import("./notifiers/telegram.js");
    const ok = await sendTestMessage();
    logger.info(ok ? "✓ Telegram test OK" : "✗ Telegram test FAILED");
    logStream.end();
    process.exit(ok ? 0 : 1);
  }

  await runJobSearch();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fmtTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
}
