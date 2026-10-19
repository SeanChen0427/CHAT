// Sean 版（Supabase）：全專案共用的資料庫型別。
// 正式環境為 drizzle-orm/postgres-js，測試為 drizzle-orm/pglite（記憶體內 Postgres），兩者皆為 PgDatabase。
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

export type SchemaDb = PgDatabase<PgQueryResultHKT, typeof schema>;
