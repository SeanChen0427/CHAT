import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { freshTestDb } from '../helpers/pg';

describe('GET /api/health', () => {
  it('returns 200 with status ok when the database answers', async () => {
    const db = await freshTestDb();
    const res = await createApp().fetch(new Request('https://x.test/api/health'), { DB: db } as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  // Sean 版（Supabase）：資料庫連不上時回 503，讓每日保持運作的排程看得出異常。
  it('returns 503 when the database is unavailable', async () => {
    const broken = { execute: async () => { throw new Error('down'); } };
    const res = await createApp().fetch(new Request('https://x.test/api/health'), { DB: broken } as never);
    expect(res.status).toBe(503);
  });
});
