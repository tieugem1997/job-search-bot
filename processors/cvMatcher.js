/**
 * CV match % calculator.
 * Mode 1: Keyword scoring (fast, free, always available)
 * Mode 2: Claude Haiku scoring (accurate, requires ANTHROPIC_API_KEY)
 */
import { CV_PROFILE, SCORING } from "../config.js";

// Pre-build scoring list: [keyword, points]
const SKILL_WEIGHTS = [
  ...CV_PROFILE.skills.primary.map((s) => [s.toLowerCase(), SCORING.primarySkillPts]),
  ...CV_PROFILE.skills.secondary.map((s) => [s.toLowerCase(), SCORING.secondarySkillPts]),
  ...CV_PROFILE.skills.integration.map((s) => [s.toLowerCase(), SCORING.integrationSkillPts]),
];

const CV_SUMMARY = CV_PROFILE.summary;

/**
 * Score a single job. Returns { percent, reason }.
 * Uses Claude if ANTHROPIC_API_KEY is set.
 */
export async function calculateMatch(job) {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const isValidKey = apiKey && !apiKey.startsWith("sk-ant-...") && apiKey.length > 20;
  if (isValidKey) {
    try {
      return await claudeMatch(job, apiKey);
    } catch (err) {
      console.warn(`[Matcher] Claude failed for '${job.title}': ${err.message}. Falling back.`);
    }
  }
  return keywordMatch(job);
}

/**
 * Score and rank all jobs.
 * Filters below minMatchToSend, sorts descending, caps at maxJobsPerRun.
 */
export async function rankJobs(jobs) {
  const results = [];
  for (const job of jobs) {
    const { percent, reason } = await calculateMatch(job);
    job.matchPercent = percent;
    job.matchReason = reason;
    if (percent >= SCORING.minMatchToSend) results.push(job);
  }
  results.sort((a, b) => b.matchPercent - a.matchPercent);
  return results.slice(0, SCORING.maxJobsPerRun);
}

// ── Keyword scoring ────────────────────────────────────────────────────────────

function keywordMatch(job) {
  const searchable = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  const titleLower = job.title.toLowerCase();

  let rawScore = 0;
  const matchedSkills = [];

  for (const [skill, pts] of SKILL_WEIGHTS) {
    if (searchable.includes(skill)) {
      rawScore += pts;
      matchedSkills.push(skill);
    }
  }

  // Title bonus: any primary skill in title
  let titleBonus = 0;
  for (const [skill] of SKILL_WEIGHTS.slice(0, CV_PROFILE.skills.primary.length)) {
    if (titleLower.includes(skill)) {
      titleBonus = SCORING.titleBonusPts;
      break;
    }
  }

  const percent = Math.min(rawScore + titleBonus, 100);
  const reason =
    matchedSkills.length
      ? `Matched: ${matchedSkills.slice(0, 5).join(", ")}`
      : "No direct skill match";

  return { percent, reason };
}

// ── Claude AI scoring ──────────────────────────────────────────────────────────

async function claudeMatch(job, apiKey) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const prompt =
    `CV Summary:\n${CV_SUMMARY}\n\n` +
    `Job Title: ${job.title}\n` +
    `Company: ${job.company}\n` +
    `Type: ${job.jobType}\n` +
    `Description (600 chars):\n${job.description.slice(0, 600)}\n` +
    `Tags: ${job.tags.join(", ")}\n\n` +
    `How well does this CV match this job? ` +
    `Reply with ONLY valid JSON: {"percent": <0-100>, "reason": "<max 12 words>"}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    system: "You are a senior recruiter. Respond ONLY with compact JSON, no extra text.",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const match = text.match(/\{.*?\}/s);
  if (!match) throw new Error(`Unexpected response: ${text}`);

  const data = JSON.parse(match[0]);
  return { percent: Number(data.percent) || 0, reason: String(data.reason || "") };
}
