// Sean 版（一鍵連結）：後台設定精靈寫入的設定（app_config 表）合併進 env。
// 優先順序：app_config（精靈填的、連結取得的）＞ Edge Function secrets ＞ Vault 自動產生的預設值。
// 每個請求都重新讀（一張小表、一次查詢），精靈存檔後立即生效，不需重新部署。
import { eq, inArray } from 'drizzle-orm';
import type { AppBindings } from '../app';
import { appConfig } from '../database/schema';
import type { SchemaDb } from '../database/types';

// 會合併進 env 的鍵（其他鍵只給連結流程內部使用）。
export const ENV_CONFIG_KEYS = [
  'INSTAGRAM_APP_ID',
  'INSTAGRAM_APP_SECRET',
  'META_APP_ID',
  'META_APP_SECRET',
  'FACEBOOK_PAGE_ACCESS_TOKEN',
] as const;
export type ConfigKey = (typeof ENV_CONFIG_KEYS)[number] | 'FB_PAGE_CANDIDATES' | 'WEBHOOK_STATUS_INSTAGRAM' | 'WEBHOOK_STATUS_PAGE';

export async function readConfig(db: SchemaDb, keys: readonly string[]): Promise<Record<string, string>> {
  const rows = await db.select().from(appConfig).where(inArray(appConfig.key, [...keys]));
  return Object.fromEntries(rows.filter((r) => r.value !== '').map((r) => [r.key, r.value]));
}

export async function writeConfig(db: SchemaDb, values: Partial<Record<ConfigKey, string | null>>): Promise<void> {
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (value === null || value === '') {
      await db.delete(appConfig).where(eq(appConfig.key, key));
      continue;
    }
    await db
      .insert(appConfig)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: appConfig.key, set: { value, updatedAt: now } });
  }
}

export async function withAppConfig<E extends AppBindings>(env: E): Promise<E> {
  if (!env?.DB) return env;
  try {
    const cfg = await readConfig(env.DB, ENV_CONFIG_KEYS);
    return Object.keys(cfg).length ? { ...env, ...cfg } : env;
  } catch {
    // 讀不到（例如資料庫暫時不可用）時沿用原 env，後續請求自然會報錯或重試。
    return env;
  }
}
