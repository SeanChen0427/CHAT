// Sean 版新增：Instagram 長效 token 自動續期。
//
// 原版只用 INSTAGRAM_ACCOUNT_ACCESS_TOKEN secret，60 天後到期就整個停擺，而 Worker 無法改寫
// 自己的 secret。因此續期後的新 token 存在 D1（instagram_accounts.access_token），
// 之後所有 Meta 呼叫優先用 D1 的 token，沒有才退回 secret。
//
// 續期 API：GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=…
// 限制：token 至少要發出 24 小時、且尚未過期才能續期；成功回 { access_token, token_type, expires_in }。
import { and, eq } from 'drizzle-orm';
import type { SchemaDb } from '../database/types';
import type { AppBindings } from '../app';
import { auditLogs, instagramAccounts } from '../database/schema';
import { MetaClient } from './client';


const DAY_MS = 24 * 60 * 60 * 1000;
// 剩不到 20 天就續期（留足緩衝：續期失敗時還有將近三週可以人工處理）。
export const REFRESH_WHEN_DAYS_LEFT = 20;
// 兩次續期至少間隔 20 小時（cron 一天跑兩次同步，不需要每次都續）。
const MIN_REFRESH_INTERVAL_MS = 20 * 60 * 60 * 1000;
const REFRESH_URL = 'https://graph.instagram.com/refresh_access_token';

type TokenEnv = Pick<AppBindings, 'INSTAGRAM_ACCOUNT_ACCESS_TOKEN' | 'META_GRAPH_API_VERSION' | 'META_BASE_URL'>;

export async function resolveAccessToken(db: SchemaDb, env: TokenEnv): Promise<string> {
  // 只看 Instagram 帳號（Facebook 粉專權杖另由 FACEBOOK_PAGE_ACCESS_TOKEN 提供，不需續期）。
  const acct = (
    await db
      .select({ accessToken: instagramAccounts.accessToken })
      .from(instagramAccounts)
      .where(eq(instagramAccounts.platform, 'instagram'))
      .limit(1)
  )[0];
  return acct?.accessToken || env.INSTAGRAM_ACCOUNT_ACCESS_TOKEN;
}

export async function createMetaClient(db: SchemaDb, env: TokenEnv): Promise<MetaClient> {
  return new MetaClient({
    accessToken: await resolveAccessToken(db, env),
    graphApiVersion: env.META_GRAPH_API_VERSION,
    baseUrl: env.META_BASE_URL || undefined,
  });
}

export interface RefreshResult {
  refreshed: boolean;
  reason: string;
}

export async function refreshAccessTokenIfDue(
  db: SchemaDb,
  env: TokenEnv,
  opts: { fetchImpl?: typeof fetch; nowMs?: number } = {},
): Promise<RefreshResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const doFetch = opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  const account = (
    await db.select().from(instagramAccounts).where(and(eq(instagramAccounts.platform, 'instagram'))).limit(1)
  )[0];
  if (!account) return { refreshed: false, reason: 'no_account' };

  if (account.tokenRefreshedAt && nowMs - Date.parse(account.tokenRefreshedAt) < MIN_REFRESH_INTERVAL_MS) {
    return { refreshed: false, reason: 'refreshed_recently' };
  }
  // 到期日未知（剛部署、只有 secret）也續一次，取得確切到期日。
  if (account.tokenExpiresAt) {
    const daysLeft = (Date.parse(account.tokenExpiresAt) - nowMs) / DAY_MS;
    if (daysLeft > REFRESH_WHEN_DAYS_LEFT) return { refreshed: false, reason: 'not_due' };
  }

  const current = account.accessToken || env.INSTAGRAM_ACCOUNT_ACCESS_TOKEN;
  const url = `${REFRESH_URL}?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: current })}`;
  let body: { access_token?: string; expires_in?: number; error?: { message?: string; code?: number } } = {};
  let status = 0;
  try {
    const res = await doFetch(url, { method: 'GET' });
    status = res.status;
    body = (await res.json().catch(() => ({}))) as typeof body;
  } catch {
    return logFailure(db, account.id, 'network_error');
  }
  if (status !== 200 || !body.access_token) {
    // 錯誤訊息只留 Meta 的說明與代碼，絕不記錄 token。
    return logFailure(db, account.id, `HTTP ${status} ${body.error?.code ?? ''} ${body.error?.message ?? ''}`.trim());
  }

  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 60 * 24 * 60 * 60;
  const now = new Date(nowMs).toISOString();
  await db
    .update(instagramAccounts)
    .set({
      accessToken: body.access_token,
      tokenExpiresAt: new Date(nowMs + expiresIn * 1000).toISOString(),
      tokenRefreshedAt: now,
      updatedAt: now,
    })
    .where(eq(instagramAccounts.id, account.id));
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    adminUserId: null,
    action: 'system.token_refreshed',
    entityType: 'instagram_accounts',
    entityId: account.id,
    metadata: JSON.stringify({ expiresInDays: Math.round(expiresIn / 86400) }),
  });
  return { refreshed: true, reason: 'ok' };
}

async function logFailure(db: SchemaDb, accountId: string, detail: string): Promise<RefreshResult> {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    adminUserId: null,
    action: 'system.token_refresh_failed',
    entityType: 'instagram_accounts',
    entityId: accountId,
    metadata: JSON.stringify({ detail: detail.slice(0, 300) }),
  });
  return { refreshed: false, reason: detail };
}
