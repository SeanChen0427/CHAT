// Sean 版新增功能的整合測試：領取按鈕、追蹤檢查、Email 收集、標籤、每人一次、
// 私訊關鍵字、ref 觸發。用 in-memory SQLite 跑真的 migrations，Meta API 以假 fetch 模擬。
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../src/database/schema';
import { processCommentEvent, processStoryReplyEvent } from '../../src/automation/engine';
import { processMessagingEvent } from '../../src/automation/funnel';
import { MetaClient } from '../../src/meta/client';
import { normalizeCommentText } from '../../src/automation/normalizer';
import { freshTestDb } from '../helpers/pg';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

// ---------- 假 Meta API ----------
interface Call {
  url: string;
  method: string;
  form: Record<string, string>;
}
let calls: Call[];
let following: Record<string, boolean | 'error'>;
let failNextMessage: number | null;

function fakeClient() {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const form = init?.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : {};
    calls.push({ url, method, form });
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

    if (method === 'POST' && url.includes('/messages')) {
      if (failNextMessage) {
        const s = failNextMessage;
        failNextMessage = null;
        return json(s, { error: { message: 'temporary', code: 2 } });
      }
      return json(200, { recipient_id: 'x', message_id: 'm' + calls.length });
    }
    if (method === 'POST' && url.includes('/replies')) return json(200, { id: 'reply' });
    if (method === 'GET' && url.includes('is_user_follow_business')) {
      const igsid = new URL(url).pathname.split('/').pop()!;
      const f = following[igsid];
      if (f === 'error') return json(400, { error: { message: 'User consent is required', code: 230 } });
      return json(200, { username: 'u_' + igsid, name: 'Name ' + igsid, is_user_follow_business: !!f });
    }
    return json(400, { error: { message: 'unexpected ' + url, code: 100 } });
  }) as unknown as typeof fetch;
  return new MetaClient({ accessToken: 't', graphApiVersion: 'v21.0', fetchImpl });
}

const sentMessages = () =>
  calls
    .filter((c) => c.method === 'POST' && c.url.includes('/messages'))
    .map((c) => ({ recipient: JSON.parse(c.form.recipient), message: JSON.parse(c.form.message) }));
const lastSent = () => sentMessages().at(-1)!;
const button = (m: { message: { attachment?: { payload: { buttons: Array<Record<string, string>> } } } }) =>
  m.message.attachment?.payload.buttons[0];

// ---------- 資料準備 ----------
let seq = 0;

async function seedAccount() {
  await db.insert(schema.instagramAccounts).values({ id: 'acct', instagramAccountId: 'ig-acct' });
  await db.insert(schema.instagramMedia).values({
    id: 'media',
    instagramAccountId: 'acct',
    instagramMediaId: 'ig-media',
    mediaType: 'IMAGE',
  });
}

async function seedAutomation(
  id: string,
  keywords: string[],
  overrides: Partial<typeof schema.automations.$inferInsert> = {},
) {
  await db.insert(schema.automations).values({
    id,
    instagramMediaId: overrides.applyScope && overrides.applyScope !== 'media' ? null : 'media',
    name: id,
    status: 'active',
    matchType: 'contains_any',
    publicReplyEnabled: 0,
    privateReplyEnabled: 1,
    openingDm: '謝謝留言！',
    buttonText: '打開',
    buttonUrl: 'https://example.com/guide',
    ...overrides,
  });
  for (const k of keywords) {
    await db.insert(schema.automationKeywords).values({
      id: `${id}-${k}`,
      automationId: id,
      keyword: k,
      normalizedKeyword: normalizeCommentText(k), // 與後台 API 相同的正規化（含繁簡互通）
    });
  }
}

async function commentEvent(commentId: string, from: string, text: string) {
  const payload = {
    object: 'instagram',
    entry: [
      {
        id: 'ig-acct',
        time: 1700000000 + ++seq,
        changes: [
          {
            field: 'comments',
            value: { id: commentId, text, from: { id: from, username: 'cu_' + from }, media: { id: 'ig-media' } },
          },
        ],
      },
    ],
  };
  const id = 'evt-' + commentId;
  await db.insert(schema.webhookEvents).values({
    id,
    eventKey: id,
    eventType: 'comments',
    rawPayload: JSON.stringify(payload),
    signatureValid: 1,
  });
  return {
    webhookEventId: id,
    eventKey: id,
    instagramAccountId: 'ig-acct',
    instagramMediaId: 'ig-media',
    instagramCommentId: commentId,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function messagingEvent(from: string, body: Record<string, any>) {
  const key = body.postback?.mid ?? body.message?.mid ?? `ref:${from}:${++seq}:${body.referral?.ref}`;
  const timestamp = key.startsWith('ref:') ? seq : ++seq;
  const payload = {
    object: 'instagram',
    entry: [{ id: 'ig-acct', time: 1, messaging: [{ sender: { id: from }, recipient: { id: 'ig-acct' }, timestamp, ...body }] }],
  };
  const id = 'evt-' + key;
  await db.insert(schema.webhookEvents).values({
    id,
    eventKey: id,
    eventType: 'messaging',
    rawPayload: JSON.stringify(payload),
    signatureValid: 1,
  });
  return {
    webhookEventId: id,
    eventKey: id,
    instagramAccountId: 'ig-acct',
    instagramMediaId: '',
    instagramCommentId: key,
    eventType: 'messaging' as const,
  };
}
const postback = (from: string, payload: string) => messagingEvent(from, { postback: { mid: 'pb' + ++seq, title: 'x', payload } });
const dm = (from: string, text: string) => messagingEvent(from, { message: { mid: 'mid' + ++seq, text } });

const contact = async (igsid: string) =>
  (await db.select().from(schema.contacts).where(eq(schema.contacts.igsid, igsid)))[0];
const trigger = async (igsid: string, automationId: string) =>
  (await db.select().from(schema.contactAutomations)).find(
    (r: { igsid: string; automationId: string }) => r.igsid === igsid && r.automationId === automationId,
  );

let deps: { db: unknown; metaClient: MetaClient };

beforeEach(async () => {
  const sqlite = await freshTestDb();
  db = sqlite;
  calls = [];
  following = {};
  failNextMessage = null;
  await seedAccount();
  deps = { db, metaClient: fakeClient() };
});

// ---------- 門檻流程 ----------

describe('gated comment flow (follow + email)', () => {
  beforeEach(async () => {
    await seedAutomation('gated', ['+1'], {
      followGateEnabled: 1,
      emailCaptureEnabled: 1,
      claimButtonText: '給我連結',
      deliveryText: '這是懶人包',
      tag: '懶人包10月',
    });
  });

  it('comment → private reply with a CLAIM postback button, contact + tag recorded, not delivered yet', async () => {
    const out = await processCommentEvent(deps as never, await commentEvent('c1', 'U1', '我要 +1'));
    expect(out.kind).toBe('completed');
    const m = lastSent();
    expect(m.recipient).toEqual({ comment_id: 'c1' });
    expect(button(m)).toEqual({ type: 'postback', payload: 'CLAIM:gated', title: '給我連結' });
    const c = await contact('U1');
    expect(c.username).toBe('cu_U1');
    expect(JSON.parse(c.tags)).toEqual(['懶人包10月']);
    expect((await trigger('U1', 'gated')).deliveredAt).toBeNull();
  });

  it('full path: not following → recheck → email prompt → bad email → email → delivered', async () => {
    await processCommentEvent(deps as never, await commentEvent('c1', 'U1', '+1'));

    following.U1 = false;
    await processMessagingEvent(deps as never, await postback('U1', 'CLAIM:gated'));
    expect(button(lastSent())).toMatchObject({ type: 'postback', title: '我追蹤了', payload: 'CLAIM:gated' });
    expect((await contact('U1')).isFollower).toBe(0);

    following.U1 = true;
    await processMessagingEvent(deps as never, await postback('U1', 'CLAIM:gated'));
    expect(lastSent().message.text).toMatch(/Email/);
    expect((await contact('U1')).state).toBe('awaiting_email:gated');
    expect((await contact('U1')).isFollower).toBe(1);
    expect((await contact('U1')).username).toBe('u_U1');

    await processMessagingEvent(deps as never, await dm('U1', '好喔'));
    expect(lastSent().message.text).toMatch(/不像 Email/);

    await processMessagingEvent(deps as never, await dm('U1', '我的信箱 Sean.Test@Example.COM'));
    const final = lastSent();
    expect(final.recipient).toEqual({ id: 'U1' });
    expect(final.message.attachment.payload.text).toBe('這是懶人包');
    expect(button(final)).toEqual({ type: 'web_url', url: 'https://example.com/guide', title: '打開' });
    const c = await contact('U1');
    expect(c.email).toBe('sean.test@example.com');
    expect(c.state).toBeNull();
    expect((await trigger('U1', 'gated')).deliveredAt).not.toBeNull();
  });

  it('a contact who already left an email is delivered right after the follow check', async () => {
    await processCommentEvent(deps as never, await commentEvent('c1', 'U1', '+1'));
    await db.update(schema.contacts).set({ email: 'a@b.co' }).where(eq(schema.contacts.igsid, 'U1'));
    following.U1 = true;
    await processMessagingEvent(deps as never, await postback('U1', 'CLAIM:gated'));
    expect(button(lastSent())?.type).toBe('web_url');
  });

  it('profile lookup failure fails open (does not block the person)', async () => {
    await processCommentEvent(deps as never, await commentEvent('c1', 'U1', '+1'));
    following.U1 = 'error';
    await processMessagingEvent(deps as never, await postback('U1', 'CLAIM:gated'));
    expect(lastSent().message.text).toMatch(/Email/); // 跳過追蹤檢查，進到 Email
  });

  it('postback for a paused automation does nothing', async () => {
    await db.update(schema.automations).set({ status: 'paused' }).where(eq(schema.automations.id, 'gated'));
    const out = await processMessagingEvent(deps as never, await postback('U1', 'CLAIM:gated'));
    expect(out).toEqual({ kind: 'skipped', reason: 'automation_inactive' });
    expect(sentMessages()).toHaveLength(0);
  });

  it('a temporary Meta error on a funnel message asks the queue to retry', async () => {
    following.U1 = true;
    failNextMessage = 500;
    const out = await processMessagingEvent(deps as never, await postback('U1', 'CLAIM:gated'));
    expect(out.kind).toBe('retry');
  });
});

// ---------- 無門檻、每人一次、限動 ----------

describe('non-gated rules and once-per-contact', () => {
  it('non-gated comment keeps the original behaviour (link button) and counts as delivered', async () => {
    await seedAutomation('plain', ['報名'], { tag: '課程' });
    await processCommentEvent(deps as never, await commentEvent('c2', 'U2', '報名'));
    expect(button(lastSent())).toEqual({ type: 'web_url', url: 'https://example.com/guide', title: '打開' });
    expect((await trigger('U2', 'plain')).deliveredAt).not.toBeNull();
    expect(JSON.parse((await contact('U2')).tags)).toEqual(['課程']);
  });

  it('once-per-contact skips a second comment from the same person, but a queue retry of the first still runs', async () => {
    await seedAutomation('once', ['抽獎'], { oncePerContact: 1 });
    const first = await commentEvent('c3', 'U3', '抽獎');
    await processCommentEvent(deps as never, first);
    expect(sentMessages()).toHaveLength(1);

    // 同一則留言重新處理（佇列重試）不會被每人一次擋掉，但也不會重送（run 冪等）
    const again = await processCommentEvent(deps as never, first);
    expect(again.kind).not.toBe('skipped');
    expect(sentMessages()).toHaveLength(1);

    const second = await processCommentEvent(deps as never, await commentEvent('c4', 'U3', '抽獎 再一次'));
    expect(second).toEqual({ kind: 'skipped', reason: 'once_per_contact' });
    expect(sentMessages()).toHaveLength(1);
  });

  it('gated story reply sends the claim button to the sender', async () => {
    await db.insert(schema.instagramMedia).values({
      id: 'story',
      instagramAccountId: 'acct',
      instagramMediaId: 'ig-story',
      mediaType: 'STORY',
    });
    await db.insert(schema.automations).values({
      id: 'story-auto',
      instagramMediaId: 'story',
      name: 's',
      status: 'active',
      matchType: 'all_comments',
      publicReplyEnabled: 0,
      privateReplyEnabled: 1,
      openingDm: '要嗎',
      emailCaptureEnabled: 1,
    });
    const payload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-acct',
          time: 1,
          messaging: [
            { sender: { id: 'U7' }, recipient: { id: 'ig-acct' }, timestamp: 5, message: { mid: 'smid', text: '好美', reply_to: { story: { id: 'ig-story' } } } },
          ],
        },
      ],
    };
    await db.insert(schema.webhookEvents).values({ id: 'se', eventKey: 'smid', eventType: 'story_reply', rawPayload: JSON.stringify(payload), signatureValid: 1 });
    await processStoryReplyEvent(deps as never, {
      webhookEventId: 'se',
      eventKey: 'smid',
      instagramAccountId: 'ig-acct',
      instagramMediaId: 'ig-story',
      instagramCommentId: 'smid',
      eventType: 'story_reply',
    });
    const m = lastSent();
    expect(m.recipient).toEqual({ id: 'U7' });
    expect(button(m)).toMatchObject({ type: 'postback', payload: 'CLAIM:story-auto' });
    expect(await contact('U7')).toBeTruthy();
  });
});

// ---------- 私訊關鍵字、ref ----------

describe('DM keyword and ref triggers', () => {
  it('a DM keyword rule replies in the open conversation and creates a run', async () => {
    await seedAutomation('price', ['價目表'], { applyScope: 'dm_keyword', tag: '詢價' });
    const out = await processMessagingEvent(deps as never, await dm('U5', '請問價目表'));
    expect(out).toEqual({ kind: 'completed', step: 'delivered' });
    expect(lastSent().recipient).toEqual({ id: 'U5' });
    const runs = await db.select().from(schema.automationRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0].commenterId).toBe('U5');
    expect(JSON.parse((await contact('U5')).tags)).toEqual(['詢價']);
  });

  it('unmatched DMs and dm_keyword rules set to "all comments" never reply', async () => {
    await seedAutomation('any', [], { applyScope: 'dm_keyword', matchType: 'all_comments' });
    const out = await processMessagingEvent(deps as never, await dm('U5', '你好'));
    expect(out.kind).toBe('no_match');
    expect(sentMessages()).toHaveLength(0);
  });

  it('ref rules match ig.me / ad referrals exactly', async () => {
    await seedAutomation('ad', ['fall_ad'], { applyScope: 'ref', openingDm: '優惠碼 FALL' });
    await processMessagingEvent(deps as never, await messagingEvent('U8', { referral: { ref: 'fall_ad_2', source: 'ADS' } }));
    expect(sentMessages()).toHaveLength(0);
    await processMessagingEvent(deps as never, await messagingEvent('U8', { referral: { ref: 'fall_ad', source: 'ADS' } }));
    expect(lastSent().message.attachment.payload.text).toBe('優惠碼 FALL');
  });

  it('emergency stop blocks every funnel step', async () => {
    await seedAutomation('price', ['價目表'], { applyScope: 'dm_keyword' });
    await db.insert(schema.systemSettings).values({ id: 's', emergencyStop: 1 });
    const out = await processMessagingEvent(deps as never, await dm('U5', '價目表'));
    expect(out).toEqual({ kind: 'skipped', reason: 'emergency_stop' });
    expect(sentMessages()).toHaveLength(0);
  });
});
