// Sean 版（一鍵連結）：第一次使用的設定精靈。
// 寫給完全不懂技術的人：每一步說明做什麼、為什麼，附上直接打開 Meta 對應頁面的按鈕、要貼的值的複製按鈕，
// 完成的步驟自動打勾。Meta 後台的名稱常改版，說明以「找類似名稱」的方式描述，並附「找不到？」提示。
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppHeader } from '../components/AppHeader';
import { SetupChecklist } from '../components/Illustrations';
import { apiGet, apiPost, apiPut, type ApiError } from '../api/client';

interface ConnectStatus {
  app: { instagramAppId: string | null; hasInstagramAppSecret: boolean; metaAppId: string | null; hasMetaAppSecret: boolean };
  redirectUris: { instagram: string | null; facebook: string | null };
  callbackUrl: string | null;
  verifyToken: string | null;
  instagram: { username: string | null; profilePictureUrl: string | null; subscribed: boolean; tokenExpiresAt: string | null } | null;
  facebook: { name: string | null; profilePictureUrl: string | null; subscribed: boolean } | null;
  pendingPageChoice: boolean;
  webhook: { instagram: string | null; page: string | null };
  automationCount: number;
}

const CHECK_KEY = 'ig_setup_checks';
function loadChecks(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(CHECK_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function saveChecks(v: Record<string, boolean>) {
  try {
    localStorage.setItem(CHECK_KEY, JSON.stringify(v));
  } catch {
    /* 存不了只是下次要重新勾 */
  }
}

function privacyUrl(): string {
  return new URL('privacy.html', document.baseURI).toString();
}

export function CopyBox({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-box">
      <div className="copy-box-label">{label}</div>
      <div className="copy-row">
        <input className="input" readOnly value={value ?? '（尚未產生）'} onFocus={(e) => e.target.select()} aria-label={label} />
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
      {hint ? <div className="copy-box-hint">{hint}</div> : null}
    </div>
  );
}

function Step({
  n,
  title,
  done,
  optional,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  optional?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section layout="position" className={`setup-step${done ? ' is-done' : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="setup-step-head" onClick={onToggle} aria-expanded={open}>
        <span className="setup-step-num" aria-hidden="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={done ? 'done' : 'n'}
              initial={reduce ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 26 }}
            >
              {done ? '✓' : n}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="setup-step-title">
          {title}
          {optional ? <span className="setup-step-tag">選用</span> : null}
        </span>
        <span className="setup-step-state">
          {done ? '已完成' : null}
          <svg className="setup-step-chevron" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            className="setup-step-body-wrap"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ height: { type: 'spring', stiffness: 380, damping: 38 }, opacity: { duration: 0.18 } }}
          >
            <div className="setup-step-body">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return (
    <details className="setup-help">
      <summary>找不到？</summary>
      <div>{children}</div>
    </details>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>(loadChecks);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'danger' | 'warning'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({ instagramAppId: '', instagramAppSecret: '', metaAppId: '', metaAppSecret: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await apiGet<ConnectStatus>('/api/admin/connect/status');
      setStatus(s);
      if (s.pendingPageChoice) {
        const r = await apiGet<{ pages: Array<{ id: string; name: string }> }>('/api/admin/connect/facebook/pages');
        setPages(r.pages);
      } else setPages([]);
      return s;
    } catch (e) {
      if ((e as ApiError).status === 401) navigate('/login');
      else setLoadError((e as ApiError).message ?? '載入失敗，請重新整理。');
      return null;
    }
  }, [navigate]);

  // 從 Meta 授權回來時顯示結果；成功就順便同步一次貼文。
  useEffect(() => {
    // 看過精靈後，這個分頁回首頁不再自動導回來。
    try {
      sessionStorage.setItem('setup_skipped', '1');
    } catch {
      /* 無痕模式等情況忽略 */
    }
    const platform = params.get('connect');
    const result = params.get('status');
    if (!platform || !result) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
      return;
    }
    const name = platform === 'facebook' ? 'Facebook 粉專' : 'Instagram';
    const message = params.get('message');
    if (result === 'ok' || result === 'warning') {
      setNotice({
        kind: result === 'ok' ? 'success' : 'warning',
        text: result === 'ok' ? `${name} 連結成功，正在同步貼文…` : `${name} 已連結，但有一項需要注意：${message ?? ''}`,
      });
      apiPost('/api/admin/media/sync', {})
        .then(() => setNotice((n) => (n && n.kind === 'success' ? { kind: 'success', text: `${name} 連結成功，貼文已同步。` } : n)))
        .catch(() => undefined)
        .finally(load);
    } else if (result === 'choose') {
      setNotice({ kind: 'warning', text: '你管理多個粉專，請在下方選擇要使用的那一個。' });
      load();
    } else if (result === 'cancelled') {
      setNotice({ kind: 'warning', text: `已取消 ${name} 授權。準備好後可以再按一次連結。` });
      load();
    } else {
      setNotice({ kind: 'danger', text: `${name} 連結失敗：${message ?? '未知錯誤'}。請對照下方步驟檢查後再試一次。` });
      load();
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCheck(key: string) {
    const next = { ...checks, [key]: !checks[key] };
    setChecks(next);
    saveChecks(next);
  }

  async function saveApp(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy('app');
    try {
      await apiPut('/api/admin/connect/app', form);
      setForm({ instagramAppId: '', instagramAppSecret: '', metaAppId: '', metaAppSecret: '' });
      await load();
      setNotice({ kind: 'success', text: 'App 資料已儲存。' });
    } catch (err) {
      setFormError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  async function startConnect(platform: 'instagram' | 'facebook') {
    setBusy(platform);
    try {
      const returnTo = new URL('setup', document.baseURI).toString();
      const { url } = await apiPost<{ url: string }>(`/api/admin/connect/${platform}/start`, { returnTo });
      window.location.href = url;
    } catch (err) {
      setNotice({ kind: 'danger', text: (err as ApiError).message });
      setBusy(null);
    }
  }

  async function choosePage(pageId: string) {
    setBusy('page');
    try {
      const r = await apiPost<{ warning?: string | null }>('/api/admin/connect/facebook/select', { pageId });
      setNotice(r.warning ? { kind: 'warning', text: `粉專已選定，但：${r.warning}` } : { kind: 'success', text: '粉專已連結。' });
      await apiPost('/api/admin/media/sync', {}).catch(() => undefined);
      await load();
    } catch (err) {
      setNotice({ kind: 'danger', text: (err as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  async function retryWebhooks() {
    setBusy('webhook');
    try {
      await apiPost('/api/admin/connect/webhooks/retry', {});
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <>
        <AppHeader />
        <div className="container container-tight">
          {loadError ? (
            <div className="alert alert-danger alerts-block" role="alert">
              {loadError}
            </div>
          ) : (
            <p className="page-subtitle">載入中…</p>
          )}
        </div>
      </>
    );
  }

  const appDone = Boolean(status.app.instagramAppId && status.app.hasInstagramAppSecret);
  const metaDone = Boolean(status.app.metaAppId && status.app.hasMetaAppSecret);
  const done = {
    1: Boolean(checks.prepared),
    2: Boolean(checks.appCreated) || appDone,
    3: appDone,
    4: Boolean(checks.redirectSet) || Boolean(status.instagram),
    5: Boolean(status.instagram),
    6: Boolean(status.facebook),
    7: status.automationCount > 0,
  } as Record<number, boolean>;
  const firstOpen = [1, 2, 3, 4, 5, 7].find((n) => !done[n]) ?? 7;
  const current = openStep ?? firstOpen;
  const toggle = (n: number) => setOpenStep(current === n ? 0 : n);
  const webhookProblem =
    (status.instagram && status.webhook.instagram && status.webhook.instagram !== 'ok') ||
    (status.facebook && status.webhook.page && status.webhook.page !== 'ok');
  const required = [1, 2, 3, 4, 5, 7];
  const finished = required.filter((n) => done[n]).length;

  return (
    <>
      <AppHeader />
      <div className="container container-tight">
        <div className="setup-hero">
          <div>
            <h1 className="page-title">設定精靈</h1>
            <p className="page-subtitle">
              照順序完成下面的步驟，就能讓 Instagram（與 Facebook 粉專）的留言、私訊自動回覆。第一次大約 20～30 分鐘，之後不用再做。
            </p>
          </div>
          <SetupChecklist size={150} />
        </div>
        <div className="setup-progress" aria-label={`已完成 ${finished} / ${required.length} 步`}>
          <motion.div
            className="setup-progress-bar"
            initial={false}
            animate={{ width: `${(finished / required.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 160, damping: 24 }}
          />
        </div>
        <p className="setup-progress-text">
          已完成 {finished} / {required.length} 步（Facebook 為選用）
        </p>

        {notice ? (
          <div className={`alert alert-${notice.kind} alerts-block`} role="status">
            {notice.text}
          </div>
        ) : null}

        <Step n={1} title="確認你的 Instagram 帳號" done={done[1]} open={current === 1} onToggle={() => toggle(1)}>
          <p>自動私訊只能用在 Instagram 的「專業帳號」。在手機的 Instagram App 確認這兩件事：</p>
          <ol>
            <li>
              帳號是<strong>商業帳號</strong>或<strong>創作者帳號</strong>（設定與隱私 &gt; 帳號類型和工具）。個人帳號要先切換，免費、可隨時切回。
            </li>
            <li>
              設定與隱私 &gt; 訊息與限時動態回覆 &gt; 訊息控制 &gt; 已連結的工具 &gt; 打開<strong>「允許存取訊息」</strong>。沒打開的話，系統收不到私訊。
            </li>
          </ol>
          <label className="setup-check">
            <input type="checkbox" checked={Boolean(checks.prepared)} onChange={() => toggleCheck('prepared')} />
            兩項都確認好了
          </label>
        </Step>

        <Step n={2} title="建立你自己的 Meta App" done={done[2]} open={current === 2} onToggle={() => toggle(2)}>
          <p>
            Meta App 是你的工具和 Instagram 之間的「通行證」。每個人都要有自己的一個，只要建一次，免費。
          </p>
          <ol>
            <li>
              按下方按鈕打開 Meta 開發者網站，用你的 Facebook 帳號登入。第一次會請你註冊成開發者（填手機、Email），照畫面完成即可。
            </li>
            <li>按「建立應用程式」，名稱隨意（例如「我的自動私訊」），聯絡 Email 填你的。</li>
            <li>
              「新增使用案例」選和 <strong>Instagram</strong> 有關、能管理訊息與留言的那一個（英文類似「Manage messaging &amp; content on Instagram」）。要接 Facebook 粉專的話，之後再加 Messenger 即可。
            </li>
            <li>問到「商家資產組合」時可以先選不連結，之後再補。</li>
          </ol>
          <div className="btn-row">
            <a className="btn btn-primary btn-sm" href="https://developers.facebook.com/apps/creation/" target="_blank" rel="noreferrer">
              打開 Meta 建立 App
            </a>
          </div>
          <Help>
            Meta 介面常改版，按鈕名稱可能不同。只要找得到「建立應用程式」（Create App）並選到 Instagram 相關的使用案例就對了。如果已經有 App，可以直接用舊的，跳到下一步。
          </Help>
          <label className="setup-check">
            <input type="checkbox" checked={Boolean(checks.appCreated)} onChange={() => toggleCheck('appCreated')} />
            App 建好了
          </label>
        </Step>

        <Step n={3} title="把 App 資料填進來" done={done[3]} open={current === 3} onToggle={() => toggle(3)}>
          <p>App 的「編號」與「密碼」讓你的工具能代表這個 App 跟 Meta 溝通。只會存在你自己的資料庫，不會顯示出來。</p>
          <div className="setup-where">
            <strong>Instagram App ID 與 Instagram App Secret 在哪裡：</strong>
            在 App 後台左側進入 Instagram 的使用案例 &gt; 「API setup with Instagram business login」（Instagram 登入設定）頁面最上方。Secret 要按「顯示」才看得到。
          </div>
          <div className="setup-where">
            <strong>Meta App ID 與 Meta App Secret 在哪裡：</strong>
            左側「應用程式設定」&gt;「基本資料」，最上方的「應用程式編號」與「應用程式密鑰」（按顯示）。
            <br />
            注意：這組和上面那組是<strong>不同的</strong>號碼，不要貼錯。
          </div>
          <form onSubmit={saveApp} className="setup-form">
            {(
              [
                ['instagramAppId', 'Instagram App ID', status.app.instagramAppId ? `目前：${status.app.instagramAppId}` : '一串數字'],
                ['instagramAppSecret', 'Instagram App Secret', status.app.hasInstagramAppSecret ? '已儲存（要更換才需重填）' : '英文加數字'],
                ['metaAppId', 'Meta App ID（建議填）', status.app.metaAppId ? `目前：${status.app.metaAppId}` : '一串數字'],
                ['metaAppSecret', 'Meta App Secret（建議填）', status.app.hasMetaAppSecret ? '已儲存（要更換才需重填）' : '英文加數字'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <div className="form-field" key={key}>
                <label className="label" htmlFor={key}>
                  {label}
                </label>
                <input
                  id={key}
                  className="input"
                  type={key.endsWith('Secret') ? 'password' : 'text'}
                  autoComplete="off"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <p className="setup-note">
              Meta App 那組是讓系統<strong>自動幫你設定事件通知</strong>，以及之後連結 Facebook 粉專用的。不填也能用，但下一步就要多做手動設定。
            </p>
            {formError ? (
              <div className="alert alert-danger alerts-block" role="alert">
                {formError}
              </div>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={busy === 'app' || !Object.values(form).some(Boolean)}>
              {busy === 'app' ? '儲存中…' : '儲存'}
            </button>
          </form>
        </Step>

        <Step n={4} title="在 Meta 允許登入回到你的工具" done={done[4]} open={current === 4} onToggle={() => toggle(4)}>
          <p>Meta 只會把登入結果送回「事先登記過的網址」，所以要把你的工具網址登記上去，並把你的 IG 帳號加為測試人員。</p>
          <ol>
            <li>
              在 Instagram 登入設定頁找到「Set up Instagram business login」（設定 Instagram 商家登入）&gt;「Business login settings」，在 <strong>OAuth redirect URIs</strong>（重新導向網址）貼上：
              <CopyBox label="Instagram 重新導向網址" value={status.redirectUris.instagram} />
              按儲存。
            </li>
            <li>
              左側「應用程式角色」&gt;「角色」&gt; 新增 <strong>Instagram 測試人員</strong>，輸入你的 IG 帳號名稱。接著用電腦打開 Instagram 網頁版：設定 &gt; 應用程式和網站 &gt; 測試人員邀請，按<strong>接受</strong>。
              <div className="btn-row">
                <a className="btn btn-outline btn-sm" href="https://www.instagram.com/accounts/manage_access/" target="_blank" rel="noreferrer">
                  打開 Instagram 接受邀請
                </a>
              </div>
            </li>
          </ol>
          <Help>
            App 還在「開發模式」時，只有加進 App 角色的帳號能登入。「測試人員邀請」如果是空的，可能邀請還沒送到，等一分鐘重新整理；或回 Meta 確認帳號名稱沒打錯。
          </Help>
          <label className="setup-check">
            <input type="checkbox" checked={Boolean(checks.redirectSet)} onChange={() => toggleCheck('redirectSet')} />
            網址貼好、邀請也接受了
          </label>
        </Step>

        <Step n={5} title="連結 Instagram" done={done[5]} open={current === 5} onToggle={() => toggle(5)}>
          {status.instagram ? (
            <div className="setup-connected">
              <strong>已連結：@{status.instagram.username ?? '（未知）'}</strong>
              <span>{status.instagram.subscribed ? '事件通知已訂閱' : '事件通知尚未訂閱'}</span>
            </div>
          ) : (
            <p>按下按鈕會跳到 Instagram，登入你的帳號、按「允許」，就會自動回到這裡。</p>
          )}
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={!appDone || busy === 'instagram'} onClick={() => startConnect('instagram')}>
              {busy === 'instagram' ? '前往 Instagram…' : status.instagram ? '重新連結 Instagram' : '連結 Instagram'}
            </button>
          </div>
          {!appDone ? <p className="setup-note">請先完成第 3 步（填入 Instagram App ID 與 Secret）。</p> : null}
          <Help>
            <ul>
              <li>出現「Invalid redirect_uri」：第 4 步的網址沒貼到，或貼到別的欄位。</li>
              <li>出現「Insufficient developer role」或無法登入：第 4 步的測試人員邀請還沒接受。</li>
              <li>連結成功但首頁沒有貼文：按首頁的「同步」再試一次。</li>
            </ul>
          </Help>
        </Step>

        <Step n={6} title="連結 Facebook 粉專" optional done={done[6]} open={current === 6} onToggle={() => toggle(6)}>
          {status.facebook ? (
            <div className="setup-connected">
              <strong>已連結：{status.facebook.name ?? '粉專'}</strong>
              <span>{status.facebook.subscribed ? '事件通知已訂閱' : '事件通知尚未訂閱'}</span>
            </div>
          ) : (
            <p>只用 Instagram 的話可以跳過這一步。要讓粉專貼文留言、Messenger 私訊也自動回覆，再做這步。</p>
          )}
          {pages.length > 0 ? (
            <div className="setup-pages">
              <strong>選擇要使用的粉專：</strong>
              {pages.map((p) => (
                <button key={p.id} type="button" className="btn btn-outline btn-sm" disabled={busy === 'page'} onClick={() => choosePage(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}
          <ol>
            <li>
              在 Meta App 後台「新增使用案例」或「新增產品」，加入 <strong>Messenger</strong>（與 Facebook 粉專互動）以及 <strong>Facebook 登入（Facebook Login for Business）</strong>。
            </li>
            <li>
              在 Facebook 登入的「設定」，<strong>有效的 OAuth 重新導向 URI</strong> 貼上：
              <CopyBox label="Facebook 重新導向網址" value={status.redirectUris.facebook} />
            </li>
            <li>確認第 3 步已填 Meta App ID 與 Secret，再按下方按鈕，登入並勾選你的粉專。</li>
          </ol>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={!metaDone || busy === 'facebook'} onClick={() => startConnect('facebook')}>
              {busy === 'facebook' ? '前往 Facebook…' : status.facebook ? '重新連結 Facebook' : '連結 Facebook 粉專'}
            </button>
          </div>
          {!metaDone ? <p className="setup-note">請先在第 3 步填入 Meta App ID 與 Secret。</p> : null}
          <Help>
            <ul>
              <li>
                找不到「有效的 OAuth 重新導向 URI」：在 Meta 後台最上方的搜尋框輸入 <strong>OAuth</strong>，選「Facebook 登入」的設定。如果搜不到，代表還沒加入 Facebook 登入，先到「使用案例」新增「使用 Facebook 登入驗證並要求用戶資料」。
              </li>
              <li>
                Meta 後台的「Webhooks」頁面（回呼網址、驗證權杖）<strong>不用自己填</strong>，連結成功後系統會自動設定。只有當這個精靈出現「事件通知要手動設定一次」時才需要。
              </li>
              <li>授權畫面要勾選你的粉專，並允許所有權限；少勾一項，留言或私訊可能收不到。連結後粉專名稱會顯示在首頁上方。</li>
            </ul>
          </Help>
        </Step>

        {webhookProblem ? (
          <div className="card setup-manual">
            <h2 className="card-title">事件通知要手動設定一次</h2>
            <p>系統沒能自動幫你設定（原因：{status.webhook.instagram !== 'ok' ? status.webhook.instagram : status.webhook.page}）。請到 Meta App 後台的 Webhooks（事件通知）設定，貼上：</p>
            <CopyBox label="回呼網址（Callback URL）" value={status.callbackUrl} />
            <CopyBox label="驗證權杖（Verify token）" value={status.verifyToken} />
            <p>
              Instagram 訂閱：comments、messages、messaging_postbacks、messaging_referral。
              <br />
              Facebook 粉專（Page）訂閱：feed、messages、messaging_postbacks、messaging_referrals。
            </p>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy === 'webhook'} onClick={retryWebhooks}>
              {busy === 'webhook' ? '重試中…' : '改好了，再自動設定一次'}
            </button>
          </div>
        ) : null}

        <Step n={7} title="建立第一條自動回覆規則" done={done[7]} open={current === 7} onToggle={() => toggle(7)}>
          <p>帳號連好了，接著告訴系統「誰說了什麼，就自動回什麼」。挑一個開始：</p>
          <div className="setup-choices">
            <Link className="setup-choice" to="/">
              <strong>某一篇貼文的留言</strong>
              <span>到首頁點那篇貼文，設定關鍵字與私訊內容</span>
            </Link>
            <Link className="setup-choice" to="/automations/new?scope=account_default">
              <strong>所有貼文都套用</strong>
              <span>任何貼文有人留關鍵字就私訊</span>
            </Link>
            <Link className="setup-choice" to="/automations/new?scope=dm_keyword">
              <strong>私訊關鍵字</strong>
              <span>有人私訊特定字就自動回覆</span>
            </Link>
          </div>
        </Step>

        <div className="card setup-live">
          <h2 className="card-title">要讓所有粉絲都能觸發（上線）</h2>
          <p>
            App 在「開發模式」時，只有加進 App 角色的帳號留言才會觸發，適合先用小帳號測試。測好後到 Meta App 後台：
          </p>
          <ol>
            <li>
              「應用程式設定 &gt; 基本資料」的<strong>隱私政策網址</strong>貼上：
              <CopyBox label="隱私權政策網址" value={privacyUrl()} />
            </li>
            <li>把 App 從「開發」切換成「上線」（Live）。</li>
            <li>請一位沒有加進 App 的朋友留言測試。有收到私訊就完成；沒收到代表 Meta 要求先送審（App Review），可以把錯誤畫面截圖給協助你的人。</li>
          </ol>
        </div>
      </div>
    </>
  );
}
