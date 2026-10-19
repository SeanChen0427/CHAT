import { describe, expect, it } from 'vitest';
import * as schema from '../../src/database/schema';
import { freshTestDb } from '../helpers/pg';

// Sean 版（Supabase）：以 PGlite 載入 drizzle/pg 的 migration，驗證 schema 與 $defaultFn 行為。
const createTestDb = freshTestDb;

describe('Postgres schema migration', () => {
  it('creates all 16 tables (13 upstream + 3 Sean 版) with RLS enabled', async () => {
    const db = await freshTestDb();
    const rows = await db.rawAll<{ tablename: string; rowsecurity: boolean }>(
      "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    expect(rows.map((r) => r.tablename)).toEqual([
      'admin_users',
      'api_attempts',
      'audit_logs',
      'automation_keywords',
      'automation_runs',
      'automations',
      'contact_automations',
      'contacts',
      'event_jobs',
      'instagram_accounts',
      'instagram_media',
      'login_rate_limits',
      'public_reply_variants',
      'send_counters',
      'system_settings',
      'webhook_events',
    ]);
    // 所有表都開啟 RLS（不對 Supabase 的 anon／authenticated 角色開放）。
    expect(rows.every((r) => r.rowsecurity)).toBe(true);
  });

  it('inserts an admin_users row without created_at/updated_at and still succeeds', async () => {
    const db = await createTestDb();

    await db.insert(schema.adminUsers).values({
      id: 'admin-1',
      email: 'admin@example.com',
      passwordHash: 'placeholder-hash',
    });

    const [row] = await db.select().from(schema.adminUsers);
    expect(row.email).toBe('admin@example.com');
    expect(typeof row.createdAt).toBe('string');
    expect(typeof row.updatedAt).toBe('string');
    expect(() => new Date(row.createdAt).toISOString()).not.toThrow();
  });

  it('enforces automation_runs UNIQUE(automation_id, instagram_comment_id)', async () => {
    const db = await createTestDb();

    await db.insert(schema.instagramAccounts).values({
      id: 'acct-1',
      instagramAccountId: 'ig-acct-1',
    });
    await db.insert(schema.instagramMedia).values({
      id: 'media-1',
      instagramAccountId: 'acct-1',
      instagramMediaId: 'ig-media-1',
      mediaType: 'IMAGE',
    });
    await db.insert(schema.automations).values({
      id: 'automation-1',
      instagramMediaId: 'media-1',
      name: 'test automation',
    });
    await db.insert(schema.automationRuns).values({
      id: 'run-1',
      automationId: 'automation-1',
      instagramCommentId: 'comment-1',
      instagramMediaId: 'media-1',
      status: 'matched',
    });

    await expect(
      db.insert(schema.automationRuns).values({
        id: 'run-2',
        automationId: 'automation-1',
        instagramCommentId: 'comment-1',
        instagramMediaId: 'media-1',
        status: 'matched',
      }),
    ).rejects.toThrow();
  });
});
