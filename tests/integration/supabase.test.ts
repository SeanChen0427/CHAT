// Sean 版（Supabase）：跨網域後台（GitHub Pages）所需的 Bearer 權杖、CORS、CSRF 允許來源、
// 內部排程端點的密鑰保護、事件工作從 webhook 入列。
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { adminUsers, eventJobs } from '../../src/database/schema';
import { createJobQueue } from '../../src/queue/jobs';
import { isSameOriginRequest, parseAllowedOrigins } from '../../src/security/csrf';
import { createMemoryRateLimiter } from '../../src/security/memory-rate-limiter';
import { hashPassword } from '../../src/security/password';
import { freshTestDb, type TestDb } from '../helpers/pg';

const PAGES = 'https://seanchen0427.github.io';
// Edge Function 收到的網址路徑以函式名稱開頭（/api/...），不含 /functions/v1。
const API = 'https://ref.supabase.co';

let db: TestDb;
let env: Record<string, unknown>;

beforeEach(async () => {
  db = await freshTestDb();
  env = {
    DB: db,
    ADMIN_SESSION_SECRET: 'test-secret',
    ADMIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ADMIN_ORIGINS: PAGES,
    CRON_SECRET: 'cron-secret-value',
  };
});

async function login(): Promise<string> {
  await db.insert(adminUsers).values({ id: 'a1', email: 'me@example.com', passwordHash: await hashPassword('pw-123456789') });
  const res = await createApp().fetch(
    new Request(`${API}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: PAGES },
      body: JSON.stringify({ email: 'me@example.com', password: 'pw-123456789' }),
    }),
    env,
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { ok: boolean; token: string };
  expect(body.ok).toBe(true);
  expect(body.token.length).toBeGreaterThan(20);
  return body.token;
}

describe('Bearer 權杖登入', () => {
  it('login from the GitHub Pages origin returns a token usable as Authorization: Bearer', async () => {
    const token = await login();
    const me = await createApp().fetch(
      new Request(`${API}/api/admin/auth/me`, { headers: { Authorization: `Bearer ${token}`, Origin: PAGES } }),
      env,
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ email: 'me@example.com' });
  });

  it('rejects requests without a token or with a forged token', async () => {
    const none = await createApp().fetch(new Request(`${API}/api/admin/auth/me`), env);
    expect(none.status).toBe(401);
    const forged = await createApp().fetch(
      new Request(`${API}/api/admin/auth/me`, { headers: { Authorization: 'Bearer a1.9999999999.bad' } }),
      env,
    );
    expect(forged.status).toBe(401);
  });

  it('login from an unlisted origin is blocked by CSRF', async () => {
    const res = await createApp().fetch(
      new Request(`${API}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' },
        body: JSON.stringify({ email: 'x@example.com', password: 'x' }),
      }),
      env,
    );
    expect(res.status).toBe(403);
  });
});

describe('CORS', () => {
  it('answers preflight for the allowed origin', async () => {
    const res = await createApp().fetch(
      new Request(`${API}/api/admin/automations`, {
        method: 'OPTIONS',
        headers: { Origin: PAGES, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
      }),
      env,
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(PAGES);
    expect((res.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase()).toContain('authorization');
  });

  it('does not allow other origins', async () => {
    const res = await createApp().fetch(
      new Request(`${API}/api/admin/automations`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' },
      }),
      env,
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('CSRF 允許來源', () => {
  it('parses ADMIN_ORIGINS into origins and ignores junk', () => {
    expect(parseAllowedOrigins(' https://a.github.io/CHAT/ , nonsense, https://b.test ')).toEqual([
      'https://a.github.io',
      'https://b.test',
    ]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });

  it('allows a listed cross-origin request and still blocks others', () => {
    expect(isSameOriginRequest('POST', PAGES, null, `${API}/api/admin/x`, [PAGES])).toBe(true);
    expect(isSameOriginRequest('POST', 'https://evil.test', null, `${API}/api/admin/x`, [PAGES])).toBe(false);
    expect(isSameOriginRequest('POST', null, null, `${API}/api/admin/x`, [PAGES])).toBe(false);
  });
});

describe('內部排程端點', () => {
  const tick = (auth?: string) =>
    new Request(`${API}/api/internal/tick`, { method: 'POST', headers: auth ? { Authorization: auth } : {} });

  it('rejects missing or wrong secret', async () => {
    expect((await createApp().fetch(tick(), env)).status).toBe(401);
    expect((await createApp().fetch(tick('Bearer wrong'), env)).status).toBe(401);
  });

  it('rejects everything when CRON_SECRET is not configured', async () => {
    const res = await createApp().fetch(tick('Bearer '), { ...env, CRON_SECRET: undefined });
    expect(res.status).toBe(401);
  });

  it('runs due jobs with the correct secret', async () => {
    const res = await createApp().fetch(tick('Bearer cron-secret-value'), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ processed: 0, done: 0, retried: 0, failed: 0 });
  });
});

describe('webhook 寫入事件工作', () => {
  it('stores a pending job and triggers the background hook', async () => {
    let kicked = 0;
    const queue = createJobQueue(db, () => (kicked += 1));
    await queue.send({
      webhookEventId: 'e1',
      eventKey: 'k1',
      instagramAccountId: 'ig',
      instagramMediaId: 'm',
      instagramCommentId: 'c',
    });
    const rows = await db.select().from(eventJobs);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(JSON.parse(rows[0].message).webhookEventId).toBe('e1');
    expect(kicked).toBe(1);
  });
});

describe('記憶體頻率限制', () => {
  it('allows up to the limit per window then blocks, and resets next window', async () => {
    let t = 0;
    const limiter = createMemoryRateLimiter(2, 60, () => t);
    expect((await limiter.limit({ key: 'a' })).success).toBe(true);
    expect((await limiter.limit({ key: 'a' })).success).toBe(true);
    expect((await limiter.limit({ key: 'a' })).success).toBe(false);
    expect((await limiter.limit({ key: 'b' })).success).toBe(true);
    t = 60_000;
    expect((await limiter.limit({ key: 'a' })).success).toBe(true);
  });
});
