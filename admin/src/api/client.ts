// Admin API 的極簡 fetch 封裝。
// Sean 版（Supabase）：後台放在 GitHub Pages，API 在 Supabase（不同網域），瀏覽器不會帶第三方 Cookie，
// 因此登入後把後端回傳的權杖存在 localStorage，每次請求帶 Authorization: Bearer。
// API 網址由建置時的 VITE_API_BASE 指定（例：https://xxxx.supabase.co/functions/v1）；未設定時走同網域。
const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'ig_admin_token';

export function setToken(token: string | undefined | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 無痕模式等情況存不了，只是每次要重新登入 */
  }
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(API_BASE + path, { ...init, headers });
  } catch {
    // 瀏覽器連不到後端（斷網、後端暫停）時給中文說明，不顯示英文的 Failed to fetch。
    const err: ApiError = { status: 0, message: '連不到系統後端，請確認網路後重新整理。若一直如此，可能是 Supabase 專案被暫停，到 Supabase 後台按 Restore 即可。' };
    throw err;
  }
}

// 下載檔案（CSV 匯出）：跨網域時 <a href> 帶不了權杖，改用 fetch 取得後觸發下載。
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err: ApiError = { status: res.status, message: `HTTP ${res.status}` };
    throw err;
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export interface ApiError {
  status: number;
  message: string;
  // 啟用失敗（422）時後端回傳的原因代碼清單。
  reasons?: string[];
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err: ApiError = { status: res.status, message: `HTTP ${res.status}` };
    throw err;
  }
  return (await res.json()) as T;
}

export async function apiPost<T = unknown>(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  const res = await apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = '發生錯誤，請稍後再試。';
    let reasons: string[] | undefined;
    if (res.status === 429) {
      message = '登入嘗試次數過多，請稍後再試。';
    } else {
      try {
        const data = (await res.json()) as { error?: string; reasons?: string[] };
        if (data.error) message = data.error;
        // Sean 版修正：保留 422 的 reasons，讓編輯器能逐條顯示無法啟用的原因。
        if (Array.isArray(data.reasons)) reasons = data.reasons;
      } catch {
        // 忽略非 JSON 回應，沿用預設訊息。
      }
    }
    const err: ApiError = { status: res.status, message, reasons };
    throw err;
  }

  return (await res.json()) as T;
}

// Sean 版新增：DELETE（名單刪除用）。
export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    const err: ApiError = { status: res.status, message };
    throw err;
  }
  return (await res.json()) as T;
}

// Sean 版（一鍵連結）：PUT（設定精靈存 App 資料）。
export function apiPut<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiPost<T>(path, body, 'PUT');
}
