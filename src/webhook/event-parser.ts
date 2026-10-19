// Webhook 事件唯一鍵產生（spec.md 第 13.1 節）。
// 若 payload 有穩定事件 ID，直接用；否則對下列欄位算 SHA-256：
// instagram_account_id, instagram_media_id, instagram_comment_id, event_type, event_timestamp。
const encoder = new TextEncoder();

export interface EventKeyInput {
  stableEventId?: string | null;
  instagramAccountId?: string | null;
  instagramMediaId?: string | null;
  instagramCommentId?: string | null;
  eventType?: string | null;
  eventTimestamp?: string | number | null;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// 從 Instagram Webhook payload 抽出留言事件。
// IG 留言 webhook 結構：{ object, entry: [{ id: <account>, time, changes: [{ field:'comments',
// value: { id:<comment>, text, from:{id,username}, media:{id} } }] }] }
export interface CommentEvent {
  instagramAccountId: string;
  instagramMediaId: string;
  instagramCommentId: string;
  commenterId: string | null;
  commenterUsername: string | null;
  text: string;
  eventType: string;
  eventTimestamp: string;
  // Sean 版新增：'instagram' | 'facebook'。
  platform: 'instagram' | 'facebook';
}

// Sean 版：payload.object 為 'page' 時是 Facebook 粉專事件，其餘視為 Instagram。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function payloadPlatform(payload: any): 'instagram' | 'facebook' {
  return payload?.object === 'page' ? 'facebook' : 'instagram';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractCommentEvents(payload: any): CommentEvent[] {
  const out: CommentEvent[] = [];
  const platform = payloadPlatform(payload);
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const accountId = entry?.id != null ? String(entry.id) : '';
    const time = entry?.time != null ? String(entry.time) : '';
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      // Sean 版：Facebook 粉專留言＝field 'feed'、item 'comment'、verb 'add'（編輯、刪除、按讚都忽略）。
      // value：{ item, verb, comment_id, post_id, parent_id?, from:{id,name}, message, created_time }
      if (platform === 'facebook') {
        const v = change?.value ?? {};
        if (change?.field !== 'feed' || v.item !== 'comment' || v.verb !== 'add') continue;
        out.push({
          instagramAccountId: accountId,
          instagramMediaId: v.post_id != null ? String(v.post_id) : '',
          instagramCommentId: v.comment_id != null ? String(v.comment_id) : '',
          commenterId: v?.from?.id != null ? String(v.from.id) : null,
          commenterUsername: typeof v?.from?.name === 'string' ? v.from.name : null,
          text: typeof v.message === 'string' ? v.message : '',
          eventType: 'comments',
          eventTimestamp: v.created_time != null ? String(v.created_time) : time,
          platform,
        });
        continue;
      }
      if (change?.field !== 'comments') continue;
      const v = change.value ?? {};
      out.push({
        instagramAccountId: accountId,
        instagramMediaId: v?.media?.id != null ? String(v.media.id) : '',
        instagramCommentId: v?.id != null ? String(v.id) : '',
        commenterId: v?.from?.id != null ? String(v.from.id) : null,
        commenterUsername: typeof v?.from?.username === 'string' ? v.from.username : null,
        text: typeof v?.text === 'string' ? v.text : '',
        eventType: 'comments',
        eventTimestamp: time,
        platform,
      });
    }
  }
  return out;
}

// 從 payload 中找出特定 comment id 的留言事件（Consumer 用）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findCommentEvent(payload: any, commentId: string): CommentEvent | null {
  return extractCommentEvents(payload).find((e) => e.instagramCommentId === commentId) ?? null;
}

// 從 Instagram messaging webhook 抽出「限時動態回應」事件。
// 結構：{ object, entry: [{ id:<account>, time, messaging: [{ sender:{id}, recipient:{id},
//   timestamp, message: { mid, text, is_echo?, reply_to?: { story: { id, url } } } }] }] }
// 只接受帶 reply_to.story 的訊息；一般 DM 與 echo（自己發出的訊息）一律忽略。
export interface StoryReplyEvent {
  instagramAccountId: string;
  storyId: string;
  messageId: string;
  senderId: string;
  text: string;
  eventType: string;
  eventTimestamp: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractStoryReplyEvents(payload: any): StoryReplyEvent[] {
  const out: StoryReplyEvent[] = [];
  // Sean 版：Facebook 粉專限動沒有回覆事件（Messenger 的 reply_to 只有 mid），只處理 Instagram。
  if (payloadPlatform(payload) === 'facebook') return out;
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const accountId = entry?.id != null ? String(entry.id) : '';
    const time = entry?.time != null ? String(entry.time) : '';
    const messagings = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const m of messagings) {
      const msg = m?.message;
      const storyId = msg?.reply_to?.story?.id;
      if (!storyId) continue;
      if (msg?.is_echo) continue;
      out.push({
        instagramAccountId: accountId,
        storyId: String(storyId),
        messageId: msg?.mid != null ? String(msg.mid) : '',
        senderId: m?.sender?.id != null ? String(m.sender.id) : '',
        text: typeof msg?.text === 'string' ? msg.text : '',
        eventType: 'story_reply',
        eventTimestamp: m?.timestamp != null ? String(m.timestamp) : time,
      });
    }
  }
  return out;
}

// 從 payload 中找出特定 mid 的限動回應（Consumer 用）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findStoryReplyEvent(payload: any, messageId: string): StoryReplyEvent | null {
  return extractStoryReplyEvents(payload).find((e) => e.messageId === messageId) ?? null;
}

// ---- Sean 版新增：一般私訊、按鈕（postback）、廣告／ig.me 連結（referral）----
// 結構同上（entry[].messaging[]）。排除：echo、自己送出的訊息、限動回應（由上方 story 路徑處理）。
// - postback：{ postback: { mid, title, payload } }
// - referral：{ referral: { ref, source, type, ads_context_data? } }，或第一則訊息內的 message.referral
// - text：{ message: { mid, text } }
export interface MessagingEvent {
  instagramAccountId: string;
  senderId: string;
  kind: 'postback' | 'referral' | 'text';
  // mid；純 referral 沒有 mid 時由接收端產生穩定鍵（見 messagingEventKey）。
  messageId: string;
  text: string;
  payload: string;
  ref: string;
  eventTimestamp: string;
  platform: 'instagram' | 'facebook';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function referralRef(r: any): string {
  if (!r) return '';
  const v = r.ref ?? r.ads_context_data?.ad_id ?? r.ad_id ?? '';
  return v != null ? String(v) : '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractMessagingEvents(payload: any): MessagingEvent[] {
  const out: MessagingEvent[] = [];
  const platform = payloadPlatform(payload);
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const accountId = entry?.id != null ? String(entry.id) : '';
    const time = entry?.time != null ? String(entry.time) : '';
    const messagings = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const m of messagings) {
      const senderId = m?.sender?.id != null ? String(m.sender.id) : '';
      if (!senderId || senderId === accountId) continue;
      const ts = m?.timestamp != null ? String(m.timestamp) : time;
      const base = { instagramAccountId: accountId, senderId, eventTimestamp: ts, text: '', payload: '', ref: '', platform };

      if (m?.postback) {
        out.push({
          ...base,
          kind: 'postback',
          messageId: m.postback.mid != null ? String(m.postback.mid) : '',
          payload: typeof m.postback.payload === 'string' ? m.postback.payload : '',
        });
        continue;
      }

      const msg = m?.message;
      if (msg?.is_echo) continue;
      if (msg?.reply_to?.story?.id) continue; // 限動回應另有路徑

      const ref = referralRef(m?.referral) || referralRef(msg?.referral);
      if (ref) {
        out.push({
          ...base,
          kind: 'referral',
          messageId: msg?.mid != null ? String(msg.mid) : '',
          text: typeof msg?.text === 'string' ? msg.text : '',
          ref,
        });
        continue;
      }

      if (msg && typeof msg.text === 'string' && msg.text.trim()) {
        out.push({
          ...base,
          kind: 'text',
          messageId: msg.mid != null ? String(msg.mid) : '',
          text: msg.text,
        });
      }
    }
  }
  return out;
}

// 私訊事件的穩定鍵：有 mid 用 mid；純 referral（ig.me 開啟對話、沒有訊息）用 sender+時間+ref。
export function messagingEventKey(ev: MessagingEvent): string {
  return ev.messageId || `ref:${ev.senderId}:${ev.eventTimestamp}:${ev.ref}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findMessagingEvent(payload: any, key: string): MessagingEvent | null {
  return extractMessagingEvents(payload).find((e) => messagingEventKey(e) === key) ?? null;
}

export async function deriveEventKey(input: EventKeyInput): Promise<string> {
  if (input.stableEventId) {
    return input.stableEventId;
  }
  // 用固定分隔符與固定欄位順序串接，缺值以空字串占位，確保同一事件恆得同鍵。
  const parts = [
    input.instagramAccountId ?? '',
    input.instagramMediaId ?? '',
    input.instagramCommentId ?? '',
    input.eventType ?? '',
    input.eventTimestamp != null ? String(input.eventTimestamp) : '',
  ];
  return sha256Hex(parts.join(' '));
}
