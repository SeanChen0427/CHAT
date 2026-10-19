// Sean 版新增：Instagram／Facebook 雙平台的 client 與帳號選擇。
//
// - Instagram：graph.instagram.com＋Instagram 使用者權杖（上游原本的路徑，含自動續期）。
// - Facebook：graph.facebook.com＋粉專權杖（FACEBOOK_PAGE_ACCESS_TOKEN）。
// 兩者的留言私訊（recipient.comment_id）、私訊（recipient.id）、按鈕範本格式相同，
// 差異只在 base URL、權杖與少數端點（公開回覆、使用者資料、貼文清單）。
import { and, eq } from 'drizzle-orm';
import type { SchemaDb } from '../database/types';
import type { AppBindings } from '../app';
import { instagramAccounts, type Platform } from '../database/schema';
import { MetaClient } from './client';
import { createMetaClient } from './token';

export type AccountRow = typeof instagramAccounts.$inferSelect;

export const DEFAULT_FACEBOOK_GRAPH_VERSION = 'v24.0';

export function asPlatform(v: unknown): Platform {
  return v === 'facebook' ? 'facebook' : 'instagram';
}

export function createFacebookClient(
  env: Pick<AppBindings, 'FACEBOOK_PAGE_ACCESS_TOKEN' | 'FACEBOOK_GRAPH_API_VERSION'>,
): MetaClient | null {
  const token = env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return new MetaClient({
    accessToken: token,
    graphApiVersion: env.FACEBOOK_GRAPH_API_VERSION || DEFAULT_FACEBOOK_GRAPH_VERSION,
    baseUrl: 'https://graph.facebook.com',
  });
}

export interface PlatformClients {
  metaClient: MetaClient; // Instagram（沿用上游欄位名，測試與既有程式不必改）
  facebookClient?: MetaClient | null;
}

export async function createPlatformClients(db: SchemaDb, env: AppBindings): Promise<PlatformClients> {
  return { metaClient: await createMetaClient(db, env), facebookClient: createFacebookClient(env) };
}

export function clientFor(deps: PlatformClients, platform: string | null | undefined): MetaClient | null {
  return platform === 'facebook' ? (deps.facebookClient ?? null) : deps.metaClient;
}

export async function accountByPlatform(db: SchemaDb, platform: Platform): Promise<AccountRow | null> {
  const rows = await db.select().from(instagramAccounts).where(eq(instagramAccounts.platform, platform)).limit(1);
  return rows[0] ?? null;
}

// webhook entry.id（IG 帳號 ID 或粉專 ID）對應的帳號；找不到時退回同平台的唯一帳號。
export async function accountForWebhook(db: SchemaDb, externalId: string, platform: Platform): Promise<AccountRow | null> {
  const rows = await db
    .select()
    .from(instagramAccounts)
    .where(and(eq(instagramAccounts.instagramAccountId, externalId), eq(instagramAccounts.platform, platform)))
    .limit(1);
  return rows[0] ?? (await accountByPlatform(db, platform));
}
