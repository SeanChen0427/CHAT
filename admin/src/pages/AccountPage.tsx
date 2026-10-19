// 帳號設定頁：Meta 串接資訊（Sean 版）、變更登入密碼。
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { apiGet, apiPost, type ApiError } from '../api/client';

// Sean 版（Supabase）：Meta 後台要填的資訊。
interface MetaSetup {
  callbackUrl: string | null;
  verifyToken: string | null;
  privacyUrl: string | null;
  configured: { instagramAppSecret: boolean; instagramToken: boolean; metaAppSecret: boolean; facebookPageToken: boolean };
}

function CopyField({ id, label, value }: { id: string; label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="form-field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="copy-row">
        <input id={id} className="input" readOnly value={value ?? '（尚未設定）'} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={!value}
          onClick={() => {
            if (!value) return;
            navigator.clipboard?.writeText(value).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => undefined,
            );
          }}
        >
          {copied ? '已複製' : '複製'}
        </button>
      </div>
    </div>
  );
}

function MetaSetupCard() {
  const [info, setInfo] = useState<MetaSetup | null>(null);
  useEffect(() => {
    apiGet<MetaSetup>('/api/admin/system/meta-setup').then(setInfo, () => setInfo(null));
  }, []);
  if (!info) return null;
  const items: Array<[string, boolean]> = [
    ['Instagram 應用程式密鑰', info.configured.instagramAppSecret],
    ['Instagram 存取權杖', info.configured.instagramToken],
    ['Meta 應用程式密鑰（Facebook 用）', info.configured.metaAppSecret],
    ['Facebook 粉專存取權杖', info.configured.facebookPageToken],
  ];
  return (
    <div className="card">
      <h2 className="card-title">Meta 串接資訊</h2>
      <p className="page-subtitle">到 Meta 開發者後台設定事件通知時，貼上以下兩個值。</p>
      <CopyField id="callback-url" label="回呼網址（Callback URL）" value={info.callbackUrl} />
      <CopyField id="verify-token" label="驗證權杖（Verify token）" value={info.verifyToken} />
      <CopyField id="privacy-url" label="隱私權政策網址" value={info.privacyUrl} />
      <div className="form-field">
        <span className="label">權杖設定狀態</span>
        <ul className="setup-list">
          {items.map(([name, ok]) => (
            <li key={name} className={ok ? 'is-ok' : 'is-missing'}>
              {ok ? '已設定' : '未設定'}：{name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const MIN_PASSWORD_LENGTH = 12;

export function AccountPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`新密碼長度至少需要 ${MIN_PASSWORD_LENGTH} 個字元。`);
      return;
    }
    if (newPassword !== confirm) {
      setError('兩次輸入的新密碼不一致。');
      return;
    }

    setBusy(true);
    try {
      await apiPost('/api/admin/auth/change-password', { currentPassword, newPassword });
      setNotice('密碼已更新 ✓');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) navigate('/login');
      else setError(apiErr.message ?? '更新失敗，請稍後再試。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader />
      <div className="container container-tight">
        <h1 className="page-title">帳號設定</h1>
        <MetaSetupCard />
        <div className="card">
          <h2 className="card-title">變更密碼</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="label" htmlFor="current-password">
                目前密碼
              </label>
              <input
                id="current-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="label" htmlFor="new-password">
                新密碼
              </label>
              <input
                id="new-password"
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder={`至少 ${MIN_PASSWORD_LENGTH} 個字元`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="label" htmlFor="confirm-password">
                確認新密碼
              </label>
              <input
                id="confirm-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {error ? (
              <div className="alert alert-danger alerts-block" role="alert">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="alert alert-success alerts-block" role="status">
                {notice}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? '更新中…' : '更新密碼'}
            </button>
          </form>
        </div>
        <p className="page-subtitle is-footnote">
          本系統不提供忘記密碼重設，請妥善保管新密碼。
        </p>
      </div>
    </>
  );
}
