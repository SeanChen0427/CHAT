// @ts-nocheck
// 由 scripts/build-function.mjs 產生，請勿手動修改；原始碼在 src/。
var fr = Object.defineProperty;
var gr = (t, e) => {
	for (var n in e) fr(t, n, { get: e[n], enumerable: !0 });
};
import { drizzle as yi } from "npm:drizzle-orm@0.45.2/postgres-js";
import wi from "npm:postgres@3.4.9";
import { Hono as pi } from "npm:hono@4.12.32";
import { cors as fi } from "npm:hono@4.12.32/cors";
import { sql as gi } from "npm:drizzle-orm@0.45.2";
import { createMiddleware as yr } from "npm:hono@4.12.32/factory";
var wr = new Set(["GET", "HEAD", "OPTIONS"]);
function Ce(t) {
	if (!t || t === "null") return null;
	try {
		return new URL(t).origin;
	} catch {
		return null;
	}
}
function _r(t, e, n, r, i = []) {
	if (wr.has(t.toUpperCase())) return !0;
	let a = Ce(r);
	if (!a) return !1;
	let o = Ce(e) ?? Ce(n);
	return o ? o === a || i.includes(o) : !1;
}
function it(t) {
	return (t ?? "")
		.split(",")
		.map((e) => Ce(e.trim()))
		.filter((e) => !!e);
}
function H() {
	return yr(async (t, e) =>
		_r(t.req.method, t.req.header("Origin"), t.req.header("Referer"), t.req.url, it(t.env.ADMIN_ORIGINS)) ? e() : t.json({ error: "CSRF 檢查失敗" }, 403),
	);
}
import { Hono as xa } from "npm:hono@4.12.32";
import { eq as he, sql as Tr } from "npm:drizzle-orm@0.45.2";
import { Hono as Cr } from "npm:hono@4.12.32";
import { getCookie as Dr } from "npm:hono@4.12.32/cookie";
import { createMiddleware as Mr } from "npm:hono@4.12.32/factory";
var De = {};
gr(De, {
	PLATFORMS: () => hr,
	adminUsers: () => B,
	apiAttempts: () => F,
	auditLogs: () => z,
	automationKeywords: () => N,
	automationRuns: () => g,
	automations: () => f,
	contactAutomations: () => V,
	contacts: () => h,
	eventJobs: () => v,
	instagramAccounts: () => _,
	instagramMedia: () => w,
	loginRateLimits: () => W,
	publicReplyVariants: () => Z,
	sendCounters: () => X,
	systemSettings: () => K,
	webhookEvents: () => T,
});
import { pgTable as $, text as d, integer as x, uniqueIndex as _e, index as Y } from "npm:drizzle-orm@0.45.2/pg-core";
var A = () => new Date().toISOString(),
	B = $("admin_users", {
		id: d("id").primaryKey(),
		email: d("email").notNull().unique(),
		passwordHash: d("password_hash").notNull(),
		createdAt: d("created_at").notNull().$defaultFn(A),
		updatedAt: d("updated_at").notNull().$defaultFn(A),
	}),
	K = $("system_settings", {
		id: d("id").primaryKey(),
		emergencyStop: x("emergency_stop").notNull().default(0),
		maxPublicRepliesPerMinute: x("max_public_replies_per_minute"),
		maxPrivateRepliesPerMinute: x("max_private_replies_per_minute"),
		maxPublicRepliesPerDay: x("max_public_replies_per_day"),
		maxPrivateRepliesPerDay: x("max_private_replies_per_day"),
		createdAt: d("created_at").notNull().$defaultFn(A),
		updatedAt: d("updated_at").notNull().$defaultFn(A),
	}),
	hr = ["instagram", "facebook"],
	_ = $("instagram_accounts", {
		id: d("id").primaryKey(),
		instagramAccountId: d("instagram_account_id").notNull().unique(),
		platform: d("platform").notNull().default("instagram"),
		username: d("username"),
		profilePictureUrl: d("profile_picture_url"),
		accountType: d("account_type"),
		tokenExpiresAt: d("token_expires_at"),
		accessToken: d("access_token"),
		tokenRefreshedAt: d("token_refreshed_at"),
		webhookSubscribed: x("webhook_subscribed").notNull().default(0),
		automationEnabled: x("automation_enabled").notNull().default(1),
		circuitBreakerStatus: d("circuit_breaker_status").notNull().default("closed"),
		lastWebhookReceivedAt: d("last_webhook_received_at"),
		createdAt: d("created_at").notNull().$defaultFn(A),
		updatedAt: d("updated_at").notNull().$defaultFn(A),
	}),
	w = $(
		"instagram_media",
		{
			id: d("id").primaryKey(),
			instagramAccountId: d("instagram_account_id")
				.notNull()
				.references(() => _.id),
			instagramMediaId: d("instagram_media_id").notNull().unique(),
			platform: d("platform").notNull().default("instagram"),
			mediaType: d("media_type").notNull(),
			caption: d("caption"),
			thumbnailUrl: d("thumbnail_url"),
			permalink: d("permalink"),
			publishedAt: d("published_at"),
			lastSyncedAt: d("last_synced_at"),
			deletedAt: d("deleted_at"),
			createdAt: d("created_at").notNull().$defaultFn(A),
			updatedAt: d("updated_at").notNull().$defaultFn(A),
		},
		(t) => [Y("idx_media_account").on(t.instagramAccountId)],
	),
	f = $("automations", {
		id: d("id").primaryKey(),
		instagramMediaId: d("instagram_media_id")
			.unique()
			.references(() => w.id),
		applyScope: d("apply_scope").notNull().default("media"),
		platform: d("platform"),
		name: d("name").notNull(),
		status: d("status").notNull().default("draft"),
		matchType: d("match_type").notNull().default("contains_any"),
		publicReplyEnabled: x("public_reply_enabled").notNull().default(1),
		privateReplyEnabled: x("private_reply_enabled").notNull().default(1),
		openingDm: d("opening_dm"),
		buttonText: d("button_text"),
		buttonUrl: d("button_url"),
		dailyLimit: x("daily_limit"),
		excludeOwnComments: x("exclude_own_comments").notNull().default(1),
		followGateEnabled: x("follow_gate_enabled").notNull().default(0),
		notFollowingText: d("not_following_text"),
		recheckButtonText: d("recheck_button_text"),
		emailCaptureEnabled: x("email_capture_enabled").notNull().default(0),
		emailPromptText: d("email_prompt_text"),
		claimButtonText: d("claim_button_text"),
		deliveryText: d("delivery_text"),
		tag: d("tag"),
		oncePerContact: x("once_per_contact").notNull().default(0),
		createdAt: d("created_at").notNull().$defaultFn(A),
		updatedAt: d("updated_at").notNull().$defaultFn(A),
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
			isFollower: x("is_follower"),
			state: d("state"),
			firstSeenAt: d("first_seen_at").notNull().$defaultFn(A),
			lastSeenAt: d("last_seen_at").notNull().$defaultFn(A),
			createdAt: d("created_at").notNull().$defaultFn(A),
			updatedAt: d("updated_at").notNull().$defaultFn(A),
		},
		(t) => [Y("idx_contacts_last_seen").on(t.lastSeenAt)],
	),
	V = $(
		"contact_automations",
		{
			id: d("id").primaryKey(),
			igsid: d("igsid").notNull(),
			automationId: d("automation_id").notNull(),
			firstTriggeredAt: d("first_triggered_at").notNull().$defaultFn(A),
			deliveredAt: d("delivered_at"),
		},
		(t) => [_e("contact_automations_igsid_automation_unique").on(t.igsid, t.automationId), Y("idx_contact_automations_automation").on(t.automationId)],
	),
	N = $(
		"automation_keywords",
		{
			id: d("id").primaryKey(),
			automationId: d("automation_id").notNull(),
			keyword: d("keyword").notNull(),
			normalizedKeyword: d("normalized_keyword").notNull(),
			createdAt: d("created_at").notNull().$defaultFn(A),
		},
		(t) => [
			_e("automation_keywords_automation_id_normalized_keyword_unique").on(t.automationId, t.normalizedKeyword),
			Y("idx_keywords_automation").on(t.automationId),
		],
	),
	Z = $("public_reply_variants", {
		id: d("id").primaryKey(),
		automationId: d("automation_id").notNull(),
		message: d("message").notNull(),
		enabled: x("enabled").notNull().default(1),
		createdAt: d("created_at").notNull().$defaultFn(A),
		updatedAt: d("updated_at").notNull().$defaultFn(A),
	}),
	T = $(
		"webhook_events",
		{
			id: d("id").primaryKey(),
			eventKey: d("event_key").notNull().unique(),
			eventType: d("event_type").notNull(),
			instagramAccountId: d("instagram_account_id"),
			instagramMediaId: d("instagram_media_id"),
			instagramCommentId: d("instagram_comment_id"),
			rawPayload: d("raw_payload").notNull(),
			signatureValid: x("signature_valid").notNull(),
			status: d("status").notNull().default("received"),
			duplicateCount: x("duplicate_count").notNull().default(0),
			receivedAt: d("received_at").notNull().$defaultFn(A),
			lastReceivedAt: d("last_received_at").notNull().$defaultFn(A),
			processedAt: d("processed_at"),
		},
		(t) => [Y("idx_webhook_comment").on(t.instagramCommentId), Y("idx_webhook_received").on(t.receivedAt)],
	),
	g = $(
		"automation_runs",
		{
			id: d("id").primaryKey(),
			automationId: d("automation_id").notNull(),
			webhookEventId: d("webhook_event_id").references(() => T.id),
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
			retryCount: x("retry_count").notNull().default(0),
			startedAt: d("started_at"),
			completedAt: d("completed_at"),
			createdAt: d("created_at").notNull().$defaultFn(A),
			updatedAt: d("updated_at").notNull().$defaultFn(A),
		},
		(t) => [
			_e("automation_runs_automation_id_instagram_comment_id_unique").on(t.automationId, t.instagramCommentId),
			Y("idx_runs_status").on(t.status),
			Y("idx_runs_created").on(t.createdAt),
			Y("idx_runs_media").on(t.instagramMediaId),
		],
	),
	F = $(
		"api_attempts",
		{
			id: d("id").primaryKey(),
			automationRunId: d("automation_run_id").notNull(),
			actionType: d("action_type").notNull(),
			attemptNumber: x("attempt_number").notNull(),
			httpStatus: x("http_status"),
			failureReason: d("failure_reason"),
			metaErrorCode: d("meta_error_code"),
			metaErrorSubcode: d("meta_error_subcode"),
			metaErrorMessage: d("meta_error_message"),
			metaTraceId: d("meta_trace_id"),
			requestPayloadRedacted: d("request_payload_redacted"),
			responsePayloadRedacted: d("response_payload_redacted"),
			startedAt: d("started_at").notNull().$defaultFn(A),
			completedAt: d("completed_at"),
		},
		(t) => [Y("idx_attempts_run").on(t.automationRunId)],
	),
	z = $("audit_logs", {
		id: d("id").primaryKey(),
		adminUserId: d("admin_user_id"),
		action: d("action").notNull(),
		entityType: d("entity_type"),
		entityId: d("entity_id"),
		metadata: d("metadata"),
		ipAddress: d("ip_address"),
		createdAt: d("created_at").notNull().$defaultFn(A),
	}),
	W = $(
		"login_rate_limits",
		{
			id: d("id").primaryKey(),
			ipAddress: d("ip_address").notNull(),
			windowStart: d("window_start").notNull(),
			attemptCount: x("attempt_count").notNull().default(0),
			createdAt: d("created_at").notNull().$defaultFn(A),
			updatedAt: d("updated_at").notNull().$defaultFn(A),
		},
		(t) => [Y("idx_login_rate_limits_ip").on(t.ipAddress), _e("login_rate_limits_ip_window_unique").on(t.ipAddress, t.windowStart)],
	),
	X = $(
		"send_counters",
		{
			id: d("id").primaryKey(),
			scopeKey: d("scope_key").notNull(),
			windowStart: d("window_start").notNull(),
			count: x("count").notNull().default(0),
			createdAt: d("created_at").notNull().$defaultFn(A),
			updatedAt: d("updated_at").notNull().$defaultFn(A),
		},
		(t) => [_e("send_counters_scope_window_unique").on(t.scopeKey, t.windowStart)],
	),
	v = $(
		"event_jobs",
		{
			id: d("id").primaryKey(),
			message: d("message").notNull(),
			status: d("status").notNull().default("pending"),
			attempts: x("attempts").notNull().default(0),
			nextRunAt: d("next_run_at").notNull().$defaultFn(A),
			lastError: d("last_error"),
			createdAt: d("created_at").notNull().$defaultFn(A),
			updatedAt: d("updated_at").notNull().$defaultFn(A),
		},
		(t) => [Y("idx_event_jobs_due").on(t.status, t.nextRunAt)],
	);
var Pt = "SHA-256";
var Nt = new TextEncoder();
function Dt(t) {
	let e = "";
	for (let n of t) e += String.fromCharCode(n);
	return btoa(e);
}
function Mt(t) {
	let e = atob(t),
		n = new Uint8Array(e.length);
	for (let r = 0; r < e.length; r += 1) n[r] = e.charCodeAt(r);
	return n;
}
async function br(t, e, n) {
	let r = await crypto.subtle.importKey("raw", new Uint8Array(t), "PBKDF2", !1, ["deriveBits"]),
		i = new Uint8Array(e),
		a = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: i, iterations: n, hash: Pt }, r, 256);
	return new Uint8Array(a);
}
async function Ot(t, e, n, r) {
	let i = t;
	for (let a = 0; a < r; a += 1) i = await br(i, e, n);
	return i;
}
function Sr(t, e) {
	if (t.length !== e.length) return !1;
	let n = 0;
	for (let r = 0; r < t.length; r += 1) n |= t[r] ^ e[r];
	return n === 0;
}
async function Me(t) {
	let e = crypto.getRandomValues(new Uint8Array(16)),
		n = await Ot(Nt.encode(t), e, 1e5, 6);
	return `pbkdf2$${Pt.toLowerCase().replace("-", "")}$100000x6$${Dt(e)}$${Dt(n)}`;
}
async function st(t, e) {
	let n = e.split("$");
	if (n.length !== 5 || n[0] !== "pbkdf2") return !1;
	let [r, i] = n[2].split("x"),
		a = Number.parseInt(r, 10),
		o = Number.parseInt(i ?? "1", 10);
	if (!Number.isInteger(a) || a <= 0 || !Number.isInteger(o) || o <= 0) return !1;
	let l, m;
	try {
		((l = Mt(n[3])), (m = Mt(n[4])));
	} catch {
		return !1;
	}
	let u = await Ot(Nt.encode(t), l, a, o);
	return Sr(u, m);
}
var ot = null;
function Ut() {
	return (ot || (ot = Me("timing-equalization-dummy-password")), ot);
}
import { and as Ar, eq as Ir, lt as Rr, sql as kr } from "npm:drizzle-orm@0.45.2";
import { createMiddleware as Ft } from "npm:hono@4.12.32/factory";
function G(t) {
	let e = t.header("CF-Connecting-IP");
	if (e) return e;
	let n = t.header("X-Forwarded-For");
	return (n && n.split(",")[0].trim()) || null;
}
var Bt = 900,
	Er = 10,
	Lt = 120,
	$t = 60;
function lt(t) {
	let e = Math.floor(t / 1e3 / Bt) * Bt;
	return new Date(e * 1e3).toISOString();
}
async function xr(t, e, n = Date.now()) {
	try {
		let r = lt(n);
		await t.delete(W).where(Ar(Ir(W.ipAddress, e), Rr(W.windowStart, r)));
		let a = (
			await t
				.insert(W)
				.values({ id: crypto.randomUUID(), ipAddress: e, windowStart: r, attemptCount: 1 })
				.onConflictDoUpdate({ target: [W.ipAddress, W.windowStart], set: { attemptCount: kr`${W.attemptCount} + 1`, updatedAt: new Date().toISOString() } })
				.returning({ attemptCount: W.attemptCount })
		)[0]?.attemptCount;
		return typeof a != "number" ? !1 : a <= Er;
	} catch {
		return !1;
	}
}
function Pe() {
	return Ft(async (t, e) => {
		let n = G(t.req) ?? "unknown";
		return (await xr(t.env.DB, n)) ? e() : t.json({ error: "登入嘗試次數過多，請稍後再試。" }, 429);
	});
}
function L() {
	return Ft(async (t, e) => {
		let n = t.get("adminUserId") ?? G(t.req) ?? "anonymous";
		try {
			let { success: r } = await t.env.ADMIN_RATE_LIMITER.limit({ key: n });
			if (!r) return t.json({ error: "請求過於頻繁，請稍後再試。" }, 429);
		} catch {
			return t.json({ error: "頻率限制檢查失敗。" }, 429);
		}
		return e();
	});
}
var Oe = "ig_admin_session",
	Ne = new TextEncoder(),
	vr = new TextDecoder();
function Kt(t) {
	let e = "";
	for (let n of t) e += String.fromCharCode(n);
	return btoa(e).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function qt(t) {
	let e = t.replace(/-/g, "+").replace(/_/g, "/"),
		n = atob(e),
		r = new Uint8Array(n.length);
	for (let i = 0; i < n.length; i += 1) r[i] = n.charCodeAt(i);
	return r;
}
async function jt(t) {
	return crypto.subtle.importKey("raw", Ne.encode(t), { name: "HMAC", hash: "SHA-256" }, !1, ["sign", "verify"]);
}
async function dt(t, e, n) {
	let r = Math.floor(Date.now() / 1e3),
		i = { sub: e, kid: "1", iat: r, exp: r + n },
		a = Kt(Ne.encode(JSON.stringify(i))),
		o = await jt(t),
		l = await crypto.subtle.sign("HMAC", o, Ne.encode(a)),
		m = Kt(new Uint8Array(l));
	return `${a}.${m}`;
}
async function Ht(t, e) {
	if (!e || typeof e != "string") return { valid: !1 };
	let n = e.split(".");
	if (n.length !== 2) return { valid: !1 };
	let [r, i] = n;
	if (!r || !i) return { valid: !1 };
	let a;
	try {
		a = qt(i);
	} catch {
		return { valid: !1 };
	}
	let o = await jt(t),
		l;
	try {
		l = await crypto.subtle.verify("HMAC", o, a, Ne.encode(r));
	} catch {
		return { valid: !1 };
	}
	if (!l) return { valid: !1 };
	let m;
	try {
		m = JSON.parse(vr.decode(qt(r)));
	} catch {
		return { valid: !1 };
	}
	return typeof m.sub != "string" || m.sub.length === 0
		? { valid: !1 }
		: typeof m.exp != "number" || !Number.isFinite(m.exp)
			? { valid: !1 }
			: Math.floor(Date.now() / 1e3) >= m.exp
				? { valid: !1 }
				: { valid: !0, payload: m };
}
function mt(t, e) {
	return `${Oe}=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${e}`;
}
function Vt() {
	return `${Oe}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
var Ue = 3600 * 8;
async function ie(t, e) {
	try {
		await t.DB.insert(z).values({
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
	return Mr(async (t, e) => {
		let n = t.req.header("Authorization"),
			i = (n?.startsWith("Bearer ") ? n.slice(7).trim() : void 0) || Dr(t, Oe),
			a = await Ht(t.env.ADMIN_SESSION_SECRET, i);
		return a.valid ? (t.set("adminUserId", a.payload.sub), e()) : t.json({ error: "未授權" }, 401);
	});
}
var Be = 12,
	Fe = 256,
	Pr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function Gt() {
	let t = new Cr();
	return (
		t.get("/setup-status", async (e) => {
			let r = await e.env.DB.select({ id: B.id }).from(B).limit(1);
			return e.json({ needsSetup: r.length === 0 });
		}),
		t.post("/setup", H(), Pe(), async (e) => {
			let n = G(e.req),
				r;
			try {
				r = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let i = typeof r.email == "string" ? r.email.trim() : "",
				a = typeof r.password == "string" ? r.password : "";
			if (!Pr.test(i)) return e.json({ error: "Email 格式不正確" }, 400);
			if (a.length < Be) return e.json({ error: `密碼長度至少需要 ${Be} 個字元` }, 400);
			if (a.length > Fe) return e.json({ error: `密碼長度不可超過 ${Fe} 個字元` }, 400);
			let o = e.env.DB;
			if ((await o.select({ id: B.id }).from(B).limit(1)).length > 0)
				return (await ie(e.env, { adminUserId: null, action: "admin.setup.rejected", ipAddress: n }), e.json({ error: "系統已完成初始設定" }, 403));
			let m = crypto.randomUUID(),
				u = await Me(a),
				s = new Date().toISOString();
			if (
				(await o.execute(Tr`
      INSERT INTO admin_users (id, email, password_hash, created_at, updated_at)
      SELECT ${m}, ${i}, ${u}, ${s}, ${s}
      WHERE NOT EXISTS (SELECT 1 FROM admin_users)
    `),
				!(await o.select().from(B).where(he(B.id, m)).limit(1))[0])
			)
				return (await ie(e.env, { adminUserId: null, action: "admin.setup.rejected", ipAddress: n }), e.json({ error: "系統已完成初始設定" }, 403));
			let c = await dt(e.env.ADMIN_SESSION_SECRET, m, Ue);
			return (
				e.header("Set-Cookie", mt(c, Ue)),
				await ie(e.env, { adminUserId: m, action: "admin.setup.success", ipAddress: n }),
				e.json({ ok: !0, token: c })
			);
		}),
		t.get("/me", J(), L(), async (e) => {
			let r = await e.env.DB.select({ email: B.email })
				.from(B)
				.where(he(B.id, e.get("adminUserId")))
				.limit(1);
			return r[0] ? e.json({ email: r[0].email }) : e.json({ error: "未授權" }, 401);
		}),
		t.post("/change-password", H(), J(), Pe(), async (e) => {
			let n = G(e.req),
				r;
			try {
				r = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let i = typeof r.currentPassword == "string" ? r.currentPassword : "",
				a = typeof r.newPassword == "string" ? r.newPassword : "";
			if (!i) return e.json({ error: "請輸入目前密碼" }, 400);
			if (a.length < Be) return e.json({ error: `新密碼長度至少需要 ${Be} 個字元` }, 400);
			if (a.length > Fe) return e.json({ error: `新密碼長度不可超過 ${Fe} 個字元` }, 400);
			let o = e.env.DB,
				l = e.get("adminUserId"),
				u = (await o.select().from(B).where(he(B.id, l)).limit(1))[0];
			return u
				? (await st(i, u.passwordHash))
					? (await o
							.update(B)
							.set({ passwordHash: await Me(a), updatedAt: new Date().toISOString() })
							.where(he(B.id, l)),
						await ie(e.env, { adminUserId: l, action: "admin.password.change.success", ipAddress: n }),
						e.json({ ok: !0 }))
					: (await ie(e.env, { adminUserId: l, action: "admin.password.change.failure", ipAddress: n }), e.json({ error: "目前密碼不正確" }, 400))
				: e.json({ error: "未授權" }, 401);
		}),
		t.post("/login", H(), Pe(), async (e) => {
			let n = G(e.req),
				r;
			try {
				r = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let i = typeof r.email == "string" ? r.email : "",
				a = typeof r.password == "string" ? r.password : "";
			if (!i || !a) return e.json({ error: "請輸入 Email 與密碼" }, 400);
			let m = (await e.env.DB.select().from(B).where(he(B.email, i)).limit(1))[0],
				u = m ? m.passwordHash : await Ut(),
				s = await st(a, u);
			if (!m || !s)
				return (await ie(e.env, { adminUserId: m ? m.id : null, action: "admin.login.failure", ipAddress: n }), e.json({ error: "Email 或密碼錯誤" }, 401));
			let p = await dt(e.env.ADMIN_SESSION_SECRET, m.id, Ue);
			return (
				e.header("Set-Cookie", mt(p, Ue)),
				await ie(e.env, { adminUserId: m.id, action: "admin.login.success", ipAddress: n }),
				e.json({ ok: !0, token: p })
			);
		}),
		t.post("/logout", H(), J(), L(), async (e) => {
			let n = G(e.req);
			return (e.header("Set-Cookie", Vt()), await ie(e.env, { adminUserId: e.get("adminUserId"), action: "admin.logout", ipAddress: n }), e.json({ ok: !0 }));
		}),
		t
	);
}
import { and as Ur, eq as O } from "npm:drizzle-orm@0.45.2";
import { Hono as Br } from "npm:hono@4.12.32";
import { toSimplified as Nr } from "npm:chinese-simple2traditional@2.3.2";
function oe(t) {
	let e = t.replace(/[！-～]/g, (n) => String.fromCharCode(n.charCodeAt(0) - 65248));
	return ((e = e.replace(/\u3000/g, " ")), (e = e.toLowerCase()), (e = Nr(e)), (e = e.replace(/\s+/g, " ")), e.trim());
}
function Or(t) {
	if (!t) return !1;
	try {
		return new URL(t).protocol === "https:";
	} catch {
		return !1;
	}
}
var ut = ["contains_any", "exact_any", "all_comments"];
function zt(t) {
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
		t.buttonUrl && !Or(t.buttonUrl) && e.push("button_url_invalid"),
		t.tokenHealthy || e.push("token_unhealthy"),
		t.emergencyStop && e.push("emergency_stop_active"),
		e
	);
}
var Fr = ["media", "next_post", "account_default", "dm_keyword", "ref"];
function Wt(t) {
	return t === "instagram" || t === "facebook" ? t : null;
}
var Lr = ["notFollowingText", "recheckButtonText", "emailPromptText", "claimButtonText", "deliveryText", "tag"],
	$r = ["followGateEnabled", "emailCaptureEnabled", "oncePerContact"];
function Jt(t) {
	let e = {};
	for (let n of Lr) {
		let r = t[n];
		r !== void 0 && (e[n] = typeof r == "string" && r.trim() ? r.trim().slice(0, n === "tag" ? 40 : 640) : null);
	}
	for (let n of $r) typeof t[n] == "boolean" && (e[n] = t[n] ? 1 : 0);
	return e;
}
function Le(t) {
	return Array.isArray(t) ? t.filter((e) => typeof e == "string" && e.trim().length > 0) : [];
}
async function Yt(t, e, n) {
	await t.delete(N).where(O(N.automationId, e));
	let r = new Set();
	for (let i of n) {
		let a = oe(i);
		!a || r.has(a) || (r.add(a), await t.insert(N).values({ id: crypto.randomUUID(), automationId: e, keyword: i, normalizedKeyword: a }));
	}
}
async function Xt(t, e, n) {
	await t.delete(Z).where(O(Z.automationId, e));
	for (let r of n.slice(0, 5)) await t.insert(Z).values({ id: crypto.randomUUID(), automationId: e, message: r, enabled: 1 });
}
function Qt() {
	let t = new Br();
	return (
		t.use("*", H(), J(), L()),
		t.post("/", async (e) => {
			let n;
			try {
				n = await e.req.json();
			} catch {
				return e.json({ error: "請求格式錯誤" }, 400);
			}
			let r = Fr.includes(n.applyScope) ? n.applyScope : "media";
			if (!n.name || (r === "media" && !n.instagramMediaId)) return e.json({ error: "缺少必要欄位" }, 400);
			let i = n.matchType ?? "contains_any";
			if (!ut.includes(i)) return e.json({ error: "比對模式無效" }, 400);
			let a = e.env.DB;
			if (r === "media" && (await a.select().from(w).where(O(w.id, n.instagramMediaId)).limit(1)).length === 0) return e.json({ error: "貼文不存在" }, 404);
			let o = Wt(n.platform);
			if (
				r === "account_default" &&
				(await a.select().from(f).where(O(f.applyScope, "account_default"))).find((s) => s.platform == null || o == null || s.platform === o)
			)
				return e.json({ error: "這個平台已有全帳號預設自動化，請編輯既有的那一組" }, 409);
			let l = crypto.randomUUID();
			return (
				await a
					.insert(f)
					.values({
						id: l,
						instagramMediaId: r === "media" ? n.instagramMediaId : null,
						applyScope: r,
						platform: r === "media" ? null : o,
						name: n.name,
						status: "draft",
						matchType: i,
						publicReplyEnabled: n.publicReplyEnabled === !1 ? 0 : 1,
						privateReplyEnabled: n.privateReplyEnabled === !1 ? 0 : 1,
						openingDm: n.openingDm ?? null,
						buttonText: n.buttonText ?? null,
						buttonUrl: n.buttonUrl ?? null,
						dailyLimit: typeof n.dailyLimit == "number" ? n.dailyLimit : null,
						...Jt(n),
					}),
				await Yt(a, l, Le(n.keywords)),
				await Xt(a, l, Le(n.publicReplyVariants)),
				e.json({ id: l }, 201)
			);
		}),
		t.get("/overview", async (e) => {
			let n = e.env.DB,
				r = await n.select().from(f),
				i = await n.select().from(w),
				a = await n.select().from(g),
				o = await n.select().from(N),
				l = await n.select().from(V),
				m = new Map(i.map((s) => [s.id, s])),
				u = r
					.filter((s) => !(s.instagramMediaId ? m.get(s.instagramMediaId) : void 0)?.deletedAt)
					.map((s) => {
						let p = s.instagramMediaId ? m.get(s.instagramMediaId) : void 0,
							c = a.filter((y) => y.automationId === s.id);
						return {
							automationId: s.id,
							name: s.name,
							status: s.status,
							applyScope: s.applyScope,
							matchType: s.matchType,
							keywordCount: o.filter((y) => y.automationId === s.id).length,
							media: p
								? { id: p.id, platform: p.platform, mediaType: p.mediaType, caption: p.caption, thumbnailUrl: p.thumbnailUrl, permalink: p.permalink }
								: null,
							stats: {
								triggered: c.length,
								publicReplySuccess: c.filter((y) => y.publicReplyStatus === "success").length,
								dmSuccess: c.filter((y) => y.privateReplyStatus === "success").length,
								failures: c.filter((y) => y.status === "completed_with_errors").length,
								delivered: l.filter((y) => y.automationId === s.id && y.deliveredAt).length,
							},
							gated: s.followGateEnabled === 1 || s.emailCaptureEnabled === 1,
							platform: p ? p.platform : s.platform,
							tag: s.tag,
						};
					})
					.sort((s, p) => {
						let c = { active: 0, paused: 1, draft: 2 };
						return (c[s.status] ?? 9) - (c[p.status] ?? 9);
					});
			return e.json({ automations: u });
		}),
		t.get("/:id", async (e) => {
			let n = e.req.param("id"),
				r = e.env.DB,
				i = await r.select().from(f).where(O(f.id, n)).limit(1);
			if (i.length === 0) return e.json({ error: "自動化不存在" }, 404);
			let a = await r.select().from(N).where(O(N.automationId, n)),
				o = await r.select().from(Z).where(O(Z.automationId, n)),
				l = i[0].instagramMediaId ? ((await r.select().from(w).where(O(w.id, i[0].instagramMediaId)).limit(1))[0] ?? null) : null;
			return e.json({
				automation: i[0],
				media: l ? { id: l.id, platform: l.platform, mediaType: l.mediaType, caption: l.caption, thumbnailUrl: l.thumbnailUrl } : null,
				keywords: a.map((m) => m.keyword),
				publicReplyVariants: o.map((m) => m.message),
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
			let i = e.env.DB,
				a = await i.select().from(f).where(O(f.id, n)).limit(1);
			if (a.length === 0) return e.json({ error: "自動化不存在" }, 404);
			let o = { updatedAt: new Date().toISOString() };
			return (
				typeof r.name == "string" && (o.name = r.name),
				r.matchType && ut.includes(r.matchType) && (o.matchType = r.matchType),
				typeof r.publicReplyEnabled == "boolean" && (o.publicReplyEnabled = r.publicReplyEnabled ? 1 : 0),
				typeof r.privateReplyEnabled == "boolean" && (o.privateReplyEnabled = r.privateReplyEnabled ? 1 : 0),
				r.openingDm !== void 0 && (o.openingDm = r.openingDm),
				r.buttonText !== void 0 && (o.buttonText = r.buttonText),
				r.buttonUrl !== void 0 && (o.buttonUrl = r.buttonUrl),
				typeof r.dailyLimit == "number" && (o.dailyLimit = r.dailyLimit),
				Object.assign(o, Jt(r)),
				r.platform !== void 0 && a[0].applyScope !== "media" && a[0].applyScope !== "account_default" && (o.platform = Wt(r.platform)),
				await i.update(f).set(o).where(O(f.id, n)),
				r.keywords !== void 0 && (await Yt(i, n, Le(r.keywords))),
				r.publicReplyVariants !== void 0 && (await Xt(i, n, Le(r.publicReplyVariants))),
				e.json({ ok: !0 })
			);
		}),
		t.post("/:id/activate", async (e) => {
			let n = e.req.param("id"),
				r = e.env.DB,
				a = (await r.select().from(f).where(O(f.id, n)).limit(1))[0],
				o = a ? await r.select().from(N).where(O(N.automationId, n)) : [],
				l = await r.select().from(K).limit(1),
				m = !0,
				u = null;
			if (a) {
				a.instagramMediaId && (u = (await r.select().from(w).where(O(w.id, a.instagramMediaId)).limit(1))[0] ?? null);
				let p = u
					? await r.select().from(_).where(O(_.id, u.instagramAccountId)).limit(1)
					: a.platform
						? await r.select().from(_).where(O(_.platform, a.platform)).limit(1)
						: await r.select().from(_).limit(1);
				p[0] && (m = p[0].circuitBreakerStatus === "closed");
			}
			let s = zt({
				automationExists: !!a,
				matchType: a?.matchType ?? "",
				keywordCount: o.length,
				publicReplyEnabled: a?.publicReplyEnabled === 1,
				privateReplyEnabled: a?.privateReplyEnabled === 1,
				openingDm: a?.openingDm ?? null,
				buttonUrl: a?.buttonUrl ?? null,
				tokenHealthy: m,
				emergencyStop: l[0]?.emergencyStop === 1,
				isStory: u?.mediaType === "STORY",
				applyScope: a?.applyScope,
				followGateEnabled: a?.followGateEnabled === 1,
				emailCaptureEnabled: a?.emailCaptureEnabled === 1,
			});
			return s.length > 0
				? e.json({ error: "activation_failed", reasons: s }, 422)
				: (await r.update(f).set({ status: "active", updatedAt: new Date().toISOString() }).where(O(f.id, n)), e.json({ ok: !0 }));
		}),
		t.post("/:id/pause", async (e) => {
			let n = e.req.param("id"),
				r = e.env.DB;
			return (await r.select().from(f).where(O(f.id, n)).limit(1)).length === 0
				? e.json({ error: "自動化不存在" }, 404)
				: (await r
						.update(f)
						.set({ status: "paused", updatedAt: new Date().toISOString() })
						.where(Ur(O(f.id, n))),
					e.json({ ok: !0 }));
		}),
		t
	);
}
import { desc as Zt, eq as $e } from "npm:drizzle-orm@0.45.2";
import { Hono as Kr } from "npm:hono@4.12.32";
function nn(t) {
	try {
		let e = JSON.parse(t);
		return Array.isArray(e) ? e.filter((n) => typeof n == "string") : [];
	} catch {
		return [];
	}
}
function en(t, e) {
	let n = (e.q ?? "").trim().toLowerCase();
	return t
		.map((r) => ({ ...r, tags: nn(r.tags) }))
		.filter(
			(r) =>
				!(
					(e.hasEmail === "1" && !r.email) ||
					(e.tag && !r.tags.includes(e.tag)) ||
					(n && ![r.username, r.name, r.email].filter(Boolean).join(" ").toLowerCase().includes(n))
				),
		);
}
function qr(t) {
	let e = /^[=+\-@]/.test(t) ? `'${t}` : t;
	return /[",\r\n]/.test(e) || e !== t ? `"${e.replace(/"/g, '""')}"` : e;
}
function tn(t) {
	if (!t) return "";
	let e = Date.parse(t);
	return Number.isNaN(e) ? "" : new Date(e + 8 * 36e5).toISOString().slice(0, 16).replace("T", " ");
}
function jr(t) {
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
				tn(r.firstSeenAt),
				tn(r.lastSeenAt),
			]
				.map(qr)
				.join(","),
		);
	return (
		"\uFEFF" +
		n.join(`\r
`)
	);
}
function rn() {
	let t = new Kr();
	return (
		t.use("*", J(), L()),
		t.get("/", async (e) => {
			let n = e.env.DB,
				r = e.req.query(),
				i = Math.min(Number.parseInt(r.limit ?? "", 10) || 200, 1e3),
				a = await n.select().from(h).orderBy(Zt(h.lastSeenAt)),
				o = en(a, r);
			return e.json({ total: o.length, contacts: o.slice(0, i) });
		}),
		t.get("/tags", async (e) => {
			let n = e.env.DB,
				r = new Map();
			for (let i of await n.select({ tags: h.tags }).from(h)) for (let a of nn(i.tags)) r.set(a, (r.get(a) ?? 0) + 1);
			return e.json({ tags: [...r.entries()].sort((i, a) => a[1] - i[1]).map(([i, a]) => ({ tag: i, count: a })) });
		}),
		t.get("/export.csv", async (e) => {
			let n = e.env.DB,
				r = en(await n.select().from(h).orderBy(Zt(h.lastSeenAt)), e.req.query()),
				i = new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
			return (
				await n
					.insert(z)
					.values({
						id: crypto.randomUUID(),
						adminUserId: e.get("adminUserId"),
						action: "contacts.export",
						metadata: JSON.stringify({ count: r.length }),
						ipAddress: G(e.req),
					}),
				new Response(jr(r), {
					headers: {
						"Content-Type": "text/csv; charset=utf-8",
						"Content-Disposition": `attachment; filename="ig-contacts-${i}.csv"`,
						"Cache-Control": "no-store",
					},
				})
			);
		}),
		t.delete("/:igsid", H(), async (e) => {
			let n = e.req.param("igsid"),
				r = e.env.DB;
			return (await r.select().from(h).where($e(h.igsid, n)).limit(1)).length === 0
				? e.json({ error: "聯絡人不存在" }, 404)
				: (await r.delete(V).where($e(V.igsid, n)),
					await r
						.update(g)
						.set({ commenterId: null, commenterUsername: null, originalCommentText: null, normalizedCommentText: null })
						.where($e(g.commenterId, n)),
					await r.delete(h).where($e(h.igsid, n)),
					await r
						.insert(z)
						.values({ id: crypto.randomUUID(), adminUserId: e.get("adminUserId"), action: "contacts.delete", entityType: "contacts", ipAddress: G(e.req) }),
					e.json({ ok: !0 }));
		}),
		t
	);
}
import { and as ca, desc as pa, eq as fa, isNull as ga } from "npm:drizzle-orm@0.45.2";
import { Hono as ya } from "npm:hono@4.12.32";
import { and as He, eq as q, isNull as yn, ne as aa } from "npm:drizzle-orm@0.45.2";
import { and as Ke, asc as Hr, eq as ee, isNull as ct, or as Vr } from "npm:drizzle-orm@0.45.2";
function Gr(t, e) {
	return t == null || t === e.platform;
}
function zr(t, e) {
	return !!(e.publishedAt && e.publishedAt > t.createdAt);
}
async function pt(t, e) {
	if (e.mediaType === "STORY" || (await t.select().from(f).where(ee(f.instagramMediaId, e.id)).limit(1))[0]) return null;
	let r = await t
		.select()
		.from(f)
		.where(Ke(ee(f.applyScope, "next_post"), ct(f.instagramMediaId)))
		.orderBy(Hr(f.createdAt));
	for (let i of r) {
		if (!Gr(i.platform, e) || !zr(i, e)) continue;
		await t
			.update(f)
			.set({ instagramMediaId: e.id, applyScope: "media", updatedAt: new Date().toISOString() })
			.where(Ke(ee(f.id, i.id), ct(f.instagramMediaId)));
		let a = await t.select().from(f).where(ee(f.id, i.id)).limit(1);
		if (a[0]?.instagramMediaId === e.id) return a[0];
	}
	return null;
}
async function an(t, e) {
	let n = await t
		.select()
		.from(f)
		.where(Ke(ee(f.instagramMediaId, e.id), ee(f.status, "active")))
		.limit(1);
	if (n[0]) return n[0];
	let r = await pt(t, e);
	if (r && r.status === "active") return r;
	if (r) return null;
	let i = await t
		.select()
		.from(f)
		.where(Ke(ee(f.applyScope, "account_default"), ee(f.status, "active"), Vr(ct(f.platform), ee(f.platform, e.platform))));
	return i.find((a) => a.platform === e.platform) ?? i[0] ?? null;
}
import { and as Jr, eq as ft } from "npm:drizzle-orm@0.45.2";
var be = new Set(["token_invalid", "permission_denied", "policy_restricted", "user_not_allowed"]),
	Wr = new Set([429, 500, 502, 503, 504]);
function le(t) {
	return t.nonRetryableReason ? !1 : !!(t.networkError || t.timeout || (t.httpStatus !== void 0 && Wr.has(t.httpStatus)));
}
function on(t, e) {
	let n = e?.error ?? {},
		r = typeof n.code == "number" ? n.code : void 0,
		i = { metaErrorCode: r !== void 0 ? String(r) : void 0, metaErrorMessage: typeof n.message == "string" ? n.message.slice(0, 300) : void 0 };
	return r === 190
		? { httpStatus: t, nonRetryableReason: "token_invalid", ...i }
		: r === 10 || r === 200 || r === 803
			? { httpStatus: t, nonRetryableReason: "permission_denied", ...i }
			: r === 100
				? { httpStatus: t, nonRetryableReason: "bad_request", ...i }
				: r === 368
					? { httpStatus: t, nonRetryableReason: "policy_restricted", ...i }
					: { httpStatus: t, ...i };
}
var pe = class {
	cfg;
	doFetch;
	baseUrl;
	constructor(e) {
		((this.cfg = e), (this.doFetch = e.fetchImpl ?? ((n, r) => fetch(n, r))), (this.baseUrl = e.baseUrl ?? "https://graph.instagram.com"));
	}
	async get(e, n = {}) {
		let r = new URLSearchParams({ ...n, access_token: this.cfg.accessToken }),
			i = `${this.baseUrl}/${this.cfg.graphApiVersion}/${e}?${r.toString()}`,
			a;
		try {
			a = await this.doFetch(i, { method: "GET" });
		} catch {
			return { ok: !1, status: 0, failure: { networkError: !0 } };
		}
		let o = null;
		try {
			o = await a.json();
		} catch {
			o = null;
		}
		return a.ok ? { ok: !0, status: a.status, data: o } : { ok: !1, status: a.status, failure: on(a.status, o) };
	}
	async post(e, n) {
		let r = `${this.baseUrl}/${this.cfg.graphApiVersion}/${e}`,
			i = new URLSearchParams({ ...n, access_token: this.cfg.accessToken }),
			a;
		try {
			a = await this.doFetch(r, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: i.toString() });
		} catch {
			return { ok: !1, status: 0, failure: { networkError: !0 } };
		}
		let o = null;
		try {
			o = await a.json();
		} catch {
			o = null;
		}
		if (a.ok) return { ok: !0, status: a.status, data: o };
		let l = on(a.status, o);
		return { ok: !1, status: a.status, failure: l };
	}
};
var Yr = 1440 * 60 * 1e3,
	Xr = 20,
	Qr = 1200 * 60 * 1e3,
	Zr = "https://graph.instagram.com/refresh_access_token";
async function ea(t, e) {
	return (
		(await t.select({ accessToken: _.accessToken }).from(_).where(ft(_.platform, "instagram")).limit(1))[0]?.accessToken || e.INSTAGRAM_ACCOUNT_ACCESS_TOKEN
	);
}
async function qe(t, e) {
	return new pe({ accessToken: await ea(t, e), graphApiVersion: e.META_GRAPH_API_VERSION, baseUrl: e.META_BASE_URL || void 0 });
}
async function ln(t, e, n = {}) {
	let r = n.nowMs ?? Date.now(),
		i = n.fetchImpl ?? ((c, y) => fetch(c, y)),
		a = (
			await t
				.select()
				.from(_)
				.where(Jr(ft(_.platform, "instagram")))
				.limit(1)
		)[0];
	if (!a) return { refreshed: !1, reason: "no_account" };
	if (a.tokenRefreshedAt && r - Date.parse(a.tokenRefreshedAt) < Qr) return { refreshed: !1, reason: "refreshed_recently" };
	if (a.tokenExpiresAt && (Date.parse(a.tokenExpiresAt) - r) / Yr > Xr) return { refreshed: !1, reason: "not_due" };
	let o = a.accessToken || e.INSTAGRAM_ACCOUNT_ACCESS_TOKEN,
		l = `${Zr}?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: o })}`,
		m = {},
		u = 0;
	try {
		let c = await i(l, { method: "GET" });
		((u = c.status), (m = await c.json().catch(() => ({}))));
	} catch {
		return sn(t, a.id, "network_error");
	}
	if (u !== 200 || !m.access_token) return sn(t, a.id, `HTTP ${u} ${m.error?.code ?? ""} ${m.error?.message ?? ""}`.trim());
	let s = typeof m.expires_in == "number" ? m.expires_in : 1440 * 60 * 60,
		p = new Date(r).toISOString();
	return (
		await t
			.update(_)
			.set({ accessToken: m.access_token, tokenExpiresAt: new Date(r + s * 1e3).toISOString(), tokenRefreshedAt: p, updatedAt: p })
			.where(ft(_.id, a.id)),
		await t
			.insert(z)
			.values({
				id: crypto.randomUUID(),
				adminUserId: null,
				action: "system.token_refreshed",
				entityType: "instagram_accounts",
				entityId: a.id,
				metadata: JSON.stringify({ expiresInDays: Math.round(s / 86400) }),
			}),
		{ refreshed: !0, reason: "ok" }
	);
}
async function sn(t, e, n) {
	return (
		await t
			.insert(z)
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
import { and as ta, eq as gt } from "npm:drizzle-orm@0.45.2";
var na = "v24.0";
function yt(t) {
	let e = t.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
	return e ? new pe({ accessToken: e, graphApiVersion: t.FACEBOOK_GRAPH_API_VERSION || na, baseUrl: "https://graph.facebook.com" }) : null;
}
async function dn(t, e) {
	return { metaClient: await qe(t, e), facebookClient: yt(e) };
}
function je(t, e) {
	return e === "facebook" ? (t.facebookClient ?? null) : t.metaClient;
}
async function se(t, e) {
	return (await t.select().from(_).where(gt(_.platform, e)).limit(1))[0] ?? null;
}
async function mn(t, e, n) {
	return (
		(
			await t
				.select()
				.from(_)
				.where(ta(gt(_.instagramAccountId, e), gt(_.platform, n)))
				.limit(1)
		)[0] ?? (await se(t, n))
	);
}
import { eq as un } from "npm:drizzle-orm@0.45.2";
var ra = "feed,messages,messaging_postbacks,messaging_referrals";
function wt(t) {
	let e = t.failure?.metaErrorMessage ? `｜Meta 回覆：(代碼 ${t.failure.metaErrorCode ?? "?"}) ${t.failure.metaErrorMessage}` : "";
	return `HTTP ${t.status}${e}`;
}
async function cn(t, e) {
	let n = await e.get("me", { fields: "id,name,picture{url}" });
	if (!n.ok || !n.data?.id)
		return { account: await se(t, "facebook"), error: `Facebook 粉專註冊失敗（${wt(n)}）——請確認粉專存取權杖（FACEBOOK_PAGE_ACCESS_TOKEN）是否正確` };
	let r = new Date().toISOString(),
		i = await se(t, "facebook");
	return (
		i
			? await t
					.update(_)
					.set({
						instagramAccountId: n.data.id,
						username: n.data.name ?? i.username,
						profilePictureUrl: n.data.picture?.data?.url ?? i.profilePictureUrl,
						updatedAt: r,
					})
					.where(un(_.id, i.id))
			: await t
					.insert(_)
					.values({
						id: crypto.randomUUID(),
						instagramAccountId: n.data.id,
						platform: "facebook",
						username: n.data.name ?? null,
						accountType: "FACEBOOK_PAGE",
						profilePictureUrl: n.data.picture?.data?.url ?? null,
					})
					.onConflictDoNothing(),
		{ account: await se(t, "facebook"), error: null }
	);
}
async function pn(t, e, n) {
	if (n.webhookSubscribed === 1) return null;
	let r = await e.post(`${n.instagramAccountId}/subscribed_apps`, { subscribed_fields: ra });
	return r.ok
		? (await t.update(_).set({ webhookSubscribed: 1, updatedAt: new Date().toISOString() }).where(un(_.id, n.id)), null)
		: `Facebook 粉專事件通知訂閱失敗（${wt(r)}）`;
}
async function fn(t, e) {
	let n = await t.get(`${e}/posts`, { fields: "id,message,full_picture,permalink_url,created_time,status_type", limit: "50" });
	return n.ok
		? {
				ok: !0,
				items: (n.data?.data ?? [])
					.filter((i) => !!i.id)
					.map((i) => ({
						id: i.id,
						media_type: i.status_type === "added_video" ? "FB_VIDEO" : "FB_POST",
						caption: i.message,
						media_url: i.full_picture,
						permalink: i.permalink_url,
						timestamp: i.created_time,
					})),
			}
		: { ok: !1, items: [], error: `抓取 Facebook 貼文失敗（${wt(n)}）` };
}
async function gn(t, e, n, r = "instagram") {
	let i = 0,
		a = 0,
		o = new Date().toISOString();
	for (let l of n) {
		if (!l.id) continue;
		let m = await t.select().from(w).where(q(w.instagramMediaId, l.id)).limit(1);
		m.length > 0
			? (await t
					.update(w)
					.set({
						caption: l.caption ?? m[0].caption,
						thumbnailUrl: l.thumbnail_url ?? l.media_url ?? m[0].thumbnailUrl,
						permalink: l.permalink ?? m[0].permalink,
						lastSyncedAt: o,
						updatedAt: o,
						deletedAt: null,
					})
					.where(q(w.id, m[0].id)),
				(a += 1))
			: (await t
					.insert(w)
					.values({
						id: crypto.randomUUID(),
						instagramAccountId: e,
						instagramMediaId: l.id,
						platform: r,
						mediaType: l.media_type ?? "UNKNOWN",
						caption: l.caption ?? null,
						thumbnailUrl: l.thumbnail_url ?? l.media_url ?? null,
						permalink: l.permalink ?? null,
						publishedAt: l.timestamp ?? null,
						lastSyncedAt: o,
					}),
				(i += 1));
	}
	return { inserted: i, updated: a };
}
async function ia(t, e) {
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
async function oa(t, e) {
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
async function sa(t, e, n) {
	let r = 0,
		i = 0,
		a = new Date().toISOString();
	for (let u of n) {
		if (!u.id) continue;
		let s = await t.select().from(w).where(q(w.instagramMediaId, u.id)).limit(1);
		s.length > 0
			? (await t
					.update(w)
					.set({ thumbnailUrl: u.thumbnail_url ?? u.media_url ?? s[0].thumbnailUrl, lastSyncedAt: a, updatedAt: a, deletedAt: null })
					.where(q(w.id, s[0].id)),
				(i += 1))
			: (await t
					.insert(w)
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
	let o = new Set(n.map((u) => u.id).filter(Boolean)),
		l = await t
			.select()
			.from(w)
			.where(He(q(w.instagramAccountId, e), q(w.mediaType, "STORY"), yn(w.deletedAt))),
		m = 0;
	for (let u of l)
		o.has(u.instagramMediaId) ||
			(await t.update(w).set({ deletedAt: a, updatedAt: a }).where(q(w.id, u.id)),
			await t
				.update(f)
				.set({ status: "paused", updatedAt: a })
				.where(He(q(f.instagramMediaId, u.id), q(f.status, "active"))),
			(m += 1));
	return { inserted: r, updated: i, expired: m };
}
async function la(t, e, n, r) {
	let i = await t
			.select()
			.from(w)
			.where(He(q(w.instagramAccountId, n), yn(w.deletedAt), aa(w.mediaType, "STORY"))),
		a = 0;
	for (let o of i) {
		if (r.has(o.instagramMediaId)) continue;
		let l = await e.get(o.instagramMediaId, { fields: "id" });
		if (l.ok || l.failure?.nonRetryableReason !== "bad_request") continue;
		let m = new Date().toISOString();
		(await t.update(w).set({ deletedAt: m, updatedAt: m }).where(q(w.id, o.id)),
			await t
				.update(f)
				.set({ status: "paused", updatedAt: m })
				.where(He(q(f.instagramMediaId, o.id), q(f.status, "active"))),
			(a += 1));
	}
	return { deleted: a };
}
async function da(t, e) {
	if ((await t.select().from(_).where(q(_.platform, "instagram")).limit(1)).length > 0) return null;
	let r = await e.get("me", { fields: "id,username,account_type,profile_picture_url" });
	if (!r.ok || !r.data?.id) {
		let i = r.failure?.nonRetryableReason ?? (r.failure?.networkError ? "network_error" : "http_error"),
			a = r.failure?.metaErrorMessage ? `｜Meta 回覆：(代碼 ${r.failure?.metaErrorCode ?? "?"}) ${r.failure.metaErrorMessage}` : "";
		return `自動註冊 Instagram 帳號失敗（HTTP ${r.status}，${_t(i)}）${a}——請確認 Instagram 存取權杖（INSTAGRAM_ACCOUNT_ACCESS_TOKEN）是否有效`;
	}
	return (
		await t
			.insert(_)
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
async function Ve(t) {
	let e = t.DB;
	await ln(e, t);
	let n = await qe(e, t),
		r = { accounts: 0, inserted: 0, updated: 0, deleted: 0, expiredStories: 0, errors: [] },
		i = !!t.INSTAGRAM_ACCOUNT_ACCESS_TOKEN?.trim() || !!(await ma(e)),
		a = i ? await da(e, n) : null;
	a && r.errors.push(a);
	let o = i && !a ? await e.select().from(_).where(q(_.platform, "instagram")) : [];
	r.accounts = o.length;
	for (let s of o) {
		let p = await ia(n, s.instagramAccountId);
		if (!p.ok) {
			r.errors.push(
				`Instagram 帳號 ${s.username ?? s.instagramAccountId}：抓取貼文失敗（HTTP ${p.status}，${_t(p.reason)}）${p.detail ? `｜Meta 回覆：${p.detail}` : ""}`,
			);
			continue;
		}
		let c = await gn(e, s.id, p.items);
		((r.inserted += c.inserted), (r.updated += c.updated));
		let y = new Set(p.items.map((P) => P.id).filter(Boolean)),
			R = await la(e, n, s.id, y);
		r.deleted += R.deleted;
		let k = await oa(n, s.instagramAccountId);
		if (!k.ok)
			r.errors.push(
				`Instagram 帳號 ${s.username ?? s.instagramAccountId}：抓取限時動態失敗（HTTP ${k.status}，${_t(k.reason)}）${k.detail ? `｜Meta 回覆：${k.detail}` : ""}`,
			);
		else {
			let P = await sa(e, s.id, k.items);
			((r.inserted += P.inserted), (r.updated += P.updated), (r.expiredStories += P.expired));
		}
	}
	let l = yt(t);
	if (l) {
		let { account: s, error: p } = await cn(e, l);
		if ((p && r.errors.push(p), s)) {
			r.accounts += 1;
			let c = await pn(e, l, s);
			c && r.errors.push(c);
			let y = await fn(l, s.instagramAccountId);
			if (!y.ok) r.errors.push(y.error ?? "抓取 Facebook 貼文失敗");
			else {
				let R = await gn(e, s.id, y.items, "facebook");
				((r.inserted += R.inserted), (r.updated += R.updated));
			}
		}
	}
	let u = (await e.select().from(w)).filter((s) => s.publishedAt && !s.deletedAt).sort((s, p) => (s.publishedAt < p.publishedAt ? -1 : 1));
	for (let s of u) await pt(e, s);
	return r;
}
async function ma(t) {
	return (await t.select({ accessToken: _.accessToken }).from(_).where(q(_.platform, "instagram")).limit(1))[0]?.accessToken ?? null;
}
var ua = {
	token_invalid: "存取權杖失效",
	permission_denied: "權限不足",
	bad_request: "請求參數錯誤",
	policy_restricted: "受 Meta 政策限制",
	comment_not_found: "找不到留言",
	user_not_allowed: "對方不允許接收訊息",
	network_error: "網路連線錯誤",
	http_error: "連線錯誤",
};
function _t(t) {
	return (t && ua[t]) || t || "未知錯誤";
}
var wa = 20,
	_a = 100;
function wn() {
	let t = new ya();
	return (
		t.use("*", J(), L()),
		t.post("/sync", H(), async (e) => {
			try {
				let n = await Ve(e.env);
				return e.json({ ok: !0, ...n });
			} catch (n) {
				return e.json({ ok: !1, error: n?.message ?? "sync failed" }, 500);
			}
		}),
		t.get("/", async (e) => {
			let n = e.env.DB,
				r = e.req.query(),
				i = Math.min(Number.parseInt(r.limit ?? "", 10) || wa, _a),
				a = Math.max(Number.parseInt(r.page ?? "", 10) || 1, 1),
				o = await n
					.select()
					.from(w)
					.where(ca(r.mediaType ? fa(w.mediaType, r.mediaType) : void 0, r.includeDeleted === "1" ? void 0 : ga(w.deletedAt)))
					.orderBy(pa(w.publishedAt))
					.limit(i)
					.offset((a - 1) * i),
				l = await n.select().from(f),
				m = new Map(l.map((s) => [s.instagramMediaId, s])),
				u = o.map((s) => ({ ...s, automationStatus: m.get(s.id)?.status ?? "none", automationId: m.get(s.id)?.id ?? null }));
			return (r.automationStatus && (u = u.filter((s) => s.automationStatus === r.automationStatus)), e.json({ page: a, limit: i, media: u }));
		}),
		t
	);
}
import { and as ha, desc as ba, eq as de, gte as Sa, lte as Aa } from "npm:drizzle-orm@0.45.2";
import { Hono as Ia } from "npm:hono@4.12.32";
var Ra = 50,
	ka = 200;
function _n() {
	let t = new Ia();
	return (
		t.use("*", J(), L()),
		t.get("/", async (e) => {
			let n = e.env.DB,
				r = e.req.query(),
				i = [];
			(r.mediaId && i.push(de(g.instagramMediaId, r.mediaId)),
				r.automationId && i.push(de(g.automationId, r.automationId)),
				r.status && i.push(de(g.status, r.status)),
				r.publicReplyStatus && i.push(de(g.publicReplyStatus, r.publicReplyStatus)),
				r.privateReplyStatus && i.push(de(g.privateReplyStatus, r.privateReplyStatus)),
				r.dateFrom && i.push(Sa(g.createdAt, r.dateFrom)),
				r.dateTo && i.push(Aa(g.createdAt, r.dateTo)));
			let a = Math.min(Number.parseInt(r.limit ?? "", 10) || Ra, ka),
				o = Math.max(Number.parseInt(r.page ?? "", 10) || 1, 1),
				l = await n
					.select()
					.from(g)
					.where(i.length ? ha(...i) : void 0)
					.orderBy(ba(g.createdAt))
					.limit(a)
					.offset((o - 1) * a);
			return e.json({ page: o, limit: a, runs: l });
		}),
		t.get("/:id", async (e) => {
			let n = e.env.DB,
				r = e.req.param("id"),
				i = await n.select().from(g).where(de(g.id, r)).limit(1);
			if (i.length === 0) return e.json({ error: "紀錄不存在" }, 404);
			let a = await n.select().from(F).where(de(F.automationRunId, r)).orderBy(F.attemptNumber);
			return e.json({ run: i[0], attempts: a });
		}),
		t
	);
}
import { eq as bn } from "npm:drizzle-orm@0.45.2";
import { Hono as Ea } from "npm:hono@4.12.32";
var Se = "default";
async function Sn(t) {
	let e = await t.select().from(K).where(bn(K.id, Se)).limit(1);
	return e.length === 0 ? (await t.insert(K).values({ id: Se, emergencyStop: 0 }), { id: Se, emergencyStop: 0 }) : e[0];
}
async function hn(t, e, n, r) {
	let i = t.DB;
	(await Sn(i),
		await i
			.update(K)
			.set({ emergencyStop: r ? 1 : 0, updatedAt: new Date().toISOString() })
			.where(bn(K.id, Se)),
		await i
			.insert(z)
			.values({
				id: crypto.randomUUID(),
				adminUserId: e,
				action: r ? "system.emergency_stop" : "system.resume",
				entityType: "system_settings",
				entityId: Se,
				ipAddress: n,
			}));
}
function An() {
	let t = new Ea();
	return (
		t.use("*", J()),
		t.get("/status", L(), async (e) => {
			let n = e.env.DB,
				r = await Sn(n),
				i = await n.select().from(_),
				a = i.filter((b) => b.platform === "instagram"),
				o = i.find((b) => b.platform === "facebook"),
				l = 480 * 60 * 1e3,
				m = new Date(Date.now() + l).toISOString().slice(0, 10),
				u = new Date(Date.parse(`${m}T00:00:00Z`) - l).toISOString(),
				s = await n.select().from(g),
				p = s.filter((b) => b.createdAt >= u),
				c = 1440 * 60 * 1e3,
				y = Date.now() + l,
				R = (b) => new Date(b).toISOString().slice(0, 10),
				k = (b) => new Date(b).toISOString().slice(0, 7),
				P = (b) => {
					let S = new Date(b);
					return Date.parse(`${R(b)}T00:00:00Z`) - ((S.getUTCDay() + 6) % 7) * c;
				},
				I = (b, S) => {
					let Q = new Map(b.map((U) => [U, { label: U, matched: 0, dmSuccess: 0, failures: 0 }]));
					for (let U of s) {
						let Te = Q.get(S(Date.parse(U.createdAt) + l));
						Te && ((Te.matched += 1), U.privateReplyStatus === "success" && (Te.dmSuccess += 1), U.status === "completed_with_errors" && (Te.failures += 1));
					}
					return b.map((U) => Q.get(U));
				},
				D = Date.parse(`${m}T00:00:00Z`),
				j = Array.from({ length: 30 }, (b, S) => R(D - (29 - S) * c)),
				ne = P(y),
				re = Array.from({ length: 12 }, (b, S) => R(ne - (11 - S) * 7 * c)),
				ve = Array.from({ length: 12 }, (b, S) => {
					let Q = new Date(y);
					return `${new Date(Date.UTC(Q.getUTCFullYear(), Q.getUTCMonth() - (11 - S), 1)).toISOString().slice(0, 7)}`;
				}),
				M = { daily: I(j, (b) => R(b)), weekly: I(re, (b) => R(P(b))), monthly: I(ve, (b) => k(b)) },
				ce = (b) => ({
					matched: b.length,
					publicReplySuccess: b.filter((S) => S.publicReplyStatus === "success").length,
					dmSuccess: b.filter((S) => S.privateReplyStatus === "success").length,
					failures: b.filter((S) => S.status === "completed_with_errors").length,
				});
			return e.json({
				emergencyStop: r.emergencyStop === 1,
				circuitBreakerStatus: i.some((b) => b.circuitBreakerStatus !== "closed") ? "open" : (i[0]?.circuitBreakerStatus ?? "unknown"),
				account: a[0] ? { username: a[0].username, profilePictureUrl: a[0].profilePictureUrl } : null,
				tokenExpiresAt: a[0]?.tokenExpiresAt ?? null,
				facebookPage: o ? { name: o.username, profilePictureUrl: o.profilePictureUrl, webhookSubscribed: o.webhookSubscribed === 1 } : null,
				lastWebhookReceivedAt: a[0]?.lastWebhookReceivedAt ?? null,
				today: ce(p),
				total: ce(s),
				series: M,
			});
		}),
		t.post("/emergency-stop", H(), L(), async (e) => (await hn(e.env, e.get("adminUserId"), G(e.req), !0), e.json({ ok: !0, emergencyStop: !0 }))),
		t.post("/resume", H(), L(), async (e) => (await hn(e.env, e.get("adminUserId"), G(e.req), !1), e.json({ ok: !0, emergencyStop: !1 }))),
		t.post("/circuit-breaker/reset", H(), L(), async (e) => {
			let n = e.env.DB;
			return (
				await n.update(_).set({ circuitBreakerStatus: "closed", updatedAt: new Date().toISOString() }),
				await n
					.insert(z)
					.values({
						id: crypto.randomUUID(),
						adminUserId: e.get("adminUserId"),
						action: "system.circuit_breaker_reset",
						entityType: "instagram_accounts",
						ipAddress: G(e.req),
					}),
				e.json({ ok: !0, circuitBreakerStatus: "closed" })
			);
		}),
		t.get("/meta-setup", L(), (e) => {
			let n = (e.env.PUBLIC_API_BASE ?? "").replace(/\/$/, ""),
				r = (i) => !!(i && i.trim());
			return e.json({
				callbackUrl: n ? `${n}/api/webhooks/meta/instagram` : null,
				verifyToken: e.env.WEBHOOK_VERIFY_TOKEN ?? null,
				privacyUrl: (e.env.ADMIN_ORIGINS ?? "").split(",")[0]?.trim()
					? `${(e.env.ADMIN_ORIGINS ?? "").split(",")[0].trim().replace(/\/$/, "")}/CHAT/privacy.html`
					: null,
				configured: {
					instagramAppSecret: r(e.env.INSTAGRAM_APP_SECRET),
					instagramToken: r(e.env.INSTAGRAM_ACCOUNT_ACCESS_TOKEN),
					metaAppSecret: r(e.env.META_APP_SECRET),
					facebookPageToken: r(e.env.FACEBOOK_PAGE_ACCESS_TOKEN),
				},
			});
		}),
		t
	);
}
function In() {
	let t = new xa();
	return (
		t.route("/auth", Gt()),
		t.route("/automations", Qt()),
		t.route("/system", An()),
		t.route("/media", wn()),
		t.route("/automation-runs", _n()),
		t.route("/contacts", rn()),
		t
	);
}
import { Hono as si } from "npm:hono@4.12.32";
import { inArray as Tn, lt as ze, ne as Ma, and as Pa } from "npm:drizzle-orm@0.45.2";
import { and as va, eq as Ta, gte as Ca, sql as vn } from "npm:drizzle-orm@0.45.2";
var Rn = 480 * 60 * 1e3,
	kn = 60 * 1e3,
	En = 1440 * 60 * 1e3;
function Da(t) {
	return new Date(Math.floor(t / kn) * kn).toISOString();
}
function Ge(t) {
	let e = Math.floor((t + Rn) / En) * En;
	return new Date(e - Rn).toISOString();
}
async function xn(t, e, n) {
	let r = new Date().toISOString(),
		a = (
			await t
				.insert(X)
				.values({ id: crypto.randomUUID(), scopeKey: e, windowStart: n, count: 1 })
				.onConflictDoUpdate({ target: [X.scopeKey, X.windowStart], set: { count: vn`${X.count} + 1`, updatedAt: r } })
				.returning({ count: X.count })
		)[0]?.count;
	if (typeof a != "number") throw new Error("send counter reservation failed");
	return a;
}
async function me(t, e) {
	let n = e.nowMs ?? Date.now(),
		r = (await t.select().from(K).limit(1))[0];
	if (r && r.emergencyStop === 1) return { allowed: !1, reason: "emergency_stop" };
	if (e.automationDailyLimit != null) {
		let o = Ge(n);
		if (
			((
				await t
					.select({ n: vn`count(*)` })
					.from(g)
					.where(va(Ta(g.automationId, e.automationId), Ca(g.createdAt, o)))
			)[0]?.n ?? 0) > e.automationDailyLimit
		)
			return { allowed: !1, reason: "automation_daily_limit" };
	}
	let i = e.actionType === "public_reply" ? (r?.maxPublicRepliesPerMinute ?? null) : (r?.maxPrivateRepliesPerMinute ?? null),
		a = e.actionType === "public_reply" ? (r?.maxPublicRepliesPerDay ?? null) : (r?.maxPrivateRepliesPerDay ?? null);
	return i != null && (await xn(t, `${e.actionType}:minute`, Da(n))) > i
		? { allowed: !1, reason: "system_minute_limit" }
		: a != null && (await xn(t, `${e.actionType}:day`, Ge(n))) > a
			? { allowed: !1, reason: "system_daily_limit" }
			: { allowed: !0, reason: null };
}
var Na = 30,
	Oa = 180;
var Cn = 1440 * 60 * 1e3,
	Ua = 500,
	Dn = 20;
async function Mn(t, e = Date.now(), n = {}) {
	let r = n.batchSize ?? Ua,
		i = new Date(e - Na * Cn).toISOString(),
		a = new Date(e - Oa * Cn).toISOString(),
		o = 0;
	for (let R = 0; R < Dn; R++) {
		let k = await t
			.select({ id: T.id })
			.from(T)
			.where(Pa(ze(T.receivedAt, i), Ma(T.rawPayload, "{}")))
			.limit(r);
		if (k.length === 0) break;
		let P = k.map((I) => I.id);
		if ((await t.update(T).set({ rawPayload: "{}" }).where(Tn(T.id, P)), (o += P.length), k.length < r)) break;
	}
	let l = 0;
	for (let R = 0; R < Dn; R++) {
		let k = await t.select({ id: F.id }).from(F).where(ze(F.startedAt, a)).limit(r);
		if (k.length === 0) break;
		let P = k.map((I) => I.id);
		if ((await t.delete(F).where(Tn(F.id, P)), (l += P.length), k.length < r)) break;
	}
	let m = lt(e),
		s = (await t.delete(W).where(ze(W.windowStart, m)).returning({ id: W.id })).length,
		p = Ge(e),
		y = (await t.delete(X).where(ze(X.windowStart, p)).returning({ id: X.id })).length;
	return (
		console.log(`[cleanup] payloads=${o} attempts=${l} loginBuckets=${s} sendCounters=${y}`),
		{ webhookPayloadsCleared: o, apiAttemptsDeleted: l, loginRateLimitRowsDeleted: s, sendCounterRowsDeleted: y }
	);
}
import { and as rt, asc as ei, eq as ue, lt as Jn, lte as ti, sql as ni } from "npm:drizzle-orm@0.45.2";
import { and as xt, eq as C } from "npm:drizzle-orm@0.45.2";
function Pn(t, e, n, r = "instagram") {
	let i = r === "facebook" ? "comments" : "replies";
	return t.post(`${e}/${i}`, { message: n });
}
function Ae(t, e) {
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
	let i = { recipient: n, message: r };
	return (e.platform === "facebook" && e.recipientId && (i.messaging_type = "RESPONSE"), t.post(`${e.instagramAccountId}/messages`, i));
}
var ht = [30, 120, 600],
	Ba = ht.length;
function fe(t) {
	return t < 0 ? ht[0] : t >= Ba ? null : ht[t];
}
function Ie(t, e, n) {
	if (n === "all_comments") return { matched: !0, matchedKeyword: null };
	for (let r of e)
		if (r) {
			if (n === "contains_any" && t.includes(r)) return { matched: !0, matchedKeyword: r };
			if (n === "exact_any" && t === r) return { matched: !0, matchedKeyword: r };
		}
	return { matched: !1, matchedKeyword: null };
}
import { and as Fa, eq as bt } from "npm:drizzle-orm@0.45.2";
async function Re(t, e) {
	let n = await t
		.select()
		.from(g)
		.where(Fa(bt(g.automationId, e.automationId), bt(g.instagramCommentId, e.instagramCommentId)))
		.limit(1);
	if (n.length > 0) return { run: n[0], created: !1 };
	let r = crypto.randomUUID(),
		i = new Date().toISOString();
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
				startedAt: i,
			}),
		{ run: (await t.select().from(g).where(bt(g.id, r)).limit(1))[0], created: !0 }
	);
}
function Nn(t, e = Math.random) {
	let n = t.filter((a) => a.enabled);
	if (n.length === 0) return null;
	let r = Math.floor(e() * n.length),
		i = Math.min(r, n.length - 1);
	return n[i];
}
import { desc as La, eq as Un } from "npm:drizzle-orm@0.45.2";
function On(t) {
	let e = [...t.recentAttempts].sort((a, o) => a.at - o.at);
	if (t.dailyLimit != null && t.dailySentCount > t.dailyLimit) return { open: !0, reason: "daily_limit_exceeded" };
	if (e.some((a) => a.reason === "policy_restricted")) return { open: !0, reason: "policy_restricted" };
	let n = e.slice(-5);
	if (n.length === 5) {
		if (n.every((a) => a.reason === "token_invalid")) return { open: !0, reason: "consecutive_token_invalid" };
		if (n.every((a) => a.reason === "permission_denied")) return { open: !0, reason: "consecutive_permission_denied" };
	}
	let r = t.now - 3e5,
		i = e.filter((a) => a.at >= r);
	return i.length >= 10 && i.filter((o) => !o.ok).length / i.length > 0.2 ? { open: !0, reason: "error_rate_exceeded" } : { open: !1, reason: null };
}
var $a = 60;
function Ka(t) {
	if (t.ok) return null;
	let e = t.failure?.nonRetryableReason;
	return e === "token_invalid" || e === "permission_denied" || e === "policy_restricted" ? e : "other";
}
async function ge(t, e, n, r, i, a) {
	await t
		.insert(F)
		.values({
			id: crypto.randomUUID(),
			automationRunId: e,
			actionType: r,
			attemptNumber: i,
			httpStatus: a.status || a.failure?.httpStatus || null,
			failureReason: Ka(a),
			metaErrorCode: a.failure?.metaErrorCode ?? null,
			metaErrorMessage: a.failure?.metaErrorMessage ?? null,
			completedAt: new Date().toISOString(),
		});
	let l = (await t.select({ completedAt: F.completedAt, failureReason: F.failureReason }).from(F).orderBy(La(F.completedAt)).limit($a))
			.filter((u) => u.completedAt != null)
			.map((u) => ({ ok: u.failureReason == null, reason: u.failureReason ?? void 0, at: Date.parse(u.completedAt) })),
		m = On({ recentAttempts: l, now: Date.now(), dailySentCount: 0, dailyLimit: null });
	if (m.open) {
		let u = (await t.select().from(_).where(Un(_.id, n)).limit(1))[0];
		u &&
			u.circuitBreakerStatus === "closed" &&
			(await t.update(_).set({ circuitBreakerStatus: "open", updatedAt: new Date().toISOString() }).where(Un(_.id, n)),
			await t
				.insert(z)
				.values({
					id: crypto.randomUUID(),
					adminUserId: null,
					action: "system.circuit_breaker_open",
					entityType: "instagram_accounts",
					entityId: n,
					metadata: JSON.stringify({ reason: m.reason }),
				}));
	}
}
import { and as Ze, desc as Ha, eq as E } from "npm:drizzle-orm@0.45.2";
function Bn(t, e) {
	return t.get(e, { fields: "username,name,is_user_follow_business" });
}
var qa = new TextEncoder();
async function ja(t) {
	let e = await crypto.subtle.digest("SHA-256", qa.encode(t));
	return Array.from(new Uint8Array(e), (n) => n.toString(16).padStart(2, "0")).join("");
}
function St(t) {
	return t?.object === "page" ? "facebook" : "instagram";
}
function At(t) {
	let e = [],
		n = St(t),
		r = Array.isArray(t?.entry) ? t.entry : [];
	for (let i of r) {
		let a = i?.id != null ? String(i.id) : "",
			o = i?.time != null ? String(i.time) : "",
			l = Array.isArray(i?.changes) ? i.changes : [];
		for (let m of l) {
			if (n === "facebook") {
				let s = m?.value ?? {};
				if (m?.field !== "feed" || s.item !== "comment" || s.verb !== "add") continue;
				e.push({
					instagramAccountId: a,
					instagramMediaId: s.post_id != null ? String(s.post_id) : "",
					instagramCommentId: s.comment_id != null ? String(s.comment_id) : "",
					commenterId: s?.from?.id != null ? String(s.from.id) : null,
					commenterUsername: typeof s?.from?.name == "string" ? s.from.name : null,
					text: typeof s.message == "string" ? s.message : "",
					eventType: "comments",
					eventTimestamp: s.created_time != null ? String(s.created_time) : o,
					platform: n,
				});
				continue;
			}
			if (m?.field !== "comments") continue;
			let u = m.value ?? {};
			e.push({
				instagramAccountId: a,
				instagramMediaId: u?.media?.id != null ? String(u.media.id) : "",
				instagramCommentId: u?.id != null ? String(u.id) : "",
				commenterId: u?.from?.id != null ? String(u.from.id) : null,
				commenterUsername: typeof u?.from?.username == "string" ? u.from.username : null,
				text: typeof u?.text == "string" ? u.text : "",
				eventType: "comments",
				eventTimestamp: o,
				platform: n,
			});
		}
	}
	return e;
}
function Ln(t, e) {
	return At(t).find((n) => n.instagramCommentId === e) ?? null;
}
function It(t) {
	let e = [];
	if (St(t) === "facebook") return e;
	let n = Array.isArray(t?.entry) ? t.entry : [];
	for (let r of n) {
		let i = r?.id != null ? String(r.id) : "",
			a = r?.time != null ? String(r.time) : "",
			o = Array.isArray(r?.messaging) ? r.messaging : [];
		for (let l of o) {
			let m = l?.message,
				u = m?.reply_to?.story?.id;
			u &&
				(m?.is_echo ||
					e.push({
						instagramAccountId: i,
						storyId: String(u),
						messageId: m?.mid != null ? String(m.mid) : "",
						senderId: l?.sender?.id != null ? String(l.sender.id) : "",
						text: typeof m?.text == "string" ? m.text : "",
						eventType: "story_reply",
						eventTimestamp: l?.timestamp != null ? String(l.timestamp) : a,
					}));
		}
	}
	return e;
}
function $n(t, e) {
	return It(t).find((n) => n.messageId === e) ?? null;
}
function Fn(t) {
	if (!t) return "";
	let e = t.ref ?? t.ads_context_data?.ad_id ?? t.ad_id ?? "";
	return e != null ? String(e) : "";
}
function Rt(t) {
	let e = [],
		n = St(t),
		r = Array.isArray(t?.entry) ? t.entry : [];
	for (let i of r) {
		let a = i?.id != null ? String(i.id) : "",
			o = i?.time != null ? String(i.time) : "",
			l = Array.isArray(i?.messaging) ? i.messaging : [];
		for (let m of l) {
			let u = m?.sender?.id != null ? String(m.sender.id) : "";
			if (!u || u === a) continue;
			let s = m?.timestamp != null ? String(m.timestamp) : o,
				p = { instagramAccountId: a, senderId: u, eventTimestamp: s, text: "", payload: "", ref: "", platform: n };
			if (m?.postback) {
				e.push({
					...p,
					kind: "postback",
					messageId: m.postback.mid != null ? String(m.postback.mid) : "",
					payload: typeof m.postback.payload == "string" ? m.postback.payload : "",
				});
				continue;
			}
			let c = m?.message;
			if (c?.is_echo || c?.reply_to?.story?.id) continue;
			let y = Fn(m?.referral) || Fn(c?.referral);
			if (y) {
				e.push({ ...p, kind: "referral", messageId: c?.mid != null ? String(c.mid) : "", text: typeof c?.text == "string" ? c.text : "", ref: y });
				continue;
			}
			c && typeof c.text == "string" && c.text.trim() && e.push({ ...p, kind: "text", messageId: c.mid != null ? String(c.mid) : "", text: c.text });
		}
	}
	return e;
}
function kt(t) {
	return t.messageId || `ref:${t.senderId}:${t.eventTimestamp}:${t.ref}`;
}
function Kn(t, e) {
	return Rt(t).find((n) => kt(n) === e) ?? null;
}
async function We(t) {
	if (t.stableEventId) return t.stableEventId;
	let e = [
		t.instagramAccountId ?? "",
		t.instagramMediaId ?? "",
		t.instagramCommentId ?? "",
		t.eventType ?? "",
		t.eventTimestamp != null ? String(t.eventTimestamp) : "",
	];
	return ja(e.join("\0"));
}
var Ye = "CLAIM:",
	Va = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
	ye = {
		claimButtonText: "給我連結",
		notFollowingText: "先追蹤我，再按下面的按鈕就能拿到囉！",
		recheckButtonText: "我追蹤了",
		emailPromptText: "請直接回覆你的 Email，我把資料寄給你",
		notEmailHint: "這看起來不像 Email 喔，",
	},
	Xe = (t, e, n) => ({ accountRowId: t.id, instagramAccountId: t.instagramAccountId, platform: t.platform, runId: e, automation: n });
function we(t) {
	return t.followGateEnabled === 1 || t.emailCaptureEnabled === 1;
}
var te = () => new Date().toISOString();
function Ga(t) {
	try {
		let e = JSON.parse(t ?? "[]");
		return Array.isArray(e) ? e.filter((n) => typeof n == "string") : [];
	} catch {
		return [];
	}
}
async function et(t, e, n = {}) {
	let r = te(),
		i = (await t.select().from(h).where(E(h.igsid, e)).limit(1))[0];
	return (
		i
			? await t
					.update(h)
					.set({ username: n.username ?? i.username, name: n.name ?? i.name, lastSeenAt: r, updatedAt: r })
					.where(E(h.igsid, e))
			: await t
					.insert(h)
					.values({ igsid: e, platform: n.platform ?? "instagram", username: n.username ?? null, name: n.name ?? null })
					.onConflictDoNothing(),
		(await t.select().from(h).where(E(h.igsid, e)).limit(1))[0]
	);
}
async function za(t, e, n) {
	let r = n?.trim();
	if (!r) return;
	let i = (await t.select().from(h).where(E(h.igsid, e)).limit(1))[0];
	if (!i) return;
	let a = Ga(i.tags);
	a.includes(r) ||
		(a.push(r),
		await t
			.update(h)
			.set({ tags: JSON.stringify(a), updatedAt: te() })
			.where(E(h.igsid, e)));
}
async function tt(t, e, n) {
	return (
		(
			await t
				.select({ id: V.id })
				.from(V)
				.where(Ze(E(V.igsid, e), E(V.automationId, n)))
				.limit(1)
		).length > 0
	);
}
async function Ee(t, e, n) {
	(await t.insert(V).values({ id: crypto.randomUUID(), igsid: e, automationId: n.id }).onConflictDoNothing(), await za(t, e, n.tag));
}
async function xe(t, e, n) {
	await t
		.update(V)
		.set({ deliveredAt: te() })
		.where(Ze(E(V.igsid, e), E(V.automationId, n)));
}
function nt(t) {
	return we(t)
		? { text: t.openingDm ?? "", buttonText: t.claimButtonText || ye.claimButtonText, postbackPayload: Ye + t.id }
		: { text: t.openingDm ?? "", buttonText: t.buttonText, buttonUrl: t.buttonUrl };
}
function Wa(t) {
	return { text: t.deliveryText || t.openingDm || "", buttonText: t.buttonText, buttonUrl: t.buttonUrl };
}
async function ke(t, e, n, r) {
	let i = await me(t.db, { actionType: "private_reply", automationId: e.automation.id, automationDailyLimit: null });
	if (!i.allowed) return { ok: !1, retry: !1, reason: i.reason ?? "send_gate" };
	let a = je(t, e.platform);
	if (!a) return { ok: !1, retry: !1, reason: "facebook_not_configured" };
	let o = await Ae(a, { instagramAccountId: e.instagramAccountId, recipientId: n, ...r, platform: e.platform === "facebook" ? "facebook" : "instagram" });
	return (
		e.runId && (await ge(t.db, e.runId, e.accountRowId, "private_reply", 1, o)),
		o.ok
			? { ok: !0 }
			: {
					ok: !1,
					retry: !!(o.failure && (le(o.failure) || (o.failure.httpStatus === 400 && !be.has(o.failure.nonRetryableReason ?? "")))),
					reason: o.failure?.metaErrorMessage ?? `http_${o.status}`,
				}
	);
}
function Qe(t, e, n = 0) {
	return t.ok ? { kind: "completed", step: e } : t.retry ? { kind: "retry", delaySeconds: fe(n), reason: t.reason } : { kind: "skipped", reason: t.reason };
}
async function Et(t, e, n) {
	return (
		(
			await t
				.select({ id: g.id })
				.from(g)
				.where(Ze(E(g.automationId, e), E(g.commenterId, n)))
				.orderBy(Ha(g.createdAt))
				.limit(1)
		)[0]?.id ?? null
	);
}
async function Ja(t, e, n, r) {
	let { db: i, metaClient: a } = t,
		o = Xe(e, await Et(i, r.id, n), r);
	await Ee(i, n, r);
	let l = (await i.select().from(h).where(E(h.igsid, n)).limit(1))[0];
	if (e.platform === "instagram" && (r.followGateEnabled === 1 || !l?.username)) {
		let m = await Bn(a, n);
		if (m.ok && m.data) {
			let u = m.data.is_user_follow_business;
			if (
				(await i
					.update(h)
					.set({
						username: m.data.username ?? l?.username ?? null,
						name: m.data.name ?? l?.name ?? null,
						isFollower: typeof u == "boolean" ? (u ? 1 : 0) : (l?.isFollower ?? null),
						updatedAt: te(),
					})
					.where(E(h.igsid, n)),
				r.followGateEnabled === 1 && u === !1)
			) {
				let s = await ke(t, o, n, {
					text: r.notFollowingText || ye.notFollowingText,
					buttonText: r.recheckButtonText || ye.recheckButtonText,
					postbackPayload: Ye + r.id,
				});
				return Qe(s, "not_following");
			}
		}
	}
	if (r.emailCaptureEnabled === 1 && !(await i.select().from(h).where(E(h.igsid, n)).limit(1))[0]?.email) {
		let u = await ke(t, o, n, { text: r.emailPromptText || ye.emailPromptText });
		return (
			u.ok &&
				(await i
					.update(h)
					.set({ state: `awaiting_email:${r.id}`, updatedAt: te() })
					.where(E(h.igsid, n))),
			Qe(u, "awaiting_email")
		);
	}
	return Hn(t, o, n, r);
}
async function Hn(t, e, n, r) {
	let i = await ke(t, e, n, Wa(r));
	return (i.ok && (await xe(t.db, n, r.id)), Qe(i, "delivered"));
}
async function Ya(t, e) {
	return t
		.select()
		.from(f)
		.where(Ze(E(f.applyScope, e), E(f.status, "active")));
}
async function qn(t, e, n, r) {
	let i = oe(n),
		a = (await Ya(t, e)).filter((o) => o.platform == null || o.platform === r).sort((o, l) => +(l.platform === r) - +(o.platform === r));
	for (let o of a) {
		let l = await t.select().from(N).where(E(N.automationId, o.id)),
			m = e === "ref" ? "exact_any" : o.matchType;
		if (e === "dm_keyword" && m === "all_comments") continue;
		let u = Ie(
			i,
			l.map((s) => s.normalizedKeyword),
			m,
		);
		if (u.matched) return { automation: o, matchedKeyword: u.matchedKeyword };
	}
	return null;
}
async function jn(t, e, n, r, i, a) {
	let { db: o } = t,
		{ automation: l } = a,
		{ run: m, created: u } = await Re(o, {
			automationId: l.id,
			webhookEventId: i,
			instagramCommentId: r,
			instagramMediaId: "",
			commenterId: n.senderId,
			commenterUsername: null,
			originalCommentText: n.kind === "referral" ? `ref=${n.ref}` : n.text,
			normalizedCommentText: null,
			matchedKeyword: a.matchedKeyword,
			status: "matched",
		});
	if (!u && m.privateReplyStatus === "success") return { kind: "skipped", reason: "already_sent" };
	if (u && l.oncePerContact === 1 && (await tt(o, n.senderId, l.id))) return (await Je(o, m.id, "skipped"), { kind: "skipped", reason: "once_per_contact" });
	await Ee(o, n.senderId, l);
	let s = await me(o, { actionType: "private_reply", automationId: l.id, automationDailyLimit: l.dailyLimit });
	if (!s.allowed) return (await Je(o, m.id, "skipped"), { kind: "skipped", reason: s.reason ?? "send_gate" });
	let p = Xe(e, m.id, l),
		c = await ke(t, p, n.senderId, nt(l));
	return c.ok
		? (we(l) || (await xe(o, n.senderId, l.id)), await Je(o, m.id, "success"), { kind: "completed", step: we(l) ? "claim_button_sent" : "delivered" })
		: c.retry
			? (await o
					.update(g)
					.set({ retryCount: m.retryCount + 1, updatedAt: te() })
					.where(E(g.id, m.id)),
				{ kind: "retry", delaySeconds: fe(m.retryCount), reason: c.reason })
			: (await Je(o, m.id, "failed"), { kind: "skipped", reason: c.reason });
}
async function Je(t, e, n) {
	await t
		.update(g)
		.set({
			status: n === "failed" ? "completed_with_errors" : "completed",
			publicReplyStatus: "skipped",
			privateReplyStatus: n,
			completedAt: te(),
			updatedAt: te(),
		})
		.where(E(g.id, e));
}
async function Vn(t, e) {
	let { db: n } = t,
		r = (await n.select().from(T).where(E(T.id, e.webhookEventId)).limit(1))[0];
	if (!r) return { kind: "skipped", reason: "webhook_event_not_found" };
	let i;
	try {
		i = JSON.parse(r.rawPayload);
	} catch {
		return { kind: "skipped", reason: "payload_parse_error" };
	}
	let a = Kn(i, e.instagramCommentId);
	if (!a) return { kind: "skipped", reason: "message_not_in_payload" };
	if ((await n.select().from(K).limit(1))[0]?.emergencyStop === 1) return { kind: "skipped", reason: "emergency_stop" };
	let l = await mn(n, a.instagramAccountId, a.platform);
	if (!l) return { kind: "skipped", reason: "account_not_found" };
	if (l.automationEnabled === 0) return { kind: "skipped", reason: "account_disabled" };
	if (l.circuitBreakerStatus !== "closed") return { kind: "skipped", reason: "circuit_open" };
	if (a.senderId === l.instagramAccountId) return { kind: "skipped", reason: "own_message" };
	let m = await et(n, a.senderId, { platform: a.platform });
	if (a.kind === "postback") {
		if (!a.payload.startsWith(Ye)) return { kind: "no_match" };
		let p = a.payload.slice(Ye.length),
			c = (await n.select().from(f).where(E(f.id, p)).limit(1))[0];
		return !c || c.status !== "active" ? { kind: "skipped", reason: "automation_inactive" } : Ja(t, l, a.senderId, c);
	}
	if (a.kind === "referral") {
		let p = await qn(n, "ref", a.ref, a.platform);
		if (p) return jn(t, l, a, e.instagramCommentId, r.id, p);
		if (!a.text) return { kind: "no_match" };
	}
	let u = m.state?.startsWith("awaiting_email:") ? m.state.split(":")[1] : null;
	if (u) {
		let p = a.text.match(Va);
		if (p) {
			await n.update(h).set({ email: p[0].toLowerCase(), state: null, updatedAt: te() }).where(E(h.igsid, a.senderId));
			let c = (await n.select().from(f).where(E(f.id, u)).limit(1))[0];
			if (!c || c.status !== "active") return { kind: "completed", step: "email_saved" };
			let y = Xe(l, await Et(n, c.id, a.senderId), c);
			return Hn(t, y, a.senderId, c);
		}
	}
	let s = await qn(n, "dm_keyword", a.text, a.platform);
	if (s) return jn(t, l, a, e.instagramCommentId, r.id, s);
	if (u) {
		let p = (await n.select().from(f).where(E(f.id, u)).limit(1))[0];
		if (p && p.status === "active") {
			let c = Xe(l, await Et(n, p.id, a.senderId), p),
				y = await ke(t, c, a.senderId, { text: ye.notEmailHint + (p.emailPromptText || ye.emailPromptText) });
			return Qe(y, "email_hint");
		}
	}
	return { kind: "no_match" };
}
async function Xa(t, e, n, r = "instagram") {
	let i = await se(t, r);
	if (!i) return null;
	if (r === "facebook") {
		let l = await e.get(n, { fields: "id,message,full_picture,permalink_url,created_time,status_type" });
		return !l.ok || !l.data?.id
			? null
			: (await t
					.insert(w)
					.values({
						id: crypto.randomUUID(),
						instagramAccountId: i.id,
						instagramMediaId: l.data.id,
						platform: "facebook",
						mediaType: Za(l.data.status_type),
						caption: l.data.message ?? null,
						thumbnailUrl: l.data.full_picture ?? null,
						permalink: l.data.permalink_url ?? null,
						publishedAt: l.data.created_time ?? null,
						lastSyncedAt: new Date().toISOString(),
					})
					.onConflictDoNothing(),
				(await t.select().from(w).where(C(w.instagramMediaId, l.data.id)).limit(1))[0] ?? null);
	}
	let a = await e.get(n, { fields: "id,media_type,caption,thumbnail_url,media_url,permalink,timestamp" });
	return !a.ok || !a.data?.id
		? null
		: (await t
				.insert(w)
				.values({
					id: crypto.randomUUID(),
					instagramAccountId: i.id,
					instagramMediaId: a.data.id,
					mediaType: a.data.media_type ?? "UNKNOWN",
					caption: a.data.caption ?? null,
					thumbnailUrl: a.data.thumbnail_url ?? a.data.media_url ?? null,
					permalink: a.data.permalink ?? null,
					publishedAt: a.data.timestamp ?? null,
					lastSyncedAt: new Date().toISOString(),
				})
				.onConflictDoNothing(),
			(await t.select().from(w).where(C(w.instagramMediaId, a.data.id)).limit(1))[0] ?? null);
}
async function Qa(t, e, n) {
	let r = await se(t, "instagram");
	if (!r) return null;
	let i = await e.get(n, { fields: "id,media_type,media_url,thumbnail_url,timestamp" });
	return !i.ok || !i.data?.id
		? null
		: (await t
				.insert(w)
				.values({
					id: crypto.randomUUID(),
					instagramAccountId: r.id,
					instagramMediaId: i.data.id,
					mediaType: "STORY",
					thumbnailUrl: i.data.thumbnail_url ?? i.data.media_url ?? null,
					publishedAt: i.data.timestamp ?? null,
					lastSyncedAt: new Date().toISOString(),
				})
				.onConflictDoNothing(),
			(await t.select().from(w).where(C(w.instagramMediaId, i.data.id)).limit(1))[0] ?? null);
}
async function Gn(t, e) {
	let { db: n } = t,
		r = await n.select().from(T).where(C(T.id, e.webhookEventId)).limit(1);
	if (r.length === 0) return { kind: "skipped", reason: "webhook_event_not_found" };
	let i;
	try {
		i = JSON.parse(r[0].rawPayload);
	} catch {
		return { kind: "skipped", reason: "payload_parse_error" };
	}
	let a = Ln(i, e.instagramCommentId);
	if (!a || !a.instagramCommentId || !a.instagramMediaId) return { kind: "skipped", reason: "comment_not_in_payload" };
	let o = je(t, a.platform);
	if (!o) return { kind: "skipped", reason: "facebook_not_configured" };
	let l = await n.select().from(K).limit(1);
	if (l.length > 0 && l[0].emergencyStop === 1) return { kind: "skipped", reason: "emergency_stop" };
	let m = await n.select().from(w).where(C(w.instagramMediaId, e.instagramMediaId)).limit(1);
	if (m.length === 0) {
		let S = await Xa(n, o, e.instagramMediaId, a.platform);
		if (!S) return { kind: "skipped", reason: "media_not_found" };
		m = [S];
	}
	let u = m[0],
		s = await n.select().from(_).where(C(_.id, u.instagramAccountId)).limit(1);
	if (s.length === 0) return { kind: "skipped", reason: "account_not_found" };
	let p = s[0];
	if (p.automationEnabled === 0) return { kind: "skipped", reason: "account_disabled" };
	if (p.circuitBreakerStatus !== "closed") return { kind: "skipped", reason: "circuit_open" };
	let c = await an(n, u);
	if (!c) return { kind: "skipped", reason: "no_active_automation" };
	if (c.excludeOwnComments === 1 && a.commenterId && a.commenterId === a.instagramAccountId) return { kind: "skipped", reason: "own_comment" };
	let y = oe(a.text),
		k = (await n.select().from(N).where(C(N.automationId, c.id))).map((S) => S.normalizedKeyword),
		P = Ie(y, k, c.matchType);
	if (!P.matched) return { kind: "no_match" };
	if (a.commenterId) {
		if (
			(
				await n
					.select({ id: g.id })
					.from(g)
					.where(xt(C(g.automationId, c.id), C(g.instagramCommentId, a.instagramCommentId)))
					.limit(1)
			).length === 0 &&
			c.oncePerContact === 1 &&
			(await tt(n, a.commenterId, c.id))
		)
			return { kind: "skipped", reason: "once_per_contact" };
		(await et(n, a.commenterId, {
			username: a.platform === "facebook" ? null : a.commenterUsername,
			name: a.platform === "facebook" ? a.commenterUsername : null,
			platform: a.platform,
		}),
			await Ee(n, a.commenterId, c));
	}
	let { run: I } = await Re(n, {
			automationId: c.id,
			webhookEventId: e.webhookEventId,
			instagramCommentId: a.instagramCommentId,
			instagramMediaId: u.instagramMediaId,
			commenterId: a.commenterId,
			commenterUsername: a.commenterUsername,
			originalCommentText: a.text,
			normalizedCommentText: y,
			matchedKeyword: P.matchedKeyword,
			status: "matched",
		}),
		D = I.publicReplyStatus ?? "pending",
		j = I.privateReplyStatus ?? "pending",
		ne = !1,
		re = I.retryCount + 1;
	if (D === "pending")
		if (c.publicReplyEnabled === 0) D = "skipped";
		else {
			let S = await n.select().from(Z).where(C(Z.automationId, c.id)),
				Q = Nn(S.map((U) => ({ id: U.id, message: U.message, enabled: U.enabled === 1 })));
			if (!Q) D = "skipped";
			else if (!(await me(n, { actionType: "public_reply", automationId: c.id, automationDailyLimit: c.dailyLimit })).allowed) D = "skipped";
			else {
				let U = await Pn(o, a.instagramCommentId, Q.message, a.platform);
				(await ge(n, I.id, p.id, "public_reply", re, U),
					U.ok
						? ((D = "success"), await n.update(g).set({ publicReplyMessage: Q.message }).where(C(g.id, I.id)))
						: U.failure && le(U.failure)
							? (ne = !0)
							: (D = "failed"));
			}
		}
	if (j === "pending")
		if (c.privateReplyEnabled === 0 || !c.openingDm) j = "skipped";
		else if (!(await me(n, { actionType: "private_reply", automationId: c.id, automationDailyLimit: c.dailyLimit })).allowed) j = "skipped";
		else {
			let S = await Ae(o, { instagramAccountId: a.instagramAccountId, commentId: a.instagramCommentId, ...nt(c), platform: a.platform });
			(await ge(n, I.id, p.id, "private_reply", re, S),
				S.ok
					? ((j = "success"), !we(c) && a.commenterId && (await xe(n, a.commenterId, c.id)))
					: (S.failure && le(S.failure)) || (S.failure && S.failure.httpStatus === 400 && !be.has(S.failure.nonRetryableReason ?? ""))
						? (ne = !0)
						: (j = "failed"));
		}
	if (ne && (D === "pending" || j === "pending")) {
		let S = fe(I.retryCount);
		return (
			await n
				.update(g)
				.set({ retryCount: I.retryCount + 1, publicReplyStatus: D, privateReplyStatus: j, updatedAt: new Date().toISOString() })
				.where(C(g.id, I.id)),
			{ kind: "retry", delaySeconds: S, runId: I.id, reason: "retryable_meta_error" }
		);
	}
	let M = D === "pending" ? "failed" : D,
		ce = j === "pending" ? "failed" : j,
		b = M === "failed" || ce === "failed" ? "completed_with_errors" : "completed";
	return (
		await n
			.update(g)
			.set({ status: b, publicReplyStatus: M, privateReplyStatus: ce, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
			.where(C(g.id, I.id)),
		{ kind: "completed", runId: I.id, publicReplyStatus: M, privateReplyStatus: ce }
	);
}
async function zn(t, e) {
	let { db: n, metaClient: r } = t,
		i = await n.select().from(T).where(C(T.id, e.webhookEventId)).limit(1);
	if (i.length === 0) return { kind: "skipped", reason: "webhook_event_not_found" };
	let a;
	try {
		a = JSON.parse(i[0].rawPayload);
	} catch {
		return { kind: "skipped", reason: "payload_parse_error" };
	}
	let o = $n(a, e.instagramCommentId);
	if (!o || !o.messageId || !o.storyId) return { kind: "skipped", reason: "story_reply_not_in_payload" };
	let l = await n.select().from(K).limit(1);
	if (l.length > 0 && l[0].emergencyStop === 1) return { kind: "skipped", reason: "emergency_stop" };
	let m = await n.select().from(w).where(C(w.instagramMediaId, o.storyId)).limit(1);
	if (m.length === 0) {
		let M = await Qa(n, r, o.storyId);
		if (!M) return { kind: "skipped", reason: "story_not_found" };
		m = [M];
	}
	let u = m[0];
	if (u.deletedAt) return { kind: "skipped", reason: "story_expired" };
	let s = await n.select().from(_).where(C(_.id, u.instagramAccountId)).limit(1);
	if (s.length === 0) return { kind: "skipped", reason: "account_not_found" };
	let p = s[0];
	if (p.automationEnabled === 0) return { kind: "skipped", reason: "account_disabled" };
	if (p.circuitBreakerStatus !== "closed") return { kind: "skipped", reason: "circuit_open" };
	let y = (
		await n
			.select()
			.from(f)
			.where(xt(C(f.instagramMediaId, u.id), C(f.status, "active")))
			.limit(1)
	)[0];
	if (!y) return { kind: "skipped", reason: "no_active_automation" };
	if (o.senderId && o.senderId === p.instagramAccountId) return { kind: "skipped", reason: "own_message" };
	let R = oe(o.text),
		k = await n.select().from(N).where(C(N.automationId, y.id)),
		P = Ie(
			R,
			k.map((M) => M.normalizedKeyword),
			y.matchType,
		);
	if (!P.matched) return { kind: "no_match" };
	if (o.senderId) {
		if (
			(
				await n
					.select({ id: g.id })
					.from(g)
					.where(xt(C(g.automationId, y.id), C(g.instagramCommentId, o.messageId)))
					.limit(1)
			).length === 0 &&
			y.oncePerContact === 1 &&
			(await tt(n, o.senderId, y.id))
		)
			return { kind: "skipped", reason: "once_per_contact" };
		(await et(n, o.senderId), await Ee(n, o.senderId, y));
	}
	let { run: I } = await Re(n, {
			automationId: y.id,
			webhookEventId: e.webhookEventId,
			instagramCommentId: o.messageId,
			instagramMediaId: u.instagramMediaId,
			commenterId: o.senderId || null,
			commenterUsername: null,
			originalCommentText: o.text,
			normalizedCommentText: R,
			matchedKeyword: P.matchedKeyword,
			status: "matched",
		}),
		D = I.privateReplyStatus ?? "pending",
		j = !1,
		ne = I.retryCount + 1;
	if (D === "pending")
		if (y.privateReplyEnabled === 0 || !y.openingDm || !o.senderId) D = "skipped";
		else if (!(await me(n, { actionType: "private_reply", automationId: y.id, automationDailyLimit: y.dailyLimit })).allowed) D = "skipped";
		else {
			let M = await Ae(r, { instagramAccountId: o.instagramAccountId, recipientId: o.senderId, ...nt(y) });
			(await ge(n, I.id, p.id, "private_reply", ne, M),
				M.ok
					? ((D = "success"), we(y) || (await xe(n, o.senderId, y.id)))
					: (M.failure && le(M.failure)) || (M.failure && M.failure.httpStatus === 400 && !be.has(M.failure.nonRetryableReason ?? ""))
						? (j = !0)
						: (D = "failed"));
		}
	if (j && D === "pending") {
		let M = fe(I.retryCount);
		return (
			await n
				.update(g)
				.set({ retryCount: I.retryCount + 1, publicReplyStatus: "skipped", privateReplyStatus: D, updatedAt: new Date().toISOString() })
				.where(C(g.id, I.id)),
			{ kind: "retry", delaySeconds: M, runId: I.id, reason: "retryable_meta_error" }
		);
	}
	let re = D === "pending" ? "failed" : D,
		ve = re === "failed" ? "completed_with_errors" : "completed";
	return (
		await n
			.update(g)
			.set({ status: ve, publicReplyStatus: "skipped", privateReplyStatus: re, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
			.where(C(g.id, I.id)),
		{ kind: "completed", runId: I.id, publicReplyStatus: "skipped", privateReplyStatus: re }
	);
}
function Za(t) {
	return t === "added_video" ? "FB_VIDEO" : "FB_POST";
}
var ri = 3,
	Wn = [30, 120, 600],
	ai = 300 * 1e3,
	ii = 7;
function Yn(t, e) {
	return {
		async send(n, r) {
			let i = Date.now();
			(await t
				.insert(v)
				.values({
					id: crypto.randomUUID(),
					message: JSON.stringify(n),
					status: "pending",
					nextRunAt: new Date(i + (r?.delaySeconds ?? 0) * 1e3).toISOString(),
				}),
				e?.());
		},
	};
}
async function oi(t, e) {
	return e.eventType === "story_reply" ? zn(t, e) : e.eventType === "messaging" ? Vn(t, e) : Gn(t, e);
}
async function at(t, e = {}) {
	let n = t.DB,
		r = e.now ?? Date.now,
		i = e.limit ?? 20,
		a = { processed: 0, done: 0, retried: 0, failed: 0 };
	await n
		.update(v)
		.set({ status: "pending", updatedAt: new Date(r()).toISOString() })
		.where(rt(ue(v.status, "running"), Jn(v.updatedAt, new Date(r() - ai).toISOString())));
	let o = await n
		.select({ id: v.id })
		.from(v)
		.where(rt(ue(v.status, "pending"), ti(v.nextRunAt, new Date(r()).toISOString())))
		.orderBy(ei(v.nextRunAt))
		.limit(i);
	if (o.length === 0) return a;
	let l = e.deps ?? { db: n, ...(await dn(n, t)) };
	for (let { id: m } of o) {
		let s = (
			await n
				.update(v)
				.set({ status: "running", updatedAt: new Date(r()).toISOString() })
				.where(rt(ue(v.id, m), ue(v.status, "pending")))
				.returning()
		)[0];
		if (!s) continue;
		a.processed += 1;
		let p,
			c = null;
		try {
			let R = JSON.parse(s.message),
				k = await oi(l, R);
			k.kind === "retry" && k.delaySeconds !== null && ((p = k.delaySeconds), (c = k.reason));
		} catch (R) {
			((p = null), (c = R?.name ?? "Error"));
		}
		let y = new Date(r()).toISOString();
		if (p === void 0) (await n.update(v).set({ status: "done", updatedAt: y }).where(ue(v.id, m)), (a.done += 1));
		else if (s.attempts >= ri)
			(await n
				.update(v)
				.set({ status: "failed", attempts: s.attempts + 1, lastError: c, updatedAt: y })
				.where(ue(v.id, m)),
				(a.failed += 1));
		else {
			let R = p ?? Wn[Math.min(s.attempts, Wn.length - 1)];
			(await n
				.update(v)
				.set({ status: "pending", attempts: s.attempts + 1, lastError: c, nextRunAt: new Date(r() + R * 1e3).toISOString(), updatedAt: y })
				.where(ue(v.id, m)),
				(a.retried += 1));
		}
	}
	return a;
}
async function Xn(t, e = Date.now()) {
	let n = new Date(e - ii * 864e5).toISOString();
	return (
		await t
			.delete(v)
			.where(rt(ni`${v.status} in ('done', 'failed')`, Jn(v.updatedAt, n)))
			.returning({ id: v.id })
	).length;
}
function Qn(t, e) {
	let n = new TextEncoder(),
		r = n.encode(t),
		i = n.encode(e),
		a = r.length ^ i.length,
		o = Math.max(r.length, i.length);
	for (let l = 0; l < o; l++) a |= (r[l] ?? 0) ^ (i[l] ?? 0);
	return a === 0;
}
function Zn() {
	let t = new si();
	return (
		t.use("*", async (e, n) => {
			let r = e.env.CRON_SECRET?.trim(),
				i = e.req.header("Authorization") ?? "",
				a = i.startsWith("Bearer ") ? i.slice(7).trim() : "";
			return !r || !a || !Qn(a, r) ? e.json({ error: "unauthorized" }, 401) : n();
		}),
		t.post("/tick", async (e) => e.json(await at(e.env))),
		t.post("/sync", async (e) => e.json(await Ve(e.env))),
		t.post("/cleanup", async (e) => {
			let n = await Mn(e.env.DB),
				r = await Xn(e.env.DB);
			return e.json({ ...n, jobsDeleted: r });
		}),
		t
	);
}
function li(t) {
	return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function er(t) {
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
<p>${e ? li(e) : "請透過本服務所綁定之 Instagram 帳號的私訊，或 Facebook 粉專的 Messenger 聯絡我們（若你曾收到本服務的訊息，直接回覆該對話即可）。"}</p>
<p>更新日期：2026-10-19</p>
</body></html>`;
}
import { Hono as ci } from "npm:hono@4.12.32";
import { eq as rr } from "npm:drizzle-orm@0.45.2";
var vt = { debug: 10, info: 20, warn: 30, error: 40 };
function tr(t = "info") {
	let e = vt[t] ?? vt.info;
	function n(r, i) {
		if (vt[r] < e) return;
		let a = JSON.stringify({ timestamp: new Date().toISOString(), level: r, ...i });
		r === "warn" || r === "error" ? console.error(a) : console.log(a);
	}
	return { debug: (r) => n("debug", r), info: (r) => n("info", r), warn: (r) => n("warn", r), error: (r) => n("error", r) };
}
async function nr(t, e) {
	await t.send(e);
}
var di = new TextEncoder();
function mi(t) {
	if (t.length === 0 || t.length % 2 !== 0) return null;
	let e = new Uint8Array(t.length / 2);
	for (let n = 0; n < e.length; n += 1) {
		let r = Number.parseInt(t.slice(n * 2, n * 2 + 2), 16);
		if (Number.isNaN(r)) return null;
		e[n] = r;
	}
	return e;
}
function ui(t, e) {
	if (t.length !== e.length) return !1;
	let n = 0;
	for (let r = 0; r < t.length; r += 1) n |= t[r] ^ e[r];
	return n === 0;
}
async function Tt(t, e, n) {
	if (!n) return !1;
	let r = "sha256=";
	if (!n.startsWith(r)) return !1;
	let i = n.slice(r.length).trim().toLowerCase(),
		a = mi(i);
	if (!a) return !1;
	let o = await crypto.subtle.importKey("raw", di.encode(t), { name: "HMAC", hash: "SHA-256" }, !1, ["sign"]),
		l = e instanceof Uint8Array ? new Uint8Array(e) : new Uint8Array(e),
		m = new Uint8Array(await crypto.subtle.sign("HMAC", o, l));
	return ui(a, m);
}
async function ar(t) {
	let e = tr(t.env.LOG_LEVEL),
		n = await t.req.arrayBuffer(),
		r = t.req.header("X-Hub-Signature-256");
	if (!((await Tt(t.env.INSTAGRAM_APP_SECRET, n, r)) || (!!t.env.META_APP_SECRET && (await Tt(t.env.META_APP_SECRET, n, r)))))
		return (e.warn({ action: "webhook.signature_invalid", httpStatus: 401 }), t.text("invalid signature", 401));
	let a;
	try {
		a = JSON.parse(new TextDecoder().decode(n));
	} catch {
		return t.text("bad request", 400);
	}
	let o = At(a).filter((s) => s.instagramCommentId && s.instagramMediaId),
		l = It(a).filter((s) => s.messageId && s.storyId),
		m = [];
	for (let s of o)
		m.push({
			eventKey: await We({
				instagramAccountId: s.instagramAccountId,
				instagramMediaId: s.instagramMediaId,
				instagramCommentId: s.instagramCommentId,
				eventType: s.eventType,
				eventTimestamp: s.eventTimestamp,
			}),
			eventType: "comments",
			platform: s.platform,
			instagramAccountId: s.instagramAccountId,
			instagramMediaId: s.instagramMediaId,
			instagramCommentId: s.instagramCommentId,
		});
	for (let s of l)
		m.push({
			eventKey: await We({ stableEventId: s.messageId }),
			eventType: "story_reply",
			platform: "instagram",
			instagramAccountId: s.instagramAccountId,
			instagramMediaId: s.storyId,
			instagramCommentId: s.messageId,
		});
	for (let s of Rt(a)) {
		let p = kt(s);
		m.push({
			eventKey: await We({ stableEventId: p }),
			eventType: "messaging",
			platform: s.platform,
			instagramAccountId: s.instagramAccountId,
			instagramMediaId: "",
			instagramCommentId: p,
		});
	}
	let u = t.env.DB;
	for (let s of m) {
		let p = await u.select().from(T).where(rr(T.eventKey, s.eventKey)).limit(1);
		if (p.length > 0) {
			await u
				.update(T)
				.set({ duplicateCount: p[0].duplicateCount + 1, lastReceivedAt: new Date().toISOString() })
				.where(rr(T.id, p[0].id));
			continue;
		}
		let c = crypto.randomUUID();
		(await u
			.insert(T)
			.values({
				id: c,
				eventKey: s.eventKey,
				eventType: s.eventType,
				instagramAccountId: s.instagramAccountId,
				instagramMediaId: s.instagramMediaId,
				instagramCommentId: s.instagramCommentId,
				rawPayload: JSON.stringify(a),
				signatureValid: 1,
				status: "received",
			}),
			await nr(t.env.COMMENT_QUEUE, {
				webhookEventId: c,
				eventKey: s.eventKey,
				instagramAccountId: s.instagramAccountId,
				instagramMediaId: s.instagramMediaId,
				instagramCommentId: s.instagramCommentId,
				eventType: s.eventType,
				platform: s.platform,
			}));
	}
	return t.text("ok", 200);
}
function ir(t) {
	let e = t.req.query("hub.mode"),
		n = t.req.query("hub.verify_token"),
		r = t.req.query("hub.challenge");
	return e === "subscribe" && n && n === t.env.WEBHOOK_VERIFY_TOKEN ? t.text(r ?? "", 200) : t.text("Forbidden", 403);
}
function or() {
	let t = new ci();
	return (t.get("/meta/instagram", (e) => ir(e)), t.post("/meta/instagram", (e) => ar(e)), t);
}
function sr() {
	let t = new pi();
	return (
		t.get("/", (e) => {
			let n = (e.env.ADMIN_ORIGINS ?? "").split(",")[0]?.trim();
			return n ? e.redirect(n.replace(/\/$/, "") + "/CHAT/", 302) : e.text("IG／FB 自動私訊 API 運作中", 200);
		}),
		t.use("/api/admin/*", async (e, n) => {
			let r = it(e.env.ADMIN_ORIGINS);
			return fi({
				origin: (i) => (r.includes(i) ? i : null),
				allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
				allowHeaders: ["Content-Type", "Authorization"],
				exposeHeaders: ["Content-Disposition"],
				maxAge: 600,
			})(e, n);
		}),
		t.get("/api/health", async (e) => {
			try {
				return (await e.env.DB.execute(gi`select 1`), e.json({ status: "ok" }));
			} catch {
				return e.json({ status: "degraded" }, 503);
			}
		}),
		t.get("/privacy", (e) => e.html(er(e.env.PRIVACY_CONTACT))),
		t.route("/api/admin", In()),
		t.route("/api/webhooks", or()),
		t.route("/api/internal", Zn()),
		t
	);
}
function lr(t, e, n = Date.now) {
	let r = new Map();
	return {
		async limit({ key: i }) {
			let a = n(),
				o = Math.floor(a / (e * 1e3)),
				l = r.get(i);
			if (!l || l.windowStart !== o) {
				if ((r.set(i, { windowStart: o, count: 1 }), r.size > 1e3)) for (let [m, u] of r) u.windowStart !== o && r.delete(m);
				return { success: !0 };
			}
			return ((l.count += 1), { success: l.count <= t });
		},
	};
}
var mr = Deno.env.get("SUPABASE_DB_URL");
if (!mr) throw new Error("缺少 SUPABASE_DB_URL");
var ur = wi(mr, { prepare: !1, max: 3, idle_timeout: 20 }),
	cr = yi(ur, { schema: De }),
	_i = ["ADMIN_SESSION_SECRET", "CRON_SECRET", "WEBHOOK_VERIFY_TOKEN"];
async function hi() {
	try {
		let t = await ur`
      select name, decrypted_secret from vault.decrypted_secrets where name = any(${_i})`;
		return Object.fromEntries(t.map((e) => [e.name, e.decrypted_secret]));
	} catch (t) {
		return (console.error("[vault] 讀取失敗：", t?.name ?? t), {});
	}
}
var pr = Deno.env.toObject(),
	dr = (pr.SUPABASE_URL ?? "").replace(/\/$/, ""),
	Ct = {
		META_GRAPH_API_VERSION: "v21.0",
		APP_ENV: "production",
		LOG_LEVEL: "info",
		ADMIN_ORIGINS: "https://seanchen0427.github.io",
		PUBLIC_API_BASE: dr ? `${dr}/functions/v1` : void 0,
		...(await hi()),
		...Object.fromEntries(Object.entries(pr).filter(([, t]) => t !== "")),
		DB: cr,
		ADMIN_RATE_LIMITER: lr(Lt, $t),
	};
function bi(t) {
	let e = t.catch((n) => console.error("[jobs] background run failed:", n?.name ?? n));
	typeof EdgeRuntime < "u" && EdgeRuntime && EdgeRuntime.waitUntil(e);
}
Ct.COMMENT_QUEUE = Yn(cr, () => bi(at(Ct)));
var Si = sr();
Deno.serve((t) => Si.fetch(t, Ct));
