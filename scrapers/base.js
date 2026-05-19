import crypto from "crypto";

export class Job {
  constructor({
    title = "",
    company = "",
    url = "",
    source = "",
    salaryText = "",
    salaryMin = null,
    salaryMax = null,
    salaryCurrency = "USD",
    jobType = "",
    location = "",
    description = "",
    tags = [],
    postedDate = null,   // Date object or null
    deadline = null,     // Date object or null
    matchPercent = 0,
    matchReason = "",
  } = {}) {
    this.title = title;
    this.company = company;
    this.url = url;
    this.source = source;
    this.salaryText = salaryText;
    this.salaryMin = salaryMin;
    this.salaryMax = salaryMax;
    this.salaryCurrency = salaryCurrency;
    this.jobType = jobType;
    this.location = location;
    this.description = description;
    this.tags = tags;
    this.postedDate = postedDate;
    this.deadline = deadline;
    this.matchPercent = matchPercent;
    this.matchReason = matchReason;
  }

  /** Stable unique ID for dedup (URL hash). */
  jobId() {
    return crypto
      .createHash("md5")
      .update((this.url || "").trim().toLowerCase())
      .digest("hex")
      .slice(0, 16);
  }

  /** True if job is likely still open. */
  isActive(thresholdDays = 30) {
    const now = new Date();
    if (this.deadline && this.deadline < now) return false;
    if (this.postedDate) {
      const ageMs = now - this.postedDate;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays <= thresholdDays;
    }
    return true; // no date → assume active
  }

  salaryDisplay() {
    if (this.salaryText) return this.salaryText;
    if (this.salaryMin && this.salaryMax)
      return `${this.salaryCurrency} ${fmtNum(this.salaryMin)}–${fmtNum(this.salaryMax)}`;
    if (this.salaryMin) return `${this.salaryCurrency} ${fmtNum(this.salaryMin)}+`;
    return "Negotiable";
  }

  postedDisplay() {
    return this.postedDate ? fmtDate(this.postedDate) : "N/A";
  }

  deadlineDisplay() {
    return this.deadline ? fmtDate(this.deadline) : "N/A";
  }
}

function fmtNum(n) {
  return Number(n).toLocaleString("en-US");
}

function fmtDate(d) {
  if (!(d instanceof Date)) return "N/A";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
