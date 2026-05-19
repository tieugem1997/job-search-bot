# Hướng dẫn Deploy lên Render (chạy 24/7 không cần máy bật)

## Bước 1: Đẩy code lên GitHub

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/<username>/job-search-bot.git
git push -u origin main
```

## Bước 2: Tạo tài khoản Render

- Vào https://render.com → Sign up miễn phí
- Kết nối với GitHub account

## Bước 3: Tạo Web Service

1. Dashboard → **New** → **Web Service**
2. Chọn repo `job-search-bot`
3. Cấu hình:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node bot.js`
   - **Instance Type**: Free (hoặc Starter $7/tháng để không bị ngủ)

## Bước 4: Cấu hình Environment Variables

Trong Render Dashboard → **Environment** → thêm:

| Key | Value |
|-----|-------|
| `TELEGRAM_BOT_TOKEN` | token từ @BotFather |
| `TELEGRAM_CHAT_ID` | chat ID của bạn |
| `ANTHROPIC_API_KEY` | (tùy chọn) dùng Claude AI để match CV |

## Bước 5: Giữ bot luôn awake (Free tier)

Free tier của Render ngủ sau 15 phút. Để bot nhận tin nhắn Telegram liên tục:

**Dùng UptimeRobot (miễn phí):**
1. Vào https://uptimerobot.com → đăng ký free
2. **New Monitor** → HTTP(s)
3. URL: `https://<your-render-app>.onrender.com`
4. Interval: **5 minutes**
5. → Bot sẽ không bao giờ ngủ

Hoặc dùng **Render Starter** ($7/tháng) để không cần trick này.

## Kiểm tra hoạt động

Sau khi deploy, bot sẽ gửi tin nhắn Telegram:
> 🚀 Job Search Bot đã khởi động!

Gõ `/help` trong Telegram để xem lệnh.

---

## Cách dùng bot

| Lệnh | Mô tả |
|------|-------|
| `/help` | Hiện danh sách lệnh |
| `/status` | Kiểm tra bot còn sống |
| `/search Designer fresher Vietnam` | Tìm job Designer fresher |
| `/search Data Analyst intern` | Tìm job Data Analyst intern |
| `/search Power BI, SharePoint` | Tìm nhiều từ khóa (phân cách bằng dấu phẩy) |

**Auto:** Mỗi ngày lúc **8:00 SA** bot tự động tìm job Power Platform, SharePoint, Power BI, Data Engineer ở Việt Nam (remote/part-time/freelance) và gửi kết quả vào Telegram.
