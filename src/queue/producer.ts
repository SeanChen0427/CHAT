// Queue Producer（spec.md 第 12.1 節）。Queue Message 只帶識別碼，不含任何機密。

export interface CommentEventMessage {
  webhookEventId: string;
  eventKey: string;
  instagramAccountId: string;
  instagramMediaId: string;
  instagramCommentId: string;
  // 'story_reply'＝限時動態回應（mid 存於 instagramCommentId、story id 存於 instagramMediaId）。
  // 省略或 'comments'＝留言事件（向後相容既有佇列中的訊息）。
  // Sean 版新增 'messaging'＝私訊／按鈕／referral（事件鍵存於 instagramCommentId，instagramMediaId 為空字串）。
  eventType?: 'comments' | 'story_reply' | 'messaging';
  // Sean 版新增：省略＝'instagram'（向後相容）。
  platform?: 'instagram' | 'facebook';
}

// Sean 版（Supabase）：佇列抽象。正式環境寫入 event_jobs 表（src/queue/jobs.ts），測試可用假實作。
export interface EventQueue {
  send(message: CommentEventMessage, options?: { delaySeconds?: number }): Promise<void>;
}

export async function enqueueCommentEvent(
  queue: EventQueue,
  message: CommentEventMessage,
): Promise<void> {
  await queue.send(message);
}
