/**
 * Telegram Bot notification sender.
 * Splits into batches of 4000 chars to respect Telegram's 4096-char limit.
 */
import axios from "axios";

const TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage";
const MAX_CHARS = 4000;

export async function sendResults(jobs, runDate = new Date()) {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";

  if (!token || !chatId) {
    console.error("[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env");
    return false;
  }

  const messages = buildMessages(jobs, runDate);
  let allOk = true;

  for (const msg of messages) {
    const ok = await send(token, chatId, msg);
    if (!ok) allOk = false;
    await sleep(500);
  }

  return allOk;
}

export async function sendTestMessage() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";

  if (!token || !chatId) {
    console.error("[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return false;
  }

  const msg =
    `✅ <b>Job Search Bot - Test OK</b>\n\n` +
    `Bot đang hoạt động bình thường.\n` +
    `🕐 ${new Date().toLocaleString("vi-VN")}`;

  return send(token, chatId, msg);
}

function buildMessages(jobs, runDate) {
  const dateStr = runDate.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  if (!jobs.length) {
    return [
      `📊 <b>Job Search - ${dateStr}</b>\n` +
      `⚠️ Không tìm thấy job mới phù hợp hôm nay.`,
    ];
  }

  const header =
    `📊 <b>Job Search Results - ${dateStr}</b>\n` +
    `🔍 Tìm thấy <b>${jobs.length}</b> jobs mới | Sắp xếp theo % Match\n`;

  const messages = [];
  let current = header;

  for (let i = 0; i < jobs.length; i++) {
    const block = formatJob(i + 1, jobs[i]);
    if (current.length + block.length > MAX_CHARS) {
      messages.push(current);
      current = `📄 <b>Tiếp (${i + 1}/${jobs.length})</b>\n`;
    }
    current += block;
  }
  messages.push(current);
  return messages;
}

function formatJob(idx, job) {
  const pct = job.matchPercent;
  const icon = pct >= 80 ? "🟢" : pct >= 60 ? "🟡" : pct >= 40 ? "🟠" : "🔴";

  const lines = [
    `\n${"━".repeat(28)}`,
    `${icon} <b>${pct}% Match</b>  |  #${idx}`,
    `💼 <b>${esc(job.title)}</b>`,
    `🏢 ${esc(job.company || "N/A")}`,
    `💰 ${esc(job.salaryDisplay())}`,
    `📍 ${esc(job.location || "N/A")}  |  🏷 ${esc(job.jobType || "N/A")}`,
    `📅 Posted: ${job.postedDisplay()}  |  ⏰ Deadline: ${job.deadlineDisplay()}`,
    `🔗 <a href="${job.url}">Apply → ${esc(job.source)}</a>`,
  ];

  if (job.matchReason) lines.push(`💡 ${esc(job.matchReason)}`);

  return lines.join("\n") + "\n";
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function send(token, chatId, text) {
  const url = TELEGRAM_API.replace("{token}", token);
  try {
    const res = await axios.post(
      url,
      { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true },
      { timeout: 15000 }
    );
    return res.data?.ok === true;
  } catch (err) {
    console.error(`[Telegram] Send failed: ${err.message}`);
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
