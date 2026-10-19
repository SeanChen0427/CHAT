// Sean 版（Supabase）：測試用 Postgres。以 PGlite（WASM 版 Postgres，跑在記憶體）載入
// drizzle/pg 的 migration，與正式環境 Supabase 同一套 SQL。
// 每個測試檔共用一個 PGlite 實例（啟動較慢），每次 freshTestDb() 清空所有資料表。
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/database/schema';
import type { SchemaDb } from '../../src/database/types';

export type TestDb = SchemaDb & {
  // 測試直接下 SQL 用（取代原本 better-sqlite3 的 prepare().get()/all()/run()）。
  rawAll<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
  rawGet<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T | undefined>;
  rawRun(query: string, params?: unknown[]): Promise<void>;
};

const MIGRATIONS_DIR = join(__dirname, '../../drizzle/pg');

export function migrationSql(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .flatMap((f) =>
      readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
        .split(/-->\s*statement-breakpoint/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
}

let shared: Promise<TestDb> | null = null;

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  for (const stmt of migrationSql()) await client.exec(stmt);
  const db = drizzle(client, { schema }) as unknown as TestDb;
  db.rawAll = async (query, params = []) => (await client.query(query, params)).rows as never;
  db.rawGet = async (query, params = []) => (await client.query(query, params)).rows[0] as never;
  db.rawRun = async (query, params = []) => {
    if (params.length) await client.query(query, params);
    else await client.exec(query);
  };
  return db;
}

// 取得本測試檔共用的資料庫並清空所有資料表。
export async function freshTestDb(): Promise<TestDb> {
  shared ??= createTestDb();
  const db = await shared;
  const tables = await db.rawAll<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  if (tables.length) {
    await db.rawRun(`truncate ${tables.map((t) => `"${t.tablename}"`).join(', ')} cascade`);
  }
  return db;
}
