# Instagram Comment DM Bot

**繁體中文** | [English](README.en.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**自架的 Instagram 自動化工具：有人在你的貼文留言命中關鍵字時，自動公開回覆並私訊對方——完整跑在 Cloudflare Workers 上。**

為「單一管理者管理自己的 Instagram 專業帳號」而設計。不依賴第三方 SaaS、沒有按訊息計費：你自己的 Meta App、你自己的 Cloudflare 帳號、你自己的資料。

> **這是 Sean 版（熊恩自用 fork）。** 以 [pjwang2022/instagram-comment-dm-bot](https://github.com/pjwang2022/instagram-comment-dm-bot)（MIT 授權）為基礎，加上下表的功能。原作者的版權與授權保留於 [LICENSE](LICENSE)。
>
> **Sean 版 2.0.0 起改為 Supabase（後端與資料庫）＋ GitHub Pages（後台網頁）**，不需要 Cloudflare，也不需要在電腦安裝任何東西。上線步驟見 [docs/上線步驟.md](docs/上線步驟.md)。本頁下方原作者的 Cloudflare 部署說明與「一鍵部署」按鈕**不適用於 Sean 版**，僅保留作為參考。

## Sean 版新增功能

| 功能 | 說明 |
|------|------|
| **Facebook 粉專** | 粉專貼文／影片留言自動私訊（Messenger）＋公開回覆、Messenger 私訊關鍵字自動回覆。與 Instagram 共用同一套規則與後台，可設定規則只套用某個平台 |
| 追蹤後才給 | 第一則私訊改帶「領取」按鈕，對方按下才查有沒有追蹤；沒追蹤就送「我追蹤了」按鈕，可重複檢查。查詢失敗一律放行 |
| 先留 Email 才給 | 請對方直接回覆 Email，辨識成功才交付；已留過的人不再問。格式不對會提示一次 |
| 聯絡人名單 | 留言、限動回應、私訊、按按鈕的人都進名單；後台「名單」頁可搜尋、依標籤篩選、只看有 Email |
| 標籤與 CSV | 自動化可設定標籤，觸發即貼上；名單匯出 CSV（UTF-8 BOM，Excel 開中文不亂碼，防公式注入） |
| 每人只觸發一次 | 同一個人跨貼文、跨觸發方式只送一次 |
| 私訊關鍵字 | 有人私訊特定關鍵字時自動回覆（不允許「任何私訊都回」） |
| 廣告／ig.me 連結 | Click-to-DM 廣告或 `ig.me/m/帳號?ref=xxx` 開啟對話時，依 ref 或廣告 ID 觸發 |
| Token 自動續期 | 原版 token 60 天後會失效；Sean 版每天檢查，剩不到 20 天自動續期並存進資料庫 |
| 刪除聯絡人 | 處理資料刪除要求：刪名單與觸發紀錄，並抹除執行紀錄中的身分與留言內容 |

**平台支援一覽**

| 觸發 | Instagram | Facebook 粉專 |
|------|-----------|---------------|
| 貼文、影片、Reels 留言 → 自動私訊 | 支援 | 支援（Messenger） |
| 留言公開回覆 | 支援 | 支援 |
| 限時動態回覆 → 自動私訊 | 支援 | **不支援**（Meta 沒有粉專限動回覆事件） |
| 私訊關鍵字自動回覆 | 支援 | 支援（Messenger） |
| 追蹤後才給 | 支援 | 不支援（沒有可查追蹤的 API，自動放行） |
| 先留 Email、標籤、名單、CSV | 支援 | 支援 |

進階選項（追蹤、Email、標籤、每人一次）在編輯器裡預設收合，不用就不必理會。

**Sean 版額外需要的 Meta 設定**

- Instagram webhook 除了 `comments`、`messages`，還要訂閱 **`messaging_postbacks`**（領取按鈕）與 **`messaging_referral`**（廣告／ig.me 連結）
- IG App 內「設定 > 訊息與限時動態回覆 > 訊息控制 > 已連結的工具 > 允許存取訊息」要開啟
- Facebook 粉專：同一個 Meta App 加入 Messenger（粉專）使用案例，取得**粉專存取權杖**（權限 `pages_messaging`、`pages_manage_metadata`、`pages_read_engagement`、`pages_show_list`），設定兩個 secret：
  - `FACEBOOK_PAGE_ACCESS_TOKEN`：粉專存取權杖（用長效使用者權杖換得的粉專權杖不會過期）
  - `META_APP_SECRET`：應用程式設定 > 基本資料 > 應用程式密鑰（粉專 webhook 用它簽章）
- 粉專 webhook 用同一個 Callback URL，訂閱 Page 物件的 `feed`、`messages`、`messaging_postbacks`、`messaging_referrals`。後台按「同步」時系統也會自動幫粉專訂閱。
- 沒設定 `FACEBOOK_PAGE_ACCESS_TOKEN` 時只跑 Instagram；只設定粉專權杖、不設 Instagram 權杖也可以只跑 Facebook。

## 先在自己的 Mac 上試用

雙擊資料夾裡的 **`本機試用.command`**，會自動安裝並在瀏覽器打開後台。要接真的 IG／FB 測試，再雙擊 **`開啟外部網址.command`**。完整步驟見 [`docs/本機試用.md`](docs/本機試用.md)。

## 一鍵部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/pjwang2022/instagram-comment-dm-bot)

點按鈕後會依序發生：

1. **複製本 repo** 到你自己的 GitHub（或 GitLab）帳號。
2. **自動開通資源**——在你的 Cloudflare 帳號建立 D1 資料庫與 Queue（免費方案即可；Queues 自 2026 年 2 月起開放免費方案）。
3. **提示你填入四個 secrets**（清單見 [`.dev.vars.example`](.dev.vars.example)：`INSTAGRAM_APP_SECRET`、`WEBHOOK_VERIFY_TOKEN`、`INSTAGRAM_ACCOUNT_ACCESS_TOKEN`、`ADMIN_SESSION_SECRET`）。
4. **建置並部署**，同時設好 push 即自動重新部署：之後改你那份 repo、push 就會自動上線。

首次部署完成後，到你自己的 repo 收尾：

- 完成 [Meta 端設定](#2-meta-端)（webhook 訂閱＋access token）。不需要改任何設定檔——系統會用 access token 自動識別並註冊你的 Instagram 帳號。
- 打開 `/admin`，在首次啟動設定頁[建立管理者帳號](#3-建立管理者帳號)——部署完請盡快做這步。

想全程手動操作？請看下方完整的 [Quick Start](#quick-start)。

## 功能

- **每篇貼文獨立的關鍵字自動化** —— 支援 `contains_any`／`exact_any`／`all_comments` 比對模式，含文字正規化與排除條件。
- **支援排程貼文** —— Instagram API 看不到未發布的貼文，因此可事先建立「待命自動化」（貼文一上線即自動綁定，連第一則留言都不漏），或設定套用到所有新貼文的全帳號預設。
- **每位留言者一次性公開回覆＋一則私訊**，公開回覆支援多變體輪替，私訊可選配可點擊的連結按鈕。
- **限時動態自動化** —— 有人回應限動且訊息含關鍵字時自動私訊（逐則限動設定；限動 24 小時過期後自動暫停）。
- **冪等設計** —— webhook 事件與自動化執行都有去重機制，Meta 重送 webhook 不會造成重複回覆。
- **自動重試與退避**（30 秒／2 分／10 分）處理 Meta API 暫時性失敗；永久性錯誤（token 失效、權限、政策）立即停止不重試。
- **熔斷與緊急停止** —— 連續失敗自動停用該自動化；管理後台有一鍵全面停止開關。
- **管理後台**（React SPA，路徑 `/admin`）—— 登入、貼文列表與同步、自動化編輯器、執行紀錄（含每次 Meta API 呼叫的錯誤細節）。
- **內建安全性** —— webhook HMAC 簽章驗證（constant-time）、PBKDF2 密碼雜湊、HttpOnly Session Cookie、CSRF 防護、rate limiting、含機密遮蔽的結構化 log。

## 架構

```text
Instagram 留言
      │  webhook（簽章驗證）
      ▼
Cloudflare Worker (Hono) ──▶ Cloudflare Queue ──▶ Consumer：關鍵字比對
      │                                             ├─ 公開回覆（Meta API）
      ▼                                             └─ 私訊 DM（Meta API）
Cloudflare D1 (SQLite)  ◀── 執行紀錄、API 呼叫紀錄、audit logs
      ▲
Cron：每日貼文同步 · Token 到期檢查
```

技術棧：Cloudflare Workers · Hono · D1（Drizzle ORM）· Queues · Cron Triggers · React + Vite 管理後台。

## 前置需求

- **Cloudflare 帳號**（免費方案即可——Queues 免費版每日 10,000 次佇列操作、訊息保留 24 小時，個人帳號用量綽綽有餘；重度用量再升級 Workers Paid），並已完成 `npx wrangler login`。
- **Meta 開發者 App**（已加入 Instagram 產品）與一個你管理的 **Instagram 專業帳號**。
- **Node.js 20+**。

## Quick Start

### 1. Cloudflare 端

```bash
git clone https://github.com/pjwang2022/instagram-comment-dm-bot.git
cd instagram-comment-dm-bot
npm ci && npm ci --prefix admin

# 正式環境機密。每個 secret 設定後約 30 秒才生效。
npx wrangler secret put INSTAGRAM_APP_SECRET
npx wrangler secret put WEBHOOK_VERIFY_TOKEN        # 自訂隨機字串；步驟 2 會再用到
npx wrangler secret put INSTAGRAM_ACCOUNT_ACCESS_TOKEN
npx wrangler secret put ADMIN_SESSION_SECRET     # 32 bytes 以上隨機值

# 部署——首次執行會自動建立 D1 資料庫與 Queue、建置管理後台、
# 部署 Worker 並套用 migrations。不需要命名任何資源、不需要改任何設定檔。
npm run deploy
```

### 2. Meta 端

1. 到 [Meta for Developers](https://developers.facebook.com/) 建立 App 並加入 **Instagram** 產品。
2. 為你的專業帳號取得 access token，權限需涵蓋讀取留言、回覆留言與發送訊息（例如 `instagram_business_basic`、`instagram_business_manage_comments`、`instagram_business_manage_messages`——實際名稱以 Meta 官方文件為準），存入 `INSTAGRAM_ACCOUNT_ACCESS_TOKEN` secret。請使用**長效（long-lived）token**。Sean 版會每天檢查到期日，剩不到 20 天自動續期（續期後的 token 存在 D1，之後優先使用）。
3. 設定 webhook 訂閱：
   - Callback URL：`https://<你的網域>/api/webhooks/meta/instagram`
   - Verify token：與 `WEBHOOK_VERIFY_TOKEN` secret 相同的值
   - 訂閱 **`comments`** 欄位；若要使用限時動態自動化，一併訂閱 **`messages`** 欄位。
   - Sean 版：再訂閱 **`messages`**、**`messaging_postbacks`**、**`messaging_referral`**（私訊關鍵字、領取按鈕、廣告／ig.me 連結都需要）。
4. **把 App 切換為「發佈」（上線）狀態**——開發模式下，webhook 只會送 App 角色成員的事件，陌生人留言不會觸發。發佈需要公開的隱私政策網址，本專案內建於 `https://<你的網域>/privacy`（聯絡方式預設為通用文字，不公開管理者 Email 也不點名 IG 帳號；要提供具體聯絡管道可設定 `PRIVACY_CONTACT` 變數）。
5. 不需要走 App 審核（App Review）／進階存取——那是服務其他人帳號才需要的流程；自用工具操作自己授權的帳號，標準存取即可。

#### 限時動態自動化的額外設定

- Webhook 訂閱必須包含 **`messages`** 欄位（系統只處理帶 `reply_to.story` 的訊息，一般 DM 一律忽略）。
- Access token 需具備 `instagram_business_manage_messages` 權限。
- 設定完成後務必實測：對自己的限動回覆關鍵字，確認收到自動私訊
 （Workers 正式 runtime 的限制在 `wrangler dev` 測不出來，見 CLAUDE.md）。

### 3. 建立管理者帳號

**首次部署完成後立刻**打開 `https://<你的網域>/admin`。在還沒有任何管理者帳號時，登入頁會顯示一次性的**首次啟動設定表單**：輸入 Email 與密碼（至少 12 字元）即建立唯一的管理者帳號並自動登入。帳號建立後這個表單就永久消失——全程不需要 terminal。

> 請盡快完成這步：在帳號建立之前，任何發現你剛部署網址的人都有可能搶先註冊。

CLI 備援（例如不想用網頁表單時）：

```bash
# 互動式：輸入 Email 與密碼，產出 admin-insert.sql
#（密碼雜湊含 `$`，務必用 --file 套用，不要貼進 --command）
npm run create-admin
npx wrangler d1 execute DB --remote --file=admin-insert.sql && rm admin-insert.sql
```

**變更密碼**：點後台頁首的 Email → 帳號設定。本系統不提供忘記密碼重設——請妥善保管密碼（若遺失，需要重新部署、從頭設置）。

### 4. 驗證

```bash
npm run check-meta    # 唯讀健康檢查：token 有效性、帳號、貼文
```

接著開啟 `https://<你的網域>/admin` 登入，同步貼文、建立自動化，再用另一個帳號在貼文下留言關鍵字測試。

## 本機開發

```bash
cp .dev.vars.example .dev.vars    # 填入本機開發機密（已被 gitignore）
npx wrangler d1 migrations apply ig-comment-dm-db --local
npm run dev                        # wrangler dev
npm run test                       # vitest（單元＋整合測試）
npm run lint && npm run typecheck
```

注意：`wrangler dev` 不會強制所有正式 Workers 限制（例如 PBKDF2 單次 100k 迭代上限）。認證相關流程請務必在部署後的 Worker 上實測。

## 文件

- [`docs/faq.md`](docs/faq.md) —— 常見問答：費用、合規、功能邊界、疑難排解。
- [`spec.md`](spec.md) —— 完整技術規格：資料模型、API、比對規則、重試與熔斷語意。
- [`CLAUDE.md`](CLAUDE.md) —— 給 AI coding agent 的初始化步驟與專案規則（Claude Code 會自動讀取）。

## 安全性說明

所有機密只存在 Cloudflare Secrets（正式環境）或 `.dev.vars`（本機，已被 gitignore）——永不寫入被 git 追蹤的檔案。`wrangler.jsonc` 只以預設值提交進版控；首次部署時 wrangler 會把自動建立的 `database_id` 寫回檔內。若你會貢獻程式碼回來，請先執行 `git update-index --skip-worktree wrangler.jsonc`，確保寫回的個人資源 ID 永不進 commit。

## License

[MIT](LICENSE)
