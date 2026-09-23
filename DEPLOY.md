# Deploy: GitHub Actions (chạy không cần laptop)

Bot tìm job chạy trên server GitHub, mỗi ngày **08:05 giờ VN (UTC+7)** tự động:
search job → chấm điểm match CV → gửi Telegram.

## Cách hoạt động

- Workflow: `.github/workflows/daily-search.yml` (cron `5 1 * * *` UTC = 08:05 VN)
- Tạo `.env` từ GitHub Secrets → chạy `node main.js` → gửi Telegram
- Commit ngược `data/sent_jobs.json` về repo để lần sau không gửi lại job cũ

## Cài đặt (chỉ làm 1 lần)

### 1. Set secrets trên GitHub

```bash
gh secret set TELEGRAM_BOT_TOKEN --repo tieugem1997/job-search-bot
# (dán token từ @BotFather, nhấn Enter)
gh secret set TELEGRAM_CHAT_ID --repo tieugem1997/job-search-bot
# (dán chat ID của bạn)
```

Hoặc: repo → **Settings → Secrets and variables → Actions → New repository secret**.

### 2. Chạy thử tay

Repo → **Actions** → **Daily Job Search (8AM VN)** → **Run workflow** → **Run workflow**.

Bot sẽ gửi kết quả vào Telegram ngay.

### 3. Xong — không cần làm gì thêm

- Laptop không cần bật, không cần Task Scheduler (đã tắt task local `PowerPlatformJobSearch`)
- Job mới mỗi sáng 08:05 VN sẽ tự về Telegram

## Lưu ý

- GitHub có thể trễ vài phút chạy cron (best-effort), thường đúng giờ
- Workflow chỉ gửi job **part-time / freelance / contract** — không full-time (trùng giờ làm chính 8h-18h)
- Nếu muốn chạy thủ công trên laptop vẫn được: `node main.js`

## Khôi phục task local (nếu cần)

```powershell
Enable-ScheduledTask -TaskName "PowerPlatformJobSearch"
```
