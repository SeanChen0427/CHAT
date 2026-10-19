// Queue Consumer 核心處理鏈（spec.md 第 7.2、12.2 節）。
// 查 automation → 排除檢查 → 正規化 → 比對 → 冪等 run → 公開回覆 → Private Reply → 寫結果。
//
// 冪等關鍵：同一 (automation, comment) 只有一個 run；queue 重試時只重試「尚未成功」的動作
// （靠 run 上的 public_reply_status / private_reply_status），確保每個 Comment ID 最多各發一次。
import { and, eq } from 'drizzle-orm';
import type { SchemaDb } from '../database/types';
import * as schema from '../database/schema';
import {
  automationKeywords,
  instagramAccounts,
  instagramMedia,
  systemSettings,
  webhookEvents,
} from '../database/schema';
import type { MetaClient } from '../meta/client';
import { PERMANENT_REASONS, isRetryable } from '../meta/errors';
import { replyToComment } from '../meta/comments';
import { sendPrivateReply } from '../meta/private-replies';
import type { CommentEventMessage } from '../queue/producer';
import { nextRetryDelaySeconds } from '../queue/retry-policy';
import { resolveAutomationForMedia } from './apply-scope';
import { matchKeywords, type MatchType } from './matcher';
import { normalizeCommentText } from './normalizer';
import { ensureAutomationRun } from './idempotency';
import { selectPublicReply } from './public-reply';
import { recordAttempt } from './attempts';
import {
  firstMessage,
  hasTriggered,
  isGated,
  markDelivered,
  recordTrigger,
  upsertContact,
} from './funnel';
import { acquireSendPermission } from './send-gate';
import { findCommentEvent, findStoryReplyEvent } from '../webhook/event-parser';
import { accountByPlatform, clientFor } from '../meta/platform';


export type EngineOutcome =
  | { kind: 'skipped'; reason: string }
  | { kind: 'no_match' }
  | { kind: 'completed'; runId: string; publicReplyStatus: string; privateReplyStatus: string }
  | { kind: 'retry'; delaySeconds: number | null; runId: string; reason: string };

// 向 Meta 補抓單篇貼文資訊並寫入 instagram_media（本地尚未同步到的新貼文）。
async function discoverMedia(
  db: SchemaDb,
  metaClient: MetaClient,
  instagramMediaId: string,
  platform: 'instagram' | 'facebook' = 'instagram',
): Promise<typeof instagramMedia.$inferSelect | null> {
  const account = await accountByPlatform(db, platform);
  if (!account) return null;

  // Sean 版：Facebook 粉專貼文用不同欄位（message／full_picture／permalink_url／created_time）。
  if (platform === 'facebook') {
    const fb = await metaClient.get<{
      id?: string;
      message?: string;
      full_picture?: string;
      permalink_url?: string;
      created_time?: string;
      status_type?: string;
    }>(instagramMediaId, { fields: 'id,message,full_picture,permalink_url,created_time,status_type' });
    if (!fb.ok || !fb.data?.id) return null;
    await db
      .insert(instagramMedia)
      .values({
        id: crypto.randomUUID(),
        instagramAccountId: account.id,
        instagramMediaId: fb.data.id,
        platform: 'facebook',
        mediaType: fbMediaType(fb.data.status_type),
        caption: fb.data.message ?? null,
        thumbnailUrl: fb.data.full_picture ?? null,
        permalink: fb.data.permalink_url ?? null,
        publishedAt: fb.data.created_time ?? null,
        lastSyncedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
    const rows = await db.select().from(instagramMedia).where(eq(instagramMedia.instagramMediaId, fb.data.id)).limit(1);
    return rows[0] ?? null;
  }

  const res = await metaClient.get<{
    id?: string;
    media_type?: string;
    caption?: string;
    thumbnail_url?: string;
    media_url?: string;
    permalink?: string;
    timestamp?: string;
  }>(instagramMediaId, {
    fields: 'id,media_type,caption,thumbnail_url,media_url,permalink,timestamp',
  });
  if (!res.ok || !res.data?.id) return null;

  await db
    .insert(instagramMedia)
    .values({
      id: crypto.randomUUID(),
      instagramAccountId: account.id,
      instagramMediaId: res.data.id,
      mediaType: res.data.media_type ?? 'UNKNOWN',
      caption: res.data.caption ?? null,
      thumbnailUrl: res.data.thumbnail_url ?? res.data.media_url ?? null,
      permalink: res.data.permalink ?? null,
      publishedAt: res.data.timestamp ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  const rows = await db
    .select()
    .from(instagramMedia)
    .where(eq(instagramMedia.instagramMediaId, res.data.id))
    .limit(1);
  return rows[0] ?? null;
}

// 向 Meta 補抓單則限動並寫入 instagram_media（media_type 強制 STORY，理由見 meta/media.ts）。
async function discoverStory(
  db: SchemaDb,
  metaClient: MetaClient,
  storyId: string,
): Promise<typeof instagramMedia.$inferSelect | null> {
  const account = await accountByPlatform(db, 'instagram');
  if (!account) return null;
  const res = await metaClient.get<{
    id?: string;
    media_url?: string;
    thumbnail_url?: string;
    timestamp?: string;
  }>(storyId, { fields: 'id,media_type,media_url,thumbnail_url,timestamp' });
  if (!res.ok || !res.data?.id) return null;
  await db
    .insert(instagramMedia)
    .values({
      id: crypto.randomUUID(),
      instagramAccountId: account.id,
      instagramMediaId: res.data.id,
      mediaType: 'STORY',
      thumbnailUrl: res.data.thumbnail_url ?? res.data.media_url ?? null,
      publishedAt: res.data.timestamp ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  const rows = await db
    .select()
    .from(instagramMedia)
    .where(eq(instagramMedia.instagramMediaId, res.data.id))
    .limit(1);
  return rows[0] ?? null;
}

export interface EngineDeps {
  db: SchemaDb;
  metaClient: MetaClient;
  // Sean 版新增：Facebook 粉專 client（未設定粉專權杖時為 null/undefined，FB 事件會略過）。
  facebookClient?: MetaClient | null;
}

export async function processCommentEvent(
  deps: EngineDeps,
  message: CommentEventMessage,
): Promise<EngineOutcome> {
  const { db } = deps;

  // 1. Webhook event + 留言內容
  const eventRows = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, message.webhookEventId))
    .limit(1);
  if (eventRows.length === 0) return { kind: 'skipped', reason: 'webhook_event_not_found' };
  let payload: unknown;
  try {
    payload = JSON.parse(eventRows[0].rawPayload);
  } catch {
    return { kind: 'skipped', reason: 'payload_parse_error' };
  }
  const comment = findCommentEvent(payload, message.instagramCommentId);
  if (!comment || !comment.instagramCommentId || !comment.instagramMediaId) {
    return { kind: 'skipped', reason: 'comment_not_in_payload' };
  }
  // Sean 版：依平台選 client（Facebook 粉專權杖未設定時略過 FB 事件）。
  const client = clientFor(deps, comment.platform);
  if (!client) return { kind: 'skipped', reason: 'facebook_not_configured' };

  // 2. 緊急停止
  const settings = await db.select().from(systemSettings).limit(1);
  if (settings.length > 0 && settings[0].emergencyStop === 1) {
    return { kind: 'skipped', reason: 'emergency_stop' };
  }

  // 3. Media——本地沒有時向 Meta 補抓（排程貼文上線後的首則留言可能早於每日同步；
  //    這也是待命自動化「零時差綁定」的入口）。抓不到才視為 media_not_found。
  let mediaRows = await db
    .select()
    .from(instagramMedia)
    .where(eq(instagramMedia.instagramMediaId, message.instagramMediaId))
    .limit(1);
  if (mediaRows.length === 0) {
    const discovered = await discoverMedia(db, client, message.instagramMediaId, comment.platform);
    if (!discovered) return { kind: 'skipped', reason: 'media_not_found' };
    mediaRows = [discovered];
  }
  const media = mediaRows[0];

  // 4. 帳號（停用 / 熔斷）
  const accountRows = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, media.instagramAccountId))
    .limit(1);
  if (accountRows.length === 0) return { kind: 'skipped', reason: 'account_not_found' };
  const account = accountRows[0];
  if (account.automationEnabled === 0) return { kind: 'skipped', reason: 'account_disabled' };
  if (account.circuitBreakerStatus !== 'closed') return { kind: 'skipped', reason: 'circuit_open' };

  // 5. Active automation：專屬 → 待命（next_post）綁定 → 全帳號預設（account_default）。
  const automation = await resolveAutomationForMedia(db, media);
  if (!automation) return { kind: 'skipped', reason: 'no_active_automation' };

  // 6. 排除：自己的留言
  if (
    automation.excludeOwnComments === 1 &&
    comment.commenterId &&
    comment.commenterId === comment.instagramAccountId
  ) {
    return { kind: 'skipped', reason: 'own_comment' };
  }

  // 7. 正規化 + 比對
  const normalized = normalizeCommentText(comment.text);
  const kwRows = await db
    .select()
    .from(automationKeywords)
    .where(eq(automationKeywords.automationId, automation.id));
  const normalizedKeywords = kwRows.map((k) => k.normalizedKeyword);
  const match = matchKeywords(normalized, normalizedKeywords, automation.matchType as MatchType);
  if (!match.matched) return { kind: 'no_match' };

  // 7.5 Sean 版：每人一次＋聯絡人名單。只在「第一次處理這則留言」時判斷每人一次，
  //     佇列重試（run 已存在）不能被自己第一次寫下的觸發紀錄擋掉。
  if (comment.commenterId) {
    const priorRun = await db
      .select({ id: schema.automationRuns.id })
      .from(schema.automationRuns)
      .where(
        and(
          eq(schema.automationRuns.automationId, automation.id),
          eq(schema.automationRuns.instagramCommentId, comment.instagramCommentId),
        ),
      )
      .limit(1);
    if (
      priorRun.length === 0 &&
      automation.oncePerContact === 1 &&
      (await hasTriggered(db, comment.commenterId, automation.id))
    ) {
      return { kind: 'skipped', reason: 'once_per_contact' };
    }
    await upsertContact(db, comment.commenterId, {
      username: comment.platform === 'facebook' ? null : comment.commenterUsername,
      // Facebook 留言 webhook 只給顯示名稱，沒有帳號名稱。
      name: comment.platform === 'facebook' ? comment.commenterUsername : null,
      platform: comment.platform,
    });
    await recordTrigger(db, comment.commenterId, automation);
  }

  // 8. 冪等 run（queue 重試時 created=false，但仍要接續尚未完成的動作）
  const { run } = await ensureAutomationRun(db, {
    automationId: automation.id,
    webhookEventId: message.webhookEventId,
    instagramCommentId: comment.instagramCommentId,
    instagramMediaId: media.instagramMediaId,
    commenterId: comment.commenterId,
    commenterUsername: comment.commenterUsername,
    originalCommentText: comment.text,
    normalizedCommentText: normalized,
    matchedKeyword: match.matchedKeyword,
    status: 'matched',
  });

  let publicStatus = run.publicReplyStatus ?? 'pending';
  let privateStatus = run.privateReplyStatus ?? 'pending';
  let retryable = false;
  const attemptNumber = run.retryCount + 1;

  // 9. 公開回覆（每 Comment ID 最多一次；已成功/略過就不再送）
  if (publicStatus === 'pending') {
    if (automation.publicReplyEnabled === 0) {
      publicStatus = 'skipped';
    } else {
      const variants = await db
        .select()
        .from(schema.publicReplyVariants)
        .where(eq(schema.publicReplyVariants.automationId, automation.id));
      const chosen = selectPublicReply(
        variants.map((v) => ({ id: v.id, message: v.message, enabled: v.enabled === 1 })),
      );
      if (!chosen) {
        publicStatus = 'skipped';
      } else if (
        !(
          await acquireSendPermission(db, {
            actionType: 'public_reply',
            automationId: automation.id,
            automationDailyLimit: automation.dailyLimit,
          })
        ).allowed
      ) {
        // 送出 gate 拒絕（緊急停止/限額）→ 略過，不重試（限額語意：超過就是不送）。
        publicStatus = 'skipped';
      } else {
        const res = await replyToComment(client, comment.instagramCommentId, chosen.message, comment.platform);
        await recordAttempt(db, run.id, account.id, 'public_reply', attemptNumber, res);
        if (res.ok) {
          publicStatus = 'success';
          await db
            .update(schema.automationRuns)
            .set({ publicReplyMessage: chosen.message })
            .where(eq(schema.automationRuns.id, run.id));
        } else if (res.failure && isRetryable(res.failure)) {
          retryable = true; // 保持 pending 供下次重試
        } else {
          publicStatus = 'failed';
        }
      }
    }
  }

  // 10. Private Reply（每 Comment ID 最多一次）
  if (privateStatus === 'pending') {
    if (automation.privateReplyEnabled === 0 || !automation.openingDm) {
      privateStatus = 'skipped';
    } else if (
      !(
        await acquireSendPermission(db, {
          actionType: 'private_reply',
          automationId: automation.id,
          automationDailyLimit: automation.dailyLimit,
        })
      ).allowed
    ) {
      privateStatus = 'skipped';
    } else {
      // Sean 版：有門檻時第一則私訊帶「領取」按鈕，否則與原版相同。
      const res = await sendPrivateReply(client, {
        instagramAccountId: comment.instagramAccountId,
        commentId: comment.instagramCommentId,
        ...firstMessage(automation),
        platform: comment.platform,
      });
      await recordAttempt(db, run.id, account.id, 'private_reply', attemptNumber, res);
      if (res.ok) {
        privateStatus = 'success';
        if (!isGated(automation) && comment.commenterId) {
          await markDelivered(db, comment.commenterId, automation.id);
        }
      } else if (res.failure && isRetryable(res.failure)) {
        retryable = true;
      } else if (
        res.failure &&
        res.failure.httpStatus === 400 &&
        !PERMANENT_REASONS.has(res.failure.nonRetryableReason ?? '')
      ) {
        // 實測發現：對「非常新的留言」立即發 private reply，Meta 偶爾回暫時性 400
        // （同一請求數十秒後重打即成功）。因此 DM 的 400（非 token/權限/政策）
        // 走重試路徑（30s/2m/10m 最多三次），而不是立刻放棄。
        retryable = true;
      } else {
        privateStatus = 'failed';
      }
    }
  }

  // 11. 收尾：更新 run 狀態
  const pendingAfter = publicStatus === 'pending' || privateStatus === 'pending';
  if (retryable && pendingAfter) {
    const delay = nextRetryDelaySeconds(run.retryCount);
    await db
      .update(schema.automationRuns)
      .set({
        retryCount: run.retryCount + 1,
        publicReplyStatus: publicStatus,
        privateReplyStatus: privateStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.automationRuns.id, run.id));
    return { kind: 'retry', delaySeconds: delay, runId: run.id, reason: 'retryable_meta_error' };
  }

  // 沒有可重試的 pending：把仍 pending 的視為 failed（重試已用盡或非重試路徑）。
  const finalPublic = publicStatus === 'pending' ? 'failed' : publicStatus;
  const finalPrivate = privateStatus === 'pending' ? 'failed' : privateStatus;
  const overall =
    finalPublic === 'failed' || finalPrivate === 'failed' ? 'completed_with_errors' : 'completed';
  await db
    .update(schema.automationRuns)
    .set({
      status: overall,
      publicReplyStatus: finalPublic,
      privateReplyStatus: finalPrivate,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.automationRuns.id, run.id));

  return {
    kind: 'completed',
    runId: run.id,
    publicReplyStatus: finalPublic,
    privateReplyStatus: finalPrivate,
  };
}

// 限時動態回應處理鏈：與留言路徑共用冪等 run／send-gate／attempt 紀錄，差異在：
// - 只套用綁定該限動的專屬自動化（不走 next_post / account_default——那是留言語意）。
// - 沒有公開回覆（限動無留言串），public_reply_status 一律 skipped。
// - DM 的 recipient 用回應者 IGSID（回應已開啟 24 小時訊息窗）。
export async function processStoryReplyEvent(
  deps: EngineDeps,
  message: CommentEventMessage,
): Promise<EngineOutcome> {
  const { db, metaClient } = deps;

  // 1. Webhook event + 回應內容
  const eventRows = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, message.webhookEventId))
    .limit(1);
  if (eventRows.length === 0) return { kind: 'skipped', reason: 'webhook_event_not_found' };
  let payload: unknown;
  try {
    payload = JSON.parse(eventRows[0].rawPayload);
  } catch {
    return { kind: 'skipped', reason: 'payload_parse_error' };
  }
  const reply = findStoryReplyEvent(payload, message.instagramCommentId);
  if (!reply || !reply.messageId || !reply.storyId) {
    return { kind: 'skipped', reason: 'story_reply_not_in_payload' };
  }

  // 2. 緊急停止
  const settings = await db.select().from(systemSettings).limit(1);
  if (settings.length > 0 && settings[0].emergencyStop === 1) {
    return { kind: 'skipped', reason: 'emergency_stop' };
  }

  // 3. Story media——本地沒有時向 Meta 補抓（回應可能早於同步）。已過期不處理。
  let mediaRows = await db
    .select()
    .from(instagramMedia)
    .where(eq(instagramMedia.instagramMediaId, reply.storyId))
    .limit(1);
  if (mediaRows.length === 0) {
    const discovered = await discoverStory(db, metaClient, reply.storyId);
    if (!discovered) return { kind: 'skipped', reason: 'story_not_found' };
    mediaRows = [discovered];
  }
  const media = mediaRows[0];
  if (media.deletedAt) return { kind: 'skipped', reason: 'story_expired' };

  // 4. 帳號（停用 / 熔斷）
  const accountRows = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, media.instagramAccountId))
    .limit(1);
  if (accountRows.length === 0) return { kind: 'skipped', reason: 'account_not_found' };
  const account = accountRows[0];
  if (account.automationEnabled === 0) return { kind: 'skipped', reason: 'account_disabled' };
  if (account.circuitBreakerStatus !== 'closed') return { kind: 'skipped', reason: 'circuit_open' };

  // 5. 專屬 active 自動化（限動不 fallback）
  const autoRows = await db
    .select()
    .from(schema.automations)
    .where(
      and(eq(schema.automations.instagramMediaId, media.id), eq(schema.automations.status, 'active')),
    )
    .limit(1);
  const automation = autoRows[0];
  if (!automation) return { kind: 'skipped', reason: 'no_active_automation' };

  // 6. 排除：自己（帳號本人）發出的回應
  if (reply.senderId && reply.senderId === account.instagramAccountId) {
    return { kind: 'skipped', reason: 'own_message' };
  }

  // 7. 正規化 + 比對
  const normalized = normalizeCommentText(reply.text);
  const kwRows = await db
    .select()
    .from(automationKeywords)
    .where(eq(automationKeywords.automationId, automation.id));
  const match = matchKeywords(
    normalized,
    kwRows.map((k) => k.normalizedKeyword),
    automation.matchType as MatchType,
  );
  if (!match.matched) return { kind: 'no_match' };

  // 7.5 Sean 版：每人一次＋聯絡人名單（同留言路徑）。
  if (reply.senderId) {
    const priorRun = await db
      .select({ id: schema.automationRuns.id })
      .from(schema.automationRuns)
      .where(
        and(
          eq(schema.automationRuns.automationId, automation.id),
          eq(schema.automationRuns.instagramCommentId, reply.messageId),
        ),
      )
      .limit(1);
    if (
      priorRun.length === 0 &&
      automation.oncePerContact === 1 &&
      (await hasTriggered(db, reply.senderId, automation.id))
    ) {
      return { kind: 'skipped', reason: 'once_per_contact' };
    }
    await upsertContact(db, reply.senderId);
    await recordTrigger(db, reply.senderId, automation);
  }

  // 8. 冪等 run（mid 存在 instagram_comment_id 欄，unique (automation, mid) 保證各發一次）
  const { run } = await ensureAutomationRun(db, {
    automationId: automation.id,
    webhookEventId: message.webhookEventId,
    instagramCommentId: reply.messageId,
    instagramMediaId: media.instagramMediaId,
    commenterId: reply.senderId || null,
    commenterUsername: null,
    originalCommentText: reply.text,
    normalizedCommentText: normalized,
    matchedKeyword: match.matchedKeyword,
    status: 'matched',
  });

  let privateStatus = run.privateReplyStatus ?? 'pending';
  let retryable = false;
  const attemptNumber = run.retryCount + 1;

  // 9. DM（限動唯一的動作）
  if (privateStatus === 'pending') {
    if (automation.privateReplyEnabled === 0 || !automation.openingDm || !reply.senderId) {
      privateStatus = 'skipped';
    } else if (
      !(
        await acquireSendPermission(db, {
          actionType: 'private_reply',
          automationId: automation.id,
          automationDailyLimit: automation.dailyLimit,
        })
      ).allowed
    ) {
      privateStatus = 'skipped';
    } else {
      const res = await sendPrivateReply(metaClient, {
        instagramAccountId: reply.instagramAccountId,
        recipientId: reply.senderId,
        ...firstMessage(automation),
      });
      await recordAttempt(db, run.id, account.id, 'private_reply', attemptNumber, res);
      if (res.ok) {
        privateStatus = 'success';
        if (!isGated(automation)) await markDelivered(db, reply.senderId, automation.id);
      } else if (res.failure && isRetryable(res.failure)) {
        retryable = true;
      } else if (
        res.failure &&
        res.failure.httpStatus === 400 &&
        !PERMANENT_REASONS.has(res.failure.nonRetryableReason ?? '')
      ) {
        // 與留言 DM 相同：非永久性的 400 走重試路徑（Meta 對極新事件偶發暫時性 400）。
        retryable = true;
      } else {
        privateStatus = 'failed';
      }
    }
  }

  // 10. 收尾
  if (retryable && privateStatus === 'pending') {
    const delay = nextRetryDelaySeconds(run.retryCount);
    await db
      .update(schema.automationRuns)
      .set({
        retryCount: run.retryCount + 1,
        publicReplyStatus: 'skipped',
        privateReplyStatus: privateStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.automationRuns.id, run.id));
    return { kind: 'retry', delaySeconds: delay, runId: run.id, reason: 'retryable_meta_error' };
  }

  const finalPrivate = privateStatus === 'pending' ? 'failed' : privateStatus;
  const overall = finalPrivate === 'failed' ? 'completed_with_errors' : 'completed';
  await db
    .update(schema.automationRuns)
    .set({
      status: overall,
      publicReplyStatus: 'skipped',
      privateReplyStatus: finalPrivate,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.automationRuns.id, run.id));

  return { kind: 'completed', runId: run.id, publicReplyStatus: 'skipped', privateReplyStatus: finalPrivate };
}

// Sean 版：Facebook 貼文類型（status_type 'added_video' 為影片；其他視為一般貼文）。
export function fbMediaType(statusType: string | null | undefined): string {
  return statusType === 'added_video' ? 'FB_VIDEO' : 'FB_POST';
}
