// Sean 版（Supabase）：event_jobs 工作執行器（取代 Cloudflare Queue consumer）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventJobs } from '../../src/database/schema';
import { cleanupOldJobs, createJobQueue, MAX_JOB_RETRIES, runDueJobs } from '../../src/queue/jobs';
import { freshTestDb, type TestDb } from '../helpers/pg';

const engine = vi.hoisted(() => ({
  processCommentEvent: vi.fn(),
  processStoryReplyEvent: vi.fn(),
  processMessagingEvent: vi.fn(),
}));
vi.mock('../../src/automation/engine', () => ({
  processCommentEvent: engine.processCommentEvent,
  processStoryReplyEvent: engine.processStoryReplyEvent,
}));
vi.mock('../../src/automation/funnel', () => ({ processMessagingEvent: engine.processMessagingEvent }));

let db: TestDb;
const T0 = Date.UTC(2026, 9, 19, 12, 0, 0);
const msg = (id: string, eventType?: 'story_reply' | 'messaging') => ({
  webhookEventId: id,
  eventKey: 'k-' + id,
  instagramAccountId: 'ig',
  instagramMediaId: 'm',
  instagramCommentId: 'c-' + id,
  eventType,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deps = { db: null as any, client: {} as any } as any;
const run = (now = T0) => runDueJobs({ DB: db } as never, { now: () => now, deps });

async function enqueue(id: string, eventType?: 'story_reply' | 'messaging', at = T0) {
  vi.setSystemTime(at);
  await createJobQueue(db).send(msg(id, eventType));
  vi.useRealTimers();
}

beforeEach(async () => {
  db = await freshTestDb();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.useRealTimers();
});

describe('runDueJobs', () => {
  it('dispatches by event type and marks jobs done', async () => {
    engine.processCommentEvent.mockResolvedValue({ kind: 'no_match' });
    engine.processStoryReplyEvent.mockResolvedValue({ kind: 'no_match' });
    engine.processMessagingEvent.mockResolvedValue({ kind: 'completed', step: 'x' });
    await enqueue('a');
    await enqueue('b', 'story_reply');
    await enqueue('c', 'messaging');
    const summary = await run();
    expect(summary).toEqual({ processed: 3, done: 3, retried: 0, failed: 0 });
    expect(engine.processCommentEvent).toHaveBeenCalledTimes(1);
    expect(engine.processStoryReplyEvent).toHaveBeenCalledTimes(1);
    expect(engine.processMessagingEvent).toHaveBeenCalledTimes(1);
    const rows = await db.select().from(eventJobs);
    expect(rows.every((r) => r.status === 'done')).toBe(true);
    // 已完成的不會再跑
    expect((await run()).processed).toBe(0);
  });

  it('retries with the delay the engine asked for, then gives up after the retry limit', async () => {
    engine.processCommentEvent.mockResolvedValue({ kind: 'retry', delaySeconds: 60, runId: 'r', reason: 'rate_limited' });
    await enqueue('a');
    let now = T0;
    for (let i = 0; i < MAX_JOB_RETRIES; i++) {
      expect((await run(now)).retried).toBe(1);
      const [row] = await db.select().from(eventJobs);
      expect(row.status).toBe('pending');
      expect(row.attempts).toBe(i + 1);
      expect(row.lastError).toBe('rate_limited');
      expect(row.nextRunAt).toBe(new Date(now + 60_000).toISOString());
      // 還沒到時間不會跑
      expect((await run(now + 30_000)).processed).toBe(0);
      now += 60_000;
    }
    expect((await run(now)).failed).toBe(1);
    const [row] = await db.select().from(eventJobs);
    expect(row.status).toBe('failed');
    expect(engine.processCommentEvent).toHaveBeenCalledTimes(MAX_JOB_RETRIES + 1);
  });

  it('treats retry with null delay as done (same as the old Queue ack)', async () => {
    engine.processCommentEvent.mockResolvedValue({ kind: 'retry', delaySeconds: null, runId: 'r', reason: 'x' });
    await enqueue('a');
    expect((await run()).done).toBe(1);
  });

  it('retries unexpected errors with default backoff without storing the error message', async () => {
    engine.processCommentEvent.mockRejectedValue(new TypeError('token=SECRET leaked'));
    await enqueue('a');
    expect((await run()).retried).toBe(1);
    const [row] = await db.select().from(eventJobs);
    expect(row.lastError).toBe('TypeError');
    expect(row.nextRunAt).toBe(new Date(T0 + 30_000).toISOString());
  });

  it('puts back jobs stuck in running for more than 5 minutes', async () => {
    engine.processCommentEvent.mockResolvedValue({ kind: 'no_match' });
    await enqueue('a');
    await db.update(eventJobs).set({ status: 'running', updatedAt: new Date(T0).toISOString() });
    expect((await run(T0 + 60_000)).processed).toBe(0);
    expect((await run(T0 + 6 * 60_000)).done).toBe(1);
  });

  it('does not process a job twice when two runners overlap', async () => {
    let release!: () => void;
    engine.processCommentEvent.mockImplementation(
      () => new Promise((r) => (release = () => r({ kind: 'no_match' }))),
    );
    await enqueue('a');
    const first = run();
    await vi.waitFor(() => expect(engine.processCommentEvent).toHaveBeenCalledTimes(1));
    const second = await run();
    expect(second.processed).toBe(0);
    release();
    expect((await first).done).toBe(1);
  });
});

describe('cleanupOldJobs', () => {
  it('deletes finished jobs older than 7 days and keeps pending ones', async () => {
    await enqueue('old-done');
    await enqueue('old-pending');
    await enqueue('new-done');
    const old = new Date(T0 - 8 * 86400_000).toISOString();
    const rows = await db.select().from(eventJobs);
    const byId = (w: string) => rows.find((r) => JSON.parse(r.message).webhookEventId === w)!.id;
    const { eq } = await import('drizzle-orm');
    await db.update(eventJobs).set({ status: 'done', updatedAt: old }).where(eq(eventJobs.id, byId('old-done')));
    await db.update(eventJobs).set({ updatedAt: old }).where(eq(eventJobs.id, byId('old-pending')));
    await db.update(eventJobs).set({ status: 'done' }).where(eq(eventJobs.id, byId('new-done')));
    expect(await cleanupOldJobs(db, T0)).toBe(1);
    expect(await db.select().from(eventJobs)).toHaveLength(2);
  });
});
