// Sean 版新增：Instagram User Profile API（追蹤檢查用）。
// GET /{igsid}?fields=username,name,is_user_follow_business
// 需要使用者同意：對方傳過私訊或按過按鈕（postback）後才查得到；只留言的人會回錯誤。
// 因此門檻流程一律先送「領取」按鈕，對方按下後才查追蹤。
import type { MetaCallResult, MetaClient } from './client';

export interface UserProfile {
  username?: string;
  name?: string;
  is_user_follow_business?: boolean;
}

export function getUserProfile(client: MetaClient, igsid: string): Promise<MetaCallResult<UserProfile>> {
  return client.get<UserProfile>(igsid, { fields: 'username,name,is_user_follow_business' });
}
