// Sean 版：token 自動續期。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../src/database/schema';
import { refreshAccessTokenIfDue, resolveAccessToken } from '../../src/meta/token';
import { freshTestDb } from '../helpers/pg';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
const env = { INSTAGRAM_ACCOUNT_ACCESS_TOKEN: 'SECRET_TOKEN', META_GRAPH_API_VERSION: 'v21.0' };
const DAY = 86400000;
const NOW = Date.parse('2026-10-19T00:00:00Z');

function okFetch(token = 'NEW_TOKEN') {
  return vi.fn(async () =>
    new Response(JSON.stringify({ access_token: token, token_type: 'bearer', expires_in: 5184000 }), { status: 200 }),
  ) as unknown as typeof fetch;
}
const calledUrl = (f: typeof fetch) => String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);

beforeEach(async () => {
  const sqlite = await freshTestDb();
  db = sqlite;
  await db.insert(schema.instagramAccounts).values({ id: 'acct', instagramAccountId: 'ig' });
});

const account = async () => (await db.select().from(schema.instagramAccounts))[0];

describe('token auto-refresh', () => {
  it('uses the secret until a refreshed token exists', async () => {
    expect(await resolveAccessToken(db, env)).toBe('SECRET_TOKEN');
    await db.update(schema.instagramAccounts).set({ accessToken: 'DB_TOKEN' });
    expect(await resolveAccessToken(db, env)).toBe('DB_TOKEN');
  });

  it('refreshes when the expiry is unknown and stores token + expiry + audit log', async () => {
    const f = okFetch();
    const r = await refreshAccessTokenIfDue(db, env, { fetchImpl: f, nowMs: NOW });
    expect(r.refreshed).toBe(true);
    expect(calledUrl(f)).toContain('grant_type=ig_refresh_token');
    expect(calledUrl(f)).toContain('access_token=SECRET_TOKEN');
    const a = await account();
    expect(a.accessToken).toBe('NEW_TOKEN');
    expect(Date.parse(a.tokenExpiresAt) - NOW).toBe(60 * DAY);
    const logs = await db.select().from(schema.auditLogs);
    expect(logs.map((l: { action: string }) => l.action)).toEqual(['system.token_refreshed']);
    expect(JSON.stringify(logs)).not.toContain('NEW_TOKEN');
  });

  it('does not refresh when more than 20 days remain, or when refreshed in the last 20 hours', async () => {
    await db.update(schema.instagramAccounts).set({ tokenExpiresAt: new Date(NOW + 30 * DAY).toISOString() });
    const f = okFetch();
    expect((await refreshAccessTokenIfDue(db, env, { fetchImpl: f, nowMs: NOW })).reason).toBe('not_due');

    await db.update(schema.instagramAccounts).set({
      tokenExpiresAt: new Date(NOW + 5 * DAY).toISOString(),
      tokenRefreshedAt: new Date(NOW - 2 * 3600000).toISOString(),
    });
    expect((await refreshAccessTokenIfDue(db, env, { fetchImpl: f, nowMs: NOW })).reason).toBe('refreshed_recently');
    expect(f).not.toHaveBeenCalled();
  });

  it('refreshes the stored token when fewer than 20 days remain', async () => {
    await db.update(schema.instagramAccounts).set({
      accessToken: 'OLD_DB_TOKEN',
      tokenExpiresAt: new Date(NOW + 10 * DAY).toISOString(),
    });
    const f = okFetch('NEWER');
    expect((await refreshAccessTokenIfDue(db, env, { fetchImpl: f, nowMs: NOW })).refreshed).toBe(true);
    expect(calledUrl(f)).toContain('access_token=OLD_DB_TOKEN');
    expect((await account()).accessToken).toBe('NEWER');
  });

  it('a failed refresh keeps the old token and writes an audit log without the token', async () => {
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'Session has expired', code: 190 } }), { status: 400 }),
    ) as unknown as typeof fetch;
    const r = await refreshAccessTokenIfDue(db, env, { fetchImpl: f, nowMs: NOW });
    expect(r.refreshed).toBe(false);
    expect((await account()).accessToken).toBeNull();
    const logs = await db.select().from(schema.auditLogs);
    expect(logs[0].action).toBe('system.token_refresh_failed');
    expect(logs[0].metadata).toContain('Session has expired');
    expect(logs[0].metadata).not.toContain('SECRET_TOKEN');
  });
});
