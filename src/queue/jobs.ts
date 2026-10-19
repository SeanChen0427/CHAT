// Sean 版（Supabase）：以 event_jobs 資料表取代 Cloudflare Queues。
// - 收到 webhook 時寫入一筆 pending 工作，並在背景立刻執行一次 runDueJobs（EdgeRuntime.waitUntil）。
// - pg_cron 每分鐘呼叫 /api/internal/tick 補跑：延遲重試、背景執行被中斷的工作。
// - 認領工作用「UPDATE ... WHERE status='pending'」條件更新，同一筆不會被兩個執行個體同時處理。
import { and, asc, eq, lt, lte, sql } from 'drizzle-orm';
import type { AppBindings } from '../app';
import { processCommentEvent, processStoryReplyEvent, type EngineDeps, type EngineOutcome } from '../automation/engine';
import { processMessagingEvent, type FunnelOutcome } from '../automation/funnel';
import { eventJobs } from '../database/schema';
import type { SchemaDb } from '../database/types';
import { createPlatformClients } from '../meta/platform';
import type { CommentEventMessage, EventQueue } from './producer';

// 與原本 Cloudflare Queue 設定一致：最多重試 3 次（共執行 4 次）。
export const MAX_JOB_RETRIES = 3;
// 未指定延遲時的重試間隔（秒），依次數遞增。
const DEFAULT_RETRY_DELAYS = [30, 120, 600];
// 執行中超過這個時間視為被中斷（Edge Function 逾時或重啟），放回待處理。
const STUCK_AFTER_MS = 5 * 60 * 1000;
// 已完成／失敗的工作保留天數（每日清理時刪除）。
export const JOB_RETENTION_DAYS = 7;

export function createJobQueue(db: SchemaDb, onEnqueued?: () => void): EventQueue {
  return {
    async send(message, options) {
      const now = Date.now();
      await db.insert(eventJobs).values({
        id: crypto.randomUUID(),
        message: JSON.stringify(message),
        status: 'pending',
        nextRunAt: new Date(now + (options?.delaySeconds ?? 0) * 1000).toISOString(),
      });
      onEnqueued?.();
    },
  };
}

export async function processQueuedEvent(deps: EngineDeps, body: CommentEventMessage): Promise<EngineOutcome | FunnelOutcome> {
  if (body.eventType === 'story_reply') return processStoryReplyEvent(deps, body);
  if (body.eventType === 'messaging') return processMessagingEvent(deps, body);
  return processCommentEvent(deps, body);
}

export interface RunJobsSummary {
  processed: number;
  done: number;
  retried: number;
  failed: number;
}

export async function runDueJobs(
  env: AppBindings,
  options: { limit?: number; now?: () => number; deps?: EngineDeps } = {},
): Promise<RunJobsSummary> {
  const db = env.DB;
  const now = options.now ?? Date.now;
  const limit = options.limit ?? 20;
  const summary: RunJobsSummary = { processed: 0, done: 0, retried: 0, failed: 0 };

  // 被中斷的工作放回待處理。
  await db
    .update(eventJobs)
    .set({ status: 'pending', updatedAt: new Date(now()).toISOString() })
    .where(and(eq(eventJobs.status, 'running'), lt(eventJobs.updatedAt, new Date(now() - STUCK_AFTER_MS).toISOString())));

  const due = await db
    .select({ id: eventJobs.id })
    .from(eventJobs)
    .where(and(eq(eventJobs.status, 'pending'), lte(eventJobs.nextRunAt, new Date(now()).toISOString())))
    .orderBy(asc(eventJobs.nextRunAt))
    .limit(limit);
  if (due.length === 0) return summary;

  const deps: EngineDeps = options.deps ?? { db, ...(await createPlatformClients(db, env)) };

  for (const { id } of due) {
    const claimed = await db
      .update(eventJobs)
      .set({ status: 'running', updatedAt: new Date(now()).toISOString() })
      .where(and(eq(eventJobs.id, id), eq(eventJobs.status, 'pending')))
      .returning();
    const job = claimed[0];
    if (!job) continue; // 已被其他執行個體認領
    summary.processed += 1;

    let retryDelay: number | null | undefined; // undefined = 不重試
    let lastError: string | null = null;
    try {
      const body = JSON.parse(job.message) as CommentEventMessage;
      const outcome = await processQueuedEvent(deps, body);
      if (outcome.kind === 'retry' && outcome.delaySeconds !== null) {
        retryDelay = outcome.delaySeconds;
        lastError = outcome.reason;
      }
    } catch (e) {
      // 未預期錯誤：依預設間隔重試（不記錄完整錯誤內容，避免把權杖等機密寫進資料庫）。
      retryDelay = null;
      lastError = (e as Error)?.name ?? 'Error';
    }

    const ts = new Date(now()).toISOString();
    if (retryDelay === undefined) {
      await db.update(eventJobs).set({ status: 'done', updatedAt: ts }).where(eq(eventJobs.id, id));
      summary.done += 1;
    } else if (job.attempts >= MAX_JOB_RETRIES) {
      await db
        .update(eventJobs)
        .set({ status: 'failed', attempts: job.attempts + 1, lastError, updatedAt: ts })
        .where(eq(eventJobs.id, id));
      summary.failed += 1;
    } else {
      const delay = retryDelay ?? DEFAULT_RETRY_DELAYS[Math.min(job.attempts, DEFAULT_RETRY_DELAYS.length - 1)];
      await db
        .update(eventJobs)
        .set({
          status: 'pending',
          attempts: job.attempts + 1,
          lastError,
          nextRunAt: new Date(now() + delay * 1000).toISOString(),
          updatedAt: ts,
        })
        .where(eq(eventJobs.id, id));
      summary.retried += 1;
    }
  }
  return summary;
}

// 每日清理：刪掉超過保留天數的已完成／失敗工作。
export async function cleanupOldJobs(db: SchemaDb, nowMs: number = Date.now()): Promise<number> {
  const cutoff = new Date(nowMs - JOB_RETENTION_DAYS * 86400_000).toISOString();
  const rows = await db
    .delete(eventJobs)
    .where(and(sql`${eventJobs.status} in ('done', 'failed')`, lt(eventJobs.updatedAt, cutoff)))
    .returning({ id: eventJobs.id });
  return rows.length;
}
