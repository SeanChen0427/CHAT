// Sean 版新增：Facebook 粉專的帳號註冊、webhook 訂閱與貼文同步。
//
// 粉專權杖（FACEBOOK_PAGE_ACCESS_TOKEN）本身就能識別粉專：GET /me 回傳粉專 ID 與名稱。
// 訂閱：POST /{page-id}/subscribed_apps，欄位 feed（留言）＋ messages／messaging_postbacks／
// messaging_referrals（Messenger 私訊、按鈕、m.me 連結與廣告）。
// 限制：粉專限時動態沒有回覆事件，因此 Facebook 不支援限動自動私訊。
import { eq } from 'drizzle-orm';
import type { SchemaDb } from '../database/types';
import { instagramAccounts } from '../database/schema';
import type { MetaClient } from './client';
import { accountByPlatform, type AccountRow } from './platform';
import type { RawMediaItem } from './media';


export const FACEBOOK_SUBSCRIBED_FIELDS = 'feed,messages,messaging_postbacks,messaging_referrals';

function describeFailure(res: { status: number; failure?: { metaErrorCode?: string; metaErrorMessage?: string } }) {
  const meta = res.failure?.metaErrorMessage ? `｜Meta 回覆：(代碼 ${res.failure.metaErrorCode ?? '?'}) ${res.failure.metaErrorMessage}` : '';
  return `HTTP ${res.status}${meta}`;
}

// 粉專沒註冊過就用權杖 GET /me 註冊；已註冊則更新名稱與大頭貼。
export async function ensureFacebookPageRegistered(
  db: SchemaDb,
  client: MetaClient,
): Promise<{ account: AccountRow | null; error: string | null }> {
  const res = await client.get<{ id?: string; name?: string; picture?: { data?: { url?: string } } }>('me', {
    fields: 'id,name,picture{url}',
  });
  if (!res.ok || !res.data?.id) {
    return {
      account: await accountByPlatform(db, 'facebook'),
      error: `Facebook 粉專註冊失敗（${describeFailure(res)}）——請確認粉專存取權杖（FACEBOOK_PAGE_ACCESS_TOKEN）是否正確`,
    };
  }
  const now = new Date().toISOString();
  const existing = await accountByPlatform(db, 'facebook');
  if (existing) {
    await db
      .update(instagramAccounts)
      .set({
        instagramAccountId: res.data.id,
        username: res.data.name ?? existing.username,
        profilePictureUrl: res.data.picture?.data?.url ?? existing.profilePictureUrl,
        updatedAt: now,
      })
      .where(eq(instagramAccounts.id, existing.id));
  } else {
    await db
      .insert(instagramAccounts)
      .values({
        id: crypto.randomUUID(),
        instagramAccountId: res.data.id,
        platform: 'facebook',
        username: res.data.name ?? null,
        accountType: 'FACEBOOK_PAGE',
        profilePictureUrl: res.data.picture?.data?.url ?? null,
      })
      .onConflictDoNothing();
  }
  return { account: await accountByPlatform(db, 'facebook'), error: null };
}

// 讓粉專把事件推給本 App（重複呼叫安全）。成功後標記 webhook_subscribed。
export async function subscribeFacebookPage(db: SchemaDb, client: MetaClient, account: AccountRow): Promise<string | null> {
  if (account.webhookSubscribed === 1) return null;
  const res = await client.post<{ success?: boolean | string }>(`${account.instagramAccountId}/subscribed_apps`, {
    subscribed_fields: FACEBOOK_SUBSCRIBED_FIELDS,
  });
  if (!res.ok) return `Facebook 粉專事件通知訂閱失敗（${describeFailure(res)}）`;
  await db
    .update(instagramAccounts)
    .set({ webhookSubscribed: 1, updatedAt: new Date().toISOString() })
    .where(eq(instagramAccounts.id, account.id));
  return null;
}

interface RawFacebookPost {
  id?: string;
  message?: string;
  full_picture?: string;
  permalink_url?: string;
  created_time?: string;
  status_type?: string;
}

// 粉專近期貼文（含影片貼文）。Reels 若不在清單中，第一則留言進來時會由引擎即時補抓。
export async function fetchFacebookPosts(
  client: MetaClient,
  pageId: string,
): Promise<{ ok: boolean; items: RawMediaItem[]; error?: string }> {
  const res = await client.get<{ data?: RawFacebookPost[] }>(`${pageId}/posts`, {
    fields: 'id,message,full_picture,permalink_url,created_time,status_type',
    limit: '50',
  });
  if (!res.ok) return { ok: false, items: [], error: `抓取 Facebook 貼文失敗（${describeFailure(res)}）` };
  const items: RawMediaItem[] = (res.data?.data ?? [])
    .filter((p): p is RawFacebookPost & { id: string } => Boolean(p.id))
    .map((p) => ({
      id: p.id,
      media_type: p.status_type === 'added_video' ? 'FB_VIDEO' : 'FB_POST',
      caption: p.message,
      media_url: p.full_picture,
      permalink: p.permalink_url,
      timestamp: p.created_time,
    }));
  return { ok: true, items };
}
