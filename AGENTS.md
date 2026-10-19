# IG 自動私訊系統（Sean 版，fork 自 pjwang2022/instagram-comment-dm-bot）

> 開始工作前先讀 `PROJECT_STATUS.md`；完成任何修改後，必須同步更新 `PROJECT_STATUS.md` 與 `CHANGELOG.md`，供 Claude Code 與 Codex 交接。重大取捨寫進 `docs/決策紀錄.md`。
>
> 本檔與 `AGENTS.md` 內容必須完全相同；修改其中一份時，另一份同步覆寫。

## 專案目的

復刻 ManyChat 的 Instagram 核心功能給 Sean（熊恩）自己使用，取代每月訂閱費。以 MIT 授權的開源專案 [pjwang2022/instagram-comment-dm-bot](https://github.com/pjwang2022/instagram-comment-dm-bot) 為基礎，補上原版沒有的功能。

Sean 的核心需求（2026-10-19 確認，以這三項為主）：

1. **Instagram 與 Facebook** 的貼文／影片留言自動私訊
2. 限時動態回覆自動私訊（Instagram；Facebook 粉專沒有限動回覆事件，做不到）
3. 私訊相關內容時自動回覆（Instagram 私訊、Facebook Messenger）

另外已做好、但收在「進階（選用）」的功能：追蹤後才給、先留 Email、標籤、名單與 CSV、每人一次、廣告／ig.me ref 觸發。以及 Instagram token 自動續期（原版 60 天後會失效）。範圍外的功能不要主動加。

## 協作分工

主要由 Claude Code 開發；Codex 作為備援，必要時可直接接手。接手時先讀 `PROJECT_STATUS.md`，再執行 `npm ci && npm ci --prefix admin && npm test` 確認基準狀態全過。同一時間只有一方動同一個檔案：開工前在 `PROJECT_STATUS.md` 的「進行中」標註，收工時移除。

## 架構（Sean 2.0.0 起：Supabase＋GitHub Pages）

Sean 要的是網頁工具，不在自己電腦安裝任何東西。上游原本跑在 Cloudflare Workers，Sean 2.0.0 改為：

| 部分 | 放在哪裡 | 說明 |
|------|----------|------|
| 後端 API | Supabase Edge Function `api`（Deno） | 專案 `ig-fb-auto-dm`（ID `gynpbquftdsoevxiwivp`，東京），網址 `https://gynpbquftdsoevxiwivp.supabase.co/functions/v1/api/...`。JWT 檢查關閉（自行驗證 Meta 簽章與後台權杖） |
| 資料庫 | Supabase Postgres | drizzle `pg-core`；migration 在 `drizzle/pg/`；所有表開 RLS 且不建 policy（anon／authenticated 讀不到） |
| 佇列 | `event_jobs` 表 | 取代 Cloudflare Queues：webhook 入列後在背景立刻跑一次（`EdgeRuntime.waitUntil`），pg_cron 每分鐘呼叫 `/api/internal/tick` 補跑與重試（最多重試 3 次） |
| 排程 | pg_cron＋pg_net | `supabase/setup/01_密鑰與排程.sql`：tick 每分鐘、同步台北 04:00 與 08:00、清理 03:00 |
| 系統密鑰 | Supabase Vault | `ADMIN_SESSION_SECRET`、`CRON_SECRET`、`WEBHOOK_VERIFY_TOKEN` 在資料庫內隨機產生，Edge Function 啟動時讀取；Edge Function secrets 有同名值時以 secrets 為準 |
| Meta 權杖 | Edge Function secrets | `INSTAGRAM_APP_SECRET`、`INSTAGRAM_ACCOUNT_ACCESS_TOKEN`、`META_APP_SECRET`、`FACEBOOK_PAGE_ACCESS_TOKEN`，由 Sean 在 Supabase 後台輸入，不經過 AI 對話 |
| 後台前端 | GitHub Pages | repo `SeanChen0427/CHAT`，網址 `https://seanchen0427.github.io/CHAT/`；`.github/workflows/pages.yml` 建置後推到 `gh-pages` 分支，Pages 設定為 Deploy from a branch（gh-pages）|
| 隱私權政策 | GitHub Pages `privacy.html` | Supabase Edge Function 不能對外提供 HTML 頁面，因此由 `scripts/build-privacy.ts` 產生靜態頁 |

跨網域後台的處理：後台（github.io）與 API（supabase.co）不同網域，瀏覽器不帶第三方 Cookie，因此登入／初始設定回傳 `token`，前端存在 localStorage，每次請求帶 `Authorization: Bearer`（`requireAdminAuth` 先讀 Bearer，沒有才讀 Cookie）。`ADMIN_ORIGINS`（預設 `https://seanchen0427.github.io`）同時用於 CORS 與 CSRF 允許來源。

部署方式：`npm run build:function` 把 `src/` 打包成 `supabase/functions/api/index.ts`（第三方套件改寫成 `npm:套件@版本`，不打包），此檔要提交。目前的部署方式：Supabase MCP 的 deploy_edge_function 只上傳 `supabase/loader/index.ts`（從 raw.githubusercontent.com 載入指定 commit 的打包檔），更新時改 commit 後重新部署；另可用 `.github/workflows/deploy-function.yml`（需 repo secret `SUPABASE_ACCESS_TOKEN`）。GitHub repo 必須維持公開。資料庫結構改動：改 `src/database/schema.ts` → `npm run db:generate` → 把新 migration 套用到 Supabase。

## Sean 版改動地圖

| 檔案 | 改動 |
|------|------|
| `src/database/schema.ts`、（1.x 的 D1 migration 0003） | 新增 `contacts`、`contact_automations` 表；`automations` 加門檻／標籤／每人一次欄位；`instagram_accounts` 加 `access_token`、`token_refreshed_at` |
| `src/automation/funnel.ts` | 新檔。領取流程（追蹤檢查、Email、交付）、聯絡人與標籤、私訊類事件處理 `processMessagingEvent` |
| `src/automation/attempts.ts` | 新檔。從 `engine.ts` 抽出的嘗試紀錄與熔斷評估（funnel 共用） |
| `src/automation/engine.ts` | 留言／限動路徑加入每人一次、聯絡人、門檻時改送領取按鈕 |
| `src/webhook/event-parser.ts`、`receive-webhook.ts` | 新增解析 postback、referral、一般私訊，入列為 `eventType: 'messaging'` |
| `src/queue/producer.ts` | 事件訊息加 `messaging`、`platform`；佇列介面 `EventQueue`（2.0.0 起由 `jobs.ts` 實作） |
| `src/meta/private-replies.ts` | 支援 postback 按鈕 |
| `src/meta/profile.ts`、`src/meta/token.ts` | 新檔。追蹤查詢；token 自動續期 |
| `src/meta/media.ts` | 每日同步前先檢查續期 |
| `src/admin/contacts.ts`、`routes.ts` | 新增名單 API（列表、標籤、CSV、刪除） |
| `src/admin/automations.ts`、`src/shared/validation.ts` | 新欄位、新觸發類型 `dm_keyword`／`ref`、啟用檢核 |
| `src/app.ts` | 隱私權政策改寫為實際蒐集的資料（名單、Email、標籤） |
| `admin/src/pages/ContactsPage.tsx` | 新頁面：名單 |
| `admin/src/pages/AutomationEditorPage.tsx`、`components/AppHeader.tsx`、`HomePage.tsx`、`api/client.ts`、`main.tsx` | 編輯器新增「領取門檻與名單」區、新觸發類型；頁首加名單連結與新選項；保留 422 啟用原因 |
| `src/meta/platform.ts` | 新檔。IG／FB 兩個 client 的建立與選擇、依平台找帳號 |
| `src/meta/facebook.ts` | 新檔。粉專註冊（GET /me）、webhook 訂閱（subscribed_apps）、貼文同步（/posts） |
| `src/meta/comments.ts` | FB 公開回覆走 `/{comment}/comments` |
| `src/automation/apply-scope.ts` | 待命／全帳號預設規則依平台過濾 |
| `admin/src/pages/HomePage.tsx` | 貼文 IG／FB 標示與篩選、粉專名稱 |
| `tests/integration/funnel.test.ts`、`contacts.test.ts`、`facebook.test.ts`、`tests/unit/token.test.ts` | 新測試 |
| `src/database/types.ts`、`client.ts` | 統一的 `SchemaDb`（Postgres drizzle）型別；`env.DB` 直接是 drizzle 實例 |
| `drizzle/pg/0000_init.sql`、`0001_rls.sql` | Postgres 初始結構（含 `event_jobs`）與 RLS |
| `src/queue/jobs.ts` | 新檔。`event_jobs` 入列、認領、執行、重試、清理（取代 Cloudflare Queue consumer） |
| `src/internal/routes.ts` | 新檔。`/api/internal/tick`、`/sync`、`/cleanup`，需 `Authorization: Bearer <CRON_SECRET>` |
| `src/supabase-entry.ts` | 新檔。Edge Function 進入點：建立 postgres 連線、讀 Vault 密鑰、組 env |
| `src/security/client-ip.ts`、`memory-rate-limiter.ts`、`timing.ts` | 新檔。取 IP（X-Forwarded-For）、記憶體版後台 API 限流、定長字串比較 |
| `src/security/csrf.ts`、`src/admin/auth.ts`、`src/app.ts` | 允許 `ADMIN_ORIGINS`；登入回傳權杖、接受 Bearer；CORS；健康檢查查資料庫；根路徑導向 GitHub Pages |
| `src/privacy.ts`、`scripts/build-privacy.ts` | 隱私權頁內容共用，產生 GitHub Pages 靜態頁 |
| `src/admin/system.ts`、`admin/src/pages/AccountPage.tsx` | 「Meta 串接資訊」：回呼網址、驗證權杖、隱私權網址、各權杖是否已設定 |
| `admin/src/api/client.ts`、`main.tsx`、`vite.config.ts` | `VITE_API_BASE`、權杖存取、CSV 改用 fetch 下載、base `/CHAT/` |
| `scripts/build-function.mjs`、`supabase/config.toml`、`supabase/setup/` | 打包 Edge Function、函式設定、Vault 與排程 SQL |
| `tests/helpers/pg.ts` | 測試用 PGlite（記憶體 Postgres），載入 `drizzle/pg` |

### 流程與慣例

- 平台判斷：webhook `payload.object === 'page'` 為 Facebook，其餘為 Instagram；事件、帳號、貼文、規則、聯絡人都帶 `platform`。
- Facebook 用 `graph.facebook.com`＋`FACEBOOK_PAGE_ACCESS_TOKEN`；Instagram 用 `graph.instagram.com`＋資料庫／secret token。選 client 一律走 `clientFor(deps, platform)`。
- 表名沿用上游的 `instagram_accounts`／`instagram_media`，FB 粉專與貼文也存在這兩張表（以 `platform` 區分），以利合併上游。
- 驗簽接受 `INSTAGRAM_APP_SECRET` 或 `META_APP_SECRET`（粉專 webhook 用後者）。
- Facebook 沒有追蹤查詢與限動回覆，相關邏輯在 FB 一律略過／放行。
- 按鈕 payload 固定為 `CLAIM:<automationId>`，改格式要同步改 `funnel.ts` 的 `CLAIM_PREFIX`。
- 聯絡人狀態 `contacts.state = awaiting_email:<automationId>`。
- 門檻文字欄位留空存 NULL，由 `funnel.ts` 的 `DEFAULTS` 補預設文字；前端以 placeholder 顯示同樣的預設。
- 私訊類規則（`dm_keyword`、`ref`）不綁貼文，關鍵字存在 `automation_keywords`；`ref` 一律完全比對，`dm_keyword` 不允許 `all_comments`。
- 關鍵字一律存正規化後的值（`normalizeCommentText`，含繁簡互通），測試 seed 也要用同一個函式。
- 每日觸發上限只在「觸發」時計一次；領取流程中的後續訊息仍經過送出 gate（緊急停止、系統每分鐘／每日上限）。

## Sean 版開發規範

- **介面一律繁體中文**（Sean 要求）：使用者看得到的文字不用英文術語（例：私訊而非 DM／Private Reply、存取權杖而非 Token、事件通知而非 webhook）。平台名稱（Instagram、Facebook、Reels）、Email、CSV、鍵盤按鍵名可保留
- 繁體中文註解；**新增的文字禁止 Emoji**（原版既有的預設公開回覆範本保留原樣）
- 新增程式碼標註「Sean 版」，方便日後與上游比對、合併
- 改任何程式後必須 `npm run lint`、`npm run typecheck`、`npm test` 全過；改了 `src/` 要再 `npm run build:function` 並提交產生的打包檔（CI 會檢查兩者一致）
- 測試用 PGlite，每個測試檔共用一個實例，`freshTestDb()` 清空所有表；直接下 SQL 用 `rawRun`／`rawGet`／`rawAll`
- 不要把真實 token、App Secret、粉絲資料寫入專案檔案或測試 fixture
- 上游更新：`git fetch upstream && git merge upstream/main`，衝突集中在上表檔案。上游是 Cloudflare／D1 版本，合併後要把 SQLite 寫法（`sqliteTable`、`db.run`、`wrangler`）改成本版的 Postgres 寫法

---

# 以下為上游原作者的開發說明（保留原文）

> 注意：以下是上游 Cloudflare 版的說明。Sean 2.0.0 起已改為 Supabase（見上方「架構」），wrangler、D1、`.dev.vars`、`npm run deploy` 等步驟不再適用，僅保留作為理解原設計的參考。

本專案為 Instagram Comment DM Bot：留言命中關鍵字即自動公開回覆並發送私訊，
跑在 Cloudflare Workers（Hono + D1/Drizzle + Queues + Cron），管理後台為 React SPA
（`admin/`，由 ASSETS binding 供應）。完整技術規格見 `spec.md`，安裝與部署見 `README.md`。

## Clone 後初始化（新環境必做）

1. 安裝依賴：`npm ci` 與 `npm ci --prefix admin`。
2. 不需手動建立或命名任何 Cloudflare 資源：`npm run deploy`（`scripts/deploy.mjs`）會自動建立缺少的 Queue 與 D1——wrangler 自動開通會在首次部署時建立資料庫並把 `database_id` 寫回 `wrangler.jsonc`。若會對本 repo 提交程式碼，先執行 `git update-index --skip-worktree wrangler.jsonc`，避免寫回的個人資源 ID 被提交。
3. `cp .dev.vars.example .dev.vars`，填入本機開發用機密（同樣不進版控）。
4. 正式環境機密逐一 `wrangler secret put <NAME>`：`INSTAGRAM_APP_SECRET`、`WEBHOOK_VERIFY_TOKEN`、`INSTAGRAM_ACCOUNT_ACCESS_TOKEN`、`ADMIN_SESSION_SECRET`。設定後約 30 秒才生效，勿立即以舊回應誤判。
5. 套用資料庫 migrations：`wrangler d1 migrations apply ig-comment-dm-db --local`（本機）；正式環境改用 `npm run deploy`（一次完成 admin 建置、`--remote` migrations 與部署）。
6. 建立管理者帳號：部署後開 `/admin`——資料庫沒有任何管理者時，登入頁顯示一次性的首次啟動設定表單（`POST /api/admin/auth/setup`，僅在 `admin_users` 為空時允許）。CLI 備援：`npm run create-admin`（產出 `admin-insert.sql`）→ `npx wrangler d1 execute DB --local --file=admin-insert.sql`（正式改 `--remote`）→ 套用後刪檔。務必用 `--file`、不要貼進 `--command`（密碼雜湊含 `$`，會被 shell 展開打爛）。
7. 驗證環境：`npm run check-meta`（Meta token 健康檢查）→ `npm run test` → `npm run dev`。

## 機密與設定規則

- 機密一律走 `.dev.vars`（本機）或 `wrangler secret put`（正式），永不寫入任何被 git 追蹤的檔案、不傳到前端、不寫進 log。
- `wrangler.jsonc` 在版控中只允許 placeholder 值——本機真實部署值以 `git update-index --skip-worktree wrangler.jsonc` 保護（意味著 git 不會回報此檔的變更；要提交結構性修改前，先 `git update-index --no-skip-worktree wrangler.jsonc`，確認 diff 只含 placeholder 後再提交，完成後重新設回 skip-worktree）。

## 開發注意事項

- Workers 正式 runtime 的限制在 `wrangler dev` 測不出來（例：PBKDF2 單次迭代上限 100,000、禁止執行期 WASM 編譯、全域 fetch 需綁定 this）。認證與加密相關變更務必部署後實測。
- 提供驗證證據：指令、輸出結果、UI 螢幕截圖，以及已知殘留風險。
- 審查重點：功能性錯誤、安全與隱私風險、auth／權限／密鑰／網路邊界、資料驗證與錯誤處理、缺失的測試。
