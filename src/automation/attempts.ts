// 嘗試紀錄與熔斷評估（原本在 engine.ts，Sean 版抽出成獨立模組，讓 funnel.ts 也能共用）。
import { desc, eq } from 'drizzle-orm';
import type { SchemaDb } from '../database/types';
import { apiAttempts, auditLogs, instagramAccounts } from '../database/schema';
import { evaluateCircuitBreaker, type AttemptOutcome } from '../monitoring/circuit-breaker';


// 熔斷評估最多回看的嘗試筆數。5 分鐘窗口極高流量時可能超過此數而低估錯誤率，
// 但連續 5 次類條件不受影響；取捨為避免全表掃描。
const BREAKER_LOOKBACK_ATTEMPTS = 60;

// 熔斷評估用的失敗分類：成功為 null；未知失敗歸 'other'。
function classifyFailureReason(result: {
  ok: boolean;
  failure?: { nonRetryableReason?: string };
}): string | null {
  if (result.ok) return null;
  const reason = result.failure?.nonRetryableReason;
  if (reason === 'token_invalid' || reason === 'permission_denied' || reason === 'policy_restricted') {
    return reason;
  }
  return 'other';
}

// 寫入嘗試紀錄後立即評估熔斷（spec §19）：條件成立就把帳號熔斷狀態設為 open 並留 audit。
// 每日發送量上限不在此評估——送出 gate（send-gate.ts）已在送出前 fail-closed 擋下，
// 用「拒絕送出」而非「開熔斷」處理限額，避免跨日後仍卡在 open 需人工復歸。
export async function recordAttempt(
  db: SchemaDb,
  runId: string,
  accountRowId: string,
  actionType: string,
  attemptNumber: number,
  result: {
    ok: boolean;
    status: number;
    failure?: { httpStatus?: number; metaErrorCode?: string; metaErrorMessage?: string; nonRetryableReason?: string };
  },
): Promise<void> {
  await db.insert(apiAttempts).values({
    id: crypto.randomUUID(),
    automationRunId: runId,
    actionType,
    attemptNumber,
    httpStatus: result.status || result.failure?.httpStatus || null,
    failureReason: classifyFailureReason(result),
    metaErrorCode: result.failure?.metaErrorCode ?? null,
    metaErrorMessage: result.failure?.metaErrorMessage ?? null,
    completedAt: new Date().toISOString(),
  });

  const recent = await db
    .select({ completedAt: apiAttempts.completedAt, failureReason: apiAttempts.failureReason })
    .from(apiAttempts)
    .orderBy(desc(apiAttempts.completedAt))
    .limit(BREAKER_LOOKBACK_ATTEMPTS);
  const recentAttempts: AttemptOutcome[] = recent
    .filter((a) => a.completedAt != null)
    .map((a) => ({
      ok: a.failureReason == null,
      reason: (a.failureReason ?? undefined) as AttemptOutcome['reason'],
      at: Date.parse(a.completedAt as string),
    }));
  const decision = evaluateCircuitBreaker({
    recentAttempts,
    now: Date.now(),
    dailySentCount: 0,
    dailyLimit: null,
  });
  if (decision.open) {
    const account = (
      await db.select().from(instagramAccounts).where(eq(instagramAccounts.id, accountRowId)).limit(1)
    )[0];
    if (account && account.circuitBreakerStatus === 'closed') {
      await db
        .update(instagramAccounts)
        .set({ circuitBreakerStatus: 'open', updatedAt: new Date().toISOString() })
        .where(eq(instagramAccounts.id, accountRowId));
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        adminUserId: null,
        action: 'system.circuit_breaker_open',
        entityType: 'instagram_accounts',
        entityId: accountRowId,
        metadata: JSON.stringify({ reason: decision.reason }),
      });
    }
  }
}

