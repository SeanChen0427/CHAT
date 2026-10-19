-- Sean 版（Supabase）：所有資料表開啟 RLS 且不建立任何 policy。
-- Supabase 會用 anon／authenticated 角色把 public schema 對外開放（REST API），
-- 開啟 RLS 後這些角色讀寫不到任何資料；後端 Edge Function 以資料表擁有者連線，不受影響。
ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automation_keywords" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contact_automations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "instagram_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "instagram_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "login_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public_reply_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "send_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
