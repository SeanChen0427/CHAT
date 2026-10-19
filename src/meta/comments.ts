// 公開回覆留言（spec.md 第 9 節）。
// Graph API：POST /{comment-id}/replies?message=... 對某留言公開回覆。
import type { MetaCallResult, MetaClient } from './client';

export interface ReplyResult {
  id: string; // 回覆留言的 id
}

// Sean 版：Facebook 粉專留言的公開回覆端點是 POST /{comment-id}/comments（Instagram 是 /replies）。
export function replyToComment(
  client: MetaClient,
  commentId: string,
  message: string,
  platform: 'instagram' | 'facebook' = 'instagram',
): Promise<MetaCallResult<ReplyResult>> {
  const edge = platform === 'facebook' ? 'comments' : 'replies';
  return client.post<ReplyResult>(`${commentId}/${edge}`, { message });
}
