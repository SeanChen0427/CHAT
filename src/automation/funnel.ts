// Sean 版新增：領取流程（追蹤檢查、Email 收集、交付）＋聯絡人名單＋私訊類觸發。
//
// 一條自動化的完整流程：
//   觸發（留言／限動回應／私訊關鍵字／ref）
//     → 第一則私訊 firstMessage()
//         無門檻：openingDm + 連結按鈕（等同原版行為），直接算交付
//         有門檻：openingDm + 「領取」postback 按鈕（payload = CLAIM:<automationId>）
//     → 對方按下領取 → claim()
//         追蹤檢查：查 is_user_follow_business，沒追蹤 → 送提示＋「我追蹤了」按鈕（同一個 payload）
//         Email：聯絡人沒有 Email → state = awaiting_email:<id>，送索取訊息，等對方回覆
//         全部通過 → deliver()：deliveryText（或 openingDm）+ 連結按鈕
//
// 為什麼留言不能直接查追蹤：User Profile API 需要「使用者同意」（傳過私訊或按過按鈕），
// 只留言的人查詢會回錯誤，所以門檻流程一定先送按鈕。
import { and, desc, eq } from 'drizzle-orm';
import type { SchemaDb } from '../database/types';
import {
  automationKeywords,
  automationRuns,
  automations,
  contactAutomations,
  contacts,
  systemSettings,
  webhookEvents,
} from '../database/schema';
import type { MetaClient } from '../meta/client';
import { PERMANENT_REASONS, isRetryable } from '../meta/errors';
import { sendPrivateReply } from '../meta/private-replies';
import { getUserProfile } from '../meta/profile';
import { accountForWebhook, clientFor } from '../meta/platform';
import type { CommentEventMessage } from '../queue/producer';
import { nextRetryDelaySeconds } from '../queue/retry-policy';
import { findMessagingEvent, type MessagingEvent } from '../webhook/event-parser';
import { recordAttempt } from './attempts';
import { ensureAutomationRun } from './idempotency';
import { matchKeywords, type MatchType } from './matcher';
import { normalizeCommentText } from './normalizer';
import { acquireSendPermission } from './send-gate';

export type AutomationRow = typeof automations.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;

export const CLAIM_PREFIX = 'CLAIM:';
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export const DEFAULTS = {
  claimButtonText: '給我連結',
  notFollowingText: '先追蹤我，再按下面的按鈕就能拿到囉！',
  recheckButtonText: '我追蹤了',
  emailPromptText: '請直接回覆你的 Email，我把資料寄給你',
  notEmailHint: '這看起來不像 Email 喔，',
} as const;

export interface FunnelDeps {
  db: SchemaDb;
  metaClient: MetaClient; // Instagram
  facebookClient?: MetaClient | null; // Sean 版：Facebook 粉專
}

// 發送一則流程訊息所需的上下文。
interface SendCtx {
  accountRowId: string;
  instagramAccountId: string; // IG 帳號 ID 或粉專 ID（POST /{id}/messages）
  platform: string;
  runId: string | null;
  automation: AutomationRow;
}
type AccountRef = { id: string; instagramAccountId: string; platform: string };
const ctxFor = (account: AccountRef, runId: string | null, automation: AutomationRow): SendCtx => ({
  accountRowId: account.id,
  instagramAccountId: account.instagramAccountId,
  platform: account.platform,
  runId,
  automation,
});

export type FunnelOutcome =
  | { kind: 'skipped'; reason: string }
  | { kind: 'no_match' }
  | { kind: 'completed'; step: string }
  | { kind: 'retry'; delaySeconds: number | null; reason: string };

export function isGated(a: Pick<AutomationRow, 'followGateEnabled' | 'emailCaptureEnabled'>): boolean {
  return a.followGateEnabled === 1 || a.emailCaptureEnabled === 1;
}

const nowIso = () => new Date().toISOString();

function parseTags(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

// ---------- 聯絡人 ----------

export async function upsertContact(
  db: SchemaDb,
  igsid: string,
  info: { username?: string | null; name?: string | null; platform?: 'instagram' | 'facebook' } = {},
): Promise<ContactRow> {
  const now = nowIso();
  const existing = (await db.select().from(contacts).where(eq(contacts.igsid, igsid)).limit(1))[0];
  if (!existing) {
    await db
      .insert(contacts)
      .values({ igsid, platform: info.platform ?? 'instagram', username: info.username ?? null, name: info.name ?? null })
      .onConflictDoNothing();
  } else {
    await db
      .update(contacts)
      .set({
        username: info.username ?? existing.username,
        name: info.name ?? existing.name,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(contacts.igsid, igsid));
  }
  return (await db.select().from(contacts).where(eq(contacts.igsid, igsid)).limit(1))[0];
}

export async function addTag(db: SchemaDb, igsid: string, tag: string | null | undefined): Promise<void> {
  const t = tag?.trim();
  if (!t) return;
  const row = (await db.select().from(contacts).where(eq(contacts.igsid, igsid)).limit(1))[0];
  if (!row) return;
  const tags = parseTags(row.tags);
  if (tags.includes(t)) return;
  tags.push(t);
  await db.update(contacts).set({ tags: JSON.stringify(tags), updatedAt: nowIso() }).where(eq(contacts.igsid, igsid));
}

export async function hasTriggered(db: SchemaDb, igsid: string, automationId: string): Promise<boolean> {
  const row = await db
    .select({ id: contactAutomations.id })
    .from(contactAutomations)
    .where(and(eq(contactAutomations.igsid, igsid), eq(contactAutomations.automationId, automationId)))
    .limit(1);
  return row.length > 0;
}

// 記錄觸發並貼標籤（重複呼叫安全）。
export async function recordTrigger(db: SchemaDb, igsid: string, automation: AutomationRow): Promise<void> {
  await db
    .insert(contactAutomations)
    .values({ id: crypto.randomUUID(), igsid, automationId: automation.id })
    .onConflictDoNothing();
  await addTag(db, igsid, automation.tag);
}

export async function markDelivered(db: SchemaDb, igsid: string, automationId: string): Promise<void> {
  await db
    .update(contactAutomations)
    .set({ deliveredAt: nowIso() })
    .where(and(eq(contactAutomations.igsid, igsid), eq(contactAutomations.automationId, automationId)));
}

// ---------- 訊息組裝 ----------

export interface OutgoingMessage {
  text: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  postbackPayload?: string | null;
}

// 第一則私訊：有門檻帶「領取」按鈕，否則與原版相同（openingDm + 連結按鈕）。
export function firstMessage(a: AutomationRow): OutgoingMessage {
  if (isGated(a)) {
    return {
      text: a.openingDm ?? '',
      buttonText: a.claimButtonText || DEFAULTS.claimButtonText,
      postbackPayload: CLAIM_PREFIX + a.id,
    };
  }
  return { text: a.openingDm ?? '', buttonText: a.buttonText, buttonUrl: a.buttonUrl };
}

export function deliveryMessage(a: AutomationRow): OutgoingMessage {
  return { text: a.deliveryText || a.openingDm || '', buttonText: a.buttonText, buttonUrl: a.buttonUrl };
}

// ---------- 發送 ----------

type SendResult = { ok: true } | { ok: false; retry: boolean; reason: string };

// 對單一聯絡人送一則私訊（走送出 gate、寫嘗試紀錄）。
async function sendToContact(
  deps: FunnelDeps,
  ctx: SendCtx,
  igsid: string,
  msg: OutgoingMessage,
): Promise<SendResult> {
  const gate = await acquireSendPermission(deps.db, {
    actionType: 'private_reply',
    automationId: ctx.automation.id,
    automationDailyLimit: null, // 每日上限只算觸發次數（run），流程中的後續訊息不重複計
  });
  if (!gate.allowed) return { ok: false, retry: false, reason: gate.reason ?? 'send_gate' };

  const client = clientFor(deps, ctx.platform);
  if (!client) return { ok: false, retry: false, reason: 'facebook_not_configured' };
  const res = await sendPrivateReply(client, {
    instagramAccountId: ctx.instagramAccountId,
    recipientId: igsid,
    ...msg,
    platform: ctx.platform === 'facebook' ? 'facebook' : 'instagram',
  });
  if (ctx.runId) await recordAttempt(deps.db, ctx.runId, ctx.accountRowId, 'private_reply', 1, res);
  if (res.ok) return { ok: true };
  const retry = Boolean(
    res.failure &&
      (isRetryable(res.failure) ||
        (res.failure.httpStatus === 400 && !PERMANENT_REASONS.has(res.failure.nonRetryableReason ?? ''))),
  );
  return { ok: false, retry, reason: res.failure?.metaErrorMessage ?? `http_${res.status}` };
}

function toOutcome(r: SendResult, step: string, retryCount = 0): FunnelOutcome {
  if (r.ok) return { kind: 'completed', step };
  if (r.retry) return { kind: 'retry', delaySeconds: nextRetryDelaySeconds(retryCount), reason: r.reason };
  return { kind: 'skipped', reason: r.reason };
}

// 找這位聯絡人在這條自動化最近一次的 run（後續步驟的嘗試紀錄掛在它下面，方便後台追查）。
async function latestRunId(db: SchemaDb, automationId: string, igsid: string): Promise<string | null> {
  const row = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(and(eq(automationRuns.automationId, automationId), eq(automationRuns.commenterId, igsid)))
    .orderBy(desc(automationRuns.createdAt))
    .limit(1);
  return row[0]?.id ?? null;
}

// ---------- 領取 ----------

export async function claim(
  deps: FunnelDeps,
  account: AccountRef,
  igsid: string,
  automation: AutomationRow,
): Promise<FunnelOutcome> {
  const { db, metaClient } = deps;
  const ctx = ctxFor(account, await latestRunId(db, automation.id, igsid), automation);
  await recordTrigger(db, igsid, automation);

  // 1. 追蹤檢查（同時補聯絡人名稱）。查詢失敗時放行（fail-open），不卡住真心想要資料的人。
  const contact = (await db.select().from(contacts).where(eq(contacts.igsid, igsid)).limit(1))[0];
  // Sean 版：追蹤查詢只有 Instagram 有 API；Facebook 粉專沒有「是否追蹤」可查，一律放行。
  if (account.platform === 'instagram' && (automation.followGateEnabled === 1 || !contact?.username)) {
    const p = await getUserProfile(metaClient, igsid);
    if (p.ok && p.data) {
      const following = p.data.is_user_follow_business;
      await db
        .update(contacts)
        .set({
          username: p.data.username ?? contact?.username ?? null,
          name: p.data.name ?? contact?.name ?? null,
          isFollower: typeof following === 'boolean' ? (following ? 1 : 0) : (contact?.isFollower ?? null),
          updatedAt: nowIso(),
        })
        .where(eq(contacts.igsid, igsid));
      if (automation.followGateEnabled === 1 && following === false) {
        const r = await sendToContact(deps, ctx, igsid, {
          text: automation.notFollowingText || DEFAULTS.notFollowingText,
          buttonText: automation.recheckButtonText || DEFAULTS.recheckButtonText,
          postbackPayload: CLAIM_PREFIX + automation.id,
        });
        return toOutcome(r, 'not_following');
      }
    }
  }

  // 2. Email
  if (automation.emailCaptureEnabled === 1) {
    const fresh = (await db.select().from(contacts).where(eq(contacts.igsid, igsid)).limit(1))[0];
    if (!fresh?.email) {
      const r = await sendToContact(deps, ctx, igsid, {
        text: automation.emailPromptText || DEFAULTS.emailPromptText,
      });
      if (r.ok) {
        await db
          .update(contacts)
          .set({ state: `awaiting_email:${automation.id}`, updatedAt: nowIso() })
          .where(eq(contacts.igsid, igsid));
      }
      return toOutcome(r, 'awaiting_email');
    }
  }

  // 3. 交付
  return deliver(deps, ctx, igsid, automation);
}

async function deliver(
  deps: FunnelDeps,
  ctx: SendCtx,
  igsid: string,
  automation: AutomationRow,
): Promise<FunnelOutcome> {
  const r = await sendToContact(deps, ctx, igsid, deliveryMessage(automation));
  if (r.ok) await markDelivered(deps.db, igsid, automation.id);
  return toOutcome(r, 'delivered');
}

// ---------- 私訊類事件（按鈕／referral／一般私訊）----------

async function activeAutomationsByScope(db: SchemaDb, scope: 'dm_keyword' | 'ref'): Promise<AutomationRow[]> {
  return db
    .select()
    .from(automations)
    .where(and(eq(automations.applyScope, scope), eq(automations.status, 'active')));
}

async function findKeywordAutomation(
  db: SchemaDb,
  scope: 'dm_keyword' | 'ref',
  text: string,
  platform: string,
): Promise<{ automation: AutomationRow; matchedKeyword: string | null } | null> {
  const normalized = normalizeCommentText(text);
  const candidates = (await activeAutomationsByScope(db, scope))
    // Sean 版：NULL＝兩個平台都適用；平台專屬的規則優先。
    .filter((a) => a.platform == null || a.platform === platform)
    .sort((x, y) => Number(y.platform === platform) - Number(x.platform === platform));
  for (const a of candidates) {
    const kws = await db.select().from(automationKeywords).where(eq(automationKeywords.automationId, a.id));
    // ref 一律完全比對（廣告／連結參數不應該部分命中）。
    const matchType: MatchType = scope === 'ref' ? 'exact_any' : (a.matchType as MatchType);
    if (scope === 'dm_keyword' && matchType === 'all_comments') continue; // 防呆：不允許任何私訊都觸發
    const m = matchKeywords(
      normalized,
      kws.map((k) => k.normalizedKeyword),
      matchType,
    );
    if (m.matched) return { automation: a, matchedKeyword: m.matchedKeyword };
  }
  return null;
}

// 私訊類觸發（私訊關鍵字、ref）：對話窗已開啟，送第一則訊息；無門檻即交付。
async function startFromMessage(
  deps: FunnelDeps,
  account: AccountRef,
  ev: MessagingEvent,
  eventKey: string,
  webhookEventId: string,
  hit: { automation: AutomationRow; matchedKeyword: string | null },
): Promise<FunnelOutcome> {
  const { db } = deps;
  const { automation } = hit;
  const { run, created } = await ensureAutomationRun(db, {
    automationId: automation.id,
    webhookEventId,
    instagramCommentId: eventKey,
    instagramMediaId: '',
    commenterId: ev.senderId,
    commenterUsername: null,
    originalCommentText: ev.kind === 'referral' ? `ref=${ev.ref}` : ev.text,
    normalizedCommentText: null,
    matchedKeyword: hit.matchedKeyword,
    status: 'matched',
  });
  // 佇列重試時 run 已存在：若已完成就不再送。
  if (!created && run.privateReplyStatus === 'success') return { kind: 'skipped', reason: 'already_sent' };

  if (created && automation.oncePerContact === 1 && (await hasTriggered(db, ev.senderId, automation.id))) {
    await finishRun(db, run.id, 'skipped');
    return { kind: 'skipped', reason: 'once_per_contact' };
  }
  await recordTrigger(db, ev.senderId, automation);

  // 每日觸發上限只在「觸發」時檢查一次。
  const gate = await acquireSendPermission(db, {
    actionType: 'private_reply',
    automationId: automation.id,
    automationDailyLimit: automation.dailyLimit,
  });
  if (!gate.allowed) {
    await finishRun(db, run.id, 'skipped');
    return { kind: 'skipped', reason: gate.reason ?? 'send_gate' };
  }

  const ctx = ctxFor(account, run.id, automation);
  const r = await sendToContact(deps, ctx, ev.senderId, firstMessage(automation));
  if (r.ok) {
    if (!isGated(automation)) await markDelivered(db, ev.senderId, automation.id);
    await finishRun(db, run.id, 'success');
    return { kind: 'completed', step: isGated(automation) ? 'claim_button_sent' : 'delivered' };
  }
  if (r.retry) {
    await db
      .update(automationRuns)
      .set({ retryCount: run.retryCount + 1, updatedAt: nowIso() })
      .where(eq(automationRuns.id, run.id));
    return { kind: 'retry', delaySeconds: nextRetryDelaySeconds(run.retryCount), reason: r.reason };
  }
  await finishRun(db, run.id, 'failed');
  return { kind: 'skipped', reason: r.reason };
}

async function finishRun(db: SchemaDb, runId: string, privateStatus: 'success' | 'failed' | 'skipped') {
  await db
    .update(automationRuns)
    .set({
      status: privateStatus === 'failed' ? 'completed_with_errors' : 'completed',
      publicReplyStatus: 'skipped',
      privateReplyStatus: privateStatus,
      completedAt: nowIso(),
      updatedAt: nowIso(),
    })
    .where(eq(automationRuns.id, runId));
}

export async function processMessagingEvent(
  deps: FunnelDeps,
  message: CommentEventMessage,
): Promise<FunnelOutcome> {
  const { db } = deps;

  const eventRow = (
    await db.select().from(webhookEvents).where(eq(webhookEvents.id, message.webhookEventId)).limit(1)
  )[0];
  if (!eventRow) return { kind: 'skipped', reason: 'webhook_event_not_found' };
  let payload: unknown;
  try {
    payload = JSON.parse(eventRow.rawPayload);
  } catch {
    return { kind: 'skipped', reason: 'payload_parse_error' };
  }
  const ev = findMessagingEvent(payload, message.instagramCommentId);
  if (!ev) return { kind: 'skipped', reason: 'message_not_in_payload' };

  const settings = (await db.select().from(systemSettings).limit(1))[0];
  if (settings?.emergencyStop === 1) return { kind: 'skipped', reason: 'emergency_stop' };

  // 單帳號系統：以 webhook 的帳號 ID 對應，找不到時用唯一帳號。
  const account = await accountForWebhook(db, ev.instagramAccountId, ev.platform);
  if (!account) return { kind: 'skipped', reason: 'account_not_found' };
  if (account.automationEnabled === 0) return { kind: 'skipped', reason: 'account_disabled' };
  if (account.circuitBreakerStatus !== 'closed') return { kind: 'skipped', reason: 'circuit_open' };
  if (ev.senderId === account.instagramAccountId) return { kind: 'skipped', reason: 'own_message' };

  const contact = await upsertContact(db, ev.senderId, { platform: ev.platform });

  // 1. 按鈕
  if (ev.kind === 'postback') {
    if (!ev.payload.startsWith(CLAIM_PREFIX)) return { kind: 'no_match' };
    const id = ev.payload.slice(CLAIM_PREFIX.length);
    const automation = (await db.select().from(automations).where(eq(automations.id, id)).limit(1))[0];
    if (!automation || automation.status !== 'active') return { kind: 'skipped', reason: 'automation_inactive' };
    return claim(deps, account, ev.senderId, automation);
  }

  // 2. 廣告／ig.me 連結
  if (ev.kind === 'referral') {
    const hit = await findKeywordAutomation(db, 'ref', ev.ref, ev.platform);
    if (hit) return startFromMessage(deps, account, ev, message.instagramCommentId, eventRow.id, hit);
    if (!ev.text) return { kind: 'no_match' };
    // 沒有對應的 ref 規則但有附訊息 → 當一般私訊處理
  }

  // 3. 正在等 Email
  const awaiting = contact.state?.startsWith('awaiting_email:') ? contact.state.split(':')[1] : null;
  if (awaiting) {
    const found = ev.text.match(EMAIL_RE);
    if (found) {
      await db
        .update(contacts)
        .set({ email: found[0].toLowerCase(), state: null, updatedAt: nowIso() })
        .where(eq(contacts.igsid, ev.senderId));
      const automation = (await db.select().from(automations).where(eq(automations.id, awaiting)).limit(1))[0];
      if (!automation || automation.status !== 'active') return { kind: 'completed', step: 'email_saved' };
      const ctx = ctxFor(account, await latestRunId(db, automation.id, ev.senderId), automation);
      return deliver(deps, ctx, ev.senderId, automation);
    }
  }

  // 4. 私訊關鍵字
  const hit = await findKeywordAutomation(db, 'dm_keyword', ev.text, ev.platform);
  if (hit) return startFromMessage(deps, account, ev, message.instagramCommentId, eventRow.id, hit);

  // 5. 等 Email 但回了別的東西 → 提示一次格式
  if (awaiting) {
    const automation = (await db.select().from(automations).where(eq(automations.id, awaiting)).limit(1))[0];
    if (automation && automation.status === 'active') {
      const ctx = ctxFor(account, await latestRunId(db, automation.id, ev.senderId), automation);
      const r = await sendToContact(deps, ctx, ev.senderId, {
        text: DEFAULTS.notEmailHint + (automation.emailPromptText || DEFAULTS.emailPromptText),
      });
      return toOutcome(r, 'email_hint');
    }
  }
  return { kind: 'no_match' };
}
