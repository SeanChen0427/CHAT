// Sean 版（Supabase）：Edge Function「api」的進入點（Deno）。
// 對外網址：https://<專案>.supabase.co/functions/v1/api/...  → Hono 收到的路徑為 /api/...，
// 剛好對上原本的路由（/api/webhooks、/api/admin、/api/internal、/api/health）。
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createApp, type AppBindings } from './app';
import * as schema from './database/schema';
import type { SchemaDb } from './database/types';
import { createJobQueue, runDueJobs } from './queue/jobs';
import { withAppConfig } from './config/app-config';
import { createMemoryRateLimiter } from './security/memory-rate-limiter';
import { ADMIN_API_LIMIT, ADMIN_API_PERIOD_SECONDS } from './security/rate-limit';

declare const Deno: {
  env: { get(name: string): string | undefined; toObject(): Record<string, string> };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const dbUrl = Deno.env.get('SUPABASE_DB_URL');
if (!dbUrl) throw new Error('缺少 SUPABASE_DB_URL');

// Supabase 連線池（transaction 模式）不支援 prepared statements，因此 prepare: false。
const client = postgres(dbUrl, { prepare: false, max: 3, idle_timeout: 20 });
const db = drizzle(client, { schema }) as unknown as SchemaDb;

// 系統自動產生的密鑰（登入簽章、排程密鑰、事件通知驗證碼）由 migration 存在 Supabase Vault，
// 不需要手動設定；若 Edge Function secrets 有同名設定則以 secrets 為準。
const VAULT_KEYS = ['ADMIN_SESSION_SECRET', 'CRON_SECRET', 'WEBHOOK_VERIFY_TOKEN'];
async function loadVaultSecrets(): Promise<Record<string, string>> {
  try {
    const rows = await client<{ name: string; decrypted_secret: string }[]>`
      select name, decrypted_secret from vault.decrypted_secrets where name = any(${VAULT_KEYS})`;
    return Object.fromEntries(rows.map((r) => [r.name, r.decrypted_secret]));
  } catch (e) {
    console.error('[vault] 讀取失敗：', (e as Error)?.name ?? e);
    return {};
  }
}

const vars = Deno.env.toObject();
const supabaseUrl = (vars.SUPABASE_URL ?? '').replace(/\/$/, '');
const env = {
  META_GRAPH_API_VERSION: 'v21.0',
  APP_ENV: 'production',
  LOG_LEVEL: 'info',
  ADMIN_ORIGINS: 'https://seanchen0427.github.io',
  PUBLIC_API_BASE: supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined,
  ...(await loadVaultSecrets()),
  ...Object.fromEntries(Object.entries(vars).filter(([, v]) => v !== '')),
  DB: db,
  ADMIN_RATE_LIMITER: createMemoryRateLimiter(ADMIN_API_LIMIT, ADMIN_API_PERIOD_SECONDS),
} as unknown as AppBindings;

function background(p: Promise<unknown>) {
  const guarded = p.catch((e) => console.error('[jobs] background run failed:', (e as Error)?.name ?? e));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(guarded);
}

// 收到事件後立刻在背景處理一次；沒處理完的由 pg_cron 每分鐘的 /api/internal/tick 補上。
env.COMMENT_QUEUE = createJobQueue(db, () => background(withAppConfig(env).then((e) => runDueJobs(e))));

const app = createApp();
Deno.serve((req) => app.fetch(req, env));
