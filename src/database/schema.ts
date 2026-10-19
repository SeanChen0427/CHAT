// D1 資料表定義（Drizzle schema），對應 spec.md 第 14 節（11 張表）與第 15 節（索引）。
// login_rate_limits 是 spec.md 未列出的第 12 張表：架構審查判定 TASK-008 的登入頻率限制
// （每 IP 15 分鐘 10 次）無法用 Cloudflare 原生 Rate Limiting binding 表示（binding 週期只
// 支援 10/60 秒），因此新增這張小型計數表作為混合方案的一部分（已與使用者確認）。
//
// created_at/updated_at（以及同性質的 received_at/last_received_at/api_attempts.started_at）
// 一律在 schema 層級用 $defaultFn 給預設值，insert 時可省略。
// Sean 版（Supabase）：由 SQLite（D1）改為 Postgres。欄位型別維持 text／integer，時間仍存 ISO 字串，
// 讓上層查詢邏輯與上游一致。
import { pgTable, text, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';

const nowIso = () => new Date().toISOString();

export const adminUsers = pgTable('admin_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});

export const systemSettings = pgTable('system_settings', {
  id: text('id').primaryKey(),
  emergencyStop: integer('emergency_stop').notNull().default(0),
  maxPublicRepliesPerMinute: integer('max_public_replies_per_minute'),
  maxPrivateRepliesPerMinute: integer('max_private_replies_per_minute'),
  maxPublicRepliesPerDay: integer('max_public_replies_per_day'),
  maxPrivateRepliesPerDay: integer('max_private_replies_per_day'),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});

// 表名沿用上游（instagram_accounts）。Sean 版起也存 Facebook 粉專：platform = 'facebook'，
// instagram_account_id 存粉專 ID。
export const PLATFORMS = ['instagram', 'facebook'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const instagramAccounts = pgTable('instagram_accounts', {
  id: text('id').primaryKey(),
  instagramAccountId: text('instagram_account_id').notNull().unique(),
  // Sean 版新增：'instagram' | 'facebook'。
  platform: text('platform').notNull().default('instagram'),
  username: text('username'),
  profilePictureUrl: text('profile_picture_url'),
  accountType: text('account_type'),
  tokenExpiresAt: text('token_expires_at'),
  // 自動續期後的長效 token（Sean 版新增）。非 NULL 時優先於 INSTAGRAM_ACCOUNT_ACCESS_TOKEN secret：
  // Worker 無法改寫自己的 secret，續期後的新 token 只能存在 D1。
  accessToken: text('access_token'),
  tokenRefreshedAt: text('token_refreshed_at'),
  webhookSubscribed: integer('webhook_subscribed').notNull().default(0),
  automationEnabled: integer('automation_enabled').notNull().default(1),
  circuitBreakerStatus: text('circuit_breaker_status').notNull().default('closed'),
  lastWebhookReceivedAt: text('last_webhook_received_at'),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});

export const instagramMedia = pgTable(
  'instagram_media',
  {
    id: text('id').primaryKey(),
    instagramAccountId: text('instagram_account_id')
      .notNull()
      .references(() => instagramAccounts.id),
    instagramMediaId: text('instagram_media_id').notNull().unique(),
    // Sean 版新增：'instagram' | 'facebook'（FB 貼文 media_type 為 FB_POST／FB_VIDEO）。
    platform: text('platform').notNull().default('instagram'),
    mediaType: text('media_type').notNull(),
    caption: text('caption'),
    thumbnailUrl: text('thumbnail_url'),
    permalink: text('permalink'),
    publishedAt: text('published_at'),
    lastSyncedAt: text('last_synced_at'),
    // 非 NULL＝IG 上已確認刪除（同步時逐篇向 Meta 查證後標記）；後台列表預設隱藏。
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (table) => [index('idx_media_account').on(table.instagramAccountId)],
);

export const automations = pgTable('automations', {
  id: text('id').primaryKey(),
  // 可為 NULL：apply_scope 為 next_post（待命，等下一篇新貼文自動綁定）或
  // account_default（全帳號預設，不綁定特定貼文）時尚未/不會綁定媒體。
  instagramMediaId: text('instagram_media_id')
    .unique()
    .references(() => instagramMedia.id),
  // media＝綁定單篇貼文（預設）；next_post＝綁定下一篇新貼文；account_default＝所有無專屬自動化的貼文。
  // Sean 版新增：dm_keyword＝私訊關鍵字觸發；ref＝Click-to-DM 廣告／ig.me 連結的 ref 參數觸發
  // （兩者都不綁貼文，關鍵字存在 automation_keywords）。
  applyScope: text('apply_scope').notNull().default('media'),
  // Sean 版新增：不綁貼文的規則（next_post／account_default／dm_keyword／ref）適用的平台；
  // NULL＝兩個平台都適用。綁貼文的規則以貼文的平台為準。
  platform: text('platform'),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  matchType: text('match_type').notNull().default('contains_any'),
  publicReplyEnabled: integer('public_reply_enabled').notNull().default(1),
  privateReplyEnabled: integer('private_reply_enabled').notNull().default(1),
  openingDm: text('opening_dm'),
  buttonText: text('button_text'),
  buttonUrl: text('button_url'),
  dailyLimit: integer('daily_limit'),
  excludeOwnComments: integer('exclude_own_comments').notNull().default(1),
  // ---- Sean 版新增：領取門檻與名單 ----
  // 任一門檻開啟時，第一則私訊改帶「領取」postback 按鈕（claimButtonText），
  // 對方按下後才檢查追蹤／索取 Email，全部通過才送 deliveryText + 連結按鈕。
  followGateEnabled: integer('follow_gate_enabled').notNull().default(0),
  notFollowingText: text('not_following_text'),
  recheckButtonText: text('recheck_button_text'),
  emailCaptureEnabled: integer('email_capture_enabled').notNull().default(0),
  emailPromptText: text('email_prompt_text'),
  claimButtonText: text('claim_button_text'),
  // 通過門檻後送出的訊息；NULL 時沿用 openingDm。
  deliveryText: text('delivery_text'),
  // 觸發時自動貼到聯絡人身上的標籤。
  tag: text('tag'),
  // 1＝同一位聯絡人只觸發一次（跨貼文、跨觸發方式）。
  oncePerContact: integer('once_per_contact').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});

// ---- Sean 版新增：聯絡人名單 ----
// 以 Instagram-scoped ID（IGSID）為主鍵。留言者 ID 與私訊 sender ID 在 Instagram Login 版
// API 下同為 IGSID，因此留言與私訊會落在同一筆聯絡人。
export const contacts = pgTable(
  'contacts',
  {
    // Instagram 為 IGSID、Facebook 為 PSID（兩者 ID 空間不同，不會撞號）。
    igsid: text('igsid').primaryKey(),
    // Sean 版新增：'instagram' | 'facebook'。
    platform: text('platform').notNull().default('instagram'),
    username: text('username'),
    name: text('name'),
    email: text('email'),
    // JSON 字串陣列。
    tags: text('tags').notNull().default('[]'),
    // NULL＝未查過；1／0＝最後一次查詢結果。
    isFollower: integer('is_follower'),
    // 對話狀態，例如 awaiting_email:<automationId>。
    state: text('state'),
    firstSeenAt: text('first_seen_at').notNull().$defaultFn(nowIso),
    lastSeenAt: text('last_seen_at').notNull().$defaultFn(nowIso),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (table) => [index('idx_contacts_last_seen').on(table.lastSeenAt)],
);

// 聯絡人 × 自動化：誰觸發過哪條、何時交付（每人一次、交付統計用）。
export const contactAutomations = pgTable(
  'contact_automations',
  {
    id: text('id').primaryKey(),
    igsid: text('igsid').notNull(),
    automationId: text('automation_id').notNull(),
    firstTriggeredAt: text('first_triggered_at').notNull().$defaultFn(nowIso),
    deliveredAt: text('delivered_at'),
  },
  (table) => [
    uniqueIndex('contact_automations_igsid_automation_unique').on(table.igsid, table.automationId),
    index('idx_contact_automations_automation').on(table.automationId),
  ],
);

export const automationKeywords = pgTable(
  'automation_keywords',
  {
    id: text('id').primaryKey(),
    // FK→automations 刻意不宣告：D1 無法在有子表參照時重建父表（見 migration 0004）。
    // app 無刪除自動化路徑，完整性由應用層維護。
    automationId: text('automation_id').notNull(),
    keyword: text('keyword').notNull(),
    normalizedKeyword: text('normalized_keyword').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (table) => [
    uniqueIndex('automation_keywords_automation_id_normalized_keyword_unique').on(
      table.automationId,
      table.normalizedKeyword,
    ),
    index('idx_keywords_automation').on(table.automationId),
  ],
);

export const publicReplyVariants = pgTable('public_reply_variants', {
  id: text('id').primaryKey(),
  automationId: text('automation_id').notNull(),
  message: text('message').notNull(),
  enabled: integer('enabled').notNull().default(1),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    eventKey: text('event_key').notNull().unique(),
    eventType: text('event_type').notNull(),
    instagramAccountId: text('instagram_account_id'),
    instagramMediaId: text('instagram_media_id'),
    instagramCommentId: text('instagram_comment_id'),
    rawPayload: text('raw_payload').notNull(),
    signatureValid: integer('signature_valid').notNull(),
    status: text('status').notNull().default('received'),
    duplicateCount: integer('duplicate_count').notNull().default(0),
    receivedAt: text('received_at').notNull().$defaultFn(nowIso),
    lastReceivedAt: text('last_received_at').notNull().$defaultFn(nowIso),
    processedAt: text('processed_at'),
  },
  (table) => [
    index('idx_webhook_comment').on(table.instagramCommentId),
    index('idx_webhook_received').on(table.receivedAt),
  ],
);

export const automationRuns = pgTable(
  'automation_runs',
  {
    id: text('id').primaryKey(),
    automationId: text('automation_id').notNull(),
    webhookEventId: text('webhook_event_id').references(() => webhookEvents.id),
    instagramCommentId: text('instagram_comment_id').notNull(),
    instagramMediaId: text('instagram_media_id').notNull(),
    commenterId: text('commenter_id'),
    commenterUsername: text('commenter_username'),
    originalCommentText: text('original_comment_text'),
    normalizedCommentText: text('normalized_comment_text'),
    matchedKeyword: text('matched_keyword'),
    status: text('status').notNull(),
    publicReplyMessage: text('public_reply_message'),
    publicReplyStatus: text('public_reply_status'),
    privateReplyStatus: text('private_reply_status'),
    retryCount: integer('retry_count').notNull().default(0),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (table) => [
    uniqueIndex('automation_runs_automation_id_instagram_comment_id_unique').on(
      table.automationId,
      table.instagramCommentId,
    ),
    index('idx_runs_status').on(table.status),
    index('idx_runs_created').on(table.createdAt),
    index('idx_runs_media').on(table.instagramMediaId),
  ],
);

export const apiAttempts = pgTable(
  'api_attempts',
  {
    id: text('id').primaryKey(),
    automationRunId: text('automation_run_id').notNull(),
    actionType: text('action_type').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    httpStatus: integer('http_status'),
    // 熔斷評估用的失敗分類（token_invalid/permission_denied/policy_restricted/other；成功為 NULL）。
    failureReason: text('failure_reason'),
    metaErrorCode: text('meta_error_code'),
    metaErrorSubcode: text('meta_error_subcode'),
    metaErrorMessage: text('meta_error_message'),
    metaTraceId: text('meta_trace_id'),
    requestPayloadRedacted: text('request_payload_redacted'),
    responsePayloadRedacted: text('response_payload_redacted'),
    startedAt: text('started_at').notNull().$defaultFn(nowIso),
    completedAt: text('completed_at'),
  },
  (table) => [index('idx_attempts_run').on(table.automationRunId)],
);

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  adminUserId: text('admin_user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  metadata: text('metadata'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
});

// 非 spec.md 原始 11 表之一，見檔案頂端說明。
export const loginRateLimits = pgTable(
  'login_rate_limits',
  {
    id: text('id').primaryKey(),
    ipAddress: text('ip_address').notNull(),
    windowStart: text('window_start').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (table) => [
    index('idx_login_rate_limits_ip').on(table.ipAddress),
    // 同一 IP 同一窗口只允許一列，讓計數能用原子 upsert（防併發繞過十次上限）。
    uniqueIndex('login_rate_limits_ip_window_unique').on(table.ipAddress, table.windowStart),
  ],
);

// 外發限額計數（系統層每分鐘/每日上限）。以 (scope_key, window_start) 唯一列 + 原子 upsert
// 遞增做「先保留再發送」：計入但未發送的保留只會讓實際發送量更保守，不會超限。
export const sendCounters = pgTable(
  'send_counters',
  {
    id: text('id').primaryKey(),
    // 例：public_reply:minute、private_reply:day。
    scopeKey: text('scope_key').notNull(),
    windowStart: text('window_start').notNull(),
    count: integer('count').notNull().default(0),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (table) => [uniqueIndex('send_counters_scope_window_unique').on(table.scopeKey, table.windowStart)],
);

// ---- Sean 版（Supabase）：取代 Cloudflare Queues 的工作佇列 ----
// webhook 收到事件後寫一筆 pending 工作並立即在背景處理；失敗需重試時更新 next_run_at，
// 由 pg_cron 每分鐘呼叫 /api/internal/tick 撿起到期的工作。message 為 CommentEventMessage 的 JSON。
export const eventJobs = pgTable(
  'event_jobs',
  {
    id: text('id').primaryKey(),
    message: text('message').notNull(),
    // pending | done | failed
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextRunAt: text('next_run_at').notNull().$defaultFn(nowIso),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (table) => [index('idx_event_jobs_due').on(table.status, table.nextRunAt)],
);
