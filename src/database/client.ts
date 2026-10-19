// Sean 版（Supabase）：資料庫連線由入口（supabase-entry.ts）建立後放在 env.DB，
// 這裡保留 createDb(env.DB) 的呼叫方式，讓上游各處程式不必改動。
import type { SchemaDb } from './types';

export function createDb(db: SchemaDb): SchemaDb {
  return db;
}
