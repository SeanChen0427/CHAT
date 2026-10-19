// Sean 版新增：聯絡人名單 Admin API。
//   GET    /api/admin/contacts?q=&tag=&hasEmail=1&limit=   名單（最後互動新→舊）
//   GET    /api/admin/contacts/tags                         標籤與人數
//   GET    /api/admin/contacts/export.csv?q=&tag=&hasEmail= 匯出 CSV（UTF-8 BOM，Excel 不亂碼）
//   DELETE /api/admin/contacts/:igsid                       刪除（處理資料刪除要求）
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppBindings } from '../app';
import { createDb } from '../database/client';
import { auditLogs, automationRuns, contactAutomations, contacts } from '../database/schema';
import { csrfMiddleware } from '../security/csrf';
import { adminApiRateLimitMiddleware } from '../security/rate-limit';
import { requireAdminAuth } from './auth';
import { clientIp } from '../security/client-ip';

type ContactRow = typeof contacts.$inferSelect;

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function filterContacts(rows: ContactRow[], q: Record<string, string>) {
  const needle = (q.q ?? '').trim().toLowerCase();
  return rows
    .map((c) => ({ ...c, tags: parseTags(c.tags) }))
    .filter((c) => {
      if (q.hasEmail === '1' && !c.email) return false;
      if (q.tag && !c.tags.includes(q.tag)) return false;
      if (needle) {
        const hay = [c.username, c.name, c.email].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
}

// 防 CSV 公式注入：= + - @ 開頭的儲存格前面加單引號。
function csvCell(v: string): string {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) || safe !== v ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function taipeiTime(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
}

export function toCsv(rows: Array<Omit<ContactRow, 'tags'> & { tags: string[] }>): string {
  const header = ['平台', 'ID', '帳號', '名稱', 'Email', '標籤', '有追蹤', '首次互動', '最後互動'];
  const lines = [header.join(',')];
  for (const c of rows) {
    lines.push(
      [
        c.platform === 'facebook' ? 'Facebook' : 'Instagram',
        c.igsid,
        c.username ?? '',
        c.name ?? '',
        c.email ?? '',
        c.tags.join('、'),
        c.platform === 'facebook' || c.isFollower == null ? '' : c.isFollower ? '是' : '否',
        taipeiTime(c.firstSeenAt),
        taipeiTime(c.lastSeenAt),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return '﻿' + lines.join('\r\n');
}

export function createContactRoutes() {
  const app = new Hono<{ Bindings: AppBindings; Variables: { adminUserId: string } }>();

  app.use('*', requireAdminAuth(), adminApiRateLimitMiddleware());

  app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const q = c.req.query();
    const limit = Math.min(Number.parseInt(q.limit ?? '', 10) || 200, 1000);
    const rows = await db.select().from(contacts).orderBy(desc(contacts.lastSeenAt));
    const filtered = filterContacts(rows, q);
    return c.json({ total: filtered.length, contacts: filtered.slice(0, limit) });
  });

  app.get('/tags', async (c) => {
    const db = createDb(c.env.DB);
    const counts = new Map<string, number>();
    for (const row of await db.select({ tags: contacts.tags }).from(contacts)) {
      for (const t of parseTags(row.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return c.json({
      tags: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })),
    });
  });

  app.get('/export.csv', async (c) => {
    const db = createDb(c.env.DB);
    const rows = filterContacts(await db.select().from(contacts).orderBy(desc(contacts.lastSeenAt)), c.req.query());
    const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      adminUserId: c.get('adminUserId'),
      action: 'contacts.export',
      metadata: JSON.stringify({ count: rows.length }),
      ipAddress: clientIp(c.req),
    });
    return new Response(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ig-contacts-${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  });

  // 刪除：聯絡人、觸發紀錄，並把執行紀錄中的留言者身分與留言內容抹除（紀錄本身保留供統計）。
  app.delete('/:igsid', csrfMiddleware(), async (c) => {
    const igsid = c.req.param('igsid');
    const db = createDb(c.env.DB);
    const existing = await db.select().from(contacts).where(eq(contacts.igsid, igsid)).limit(1);
    if (existing.length === 0) return c.json({ error: '聯絡人不存在' }, 404);
    await db.delete(contactAutomations).where(eq(contactAutomations.igsid, igsid));
    await db
      .update(automationRuns)
      .set({ commenterId: null, commenterUsername: null, originalCommentText: null, normalizedCommentText: null })
      .where(eq(automationRuns.commenterId, igsid));
    await db.delete(contacts).where(eq(contacts.igsid, igsid));
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      adminUserId: c.get('adminUserId'),
      action: 'contacts.delete',
      entityType: 'contacts',
      ipAddress: clientIp(c.req),
    });
    return c.json({ ok: true });
  });

  return app;
}
