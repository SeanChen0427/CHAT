// Sean 版（一鍵連結）：設定精靈 API、Instagram／Facebook OAuth 回呼、設定合併進 env。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { readConfig } from '../../src/config/app-config';
import { adminUsers, instagramAccounts } from '../../src/database/schema';
import { createSessionCookie } from '../../src/security/session';
import { createOAuthState } from '../../src/admin/connect';
import { freshTestDb, type TestDb } from '../helpers/pg';

const SITE = 'https://seanchen0427.github.io';
const API = 'https://ref.supabase.co';
const RETURN_TO = `${SITE}/CHAT/setup`;

let db: TestDb;
let env: Record<string, unknown>;
let token: string;
let calls: Array<{ url: string; method: string; body: string }>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// 假的 Meta：依網址回應。
function stubMeta(routes: Array<[RegExp, (url: string, body: string) => Response]>) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : '';
    calls.push({ url, method: init?.method ?? 'GET', body });
    for (const [re, fn] of routes) if (re.test(url)) return fn(url, body);
    return json({ error: { message: 'unexpected ' + url } }, 500);
  });
}

beforeEach(async () => {
  db = await freshTestDb();
  calls = [];
  env = {
    DB: db,
    ADMIN_SESSION_SECRET: 'test-secret',
    ADMIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ADMIN_ORIGINS: SITE,
    PUBLIC_API_BASE: `${API}/functions/v1`,
    WEBHOOK_VERIFY_TOKEN: 'verify-123',
    META_GRAPH_API_VERSION: 'v21.0',
  };
  await db.insert(adminUsers).values({ id: 'a1', email: 'me@example.com', passwordHash: 'x' });
  token = await createSessionCookie('test-secret', 'a1', 3600);
});

afterEach(() => vi.unstubAllGlobals());

const auth = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, Origin: SITE, ...extra });
const call = (method: string, path: string, body?: unknown) =>
  createApp().fetch(
    new Request(`${API}${path}`, {
      method,
      headers: auth(body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );

async function saveApp() {
  const res = await call('PUT', '/api/admin/connect/app', {
    instagramAppId: '1234567890',
    instagramAppSecret: 'abcdef0123456789abcdef0123456789',
    metaAppId: '9876543210',
    metaAppSecret: '0123456789abcdef0123456789abcdef',
  });
  expect(res.status).toBe(200);
}

describe('App 資料', () => {
  it('saves App IDs and secrets, and status never returns the secrets', async () => {
    await saveApp();
    const status = (await (await call('GET', '/api/admin/connect/status')).json()) as Record<string, unknown>;
    expect(status.app).toEqual({
      instagramAppId: '1234567890',
      hasInstagramAppSecret: true,
      metaAppId: '9876543210',
      hasMetaAppSecret: true,
    });
    expect(JSON.stringify(status)).not.toContain('abcdef0123456789abcdef0123456789');
    expect(status.redirectUris).toEqual({
      instagram: `${API}/functions/v1/api/oauth/instagram/callback`,
      facebook: `${API}/functions/v1/api/oauth/facebook/callback`,
    });
    expect(status.callbackUrl).toBe(`${API}/functions/v1/api/webhooks/meta/instagram`);
    expect(status.instagram).toBeNull();
  });

  it('rejects malformed values with a plain message', async () => {
    const res = await call('PUT', '/api/admin/connect/app', { instagramAppId: '請貼上 ID' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('Instagram App ID');
  });

  it('requires login', async () => {
    const res = await createApp().fetch(new Request(`${API}/api/admin/connect/status`), env);
    expect(res.status).toBe(401);
  });

  it('DB-stored app secret is used to verify webhook signatures', async () => {
    await saveApp();
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('abcdef0123456789abcdef0123456789'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))).toString('hex');
    const res = await createApp().fetch(
      new Request(`${API}/api/webhooks/meta/instagram`, {
        method: 'POST',
        headers: { 'X-Hub-Signature-256': `sha256=${sig}`, 'Content-Type': 'application/json' },
        body,
      }),
      { ...env, COMMENT_QUEUE: { send: async () => undefined } },
    );
    expect(res.status).toBe(200);
  });
});

describe('Instagram 連結', () => {
  it('start returns the Instagram authorize URL and rejects foreign return URLs', async () => {
    await saveApp();
    const res = await call('POST', '/api/admin/connect/instagram/start', { returnTo: RETURN_TO });
    const { url } = (await res.json()) as { url: string };
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('1234567890');
    expect(u.searchParams.get('redirect_uri')).toBe(`${API}/functions/v1/api/oauth/instagram/callback`);
    expect(u.searchParams.get('scope')).toContain('instagram_business_manage_messages');
    expect(u.searchParams.get('state')).toBeTruthy();

    const bad = await call('POST', '/api/admin/connect/instagram/start', { returnTo: 'https://evil.example.com/x' });
    expect(bad.status).toBe(400);
  });

  it('start explains when the App ID is missing', async () => {
    const res = await call('POST', '/api/admin/connect/instagram/start', { returnTo: RETURN_TO });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('Instagram App ID');
  });

  it('callback exchanges the code, saves the account and token, subscribes, and returns to the site', async () => {
    await saveApp();
    stubMeta([
      [/api\.instagram\.com\/oauth\/access_token/, () => json({ data: [{ access_token: 'short-tok', user_id: '1' }] })],
      [/graph\.instagram\.com\/access_token/, () => json({ access_token: 'long-tok', expires_in: 5184000 })],
      [/graph\.instagram\.com\/v21\.0\/me\/subscribed_apps/, () => json({ success: true })],
      [/graph\.instagram\.com\/v21\.0\/me\?/, () => json({ id: 'app-scoped', user_id: '17841400000000', username: 'sean', account_type: 'BUSINESS' })],
      [/graph\.facebook\.com\/v24\.0\/9876543210\/subscriptions/, () => json({ success: true })],
    ]);
    const state = await createOAuthState(env as never, { p: 'instagram', u: 'a1', r: RETURN_TO });
    const res = await createApp().fetch(
      new Request(`${API}/api/oauth/instagram/callback?code=abc%23_&state=${encodeURIComponent(state)}`),
      env,
    );
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('Location')!);
    expect(loc.origin + loc.pathname).toBe(RETURN_TO);
    expect(loc.searchParams.get('connect')).toBe('instagram');
    expect(loc.searchParams.get('status')).toBe('ok');

    const [acct] = await db.select().from(instagramAccounts);
    expect(acct.instagramAccountId).toBe('17841400000000');
    expect(acct.username).toBe('sean');
    expect(acct.accessToken).toBe('long-tok');
    expect(acct.webhookSubscribed).toBe(1);
    expect(acct.tokenExpiresAt).toBeTruthy();

    // 授權碼結尾的 #_ 會被去掉；App Secret 只送給 Meta。
    const exchange = calls.find((c) => c.url.includes('api.instagram.com'))!;
    expect(new URLSearchParams(exchange.body).get('code')).toBe('abc');
    const webhook = calls.find((c) => c.url.includes('/subscriptions'))!;
    const form = new URLSearchParams(webhook.body);
    expect(form.get('object')).toBe('instagram');
    expect(form.get('callback_url')).toBe(`${API}/functions/v1/api/webhooks/meta/instagram`);
    expect(form.get('verify_token')).toBe('verify-123');

    const status = (await (await call('GET', '/api/admin/connect/status')).json()) as Record<string, unknown>;
    expect(status.instagram).toMatchObject({ username: 'sean', subscribed: true });
    expect((status.webhook as Record<string, unknown>).instagram).toBe('ok');
  });

  it('callback reports Meta errors back to the site in plain words', async () => {
    await saveApp();
    stubMeta([[/api\.instagram\.com/, () => json({ error_message: 'Invalid redirect_uri' }, 400)]]);
    const state = await createOAuthState(env as never, { p: 'instagram', u: 'a1', r: RETURN_TO });
    const res = await createApp().fetch(new Request(`${API}/api/oauth/instagram/callback?code=x&state=${encodeURIComponent(state)}`), env);
    const loc = new URL(res.headers.get('Location')!);
    expect(loc.searchParams.get('status')).toBe('error');
    expect(loc.searchParams.get('message')).toContain('Invalid redirect_uri');
  });

  it('callback handles the user pressing cancel', async () => {
    const state = await createOAuthState(env as never, { p: 'instagram', u: 'a1', r: RETURN_TO });
    const res = await createApp().fetch(
      new Request(`${API}/api/oauth/instagram/callback?error=access_denied&state=${encodeURIComponent(state)}`),
      env,
    );
    expect(new URL(res.headers.get('Location')!).searchParams.get('status')).toBe('cancelled');
  });

  it('rejects forged or login tokens as state, and state tokens cannot be used to log in', async () => {
    const forged = await createApp().fetch(new Request(`${API}/api/oauth/instagram/callback?code=x&state=${encodeURIComponent(token)}`), env);
    expect(forged.status).toBe(400);
    const state = await createOAuthState(env as never, { p: 'instagram', u: 'a1', r: RETURN_TO });
    const asLogin = await createApp().fetch(
      new Request(`${API}/api/admin/auth/me`, { headers: { Authorization: `Bearer ${state}` } }),
      env,
    );
    expect(asLogin.status).toBe(401);
  });
});

describe('Facebook 連結', () => {
  const pagesRoutes = (pages: unknown[]): Array<[RegExp, (url: string, body: string) => Response]> => [
    [/oauth\/access_token\?client_id/, () => json({ access_token: 'user-short' })],
    [/oauth\/access_token\?grant_type=fb_exchange_token/, () => json({ access_token: 'user-long' })],
    [/\/me\/accounts/, () => json({ data: pages })],
    [/\/subscribed_apps/, () => json({ success: true })],
    [/\/subscriptions/, () => json({ success: true })],
  ];

  it('one page: saves the page token and subscribes the page', async () => {
    await saveApp();
    stubMeta(pagesRoutes([{ id: 'page-1', name: '熊恩粉專', access_token: 'page-tok' }]));
    const state = await createOAuthState(env as never, { p: 'facebook', u: 'a1', r: RETURN_TO });
    const res = await createApp().fetch(new Request(`${API}/api/oauth/facebook/callback?code=c&state=${encodeURIComponent(state)}`), env);
    expect(new URL(res.headers.get('Location')!).searchParams.get('status')).toBe('ok');
    expect((await readConfig(db, ['FACEBOOK_PAGE_ACCESS_TOKEN'])).FACEBOOK_PAGE_ACCESS_TOKEN).toBe('page-tok');
    const fb = (await db.select().from(instagramAccounts)).find((a) => a.platform === 'facebook')!;
    expect(fb.instagramAccountId).toBe('page-1');
    expect(fb.webhookSubscribed).toBe(1);
    expect(calls.some((c) => c.url.includes('page-1/subscribed_apps'))).toBe(true);
    const status = (await (await call('GET', '/api/admin/connect/status')).json()) as Record<string, unknown>;
    expect(status.facebook).toMatchObject({ name: '熊恩粉專', subscribed: true });
  });

  it('several pages: asks to choose, lists names without tokens, then saves the chosen one', async () => {
    await saveApp();
    stubMeta(
      pagesRoutes([
        { id: 'p1', name: '粉專一', access_token: 'tok-1' },
        { id: 'p2', name: '粉專二', access_token: 'tok-2' },
      ]),
    );
    const state = await createOAuthState(env as never, { p: 'facebook', u: 'a1', r: RETURN_TO });
    const res = await createApp().fetch(new Request(`${API}/api/oauth/facebook/callback?code=c&state=${encodeURIComponent(state)}`), env);
    expect(new URL(res.headers.get('Location')!).searchParams.get('status')).toBe('choose');
    const list = await (await call('GET', '/api/admin/connect/facebook/pages')).text();
    expect(list).toContain('粉專二');
    expect(list).not.toContain('tok-2');
    const pick = await call('POST', '/api/admin/connect/facebook/select', { pageId: 'p2' });
    expect(pick.status).toBe(200);
    expect((await readConfig(db, ['FACEBOOK_PAGE_ACCESS_TOKEN', 'FB_PAGE_CANDIDATES'])).FACEBOOK_PAGE_ACCESS_TOKEN).toBe('tok-2');
    expect((await readConfig(db, ['FB_PAGE_CANDIDATES'])).FB_PAGE_CANDIDATES).toBeUndefined();
  });

  it('pages under a business portfolio are found through the business', async () => {
    await saveApp();
    stubMeta([
      [/oauth\/access_token\?client_id/, () => json({ access_token: 'user-short' })],
      [/oauth\/access_token\?grant_type=fb_exchange_token/, () => json({ access_token: 'user-long' })],
      [/\/me\/accounts/, () => json({ data: [] })],
      [/\/me\/businesses/, () => json({ data: [{ id: 'biz-1' }] })],
      [/biz-1\/owned_pages/, () => json({ data: [{ id: 'page-b', name: '商家粉專', access_token: 'tok-b' }] })],
      [/biz-1\/client_pages/, () => json({ data: [] })],
      [/\/subscribed_apps/, () => json({ success: true })],
      [/\/subscriptions/, () => json({ success: true })],
    ]);
    const state = await createOAuthState(env as never, { p: 'facebook', u: 'a1', r: RETURN_TO });
    const res = await createApp().fetch(new Request(`${API}/api/oauth/facebook/callback?code=c&state=${encodeURIComponent(state)}`), env);
    expect(new URL(res.headers.get('Location')!).searchParams.get('status')).toBe('ok');
    expect((await readConfig(db, ['FACEBOOK_PAGE_ACCESS_TOKEN'])).FACEBOOK_PAGE_ACCESS_TOKEN).toBe('tok-b');
  });

  it('no pages: names the permissions that were not granted', async () => {
    await saveApp();
    stubMeta([
      ...pagesRoutes([]),
      [/\/me\/businesses/, () => json({ data: [] })],
      [/\/me\/permissions/, () => json({ data: [{ permission: 'pages_messaging', status: 'granted' }, { permission: 'pages_show_list', status: 'declined' }] })],
    ]);
    const state = await createOAuthState(env as never, { p: 'facebook', u: 'a1', r: RETURN_TO });
    const res = await createApp().fetch(new Request(`${API}/api/oauth/facebook/callback?code=c&state=${encodeURIComponent(state)}`), env);
    const msg = new URL(res.headers.get('Location')!).searchParams.get('message')!;
    expect(msg).toContain('pages_show_list');
    expect(msg).not.toContain('pages_messaging');
  });

  it('no pages: explains why', async () => {
    await saveApp();
    stubMeta(pagesRoutes([]));
    const state = await createOAuthState(env as never, { p: 'facebook', u: 'a1', r: RETURN_TO });
    const res = await createApp().fetch(new Request(`${API}/api/oauth/facebook/callback?code=c&state=${encodeURIComponent(state)}`), env);
    const loc = new URL(res.headers.get('Location')!);
    expect(loc.searchParams.get('status')).toBe('error');
    expect(loc.searchParams.get('message')).toContain('粉專');
  });
});
