// Sean 版（Supabase）：取代 Cloudflare 原生 Rate Limiting binding 的記憶體版固定窗口限流。
// Edge Function 的每個執行個體各自計數，屬於盡力而為的保護（只有管理者本人使用，足夠）；
// 登入頻率限制仍走資料庫 login_rate_limits 表，跨執行個體有效。
import type { RateLimiter } from '../app';

export function createMemoryRateLimiter(limit: number, periodSeconds: number, now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { windowStart: number; count: number }>();
  return {
    async limit({ key }) {
      const t = now();
      const windowStart = Math.floor(t / (periodSeconds * 1000));
      const bucket = buckets.get(key);
      if (!bucket || bucket.windowStart !== windowStart) {
        buckets.set(key, { windowStart, count: 1 });
        if (buckets.size > 1000) {
          for (const [k, v] of buckets) if (v.windowStart !== windowStart) buckets.delete(k);
        }
        return { success: true };
      }
      bucket.count += 1;
      return { success: bucket.count <= limit };
    },
  };
}
