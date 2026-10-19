// Sean 版（一鍵連結）：設定精靈的 API 與 OAuth 回呼。
//
// 後台（需登入）：/api/admin/connect/...
//   GET  /status              精靈需要的所有狀態（不回傳任何密鑰或權杖）
//   PUT  /app                 存 Instagram App ID／Secret、Meta App ID／Secret
//   POST /instagram/start     取得 Instagram 授權網址
//   POST /facebook/start      取得 Facebook 授權網址
//   GET  /facebook/pages      多個粉專時列出名稱供選擇
//   POST /facebook/select     選定粉專
//   POST /webhooks/retry      重新自動設定事件通知
// 公開：/api/oauth/{instagram|facebook}/callback（Meta 導回，用簽章過的 state 防偽造）
import { count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppBindings } from '../app';
import { readConfig, writeConfig } from '../config/app-config';
import { automations, instagramAccounts } from '../database/schema';
import type { SchemaDb } from '../database/types';
import { subscribeFacebookPage } from '../meta/facebook';
import { accountByPlatform, createFacebookClient } from '../meta/platform';
import {
  configureAppWebhook,
  exchangeFacebookCode,
  exchangeInstagramCode,
  facebookAuthorizeUrl,
  fetchInstagramProfile,
  instagramAuthorizeUrl,
  OAuthError,
  redirectUri,
  subscribeInstagramAccount,
  type FacebookPage,
} from '../oauth/meta-oauth';
import { csrfMiddleware, parseAllowedOrigins } from '../security/csrf';
import { adminApiRateLimitMiddleware } from '../security/rate-limit';
import { createSessionCookie, verifySessionCookie } from '../security/session';
import { requireAdminAuth } from './auth';

type Platform = 'instagram' | 'facebook';
const STATE_TTL_SECONDS = 15 * 60;

// state 用與登入不同的金鑰簽章，避免被拿去當登入權杖使用。
const stateKey = (env: AppBindings) => `${env.ADMIN_SESSION_SECRET}:oauth-state`;

function b64url(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function unb64url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

interface StatePayload {
  p: Platform;
  u: string; // adminUserId
  r: string; // 完成後導回的後台網址
}

export async function createOAuthState(env: AppBindings, payload: StatePayload): Promise<string> {
  return createSessionCookie(stateKey(env), b64url(JSON.stringify(payload)), STATE_TTL_SECONDS);
}

export async function readOAuthState(env: AppBindings, state: string | undefined): Promise<StatePayload | null> {
  const v = await verifySessionCookie(stateKey(env), state);
  if (!v.valid) return null;
  try {
    const p = JSON.parse(unb64url(v.payload.sub)) as StatePayload;
    return p && (p.p === 'instagram' || p.p === 'facebook') && typeof p.r === 'string' ? p : null;
  } catch {
    return null;
  }
}

// 導回網址只允許 ADMIN_ORIGINS 內的網站。
function safeReturnTo(env: AppBindings, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return parseAllowedOrigins(env.ADMIN_ORIGINS).includes(u.origin) ? u.toString() : null;
  } catch {
    return null;
  }
}

function backTo(returnTo: string, platform: Platform, status: string, message?: string): string {
  const u = new URL(returnTo);
  u.searchParams.set('connect', platform);
  u.searchParams.set('status', status);
  if (message) u.searchParams.set('message', message.slice(0, 300));
  return u.toString();
}

// ---- 連結後的資料寫入 ----

export async function saveInstagramConnection(
  db: SchemaDb,
  profile: { id: string; username: string | null; accountType: string | null; profilePictureUrl: string | null },
  token: { accessToken: string; expiresAt: string | null },
  subscribed: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const values = {
    instagramAccountId: profile.id,
    username: profile.username,
    accountType: profile.accountType,
    profilePictureUrl: profile.profilePictureUrl,
    accessToken: token.accessToken,
    tokenExpiresAt: token.expiresAt,
    tokenRefreshedAt: now,
    webhookSubscribed: subscribed ? 1 : 0,
    circuitBreakerStatus: 'closed',
    updatedAt: now,
  };
  const existing = await accountByPlatform(db, 'instagram');
  if (existing) {
    await db.update(instagramAccounts).set(values).where(eq(instagramAccounts.id, existing.id));
  } else {
    await db.insert(instagramAccounts).values({ id: crypto.randomUUID(), platform: 'instagram', ...values });
  }
}

export async function saveFacebookConnection(env: AppBindings, page: FacebookPage): Promise<string | null> {
  const db = env.DB;
  const now = new Date().toISOString();
  await writeConfig(db, { FACEBOOK_PAGE_ACCESS_TOKEN: page.accessToken, FB_PAGE_CANDIDATES: null });
  const values = {
    instagramAccountId: page.id,
    username: page.name,
    accountType: 'FACEBOOK_PAGE',
    profilePictureUrl: page.pictureUrl,
    webhookSubscribed: 0,
    circuitBreakerStatus: 'closed',
    updatedAt: now,
  };
  const existing = await accountByPlatform(db, 'facebook');
  if (existing) {
    await db.update(instagramAccounts).set(values).where(eq(instagramAccounts.id, existing.id));
  } else {
    await db.insert(instagramAccounts).values({ id: crypto.randomUUID(), platform: 'facebook', ...values });
  }
  const account = await accountByPlatform(db, 'facebook');
  const client = createFacebookClient({ ...env, FACEBOOK_PAGE_ACCESS_TOKEN: page.accessToken });
  const subscribeError = account && client ? await subscribeFacebookPage(db, client, account) : '粉專資料寫入失敗';
  const webhookError = await configureAppWebhook({ ...env }, 'page');
  await writeConfig(db, { WEBHOOK_STATUS_PAGE: webhookError ?? 'ok' });
  return subscribeError;
}

// ---- 後台 API ----

export function createConnectRoutes() {
  const app = new Hono<{ Bindings: AppBindings; Variables: { adminUserId: string } }>();
  app.use('*', requireAdminAuth(), adminApiRateLimitMiddleware());

  app.get('/status', async (c) => {
    const env = c.env;
    const db = env.DB;
    const cfg = await readConfig(db, ['FB_PAGE_CANDIDATES', 'WEBHOOK_STATUS_INSTAGRAM', 'WEBHOOK_STATUS_PAGE']);
    const ig = await accountByPlatform(db, 'instagram');
    const fb = await accountByPlatform(db, 'facebook');
    const igToken = Boolean(ig?.accessToken || env.INSTAGRAM_ACCOUNT_ACCESS_TOKEN?.trim());
    const fbToken = Boolean(env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim());
    const [{ n }] = await db.select({ n: count() }).from(automations);
    const base = (env.PUBLIC_API_BASE ?? '').replace(/\/$/, '');
    let redirect: { instagram: string | null; facebook: string | null } = { instagram: null, facebook: null };
    try {
      redirect = { instagram: redirectUri(env, 'instagram'), facebook: redirectUri(env, 'facebook') };
    } catch {
      /* 沒有 PUBLIC_API_BASE 時維持 null */
    }
    return c.json({
      app: {
        instagramAppId: env.INSTAGRAM_APP_ID ?? null,
        hasInstagramAppSecret: Boolean(env.INSTAGRAM_APP_SECRET?.trim()),
        metaAppId: env.META_APP_ID ?? null,
        hasMetaAppSecret: Boolean(env.META_APP_SECRET?.trim()),
      },
      redirectUris: redirect,
      callbackUrl: base ? `${base}/api/webhooks/meta/instagram` : null,
      verifyToken: env.WEBHOOK_VERIFY_TOKEN ?? null,
      instagram:
        ig && igToken
          ? {
              username: ig.username,
              profilePictureUrl: ig.profilePictureUrl,
              subscribed: ig.webhookSubscribed === 1,
              tokenExpiresAt: ig.tokenExpiresAt,
            }
          : null,
      facebook: fb && fbToken ? { name: fb.username, profilePictureUrl: fb.profilePictureUrl, subscribed: fb.webhookSubscribed === 1 } : null,
      pendingPageChoice: Boolean(cfg.FB_PAGE_CANDIDATES),
      webhook: { instagram: cfg.WEBHOOK_STATUS_INSTAGRAM ?? null, page: cfg.WEBHOOK_STATUS_PAGE ?? null },
      automationCount: Number(n),
    });
  });

  app.put('/app', csrfMiddleware(), async (c) => {
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: '請求格式錯誤' }, 400);
    }
    const clean = (v: unknown, pattern: RegExp, label: string): string | undefined | Error => {
      if (v === undefined || v === null || v === '') return undefined;
      if (typeof v !== 'string') return new Error(`${label}格式不正確`);
      const t = v.trim();
      return pattern.test(t) ? t : new Error(`${label}格式不正確，請確認是否複製完整（不要含空白或其他文字）`);
    };
    const fields = {
      INSTAGRAM_APP_ID: clean(body.instagramAppId, /^\d{5,25}$/, 'Instagram App ID '),
      INSTAGRAM_APP_SECRET: clean(body.instagramAppSecret, /^[0-9a-f]{16,64}$/i, 'Instagram App Secret '),
      META_APP_ID: clean(body.metaAppId, /^\d{5,25}$/, 'Meta App ID '),
      META_APP_SECRET: clean(body.metaAppSecret, /^[0-9a-f]{16,64}$/i, 'Meta App Secret '),
    };
    for (const v of Object.values(fields)) if (v instanceof Error) return c.json({ error: v.message }, 400);
    await writeConfig(c.env.DB, fields as Record<keyof typeof fields, string | undefined>);
    return c.json({ ok: true });
  });

  for (const platform of ['instagram', 'facebook'] as const) {
    app.post(`/${platform}/start`, csrfMiddleware(), async (c) => {
      let body: { returnTo?: unknown } = {};
      try {
        body = await c.req.json();
      } catch {
        /* 允許空 body */
      }
      const returnTo = safeReturnTo(c.env, body.returnTo);
      if (!returnTo) return c.json({ error: '導回網址不在允許清單內' }, 400);
      try {
        const state = await createOAuthState(c.env, { p: platform, u: c.get('adminUserId'), r: returnTo });
        const url = platform === 'instagram' ? instagramAuthorizeUrl(c.env, state) : facebookAuthorizeUrl(c.env, state);
        return c.json({ url });
      } catch (e) {
        if (e instanceof OAuthError) return c.json({ error: e.message }, 400);
        throw e;
      }
    });
  }

  app.get('/facebook/pages', async (c) => {
    const cfg = await readConfig(c.env.DB, ['FB_PAGE_CANDIDATES']);
    const pages = cfg.FB_PAGE_CANDIDATES ? (JSON.parse(cfg.FB_PAGE_CANDIDATES) as FacebookPage[]) : [];
    return c.json({ pages: pages.map((p) => ({ id: p.id, name: p.name, pictureUrl: p.pictureUrl })) });
  });

  app.post('/facebook/select', csrfMiddleware(), async (c) => {
    let body: { pageId?: unknown } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: '請求格式錯誤' }, 400);
    }
    const cfg = await readConfig(c.env.DB, ['FB_PAGE_CANDIDATES']);
    const pages = cfg.FB_PAGE_CANDIDATES ? (JSON.parse(cfg.FB_PAGE_CANDIDATES) as FacebookPage[]) : [];
    const page = pages.find((p) => p.id === body.pageId);
    if (!page) return c.json({ error: '找不到這個粉專，請重新連結 Facebook' }, 404);
    const error = await saveFacebookConnection(c.env, page);
    return c.json({ ok: true, warning: error });
  });

  app.post('/webhooks/retry', csrfMiddleware(), async (c) => {
    const ig = await accountByPlatform(c.env.DB, 'instagram');
    const fb = await accountByPlatform(c.env.DB, 'facebook');
    const result: Record<string, string> = {};
    if (ig) result.WEBHOOK_STATUS_INSTAGRAM = (await configureAppWebhook(c.env, 'instagram')) ?? 'ok';
    if (fb) result.WEBHOOK_STATUS_PAGE = (await configureAppWebhook(c.env, 'page')) ?? 'ok';
    await writeConfig(c.env.DB, result);
    return c.json({ ok: true, ...result });
  });

  return app;
}

// ---- OAuth 回呼（公開） ----

export function createOAuthCallbackRoutes() {
  const app = new Hono<{ Bindings: AppBindings }>();

  app.get('/instagram/callback', async (c) => {
    const state = await readOAuthState(c.env, c.req.query('state'));
    if (!state || state.p !== 'instagram') return c.text('連結逾時或網址無效，請回到後台重新按「連結 Instagram」。', 400);
    if (c.req.query('error')) return c.redirect(backTo(state.r, 'instagram', 'cancelled'), 302);
    const code = c.req.query('code');
    if (!code) return c.redirect(backTo(state.r, 'instagram', 'error', 'Meta 沒有回傳授權碼'), 302);
    try {
      const token = await exchangeInstagramCode(c.env, code.replace(/#_$/, ''));
      const profile = await fetchInstagramProfile(c.env, token.accessToken);
      const subscribeError = await subscribeInstagramAccount(c.env, token.accessToken);
      await saveInstagramConnection(c.env.DB, profile, token, !subscribeError);
      const webhookError = await configureAppWebhook(c.env, 'instagram');
      await writeConfig(c.env.DB, { WEBHOOK_STATUS_INSTAGRAM: webhookError ?? 'ok' });
      return c.redirect(backTo(state.r, 'instagram', subscribeError ? 'warning' : 'ok', subscribeError ?? undefined), 302);
    } catch (e) {
      const message = e instanceof OAuthError ? e.message : '連結過程發生錯誤，請再試一次';
      return c.redirect(backTo(state.r, 'instagram', 'error', message), 302);
    }
  });

  app.get('/facebook/callback', async (c) => {
    const state = await readOAuthState(c.env, c.req.query('state'));
    if (!state || state.p !== 'facebook') return c.text('連結逾時或網址無效，請回到後台重新按「連結 Facebook」。', 400);
    if (c.req.query('error')) return c.redirect(backTo(state.r, 'facebook', 'cancelled'), 302);
    const code = c.req.query('code');
    if (!code) return c.redirect(backTo(state.r, 'facebook', 'error', 'Meta 沒有回傳授權碼'), 302);
    try {
      const pages = await exchangeFacebookCode(c.env, code);
      if (pages.length === 0) {
        return c.redirect(
          backTo(state.r, 'facebook', 'error', '這個 Facebook 帳號沒有可管理的粉專，或授權時沒有勾選粉專'),
          302,
        );
      }
      if (pages.length > 1) {
        await writeConfig(c.env.DB, { FB_PAGE_CANDIDATES: JSON.stringify(pages) });
        return c.redirect(backTo(state.r, 'facebook', 'choose'), 302);
      }
      const warning = await saveFacebookConnection(c.env, pages[0]);
      return c.redirect(backTo(state.r, 'facebook', warning ? 'warning' : 'ok', warning ?? undefined), 302);
    } catch (e) {
      const message = e instanceof OAuthError ? e.message : '連結過程發生錯誤，請再試一次';
      return c.redirect(backTo(state.r, 'facebook', 'error', message), 302);
    }
  });

  return app;
}
