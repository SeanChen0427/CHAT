-- Sean 版（Supabase）：只在 Supabase 上執行一次（測試用的 PGlite 不載入本檔）。
-- 1. 在 Supabase Vault 產生系統自用密鑰（值在資料庫內隨機產生，不經過任何人）。
--    Edge Function 啟動時讀取；若 Edge Function secrets 設了同名值則以 secrets 為準。
-- 2. 以 pg_cron + pg_net 定時呼叫 Edge Function 的內部端點，取代 Cloudflare 的 Queue 與 Cron。
-- 換專案時把下方的 https://gynpbquftdsoevxiwivp.supabase.co 改成新專案網址。

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  k text;
begin
  foreach k in array array['ADMIN_SESSION_SECRET', 'CRON_SECRET', 'WEBHOOK_VERIFY_TOKEN'] loop
    if not exists (select 1 from vault.secrets where name = k) then
      perform vault.create_secret(
        encode(extensions.gen_random_bytes(case when k = 'WEBHOOK_VERIFY_TOKEN' then 16 else 32 end), 'hex'),
        k,
        'IG／FB 自動私訊：系統自動產生'
      );
    end if;
  end loop;
end $$;

-- 呼叫內部端點的共用函式（帶 CRON_SECRET）。security definer 讓 cron 以擁有者權限讀 vault。
create or replace function public.call_internal(path text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://gynpbquftdsoevxiwivp.supabase.co/functions/v1/api/internal/' || path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;
revoke all on function public.call_internal(text) from public, anon, authenticated;

-- 重新建立排程（可重複執行）。時間為 UTC；台北 = UTC+8。
do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname like 'igfb-%';
end $$;
select cron.schedule('igfb-tick', '* * * * *', $$ select public.call_internal('tick') $$);          -- 每分鐘：處理事件與重試
select cron.schedule('igfb-sync-0400', '0 20 * * *', $$ select public.call_internal('sync') $$);    -- 台北 04:00 貼文同步
select cron.schedule('igfb-sync-0800', '0 0 * * *', $$ select public.call_internal('sync') $$);     -- 台北 08:00 權杖檢查（含同步）
select cron.schedule('igfb-cleanup', '0 19 * * *', $$ select public.call_internal('cleanup') $$);   -- 台北 03:00 資料清理
-- pg_net 的回應紀錄只留 1 天，避免每分鐘呼叫累積。
select cron.schedule('igfb-net-cleanup', '30 19 * * *', $$ delete from net._http_response where created < now() - interval '1 day' $$);
