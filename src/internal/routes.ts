// Sean 版（Supabase）：給 pg_cron 呼叫的內部排程端點，取代 Cloudflare 的 Queue consumer 與 Cron。
// 一律要求 Authorization: Bearer <CRON_SECRET>；未設定 CRON_SECRET 時全部拒絕。
import { Hono } from 'hono';
import type { AppBindings } from '../app';
import { runDataCleanup } from '../maintenance/cleanup';
import { runScheduledSync } from '../meta/media';
import { cleanupOldJobs, runDueJobs } from '../queue/jobs';
import { timingSafeEqualString } from '../security/timing';

export function createInternalRoutes() {
  const app = new Hono<{ Bindings: AppBindings }>();

  app.use('*', async (c, next) => {
    const secret = c.env.CRON_SECRET?.trim();
    const auth = c.req.header('Authorization') ?? '';
    const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!secret || !given || !timingSafeEqualString(given, secret)) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    return next();
  });

  // 每分鐘：處理到期的事件工作（含重試）。
  app.post('/tick', async (c) => c.json(await runDueJobs(c.env)));

  // 每日：貼文同步＋權杖續期檢查。
  app.post('/sync', async (c) => c.json(await runScheduledSync(c.env)));

  // 每日：資料清理（含已完成的事件工作）。
  app.post('/cleanup', async (c) => {
    const result = await runDataCleanup(c.env.DB);
    const jobsDeleted = await cleanupOldJobs(c.env.DB);
    return c.json({ ...result, jobsDeleted });
  });

  return app;
}
