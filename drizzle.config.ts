import type { Config } from 'drizzle-kit';

// Sean 版（Supabase）：Postgres。產生的 migration 放在 drizzle/pg，
// 用 Supabase MCP／SQL 編輯器套用；測試以 PGlite 載入同一批檔案。
export default {
  schema: './src/database/schema.ts',
  out: './drizzle/pg',
  dialect: 'postgresql',
} satisfies Config;
