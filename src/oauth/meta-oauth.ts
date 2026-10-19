// Sean 版（一鍵連結）：Instagram／Facebook 的 OAuth 授權流程（與 Meta 溝通的部分）。
//
// Instagram（Instagram 登入版 API，沿用本系統 graph.instagram.com 的呼叫方式）：
//   1. 導向 https://www.instagram.com/oauth/authorize（client_id＝Instagram App ID）
//   2. 回呼帶 code → POST https://api.instagram.com/oauth/access_token 換短效權杖
//   3. GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token 換 60 天長效權杖（之後由 token.ts 自動續期）
//   4. POST /me/subscribed_apps 讓這個帳號把留言、私訊事件送給本 App
// Facebook 粉專：
//   1. 導向 https://www.facebook.com/<版本>/dialog/oauth（client_id＝Meta App ID）
//   2. code → 使用者權杖 → fb_exchange_token 換長效使用者權杖
//   3. GET /me/accounts 取得粉專與粉專權杖（由長效使用者權杖換得的粉專權杖不會過期）
// App 層級的事件通知網址：POST /{META_APP_ID}/subscriptions（object＝instagram／page），
// 用「App ID|App Secret」當權杖。失敗不影響連結，設定精靈會改顯示手動設定步驟。
import type { AppBindings } from '../app';

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
];
export const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_manage_engagement',
  'pages_read_user_content',
  // 粉專放在「商家資產組合」時，/me/accounts 會是空的，要透過商家才讀得到粉專。
  'business_management',
];
export const INSTAGRAM_WEBHOOK_FIELDS = 'comments,messages,messaging_postbacks,messaging_referral';
export const PAGE_WEBHOOK_FIELDS = 'feed,messages,messaging_postbacks,messaging_referrals';

export const DEFAULT_OAUTH_GRAPH_VERSION = 'v24.0';

type Env = Pick<
  AppBindings,
  | 'INSTAGRAM_APP_ID'
  | 'INSTAGRAM_APP_SECRET'
  | 'META_APP_ID'
  | 'META_APP_SECRET'
  | 'META_GRAPH_API_VERSION'
  | 'FACEBOOK_GRAPH_API_VERSION'
  | 'PUBLIC_API_BASE'
>;

export class OAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function fbVersion(env: Env) {
  return env.FACEBOOK_GRAPH_API_VERSION || DEFAULT_OAUTH_GRAPH_VERSION;
}

export function apiBase(env: Env): string {
  const base = (env.PUBLIC_API_BASE ?? '').replace(/\/$/, '');
  if (!base) throw new OAuthError('no_api_base', '系統網址未設定（PUBLIC_API_BASE）');
  return base;
}

export function redirectUri(env: Env, platform: 'instagram' | 'facebook'): string {
  return `${apiBase(env)}/api/oauth/${platform}/callback`;
}

export function instagramAuthorizeUrl(env: Env, state: string): string {
  if (!env.INSTAGRAM_APP_ID) throw new OAuthError('missing_app', '尚未填入 Instagram App ID');
  const q = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID,
    redirect_uri: redirectUri(env, 'instagram'),
    response_type: 'code',
    scope: INSTAGRAM_SCOPES.join(','),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

export function facebookAuthorizeUrl(env: Env, state: string): string {
  if (!env.META_APP_ID) throw new OAuthError('missing_app', '尚未填入 Meta App ID');
  const q = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: redirectUri(env, 'facebook'),
    response_type: 'code',
    scope: FACEBOOK_SCOPES.join(','),
    state,
  });
  return `https://www.facebook.com/${fbVersion(env)}/dialog/oauth?${q}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function metaMessage(body: any): string {
  const m = body?.error?.message ?? body?.error_message ?? body?.error_description ?? '';
  return typeof m === 'string' ? m.slice(0, 200) : '';
}

export interface InstagramTokenResult {
  accessToken: string;
  expiresAt: string | null;
}

export async function exchangeInstagramCode(env: Env, code: string): Promise<InstagramTokenResult> {
  if (!env.INSTAGRAM_APP_ID || !env.INSTAGRAM_APP_SECRET) {
    throw new OAuthError('missing_app', '尚未填入 Instagram App ID／App Secret');
  }
  const form = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID,
    client_secret: env.INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(env, 'instagram'),
    code,
  });
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const body = await readJson(res);
  // 新版回 { data: [{ access_token, user_id }] }，舊版直接 { access_token, user_id }。
  const short = body?.data?.[0]?.access_token ?? body?.access_token;
  if (!res.ok || typeof short !== 'string') {
    throw new OAuthError('exchange_failed', `Instagram 授權碼換權杖失敗：${metaMessage(body) || `HTTP ${res.status}`}`);
  }
  const q = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: env.INSTAGRAM_APP_SECRET,
    access_token: short,
  });
  const longRes = await fetch(`https://graph.instagram.com/access_token?${q}`);
  const longBody = await readJson(longRes);
  if (!longRes.ok || typeof longBody?.access_token !== 'string') {
    throw new OAuthError('exchange_failed', `Instagram 換長效權杖失敗：${metaMessage(longBody) || `HTTP ${longRes.status}`}`);
  }
  const expiresIn = Number(longBody.expires_in);
  return {
    accessToken: longBody.access_token,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
  };
}

export interface InstagramProfile {
  id: string; // 帳號 ID（事件通知的 entry.id）
  username: string | null;
  accountType: string | null;
  profilePictureUrl: string | null;
}

export async function fetchInstagramProfile(env: Env, token: string): Promise<InstagramProfile> {
  const q = new URLSearchParams({ fields: 'id,user_id,username,account_type,profile_picture_url', access_token: token });
  const res = await fetch(`https://graph.instagram.com/${env.META_GRAPH_API_VERSION || 'v21.0'}/me?${q}`);
  const body = await readJson(res);
  if (!res.ok || !(body?.user_id || body?.id)) {
    throw new OAuthError('profile_failed', `讀取 Instagram 帳號資料失敗：${metaMessage(body) || `HTTP ${res.status}`}`);
  }
  return {
    // user_id 是專業帳號 ID（事件通知用這個）；沒有時退回 id。
    id: String(body.user_id ?? body.id),
    username: body.username ?? null,
    accountType: body.account_type ?? null,
    profilePictureUrl: body.profile_picture_url ?? null,
  };
}

export async function subscribeInstagramAccount(env: Env, token: string): Promise<string | null> {
  const form = new URLSearchParams({ subscribed_fields: INSTAGRAM_WEBHOOK_FIELDS, access_token: token });
  const res = await fetch(`https://graph.instagram.com/${env.META_GRAPH_API_VERSION || 'v21.0'}/me/subscribed_apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (res.ok) return null;
  return `Instagram 帳號事件通知訂閱失敗：${metaMessage(await readJson(res)) || `HTTP ${res.status}`}`;
}

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  pictureUrl: string | null;
}

export async function exchangeFacebookCode(env: Env, code: string): Promise<FacebookPage[]> {
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    throw new OAuthError('missing_app', '尚未填入 Meta App ID／App Secret');
  }
  const base = `https://graph.facebook.com/${fbVersion(env)}`;
  const q1 = new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: redirectUri(env, 'facebook'),
    code,
  });
  const r1 = await fetch(`${base}/oauth/access_token?${q1}`);
  const b1 = await readJson(r1);
  if (!r1.ok || typeof b1?.access_token !== 'string') {
    throw new OAuthError('exchange_failed', `Facebook 授權碼換權杖失敗：${metaMessage(b1) || `HTTP ${r1.status}`}`);
  }
  const q2 = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: b1.access_token,
  });
  const r2 = await fetch(`${base}/oauth/access_token?${q2}`);
  const b2 = await readJson(r2);
  if (!r2.ok || typeof b2?.access_token !== 'string') {
    throw new OAuthError('exchange_failed', `Facebook 換長效權杖失敗：${metaMessage(b2) || `HTTP ${r2.status}`}`);
  }
  const token = b2.access_token as string;
  const fields = 'id,name,access_token,picture{url}';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toPages = (list: any): FacebookPage[] =>
    (Array.isArray(list) ? list : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => typeof p?.id === 'string' && typeof p?.access_token === 'string')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({ id: p.id, name: p.name ?? p.id, accessToken: p.access_token, pictureUrl: p.picture?.data?.url ?? null }));

  const r3 = await fetch(`${base}/me/accounts?${new URLSearchParams({ fields, limit: '100', access_token: token })}`);
  const b3 = await readJson(r3);
  if (!r3.ok || !Array.isArray(b3?.data)) {
    throw new OAuthError('pages_failed', `讀取粉專清單失敗：${metaMessage(b3) || `HTTP ${r3.status}`}`);
  }
  const pages = new Map(toPages(b3.data).map((p) => [p.id, p]));

  // Sean 版：粉專在商家資產組合（Business）底下時，個人的粉專清單是空的，改從商家擁有／代管的粉專找。
  if (pages.size === 0) {
    const rb = await fetch(`${base}/me/businesses?${new URLSearchParams({ fields: 'id', limit: '50', access_token: token })}`);
    const bb = await readJson(rb);
    for (const biz of Array.isArray(bb?.data) ? bb.data : []) {
      for (const edge of ['owned_pages', 'client_pages']) {
        const re = await fetch(`${base}/${biz.id}/${edge}?${new URLSearchParams({ fields, limit: '100', access_token: token })}`);
        for (const p of toPages((await readJson(re))?.data)) pages.set(p.id, p);
      }
    }
  }

  if (pages.size === 0) {
    // 找不到粉專時，列出沒被允許的權限，讓使用者知道授權畫面要勾什麼。
    const rp = await fetch(`${base}/me/permissions?${new URLSearchParams({ access_token: token })}`);
    const bp = await readJson(rp);
    const granted = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Array.isArray(bp?.data) ? bp.data : []).filter((x: any) => x?.status === 'granted').map((x: any) => x.permission),
    );
    const missing = ['pages_show_list', 'pages_messaging', 'business_management'].filter((x) => !granted.has(x));
    throw new OAuthError(
      'no_pages',
      missing.length
        ? `找不到可管理的粉專：授權時沒有允許 ${missing.join('、')}。請再按一次連結，授權畫面選「編輯存取權限」，勾選你的粉專與商家資產組合，並允許所有權限`
        : '找不到可管理的粉專：請確認登入的 Facebook 帳號是粉專管理員，授權畫面選「編輯存取權限」並勾選你的粉專',
    );
  }
  return [...pages.values()];
}

// App 層級的事件通知設定（回呼網址＋驗證權杖＋訂閱欄位）。回傳 null 表示成功，否則為錯誤說明。
export async function configureAppWebhook(
  env: Env & { WEBHOOK_VERIFY_TOKEN?: string },
  object: 'instagram' | 'page',
): Promise<string | null> {
  if (!env.META_APP_ID || !env.META_APP_SECRET) return '尚未填入 Meta App ID／App Secret，無法自動設定事件通知';
  if (!env.WEBHOOK_VERIFY_TOKEN) return '系統驗證權杖未設定';
  const form = new URLSearchParams({
    object,
    callback_url: `${apiBase(env)}/api/webhooks/meta/instagram`,
    verify_token: env.WEBHOOK_VERIFY_TOKEN,
    fields: object === 'instagram' ? INSTAGRAM_WEBHOOK_FIELDS : PAGE_WEBHOOK_FIELDS,
    include_values: 'true',
    access_token: `${env.META_APP_ID}|${env.META_APP_SECRET}`,
  });
  try {
    const res = await fetch(`https://graph.facebook.com/${fbVersion(env)}/${env.META_APP_ID}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (res.ok) return null;
    return `自動設定事件通知失敗：${metaMessage(await readJson(res)) || `HTTP ${res.status}`}`;
  } catch {
    return '自動設定事件通知失敗：連不到 Meta';
  }
}
