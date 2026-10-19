// @ts-nocheck
// 由 scripts/build-function.mjs 產生，請勿手動修改；原始碼在 src/。
var Lr = Object.defineProperty;
var Kr = (t, e) => {
	for (var n in e) Lr(t, n, { get: e[n], enumerable: !0 });
};
import { drizzle as ri } from "npm:drizzle-orm@0.45.2/postgres-js";
import ai from "npm:postgres@3.4.9";
import { Hono as ei } from "npm:hono@4.12.32";
import { cors as ti } from "npm:hono@4.12.32/cors";
import { sql as ni } from "npm:drizzle-orm@0.45.2";
import { createMiddleware as qr } from "npm:hono@4.12.32/factory";
var Hr = new Set(["GET", "HEAD", "OPTIONS"]);
function qe(t) {
	if (!t || t === "null") return null;
	try {
		return new URL(t).origin;
	} catch {
		return null;
	}
}
function jr(t, e, n, r, o = []) {
	if (Hr.has(t.toUpperCase())) return !0;
	let a = qe(r);
	if (!a) return !1;
	let i = qe(e) ?? qe(n);
	return i ? i === a || o.includes(i) : !1;
}
function ke(t) {
	return (t ?? "")
		.split(",")
		.map((e) => qe(e.trim()))
		.filter((e) => !!e);
}
function O() {
	return qr(async (t, e) =>
		jr(t.req.method, t.req.header("Origin"), t.req.header("Referer"), t.req.url, ke(t.env.ADMIN_ORIGINS)) ? e() : t.json({ error: "CSRF 檢查失敗" }, 403),
	);
}
import { Hono as fo } from "npm:hono@4.12.32";
import { eq as xe, sql as ta } from "npm:drizzle-orm@0.45.2";
import { Hono as na } from "npm:hono@4.12.32";
import { getCookie as ra } from "npm:hono@4.12.32/cookie";
import { createMiddleware as aa } from "npm:hono@4.12.32/factory";
var He = {};
Kr(He, {
	PLATFORMS: () => Gr,
	adminUsers: () => L,
	apiAttempts: () => K,
	appConfig: () => se,
	auditLogs: () => Y,
	automationKeywords: () => N,
	automationRuns: () => g,
	automations: () => f,
	contactAutomations: () => W,
	contacts: () => h,
	eventJobs: () => x,
	instagramAccounts: () => y,
	instagramMedia: () => _,
	loginRateLimits: () => X,
	publicReplyVariants: () => te,
	sendCounters: () => Z,
	systemSettings: () => H,
	webhookEvents: () => C,
});
import { pgTable as $, text as d, integer as T, uniqueIndex as Re, index as Q } from "npm:drizzle-orm@0.45.2/pg-core";
var b = () => new Date().toISOString(),
	L = $("admin_users", {
		id: d("id").primaryKey(),
		email: d("email").notNull().unique(),
		passwordHash: d("password_hash").notNull(),
		createdAt: d("created_at").notNull().$defaultFn(b),
		updatedAt: d("updated_at").notNull().$defaultFn(b),
	}),
	H = $("system_settings", {
		id: d("id").primaryKey(),
		emergencyStop: T("emergency_stop").notNull().default(0),
		maxPublicRepliesPerMinute: T("max_public_replies_per_minute"),
		maxPrivateRepliesPerMinute: T("max_private_replies_per_minute"),
		maxPublicRepliesPerDay: T("max_public_replies_per_day"),
		maxPrivateRepliesPerDay: T("max_private_replies_per_day"),
		createdAt: d("created_at").notNull().$defaultFn(b),
		updatedAt: d("updated_at").notNull().$defaultFn(b),
	}),
	Gr = ["instagram", "facebook"],
	y = $("instagram_accounts", {
		id: d("id").primaryKey(),
		instagramAccountId: d("instagram_account_id").notNull().unique(),
		platform: d("platform").notNull().default("instagram"),
		username: d("username"),
		profilePictureUrl: d("profile_picture_url"),
		accountType: d("account_type"),
		tokenExpiresAt: d("token_expires_at"),
		accessToken: d("access_token"),
		tokenRefreshedAt: d("token_refreshed_at"),
		webhookSubscribed: T("webhook_subscribed").notNull().default(0),
		automationEnabled: T("automation_enabled").notNull().default(1),
		circuitBreakerStatus: d("circuit_breaker_status").notNull().default("closed"),
		lastWebhookReceivedAt: d("last_webhook_received_at"),
		createdAt: d("created_at").notNull().$defaultFn(b),
		updatedAt: d("updated_at").notNull().$defaultFn(b),
	}),
	_ = $(
		"instagram_media",
		{
			id: d("id").primaryKey(),
			instagramAccountId: d("instagram_account_id")
				.notNull()
				.references(() => y.id),
			instagramMediaId: d("instagram_media_id").notNull().unique(),
			platform: d("platform").notNull().default("instagram"),
			mediaType: d("media_type").notNull(),
			caption: d("caption"),
			thumbnailUrl: d("thumbnail_url"),
			permalink: d("permalink"),
			publishedAt: d("published_at"),
			lastSyncedAt: d("last_synced_at"),
			deletedAt: d("deleted_at"),
			createdAt: d("created_at").notNull().$defaultFn(b),
			updatedAt: d("updated_at").notNull().$defaultFn(b),
		},
		(t) => [Q("idx_media_account").on(t.instagramAccountId)],
	),
	f = $("automations", {
		id: d("id").primaryKey(),
		instagramMediaId: d("instagram_media_id")
			.unique()
			.references(() => _.id),
		applyScope: d("apply_scope").notNull().default("media"),
		platform: d("platform"),
		name: d("name").notNull(),
		status: d("status").notNull().default("draft"),
		matchType: d("match_type").notNull().default("contains_any"),
		publicReplyEnabled: T("public_reply_enabled").notNull().default(1),
		privateReplyEnabled: T("private_reply_enabled").notNull().default(1),
		openingDm: d("opening_dm"),
		buttonText: d("button_text"),
		buttonUrl: d("button_url"),
		dailyLimit: T("daily_limit"),
		excludeOwnComments: T("exclude_own_comments").notNull().default(1),
		followGateEnabled: T("follow_gate_enabled").notNull().default(0),
		notFollowingText: d("not_following_text"),
		recheckButtonText: d("recheck_button_text"),
		emailCaptureEnabled: T("email_capture_enabled").notNull().default(0),
		emailPromptText: d("email_prompt_text"),
		claimButtonText: d("claim_button_text"),
		deliveryText: d("delivery_text"),
		tag: d("tag"),
		oncePerContact: T("once_per_contact").notNull().default(0),
		createdAt: d("created_at").notNull().$defaultFn(b),
		updatedAt: d("updated_at").notNull().$defaultFn(b),
	}),
	h = $(
		"contacts",
		{
			igsid: d("igsid").primaryKey(),
			platform: d("platform").notNull().default("instagram"),
			username: d("username"),
			name: d("name"),
			email: d("email"),
			tags: d("tags").notNull().default("[]"),
			isFollower: T("is_follower"),
			state: d("state"),
			firstSeenAt: d("first_seen_at").notNull().$defaultFn(b),
			lastSeenAt: d("last_seen_at").notNull().$defaultFn(b),
			createdAt: d("created_at").notNull().$defaultFn(b),
			updatedAt: d("updated_at").notNull().$defaultFn(b),
		},
		(t) => [Q("idx_contacts_last_seen").on(t.lastSeenAt)],
	),
	W = $(
		"contact_automations",
		{
			id: d("id").primaryKey(),
			igsid: d("igsid").notNull(),
			automationId: d("automation_id").notNull(),
			firstTriggeredAt: d("first_triggered_at").notNull().$defaultFn(b),
			deliveredAt: d("delivered_at"),
		},
		(t) => [Re("contact_automations_igsid_automation_unique").on(t.igsid, t.automationId), Q("idx_contact_automations_automation").on(t.automationId)],
	),
	N = $(
		"automation_keywords",
		{
			id: d("id").primaryKey(),
			automationId: d("automation_id").notNull(),
			keyword: d("keyword").notNull(),
			normalizedKeyword: d("normalized_keyword").notNull(),
			createdAt: d("created_at").notNull().$defaultFn(b),
		},
		(t) => [
			Re("automation_keywords_automation_id_normalized_keyword_unique").on(t.automationId, t.normalizedKeyword),
			Q("idx_keywords_automation").on(t.automationId),
		],
	),
	te = $("public_reply_variants", {
		id: d("id").primaryKey(),
		automationId: d("automation_id").notNull(),
		message: d("message").notNull(),
		enabled: T("enabled").notNull().default(1),
		createdAt: d("created_at").notNull().$defaultFn(b),
		updatedAt: d("updated_at").notNull().$defaultFn(b),
	}),
	C = $(
		"webhook_events",
		{
			id: d("id").primaryKey(),
			eventKey: d("event_key").notNull().unique(),
			eventType: d("event_type").notNull(),
			instagramAccountId: d("instagram_account_id"),
			instagramMediaId: d("instagram_media_id"),
			instagramCommentId: d("instagram_comment_id"),
			rawPayload: d("raw_payload").notNull(),
			signatureValid: T("signature_valid").notNull(),
			status: d("status").notNull().default("received"),
			duplicateCount: T("duplicate_count").notNull().default(0),
			receivedAt: d("received_at").notNull().$defaultFn(b),
			lastReceivedAt: d("last_received_at").notNull().$defaultFn(b),
			processedAt: d("processed_at"),
		},
		(t) => [Q("idx_webhook_comment").on(t.instagramCommentId), Q("idx_webhook_received").on(t.receivedAt)],
	),
	g = $(
		"automation_runs",
		{
			id: d("id").primaryKey(),
			automationId: d("automation_id").notNull(),
			webhookEventId: d("webhook_event_id").references(() => C.id),
			instagramCommentId: d("instagram_comment_id").notNull(),
			instagramMediaId: d("instagram_media_id").notNull(),
			commenterId: d("commenter_id"),
			commenterUsername: d("commenter_username"),
			originalCommentText: d("original_comment_text"),
			normalizedCommentText: d("normalized_comment_text"),
			matchedKeyword: d("matched_keyword"),
			status: d("status").notNull(),
			publicReplyMessage: d("public_reply_message"),
			publicReplyStatus: d("public_reply_status"),
			privateReplyStatus: d("private_reply_status"),
			retryCount: T("retry_count").notNull().default(0),
			startedAt: d("started_at"),
			completedAt: d("completed_at"),
			createdAt: d("created_at").notNull().$defaultFn(b),
			updatedAt: d("updated_at").notNull().$defaultFn(b),
		},
		(t) => [
			Re("automation_runs_automation_id_instagram_comment_id_unique").on(t.automationId, t.instagramCommentId),
			Q("idx_runs_status").on(t.status),
			Q("idx_runs_created").on(t.createdAt),
			Q("idx_runs_media").on(t.instagramMediaId),
		],
	),
	K = $(
		"api_attempts",
		{
			id: d("id").primaryKey(),
			automationRunId: d("automation_run_id").notNull(),
			actionType: d("action_type").notNull(),
			attemptNumber: T("attempt_number").notNull(),
			httpStatus: T("http_status"),
			failureReason: d("failure_reason"),
			metaErrorCode: d("meta_error_code"),
			metaErrorSubcode: d("meta_error_subcode"),
			metaErrorMessage: d("meta_error_message"),
			metaTraceId: d("meta_trace_id"),
			requestPayloadRedacted: d("request_payload_redacted"),
			responsePayloadRedacted: d("response_payload_redacted"),
			startedAt: d("started_at").notNull().$defaultFn(b),
			completedAt: d("completed_at"),
		},
		(t) => [Q("idx_attempts_run").on(t.automationRunId)],
	),
	Y = $("audit_logs", {
		id: d("id").primaryKey(),
		adminUserId: d("admin_user_id"),
		action: d("action").notNull(),
		entityType: d("entity_type"),
		entityId: d("entity_id"),
		metadata: d("metadata"),
		ipAddress: d("ip_address"),
		createdAt: d("created_at").notNull().$defaultFn(b),
	}),
	X = $(
		"login_rate_limits",
		{
			id: d("id").primaryKey(),
			ipAddress: d("ip_address").notNull(),
			windowStart: d("window_start").notNull(),
			attemptCount: T("attempt_count").notNull().default(0),
			createdAt: d("created_at").notNull().$defaultFn(b),
			updatedAt: d("updated_at").notNull().$defaultFn(b),
		},
		(t) => [Q("idx_login_rate_limits_ip").on(t.ipAddress), Re("login_rate_limits_ip_window_unique").on(t.ipAddress, t.windowStart)],
	),
	Z = $(
		"send_counters",
		{
			id: d("id").primaryKey(),
			scopeKey: d("scope_key").notNull(),
			windowStart: d("window_start").notNull(),
			count: T("count").notNull().default(0),
			createdAt: d("created_at").notNull().$defaultFn(b),
			updatedAt: d("updated_at").notNull().$defaultFn(b),
		},
		(t) => [Re("send_counters_scope_window_unique").on(t.scopeKey, t.windowStart)],
	),
	x = $(
		"event_jobs",
		{
			id: d("id").primaryKey(),
			message: d("message").notNull(),
			status: d("status").notNull().default("pending"),
			attempts: T("attempts").notNull().default(0),
			nextRunAt: d("next_run_at").notNull().$defaultFn(b),
			lastError: d("last_error"),
			createdAt: d("created_at").notNull().$defaultFn(b),
			updatedAt: d("updated_at").notNull().$defaultFn(b),
		},
		(t) => [Q("idx_event_jobs_due").on(t.status, t.nextRunAt)],
	),
	se = $("app_config", { key: d("key").primaryKey(), value: d("value").notNull(), updatedAt: d("updated_at").notNull().$defaultFn(b) });
var Vt = "SHA-256";
var Wt = new TextEncoder();
function jt(t) {
	let e = "";
	for (let n of t) e += String.fromCharCode(n);
	return btoa(e);
}
function Gt(t) {
	let e = atob(t),
		n = new Uint8Array(e.length);
	for (let r = 0; r < e.length; r += 1) n[r] = e.charCodeAt(r);
	return n;
}
async function Vr(t, e, n) {
	let r = await crypto.subtle.importKey("raw", new Uint8Array(t), "PBKDF2", !1, ["deriveBits"]),
		o = new Uint8Array(e),
		a = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: o, iterations: n, hash: Vt }, r, 256);
	return new Uint8Array(a);
}
async function zt(t, e, n, r) {
	let o = t;
	for (let a = 0; a < r; a += 1) o = await Vr(o, e, n);
	return o;
}
function Wr(t, e) {
	if (t.length !== e.length) return !1;
	let n = 0;
	for (let r = 0; r < t.length; r += 1) n |= t[r] ^ e[r];
	return n === 0;
}
async function je(t) {
	let e = crypto.getRandomValues(new Uint8Array(16)),
		n = await zt(Wt.encode(t), e, 1e5, 6);
	return `pbkdf2$${Vt.toLowerCase().replace("-", "")}$100000x6$${jt(e)}$${jt(n)}`;
}
async function St(t, e) {
	let n = e.split("$");
	if (n.length !== 5 || n[0] !== "pbkdf2") return !1;
	let [r, o] = n[2].split("x"),
		a = Number.parseInt(r, 10),
		i = Number.parseInt(o ?? "1", 10);
	if (!Number.isInteger(a) || a <= 0 || !Number.isInteger(i) || i <= 0) return !1;
	let s, c;
	try {
		((s = Gt(n[3])), (c = Gt(n[4])));
	} catch {
		return !1;
	}
	let u = await zt(Wt.encode(t), s, a, i);
	return Wr(u, c);
}
var At = null;
function Jt() {
	return (At || (At = je("timing-equalization-dummy-password")), At);
}
import { and as zr, eq as Jr, lt as Yr, sql as Xr } from "npm:drizzle-orm@0.45.2";
import { createMiddleware as Xt } from "npm:hono@4.12.32/factory";
function z(t) {
	let e = t.header("CF-Connecting-IP");
	if (e) return e;
	let n = t.header("X-Forwarded-For");
	return (n && n.split(",")[0].trim()) || null;
}
var Yt = 900,
	Qr = 10,
	Qt = 120,
	Zt = 60;
function bt(t) {
	let e = Math.floor(t / 1e3 / Yt) * Yt;
	return new Date(e * 1e3).toISOString();
}
async function Zr(t, e, n = Date.now()) {
	try {
		let r = bt(n);
		await t.delete(X).where(zr(Jr(X.ipAddress, e), Yr(X.windowStart, r)));
		let a = (
			await t
				.insert(X)
				.values({ id: crypto.randomUUID(), ipAddress: e, windowStart: r, attemptCount: 1 })
				.onConflictDoUpdate({ target: [X.ipAddress, X.windowStart], set: { attemptCount: Xr`${X.attemptCount} + 1`, updatedAt: new Date().toISOString() } })
				.returning({ attemptCount: X.attemptCount })
		)[0]?.attemptCount;
		return typeof a != "number" ? !1 : a <= Qr;
	} catch {
		return !1;
	}
}
function Ge() {
	return Xt(async (t, e) => {
		let n = z(t.req) ?? "unknown";
		return (await Zr(t.env.DB, n)) ? e() : t.json({ error: "登入嘗試次數過多，請稍後再試。" }, 429);
	});
}
function U() {
	return Xt(async (t, e) => {
		let n = t.get("adminUserId") ?? z(t.req) ?? "anonymous";
		try {
			let { success: r } = await t.env.ADMIN_RATE_LIMITER.limit({ key: n });
			if (!r) return t.json({ error: "請求過於頻繁，請稍後再試。" }, 429);
		} catch {
			return t.json({ error: "頻率限制檢查失敗。" }, 429);
		}
		return e();
	});
}
var We = "ig_admin_session",
	Ve = new TextEncoder(),
	ea = new TextDecoder();
function en(t) {
	let e = "";
	for (let n of t) e += String.fromCharCode(n);
	return btoa(e).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function tn(t) {
	let e = t.replace(/-/g, "+").replace(/_/g, "/"),
		n = atob(e),
		r = new Uint8Array(n.length);
	for (let o = 0; o < n.length; o += 1) r[o] = n.charCodeAt(o);
	return r;
}
async function nn(t) {
	return crypto.subtle.importKey("raw", Ve.encode(t), { name: "HMAC", hash: "SHA-256" }, !1, ["sign", "verify"]);
}
async function Te(t, e, n) {
	let r = Math.floor(Date.now() / 1e3),
		o = { sub: e, kid: "1", iat: r, exp: r + n },
		a = en(Ve.encode(JSON.stringify(o))),
		i = await nn(t),
		s = await crypto.subtle.sign("HMAC", i, Ve.encode(a)),
		c = en(new Uint8Array(s));
	return `${a}.${c}`;
}
async function ze(t, e) {
	if (!e || typeof e != "string") return { valid: !1 };
	let n = e.split(".");
	if (n.length !== 2) return { valid: !1 };
	let [r, o] = n;
	if (!r || !o) return { valid: !1 };
	let a;
	try {
		a = tn(o);
	} catch {
		return { valid: !1 };
	}
	let i = await nn(t),
		s;
	try {
		s = await crypto.subtle.verify("HMAC", i, a, Ve.encode(r));
	} catch {
		return { valid: !1 };
	}
	if (!s) return { valid: !1 };
	let c;
	try {
		c = JSON.parse(ea.decode(tn(r)));
	} catch {
		return { valid: !1 };
	}
	return typeof c.sub != "string" || c.sub.length === 0
		? { valid: !1 }
		: typeof c.exp != "number" || !Number.isFinite(c.exp)
			? { valid: !1 }
			: Math.floor(Date.now() / 1e3) >= c.exp
				? { valid: !1 }
				: { valid: !0, payload: c };
}
function It(t, e) {
	return `${We}=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${e}`;
}
function rn() {
	return `${We}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
var Je = 3600 * 8;
async function ce(t, e) {
	try {
		await t.DB.insert(Y).values({
			id: crypto.randomUUID(),
			adminUserId: e.adminUserId,
			action: e.action,
			entityType: "admin_session",
			entityId: e.adminUserId,
			metadata: e.metadata ? JSON.stringify(e.metadata) : null,
			ipAddress: e.ipAddress,
		});
	} catch {}
}
function J() {
	return aa(async (t, e) => {
		let n = t.req.header("Authorization"),
			o = (n?.startsWith("Bearer ") ? n.slice(7).trim() : void 0) || ra(t, We),
			a = await ze(t.env.ADMIN_SESSION_SECRET, o);
		return a.valid ? (t.set("adminUserId", a.payload.sub), e()) : t.json({ error: "未授權" }, 401);
	});
}
var Ye = 12,
	Xe = 256,
	oa = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function an() {
	let t = new na();
	return (
		t.get("/setup-status", async (e) => {
			let r = await e.env.DB.select({ id: L.id }).from(L).limit(1);
			return e.json({ needsSetup: r.length === 0 });
		}),
		t.post("/setup", O(), Ge(), async (e) => {
			let n = z(e.req),
				r;
			try {
				r = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let o = typeof r.email == "string" ? r.email.trim() : "",
				a = typeof r.password == "string" ? r.password : "";
			if (!oa.test(o)) return e.json({ error: "Email 格式不正確" }, 400);
			if (a.length < Ye) return e.json({ error: `密碼長度至少需要 ${Ye} 個字元` }, 400);
			if (a.length > Xe) return e.json({ error: `密碼長度不可超過 ${Xe} 個字元` }, 400);
			let i = e.env.DB;
			if ((await i.select({ id: L.id }).from(L).limit(1)).length > 0)
				return (await ce(e.env, { adminUserId: null, action: "admin.setup.rejected", ipAddress: n }), e.json({ error: "系統已完成初始設定" }, 403));
			let c = crypto.randomUUID(),
				u = await je(a),
				l = new Date().toISOString();
			if (
				(await i.execute(ta`
      INSERT INTO admin_users (id, email, password_hash, created_at, updated_at)
      SELECT ${c}, ${o}, ${u}, ${l}, ${l}
      WHERE NOT EXISTS (SELECT 1 FROM admin_users)
    `),
				!(await i.select().from(L).where(xe(L.id, c)).limit(1))[0])
			)
				return (await ce(e.env, { adminUserId: null, action: "admin.setup.rejected", ipAddress: n }), e.json({ error: "系統已完成初始設定" }, 403));
			let m = await Te(e.env.ADMIN_SESSION_SECRET, c, Je);
			return (
				e.header("Set-Cookie", It(m, Je)),
				await ce(e.env, { adminUserId: c, action: "admin.setup.success", ipAddress: n }),
				e.json({ ok: !0, token: m })
			);
		}),
		t.get("/me", J(), U(), async (e) => {
			let r = await e.env.DB.select({ email: L.email })
				.from(L)
				.where(xe(L.id, e.get("adminUserId")))
				.limit(1);
			return r[0] ? e.json({ email: r[0].email }) : e.json({ error: "未授權" }, 401);
		}),
		t.post("/change-password", O(), J(), Ge(), async (e) => {
			let n = z(e.req),
				r;
			try {
				r = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let o = typeof r.currentPassword == "string" ? r.currentPassword : "",
				a = typeof r.newPassword == "string" ? r.newPassword : "";
			if (!o) return e.json({ error: "請輸入目前密碼" }, 400);
			if (a.length < Ye) return e.json({ error: `新密碼長度至少需要 ${Ye} 個字元` }, 400);
			if (a.length > Xe) return e.json({ error: `新密碼長度不可超過 ${Xe} 個字元` }, 400);
			let i = e.env.DB,
				s = e.get("adminUserId"),
				u = (await i.select().from(L).where(xe(L.id, s)).limit(1))[0];
			return u
				? (await St(o, u.passwordHash))
					? (await i
							.update(L)
							.set({ passwordHash: await je(a), updatedAt: new Date().toISOString() })
							.where(xe(L.id, s)),
						await ce(e.env, { adminUserId: s, action: "admin.password.change.success", ipAddress: n }),
						e.json({ ok: !0 }))
					: (await ce(e.env, { adminUserId: s, action: "admin.password.change.failure", ipAddress: n }), e.json({ error: "目前密碼不正確" }, 400))
				: e.json({ error: "未授權" }, 401);
		}),
		t.post("/login", O(), Ge(), async (e) => {
			let n = z(e.req),
				r;
			try {
				r = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let o = typeof r.email == "string" ? r.email : "",
				a = typeof r.password == "string" ? r.password : "";
			if (!o || !a) return e.json({ error: "請輸入 Email 與密碼" }, 400);
			let c = (await e.env.DB.select().from(L).where(xe(L.email, o)).limit(1))[0],
				u = c ? c.passwordHash : await Jt(),
				l = await St(a, u);
			if (!c || !l)
				return (await ce(e.env, { adminUserId: c ? c.id : null, action: "admin.login.failure", ipAddress: n }), e.json({ error: "Email 或密碼錯誤" }, 401));
			let p = await Te(e.env.ADMIN_SESSION_SECRET, c.id, Je);
			return (
				e.header("Set-Cookie", It(p, Je)),
				await ce(e.env, { adminUserId: c.id, action: "admin.login.success", ipAddress: n }),
				e.json({ ok: !0, token: p })
			);
		}),
		t.post("/logout", O(), J(), U(), async (e) => {
			let n = z(e.req);
			return (e.header("Set-Cookie", rn()), await ce(e.env, { adminUserId: e.get("adminUserId"), action: "admin.logout", ipAddress: n }), e.json({ ok: !0 }));
		}),
		t
	);
}
import { and as la, eq as B } from "npm:drizzle-orm@0.45.2";
import { Hono as ca } from "npm:hono@4.12.32";
import { toSimplified as ia } from "npm:chinese-simple2traditional@2.3.2";
function de(t) {
	let e = t.replace(/[！-～]/g, (n) => String.fromCharCode(n.charCodeAt(0) - 65248));
	return ((e = e.replace(/\u3000/g, " ")), (e = e.toLowerCase()), (e = ia(e)), (e = e.replace(/\s+/g, " ")), e.trim());
}
function sa(t) {
	if (!t) return !1;
	try {
		return new URL(t).protocol === "https:";
	} catch {
		return !1;
	}
}
var Et = ["contains_any", "exact_any", "all_comments"];
function on(t) {
	let e = [];
	(t.automationExists || e.push("automation_not_found"), t.matchType !== "all_comments" && t.keywordCount < 1 && e.push("keywords_required"));
	let n = t.applyScope === "dm_keyword" || t.applyScope === "ref";
	return (
		n && (t.privateReplyEnabled || e.push("private_reply_required_for_message_trigger"), t.matchType === "all_comments" && e.push("keywords_required")),
		(t.followGateEnabled || t.emailCaptureEnabled) && !t.privateReplyEnabled && e.push("private_reply_required_for_gate"),
		n ||
			(t.isStory
				? t.privateReplyEnabled || e.push("private_reply_required_for_story")
				: !t.publicReplyEnabled && !t.privateReplyEnabled && e.push("at_least_one_reply_required")),
		t.privateReplyEnabled && (!t.openingDm || t.openingDm.trim() === "") && e.push("opening_dm_required"),
		t.buttonUrl && !sa(t.buttonUrl) && e.push("button_url_invalid"),
		t.tokenHealthy || e.push("token_unhealthy"),
		t.emergencyStop && e.push("emergency_stop_active"),
		e
	);
}
var da = ["media", "next_post", "account_default", "dm_keyword", "ref"];
function sn(t) {
	return t === "instagram" || t === "facebook" ? t : null;
}
var ua = ["notFollowingText", "recheckButtonText", "emailPromptText", "claimButtonText", "deliveryText", "tag"],
	ma = ["followGateEnabled", "emailCaptureEnabled", "oncePerContact"];
function ln(t) {
	let e = {};
	for (let n of ua) {
		let r = t[n];
		r !== void 0 && (e[n] = typeof r == "string" && r.trim() ? r.trim().slice(0, n === "tag" ? 40 : 640) : null);
	}
	for (let n of ma) typeof t[n] == "boolean" && (e[n] = t[n] ? 1 : 0);
	return e;
}
function Qe(t) {
	return Array.isArray(t) ? t.filter((e) => typeof e == "string" && e.trim().length > 0) : [];
}
async function cn(t, e, n) {
	await t.delete(N).where(B(N.automationId, e));
	let r = new Set();
	for (let o of n) {
		let a = de(o);
		!a || r.has(a) || (r.add(a), await t.insert(N).values({ id: crypto.randomUUID(), automationId: e, keyword: o, normalizedKeyword: a }));
	}
}
async function dn(t, e, n) {
	await t.delete(te).where(B(te.automationId, e));
	for (let r of n.slice(0, 5)) await t.insert(te).values({ id: crypto.randomUUID(), automationId: e, message: r, enabled: 1 });
}
function un() {
	let t = new ca();
	return (
		t.use("*", O(), J(), U()),
		t.post("/", async (e) => {
			let n;
			try {
				n = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let r = da.includes(n.applyScope) ? n.applyScope : "media";
			if (!n.name || (r === "media" && !n.instagramMediaId)) return e.json({ error: "缺少必要欄位" }, 400);
			let o = n.matchType ?? "contains_any";
			if (!Et.includes(o)) return e.json({ error: "比對模式無效" }, 400);
			let a = e.env.DB;
			if (r === "media" && (await a.select().from(_).where(B(_.id, n.instagramMediaId)).limit(1)).length === 0) return e.json({ error: "貼文不存在" }, 404);
			let i = sn(n.platform);
			if (
				r === "account_default" &&
				(await a.select().from(f).where(B(f.applyScope, "account_default"))).find((l) => l.platform == null || i == null || l.platform === i)
			)
				return e.json({ error: "這個平台已有全帳號預設自動化，請編輯既有的那一組" }, 409);
			let s = crypto.randomUUID();
			return (
				await a
					.insert(f)
					.values({
						id: s,
						instagramMediaId: r === "media" ? n.instagramMediaId : null,
						applyScope: r,
						platform: r === "media" ? null : i,
						name: n.name,
						status: "draft",
						matchType: o,
						publicReplyEnabled: n.publicReplyEnabled === !1 ? 0 : 1,
						privateReplyEnabled: n.privateReplyEnabled === !1 ? 0 : 1,
						openingDm: n.openingDm ?? null,
						buttonText: n.buttonText ?? null,
						buttonUrl: n.buttonUrl ?? null,
						dailyLimit: typeof n.dailyLimit == "number" ? n.dailyLimit : null,
						...ln(n),
					}),
				await cn(a, s, Qe(n.keywords)),
				await dn(a, s, Qe(n.publicReplyVariants)),
				e.json({ id: s }, 201)
			);
		}),
		t.get("/overview", async (e) => {
			let n = e.env.DB,
				r = await n.select().from(f),
				o = await n.select().from(_),
				a = await n.select().from(g),
				i = await n.select().from(N),
				s = await n.select().from(W),
				c = new Map(o.map((l) => [l.id, l])),
				u = r
					.filter((l) => !(l.instagramMediaId ? c.get(l.instagramMediaId) : void 0)?.deletedAt)
					.map((l) => {
						let p = l.instagramMediaId ? c.get(l.instagramMediaId) : void 0,
							m = a.filter((w) => w.automationId === l.id);
						return {
							automationId: l.id,
							name: l.name,
							status: l.status,
							applyScope: l.applyScope,
							matchType: l.matchType,
							keywordCount: i.filter((w) => w.automationId === l.id).length,
							media: p
								? { id: p.id, platform: p.platform, mediaType: p.mediaType, caption: p.caption, thumbnailUrl: p.thumbnailUrl, permalink: p.permalink }
								: null,
							stats: {
								triggered: m.length,
								publicReplySuccess: m.filter((w) => w.publicReplyStatus === "success").length,
								dmSuccess: m.filter((w) => w.privateReplyStatus === "success").length,
								failures: m.filter((w) => w.status === "completed_with_errors").length,
								delivered: s.filter((w) => w.automationId === l.id && w.deliveredAt).length,
							},
							gated: l.followGateEnabled === 1 || l.emailCaptureEnabled === 1,
							platform: p ? p.platform : l.platform,
							tag: l.tag,
						};
					})
					.sort((l, p) => {
						let m = { active: 0, paused: 1, draft: 2 };
						return (m[l.status] ?? 9) - (m[p.status] ?? 9);
					});
			return e.json({ automations: u });
		}),
		t.get("/:id", async (e) => {
			let n = e.req.param("id"),
				r = e.env.DB,
				o = await r.select().from(f).where(B(f.id, n)).limit(1);
			if (o.length === 0) return e.json({ error: "自動化不存在" }, 404);
			let a = await r.select().from(N).where(B(N.automationId, n)),
				i = await r.select().from(te).where(B(te.automationId, n)),
				s = o[0].instagramMediaId ? ((await r.select().from(_).where(B(_.id, o[0].instagramMediaId)).limit(1))[0] ?? null) : null;
			return e.json({
				automation: o[0],
				media: s ? { id: s.id, platform: s.platform, mediaType: s.mediaType, caption: s.caption, thumbnailUrl: s.thumbnailUrl } : null,
				keywords: a.map((c) => c.keyword),
				publicReplyVariants: i.map((c) => c.message),
			});
		}),
		t.patch("/:id", async (e) => {
			let n = e.req.param("id"),
				r;
			try {
				r = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let o = e.env.DB,
				a = await o.select().from(f).where(B(f.id, n)).limit(1);
			if (a.length === 0) return e.json({ error: "自動化不存在" }, 404);
			let i = { updatedAt: new Date().toISOString() };
			return (
				typeof r.name == "string" && (i.name = r.name),
				r.matchType && Et.includes(r.matchType) && (i.matchType = r.matchType),
				typeof r.publicReplyEnabled == "boolean" && (i.publicReplyEnabled = r.publicReplyEnabled ? 1 : 0),
				typeof r.privateReplyEnabled == "boolean" && (i.privateReplyEnabled = r.privateReplyEnabled ? 1 : 0),
				r.openingDm !== void 0 && (i.openingDm = r.openingDm),
				r.buttonText !== void 0 && (i.buttonText = r.buttonText),
				r.buttonUrl !== void 0 && (i.buttonUrl = r.buttonUrl),
				typeof r.dailyLimit == "number" && (i.dailyLimit = r.dailyLimit),
				Object.assign(i, ln(r)),
				r.platform !== void 0 && a[0].applyScope !== "media" && a[0].applyScope !== "account_default" && (i.platform = sn(r.platform)),
				await o.update(f).set(i).where(B(f.id, n)),
				r.keywords !== void 0 && (await cn(o, n, Qe(r.keywords))),
				r.publicReplyVariants !== void 0 && (await dn(o, n, Qe(r.publicReplyVariants))),
				e.json({ ok: !0 })
			);
		}),
		t.post("/:id/activate", async (e) => {
			let n = e.req.param("id"),
				r = e.env.DB,
				a = (await r.select().from(f).where(B(f.id, n)).limit(1))[0],
				i = a ? await r.select().from(N).where(B(N.automationId, n)) : [],
				s = await r.select().from(H).limit(1),
				c = !0,
				u = null;
			if (a) {
				a.instagramMediaId && (u = (await r.select().from(_).where(B(_.id, a.instagramMediaId)).limit(1))[0] ?? null);
				let p = u
					? await r.select().from(y).where(B(y.id, u.instagramAccountId)).limit(1)
					: a.platform
						? await r.select().from(y).where(B(y.platform, a.platform)).limit(1)
						: await r.select().from(y).limit(1);
				p[0] && (c = p[0].circuitBreakerStatus === "closed");
			}
			let l = on({
				automationExists: !!a,
				matchType: a?.matchType ?? "",
				keywordCount: i.length,
				publicReplyEnabled: a?.publicReplyEnabled === 1,
				privateReplyEnabled: a?.privateReplyEnabled === 1,
				openingDm: a?.openingDm ?? null,
				buttonUrl: a?.buttonUrl ?? null,
				tokenHealthy: c,
				emergencyStop: s[0]?.emergencyStop === 1,
				isStory: u?.mediaType === "STORY",
				applyScope: a?.applyScope,
				followGateEnabled: a?.followGateEnabled === 1,
				emailCaptureEnabled: a?.emailCaptureEnabled === 1,
			});
			return l.length > 0
				? e.json({ error: "activation_failed", reasons: l }, 422)
				: (await r.update(f).set({ status: "active", updatedAt: new Date().toISOString() }).where(B(f.id, n)), e.json({ ok: !0 }));
		}),
		t.post("/:id/pause", async (e) => {
			let n = e.req.param("id"),
				r = e.env.DB;
			return (await r.select().from(f).where(B(f.id, n)).limit(1)).length === 0
				? e.json({ error: "自動化不存在" }, 404)
				: (await r
						.update(f)
						.set({ status: "paused", updatedAt: new Date().toISOString() })
						.where(la(B(f.id, n))),
					e.json({ ok: !0 }));
		}),
		t
	);
}
import { count as Pa, eq as Cn } from "npm:drizzle-orm@0.45.2";
import { Hono as Pn } from "npm:hono@4.12.32";
import { eq as pa, inArray as fa } from "npm:drizzle-orm@0.45.2";
var ga = ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "META_APP_ID", "META_APP_SECRET", "FACEBOOK_PAGE_ACCESS_TOKEN"];
async function Ce(t, e) {
	let n = await t
		.select()
		.from(se)
		.where(fa(se.key, [...e]));
	return Object.fromEntries(n.filter((r) => r.value !== "").map((r) => [r.key, r.value]));
}
async function pe(t, e) {
	let n = new Date().toISOString();
	for (let [r, o] of Object.entries(e))
		if (o !== void 0) {
			if (o === null || o === "") {
				await t.delete(se).where(pa(se.key, r));
				continue;
			}
			await t
				.insert(se)
				.values({ key: r, value: o, updatedAt: n })
				.onConflictDoUpdate({ target: se.key, set: { value: o, updatedAt: n } });
		}
}
async function Ze(t) {
	if (!t?.DB) return t;
	try {
		let e = await Ce(t.DB, ga);
		return Object.keys(e).length ? { ...t, ...e } : t;
	} catch {
		return t;
	}
}
import { eq as wn } from "npm:drizzle-orm@0.45.2";
import { and as Ia, eq as Rt } from "npm:drizzle-orm@0.45.2";
var Pe = new Set(["token_invalid", "permission_denied", "policy_restricted", "user_not_allowed"]),
	ya = new Set([429, 500, 502, 503, 504]);
function fe(t) {
	return t.nonRetryableReason ? !1 : !!(t.networkError || t.timeout || (t.httpStatus !== void 0 && ya.has(t.httpStatus)));
}
function mn(t, e) {
	let n = e?.error ?? {},
		r = typeof n.code == "number" ? n.code : void 0,
		o = { metaErrorCode: r !== void 0 ? String(r) : void 0, metaErrorMessage: typeof n.message == "string" ? n.message.slice(0, 300) : void 0 };
	return r === 190
		? { httpStatus: t, nonRetryableReason: "token_invalid", ...o }
		: r === 10 || r === 200 || r === 803
			? { httpStatus: t, nonRetryableReason: "permission_denied", ...o }
			: r === 100
				? { httpStatus: t, nonRetryableReason: "bad_request", ...o }
				: r === 368
					? { httpStatus: t, nonRetryableReason: "policy_restricted", ...o }
					: { httpStatus: t, ...o };
}
var Ae = class {
	cfg;
	doFetch;
	baseUrl;
	constructor(e) {
		((this.cfg = e), (this.doFetch = e.fetchImpl ?? ((n, r) => fetch(n, r))), (this.baseUrl = e.baseUrl ?? "https://graph.instagram.com"));
	}
	async get(e, n = {}) {
		let r = new URLSearchParams({ ...n, access_token: this.cfg.accessToken }),
			o = `${this.baseUrl}/${this.cfg.graphApiVersion}/${e}?${r.toString()}`,
			a;
		try {
			a = await this.doFetch(o, { method: "GET" });
		} catch {
			return { ok: !1, status: 0, failure: { networkError: !0 } };
		}
		let i = null;
		try {
			i = await a.json();
		} catch {
			i = null;
		}
		return a.ok ? { ok: !0, status: a.status, data: i } : { ok: !1, status: a.status, failure: mn(a.status, i) };
	}
	async post(e, n) {
		let r = `${this.baseUrl}/${this.cfg.graphApiVersion}/${e}`,
			o = new URLSearchParams({ ...n, access_token: this.cfg.accessToken }),
			a;
		try {
			a = await this.doFetch(r, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: o.toString() });
		} catch {
			return { ok: !1, status: 0, failure: { networkError: !0 } };
		}
		let i = null;
		try {
			i = await a.json();
		} catch {
			i = null;
		}
		if (a.ok) return { ok: !0, status: a.status, data: i };
		let s = mn(a.status, i);
		return { ok: !1, status: a.status, failure: s };
	}
};
import { and as wa, eq as kt } from "npm:drizzle-orm@0.45.2";
var _a = 1440 * 60 * 1e3,
	ha = 20,
	Aa = 1200 * 60 * 1e3,
	Sa = "https://graph.instagram.com/refresh_access_token";
async function ba(t, e) {
	return (
		(await t.select({ accessToken: y.accessToken }).from(y).where(kt(y.platform, "instagram")).limit(1))[0]?.accessToken || e.INSTAGRAM_ACCOUNT_ACCESS_TOKEN
	);
}
async function et(t, e) {
	return new Ae({ accessToken: await ba(t, e), graphApiVersion: e.META_GRAPH_API_VERSION, baseUrl: e.META_BASE_URL || void 0 });
}
async function fn(t, e, n = {}) {
	let r = n.nowMs ?? Date.now(),
		o = n.fetchImpl ?? ((m, w) => fetch(m, w)),
		a = (
			await t
				.select()
				.from(y)
				.where(wa(kt(y.platform, "instagram")))
				.limit(1)
		)[0];
	if (!a) return { refreshed: !1, reason: "no_account" };
	if (a.tokenRefreshedAt && r - Date.parse(a.tokenRefreshedAt) < Aa) return { refreshed: !1, reason: "refreshed_recently" };
	if (a.tokenExpiresAt && (Date.parse(a.tokenExpiresAt) - r) / _a > ha) return { refreshed: !1, reason: "not_due" };
	let i = a.accessToken || e.INSTAGRAM_ACCOUNT_ACCESS_TOKEN,
		s = `${Sa}?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: i })}`,
		c = {},
		u = 0;
	try {
		let m = await o(s, { method: "GET" });
		((u = m.status), (c = await m.json().catch(() => ({}))));
	} catch {
		return pn(t, a.id, "network_error");
	}
	if (u !== 200 || !c.access_token) return pn(t, a.id, `HTTP ${u} ${c.error?.code ?? ""} ${c.error?.message ?? ""}`.trim());
	let l = typeof c.expires_in == "number" ? c.expires_in : 1440 * 60 * 60,
		p = new Date(r).toISOString();
	return (
		await t
			.update(y)
			.set({ accessToken: c.access_token, tokenExpiresAt: new Date(r + l * 1e3).toISOString(), tokenRefreshedAt: p, updatedAt: p })
			.where(kt(y.id, a.id)),
		await t
			.insert(Y)
			.values({
				id: crypto.randomUUID(),
				adminUserId: null,
				action: "system.token_refreshed",
				entityType: "instagram_accounts",
				entityId: a.id,
				metadata: JSON.stringify({ expiresInDays: Math.round(l / 86400) }),
			}),
		{ refreshed: !0, reason: "ok" }
	);
}
async function pn(t, e, n) {
	return (
		await t
			.insert(Y)
			.values({
				id: crypto.randomUUID(),
				adminUserId: null,
				action: "system.token_refresh_failed",
				entityType: "instagram_accounts",
				entityId: e,
				metadata: JSON.stringify({ detail: n.slice(0, 300) }),
			}),
		{ refreshed: !1, reason: n }
	);
}
var Ea = "v24.0";
function ve(t) {
	let e = t.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
	return e ? new Ae({ accessToken: e, graphApiVersion: t.FACEBOOK_GRAPH_API_VERSION || Ea, baseUrl: "https://graph.facebook.com" }) : null;
}
async function gn(t, e) {
	return { metaClient: await et(t, e), facebookClient: ve(e) };
}
function tt(t, e) {
	return e === "facebook" ? (t.facebookClient ?? null) : t.metaClient;
}
async function j(t, e) {
	return (await t.select().from(y).where(Rt(y.platform, e)).limit(1))[0] ?? null;
}
async function yn(t, e, n) {
	return (
		(
			await t
				.select()
				.from(y)
				.where(Ia(Rt(y.instagramAccountId, e), Rt(y.platform, n)))
				.limit(1)
		)[0] ?? (await j(t, n))
	);
}
var ka = "feed,messages,messaging_postbacks,messaging_referrals";
function Tt(t) {
	let e = t.failure?.metaErrorMessage ? `｜Meta 回覆：(代碼 ${t.failure.metaErrorCode ?? "?"}) ${t.failure.metaErrorMessage}` : "";
	return `HTTP ${t.status}${e}`;
}
async function _n(t, e) {
	let n = await e.get("me", { fields: "id,name,picture{url}" });
	if (!n.ok || !n.data?.id)
		return { account: await j(t, "facebook"), error: `Facebook 粉專註冊失敗（${Tt(n)}）——請確認粉專存取權杖（FACEBOOK_PAGE_ACCESS_TOKEN）是否正確` };
	let r = new Date().toISOString(),
		o = await j(t, "facebook");
	return (
		o
			? await t
					.update(y)
					.set({
						instagramAccountId: n.data.id,
						username: n.data.name ?? o.username,
						profilePictureUrl: n.data.picture?.data?.url ?? o.profilePictureUrl,
						updatedAt: r,
					})
					.where(wn(y.id, o.id))
			: await t
					.insert(y)
					.values({
						id: crypto.randomUUID(),
						instagramAccountId: n.data.id,
						platform: "facebook",
						username: n.data.name ?? null,
						accountType: "FACEBOOK_PAGE",
						profilePictureUrl: n.data.picture?.data?.url ?? null,
					})
					.onConflictDoNothing(),
		{ account: await j(t, "facebook"), error: null }
	);
}
async function nt(t, e, n) {
	if (n.webhookSubscribed === 1) return null;
	let r = await e.post(`${n.instagramAccountId}/subscribed_apps`, { subscribed_fields: ka });
	return r.ok
		? (await t.update(y).set({ webhookSubscribed: 1, updatedAt: new Date().toISOString() }).where(wn(y.id, n.id)), null)
		: `Facebook 粉專事件通知訂閱失敗（${Tt(r)}）`;
}
async function hn(t, e) {
	let n = await t.get(`${e}/posts`, { fields: "id,message,full_picture,permalink_url,created_time,status_type", limit: "50" });
	return n.ok
		? {
				ok: !0,
				items: (n.data?.data ?? [])
					.filter((o) => !!o.id)
					.map((o) => ({
						id: o.id,
						media_type: o.status_type === "added_video" ? "FB_VIDEO" : "FB_POST",
						caption: o.message,
						media_url: o.full_picture,
						permalink: o.permalink_url,
						timestamp: o.created_time,
					})),
			}
		: { ok: !1, items: [], error: `抓取 Facebook 貼文失敗（${Tt(n)}）` };
}
var Ra = ["instagram_business_basic", "instagram_business_manage_messages", "instagram_business_manage_comments"],
	Ta = ["pages_show_list", "pages_messaging", "pages_manage_metadata", "pages_read_engagement", "pages_manage_engagement"],
	An = "comments,messages,messaging_postbacks,messaging_referral",
	xa = "feed,messages,messaging_postbacks,messaging_referrals",
	Ca = "v24.0",
	q = class extends Error {
		constructor(n, r) {
			super(r);
			this.code = n;
		}
		code;
	};
function xt(t) {
	return t.FACEBOOK_GRAPH_API_VERSION || Ca;
}
function Sn(t) {
	let e = (t.PUBLIC_API_BASE ?? "").replace(/\/$/, "");
	if (!e) throw new q("no_api_base", "系統網址未設定（PUBLIC_API_BASE）");
	return e;
}
function ge(t, e) {
	return `${Sn(t)}/api/oauth/${e}/callback`;
}
function bn(t, e) {
	if (!t.INSTAGRAM_APP_ID) throw new q("missing_app", "尚未填入 Instagram App ID");
	return `https://www.instagram.com/oauth/authorize?${new URLSearchParams({ client_id: t.INSTAGRAM_APP_ID, redirect_uri: ge(t, "instagram"), response_type: "code", scope: Ra.join(","), state: e })}`;
}
function In(t, e) {
	if (!t.META_APP_ID) throw new q("missing_app", "尚未填入 Meta App ID");
	let n = new URLSearchParams({ client_id: t.META_APP_ID, redirect_uri: ge(t, "facebook"), response_type: "code", scope: Ta.join(","), state: e });
	return `https://www.facebook.com/${xt(t)}/dialog/oauth?${n}`;
}
async function ue(t) {
	try {
		return await t.json();
	} catch {
		return {};
	}
}
function me(t) {
	let e = t?.error?.message ?? t?.error_message ?? t?.error_description ?? "";
	return typeof e == "string" ? e.slice(0, 200) : "";
}
async function En(t, e) {
	if (!t.INSTAGRAM_APP_ID || !t.INSTAGRAM_APP_SECRET) throw new q("missing_app", "尚未填入 Instagram App ID／App Secret");
	let n = new URLSearchParams({
			client_id: t.INSTAGRAM_APP_ID,
			client_secret: t.INSTAGRAM_APP_SECRET,
			grant_type: "authorization_code",
			redirect_uri: ge(t, "instagram"),
			code: e,
		}),
		r = await fetch("https://api.instagram.com/oauth/access_token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: n.toString(),
		}),
		o = await ue(r),
		a = o?.data?.[0]?.access_token ?? o?.access_token;
	if (!r.ok || typeof a != "string") throw new q("exchange_failed", `Instagram 授權碼換權杖失敗：${me(o) || `HTTP ${r.status}`}`);
	let i = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: t.INSTAGRAM_APP_SECRET, access_token: a }),
		s = await fetch(`https://graph.instagram.com/access_token?${i}`),
		c = await ue(s);
	if (!s.ok || typeof c?.access_token != "string") throw new q("exchange_failed", `Instagram 換長效權杖失敗：${me(c) || `HTTP ${s.status}`}`);
	let u = Number(c.expires_in);
	return { accessToken: c.access_token, expiresAt: Number.isFinite(u) && u > 0 ? new Date(Date.now() + u * 1e3).toISOString() : null };
}
async function kn(t, e) {
	let n = new URLSearchParams({ fields: "id,user_id,username,account_type,profile_picture_url", access_token: e }),
		r = await fetch(`https://graph.instagram.com/${t.META_GRAPH_API_VERSION || "v21.0"}/me?${n}`),
		o = await ue(r);
	if (!r.ok || !(o?.user_id || o?.id)) throw new q("profile_failed", `讀取 Instagram 帳號資料失敗：${me(o) || `HTTP ${r.status}`}`);
	return { id: String(o.user_id ?? o.id), username: o.username ?? null, accountType: o.account_type ?? null, profilePictureUrl: o.profile_picture_url ?? null };
}
async function Rn(t, e) {
	let n = new URLSearchParams({ subscribed_fields: An, access_token: e }),
		r = await fetch(`https://graph.instagram.com/${t.META_GRAPH_API_VERSION || "v21.0"}/me/subscribed_apps`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: n.toString(),
		});
	return r.ok ? null : `Instagram 帳號事件通知訂閱失敗：${me(await ue(r)) || `HTTP ${r.status}`}`;
}
async function Tn(t, e) {
	if (!t.META_APP_ID || !t.META_APP_SECRET) throw new q("missing_app", "尚未填入 Meta App ID／App Secret");
	let n = `https://graph.facebook.com/${xt(t)}`,
		r = new URLSearchParams({ client_id: t.META_APP_ID, client_secret: t.META_APP_SECRET, redirect_uri: ge(t, "facebook"), code: e }),
		o = await fetch(`${n}/oauth/access_token?${r}`),
		a = await ue(o);
	if (!o.ok || typeof a?.access_token != "string") throw new q("exchange_failed", `Facebook 授權碼換權杖失敗：${me(a) || `HTTP ${o.status}`}`);
	let i = new URLSearchParams({
			grant_type: "fb_exchange_token",
			client_id: t.META_APP_ID,
			client_secret: t.META_APP_SECRET,
			fb_exchange_token: a.access_token,
		}),
		s = await fetch(`${n}/oauth/access_token?${i}`),
		c = await ue(s);
	if (!s.ok || typeof c?.access_token != "string") throw new q("exchange_failed", `Facebook 換長效權杖失敗：${me(c) || `HTTP ${s.status}`}`);
	let u = new URLSearchParams({ fields: "id,name,access_token,picture{url}", limit: "100", access_token: c.access_token }),
		l = await fetch(`${n}/me/accounts?${u}`),
		p = await ue(l);
	if (!l.ok || !Array.isArray(p?.data)) throw new q("pages_failed", `讀取粉專清單失敗：${me(p) || `HTTP ${l.status}`}`);
	return p.data
		.filter((m) => typeof m?.id == "string" && typeof m?.access_token == "string")
		.map((m) => ({ id: m.id, name: m.name ?? m.id, accessToken: m.access_token, pictureUrl: m.picture?.data?.url ?? null }));
}
async function De(t, e) {
	if (!t.META_APP_ID || !t.META_APP_SECRET) return "尚未填入 Meta App ID／App Secret，無法自動設定事件通知";
	if (!t.WEBHOOK_VERIFY_TOKEN) return "系統驗證權杖未設定";
	let n = new URLSearchParams({
		object: e,
		callback_url: `${Sn(t)}/api/webhooks/meta/instagram`,
		verify_token: t.WEBHOOK_VERIFY_TOKEN,
		fields: e === "instagram" ? An : xa,
		include_values: "true",
		access_token: `${t.META_APP_ID}|${t.META_APP_SECRET}`,
	});
	try {
		let r = await fetch(`https://graph.facebook.com/${xt(t)}/${t.META_APP_ID}/subscriptions`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: n.toString(),
		});
		return r.ok ? null : `自動設定事件通知失敗：${me(await ue(r)) || `HTTP ${r.status}`}`;
	} catch {
		return "自動設定事件通知失敗：連不到 Meta";
	}
}
var va = 900,
	vn = (t) => `${t.ADMIN_SESSION_SECRET}:oauth-state`;
function Da(t) {
	return btoa(String.fromCharCode(...new TextEncoder().encode(t)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}
function Ma(t) {
	let e = atob(t.replace(/-/g, "+").replace(/_/g, "/"));
	return new TextDecoder().decode(Uint8Array.from(e, (n) => n.charCodeAt(0)));
}
async function Oa(t, e) {
	return Te(vn(t), Da(JSON.stringify(e)), va);
}
async function xn(t, e) {
	let n = await ze(vn(t), e);
	if (!n.valid) return null;
	try {
		let r = JSON.parse(Ma(n.payload.sub));
		return r && (r.p === "instagram" || r.p === "facebook") && typeof r.r == "string" ? r : null;
	} catch {
		return null;
	}
}
function Na(t, e) {
	if (typeof e != "string") return null;
	try {
		let n = new URL(e);
		return ke(t.ADMIN_ORIGINS).includes(n.origin) ? n.toString() : null;
	} catch {
		return null;
	}
}
function ne(t, e, n, r) {
	let o = new URL(t);
	return (o.searchParams.set("connect", e), o.searchParams.set("status", n), r && o.searchParams.set("message", r.slice(0, 300)), o.toString());
}
async function Ua(t, e, n, r) {
	let o = new Date().toISOString(),
		a = {
			instagramAccountId: e.id,
			username: e.username,
			accountType: e.accountType,
			profilePictureUrl: e.profilePictureUrl,
			accessToken: n.accessToken,
			tokenExpiresAt: n.expiresAt,
			tokenRefreshedAt: o,
			webhookSubscribed: r ? 1 : 0,
			circuitBreakerStatus: "closed",
			updatedAt: o,
		},
		i = await j(t, "instagram");
	i ? await t.update(y).set(a).where(Cn(y.id, i.id)) : await t.insert(y).values({ id: crypto.randomUUID(), platform: "instagram", ...a });
}
async function Dn(t, e) {
	let n = t.DB,
		r = new Date().toISOString();
	await pe(n, { FACEBOOK_PAGE_ACCESS_TOKEN: e.accessToken, FB_PAGE_CANDIDATES: null });
	let o = {
			instagramAccountId: e.id,
			username: e.name,
			accountType: "FACEBOOK_PAGE",
			profilePictureUrl: e.pictureUrl,
			webhookSubscribed: 0,
			circuitBreakerStatus: "closed",
			updatedAt: r,
		},
		a = await j(n, "facebook");
	a ? await n.update(y).set(o).where(Cn(y.id, a.id)) : await n.insert(y).values({ id: crypto.randomUUID(), platform: "facebook", ...o });
	let i = await j(n, "facebook"),
		s = ve({ ...t, FACEBOOK_PAGE_ACCESS_TOKEN: e.accessToken }),
		c = i && s ? await nt(n, s, i) : "粉專資料寫入失敗",
		u = await De({ ...t }, "page");
	return (await pe(n, { WEBHOOK_STATUS_PAGE: u ?? "ok" }), c);
}
function Mn() {
	let t = new Pn();
	(t.use("*", J(), U()),
		t.get("/status", async (e) => {
			let n = e.env,
				r = n.DB,
				o = await Ce(r, ["FB_PAGE_CANDIDATES", "WEBHOOK_STATUS_INSTAGRAM", "WEBHOOK_STATUS_PAGE"]),
				a = await j(r, "instagram"),
				i = await j(r, "facebook"),
				s = !!(a?.accessToken || n.INSTAGRAM_ACCOUNT_ACCESS_TOKEN?.trim()),
				c = !!n.FACEBOOK_PAGE_ACCESS_TOKEN?.trim(),
				[{ n: u }] = await r.select({ n: Pa() }).from(f),
				l = (n.PUBLIC_API_BASE ?? "").replace(/\/$/, ""),
				p = { instagram: null, facebook: null };
			try {
				p = { instagram: ge(n, "instagram"), facebook: ge(n, "facebook") };
			} catch {}
			return e.json({
				app: {
					instagramAppId: n.INSTAGRAM_APP_ID ?? null,
					hasInstagramAppSecret: !!n.INSTAGRAM_APP_SECRET?.trim(),
					metaAppId: n.META_APP_ID ?? null,
					hasMetaAppSecret: !!n.META_APP_SECRET?.trim(),
				},
				redirectUris: p,
				callbackUrl: l ? `${l}/api/webhooks/meta/instagram` : null,
				verifyToken: n.WEBHOOK_VERIFY_TOKEN ?? null,
				instagram:
					a && s
						? { username: a.username, profilePictureUrl: a.profilePictureUrl, subscribed: a.webhookSubscribed === 1, tokenExpiresAt: a.tokenExpiresAt }
						: null,
				facebook: i && c ? { name: i.username, profilePictureUrl: i.profilePictureUrl, subscribed: i.webhookSubscribed === 1 } : null,
				pendingPageChoice: !!o.FB_PAGE_CANDIDATES,
				webhook: { instagram: o.WEBHOOK_STATUS_INSTAGRAM ?? null, page: o.WEBHOOK_STATUS_PAGE ?? null },
				automationCount: Number(u),
			});
		}),
		t.put("/app", O(), async (e) => {
			let n;
			try {
				n = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let r = (a, i, s) => {
					if (a == null || a === "") return;
					if (typeof a != "string") return new Error(`${s}格式不正確`);
					let c = a.trim();
					return i.test(c) ? c : new Error(`${s}格式不正確，請確認是否複製完整（不要含空白或其他文字）`);
				},
				o = {
					INSTAGRAM_APP_ID: r(n.instagramAppId, /^\d{5,25}$/, "Instagram App ID "),
					INSTAGRAM_APP_SECRET: r(n.instagramAppSecret, /^[0-9a-f]{16,64}$/i, "Instagram App Secret "),
					META_APP_ID: r(n.metaAppId, /^\d{5,25}$/, "Meta App ID "),
					META_APP_SECRET: r(n.metaAppSecret, /^[0-9a-f]{16,64}$/i, "Meta App Secret "),
				};
			for (let a of Object.values(o)) if (a instanceof Error) return e.json({ error: a.message }, 400);
			return (await pe(e.env.DB, o), e.json({ ok: !0 }));
		}));
	for (let e of ["instagram", "facebook"])
		t.post(`/${e}/start`, O(), async (n) => {
			let r = {};
			try {
				r = await n.req.json();
			} catch {}
			let o = Na(n.env, r.returnTo);
			if (!o) return n.json({ error: "導回網址不在允許清單內" }, 400);
			try {
				let a = await Oa(n.env, { p: e, u: n.get("adminUserId"), r: o }),
					i = e === "instagram" ? bn(n.env, a) : In(n.env, a);
				return n.json({ url: i });
			} catch (a) {
				if (a instanceof q) return n.json({ error: a.message }, 400);
				throw a;
			}
		});
	return (
		t.get("/facebook/pages", async (e) => {
			let n = await Ce(e.env.DB, ["FB_PAGE_CANDIDATES"]),
				r = n.FB_PAGE_CANDIDATES ? JSON.parse(n.FB_PAGE_CANDIDATES) : [];
			return e.json({ pages: r.map((o) => ({ id: o.id, name: o.name, pictureUrl: o.pictureUrl })) });
		}),
		t.post("/facebook/select", O(), async (e) => {
			let n = {};
			try {
				n = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let r = await Ce(e.env.DB, ["FB_PAGE_CANDIDATES"]),
				a = (r.FB_PAGE_CANDIDATES ? JSON.parse(r.FB_PAGE_CANDIDATES) : []).find((s) => s.id === n.pageId);
			if (!a) return e.json({ error: "找不到這個粉專，請重新連結 Facebook" }, 404);
			let i = await Dn(e.env, a);
			return e.json({ ok: !0, warning: i });
		}),
		t.post("/webhooks/retry", O(), async (e) => {
			let n = await j(e.env.DB, "instagram"),
				r = await j(e.env.DB, "facebook"),
				o = {};
			return (
				n && (o.WEBHOOK_STATUS_INSTAGRAM = (await De(e.env, "instagram")) ?? "ok"),
				r && (o.WEBHOOK_STATUS_PAGE = (await De(e.env, "page")) ?? "ok"),
				await pe(e.env.DB, o),
				e.json({ ok: !0, ...o })
			);
		}),
		t
	);
}
function On() {
	let t = new Pn();
	return (
		t.get("/instagram/callback", async (e) => {
			let n = await xn(e.env, e.req.query("state"));
			if (!n || n.p !== "instagram") return e.text("連結逾時或網址無效，請回到後台重新按「連結 Instagram」。", 400);
			if (e.req.query("error")) return e.redirect(ne(n.r, "instagram", "cancelled"), 302);
			let r = e.req.query("code");
			if (!r) return e.redirect(ne(n.r, "instagram", "error", "Meta 沒有回傳授權碼"), 302);
			try {
				let o = await En(e.env, r.replace(/#_$/, "")),
					a = await kn(e.env, o.accessToken),
					i = await Rn(e.env, o.accessToken);
				await Ua(e.env.DB, a, o, !i);
				let s = await De(e.env, "instagram");
				return (await pe(e.env.DB, { WEBHOOK_STATUS_INSTAGRAM: s ?? "ok" }), e.redirect(ne(n.r, "instagram", i ? "warning" : "ok", i ?? void 0), 302));
			} catch (o) {
				let a = o instanceof q ? o.message : "連結過程發生錯誤，請再試一次";
				return e.redirect(ne(n.r, "instagram", "error", a), 302);
			}
		}),
		t.get("/facebook/callback", async (e) => {
			let n = await xn(e.env, e.req.query("state"));
			if (!n || n.p !== "facebook") return e.text("連結逾時或網址無效，請回到後台重新按「連結 Facebook」。", 400);
			if (e.req.query("error")) return e.redirect(ne(n.r, "facebook", "cancelled"), 302);
			let r = e.req.query("code");
			if (!r) return e.redirect(ne(n.r, "facebook", "error", "Meta 沒有回傳授權碼"), 302);
			try {
				let o = await Tn(e.env, r);
				if (o.length === 0) return e.redirect(ne(n.r, "facebook", "error", "這個 Facebook 帳號沒有可管理的粉專，或授權時沒有勾選粉專"), 302);
				if (o.length > 1) return (await pe(e.env.DB, { FB_PAGE_CANDIDATES: JSON.stringify(o) }), e.redirect(ne(n.r, "facebook", "choose"), 302));
				let a = await Dn(e.env, o[0]);
				return e.redirect(ne(n.r, "facebook", a ? "warning" : "ok", a ?? void 0), 302);
			} catch (o) {
				let a = o instanceof q ? o.message : "連結過程發生錯誤，請再試一次";
				return e.redirect(ne(n.r, "facebook", "error", a), 302);
			}
		}),
		t
	);
}
import { desc as Nn, eq as rt } from "npm:drizzle-orm@0.45.2";
import { Hono as Ba } from "npm:hono@4.12.32";
function Fn(t) {
	try {
		let e = JSON.parse(t);
		return Array.isArray(e) ? e.filter((n) => typeof n == "string") : [];
	} catch {
		return [];
	}
}
function Un(t, e) {
	let n = (e.q ?? "").trim().toLowerCase();
	return t
		.map((r) => ({ ...r, tags: Fn(r.tags) }))
		.filter(
			(r) =>
				!(
					(e.hasEmail === "1" && !r.email) ||
					(e.tag && !r.tags.includes(e.tag)) ||
					(n && ![r.username, r.name, r.email].filter(Boolean).join(" ").toLowerCase().includes(n))
				),
		);
}
function Fa(t) {
	let e = /^[=+\-@]/.test(t) ? `'${t}` : t;
	return /[",\r\n]/.test(e) || e !== t ? `"${e.replace(/"/g, '""')}"` : e;
}
function Bn(t) {
	if (!t) return "";
	let e = Date.parse(t);
	return Number.isNaN(e) ? "" : new Date(e + 8 * 36e5).toISOString().slice(0, 16).replace("T", " ");
}
function $a(t) {
	let n = [["平台", "ID", "帳號", "名稱", "Email", "標籤", "有追蹤", "首次互動", "最後互動"].join(",")];
	for (let r of t)
		n.push(
			[
				r.platform === "facebook" ? "Facebook" : "Instagram",
				r.igsid,
				r.username ?? "",
				r.name ?? "",
				r.email ?? "",
				r.tags.join("、"),
				r.platform === "facebook" || r.isFollower == null ? "" : r.isFollower ? "是" : "否",
				Bn(r.firstSeenAt),
				Bn(r.lastSeenAt),
			]
				.map(Fa)
				.join(","),
		);
	return (
		"\uFEFF" +
		n.join(`\r
`)
	);
}
function $n() {
	let t = new Ba();
	return (
		t.use("*", J(), U()),
		t.get("/", async (e) => {
			let n = e.env.DB,
				r = e.req.query(),
				o = Math.min(Number.parseInt(r.limit ?? "", 10) || 200, 1e3),
				a = await n.select().from(h).orderBy(Nn(h.lastSeenAt)),
				i = Un(a, r);
			return e.json({ total: i.length, contacts: i.slice(0, o) });
		}),
		t.get("/tags", async (e) => {
			let n = e.env.DB,
				r = new Map();
			for (let o of await n.select({ tags: h.tags }).from(h)) for (let a of Fn(o.tags)) r.set(a, (r.get(a) ?? 0) + 1);
			return e.json({ tags: [...r.entries()].sort((o, a) => a[1] - o[1]).map(([o, a]) => ({ tag: o, count: a })) });
		}),
		t.get("/export.csv", async (e) => {
			let n = e.env.DB,
				r = Un(await n.select().from(h).orderBy(Nn(h.lastSeenAt)), e.req.query()),
				o = new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
			return (
				await n
					.insert(Y)
					.values({
						id: crypto.randomUUID(),
						adminUserId: e.get("adminUserId"),
						action: "contacts.export",
						metadata: JSON.stringify({ count: r.length }),
						ipAddress: z(e.req),
					}),
				new Response($a(r), {
					headers: {
						"Content-Type": "text/csv; charset=utf-8",
						"Content-Disposition": `attachment; filename="ig-contacts-${o}.csv"`,
						"Cache-Control": "no-store",
					},
				})
			);
		}),
		t.delete("/:igsid", O(), async (e) => {
			let n = e.req.param("igsid"),
				r = e.env.DB;
			return (await r.select().from(h).where(rt(h.igsid, n)).limit(1)).length === 0
				? e.json({ error: "聯絡人不存在" }, 404)
				: (await r.delete(W).where(rt(W.igsid, n)),
					await r
						.update(g)
						.set({ commenterId: null, commenterUsername: null, originalCommentText: null, normalizedCommentText: null })
						.where(rt(g.commenterId, n)),
					await r.delete(h).where(rt(h.igsid, n)),
					await r
						.insert(Y)
						.values({ id: crypto.randomUUID(), adminUserId: e.get("adminUserId"), action: "contacts.delete", entityType: "contacts", ipAddress: z(e.req) }),
					e.json({ ok: !0 }));
		}),
		t
	);
}
import { and as Qa, desc as Za, eq as eo, isNull as to } from "npm:drizzle-orm@0.45.2";
import { Hono as no } from "npm:hono@4.12.32";
import { and as ot, eq as G, isNull as qn, ne as ja } from "npm:drizzle-orm@0.45.2";
import { and as at, asc as La, eq as re, isNull as Ct, or as Ka } from "npm:drizzle-orm@0.45.2";
function qa(t, e) {
	return t == null || t === e.platform;
}
function Ha(t, e) {
	return !!(e.publishedAt && e.publishedAt > t.createdAt);
}
async function Pt(t, e) {
	if (e.mediaType === "STORY" || (await t.select().from(f).where(re(f.instagramMediaId, e.id)).limit(1))[0]) return null;
	let r = await t
		.select()
		.from(f)
		.where(at(re(f.applyScope, "next_post"), Ct(f.instagramMediaId)))
		.orderBy(La(f.createdAt));
	for (let o of r) {
		if (!qa(o.platform, e) || !Ha(o, e)) continue;
		await t
			.update(f)
			.set({ instagramMediaId: e.id, applyScope: "media", updatedAt: new Date().toISOString() })
			.where(at(re(f.id, o.id), Ct(f.instagramMediaId)));
		let a = await t.select().from(f).where(re(f.id, o.id)).limit(1);
		if (a[0]?.instagramMediaId === e.id) return a[0];
	}
	return null;
}
async function Ln(t, e) {
	let n = await t
		.select()
		.from(f)
		.where(at(re(f.instagramMediaId, e.id), re(f.status, "active")))
		.limit(1);
	if (n[0]) return n[0];
	let r = await Pt(t, e);
	if (r && r.status === "active") return r;
	if (r) return null;
	let o = await t
		.select()
		.from(f)
		.where(at(re(f.applyScope, "account_default"), re(f.status, "active"), Ka(Ct(f.platform), re(f.platform, e.platform))));
	return o.find((a) => a.platform === e.platform) ?? o[0] ?? null;
}
async function Kn(t, e, n, r = "instagram") {
	let o = 0,
		a = 0,
		i = new Date().toISOString();
	for (let s of n) {
		if (!s.id) continue;
		let c = await t.select().from(_).where(G(_.instagramMediaId, s.id)).limit(1);
		c.length > 0
			? (await t
					.update(_)
					.set({
						caption: s.caption ?? c[0].caption,
						thumbnailUrl: s.thumbnail_url ?? s.media_url ?? c[0].thumbnailUrl,
						permalink: s.permalink ?? c[0].permalink,
						lastSyncedAt: i,
						updatedAt: i,
						deletedAt: null,
					})
					.where(G(_.id, c[0].id)),
				(a += 1))
			: (await t
					.insert(_)
					.values({
						id: crypto.randomUUID(),
						instagramAccountId: e,
						instagramMediaId: s.id,
						platform: r,
						mediaType: s.media_type ?? "UNKNOWN",
						caption: s.caption ?? null,
						thumbnailUrl: s.thumbnail_url ?? s.media_url ?? null,
						permalink: s.permalink ?? null,
						publishedAt: s.timestamp ?? null,
						lastSyncedAt: i,
					}),
				(o += 1));
	}
	return { inserted: o, updated: a };
}
async function Ga(t, e) {
	let r = await t.get(`${e}/media`, { fields: "id,media_type,caption,thumbnail_url,media_url,permalink,timestamp" });
	return r.ok
		? { ok: !0, items: r.data?.data ?? [], status: r.status }
		: {
				ok: !1,
				items: [],
				status: r.status,
				reason: r.failure?.nonRetryableReason ?? (r.failure?.networkError ? "network_error" : "http_error"),
				detail: r.failure?.metaErrorMessage ? `(code ${r.failure?.metaErrorCode ?? "?"}) ${r.failure.metaErrorMessage}` : void 0,
			};
}
async function Va(t, e) {
	let r = await t.get(`${e}/stories`, { fields: "id,media_type,media_url,thumbnail_url,timestamp" });
	return r.ok
		? { ok: !0, items: r.data?.data ?? [], status: r.status }
		: {
				ok: !1,
				items: [],
				status: r.status,
				reason: r.failure?.nonRetryableReason ?? (r.failure?.networkError ? "network_error" : "http_error"),
				detail: r.failure?.metaErrorMessage ? `(code ${r.failure?.metaErrorCode ?? "?"}) ${r.failure.metaErrorMessage}` : void 0,
			};
}
async function Wa(t, e, n) {
	let r = 0,
		o = 0,
		a = new Date().toISOString();
	for (let u of n) {
		if (!u.id) continue;
		let l = await t.select().from(_).where(G(_.instagramMediaId, u.id)).limit(1);
		l.length > 0
			? (await t
					.update(_)
					.set({ thumbnailUrl: u.thumbnail_url ?? u.media_url ?? l[0].thumbnailUrl, lastSyncedAt: a, updatedAt: a, deletedAt: null })
					.where(G(_.id, l[0].id)),
				(o += 1))
			: (await t
					.insert(_)
					.values({
						id: crypto.randomUUID(),
						instagramAccountId: e,
						instagramMediaId: u.id,
						mediaType: "STORY",
						thumbnailUrl: u.thumbnail_url ?? u.media_url ?? null,
						publishedAt: u.timestamp ?? null,
						lastSyncedAt: a,
					}),
				(r += 1));
	}
	let i = new Set(n.map((u) => u.id).filter(Boolean)),
		s = await t
			.select()
			.from(_)
			.where(ot(G(_.instagramAccountId, e), G(_.mediaType, "STORY"), qn(_.deletedAt))),
		c = 0;
	for (let u of s)
		i.has(u.instagramMediaId) ||
			(await t.update(_).set({ deletedAt: a, updatedAt: a }).where(G(_.id, u.id)),
			await t
				.update(f)
				.set({ status: "paused", updatedAt: a })
				.where(ot(G(f.instagramMediaId, u.id), G(f.status, "active"))),
			(c += 1));
	return { inserted: r, updated: o, expired: c };
}
async function za(t, e, n, r) {
	let o = await t
			.select()
			.from(_)
			.where(ot(G(_.instagramAccountId, n), qn(_.deletedAt), ja(_.mediaType, "STORY"))),
		a = 0;
	for (let i of o) {
		if (r.has(i.instagramMediaId)) continue;
		let s = await e.get(i.instagramMediaId, { fields: "id" });
		if (s.ok || s.failure?.nonRetryableReason !== "bad_request") continue;
		let c = new Date().toISOString();
		(await t.update(_).set({ deletedAt: c, updatedAt: c }).where(G(_.id, i.id)),
			await t
				.update(f)
				.set({ status: "paused", updatedAt: c })
				.where(ot(G(f.instagramMediaId, i.id), G(f.status, "active"))),
			(a += 1));
	}
	return { deleted: a };
}
async function Ja(t, e) {
	if ((await t.select().from(y).where(G(y.platform, "instagram")).limit(1)).length > 0) return null;
	let r = await e.get("me", { fields: "id,username,account_type,profile_picture_url" });
	if (!r.ok || !r.data?.id) {
		let o = r.failure?.nonRetryableReason ?? (r.failure?.networkError ? "network_error" : "http_error"),
			a = r.failure?.metaErrorMessage ? `｜Meta 回覆：(代碼 ${r.failure?.metaErrorCode ?? "?"}) ${r.failure.metaErrorMessage}` : "";
		return `自動註冊 Instagram 帳號失敗（HTTP ${r.status}，${vt(o)}）${a}——請確認 Instagram 存取權杖（INSTAGRAM_ACCOUNT_ACCESS_TOKEN）是否有效`;
	}
	return (
		await t
			.insert(y)
			.values({
				id: crypto.randomUUID(),
				instagramAccountId: r.data.id,
				username: r.data.username ?? null,
				accountType: r.data.account_type ?? null,
				profilePictureUrl: r.data.profile_picture_url ?? null,
			})
			.onConflictDoNothing(),
		null
	);
}
async function it(t) {
	let e = t.DB;
	await fn(e, t);
	let n = await et(e, t),
		r = { accounts: 0, inserted: 0, updated: 0, deleted: 0, expiredStories: 0, errors: [] },
		o = !!t.INSTAGRAM_ACCOUNT_ACCESS_TOKEN?.trim() || !!(await Ya(e)),
		a = o ? await Ja(e, n) : null;
	a && r.errors.push(a);
	let i = o && !a ? await e.select().from(y).where(G(y.platform, "instagram")) : [];
	r.accounts = i.length;
	for (let l of i) {
		let p = await Ga(n, l.instagramAccountId);
		if (!p.ok) {
			r.errors.push(
				`Instagram 帳號 ${l.username ?? l.instagramAccountId}：抓取貼文失敗（HTTP ${p.status}，${vt(p.reason)}）${p.detail ? `｜Meta 回覆：${p.detail}` : ""}`,
			);
			continue;
		}
		let m = await Kn(e, l.id, p.items);
		((r.inserted += m.inserted), (r.updated += m.updated));
		let w = new Set(p.items.map((M) => M.id).filter(Boolean)),
			E = await za(e, n, l.id, w);
		r.deleted += E.deleted;
		let k = await Va(n, l.instagramAccountId);
		if (!k.ok)
			r.errors.push(
				`Instagram 帳號 ${l.username ?? l.instagramAccountId}：抓取限時動態失敗（HTTP ${k.status}，${vt(k.reason)}）${k.detail ? `｜Meta 回覆：${k.detail}` : ""}`,
			);
		else {
			let M = await Wa(e, l.id, k.items);
			((r.inserted += M.inserted), (r.updated += M.updated), (r.expiredStories += M.expired));
		}
	}
	let s = ve(t);
	if (s) {
		let { account: l, error: p } = await _n(e, s);
		if ((p && r.errors.push(p), l)) {
			r.accounts += 1;
			let m = await nt(e, s, l);
			m && r.errors.push(m);
			let w = await hn(s, l.instagramAccountId);
			if (!w.ok) r.errors.push(w.error ?? "抓取 Facebook 貼文失敗");
			else {
				let E = await Kn(e, l.id, w.items, "facebook");
				((r.inserted += E.inserted), (r.updated += E.updated));
			}
		}
	}
	let u = (await e.select().from(_)).filter((l) => l.publishedAt && !l.deletedAt).sort((l, p) => (l.publishedAt < p.publishedAt ? -1 : 1));
	for (let l of u) await Pt(e, l);
	return r;
}
async function Ya(t) {
	return (await t.select({ accessToken: y.accessToken }).from(y).where(G(y.platform, "instagram")).limit(1))[0]?.accessToken ?? null;
}
var Xa = {
	token_invalid: "存取權杖失效",
	permission_denied: "權限不足",
	bad_request: "請求參數錯誤",
	policy_restricted: "受 Meta 政策限制",
	comment_not_found: "找不到留言",
	user_not_allowed: "對方不允許接收訊息",
	network_error: "網路連線錯誤",
	http_error: "連線錯誤",
};
function vt(t) {
	return (t && Xa[t]) || t || "未知錯誤";
}
var ro = 20,
	ao = 100;
function Hn() {
	let t = new no();
	return (
		t.use("*", J(), U()),
		t.post("/sync", O(), async (e) => {
			try {
				let n = await it(e.env);
				return e.json({ ok: !0, ...n });
			} catch (n) {
				return e.json({ ok: !1, error: n?.message ?? "sync failed" }, 500);
			}
		}),
		t.get("/", async (e) => {
			let n = e.env.DB,
				r = e.req.query(),
				o = Math.min(Number.parseInt(r.limit ?? "", 10) || ro, ao),
				a = Math.max(Number.parseInt(r.page ?? "", 10) || 1, 1),
				i = await n
					.select()
					.from(_)
					.where(Qa(r.mediaType ? eo(_.mediaType, r.mediaType) : void 0, r.includeDeleted === "1" ? void 0 : to(_.deletedAt)))
					.orderBy(Za(_.publishedAt))
					.limit(o)
					.offset((a - 1) * o),
				s = await n.select().from(f),
				c = new Map(s.map((l) => [l.instagramMediaId, l])),
				u = i.map((l) => ({ ...l, automationStatus: c.get(l.id)?.status ?? "none", automationId: c.get(l.id)?.id ?? null }));
			return (r.automationStatus && (u = u.filter((l) => l.automationStatus === r.automationStatus)), e.json({ page: a, limit: o, media: u }));
		}),
		t
	);
}
import { and as oo, desc as io, eq as ye, gte as so, lte as lo } from "npm:drizzle-orm@0.45.2";
import { Hono as co } from "npm:hono@4.12.32";
var uo = 50,
	mo = 200;
function jn() {
	let t = new co();
	return (
		t.use("*", J(), U()),
		t.get("/", async (e) => {
			let n = e.env.DB,
				r = e.req.query(),
				o = [];
			(r.mediaId && o.push(ye(g.instagramMediaId, r.mediaId)),
				r.automationId && o.push(ye(g.automationId, r.automationId)),
				r.status && o.push(ye(g.status, r.status)),
				r.publicReplyStatus && o.push(ye(g.publicReplyStatus, r.publicReplyStatus)),
				r.privateReplyStatus && o.push(ye(g.privateReplyStatus, r.privateReplyStatus)),
				r.dateFrom && o.push(so(g.createdAt, r.dateFrom)),
				r.dateTo && o.push(lo(g.createdAt, r.dateTo)));
			let a = Math.min(Number.parseInt(r.limit ?? "", 10) || uo, mo),
				i = Math.max(Number.parseInt(r.page ?? "", 10) || 1, 1),
				s = await n
					.select()
					.from(g)
					.where(o.length ? oo(...o) : void 0)
					.orderBy(io(g.createdAt))
					.limit(a)
					.offset((i - 1) * a);
			return e.json({ page: i, limit: a, runs: s });
		}),
		t.get("/:id", async (e) => {
			let n = e.env.DB,
				r = e.req.param("id"),
				o = await n.select().from(g).where(ye(g.id, r)).limit(1);
			if (o.length === 0) return e.json({ error: "紀錄不存在" }, 404);
			let a = await n.select().from(K).where(ye(K.automationRunId, r)).orderBy(K.attemptNumber);
			return e.json({ run: o[0], attempts: a });
		}),
		t
	);
}
import { eq as Vn } from "npm:drizzle-orm@0.45.2";
import { Hono as po } from "npm:hono@4.12.32";
var Me = "default";
async function Wn(t) {
	let e = await t.select().from(H).where(Vn(H.id, Me)).limit(1);
	return e.length === 0 ? (await t.insert(H).values({ id: Me, emergencyStop: 0 }), { id: Me, emergencyStop: 0 }) : e[0];
}
async function Gn(t, e, n, r) {
	let o = t.DB;
	(await Wn(o),
		await o
			.update(H)
			.set({ emergencyStop: r ? 1 : 0, updatedAt: new Date().toISOString() })
			.where(Vn(H.id, Me)),
		await o
			.insert(Y)
			.values({
				id: crypto.randomUUID(),
				adminUserId: e,
				action: r ? "system.emergency_stop" : "system.resume",
				entityType: "system_settings",
				entityId: Me,
				ipAddress: n,
			}));
}
function zn() {
	let t = new po();
	return (
		t.use("*", J()),
		t.get("/status", U(), async (e) => {
			let n = e.env.DB,
				r = await Wn(n),
				o = await n.select().from(y),
				a = o.filter((A) => A.platform === "instagram"),
				i = o.find((A) => A.platform === "facebook"),
				s = 480 * 60 * 1e3,
				c = new Date(Date.now() + s).toISOString().slice(0, 10),
				u = new Date(Date.parse(`${c}T00:00:00Z`) - s).toISOString(),
				l = await n.select().from(g),
				p = l.filter((A) => A.createdAt >= u),
				m = 1440 * 60 * 1e3,
				w = Date.now() + s,
				E = (A) => new Date(A).toISOString().slice(0, 10),
				k = (A) => new Date(A).toISOString().slice(0, 7),
				M = (A) => {
					let S = new Date(A);
					return Date.parse(`${E(A)}T00:00:00Z`) - ((S.getUTCDay() + 6) % 7) * m;
				},
				I = (A, S) => {
					let ee = new Map(A.map((F) => [F, { label: F, matched: 0, dmSuccess: 0, failures: 0 }]));
					for (let F of l) {
						let Ke = ee.get(S(Date.parse(F.createdAt) + s));
						Ke && ((Ke.matched += 1), F.privateReplyStatus === "success" && (Ke.dmSuccess += 1), F.status === "completed_with_errors" && (Ke.failures += 1));
					}
					return A.map((F) => ee.get(F));
				},
				v = Date.parse(`${c}T00:00:00Z`),
				V = Array.from({ length: 30 }, (A, S) => E(v - (29 - S) * m)),
				oe = M(w),
				ie = Array.from({ length: 12 }, (A, S) => E(oe - (11 - S) * 7 * m)),
				Le = Array.from({ length: 12 }, (A, S) => {
					let ee = new Date(w);
					return `${new Date(Date.UTC(ee.getUTCFullYear(), ee.getUTCMonth() - (11 - S), 1)).toISOString().slice(0, 7)}`;
				}),
				D = { daily: I(V, (A) => E(A)), weekly: I(ie, (A) => E(M(A))), monthly: I(Le, (A) => k(A)) },
				he = (A) => ({
					matched: A.length,
					publicReplySuccess: A.filter((S) => S.publicReplyStatus === "success").length,
					dmSuccess: A.filter((S) => S.privateReplyStatus === "success").length,
					failures: A.filter((S) => S.status === "completed_with_errors").length,
				});
			return e.json({
				emergencyStop: r.emergencyStop === 1,
				circuitBreakerStatus: o.some((A) => A.circuitBreakerStatus !== "closed") ? "open" : (o[0]?.circuitBreakerStatus ?? "unknown"),
				account: a[0] ? { username: a[0].username, profilePictureUrl: a[0].profilePictureUrl } : null,
				tokenExpiresAt: a[0]?.tokenExpiresAt ?? null,
				facebookPage: i ? { name: i.username, profilePictureUrl: i.profilePictureUrl, webhookSubscribed: i.webhookSubscribed === 1 } : null,
				lastWebhookReceivedAt: a[0]?.lastWebhookReceivedAt ?? null,
				today: he(p),
				total: he(l),
				series: D,
			});
		}),
		t.post("/emergency-stop", O(), U(), async (e) => (await Gn(e.env, e.get("adminUserId"), z(e.req), !0), e.json({ ok: !0, emergencyStop: !0 }))),
		t.post("/resume", O(), U(), async (e) => (await Gn(e.env, e.get("adminUserId"), z(e.req), !1), e.json({ ok: !0, emergencyStop: !1 }))),
		t.post("/circuit-breaker/reset", O(), U(), async (e) => {
			let n = e.env.DB;
			return (
				await n.update(y).set({ circuitBreakerStatus: "closed", updatedAt: new Date().toISOString() }),
				await n
					.insert(Y)
					.values({
						id: crypto.randomUUID(),
						adminUserId: e.get("adminUserId"),
						action: "system.circuit_breaker_reset",
						entityType: "instagram_accounts",
						ipAddress: z(e.req),
					}),
				e.json({ ok: !0, circuitBreakerStatus: "closed" })
			);
		}),
		t
	);
}
function Jn() {
	let t = new fo();
	return (
		t.route("/auth", an()),
		t.route("/automations", un()),
		t.route("/system", zn()),
		t.route("/media", Hn()),
		t.route("/automation-runs", jn()),
		t.route("/contacts", $n()),
		t.route("/connect", Mn()),
		t
	);
}
import { Hono as zo } from "npm:hono@4.12.32";
import { inArray as tr, lt, ne as ho, and as Ao } from "npm:drizzle-orm@0.45.2";
import { and as go, eq as yo, gte as wo, sql as er } from "npm:drizzle-orm@0.45.2";
var Yn = 480 * 60 * 1e3,
	Xn = 60 * 1e3,
	Qn = 1440 * 60 * 1e3;
function _o(t) {
	return new Date(Math.floor(t / Xn) * Xn).toISOString();
}
function st(t) {
	let e = Math.floor((t + Yn) / Qn) * Qn;
	return new Date(e - Yn).toISOString();
}
async function Zn(t, e, n) {
	let r = new Date().toISOString(),
		a = (
			await t
				.insert(Z)
				.values({ id: crypto.randomUUID(), scopeKey: e, windowStart: n, count: 1 })
				.onConflictDoUpdate({ target: [Z.scopeKey, Z.windowStart], set: { count: er`${Z.count} + 1`, updatedAt: r } })
				.returning({ count: Z.count })
		)[0]?.count;
	if (typeof a != "number") throw new Error("send counter reservation failed");
	return a;
}
async function we(t, e) {
	let n = e.nowMs ?? Date.now(),
		r = (await t.select().from(H).limit(1))[0];
	if (r && r.emergencyStop === 1) return { allowed: !1, reason: "emergency_stop" };
	if (e.automationDailyLimit != null) {
		let i = st(n);
		if (
			((
				await t
					.select({ n: er`count(*)` })
					.from(g)
					.where(go(yo(g.automationId, e.automationId), wo(g.createdAt, i)))
			)[0]?.n ?? 0) > e.automationDailyLimit
		)
			return { allowed: !1, reason: "automation_daily_limit" };
	}
	let o = e.actionType === "public_reply" ? (r?.maxPublicRepliesPerMinute ?? null) : (r?.maxPrivateRepliesPerMinute ?? null),
		a = e.actionType === "public_reply" ? (r?.maxPublicRepliesPerDay ?? null) : (r?.maxPrivateRepliesPerDay ?? null);
	return o != null && (await Zn(t, `${e.actionType}:minute`, _o(n))) > o
		? { allowed: !1, reason: "system_minute_limit" }
		: a != null && (await Zn(t, `${e.actionType}:day`, st(n))) > a
			? { allowed: !1, reason: "system_daily_limit" }
			: { allowed: !0, reason: null };
}
var So = 30,
	bo = 180;
var nr = 1440 * 60 * 1e3,
	Io = 500,
	rr = 20;
async function ar(t, e = Date.now(), n = {}) {
	let r = n.batchSize ?? Io,
		o = new Date(e - So * nr).toISOString(),
		a = new Date(e - bo * nr).toISOString(),
		i = 0;
	for (let E = 0; E < rr; E++) {
		let k = await t
			.select({ id: C.id })
			.from(C)
			.where(Ao(lt(C.receivedAt, o), ho(C.rawPayload, "{}")))
			.limit(r);
		if (k.length === 0) break;
		let M = k.map((I) => I.id);
		if ((await t.update(C).set({ rawPayload: "{}" }).where(tr(C.id, M)), (i += M.length), k.length < r)) break;
	}
	let s = 0;
	for (let E = 0; E < rr; E++) {
		let k = await t.select({ id: K.id }).from(K).where(lt(K.startedAt, a)).limit(r);
		if (k.length === 0) break;
		let M = k.map((I) => I.id);
		if ((await t.delete(K).where(tr(K.id, M)), (s += M.length), k.length < r)) break;
	}
	let c = bt(e),
		l = (await t.delete(X).where(lt(X.windowStart, c)).returning({ id: X.id })).length,
		p = st(e),
		w = (await t.delete(Z).where(lt(Z.windowStart, p)).returning({ id: Z.id })).length;
	return (
		console.log(`[cleanup] payloads=${i} attempts=${s} loginBuckets=${l} sendCounters=${w}`),
		{ webhookPayloadsCleared: i, apiAttemptsDeleted: s, loginRateLimitRowsDeleted: l, sendCounterRowsDeleted: w }
	);
}
import { and as _t, asc as Ko, eq as _e, lt as Sr, lte as qo, sql as Ho } from "npm:drizzle-orm@0.45.2";
import { and as Lt, eq as P } from "npm:drizzle-orm@0.45.2";
function or(t, e, n, r = "instagram") {
	let o = r === "facebook" ? "comments" : "replies";
	return t.post(`${e}/${o}`, { message: n });
}
function Oe(t, e) {
	let n = JSON.stringify(e.recipientId ? { id: e.recipientId } : { comment_id: e.commentId }),
		r;
	e.buttonText && e.postbackPayload
		? (r = JSON.stringify({
				attachment: {
					type: "template",
					payload: { template_type: "button", text: e.text, buttons: [{ type: "postback", payload: e.postbackPayload, title: e.buttonText }] },
				},
			}))
		: e.buttonText && e.buttonUrl
			? (r = JSON.stringify({
					attachment: {
						type: "template",
						payload: { template_type: "button", text: e.text, buttons: [{ type: "web_url", url: e.buttonUrl, title: e.buttonText }] },
					},
				}))
			: (r = JSON.stringify({ text: e.text }));
	let o = { recipient: n, message: r };
	return (e.platform === "facebook" && e.recipientId && (o.messaging_type = "RESPONSE"), t.post(`${e.instagramAccountId}/messages`, o));
}
var Dt = [30, 120, 600],
	Eo = Dt.length;
function Se(t) {
	return t < 0 ? Dt[0] : t >= Eo ? null : Dt[t];
}
function Ne(t, e, n) {
	if (n === "all_comments") return { matched: !0, matchedKeyword: null };
	for (let r of e)
		if (r) {
			if (n === "contains_any" && t.includes(r)) return { matched: !0, matchedKeyword: r };
			if (n === "exact_any" && t === r) return { matched: !0, matchedKeyword: r };
		}
	return { matched: !1, matchedKeyword: null };
}
import { and as ko, eq as Mt } from "npm:drizzle-orm@0.45.2";
async function Ue(t, e) {
	let n = await t
		.select()
		.from(g)
		.where(ko(Mt(g.automationId, e.automationId), Mt(g.instagramCommentId, e.instagramCommentId)))
		.limit(1);
	if (n.length > 0) return { run: n[0], created: !1 };
	let r = crypto.randomUUID(),
		o = new Date().toISOString();
	return (
		await t
			.insert(g)
			.values({
				id: r,
				automationId: e.automationId,
				webhookEventId: e.webhookEventId,
				instagramCommentId: e.instagramCommentId,
				instagramMediaId: e.instagramMediaId,
				commenterId: e.commenterId ?? null,
				commenterUsername: e.commenterUsername ?? null,
				originalCommentText: e.originalCommentText ?? null,
				normalizedCommentText: e.normalizedCommentText ?? null,
				matchedKeyword: e.matchedKeyword ?? null,
				status: e.status,
				startedAt: o,
			}),
		{ run: (await t.select().from(g).where(Mt(g.id, r)).limit(1))[0], created: !0 }
	);
}
function ir(t, e = Math.random) {
	let n = t.filter((a) => a.enabled);
	if (n.length === 0) return null;
	let r = Math.floor(e() * n.length),
		o = Math.min(r, n.length - 1);
	return n[o];
}
import { desc as Ro, eq as lr } from "npm:drizzle-orm@0.45.2";
function sr(t) {
	let e = [...t.recentAttempts].sort((a, i) => a.at - i.at);
	if (t.dailyLimit != null && t.dailySentCount > t.dailyLimit) return { open: !0, reason: "daily_limit_exceeded" };
	if (e.some((a) => a.reason === "policy_restricted")) return { open: !0, reason: "policy_restricted" };
	let n = e.slice(-5);
	if (n.length === 5) {
		if (n.every((a) => a.reason === "token_invalid")) return { open: !0, reason: "consecutive_token_invalid" };
		if (n.every((a) => a.reason === "permission_denied")) return { open: !0, reason: "consecutive_permission_denied" };
	}
	let r = t.now - 3e5,
		o = e.filter((a) => a.at >= r);
	return o.length >= 10 && o.filter((i) => !i.ok).length / o.length > 0.2 ? { open: !0, reason: "error_rate_exceeded" } : { open: !1, reason: null };
}
var To = 60;
function xo(t) {
	if (t.ok) return null;
	let e = t.failure?.nonRetryableReason;
	return e === "token_invalid" || e === "permission_denied" || e === "policy_restricted" ? e : "other";
}
async function be(t, e, n, r, o, a) {
	await t
		.insert(K)
		.values({
			id: crypto.randomUUID(),
			automationRunId: e,
			actionType: r,
			attemptNumber: o,
			httpStatus: a.status || a.failure?.httpStatus || null,
			failureReason: xo(a),
			metaErrorCode: a.failure?.metaErrorCode ?? null,
			metaErrorMessage: a.failure?.metaErrorMessage ?? null,
			completedAt: new Date().toISOString(),
		});
	let s = (await t.select({ completedAt: K.completedAt, failureReason: K.failureReason }).from(K).orderBy(Ro(K.completedAt)).limit(To))
			.filter((u) => u.completedAt != null)
			.map((u) => ({ ok: u.failureReason == null, reason: u.failureReason ?? void 0, at: Date.parse(u.completedAt) })),
		c = sr({ recentAttempts: s, now: Date.now(), dailySentCount: 0, dailyLimit: null });
	if (c.open) {
		let u = (await t.select().from(y).where(lr(y.id, n)).limit(1))[0];
		u &&
			u.circuitBreakerStatus === "closed" &&
			(await t.update(y).set({ circuitBreakerStatus: "open", updatedAt: new Date().toISOString() }).where(lr(y.id, n)),
			await t
				.insert(Y)
				.values({
					id: crypto.randomUUID(),
					adminUserId: null,
					action: "system.circuit_breaker_open",
					entityType: "instagram_accounts",
					entityId: n,
					metadata: JSON.stringify({ reason: c.reason }),
				}));
	}
}
import { and as ft, desc as vo, eq as R } from "npm:drizzle-orm@0.45.2";
function cr(t, e) {
	return t.get(e, { fields: "username,name,is_user_follow_business" });
}
var Co = new TextEncoder();
async function Po(t) {
	let e = await crypto.subtle.digest("SHA-256", Co.encode(t));
	return Array.from(new Uint8Array(e), (n) => n.toString(16).padStart(2, "0")).join("");
}
function Ot(t) {
	return t?.object === "page" ? "facebook" : "instagram";
}
function Nt(t) {
	let e = [],
		n = Ot(t),
		r = Array.isArray(t?.entry) ? t.entry : [];
	for (let o of r) {
		let a = o?.id != null ? String(o.id) : "",
			i = o?.time != null ? String(o.time) : "",
			s = Array.isArray(o?.changes) ? o.changes : [];
		for (let c of s) {
			if (n === "facebook") {
				let l = c?.value ?? {};
				if (c?.field !== "feed" || l.item !== "comment" || l.verb !== "add") continue;
				e.push({
					instagramAccountId: a,
					instagramMediaId: l.post_id != null ? String(l.post_id) : "",
					instagramCommentId: l.comment_id != null ? String(l.comment_id) : "",
					commenterId: l?.from?.id != null ? String(l.from.id) : null,
					commenterUsername: typeof l?.from?.name == "string" ? l.from.name : null,
					text: typeof l.message == "string" ? l.message : "",
					eventType: "comments",
					eventTimestamp: l.created_time != null ? String(l.created_time) : i,
					platform: n,
				});
				continue;
			}
			if (c?.field !== "comments") continue;
			let u = c.value ?? {};
			e.push({
				instagramAccountId: a,
				instagramMediaId: u?.media?.id != null ? String(u.media.id) : "",
				instagramCommentId: u?.id != null ? String(u.id) : "",
				commenterId: u?.from?.id != null ? String(u.from.id) : null,
				commenterUsername: typeof u?.from?.username == "string" ? u.from.username : null,
				text: typeof u?.text == "string" ? u.text : "",
				eventType: "comments",
				eventTimestamp: i,
				platform: n,
			});
		}
	}
	return e;
}
function ur(t, e) {
	return Nt(t).find((n) => n.instagramCommentId === e) ?? null;
}
function Ut(t) {
	let e = [];
	if (Ot(t) === "facebook") return e;
	let n = Array.isArray(t?.entry) ? t.entry : [];
	for (let r of n) {
		let o = r?.id != null ? String(r.id) : "",
			a = r?.time != null ? String(r.time) : "",
			i = Array.isArray(r?.messaging) ? r.messaging : [];
		for (let s of i) {
			let c = s?.message,
				u = c?.reply_to?.story?.id;
			u &&
				(c?.is_echo ||
					e.push({
						instagramAccountId: o,
						storyId: String(u),
						messageId: c?.mid != null ? String(c.mid) : "",
						senderId: s?.sender?.id != null ? String(s.sender.id) : "",
						text: typeof c?.text == "string" ? c.text : "",
						eventType: "story_reply",
						eventTimestamp: s?.timestamp != null ? String(s.timestamp) : a,
					}));
		}
	}
	return e;
}
function mr(t, e) {
	return Ut(t).find((n) => n.messageId === e) ?? null;
}
function dr(t) {
	if (!t) return "";
	let e = t.ref ?? t.ads_context_data?.ad_id ?? t.ad_id ?? "";
	return e != null ? String(e) : "";
}
function Bt(t) {
	let e = [],
		n = Ot(t),
		r = Array.isArray(t?.entry) ? t.entry : [];
	for (let o of r) {
		let a = o?.id != null ? String(o.id) : "",
			i = o?.time != null ? String(o.time) : "",
			s = Array.isArray(o?.messaging) ? o.messaging : [];
		for (let c of s) {
			let u = c?.sender?.id != null ? String(c.sender.id) : "";
			if (!u || u === a) continue;
			let l = c?.timestamp != null ? String(c.timestamp) : i,
				p = { instagramAccountId: a, senderId: u, eventTimestamp: l, text: "", payload: "", ref: "", platform: n };
			if (c?.postback) {
				e.push({
					...p,
					kind: "postback",
					messageId: c.postback.mid != null ? String(c.postback.mid) : "",
					payload: typeof c.postback.payload == "string" ? c.postback.payload : "",
				});
				continue;
			}
			let m = c?.message;
			if (m?.is_echo || m?.reply_to?.story?.id) continue;
			let w = dr(c?.referral) || dr(m?.referral);
			if (w) {
				e.push({ ...p, kind: "referral", messageId: m?.mid != null ? String(m.mid) : "", text: typeof m?.text == "string" ? m.text : "", ref: w });
				continue;
			}
			m && typeof m.text == "string" && m.text.trim() && e.push({ ...p, kind: "text", messageId: m.mid != null ? String(m.mid) : "", text: m.text });
		}
	}
	return e;
}
function Ft(t) {
	return t.messageId || `ref:${t.senderId}:${t.eventTimestamp}:${t.ref}`;
}
function pr(t, e) {
	return Bt(t).find((n) => Ft(n) === e) ?? null;
}
async function ct(t) {
	if (t.stableEventId) return t.stableEventId;
	let e = [
		t.instagramAccountId ?? "",
		t.instagramMediaId ?? "",
		t.instagramCommentId ?? "",
		t.eventType ?? "",
		t.eventTimestamp != null ? String(t.eventTimestamp) : "",
	];
	return Po(e.join("\0"));
}
var ut = "CLAIM:",
	Do = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
	Ie = {
		claimButtonText: "給我連結",
		notFollowingText: "先追蹤我，再按下面的按鈕就能拿到囉！",
		recheckButtonText: "我追蹤了",
		emailPromptText: "請直接回覆你的 Email，我把資料寄給你",
		notEmailHint: "這看起來不像 Email 喔，",
	},
	mt = (t, e, n) => ({ accountRowId: t.id, instagramAccountId: t.instagramAccountId, platform: t.platform, runId: e, automation: n });
function Ee(t) {
	return t.followGateEnabled === 1 || t.emailCaptureEnabled === 1;
}
var ae = () => new Date().toISOString();
function Mo(t) {
	try {
		let e = JSON.parse(t ?? "[]");
		return Array.isArray(e) ? e.filter((n) => typeof n == "string") : [];
	} catch {
		return [];
	}
}
async function gt(t, e, n = {}) {
	let r = ae(),
		o = (await t.select().from(h).where(R(h.igsid, e)).limit(1))[0];
	return (
		o
			? await t
					.update(h)
					.set({ username: n.username ?? o.username, name: n.name ?? o.name, lastSeenAt: r, updatedAt: r })
					.where(R(h.igsid, e))
			: await t
					.insert(h)
					.values({ igsid: e, platform: n.platform ?? "instagram", username: n.username ?? null, name: n.name ?? null })
					.onConflictDoNothing(),
		(await t.select().from(h).where(R(h.igsid, e)).limit(1))[0]
	);
}
async function Oo(t, e, n) {
	let r = n?.trim();
	if (!r) return;
	let o = (await t.select().from(h).where(R(h.igsid, e)).limit(1))[0];
	if (!o) return;
	let a = Mo(o.tags);
	a.includes(r) ||
		(a.push(r),
		await t
			.update(h)
			.set({ tags: JSON.stringify(a), updatedAt: ae() })
			.where(R(h.igsid, e)));
}
async function yt(t, e, n) {
	return (
		(
			await t
				.select({ id: W.id })
				.from(W)
				.where(ft(R(W.igsid, e), R(W.automationId, n)))
				.limit(1)
		).length > 0
	);
}
async function Fe(t, e, n) {
	(await t.insert(W).values({ id: crypto.randomUUID(), igsid: e, automationId: n.id }).onConflictDoNothing(), await Oo(t, e, n.tag));
}
async function $e(t, e, n) {
	await t
		.update(W)
		.set({ deliveredAt: ae() })
		.where(ft(R(W.igsid, e), R(W.automationId, n)));
}
function wt(t) {
	return Ee(t)
		? { text: t.openingDm ?? "", buttonText: t.claimButtonText || Ie.claimButtonText, postbackPayload: ut + t.id }
		: { text: t.openingDm ?? "", buttonText: t.buttonText, buttonUrl: t.buttonUrl };
}
function No(t) {
	return { text: t.deliveryText || t.openingDm || "", buttonText: t.buttonText, buttonUrl: t.buttonUrl };
}
async function Be(t, e, n, r) {
	let o = await we(t.db, { actionType: "private_reply", automationId: e.automation.id, automationDailyLimit: null });
	if (!o.allowed) return { ok: !1, retry: !1, reason: o.reason ?? "send_gate" };
	let a = tt(t, e.platform);
	if (!a) return { ok: !1, retry: !1, reason: "facebook_not_configured" };
	let i = await Oe(a, { instagramAccountId: e.instagramAccountId, recipientId: n, ...r, platform: e.platform === "facebook" ? "facebook" : "instagram" });
	return (
		e.runId && (await be(t.db, e.runId, e.accountRowId, "private_reply", 1, i)),
		i.ok
			? { ok: !0 }
			: {
					ok: !1,
					retry: !!(i.failure && (fe(i.failure) || (i.failure.httpStatus === 400 && !Pe.has(i.failure.nonRetryableReason ?? "")))),
					reason: i.failure?.metaErrorMessage ?? `http_${i.status}`,
				}
	);
}
function pt(t, e, n = 0) {
	return t.ok ? { kind: "completed", step: e } : t.retry ? { kind: "retry", delaySeconds: Se(n), reason: t.reason } : { kind: "skipped", reason: t.reason };
}
async function $t(t, e, n) {
	return (
		(
			await t
				.select({ id: g.id })
				.from(g)
				.where(ft(R(g.automationId, e), R(g.commenterId, n)))
				.orderBy(vo(g.createdAt))
				.limit(1)
		)[0]?.id ?? null
	);
}
async function Uo(t, e, n, r) {
	let { db: o, metaClient: a } = t,
		i = mt(e, await $t(o, r.id, n), r);
	await Fe(o, n, r);
	let s = (await o.select().from(h).where(R(h.igsid, n)).limit(1))[0];
	if (e.platform === "instagram" && (r.followGateEnabled === 1 || !s?.username)) {
		let c = await cr(a, n);
		if (c.ok && c.data) {
			let u = c.data.is_user_follow_business;
			if (
				(await o
					.update(h)
					.set({
						username: c.data.username ?? s?.username ?? null,
						name: c.data.name ?? s?.name ?? null,
						isFollower: typeof u == "boolean" ? (u ? 1 : 0) : (s?.isFollower ?? null),
						updatedAt: ae(),
					})
					.where(R(h.igsid, n)),
				r.followGateEnabled === 1 && u === !1)
			) {
				let l = await Be(t, i, n, {
					text: r.notFollowingText || Ie.notFollowingText,
					buttonText: r.recheckButtonText || Ie.recheckButtonText,
					postbackPayload: ut + r.id,
				});
				return pt(l, "not_following");
			}
		}
	}
	if (r.emailCaptureEnabled === 1 && !(await o.select().from(h).where(R(h.igsid, n)).limit(1))[0]?.email) {
		let u = await Be(t, i, n, { text: r.emailPromptText || Ie.emailPromptText });
		return (
			u.ok &&
				(await o
					.update(h)
					.set({ state: `awaiting_email:${r.id}`, updatedAt: ae() })
					.where(R(h.igsid, n))),
			pt(u, "awaiting_email")
		);
	}
	return yr(t, i, n, r);
}
async function yr(t, e, n, r) {
	let o = await Be(t, e, n, No(r));
	return (o.ok && (await $e(t.db, n, r.id)), pt(o, "delivered"));
}
async function Bo(t, e) {
	return t
		.select()
		.from(f)
		.where(ft(R(f.applyScope, e), R(f.status, "active")));
}
async function fr(t, e, n, r) {
	let o = de(n),
		a = (await Bo(t, e)).filter((i) => i.platform == null || i.platform === r).sort((i, s) => +(s.platform === r) - +(i.platform === r));
	for (let i of a) {
		let s = await t.select().from(N).where(R(N.automationId, i.id)),
			c = e === "ref" ? "exact_any" : i.matchType;
		if (e === "dm_keyword" && c === "all_comments") continue;
		let u = Ne(
			o,
			s.map((l) => l.normalizedKeyword),
			c,
		);
		if (u.matched) return { automation: i, matchedKeyword: u.matchedKeyword };
	}
	return null;
}
async function gr(t, e, n, r, o, a) {
	let { db: i } = t,
		{ automation: s } = a,
		{ run: c, created: u } = await Ue(i, {
			automationId: s.id,
			webhookEventId: o,
			instagramCommentId: r,
			instagramMediaId: "",
			commenterId: n.senderId,
			commenterUsername: null,
			originalCommentText: n.kind === "referral" ? `ref=${n.ref}` : n.text,
			normalizedCommentText: null,
			matchedKeyword: a.matchedKeyword,
			status: "matched",
		});
	if (!u && c.privateReplyStatus === "success") return { kind: "skipped", reason: "already_sent" };
	if (u && s.oncePerContact === 1 && (await yt(i, n.senderId, s.id))) return (await dt(i, c.id, "skipped"), { kind: "skipped", reason: "once_per_contact" });
	await Fe(i, n.senderId, s);
	let l = await we(i, { actionType: "private_reply", automationId: s.id, automationDailyLimit: s.dailyLimit });
	if (!l.allowed) return (await dt(i, c.id, "skipped"), { kind: "skipped", reason: l.reason ?? "send_gate" });
	let p = mt(e, c.id, s),
		m = await Be(t, p, n.senderId, wt(s));
	return m.ok
		? (Ee(s) || (await $e(i, n.senderId, s.id)), await dt(i, c.id, "success"), { kind: "completed", step: Ee(s) ? "claim_button_sent" : "delivered" })
		: m.retry
			? (await i
					.update(g)
					.set({ retryCount: c.retryCount + 1, updatedAt: ae() })
					.where(R(g.id, c.id)),
				{ kind: "retry", delaySeconds: Se(c.retryCount), reason: m.reason })
			: (await dt(i, c.id, "failed"), { kind: "skipped", reason: m.reason });
}
async function dt(t, e, n) {
	await t
		.update(g)
		.set({
			status: n === "failed" ? "completed_with_errors" : "completed",
			publicReplyStatus: "skipped",
			privateReplyStatus: n,
			completedAt: ae(),
			updatedAt: ae(),
		})
		.where(R(g.id, e));
}
async function wr(t, e) {
	let { db: n } = t,
		r = (await n.select().from(C).where(R(C.id, e.webhookEventId)).limit(1))[0];
	if (!r) return { kind: "skipped", reason: "webhook_event_not_found" };
	let o;
	try {
		o = JSON.parse(r.rawPayload);
	} catch {
		return { kind: "skipped", reason: "payload_parse_error" };
	}
	let a = pr(o, e.instagramCommentId);
	if (!a) return { kind: "skipped", reason: "message_not_in_payload" };
	if ((await n.select().from(H).limit(1))[0]?.emergencyStop === 1) return { kind: "skipped", reason: "emergency_stop" };
	let s = await yn(n, a.instagramAccountId, a.platform);
	if (!s) return { kind: "skipped", reason: "account_not_found" };
	if (s.automationEnabled === 0) return { kind: "skipped", reason: "account_disabled" };
	if (s.circuitBreakerStatus !== "closed") return { kind: "skipped", reason: "circuit_open" };
	if (a.senderId === s.instagramAccountId) return { kind: "skipped", reason: "own_message" };
	let c = await gt(n, a.senderId, { platform: a.platform });
	if (a.kind === "postback") {
		if (!a.payload.startsWith(ut)) return { kind: "no_match" };
		let p = a.payload.slice(ut.length),
			m = (await n.select().from(f).where(R(f.id, p)).limit(1))[0];
		return !m || m.status !== "active" ? { kind: "skipped", reason: "automation_inactive" } : Uo(t, s, a.senderId, m);
	}
	if (a.kind === "referral") {
		let p = await fr(n, "ref", a.ref, a.platform);
		if (p) return gr(t, s, a, e.instagramCommentId, r.id, p);
		if (!a.text) return { kind: "no_match" };
	}
	let u = c.state?.startsWith("awaiting_email:") ? c.state.split(":")[1] : null;
	if (u) {
		let p = a.text.match(Do);
		if (p) {
			await n.update(h).set({ email: p[0].toLowerCase(), state: null, updatedAt: ae() }).where(R(h.igsid, a.senderId));
			let m = (await n.select().from(f).where(R(f.id, u)).limit(1))[0];
			if (!m || m.status !== "active") return { kind: "completed", step: "email_saved" };
			let w = mt(s, await $t(n, m.id, a.senderId), m);
			return yr(t, w, a.senderId, m);
		}
	}
	let l = await fr(n, "dm_keyword", a.text, a.platform);
	if (l) return gr(t, s, a, e.instagramCommentId, r.id, l);
	if (u) {
		let p = (await n.select().from(f).where(R(f.id, u)).limit(1))[0];
		if (p && p.status === "active") {
			let m = mt(s, await $t(n, p.id, a.senderId), p),
				w = await Be(t, m, a.senderId, { text: Ie.notEmailHint + (p.emailPromptText || Ie.emailPromptText) });
			return pt(w, "email_hint");
		}
	}
	return { kind: "no_match" };
}
async function Fo(t, e, n, r = "instagram") {
	let o = await j(t, r);
	if (!o) return null;
	if (r === "facebook") {
		let s = await e.get(n, { fields: "id,message,full_picture,permalink_url,created_time,status_type" });
		return !s.ok || !s.data?.id
			? null
			: (await t
					.insert(_)
					.values({
						id: crypto.randomUUID(),
						instagramAccountId: o.id,
						instagramMediaId: s.data.id,
						platform: "facebook",
						mediaType: Lo(s.data.status_type),
						caption: s.data.message ?? null,
						thumbnailUrl: s.data.full_picture ?? null,
						permalink: s.data.permalink_url ?? null,
						publishedAt: s.data.created_time ?? null,
						lastSyncedAt: new Date().toISOString(),
					})
					.onConflictDoNothing(),
				(await t.select().from(_).where(P(_.instagramMediaId, s.data.id)).limit(1))[0] ?? null);
	}
	let a = await e.get(n, { fields: "id,media_type,caption,thumbnail_url,media_url,permalink,timestamp" });
	return !a.ok || !a.data?.id
		? null
		: (await t
				.insert(_)
				.values({
					id: crypto.randomUUID(),
					instagramAccountId: o.id,
					instagramMediaId: a.data.id,
					mediaType: a.data.media_type ?? "UNKNOWN",
					caption: a.data.caption ?? null,
					thumbnailUrl: a.data.thumbnail_url ?? a.data.media_url ?? null,
					permalink: a.data.permalink ?? null,
					publishedAt: a.data.timestamp ?? null,
					lastSyncedAt: new Date().toISOString(),
				})
				.onConflictDoNothing(),
			(await t.select().from(_).where(P(_.instagramMediaId, a.data.id)).limit(1))[0] ?? null);
}
async function $o(t, e, n) {
	let r = await j(t, "instagram");
	if (!r) return null;
	let o = await e.get(n, { fields: "id,media_type,media_url,thumbnail_url,timestamp" });
	return !o.ok || !o.data?.id
		? null
		: (await t
				.insert(_)
				.values({
					id: crypto.randomUUID(),
					instagramAccountId: r.id,
					instagramMediaId: o.data.id,
					mediaType: "STORY",
					thumbnailUrl: o.data.thumbnail_url ?? o.data.media_url ?? null,
					publishedAt: o.data.timestamp ?? null,
					lastSyncedAt: new Date().toISOString(),
				})
				.onConflictDoNothing(),
			(await t.select().from(_).where(P(_.instagramMediaId, o.data.id)).limit(1))[0] ?? null);
}
async function _r(t, e) {
	let { db: n } = t,
		r = await n.select().from(C).where(P(C.id, e.webhookEventId)).limit(1);
	if (r.length === 0) return { kind: "skipped", reason: "webhook_event_not_found" };
	let o;
	try {
		o = JSON.parse(r[0].rawPayload);
	} catch {
		return { kind: "skipped", reason: "payload_parse_error" };
	}
	let a = ur(o, e.instagramCommentId);
	if (!a || !a.instagramCommentId || !a.instagramMediaId) return { kind: "skipped", reason: "comment_not_in_payload" };
	let i = tt(t, a.platform);
	if (!i) return { kind: "skipped", reason: "facebook_not_configured" };
	let s = await n.select().from(H).limit(1);
	if (s.length > 0 && s[0].emergencyStop === 1) return { kind: "skipped", reason: "emergency_stop" };
	let c = await n.select().from(_).where(P(_.instagramMediaId, e.instagramMediaId)).limit(1);
	if (c.length === 0) {
		let S = await Fo(n, i, e.instagramMediaId, a.platform);
		if (!S) return { kind: "skipped", reason: "media_not_found" };
		c = [S];
	}
	let u = c[0],
		l = await n.select().from(y).where(P(y.id, u.instagramAccountId)).limit(1);
	if (l.length === 0) return { kind: "skipped", reason: "account_not_found" };
	let p = l[0];
	if (p.automationEnabled === 0) return { kind: "skipped", reason: "account_disabled" };
	if (p.circuitBreakerStatus !== "closed") return { kind: "skipped", reason: "circuit_open" };
	let m = await Ln(n, u);
	if (!m) return { kind: "skipped", reason: "no_active_automation" };
	if (m.excludeOwnComments === 1 && a.commenterId && a.commenterId === a.instagramAccountId) return { kind: "skipped", reason: "own_comment" };
	let w = de(a.text),
		k = (await n.select().from(N).where(P(N.automationId, m.id))).map((S) => S.normalizedKeyword),
		M = Ne(w, k, m.matchType);
	if (!M.matched) return { kind: "no_match" };
	if (a.commenterId) {
		if (
			(
				await n
					.select({ id: g.id })
					.from(g)
					.where(Lt(P(g.automationId, m.id), P(g.instagramCommentId, a.instagramCommentId)))
					.limit(1)
			).length === 0 &&
			m.oncePerContact === 1 &&
			(await yt(n, a.commenterId, m.id))
		)
			return { kind: "skipped", reason: "once_per_contact" };
		(await gt(n, a.commenterId, {
			username: a.platform === "facebook" ? null : a.commenterUsername,
			name: a.platform === "facebook" ? a.commenterUsername : null,
			platform: a.platform,
		}),
			await Fe(n, a.commenterId, m));
	}
	let { run: I } = await Ue(n, {
			automationId: m.id,
			webhookEventId: e.webhookEventId,
			instagramCommentId: a.instagramCommentId,
			instagramMediaId: u.instagramMediaId,
			commenterId: a.commenterId,
			commenterUsername: a.commenterUsername,
			originalCommentText: a.text,
			normalizedCommentText: w,
			matchedKeyword: M.matchedKeyword,
			status: "matched",
		}),
		v = I.publicReplyStatus ?? "pending",
		V = I.privateReplyStatus ?? "pending",
		oe = !1,
		ie = I.retryCount + 1;
	if (v === "pending")
		if (m.publicReplyEnabled === 0) v = "skipped";
		else {
			let S = await n.select().from(te).where(P(te.automationId, m.id)),
				ee = ir(S.map((F) => ({ id: F.id, message: F.message, enabled: F.enabled === 1 })));
			if (!ee) v = "skipped";
			else if (!(await we(n, { actionType: "public_reply", automationId: m.id, automationDailyLimit: m.dailyLimit })).allowed) v = "skipped";
			else {
				let F = await or(i, a.instagramCommentId, ee.message, a.platform);
				(await be(n, I.id, p.id, "public_reply", ie, F),
					F.ok
						? ((v = "success"), await n.update(g).set({ publicReplyMessage: ee.message }).where(P(g.id, I.id)))
						: F.failure && fe(F.failure)
							? (oe = !0)
							: (v = "failed"));
			}
		}
	if (V === "pending")
		if (m.privateReplyEnabled === 0 || !m.openingDm) V = "skipped";
		else if (!(await we(n, { actionType: "private_reply", automationId: m.id, automationDailyLimit: m.dailyLimit })).allowed) V = "skipped";
		else {
			let S = await Oe(i, { instagramAccountId: a.instagramAccountId, commentId: a.instagramCommentId, ...wt(m), platform: a.platform });
			(await be(n, I.id, p.id, "private_reply", ie, S),
				S.ok
					? ((V = "success"), !Ee(m) && a.commenterId && (await $e(n, a.commenterId, m.id)))
					: (S.failure && fe(S.failure)) || (S.failure && S.failure.httpStatus === 400 && !Pe.has(S.failure.nonRetryableReason ?? ""))
						? (oe = !0)
						: (V = "failed"));
		}
	if (oe && (v === "pending" || V === "pending")) {
		let S = Se(I.retryCount);
		return (
			await n
				.update(g)
				.set({ retryCount: I.retryCount + 1, publicReplyStatus: v, privateReplyStatus: V, updatedAt: new Date().toISOString() })
				.where(P(g.id, I.id)),
			{ kind: "retry", delaySeconds: S, runId: I.id, reason: "retryable_meta_error" }
		);
	}
	let D = v === "pending" ? "failed" : v,
		he = V === "pending" ? "failed" : V,
		A = D === "failed" || he === "failed" ? "completed_with_errors" : "completed";
	return (
		await n
			.update(g)
			.set({ status: A, publicReplyStatus: D, privateReplyStatus: he, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
			.where(P(g.id, I.id)),
		{ kind: "completed", runId: I.id, publicReplyStatus: D, privateReplyStatus: he }
	);
}
async function hr(t, e) {
	let { db: n, metaClient: r } = t,
		o = await n.select().from(C).where(P(C.id, e.webhookEventId)).limit(1);
	if (o.length === 0) return { kind: "skipped", reason: "webhook_event_not_found" };
	let a;
	try {
		a = JSON.parse(o[0].rawPayload);
	} catch {
		return { kind: "skipped", reason: "payload_parse_error" };
	}
	let i = mr(a, e.instagramCommentId);
	if (!i || !i.messageId || !i.storyId) return { kind: "skipped", reason: "story_reply_not_in_payload" };
	let s = await n.select().from(H).limit(1);
	if (s.length > 0 && s[0].emergencyStop === 1) return { kind: "skipped", reason: "emergency_stop" };
	let c = await n.select().from(_).where(P(_.instagramMediaId, i.storyId)).limit(1);
	if (c.length === 0) {
		let D = await $o(n, r, i.storyId);
		if (!D) return { kind: "skipped", reason: "story_not_found" };
		c = [D];
	}
	let u = c[0];
	if (u.deletedAt) return { kind: "skipped", reason: "story_expired" };
	let l = await n.select().from(y).where(P(y.id, u.instagramAccountId)).limit(1);
	if (l.length === 0) return { kind: "skipped", reason: "account_not_found" };
	let p = l[0];
	if (p.automationEnabled === 0) return { kind: "skipped", reason: "account_disabled" };
	if (p.circuitBreakerStatus !== "closed") return { kind: "skipped", reason: "circuit_open" };
	let w = (
		await n
			.select()
			.from(f)
			.where(Lt(P(f.instagramMediaId, u.id), P(f.status, "active")))
			.limit(1)
	)[0];
	if (!w) return { kind: "skipped", reason: "no_active_automation" };
	if (i.senderId && i.senderId === p.instagramAccountId) return { kind: "skipped", reason: "own_message" };
	let E = de(i.text),
		k = await n.select().from(N).where(P(N.automationId, w.id)),
		M = Ne(
			E,
			k.map((D) => D.normalizedKeyword),
			w.matchType,
		);
	if (!M.matched) return { kind: "no_match" };
	if (i.senderId) {
		if (
			(
				await n
					.select({ id: g.id })
					.from(g)
					.where(Lt(P(g.automationId, w.id), P(g.instagramCommentId, i.messageId)))
					.limit(1)
			).length === 0 &&
			w.oncePerContact === 1 &&
			(await yt(n, i.senderId, w.id))
		)
			return { kind: "skipped", reason: "once_per_contact" };
		(await gt(n, i.senderId), await Fe(n, i.senderId, w));
	}
	let { run: I } = await Ue(n, {
			automationId: w.id,
			webhookEventId: e.webhookEventId,
			instagramCommentId: i.messageId,
			instagramMediaId: u.instagramMediaId,
			commenterId: i.senderId || null,
			commenterUsername: null,
			originalCommentText: i.text,
			normalizedCommentText: E,
			matchedKeyword: M.matchedKeyword,
			status: "matched",
		}),
		v = I.privateReplyStatus ?? "pending",
		V = !1,
		oe = I.retryCount + 1;
	if (v === "pending")
		if (w.privateReplyEnabled === 0 || !w.openingDm || !i.senderId) v = "skipped";
		else if (!(await we(n, { actionType: "private_reply", automationId: w.id, automationDailyLimit: w.dailyLimit })).allowed) v = "skipped";
		else {
			let D = await Oe(r, { instagramAccountId: i.instagramAccountId, recipientId: i.senderId, ...wt(w) });
			(await be(n, I.id, p.id, "private_reply", oe, D),
				D.ok
					? ((v = "success"), Ee(w) || (await $e(n, i.senderId, w.id)))
					: (D.failure && fe(D.failure)) || (D.failure && D.failure.httpStatus === 400 && !Pe.has(D.failure.nonRetryableReason ?? ""))
						? (V = !0)
						: (v = "failed"));
		}
	if (V && v === "pending") {
		let D = Se(I.retryCount);
		return (
			await n
				.update(g)
				.set({ retryCount: I.retryCount + 1, publicReplyStatus: "skipped", privateReplyStatus: v, updatedAt: new Date().toISOString() })
				.where(P(g.id, I.id)),
			{ kind: "retry", delaySeconds: D, runId: I.id, reason: "retryable_meta_error" }
		);
	}
	let ie = v === "pending" ? "failed" : v,
		Le = ie === "failed" ? "completed_with_errors" : "completed";
	return (
		await n
			.update(g)
			.set({ status: Le, publicReplyStatus: "skipped", privateReplyStatus: ie, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
			.where(P(g.id, I.id)),
		{ kind: "completed", runId: I.id, publicReplyStatus: "skipped", privateReplyStatus: ie }
	);
}
function Lo(t) {
	return t === "added_video" ? "FB_VIDEO" : "FB_POST";
}
var jo = 3,
	Ar = [30, 120, 600],
	Go = 300 * 1e3,
	Vo = 7;
function br(t, e) {
	return {
		async send(n, r) {
			let o = Date.now();
			(await t
				.insert(x)
				.values({
					id: crypto.randomUUID(),
					message: JSON.stringify(n),
					status: "pending",
					nextRunAt: new Date(o + (r?.delaySeconds ?? 0) * 1e3).toISOString(),
				}),
				e?.());
		},
	};
}
async function Wo(t, e) {
	return e.eventType === "story_reply" ? hr(t, e) : e.eventType === "messaging" ? wr(t, e) : _r(t, e);
}
async function ht(t, e = {}) {
	let n = t.DB,
		r = e.now ?? Date.now,
		o = e.limit ?? 20,
		a = { processed: 0, done: 0, retried: 0, failed: 0 };
	await n
		.update(x)
		.set({ status: "pending", updatedAt: new Date(r()).toISOString() })
		.where(_t(_e(x.status, "running"), Sr(x.updatedAt, new Date(r() - Go).toISOString())));
	let i = await n
		.select({ id: x.id })
		.from(x)
		.where(_t(_e(x.status, "pending"), qo(x.nextRunAt, new Date(r()).toISOString())))
		.orderBy(Ko(x.nextRunAt))
		.limit(o);
	if (i.length === 0) return a;
	let s = e.deps ?? { db: n, ...(await gn(n, t)) };
	for (let { id: c } of i) {
		let l = (
			await n
				.update(x)
				.set({ status: "running", updatedAt: new Date(r()).toISOString() })
				.where(_t(_e(x.id, c), _e(x.status, "pending")))
				.returning()
		)[0];
		if (!l) continue;
		a.processed += 1;
		let p,
			m = null;
		try {
			let E = JSON.parse(l.message),
				k = await Wo(s, E);
			k.kind === "retry" && k.delaySeconds !== null && ((p = k.delaySeconds), (m = k.reason));
		} catch (E) {
			((p = null), (m = E?.name ?? "Error"));
		}
		let w = new Date(r()).toISOString();
		if (p === void 0) (await n.update(x).set({ status: "done", updatedAt: w }).where(_e(x.id, c)), (a.done += 1));
		else if (l.attempts >= jo)
			(await n
				.update(x)
				.set({ status: "failed", attempts: l.attempts + 1, lastError: m, updatedAt: w })
				.where(_e(x.id, c)),
				(a.failed += 1));
		else {
			let E = p ?? Ar[Math.min(l.attempts, Ar.length - 1)];
			(await n
				.update(x)
				.set({ status: "pending", attempts: l.attempts + 1, lastError: m, nextRunAt: new Date(r() + E * 1e3).toISOString(), updatedAt: w })
				.where(_e(x.id, c)),
				(a.retried += 1));
		}
	}
	return a;
}
async function Ir(t, e = Date.now()) {
	let n = new Date(e - Vo * 864e5).toISOString();
	return (
		await t
			.delete(x)
			.where(_t(Ho`${x.status} in ('done', 'failed')`, Sr(x.updatedAt, n)))
			.returning({ id: x.id })
	).length;
}
function Er(t, e) {
	let n = new TextEncoder(),
		r = n.encode(t),
		o = n.encode(e),
		a = r.length ^ o.length,
		i = Math.max(r.length, o.length);
	for (let s = 0; s < i; s++) a |= (r[s] ?? 0) ^ (o[s] ?? 0);
	return a === 0;
}
function kr() {
	let t = new zo();
	return (
		t.use("*", async (e, n) => {
			let r = e.env.CRON_SECRET?.trim(),
				o = e.req.header("Authorization") ?? "",
				a = o.startsWith("Bearer ") ? o.slice(7).trim() : "";
			return !r || !a || !Er(a, r) ? e.json({ error: "unauthorized" }, 401) : n();
		}),
		t.post("/tick", async (e) => e.json(await ht(e.env))),
		t.post("/sync", async (e) => e.json(await it(e.env))),
		t.post("/cleanup", async (e) => {
			let n = await ar(e.env.DB),
				r = await Ir(e.env.DB);
			return e.json({ ...n, jobsDeleted: r });
		}),
		t
	);
}
function Jo(t) {
	return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function Rr(t) {
	let e = t?.trim();
	return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>隱私權政策</title><style>body{font-family:system-ui,-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;max-width:680px;margin:40px auto;padding:0 20px;line-height:1.7;color:#0f172a}h1{font-size:24px}h2{font-size:17px;margin-top:28px}p,li{font-size:15px;color:#334155}</style></head><body>
<h1>隱私權政策</h1>
<p>本服務為單一 Instagram 專業帳號與 Facebook 粉專的營運者自用的自動回覆工具，依你的留言或訊息自動回覆你所索取的資料。</p>
<h2>我們蒐集的資料</h2>
<p>僅在你主動與本帳號互動（在貼文留言、回覆限時動態、傳送私訊、點擊廣告或連結開啟對話、按下訊息按鈕）時，處理下列資料：</p>
<ul>
<li>你的 Instagram／Facebook 範圍內使用者 ID、使用者名稱與顯示名稱</li>
<li>你觸發自動回覆的留言或訊息內容</li>
<li>你是否追蹤本帳號（僅 Instagram，且僅在你按下領取按鈕時查詢）</li>
<li>你主動回覆提供的 Email</li>
<li>本服務依互動內容為你標記的分類標籤</li>
</ul>
<h2>使用目的</h2>
<ul>
<li>傳送你所索取的資料或連結，並避免重複傳送。</li>
<li>你主動提供的 Email，用於寄送你索取的資料及與該資料相關的後續資訊；你可隨時要求停止或刪除。</li>
<li>本服務不會出售或出租你的資料，也不會提供給第三方。本服務不會主動私訊未曾與本帳號互動的人。</li>
</ul>
<h2>資料的保存與刪除</h2>
<ul>
<li>資料僅保存於本帳號營運者自行部署的資料庫，只有營運者可以存取。</li>
<li>如希望刪除與你相關的資料，請透過下方聯絡方式提出（例如私訊「刪除我的資料」），我們將於 7 個工作天內刪除你的名單資料、標籤與 Email，並抹除執行紀錄中的身分與留言內容。</li>
</ul>
<h2>聯絡方式</h2>
<p>${e ? Jo(e) : "請透過本服務所綁定之 Instagram 帳號的私訊，或 Facebook 粉專的 Messenger 聯絡我們（若你曾收到本服務的訊息，直接回覆該對話即可）。"}</p>
<p>更新日期：2026-10-19</p>
</body></html>`;
}
import { Hono as Zo } from "npm:hono@4.12.32";
import { eq as Cr } from "npm:drizzle-orm@0.45.2";
var Kt = { debug: 10, info: 20, warn: 30, error: 40 };
function Tr(t = "info") {
	let e = Kt[t] ?? Kt.info;
	function n(r, o) {
		if (Kt[r] < e) return;
		let a = JSON.stringify({ timestamp: new Date().toISOString(), level: r, ...o });
		r === "warn" || r === "error" ? console.error(a) : console.log(a);
	}
	return { debug: (r) => n("debug", r), info: (r) => n("info", r), warn: (r) => n("warn", r), error: (r) => n("error", r) };
}
async function xr(t, e) {
	await t.send(e);
}
var Yo = new TextEncoder();
function Xo(t) {
	if (t.length === 0 || t.length % 2 !== 0) return null;
	let e = new Uint8Array(t.length / 2);
	for (let n = 0; n < e.length; n += 1) {
		let r = Number.parseInt(t.slice(n * 2, n * 2 + 2), 16);
		if (Number.isNaN(r)) return null;
		e[n] = r;
	}
	return e;
}
function Qo(t, e) {
	if (t.length !== e.length) return !1;
	let n = 0;
	for (let r = 0; r < t.length; r += 1) n |= t[r] ^ e[r];
	return n === 0;
}
async function qt(t, e, n) {
	if (!n) return !1;
	let r = "sha256=";
	if (!n.startsWith(r)) return !1;
	let o = n.slice(r.length).trim().toLowerCase(),
		a = Xo(o);
	if (!a) return !1;
	let i = await crypto.subtle.importKey("raw", Yo.encode(t), { name: "HMAC", hash: "SHA-256" }, !1, ["sign"]),
		s = e instanceof Uint8Array ? new Uint8Array(e) : new Uint8Array(e),
		c = new Uint8Array(await crypto.subtle.sign("HMAC", i, s));
	return Qo(a, c);
}
async function Pr(t) {
	let e = Tr(t.env.LOG_LEVEL),
		n = await t.req.arrayBuffer(),
		r = t.req.header("X-Hub-Signature-256");
	if (!((await qt(t.env.INSTAGRAM_APP_SECRET, n, r)) || (!!t.env.META_APP_SECRET && (await qt(t.env.META_APP_SECRET, n, r)))))
		return (e.warn({ action: "webhook.signature_invalid", httpStatus: 401 }), t.text("invalid signature", 401));
	let a;
	try {
		a = JSON.parse(new TextDecoder().decode(n));
	} catch {
		return t.text("bad request", 400);
	}
	let i = Nt(a).filter((l) => l.instagramCommentId && l.instagramMediaId),
		s = Ut(a).filter((l) => l.messageId && l.storyId),
		c = [];
	for (let l of i)
		c.push({
			eventKey: await ct({
				instagramAccountId: l.instagramAccountId,
				instagramMediaId: l.instagramMediaId,
				instagramCommentId: l.instagramCommentId,
				eventType: l.eventType,
				eventTimestamp: l.eventTimestamp,
			}),
			eventType: "comments",
			platform: l.platform,
			instagramAccountId: l.instagramAccountId,
			instagramMediaId: l.instagramMediaId,
			instagramCommentId: l.instagramCommentId,
		});
	for (let l of s)
		c.push({
			eventKey: await ct({ stableEventId: l.messageId }),
			eventType: "story_reply",
			platform: "instagram",
			instagramAccountId: l.instagramAccountId,
			instagramMediaId: l.storyId,
			instagramCommentId: l.messageId,
		});
	for (let l of Bt(a)) {
		let p = Ft(l);
		c.push({
			eventKey: await ct({ stableEventId: p }),
			eventType: "messaging",
			platform: l.platform,
			instagramAccountId: l.instagramAccountId,
			instagramMediaId: "",
			instagramCommentId: p,
		});
	}
	let u = t.env.DB;
	for (let l of c) {
		let p = await u.select().from(C).where(Cr(C.eventKey, l.eventKey)).limit(1);
		if (p.length > 0) {
			await u
				.update(C)
				.set({ duplicateCount: p[0].duplicateCount + 1, lastReceivedAt: new Date().toISOString() })
				.where(Cr(C.id, p[0].id));
			continue;
		}
		let m = crypto.randomUUID();
		(await u
			.insert(C)
			.values({
				id: m,
				eventKey: l.eventKey,
				eventType: l.eventType,
				instagramAccountId: l.instagramAccountId,
				instagramMediaId: l.instagramMediaId,
				instagramCommentId: l.instagramCommentId,
				rawPayload: JSON.stringify(a),
				signatureValid: 1,
				status: "received",
			}),
			await xr(t.env.COMMENT_QUEUE, {
				webhookEventId: m,
				eventKey: l.eventKey,
				instagramAccountId: l.instagramAccountId,
				instagramMediaId: l.instagramMediaId,
				instagramCommentId: l.instagramCommentId,
				eventType: l.eventType,
				platform: l.platform,
			}));
	}
	return t.text("ok", 200);
}
function vr(t) {
	let e = t.req.query("hub.mode"),
		n = t.req.query("hub.verify_token"),
		r = t.req.query("hub.challenge");
	return e === "subscribe" && n && n === t.env.WEBHOOK_VERIFY_TOKEN ? t.text(r ?? "", 200) : t.text("Forbidden", 403);
}
function Dr() {
	let t = new Zo();
	return (t.get("/meta/instagram", (e) => vr(e)), t.post("/meta/instagram", (e) => Pr(e)), t);
}
function Mr() {
	let t = new ei();
	return (
		t.use("*", async (e, n) => ((e.env = await Ze(e.env)), n())),
		t.get("/", (e) => {
			let n = e.env.ADMIN_SITE_URL?.trim();
			if (n) return e.redirect(n, 302);
			let r = (e.env.ADMIN_ORIGINS ?? "").split(",")[0]?.trim();
			return r ? e.redirect(r.replace(/\/$/, "") + "/CHAT/", 302) : e.text("IG／FB 自動私訊 API 運作中", 200);
		}),
		t.use("/api/admin/*", async (e, n) => {
			let r = ke(e.env.ADMIN_ORIGINS);
			return ti({
				origin: (o) => (r.includes(o) ? o : null),
				allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
				allowHeaders: ["Content-Type", "Authorization"],
				exposeHeaders: ["Content-Disposition"],
				maxAge: 600,
			})(e, n);
		}),
		t.get("/api/health", async (e) => {
			try {
				return (await e.env.DB.execute(ni`select 1`), e.json({ status: "ok" }));
			} catch {
				return e.json({ status: "degraded" }, 503);
			}
		}),
		t.get("/privacy", (e) => e.html(Rr(e.env.PRIVACY_CONTACT))),
		t.route("/api/admin", Jn()),
		t.route("/api/webhooks", Dr()),
		t.route("/api/internal", kr()),
		t.route("/api/oauth", On()),
		t
	);
}
function Or(t, e, n = Date.now) {
	let r = new Map();
	return {
		async limit({ key: o }) {
			let a = n(),
				i = Math.floor(a / (e * 1e3)),
				s = r.get(o);
			if (!s || s.windowStart !== i) {
				if ((r.set(o, { windowStart: i, count: 1 }), r.size > 1e3)) for (let [c, u] of r) u.windowStart !== i && r.delete(c);
				return { success: !0 };
			}
			return ((s.count += 1), { success: s.count <= t });
		},
	};
}
var Ur = Deno.env.get("SUPABASE_DB_URL");
if (!Ur) throw new Error("缺少 SUPABASE_DB_URL");
var Br = ai(Ur, { prepare: !1, max: 3, idle_timeout: 20 }),
	Fr = ri(Br, { schema: He }),
	oi = ["ADMIN_SESSION_SECRET", "CRON_SECRET", "WEBHOOK_VERIFY_TOKEN"];
async function ii() {
	try {
		let t = await Br`
      select name, decrypted_secret from vault.decrypted_secrets where name = any(${oi})`;
		return Object.fromEntries(t.map((e) => [e.name, e.decrypted_secret]));
	} catch (t) {
		return (console.error("[vault] 讀取失敗：", t?.name ?? t), {});
	}
}
var $r = Deno.env.toObject(),
	Nr = ($r.SUPABASE_URL ?? "").replace(/\/$/, ""),
	Ht = {
		META_GRAPH_API_VERSION: "v21.0",
		APP_ENV: "production",
		LOG_LEVEL: "info",
		ADMIN_ORIGINS: "https://seanchen0427.github.io",
		PUBLIC_API_BASE: Nr ? `${Nr}/functions/v1` : void 0,
		...(await ii()),
		...Object.fromEntries(Object.entries($r).filter(([, t]) => t !== "")),
		DB: Fr,
		ADMIN_RATE_LIMITER: Or(Qt, Zt),
	};
function si(t) {
	let e = t.catch((n) => console.error("[jobs] background run failed:", n?.name ?? n));
	typeof EdgeRuntime < "u" && EdgeRuntime && EdgeRuntime.waitUntil(e);
}
Ht.COMMENT_QUEUE = br(Fr, () => si(Ze(Ht).then((t) => ht(t))));
var li = Mr();
Deno.serve((t) => li.fetch(t, Ht));
