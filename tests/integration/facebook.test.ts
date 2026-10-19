// Sean 版：Facebook 粉專支援——webhook 解析與驗簽、留言私訊／公開回覆、Messenger 私訊關鍵字、
// 平台專屬規則、粉專註冊／訂閱／貼文同步。
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import * as schema from '../../src/database/schema';
import { processCommentEvent } from '../../src/automation/engine';
import { processMessagingEvent } from '../../src/automation/funnel';
import { normalizeCommentText } from '../../src/automation/normalizer';
import { MetaClient } from '../../src/meta/client';
import { runScheduledSync } from '../../src/meta/media';
import { extractCommentEvents, extractMessagingEvents, extractStoryReplyEvents } from '../../src/webhook/event-parser';
import { freshTestDb } from '../helpers/pg';

const PAGE = '1000000000001';
const encoder = new TextEncoder();

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return 'sha256=' + Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fbComment(commentId: string, postId: string, from: string, message: string, extra: Record<string, unknown> = {}) {
  return {
    object: 'page',
    entry: [
      {
        id: PAGE,
        time: 1700000000,
        changes: [
          {
            field: 'feed',
            value: {
              item: 'comment',
              verb: 'add',
              comment_id: commentId,
              post_id: postId,
              from: { id: from, name: 'FB 用戶 ' + from },
              message,
              created_time: 1700000001,
              ...extra,
            },
          },
        ],
      },
    ],
  };
}

function fbDm(from: string, text: string, mid: string) {
  return {
    object: 'page',
    entry: [{ id: PAGE, time: 1, messaging: [{ sender: { id: from }, recipient: { id: PAGE }, timestamp: 2, message: { mid, text } }] }],
  };
}

// ---------- 解析 ----------

describe('Facebook webhook parsing', () => {
  it('parses new Page comments and ignores edits, likes and posts', () => {
    const add = extractCommentEvents(fbComment('P_C1', `${PAGE}_P1`, 'u1', '+1'));
    expect(add).toEqual([
      expect.objectContaining({
        platform: 'facebook',
        instagramAccountId: PAGE,
        instagramMediaId: `${PAGE}_P1`,
        instagramCommentId: 'P_C1',
        commenterId: 'u1',
        commenterUsername: 'FB 用戶 u1',
        text: '+1',
      }),
    ]);
    expect(extractCommentEvents(fbComment('P_C1', 'p', 'u1', 'x', { verb: 'edited' }))).toHaveLength(0);
    expect(extractCommentEvents(fbComment('P_C1', 'p', 'u1', 'x', { item: 'reaction' }))).toHaveLength(0);
    expect(extractCommentEvents(fbComment('P_C1', 'p', 'u1', 'x', { item: 'status' }))).toHaveLength(0);
  });

  it('tags Messenger DMs as facebook and never treats them as story replies', () => {
    const p = fbDm('psid-1', '價目表', 'm.fb1');
    expect(extractMessagingEvents(p)).toEqual([expect.objectContaining({ platform: 'facebook', kind: 'text', senderId: 'psid-1' })]);
    const withReplyTo = {
      object: 'page',
      entry: [{ id: PAGE, messaging: [{ sender: { id: 'x' }, recipient: { id: PAGE }, message: { mid: 'm', text: 'hi', reply_to: { story: { id: 's' } } } }] }],
    };
    expect(extractStoryReplyEvents(withReplyTo)).toHaveLength(0);
  });
});

// ---------- 接收與驗簽 ----------

describe('Facebook webhook receive', () => {
  let enqueued: Array<Record<string, unknown>>;
  let env: Record<string, unknown>;
  beforeEach(async () => {
    const sqlite = await freshTestDb();
    enqueued = [];
    env = {
      DB: sqlite,
      INSTAGRAM_APP_SECRET: 'ig-secret',
      META_APP_SECRET: 'meta-secret',
      LOG_LEVEL: 'error',
      COMMENT_QUEUE: { send: async (m: Record<string, unknown>) => void enqueued.push(m) },
    };
  });
  const post = (body: string, sig: string) =>
    createApp().fetch(
      new Request('https://igbot.example.com/api/webhooks/meta/instagram', { method: 'POST', headers: { 'X-Hub-Signature-256': sig }, body }),
      env,
    );

  it('accepts Page events signed with the Meta App Secret and enqueues them as facebook', async () => {
    const body = JSON.stringify(fbComment('P_C1', `${PAGE}_P1`, 'u1', '+1'));
    const res = await post(body, await sign(body, 'meta-secret'));
    expect(res.status).toBe(200);
    expect(enqueued).toEqual([expect.objectContaining({ eventType: 'comments', platform: 'facebook', instagramCommentId: 'P_C1' })]);
  });

  it('still accepts Instagram events signed with the Instagram App Secret, and rejects other secrets', async () => {
    const body = JSON.stringify(fbDm('psid-1', 'hi', 'm.1'));
    expect((await post(body, await sign(body, 'ig-secret'))).status).toBe(200);
    expect((await post(body, await sign(body, 'wrong'))).status).toBe(401);
  });
});

// ---------- 引擎 ----------

interface Call {
  url: string;
  method: string;
  form: Record<string, string>;
}

describe('Facebook engine', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let igCalls: Call[];
  let fbCalls: Call[];

  function fakeClient(calls: Call[], base: string) {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, form: init?.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : {} });
      const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (method === 'GET' && url.includes(`/${PAGE}_NEW?`) && url.includes('fields=id%2Cmessage')) {
        return ok({ id: `${PAGE}_NEW`, message: '新的 Reels', full_picture: 'https://x/p.jpg', permalink_url: 'https://fb/p', created_time: '2026-10-19T00:00:00+0000', status_type: 'added_video' });
      }
      return ok({ id: 'ok', message_id: 'mid', recipient_id: 'r' });
    }) as unknown as typeof fetch;
    return new MetaClient({ accessToken: 't', graphApiVersion: 'v24.0', fetchImpl, baseUrl: base });
  }

  let deps: { db: unknown; metaClient: MetaClient; facebookClient: MetaClient | null };
  let seq = 0;

  beforeEach(async () => {
    const sqlite = await freshTestDb();
    db = sqlite;
    igCalls = [];
    fbCalls = [];
    deps = {
      db,
      metaClient: fakeClient(igCalls, 'https://graph.instagram.com'),
      facebookClient: fakeClient(fbCalls, 'https://graph.facebook.com'),
    };
    await db.insert(schema.instagramAccounts).values([
      { id: 'ig', instagramAccountId: 'ig-acct', platform: 'instagram' },
      { id: 'fb', instagramAccountId: PAGE, platform: 'facebook' },
    ]);
    await db.insert(schema.instagramMedia).values({
      id: 'fbpost', instagramAccountId: 'fb', instagramMediaId: `${PAGE}_P1`, platform: 'facebook', mediaType: 'FB_VIDEO',
    });
  });

  async function seedRule(id: string, keywords: string[], overrides: Partial<typeof schema.automations.$inferInsert> = {}) {
    await db.insert(schema.automations).values({
      id, name: id, status: 'active', matchType: 'contains_any', publicReplyEnabled: 1, privateReplyEnabled: 1,
      openingDm: '影片的連結在這', buttonText: '打開', buttonUrl: 'https://example.com/v', ...overrides,
    });
    for (const k of keywords) {
      await db.insert(schema.automationKeywords).values({ id: `${id}-${k}`, automationId: id, keyword: k, normalizedKeyword: normalizeCommentText(k) });
    }
    await db.insert(schema.publicReplyVariants).values({ id: `${id}-v`, automationId: id, message: '已私訊你' });
  }

  // 與 receive-webhook 相同：留言事件帶貼文 ID，私訊事件為空字串。
  async function queueMsg(payload: object, key: string, eventType: 'comments' | 'messaging', mediaId = '') {
    const id = 'evt-' + ++seq;
    await db.insert(schema.webhookEvents).values({ id, eventKey: id, eventType, rawPayload: JSON.stringify(payload), signatureValid: 1 });
    return { webhookEventId: id, eventKey: id, instagramAccountId: PAGE, instagramMediaId: mediaId, instagramCommentId: key, eventType, platform: 'facebook' as const };
  }

  it('Page video comment → public reply on /comments and private reply via graph.facebook.com', async () => {
    await seedRule('fbvideo', ['+1'], { instagramMediaId: 'fbpost' });
    const out = await processCommentEvent(deps as never, await queueMsg(fbComment('P_C1', `${PAGE}_P1`, 'u1', '我 +1'), 'P_C1', 'comments', `${PAGE}_P1`));
    expect(out).toMatchObject({ kind: 'completed', publicReplyStatus: 'success', privateReplyStatus: 'success' });
    expect(igCalls).toHaveLength(0);
    const reply = fbCalls.find((c) => c.url.includes('/P_C1/comments'));
    expect(reply?.url.startsWith('https://graph.facebook.com/v24.0/')).toBe(true);
    expect(reply?.form.message).toBe('已私訊你');
    const dm = fbCalls.find((c) => c.url.endsWith(`/${PAGE}/messages`))!;
    expect(JSON.parse(dm.form.recipient)).toEqual({ comment_id: 'P_C1' });
    expect(dm.form.messaging_type).toBeUndefined(); // 留言私訊不帶 messaging_type
    const contact = (await db.select().from(schema.contacts).where(eq(schema.contacts.igsid, 'u1')))[0];
    expect(contact).toMatchObject({ platform: 'facebook', name: 'FB 用戶 u1', username: null });
  });

  it('skips Facebook events when no Page token is configured', async () => {
    await seedRule('fbvideo', ['+1'], { instagramMediaId: 'fbpost' });
    const out = await processCommentEvent(
      { ...deps, facebookClient: null } as never,
      await queueMsg(fbComment('P_C2', `${PAGE}_P1`, 'u1', '+1'), 'P_C2', 'comments', `${PAGE}_P1`),
    );
    expect(out).toEqual({ kind: 'skipped', reason: 'facebook_not_configured' });
  });

  it('unknown Facebook post is discovered with FB fields; only the Facebook (or all-platform) default applies', async () => {
    await seedRule('ig-default', [], { applyScope: 'account_default', platform: 'instagram', matchType: 'all_comments', openingDm: 'IG' });
    await seedRule('fb-default', [], { applyScope: 'account_default', platform: 'facebook', matchType: 'all_comments', openingDm: 'FB' });
    await processCommentEvent(deps as never, await queueMsg(fbComment('P_C3', `${PAGE}_NEW`, 'u2', '好看'), 'P_C3', 'comments', `${PAGE}_NEW`));
    const media = (await db.select().from(schema.instagramMedia).where(eq(schema.instagramMedia.instagramMediaId, `${PAGE}_NEW`)))[0];
    expect(media).toMatchObject({ platform: 'facebook', mediaType: 'FB_VIDEO', caption: '新的 Reels', instagramAccountId: 'fb' });
    const dm = fbCalls.find((c) => c.url.endsWith('/messages'))!;
    expect(JSON.parse(dm.form.message).attachment.payload.text).toBe('FB');
  });

  it('Messenger DM keyword uses the Facebook client with messaging_type=RESPONSE; Instagram-only rules are ignored', async () => {
    await seedRule('ig-only', ['價目表'], { applyScope: 'dm_keyword', platform: 'instagram', publicReplyEnabled: 0, openingDm: 'IG 價目表' });
    const none = await processMessagingEvent(deps as never, await queueMsg(fbDm('psid-1', '價目表', 'm.1'), 'm.1', 'messaging'));
    expect(none.kind).toBe('no_match');

    await seedRule('both', ['價目表'], { applyScope: 'dm_keyword', platform: null, publicReplyEnabled: 0, openingDm: '價目表給你' });
    const out = await processMessagingEvent(deps as never, await queueMsg(fbDm('psid-1', '請給價目表', 'm.2'), 'm.2', 'messaging'));
    expect(out).toEqual({ kind: 'completed', step: 'delivered' });
    const dm = fbCalls.find((c) => c.url.endsWith(`/${PAGE}/messages`))!;
    expect(JSON.parse(dm.form.recipient)).toEqual({ id: 'psid-1' });
    expect(dm.form.messaging_type).toBe('RESPONSE');
    expect(igCalls).toHaveLength(0);
    expect((await db.select().from(schema.contacts))[0].platform).toBe('facebook');
  });

  it('follow gate is skipped on Facebook (no API) and goes straight to email / delivery', async () => {
    await seedRule('gated', ['+1'], { instagramMediaId: 'fbpost', followGateEnabled: 1, publicReplyEnabled: 0 });
    const claim = { object: 'page', entry: [{ id: PAGE, messaging: [{ sender: { id: 'u5' }, recipient: { id: PAGE }, timestamp: 9, postback: { mid: 'pb.1', payload: 'CLAIM:gated', title: 'x' } }] }] };
    const out = await processMessagingEvent(deps as never, await queueMsg(claim, 'pb.1', 'messaging'));
    expect(out).toEqual({ kind: 'completed', step: 'delivered' });
    expect(fbCalls.some((c) => c.method === 'GET')).toBe(false); // 沒有查追蹤
  });
});

// ---------- 粉專註冊／訂閱／同步 ----------

describe('Facebook Page sync', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('registers the Page from its token, subscribes webhooks once, and syncs posts (Instagram not configured)', async () => {
    const sqlite = await freshTestDb();
    const calls: Call[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, form: init?.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : {} });
      const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url.includes('/me?')) return ok({ id: PAGE, name: '熊恩的粉專', picture: { data: { url: 'https://x/pic.jpg' } } });
      if (url.includes('/subscribed_apps')) return ok({ success: true });
      if (url.includes('/posts?')) {
        return ok({ data: [
          { id: `${PAGE}_1`, message: '影片貼文', full_picture: 'https://x/1.jpg', permalink_url: 'https://fb/1', created_time: '2026-10-18T00:00:00+0000', status_type: 'added_video' },
          { id: `${PAGE}_2`, message: '一般貼文', created_time: '2026-10-17T00:00:00+0000', status_type: 'mobile_status_update' },
        ] });
      }
      return new Response(JSON.stringify({ error: { message: 'unexpected ' + url, code: 100 } }), { status: 400 });
    });
    const env = {
      DB: sqlite,
      INSTAGRAM_ACCOUNT_ACCESS_TOKEN: '',
      META_GRAPH_API_VERSION: 'v21.0',
      FACEBOOK_PAGE_ACCESS_TOKEN: 'page-token',
    };
    const summary = await runScheduledSync(env as never);
    expect(summary.errors).toEqual([]);
    expect(summary).toMatchObject({ accounts: 1, inserted: 2 });

    const db = sqlite;
    const acct = (await db.select().from(schema.instagramAccounts))[0];
    expect(acct).toMatchObject({ platform: 'facebook', instagramAccountId: PAGE, username: '熊恩的粉專', webhookSubscribed: 1 });
    const sub = calls.find((c) => c.url.includes('/subscribed_apps'))!;
    expect(sub.url.startsWith(`https://graph.facebook.com/v24.0/${PAGE}/subscribed_apps`)).toBe(true);
    expect(sub.form.subscribed_fields).toBe('feed,messages,messaging_postbacks,messaging_referrals');
    const media = await db.select().from(schema.instagramMedia);
    expect(media.map((m) => [m.platform, m.mediaType, m.caption])).toEqual([
      ['facebook', 'FB_VIDEO', '影片貼文'],
      ['facebook', 'FB_POST', '一般貼文'],
    ]);
    expect(calls.some((c) => c.url.includes('graph.instagram.com'))).toBe(false);

    // 第二次同步不重複訂閱、不重複新增
    calls.length = 0;
    const again = await runScheduledSync(env as never);
    expect(again.inserted).toBe(0);
    expect(calls.some((c) => c.url.includes('/subscribed_apps'))).toBe(false);
  });
});
