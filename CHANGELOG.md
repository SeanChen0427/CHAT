# CHANGELOG

> Sean 版的變更紀錄。上游原作者的變更請看上游 repo 的 commit 紀錄。

## [Sean 2.1.0] — 2026-10-20

讓第一次使用的人（含學員）不用問人也能完成設定。

### 新增
- **設定精靈**（右上角頭像 > 設定精靈）：7 個步驟，每步說明做什麼、為什麼，附打開 Meta 對應頁面的按鈕、要貼的網址的複製按鈕、「找不到？」提示，完成自動打勾；第一次登入且尚未連結帳號時自動帶入
- **一鍵連結 Instagram／Facebook 粉專**：按按鈕登入、允許即完成；權杖、帳號、事件通知訂閱自動處理；多個粉專時讓你選
- 事件通知（回呼網址、訂閱欄位）由系統自動設定；失敗時精靈改顯示手動設定步驟與「再自動設定一次」
- Meta App 資料（App ID、App Secret）直接在精靈填寫，不必到 Supabase 設定 secrets
- **學員自行安裝**：Fork 後設定兩個 Secrets、按一次「安裝與更新」即完成；之後按 Sync fork 自動更新（`docs/學員安裝手冊.md`）
- 首頁在尚未連結帳號時顯示提醒與精靈連結

### 修改
- 連不到後端時顯示中文說明（原本顯示英文 Failed to fetch）
- 帳號設定頁的「Meta 串接資訊」移到設定精靈
- 後台網頁、保持運作、安裝流程不再寫死 Sean 的專案，依各自的 Supabase 專案設定

### 資料庫
- Migration `0002_app_config`：新增 `app_config`（精靈設定與連結取得的粉專權杖），開 RLS

## [Sean 2.0.0] — 2026-10-19

改為網頁工具：後端搬到 Supabase，後台放 GitHub Pages，不需要在電腦安裝任何東西。

### 修改
- 後端從 Cloudflare Workers 搬到 Supabase Edge Function（Deno）；資料庫從 Cloudflare D1（SQLite）改為 Supabase Postgres
- 佇列改為資料表 `event_jobs`：收到留言／私訊後立即在背景處理，每分鐘排程補跑與重試（最多重試 3 次）
- 每日同步、權杖檢查、資料清理改由資料庫排程（pg_cron）觸發，時間不變
- 後台改放 GitHub Pages（`https://seanchen0427.github.io/CHAT/`）；登入改用權杖（跨網域不能用 Cookie）
- 隱私權政策改由 GitHub Pages 提供（`/CHAT/privacy.html`）
- 名單匯出 CSV 改為按鈕下載
- 登入簽章、排程密鑰、事件通知驗證碼改為系統自動產生（存在 Supabase Vault），不需要手動設定

### 新增
- 帳號設定頁「Meta 串接資訊」：一鍵複製回呼網址、驗證權杖、隱私權網址，並顯示各項 Meta 權杖是否已設定
- GitHub Actions：檢查、發佈後台網頁、部署後端（選用）、每日健康檢查

### 移除
- `本機試用.command`、`開啟外部網址.command`、`docs/本機試用.md`（Cloudflare 本機版專用，Supabase 版不需要）
- `wrangler.jsonc`、`.dev.vars.example`、`scripts/deploy.mjs`、D1 migration

### 資料庫
- 新的 Postgres migration：`drizzle/pg/0000_init.sql`（含 `event_jobs`）、`0001_rls.sql`（所有表開 RLS）
- Supabase 專用：`supabase/setup/01_密鑰與排程.sql`

## [Sean 1.2.0] — 2026-10-19

### 新增
- `本機試用.command`：雙擊即可在 Mac 上安裝並啟動後台（自動建立本機設定檔與資料庫）
- `開啟外部網址.command`：開 Cloudflare 臨時通道，讓 Meta 的留言／私訊通知連到本機，用來在上線前實測
- `docs/本機試用.md`：本機試用步驟與常見問題

## [Sean 1.1.0] — 2026-10-19

### 新增
- Facebook 粉專：貼文／影片留言自動私訊（Messenger）與公開回覆
- Facebook Messenger 私訊關鍵字自動回覆
- 粉專自動註冊、webhook 自動訂閱、粉專貼文同步
- 規則可指定適用平台；全帳號預設可分平台各設一組
- 首頁貼文顯示 IG／FB 標示，可依平台篩選；頁首顯示粉專名稱與訂閱狀態
- 名單與 CSV 顯示平台

### 修改
- 追蹤、Email、標籤、每人一次收進編輯器「進階（選用）」，預設收合
- 後台名稱改為「IG／FB 自動私訊」
- 介面全面繁體中文化：Private Reply、Opening DM、DM、Token、webhook、比對模式代碼、Click-to-DM 等英文術語改為中文；首頁同步錯誤的原因代碼改顯示中文；登入頁、瀏覽器分頁標題、隱私權政策標題改為中文

### 資料庫
- Migration `0004_sean_facebook`：accounts／media／automations／contacts 新增 `platform`

### 已知限制
- Facebook 粉專限時動態沒有回覆事件，無法做限動自動私訊
- Facebook 沒有「是否追蹤」的 API，追蹤門檻在 FB 自動放行

## [Sean 1.0.0] — 2026-10-19

以 [pjwang2022/instagram-comment-dm-bot](https://github.com/pjwang2022/instagram-comment-dm-bot) commit `4a05ab7` 為基礎。

### 新增
- 追蹤後才給：第一則私訊帶「領取」按鈕，按下後檢查是否追蹤；沒追蹤送「我追蹤了」按鈕可重複檢查；查詢失敗一律放行
- 先留 Email 才給：請對方回覆 Email，辨識成功才交付；已留過不再問；格式不對提示一次
- 通過門檻後的交付訊息可另外設定，附連結按鈕
- 聯絡人名單頁：搜尋、依標籤篩選、只看有 Email、匯出 CSV、刪除
- 自動貼標籤、每人只觸發一次
- 新觸發類型：私訊關鍵字、Click-to-DM 廣告／ig.me 連結 ref
- Token 自動續期：每日檢查，剩不到 20 天自動續期，新 token 存在 D1
- 首頁「未綁定貼文的自動化」顯示私訊關鍵字與廣告／連結規則

### 修改
- 隱私權政策改寫為實際蒐集的資料與刪除方式
- 啟用失敗時逐條顯示原因（修正上游原因清單沒有傳到前端的問題）
- 窄螢幕頁首按鈕不換行

### 資料庫
- Migration `0003_sean_dm_funnel`：新增 `contacts`、`contact_automations`；`automations` 新增 9 個欄位；`instagram_accounts` 新增 `access_token`、`token_refreshed_at`
