// Sean 版（Supabase）：取得用戶端 IP。Cloudflare 提供 CF-Connecting-IP；Supabase Edge Functions
// 經過代理，真實 IP 在 X-Forwarded-For 的第一段。兩者都沒有時回 null。
export function clientIp(req: { header(name: string): string | undefined }): string | null {
  const cf = req.header('CF-Connecting-IP');
  if (cf) return cf;
  const xff = req.header('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim() || null;
  return null;
}
