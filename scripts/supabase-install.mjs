// Sean 版（學員安裝）：由 GitHub Actions「安裝／更新」執行，把資料庫結構與排程裝到學員自己的 Supabase 專案。
// 需要環境變數 SUPABASE_ACCESS_TOKEN、SUPABASE_PROJECT_REF。
// 使用 Supabase Management API 的 SQL 端點（POST /v1/projects/{ref}/database/query）。
// 已套用過的 migration 記在 public._igfb_migrations，可重複執行（更新版本時只套新的）。
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('缺少 SUPABASE_ACCESS_TOKEN 或 SUPABASE_PROJECT_REF，請照學員手冊在 GitHub 設定。');
  process.exit(1);
}
if (!/^[a-z0-9]{20}$/.test(ref)) {
  console.error(`SUPABASE_PROJECT_REF 看起來不對（${ref}）：應該是 20 個小寫英文和數字，在 Supabase 專案網址 /project/ 後面那段。`);
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401) throw new Error('Supabase 存取權杖無效或過期，請重新產生後更新 GitHub 的 SUPABASE_ACCESS_TOKEN。');
    if (res.status === 404) throw new Error('找不到這個 Supabase 專案，請確認 SUPABASE_PROJECT_REF。');
    throw new Error(`Supabase 回應 ${res.status}：${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : [];
}

const split = (sql) =>
  sql
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter(Boolean);

await query(`create table if not exists public._igfb_migrations (name text primary key, applied_at timestamptz not null default now());
alter table public._igfb_migrations enable row level security;`);
const applied = new Set((await query('select name from public._igfb_migrations')).map((r) => r.name));

const dir = 'drizzle/pg';
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (applied.has(file)) {
    console.log(`略過（已套用）：${file}`);
    continue;
  }
  for (const stmt of split(readFileSync(join(dir, file), 'utf8'))) await query(stmt);
  await query(`insert into public._igfb_migrations (name) values ('${file.replace(/'/g, "''")}')`);
  console.log(`已套用：${file}`);
}

// 密鑰與排程（可重複執行）：把範本中的專案網址換成學員自己的。
const setup = readFileSync('supabase/setup/01_密鑰與排程.sql', 'utf8').replace(
  /https:\/\/[a-z0-9]{20}\.supabase\.co/g,
  `https://${ref}.supabase.co`,
);
await query(setup);
console.log('已設定：系統密鑰（Vault）與每分鐘排程');
