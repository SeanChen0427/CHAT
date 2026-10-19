// Sean 版：名單 API 與自動化新欄位的後台 API 測試。
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import * as schema from '../../src/database/schema';
import { hashPassword } from '../../src/security/password';
import { createSessionCookie, SESSION_COOKIE_NAME } from '../../src/security/session';
import { freshTestDb, type TestDb } from '../helpers/pg';

const SECRET = 'contacts-test-secret';
const ORIGIN = 'https://igbot.example.com';
let sqlite: TestDb;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
let env: Record<string, unknown>;
let cookie: string;

beforeEach(async () => {
  sqlite = await freshTestDb();
  db = sqlite;
  await db.insert(schema.adminUsers).values({ id: 'admin-1', email: 'a@b.com', passwordHash: await hashPassword('x') });
  await db.insert(schema.instagramAccounts).values({ id: 'acct', instagramAccountId: 'ig-acct' });
  await db.insert(schema.instagramMedia).values({ id: 'media', instagramAccountId: 'acct', instagramMediaId: 'ig-media', mediaType: 'IMAGE' });
  await db.insert(schema.contacts).values([
    { igsid: 'U1', username: 'alice', name: 'Alice', email: 'alice@example.com', tags: '["懶人包"]', isFollower: 1, lastSeenAt: '2026-10-19T02:00:00Z' },
    { igsid: 'U2', username: 'bob', name: '=HYPERLINK("x")', tags: '["課程","懶人包"]', isFollower: 0, lastSeenAt: '2026-10-19T03:00:00Z' },
    { igsid: 'U3', username: 'carol', tags: '[]', lastSeenAt: '2026-10-19T01:00:00Z' },
  ]);
  env = {
    DB: sqlite,
    ADMIN_SESSION_SECRET: SECRET,
    ADMIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  cookie = `${SESSION_COOKIE_NAME}=${await createSessionCookie(SECRET, 'admin-1', 3600)}`;
});

const get = (path: string, withCookie = true) =>
  createApp().fetch(new Request(`${ORIGIN}/api/admin${path}`, { headers: withCookie ? { Cookie: cookie } : {} }), env);
const send = (method: string, path: string, body?: object) =>
  createApp().fetch(
    new Request(`${ORIGIN}/api/admin${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );

describe('contacts API', () => {
  it('requires login', async () => {
    expect((await get('/contacts', false)).status).toBe(401);
    expect((await get('/contacts/export.csv', false)).status).toBe(401);
  });

  it('lists newest first and filters by search, tag and email', async () => {
    const all = (await (await get('/contacts')).json()) as { contacts: Array<{ igsid: string; tags: string[] }> };
    expect(all.contacts.map((c) => c.igsid)).toEqual(['U2', 'U1', 'U3']);
    expect(all.contacts[0].tags).toEqual(['課程', '懶人包']);

    const byTag = (await (await get('/contacts?tag=' + encodeURIComponent('懶人包'))).json()) as { contacts: { igsid: string }[] };
    expect(byTag.contacts.map((c) => c.igsid)).toEqual(['U2', 'U1']);
    const withEmail = (await (await get('/contacts?hasEmail=1')).json()) as { contacts: { igsid: string }[] };
    expect(withEmail.contacts.map((c) => c.igsid)).toEqual(['U1']);
    const search = (await (await get('/contacts?q=CAR')).json()) as { contacts: { igsid: string }[] };
    expect(search.contacts.map((c) => c.igsid)).toEqual(['U3']);
  });

  it('counts tags', async () => {
    const r = (await (await get('/contacts/tags')).json()) as { tags: { tag: string; count: number }[] };
    expect(r.tags).toEqual([
      { tag: '懶人包', count: 2 },
      { tag: '課程', count: 1 },
    ]);
  });

  it('exports CSV with a UTF-8 BOM, Taipei times and formula-injection protection', async () => {
    const res = await get('/contacts/export.csv');
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('alice@example.com');
    expect(text).toContain('2026-10-19 10:00'); // 02:00Z → 台北 10:00
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
    const logs = await db.select().from(schema.auditLogs);
    expect(logs.map((l: { action: string }) => l.action)).toContain('contacts.export');
  });

  it('delete removes the contact and its triggers and anonymises run history', async () => {
    await db.insert(schema.contactAutomations).values({ id: 'ca', igsid: 'U1', automationId: 'a' });
    await db.insert(schema.automationRuns).values({
      id: 'r', automationId: 'a', instagramCommentId: 'c', instagramMediaId: 'm', status: 'completed',
      commenterId: 'U1', commenterUsername: 'alice', originalCommentText: '我要 +1',
    });
    const res = await send('DELETE', '/contacts/U1');
    expect(res.status).toBe(200);
    expect(await db.select().from(schema.contacts)).toHaveLength(2);
    expect(await db.select().from(schema.contactAutomations)).toHaveLength(0);
    const run = (await db.select().from(schema.automationRuns))[0];
    expect(run).toMatchObject({ commenterId: null, commenterUsername: null, originalCommentText: null });
  });

  it('delete is protected by CSRF (cross-origin request rejected)', async () => {
    const res = await createApp().fetch(
      new Request(`${ORIGIN}/api/admin/contacts/U1`, { method: 'DELETE', headers: { Origin: 'https://evil.example', Cookie: cookie } }),
      env,
    );
    expect(res.status).toBe(403);
    expect(await db.select().from(schema.contacts)).toHaveLength(3);
  });
});

describe('automations API — Sean 版欄位', () => {
  it('stores gate fields, trims empty text to NULL, and creates dm_keyword / ref rules without a post', async () => {
    const res = await send('POST', '/automations', {
      applyScope: 'dm_keyword',
      name: '價目表',
      keywords: ['價目表'],
      publicReplyEnabled: false,
      openingDm: '價目表給你',
      followGateEnabled: true,
      emailCaptureEnabled: false,
      claimButtonText: '領取',
      notFollowingText: '   ',
      tag: '詢價',
      oncePerContact: true,
    });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const row = (await db.select().from(schema.automations)).find((a: { id: string }) => a.id === id);
    expect(row).toMatchObject({
      applyScope: 'dm_keyword',
      instagramMediaId: null,
      followGateEnabled: 1,
      emailCaptureEnabled: 0,
      claimButtonText: '領取',
      notFollowingText: null,
      tag: '詢價',
      oncePerContact: 1,
    });
    expect((await send('POST', `/automations/${id}/activate`)).status).toBe(200);
  });

  it('refuses to activate a DM-keyword rule that would answer every DM, or a gate without a DM', async () => {
    const a = (await (
      await send('POST', '/automations', { applyScope: 'dm_keyword', name: 'x', matchType: 'all_comments', openingDm: 'hi' })
    ).json()) as { id: string };
    const r1 = await send('POST', `/automations/${a.id}/activate`);
    expect(r1.status).toBe(422);
    expect(((await r1.json()) as { reasons: string[] }).reasons).toContain('keywords_required');

    const b = (await (
      await send('POST', '/automations', {
        instagramMediaId: 'media', name: 'y', keywords: ['+1'], publicReplyVariants: ['已私訊'],
        privateReplyEnabled: false, emailCaptureEnabled: true,
      })
    ).json()) as { id: string };
    const r2 = await send('POST', `/automations/${b.id}/activate`);
    expect(((await r2.json()) as { reasons: string[] }).reasons).toContain('private_reply_required_for_gate');
  });

  it('PATCH updates gate fields', async () => {
    const a = (await (
      await send('POST', '/automations', { instagramMediaId: 'media', name: 'z', keywords: ['+1'], openingDm: 'hi' })
    ).json()) as { id: string };
    await send('PATCH', `/automations/${a.id}`, { emailCaptureEnabled: true, emailPromptText: '留下 Email', deliveryText: '給你' });
    const row = (await db.select().from(schema.automations)).find((x: { id: string }) => x.id === a.id);
    expect(row).toMatchObject({ emailCaptureEnabled: 1, emailPromptText: '留下 Email', deliveryText: '給你' });
  });
});
