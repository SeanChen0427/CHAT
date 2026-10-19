# PROJECT STATUS

> Claude Code 與 Codex 共用交接紀錄。開始工作前先讀本檔；完成修改後同步更新本檔與 `CHANGELOG.md`。

## 目前狀態

- 版本：Sean 版 v2.2.0（以上游 `pjwang2022/instagram-comment-dm-bot` commit `4a05ab7` 為基礎）
- 最後更新：2026-10-19
- 最後執行者：Claude Code
- 專案形式：Supabase Edge Function（Hono＋Deno）＋ Supabase Postgres（drizzle）＋ pg_cron；React 後台（`admin/`）放 GitHub Pages。架構見 `AGENTS.md`「架構」
- Supabase 專案：`ig-fb-auto-dm`，ID `gynpbquftdsoevxiwivp`，東京，免費方案
- 測試：`npm test` 301 項全過（PGlite 記憶體 Postgres）；`npm run lint`、`npm run typecheck` 通過
- Git：已推到 `SeanChen0427/CHAT`（公開）的 `main`（單一初始 commit，因本機 clone 為淺層歷史）。本機分支 `chat-main` 對應 `main`；`supabase`／`sean-funnel` 為舊歷史

## 進行中

（開工前在此標註「執行者：正在修改的檔案」，收工時移除）

- 無

## 本次完成（v2.2.0，2026-10-20）

- Sean 要求介面改版、動畫要絲滑，參考 Mobbin 上 Hilos 的 guided tour（截圖）。新增 `motion@13.4.6`（MIT、免費）負責彈簧動畫。
- 改動檔案：`admin/src/styles/tokens.css`（色票、字體、圓角、陰影）、`app.css` 末段「Sean 版改版」、`components/AppHeader.tsx`（改為側欄）、`components/GuidedTour.tsx`、`components/Illustrations.tsx`（新）、`pages/HomePage.tsx`（問候＋統計卡）、`pages/SetupPage.tsx`（動畫）、`pages/LoginPage.tsx`、`index.html`（Google Fonts）。
- 已驗證：Playwright 截圖桌面 1440px 與手機 390px（登入、導覽第 1 頁與切換中、首頁、新增選單、設定精靈、手機抽屜），無頁面錯誤、無水平溢出；lint、typecheck 通過。
- 尚未改版細節：自動化編輯器、名單頁只套用新色票與按鈕，版面沿用舊版。

## 先前完成（v2.1.0，2026-10-20）

- Sean 要求：綁定要在自己的工具內完成、第一次使用就看得懂；學員各自一套（D114–D116）。
- 新增設定精靈（`/setup`）、一鍵連結 Instagram／Facebook（OAuth）、事件通知自動設定、學員 Fork 安裝流程與手冊。
- Supabase 已套用 `0002_app_config`，並建立 `_igfb_migrations`（標記 0000–0002 已套用，讓安裝腳本可在此專案重複執行）。
- 後端已部署第 2 版（loader 指向 commit d38fd85）；正式環境確認 `/api/admin/connect/status` 未登入回 401、OAuth 回呼無 state 回 400、排程 tick 持續 200。
- 已驗證：`tests/integration/connect.test.ts` 13 項（App 資料存取與格式檢查、狀態不洩漏密鑰、資料庫中的 App Secret 可驗證事件通知簽章、IG 授權網址、IG 回呼完整流程與錯誤／取消、偽造 state 拒絕、state 不能當登入權杖、FB 單一粉專、多粉專選擇且不洩漏粉專權杖、無粉專說明）；Playwright 在本機（Deno＋Postgres 16＋模擬 Pages）走過：首次登入自動進精靈、勾選自動前進、App ID 格式錯誤的中文提示、儲存後進度 3/6、按連結 Instagram 產生正確授權網址、從 Meta 帶錯誤回來顯示中文說明並清掉網址參數、手機 390px 無溢出、首頁未連結提醒。
- 未驗證：真實 Meta OAuth（需要 Sean 的 Meta App）、`/{app-id}/subscriptions` 是否接受 Instagram 物件、學員安裝流程在真實 Fork 與 Supabase Management API 上的執行。

## 先前完成（v2.0.0，2026-10-19）

- Sean 指定 GitHub repo `SeanChen0427/CHAT` 與 Supabase，且要網頁工具、不在電腦安裝。後端從 Cloudflare 搬到 Supabase（決策 D109–D113）。
- Supabase 已建立並套用：資料表結構（16 張表，含 `event_jobs`）、所有表 RLS、Vault 自動產生的三個系統密鑰（只查過長度，值未經手）。
- 已部署（2026-10-19 23:50）：Edge Function `api` 版本 1（`supabase/loader/index.ts`，載入 commit 061c29f 的打包檔），健康檢查 `{"status":"ok"}`、`setup-status` 回 `needsSetup: true`；pg_cron 排程已建立，第一次 tick 回 200（證實 Vault 的 CRON_SECRET 兩端一致）。
- 安全建議：16 張表「RLS 開啟但無 policy」為刻意設計（INFO）；`pg_net` 在 public schema（WARN）——改 schema 的指令被取消，影響小，未處理。
- 尚未完成：GitHub Pages 需 Sean 在 repo Settings > Pages 選 GitHub Actions（GitHub API 經代理不允許由 Claude 開啟）。
- 已驗證（實際執行）：
  - `npm test` 288 項全過；新增 `tests/unit/jobs.test.ts`（分派、依引擎指示延遲重試、重試上限、未預期錯誤不存錯誤內容、中斷工作回收、併發不重複處理、清理）與 `tests/integration/supabase.test.ts`（Bearer 登入、偽造權杖拒絕、CSRF 允許來源、CORS、內部端點密鑰、入列）。
  - 打包檔在 Deno 2.9.6＋本機 Postgres 16 實跑：健康檢查、Meta 驗證握手、Bearer 初始設定／登入、CORS 預檢、建立並啟用規則、簽章正確的 IG 留言 webhook 入列並在背景比對到規則、送出失敗（沙盒連不到 Meta）後排入 60 秒重試；錯誤簽章 401、內部端點無密鑰 401。
  - 後台以 `/CHAT/` 路徑放在本機靜態伺服器（模擬 GitHub Pages，含 404 回退）＋ Deno API（不同來源），Playwright：登入、首頁顯示貼文、名單 CSV 下載、重新整理後保持登入、登出後導回登入頁。
- 未驗證：Supabase 正式環境的 Edge Function、`EdgeRuntime.waitUntil`、pg_cron 呼叫；Vault 讀取（本機 Postgres 沒有 Vault，程式在讀取失敗時退回 secrets）。

## 先前完成（v1.2.0，2026-10-19）

- （2.0.0 已移除這些 Cloudflare 本機版檔案）Sean 要求先在本機試用再上線：新增 `本機試用.command`（自動安裝、建立 `.dev.vars` 與本機資料庫、建置後台、啟動並開瀏覽器）、`開啟外部網址.command`（Cloudflare 臨時通道，讓 Meta webhook 連到本機）、`docs/本機試用.md`。
- 已驗證：在乾淨 clone 上執行 `本機試用.command`，24 秒內完成安裝並啟動（健康檢查 200）。
- 已驗證（本機 workerd 實際執行，非單元測試）：Meta webhook GET 驗證回 challenge；IG 留言（Instagram secret）、FB 留言與 Messenger 私訊（Meta secret）皆通過驗簽、入列、被 Queue consumer 處理、比對到對應規則並建立聯絡人（平台正確），各自發出一次私訊嘗試；錯誤簽章回 401。私訊嘗試因沙盒無法連外而失敗並進入重試，符合預期。
- 尚未驗證：`.command` 在 macOS 上的雙擊執行（沙盒為 Linux，已用 bash 實跑與語法檢查）；`開啟外部網址.command` 的 cloudflared 通道（沙盒無法連外）。

## 先前完成（v1.1.0，2026-10-19）

- Sean 釐清核心需求：IG＋FB 留言自動私訊、限動自動私訊、私訊關鍵字自動回覆。
- 新增 Facebook 粉專支援：貼文／影片留言私訊與公開回覆、Messenger 私訊關鍵字、粉專自動註冊／webhook 訂閱／貼文同步。
- 規則可指定平台（兩個平台／只有 IG／只有 FB）；全帳號預設每個平台一組。
- 後台：貼文 IG／FB 標示與篩選、首頁顯示粉專、名單與 CSV 顯示平台。
- 進階功能（追蹤、Email、標籤、每人一次）收進編輯器的「進階（選用）」，預設收合。
- 確認做不到：Facebook 粉專限動回覆（Meta 沒有此 webhook 事件）、Facebook 追蹤查詢（沒有 API）。
- 介面全面繁體中文化（Sean 要求）；以 Playwright 掃描所有頁面可見文字（含 placeholder、選項、分頁標題、啟用錯誤訊息、隱私權頁），除鍵盤按鍵名「Enter」與平台名稱外無英文。

## 先前完成（v1.0.0）

- Fork 上游，確認上游 228 項測試全過作為基準。
- 新增功能：追蹤後才給、先留 Email 才給、聯絡人名單、標籤、CSV 匯出、每人只觸發一次、私訊關鍵字觸發、廣告／ig.me ref 觸發、token 自動續期、刪除聯絡人。
- 隱私權政策改寫為實際蒐集的資料（名單、Email、標籤、刪除方式）。
- 修正上游小問題：後台啟用失敗時 422 的原因清單沒有傳到前端顯示。
- 改動細節與檔案地圖見 `AGENTS.md`／`CLAUDE.md` 的「Sean 版改動地圖」。

## 已驗證（2026-10-19，Claude Code 實際執行）

v1.1.0 新增：
- `tests/integration/facebook.test.ts` 10 項：FB 留言解析（只處理新增留言）、Messenger 標記平台且不誤判為限動、Meta App Secret 驗簽與錯誤 secret 拒絕、FB 留言公開回覆走 `/comments` 且私訊走 graph.facebook.com、未設定粉專權杖時略過、未知 FB 貼文即時補抓並只套用 FB／全平台預設、Messenger 關鍵字帶 `messaging_type=RESPONSE` 且不誤用 IG 專屬規則、FB 跳過追蹤檢查、粉專註冊／訂閱一次／貼文同步（只有 FB 權杖）。
- 本機 `wrangler dev`＋migration 0004＋FB 範例資料，Playwright：首頁 IG／FB 貼文混排與篩選、粉專名稱、FB 貼文編輯器、建立「只有 Facebook」私訊關鍵字規則並啟用、FB 全帳號預設第二組被擋、名單顯示 FB、手機 390px 無溢出、無頁面錯誤。

v1.0.0：

- `npm test`：257 項全過。新增測試涵蓋：
  - 門檻留言流程全程：領取按鈕 → 未追蹤 → 我追蹤了 → 索取 Email → 非 Email 提示 → Email 存檔並交付
  - 已有 Email 直接交付、追蹤查詢失敗放行、暫停的規則不回應、暫時性錯誤交回佇列重試
  - 無門檻規則維持原版行為並記為交付、每人一次（含佇列重試不被誤擋）、限動回應帶領取按鈕
  - 私訊關鍵字、ref 完全比對、緊急停止擋下所有步驟、拒絕「任何私訊都回」
  - Webhook：一般私訊、postback、referral 入列；echo 與自己的訊息忽略；referral 重送去重
  - 名單 API：登入保護、排序與篩選、標籤統計、CSV（BOM、台北時間、防公式注入）、刪除與執行紀錄抹除、CSRF
  - 自動化 API：新欄位存取、空字串轉 NULL、新觸發類型建立與啟用檢核、PATCH
  - Token：未續期用 secret、到期日未知時續期、剩 30 天不續、20 小時內不重複續、剩 10 天續期、失敗保留舊 token 且 log 不含 token
- `npm run lint`、`npm run typecheck`（Worker、scripts、admin）通過。
- `npm run build`（admin 建置＋`wrangler deploy --dry-run`）成功。
- 本機 `wrangler dev`＋本機 D1（套用 0000–0003 migrations）＋範例資料，Playwright 實測：
  - 桌面 1280px：首頁、新增自動化選單、門檻規則編輯器、私訊關鍵字編輯器、ref 編輯器、名單頁
  - ref 規則關閉私訊後啟用 → 正確逐條顯示兩個無法啟用原因；修正後啟用成功
  - 從介面新建私訊關鍵字規則（含 Email 門檻、標籤）並啟用成功
  - 名單：依標籤篩選、CSV 下載（BOM、內容正確）、刪除聯絡人
  - 手機 390px：首頁、名單、編輯器無水平溢出；頁首按鈕不換行
  - 無 JavaScript 錯誤（唯一 console 錯誤為刻意觸發的 422）

## 尚未驗證（需要真實 Meta App 與 Instagram 帳號）

- Facebook 粉專 API 只在假 API 下測試：`feed` 留言事件實際欄位（特別是 Reels 留言的 `post_id`）、粉專 webhook 實際用哪個 secret 簽章、Messenger 按鈕範本呈現。
- Facebook 一般粉絲幾乎確定需要 `pages_messaging` Advanced Access（App Review）。

- 所有 Instagram API 呼叫只在假 API 下測試，尚未打過真實 API：
  - postback 按鈕在 Private Reply 第一則訊息中的實際呈現與點擊回傳
  - 按過按鈕的人能否查到 `is_user_follow_business`（依官方文件應可以）
  - `referral` 事件（ig.me 連結、Click-to-DM 廣告）的實際欄位結構
  - token 續期 API 的實際回應
- 上游宣稱「自用帳號切 Live 不需 App Review」；Meta 文件寫法不一致，需實測（見 `docs/上線檢查.md`）。
- Supabase 正式環境部署、背景處理、pg_cron 實際執行。

## 待處理

- [ ] Sean：在後台走一次設定精靈，連結 Instagram（與 Facebook 粉專）；回報卡住的地方，修正精靈說明。
- [ ] 找一位學員照 `docs/學員安裝手冊.md` 實際安裝一次，修正手冊。
- [ ] 依 `docs/上線檢查.md` 用測試帳號實測全流程，修正與實際 API 不符之處。
- [ ] 切 Live 後用非測試人員帳號驗證；不行再送 App Review。

## 每次交接必做

1. 更新本檔的版本、日期、最後執行者與完成事項。
2. 把使用者可感知的變更寫入 `CHANGELOG.md`。
3. 重大取捨寫入 `docs/決策紀錄.md`。
4. 記錄實際執行過的驗證，以及因缺少 Meta App、token 或環境限制而未驗證的項目。
5. 不要把真實 token、App Secret、粉絲資料寫入任何專案檔案。
