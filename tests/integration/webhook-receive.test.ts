import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { webhookEvents } from '../../src/database/schema';
import { freshTestDb, type TestDb } from '../helpers/pg';

const SECRET = 'meta-app-secret';
const encoder = new TextEncoder();

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return 'sha256=' + Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function commentPayload(commentId: string, mediaId = 'media-1') {
  return JSON.stringify({
    object: 'instagram',
    entry: [
      {
        id: 'acct-1',
        time: 1700000000,
        changes: [
          {
            field: 'comments',
            value: {
              id: commentId,
              text: '我想要 ADHD',
              from: { id: 'user-9', username: 'someone' },
              media: { id: mediaId },
            },
          },
        ],
      },
    ],
  });
}

let sqlite: TestDb;
let enqueued: unknown[];
let env: Record<string, unknown>;

beforeEach(async () => {
  sqlite = await freshTestDb();
  enqueued = [];
  env = {
    DB: sqlite,
    INSTAGRAM_APP_SECRET: SECRET,
    LOG_LEVEL: 'error',
    COMMENT_QUEUE: { send: async (m: unknown) => void enqueued.push(m) },
  };
});

async function post(body: string, signature?: string) {
  return createApp().fetch(
    new Request('https://igbot.example.com/api/webhooks/meta/instagram', {
      method: 'POST',
      headers: signature ? { 'X-Hub-Signature-256': signature } : {},
      body,
    }),
    env,
  );
}

describe('POST /api/webhooks/meta/instagram', () => {
  it('rejects an invalid signature and does not enqueue', async () => {
    const body = commentPayload('c1');
    const res = await post(body, 'sha256=deadbeef');
    expect(res.status).toBe(401);
    expect(enqueued).toHaveLength(0);
    const rows = sqlite;
    expect(await rows.select().from(webhookEvents)).toHaveLength(0);
  });

  it('stores the event and enqueues on a valid signature', async () => {
    const body = commentPayload('c1');
    const res = await post(body, await sign(body));
    expect(res.status).toBe(200);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      instagramCommentId: 'c1',
      instagramMediaId: 'media-1',
      instagramAccountId: 'acct-1',
    });
    const rows = await sqlite.select().from(webhookEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0].signatureValid).toBe(1);
  });

  it('is idempotent on a redelivered event (duplicate_count++ , no re-enqueue)', async () => {
    const body = commentPayload('c1');
    const sig = await sign(body);
    await post(body, sig);
    await post(body, sig);
    expect(enqueued).toHaveLength(1); // only enqueued once
    const rows = await sqlite.select().from(webhookEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0].duplicateCount).toBe(1);
  });

  it('returns 200 even when there is nothing to process', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const res = await post(body, await sign(body));
    expect(res.status).toBe(200);
    expect(enqueued).toHaveLength(0);
  });
});


function storyReplyBody(mid: string, storyId = 'story-1') {
  return JSON.stringify({
    object: 'instagram',
    entry: [
      {
        id: 'acct-1',
        time: 1700000000,
        messaging: [
          {
            sender: { id: 'user-9' },
            recipient: { id: 'acct-1' },
            timestamp: 1700000001234,
            message: { mid, text: '關鍵字', reply_to: { story: { id: storyId } } },
          },
        ],
      },
    ],
  });
}

describe('POST /api/webhooks/meta/instagram — story replies', () => {
  it('stores a story_reply event keyed by mid and enqueues with eventType', async () => {
    const body = storyReplyBody('mid.abc');
    const res = await post(body, await sign(body));
    expect(res.status).toBe(200);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      instagramAccountId: 'acct-1',
      instagramMediaId: 'story-1',
      instagramCommentId: 'mid.abc',
      eventType: 'story_reply',
    });
    const rows = await sqlite.select().from(webhookEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe('story_reply');
    expect(rows[0].eventKey).toBe('mid.abc');
  });

  it('is idempotent on story redelivery (duplicate_count++, no re-enqueue)', async () => {
    const body = storyReplyBody('mid.abc');
    await post(body, await sign(body));
    await post(body, await sign(body));
    expect(enqueued).toHaveLength(1);
    const rows = await sqlite.select().from(webhookEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0].duplicateCount).toBe(1);
  });

  // Sean 版：一般私訊改為入列（eventType=messaging），交給 funnel 判斷私訊關鍵字／等 Email。
  it('enqueues plain DMs as messaging events', async () => {
    const body = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: 'acct-1',
          time: 1700000000,
          messaging: [
            { sender: { id: 'user-9' }, recipient: { id: 'acct-1' }, timestamp: 1, message: { mid: 'mid.x', text: '哈囉' } },
          ],
        },
      ],
    });
    const res = await post(body, await sign(body));
    expect(res.status).toBe(200);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({ eventType: 'messaging', instagramCommentId: 'mid.x', instagramMediaId: '' });
    expect(await sqlite.select().from(webhookEvents)).toHaveLength(1);
  });

  it('ignores echoes and the account\'s own messages', async () => {
    const body = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: 'acct-1',
          time: 1700000000,
          messaging: [
            { sender: { id: 'acct-1' }, recipient: { id: 'user-9' }, timestamp: 1, message: { mid: 'mid.own', text: '價目表' } },
            { sender: { id: 'user-9' }, recipient: { id: 'acct-1' }, timestamp: 2, message: { mid: 'mid.echo', text: 'x', is_echo: true } },
          ],
        },
      ],
    });
    const res = await post(body, await sign(body));
    expect(res.status).toBe(200);
    expect(enqueued).toHaveLength(0);
  });

  it('enqueues postbacks and ig.me referrals; a re-sent referral is deduplicated', async () => {
    const body = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: 'acct-1',
          time: 1700000000,
          messaging: [
            { sender: { id: 'user-9' }, recipient: { id: 'acct-1' }, timestamp: 3, postback: { mid: 'pb.1', title: '給我連結', payload: 'CLAIM:a1' } },
            { sender: { id: 'user-8' }, recipient: { id: 'acct-1' }, timestamp: 4, referral: { ref: 'fall_ad', source: 'ADS', type: 'OPEN_THREAD' } },
          ],
        },
      ],
    });
    await post(body, await sign(body));
    await post(body, await sign(body));
    expect(enqueued.map((e: { instagramCommentId: string }) => e.instagramCommentId)).toEqual([
      'pb.1',
      'ref:user-8:4:fall_ad',
    ]);
  });
});
