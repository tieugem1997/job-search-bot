/**
 * Telegram Bot Server — chạy 24/7 trên cloud
 *
 * Tính năng:
 *   - Cron 8:00 SA (giờ VN) → tự động tìm job → gửi Telegram
 *   - /search <query>  → tìm job thủ công với từ khóa bất kỳ
 *   - /help            → danh sách lệnh
 *   - /status          → trạng thái bot
 *
 * Deploy: Render / Railway / Fly.io
 */
import "dotenv/config";
import http from "http";
import axios from "axios";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname as pathDirname } from "path";
import { fileURLToPath } from "url";

const __dir = pathDirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TG_API = `https://api.telegram.org/bot${TOKEN}`;
const SENT_FILE = join(__dir, "data", "sent_jobs.json");
const LOG_DIR = join(__dir, "data", "logs");
mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(join(__dir, "data"), { recursive: true });

// ── Logger ─────────────────────────────────────────────────────────────────────
function log(level, ...args) {
  console.log(`${new Date().toISOString()} [${level}] ${args.join(" ")}`);
}
const logger = {
  info: (...a) => log("INFO", ...a),
  warn: (...a) => log("WARN", ...a),
  error: (...a) => log("ERROR", ...a),
};

// ── Dedup helpers ──────────────────────────────────────────────────────────────
function loadSentIds() {
  if (!existsSync(SENT_FILE)) return new Set();
  try { return new Set(JSON.parse(readFileSync(SENT_FILE, "utf8"))); }
  catch { return new Set(); }
}

function saveSentIds(ids) {
  writeFileSync(SENT_FILE, JSON.stringify([...ids].slice(-2000), null, 2), "utf8");
}

// ── Telegram helpers ───────────────────────────────────────────────────────────
async function sendTelegram(text, targetChatId = CHAT_ID) {
  if (!TOKEN || !targetChatId) return false;
  try {
    await axios.post(`${TG_API}/sendMessage`, {
      chat_id: targetChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }, { timeout: 15000 });
    return true;
  } catch (err) {
    logger.warn(`sendTelegram: ${err.message}`);
    return false;
  }
}

function escHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Daily auto job search ──────────────────────────────────────────────────────
async function runDailySearch() {
  const { scrapeRemoteOK, scrapeJobicy, scrapeWeWorkRemotely, scrapeLinkedIn, scrapeITViec, scrapeTopDev } =
    await import("./scrapers/index.js");
  const { SCORING } = await import("./config.js");
  const { rankJobs } = await import("./processors/cvMatcher.js");
  const { sendResults } = await import("./notifiers/telegram.js");

  const runTime = new Date();
  logger.info("⏰ Daily job search started");

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
      const jobs = await fn();
      logger.info(`  ${name}: ${jobs.length}`);
      allJobs.push(...jobs);
    } catch (err) {
      logger.error(`  ${name} failed: ${err.message}`);
    }
    await sleep(1500);
  }

  // URL dedup → active filter → sent dedup
  const urlMap = new Map();
  for (const job of allJobs) {
    if (job.url && !urlMap.has(job.url)) urlMap.set(job.url, job);
  }
  const activeJobs = [...urlMap.values()].filter((j) => j.isActive(SCORING.activeDaysThreshold));
  const sentIds = loadSentIds();
  const newJobs = activeJobs.filter((j) => !sentIds.has(j.jobId()));

  const ranked = await rankJobs(newJobs);
  logger.info(`Matched: ${ranked.length}`);

  const ok = await sendResults(ranked, runTime);
  if (ok && ranked.length) {
    saveSentIds(new Set([...sentIds, ...ranked.map((j) => j.jobId())]));
  }
  logger.info(`✓ Daily search done`);
}

// Words to strip from scraper queries (location/stop words that hurt search precision)
const LOCATION_STOP = /\b(viet\s*nam|vietnam|ha\s*noi|ho\s*chi\s*minh|hcm|hà\s*nội|tp\.?\s*hcm|remote|part[- ]?time|freelance|the|and|for|with|in|at)\b/gi;

// ── Custom search for /search command ─────────────────────────────────────────
async function runCustomSearch(keywords, chatId) {
  const { scrapeITViec, scrapeTopDev, scrapeLinkedIn } = await import("./scrapers/index.js");
  const { SCORING } = await import("./config.js");
  const { sendResults } = await import("./notifiers/telegram.js");

  // Clean location/stop words so scrapers get a precise query
  // "data analyst intern viet nam" → "data analyst intern"
  const scraperKeywords = keywords
    .map((k) => k.replace(LOCATION_STOP, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  logger.info(`Custom search: [${keywords.join(", ")}] → scraper: [${scraperKeywords.join(", ")}]`);
  await sendTelegram(
    `🔍 Đang tìm: <b>${escHtml(keywords.join(", "))}</b>\n⏳ Vui lòng chờ 30–60 giây...`,
    chatId
  );

  const allJobs = [];
  const opts = { customSearch: true };
  for (const [name, fn] of [["ITViec", scrapeITViec], ["TopDev", scrapeTopDev], ["LinkedIn", scrapeLinkedIn]]) {
    try {
      const jobs = await fn(scraperKeywords, opts);
      logger.info(`  ${name}: ${jobs.length}`);
      allJobs.push(...jobs);
    } catch (err) {
      logger.warn(`  ${name}: ${err.message}`);
    }
    await sleep(1500);
  }

  // Dedup + active filter
  const urlMap = new Map();
  for (const job of allJobs) {
    if (job.url && !urlMap.has(job.url)) urlMap.set(job.url, job);
  }
  const uniqueJobs = [...urlMap.values()].filter((j) => j.isActive(SCORING.activeDaysThreshold));

  if (!uniqueJobs.length) {
    await sendTelegram(`❌ Không tìm thấy job nào cho: <b>${escHtml(keywords.join(", "))}</b>`, chatId);
    return;
  }

  // Score using individual words from the ORIGINAL query (include location context for relevance)
  const SCORE_SKIP = new Set(["viet", "nam", "the", "and", "for", "with", "in", "at"]);
  const scoreWords = keywords
    .flatMap((k) => k.toLowerCase().split(/\s+/))
    .filter((w) => w.length > 2 && !SCORE_SKIP.has(w));

  const scored = uniqueJobs.map((j) => {
    const searchable = `${j.title} ${j.description} ${j.tags.join(" ")}`.toLowerCase();
    const titleLower = j.title.toLowerCase();
    const matched = scoreWords.filter((w) => searchable.includes(w));
    const titleBonus = scoreWords.some((w) => titleLower.includes(w)) ? 20 : 0;
    j.matchPercent = Math.min(matched.length * 20 + titleBonus, 100) || 10;
    j.matchReason = matched.length
      ? `Từ khóa: ${[...new Set(matched)].slice(0, 4).join(", ")}`
      : "Kết quả tìm kiếm";
    return j;
  });

  scored.sort((a, b) => b.matchPercent - a.matchPercent);
  const top = scored.slice(0, 15);

  // Temporarily override CHAT_ID in environment for sendResults
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_CHAT_ID = chatId;
  await sendResults(top, new Date());
  process.env.TELEGRAM_CHAT_ID = originalChatId;

  logger.info(`✓ Custom search sent ${top.length} jobs`);
}

// ── Telegram message handler ───────────────────────────────────────────────────
let isSearching = false;

async function handleMessage(msg) {
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();

  if (chatId !== String(CHAT_ID)) {
    await sendTelegram(`⛔ Bot này chỉ phục vụ chủ sở hữu.`, chatId);
    return;
  }

  if (text === "/status") {
    const vnTime = new Date(Date.now() + 7 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
    await sendTelegram(
      `✅ <b>Bot đang hoạt động</b>\n🕐 Giờ VN: ${vnTime}\n📅 Auto search: 8:00 SA mỗi ngày`,
      chatId
    );
    return;
  }

  if (text === "/help" || text === "/start") {
    await sendTelegram(
      `🤖 <b>Job Search Bot</b>\n\n` +
      `<b>Lệnh:</b>\n` +
      `/search &lt;từ khóa&gt; — Tìm job theo yêu cầu\n` +
      `/status — Kiểm tra trạng thái\n` +
      `/help — Hiện menu này\n\n` +
      `<b>Ví dụ tìm thủ công:</b>\n` +
      `<code>/search Designer fresher Vietnam</code>\n` +
      `<code>/search Data Analyst intern</code>\n` +
      `<code>/search Python backend remote</code>\n\n` +
      `📅 Tự động tìm job lúc <b>8:00 SA</b> hàng ngày (Power BI, SharePoint, Data Engineer...)`,
      chatId
    );
    return;
  }

  if (text.toLowerCase().startsWith("/search ")) {
    if (isSearching) {
      await sendTelegram(`⏳ Đang có tìm kiếm đang chạy, vui lòng chờ...`, chatId);
      return;
    }

    const rawQuery = text.replace(/^\/search\s+/i, "").trim();
    if (!rawQuery) {
      await sendTelegram(`⚠️ Nhập từ khóa sau lệnh.\nVí dụ: <code>/search Designer fresher</code>`, chatId);
      return;
    }

    // "Designer fresher Vietnam" → ["Designer fresher Vietnam"] (treat as single phrase)
    // "Power BI, SharePoint" → ["Power BI", "SharePoint"] (comma separated = multiple keywords)
    const keywords = rawQuery.includes(",")
      ? rawQuery.split(",").map((k) => k.trim()).filter(Boolean)
      : [rawQuery];

    isSearching = true;
    try {
      await runCustomSearch(keywords, chatId);
    } catch (err) {
      logger.error(`Custom search error: ${err.message}`);
      await sendTelegram(`❌ Lỗi: ${escHtml(err.message)}`, chatId);
    } finally {
      isSearching = false;
    }
    return;
  }

  // Unknown message → suggest /search
  if (!text.startsWith("/")) {
    await sendTelegram(
      `💡 Muốn tìm job? Thử:\n<code>/search ${escHtml(text)}</code>`,
      chatId
    );
  }
}

// ── Telegram long polling ──────────────────────────────────────────────────────
let lastUpdateId = 0;

async function poll() {
  try {
    const res = await axios.get(`${TG_API}/getUpdates`, {
      params: { offset: lastUpdateId + 1, timeout: 30, allowed_updates: ["message"] },
      timeout: 35000,
    });
    for (const update of res.data?.result || []) {
      lastUpdateId = update.update_id;
      const msg = update.message || update.edited_message;
      if (msg) handleMessage(msg).catch((e) => logger.error(`handleMessage: ${e.message}`));
    }
  } catch (err) {
    if (!err.message.includes("timeout") && !err.message.includes("ECONNRESET")) {
      logger.warn(`poll: ${err.message}`);
    }
  }
  setTimeout(poll, 1000);
}

// ── Self-ping: prevent Render free tier sleep (resets 15-min inactivity timer) ─
function startSelfPing() {
  const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  setInterval(async () => {
    try {
      await axios.get(publicUrl, { timeout: 10000 });
      logger.info(`[SelfPing] OK → ${publicUrl}`);
    } catch { /* ignore */ }
  }, 9 * 60 * 1000); // every 9 min — well before Render's 15-min sleep threshold
  logger.info(`[SelfPing] Started — pinging ${publicUrl} every 9 min`);
}

// ── Cron: daily 8:00 AM Vietnam time (UTC+7 = UTC 01:00) ─────────────────────
function startCron() {
  let lastRan = "";
  setInterval(async () => {
    // Vietnam time = UTC + 7h
    const vnNow = new Date(Date.now() + 7 * 3600_000);
    const hhmm = `${String(vnNow.getUTCHours()).padStart(2, "0")}:${String(vnNow.getUTCMinutes()).padStart(2, "0")}`;
    const key = `${vnNow.toISOString().slice(0, 10)}-${hhmm}`;

    if (hhmm === "08:00" && lastRan !== key) {
      lastRan = key;
      runDailySearch().catch((err) => {
        logger.error(`Cron error: ${err.message}`);
        sendTelegram(`❌ Lỗi cron job: ${escHtml(err.message)}`);
      });
    }
  }, 60_000);

  logger.info("⏰ Cron ready — daily 8:00 AM VN time");
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  if (!TOKEN || !CHAT_ID) {
    logger.error("TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình trong .env");
    process.exit(1);
  }

  // HTTP server cho Render health check
  const port = Number(process.env.PORT) || 3000;
  http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Job Search Bot is running");
  }).listen(port, () => logger.info(`HTTP server on :${port}`));

  startSelfPing();
  startCron();

  logger.info("📡 Starting Telegram polling...");
  poll();

  await sendTelegram(
    `🚀 <b>Job Search Bot đã khởi động!</b>\n` +
    `📅 Auto search lúc <b>8:00 SA</b> mỗi ngày\n` +
    `💬 Gõ /help để xem lệnh`
  );

  logger.info("✅ Bot ready");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
