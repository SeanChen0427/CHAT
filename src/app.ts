import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sql } from 'drizzle-orm';
import { parseAllowedOrigins } from './security/csrf';
import { createAdminRoutes } from './admin/routes';
import type { SchemaDb } from './database/types';
import type { EventQueue } from './queue/producer';
import { createInternalRoutes } from './internal/routes';
import { renderPrivacyHtml } from './privacy';
import { createWebhookRoutes } from './webhook/routes';

// 頻率限制器介面（Sean 版 Supabase：由 src/security/memory-rate-limiter.ts 提供記憶體實作）。
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type AppBindings = {
  // Sean 版（Supabase）：DB 直接是 drizzle（Postgres）實例；佇列改為 event_jobs 資料表。
  DB: SchemaDb;
  COMMENT_QUEUE: EventQueue;
  ADMIN_RATE_LIMITER: RateLimiter;
  // 逗號分隔的後台網址來源（GitHub Pages），供 CORS 與 CSRF 檢查。
  ADMIN_ORIGINS?: string;
  // pg_cron 呼叫內部排程端點時帶的密鑰（Authorization: Bearer）。
  CRON_SECRET?: string;
  // API 對外網址（例：https://xxxx.supabase.co/functions/v1），後台「Meta 串接資訊」顯示用。
  PUBLIC_API_BASE?: string;
  INSTAGRAM_APP_SECRET: string;
  WEBHOOK_VERIFY_TOKEN: string;
  INSTAGRAM_ACCOUNT_ACCESS_TOKEN: string;
  // ---- Sean 版新增：Facebook 粉專（選填；未設定時只跑 Instagram）----
  // 粉專存取權杖（由長效使用者權杖換得的粉專權杖不會過期）。
  FACEBOOK_PAGE_ACCESS_TOKEN?: string;
  // Meta App 的應用程式密鑰：粉專 webhook 用它簽章（Instagram 登入版用的是 Instagram App Secret）。
  META_APP_SECRET?: string;
  FACEBOOK_GRAPH_API_VERSION?: string;
  ADMIN_SESSION_SECRET: string;
  META_GRAPH_API_VERSION: string;
  META_BASE_URL?: string;
  APP_ENV: string;
  // 隱私政策頁的自訂聯絡方式（選填，純文字）。未設定時顯示通用文字，不點名任何身分。
  PRIVACY_CONTACT?: string;
  LOG_LEVEL: string;
};

export function createApp() {
  const app = new Hono<{ Bindings: AppBindings }>();

  // Sean 版（Supabase）：根路徑導向 GitHub Pages 上的後台（未設定時回簡短說明）。
  app.get('/', (c) => {
    const first = (c.env.ADMIN_ORIGINS ?? '').split(',')[0]?.trim();
    if (first) return c.redirect(first.replace(/\/$/, '') + '/CHAT/', 302);
    return c.text('IG／FB 自動私訊 API 運作中', 200);
  });

  // Sean 版（Supabase）：後台在 GitHub Pages，跨網域呼叫 /api/admin 需要 CORS（以 Bearer 權杖驗證，不帶 Cookie）。
  app.use('/api/admin/*', async (c, next) => {
    const allowed = parseAllowedOrigins(c.env.ADMIN_ORIGINS);
    return cors({
      origin: (origin) => (allowed.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Disposition'],
      maxAge: 600,
    })(c, next);
  });

  // 健康檢查。Sean 版（Supabase）：順便查一次資料庫，讓每日保持運作的排程也算到資料庫活動。
  app.get('/api/health', async (c) => {
    try {
      await c.env.DB.execute(sql`select 1`);
      return c.json({ status: 'ok' });
    } catch {
      return c.json({ status: 'degraded' }, 503);
    }
  });

  // 隱私政策頁（Meta App 上線審核要求提供公開網址）。
  // 聯絡方式預設只顯示通用文字，「不」點名任何身分：
  // - 管理者 Email 是登入憑證的一半，公開等於送攻擊者半組帳密、也成為釣魚目標。
  // - IG 帳號名會讓任何知道網址的訪客把這個部署連結到你的身分；而真正需要
  //   聯絡的人（收到私訊的留言者）本來就知道帳號是誰，不需要在此點名。
  // 部署者想提供具體聯絡管道時，設定 PRIVACY_CONTACT 變數（純文字，會做 HTML escape）。
  app.get('/privacy', (c) => c.html(renderPrivacyHtml(c.env.PRIVACY_CONTACT)));

  app.route('/api/admin', createAdminRoutes());
  app.route('/api/webhooks', createWebhookRoutes());
  app.route('/api/internal', createInternalRoutes());

  // Sean 版（Supabase）：後台前端改放 GitHub Pages，API 不再提供 /admin 靜態檔。
  return app;
}
