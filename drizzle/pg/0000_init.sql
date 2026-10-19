CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "api_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_run_id" text NOT NULL,
	"action_type" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"http_status" integer,
	"failure_reason" text,
	"meta_error_code" text,
	"meta_error_subcode" text,
	"meta_error_message" text,
	"meta_trace_id" text,
	"request_payload_redacted" text,
	"response_payload_redacted" text,
	"started_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" text,
	"ip_address" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_id" text NOT NULL,
	"keyword" text NOT NULL,
	"normalized_keyword" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_id" text NOT NULL,
	"webhook_event_id" text,
	"instagram_comment_id" text NOT NULL,
	"instagram_media_id" text NOT NULL,
	"commenter_id" text,
	"commenter_username" text,
	"original_comment_text" text,
	"normalized_comment_text" text,
	"matched_keyword" text,
	"status" text NOT NULL,
	"public_reply_message" text,
	"public_reply_status" text,
	"private_reply_status" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"started_at" text,
	"completed_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" text PRIMARY KEY NOT NULL,
	"instagram_media_id" text,
	"apply_scope" text DEFAULT 'media' NOT NULL,
	"platform" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"match_type" text DEFAULT 'contains_any' NOT NULL,
	"public_reply_enabled" integer DEFAULT 1 NOT NULL,
	"private_reply_enabled" integer DEFAULT 1 NOT NULL,
	"opening_dm" text,
	"button_text" text,
	"button_url" text,
	"daily_limit" integer,
	"exclude_own_comments" integer DEFAULT 1 NOT NULL,
	"follow_gate_enabled" integer DEFAULT 0 NOT NULL,
	"not_following_text" text,
	"recheck_button_text" text,
	"email_capture_enabled" integer DEFAULT 0 NOT NULL,
	"email_prompt_text" text,
	"claim_button_text" text,
	"delivery_text" text,
	"tag" text,
	"once_per_contact" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "automations_instagram_media_id_unique" UNIQUE("instagram_media_id")
);
--> statement-breakpoint
CREATE TABLE "contact_automations" (
	"id" text PRIMARY KEY NOT NULL,
	"igsid" text NOT NULL,
	"automation_id" text NOT NULL,
	"first_triggered_at" text NOT NULL,
	"delivered_at" text
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"igsid" text PRIMARY KEY NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"username" text,
	"name" text,
	"email" text,
	"tags" text DEFAULT '[]' NOT NULL,
	"is_follower" integer,
	"state" text,
	"first_seen_at" text NOT NULL,
	"last_seen_at" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_run_at" text NOT NULL,
	"last_error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"instagram_account_id" text NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"username" text,
	"profile_picture_url" text,
	"account_type" text,
	"token_expires_at" text,
	"access_token" text,
	"token_refreshed_at" text,
	"webhook_subscribed" integer DEFAULT 0 NOT NULL,
	"automation_enabled" integer DEFAULT 1 NOT NULL,
	"circuit_breaker_status" text DEFAULT 'closed' NOT NULL,
	"last_webhook_received_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "instagram_accounts_instagram_account_id_unique" UNIQUE("instagram_account_id")
);
--> statement-breakpoint
CREATE TABLE "instagram_media" (
	"id" text PRIMARY KEY NOT NULL,
	"instagram_account_id" text NOT NULL,
	"instagram_media_id" text NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"media_type" text NOT NULL,
	"caption" text,
	"thumbnail_url" text,
	"permalink" text,
	"published_at" text,
	"last_synced_at" text,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "instagram_media_instagram_media_id_unique" UNIQUE("instagram_media_id")
);
--> statement-breakpoint
CREATE TABLE "login_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"window_start" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_reply_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_id" text NOT NULL,
	"message" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "send_counters" (
	"id" text PRIMARY KEY NOT NULL,
	"scope_key" text NOT NULL,
	"window_start" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"emergency_stop" integer DEFAULT 0 NOT NULL,
	"max_public_replies_per_minute" integer,
	"max_private_replies_per_minute" integer,
	"max_public_replies_per_day" integer,
	"max_private_replies_per_day" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"instagram_account_id" text,
	"instagram_media_id" text,
	"instagram_comment_id" text,
	"raw_payload" text NOT NULL,
	"signature_valid" integer NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"received_at" text NOT NULL,
	"last_received_at" text NOT NULL,
	"processed_at" text,
	CONSTRAINT "webhook_events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_instagram_media_id_instagram_media_id_fk" FOREIGN KEY ("instagram_media_id") REFERENCES "public"."instagram_media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_media" ADD CONSTRAINT "instagram_media_instagram_account_id_instagram_accounts_id_fk" FOREIGN KEY ("instagram_account_id") REFERENCES "public"."instagram_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attempts_run" ON "api_attempts" USING btree ("automation_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_keywords_automation_id_normalized_keyword_unique" ON "automation_keywords" USING btree ("automation_id","normalized_keyword");--> statement-breakpoint
CREATE INDEX "idx_keywords_automation" ON "automation_keywords" USING btree ("automation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_automation_id_instagram_comment_id_unique" ON "automation_runs" USING btree ("automation_id","instagram_comment_id");--> statement-breakpoint
CREATE INDEX "idx_runs_status" ON "automation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_runs_created" ON "automation_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_runs_media" ON "automation_runs" USING btree ("instagram_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_automations_igsid_automation_unique" ON "contact_automations" USING btree ("igsid","automation_id");--> statement-breakpoint
CREATE INDEX "idx_contact_automations_automation" ON "contact_automations" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_last_seen" ON "contacts" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_event_jobs_due" ON "event_jobs" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "idx_media_account" ON "instagram_media" USING btree ("instagram_account_id");--> statement-breakpoint
CREATE INDEX "idx_login_rate_limits_ip" ON "login_rate_limits" USING btree ("ip_address");--> statement-breakpoint
CREATE UNIQUE INDEX "login_rate_limits_ip_window_unique" ON "login_rate_limits" USING btree ("ip_address","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "send_counters_scope_window_unique" ON "send_counters" USING btree ("scope_key","window_start");--> statement-breakpoint
CREATE INDEX "idx_webhook_comment" ON "webhook_events" USING btree ("instagram_comment_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_received" ON "webhook_events" USING btree ("received_at");