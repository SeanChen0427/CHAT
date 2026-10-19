// 自動化編輯器：為某篇貼文建立/編輯留言關鍵字自動回覆。
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { apiGet, apiPost, type ApiError, apiFetch } from '../api/client';

type MatchType = 'contains_any' | 'exact_any' | 'all_comments';

interface AutomationDetail {
  automation: {
    id: string;
    name: string;
    status: string;
    applyScope?: string;
    platform?: string | null;
    matchType: MatchType;
    publicReplyEnabled: number;
    privateReplyEnabled: number;
    openingDm: string | null;
    buttonText: string | null;
    buttonUrl: string | null;
    dailyLimit: number | null;
    // Sean 版新增
    followGateEnabled?: number;
    notFollowingText?: string | null;
    recheckButtonText?: string | null;
    emailCaptureEnabled?: number;
    emailPromptText?: string | null;
    claimButtonText?: string | null;
    deliveryText?: string | null;
    tag?: string | null;
    oncePerContact?: number;
  };
  media: { id: string; mediaType: string; platform?: string } | null;
  keywords: string[];
  publicReplyVariants: string[];
}

// 新建自動化時預填的公開回覆範本（可改可刪）。
const DEFAULT_PUBLIC_REPLIES = [
  '已經私訊你囉，記得去小盒子看看 📩',
  '連結傳到你的私訊了，去收信吧！',
  '私訊已發送給你 🙌 沒收到的話檢查一下訊息邀請',
];

const ACTIVATION_REASON_TEXT: Record<string, string> = {
  keywords_required: '至少需要一個關鍵字（除非比對模式為「所有留言」）',
  at_least_one_reply_required: '至少要啟用「公開回覆」或「私訊」其中一項',
  opening_dm_required: '啟用私訊時，私訊內容不能空白',
  private_reply_required_for_story: '限動自動化必須啟用私訊（私訊是唯一動作）',
  button_url_invalid: '按鈕網址必須是 https:// 開頭的有效網址',
  token_unhealthy: '帳號授權狀態異常，請到首頁確認後再試',
  emergency_stop_active: '目前系統處於緊急停止狀態',
  automation_not_found: '找不到自動化',
  private_reply_required_for_message_trigger: '私訊關鍵字／廣告連結觸發必須啟用私訊回覆',
  private_reply_required_for_gate: '開啟「先追蹤」或「先留 Email」時必須啟用私訊（門檻是在私訊裡進行的）',
};

// Sean 版：引擎在欄位留空時使用的預設文字（顯示為 placeholder）。
const FUNNEL_DEFAULTS = {
  claimButtonText: '給我連結',
  notFollowingText: '先追蹤我，再按下面的按鈕就能拿到囉！',
  recheckButtonText: '我追蹤了',
  emailPromptText: '請直接回覆你的 Email，我把資料寄給你',
};

export function AutomationEditorPage() {
  const navigate = useNavigate();
  const { mediaId } = useParams();
  const [searchParams] = useSearchParams();
  const automationId = searchParams.get('automationId');
  // 無 mediaId 時的套用範圍：next_post（下一篇新貼文）或 account_default（全帳號預設）。
  const scopeParam = searchParams.get('scope');
  const [applyScope, setApplyScope] = useState<string>(
    mediaId ? 'media' : (scopeParam ?? 'next_post'),
  );
  // 限動模式：新建時由首頁帶 ?story=1，編輯既有時由 API 的 media.mediaType 判斷。
  const [storyMode, setStoryMode] = useState(searchParams.get('story') === '1');
  // Sean 版：私訊關鍵字／廣告連結觸發——沒有留言串，私訊是唯一動作。
  const messageMode = applyScope === 'dm_keyword' || applyScope === 'ref';
  const refMode = applyScope === 'ref';
  const noPublicReply = storyMode || messageMode;
  const initialMessageMode = scopeParam === 'dm_keyword' || scopeParam === 'ref';

  const [name, setName] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('contains_any');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [publicReplyEnabled, setPublicReplyEnabled] = useState(
    searchParams.get('story') !== '1' && !initialMessageMode,
  );
  // 新建（非限動）預填三則繁中範本；編輯既有以伺服器資料為準。
  const [variants, setVariants] = useState<string[]>(
    automationId || searchParams.get('story') === '1' || initialMessageMode ? [''] : [...DEFAULT_PUBLIC_REPLIES],
  );
  const [privateReplyEnabled, setPrivateReplyEnabled] = useState(true);
  const [openingDm, setOpeningDm] = useState('');
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  // Sean 版：領取門檻與名單
  const [followGate, setFollowGate] = useState(false);
  const [notFollowingText, setNotFollowingText] = useState('');
  const [recheckButtonText, setRecheckButtonText] = useState('');
  const [emailCapture, setEmailCapture] = useState(false);
  const [emailPromptText, setEmailPromptText] = useState('');
  const [claimButtonText, setClaimButtonText] = useState('');
  const [deliveryText, setDeliveryText] = useState('');
  const [tag, setTag] = useState('');
  const [oncePerContact, setOncePerContact] = useState(false);
  // Sean 版：不綁貼文的規則適用平台（'' = 兩個平台）。
  const [platform, setPlatform] = useState<'' | 'instagram' | 'facebook'>('');
  const [mediaPlatform, setMediaPlatform] = useState<string | null>(null);
  const gated = followGate || emailCapture;

  const [status, setStatus] = useState('draft');
  const [savedId, setSavedId] = useState<string | null>(automationId);
  const [loading, setLoading] = useState(Boolean(automationId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activationErrors, setActivationErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!automationId) return;
    try {
      const d = await apiGet<AutomationDetail>(`/api/admin/automations/${automationId}`);
      setName(d.automation.name);
      setMatchType(d.automation.matchType);
      setKeywords(d.keywords);
      setPublicReplyEnabled(d.automation.publicReplyEnabled === 1);
      setVariants(d.publicReplyVariants.length ? d.publicReplyVariants : ['']);
      setPrivateReplyEnabled(d.automation.privateReplyEnabled === 1);
      setOpeningDm(d.automation.openingDm ?? '');
      setButtonEnabled(Boolean(d.automation.buttonUrl));
      setButtonText(d.automation.buttonText ?? '');
      setButtonUrl(d.automation.buttonUrl ?? '');
      setDailyLimit(d.automation.dailyLimit != null ? String(d.automation.dailyLimit) : '');
      setStatus(d.automation.status);
      setApplyScope(d.automation.applyScope ?? 'media');
      setFollowGate(d.automation.followGateEnabled === 1);
      setNotFollowingText(d.automation.notFollowingText ?? '');
      setRecheckButtonText(d.automation.recheckButtonText ?? '');
      setEmailCapture(d.automation.emailCaptureEnabled === 1);
      setEmailPromptText(d.automation.emailPromptText ?? '');
      setClaimButtonText(d.automation.claimButtonText ?? '');
      setDeliveryText(d.automation.deliveryText ?? '');
      setTag(d.automation.tag ?? '');
      setOncePerContact(d.automation.oncePerContact === 1);
      setPlatform((d.automation.platform as 'instagram' | 'facebook' | null) ?? '');
      setMediaPlatform(d.media?.platform ?? null);
      if (d.media?.mediaType === 'STORY') {
        setStoryMode(true);
        setPublicReplyEnabled(false);
      }
    } catch (e) {
      if ((e as ApiError).status === 401) navigate('/login');
      else setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, [automationId, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function addKeyword() {
    const v = keywordDraft.trim();
    if (v && !keywords.includes(v)) setKeywords([...keywords, v]);
    setKeywordDraft('');
  }

  function payload() {
    return {
      ...(mediaId ? { instagramMediaId: mediaId } : { applyScope }),
      name: name.trim(),
      // ref 一律完全比對（廣告／連結參數不應部分命中）。
      matchType: refMode ? 'exact_any' : matchType,
      keywords: !refMode && matchType === 'all_comments' ? [] : keywords,
      // 限動、私訊類觸發沒有留言串，公開回覆一律關閉。
      publicReplyEnabled: noPublicReply ? false : publicReplyEnabled,
      publicReplyVariants: noPublicReply ? [] : variants.map((v) => v.trim()).filter(Boolean),
      privateReplyEnabled,
      openingDm: openingDm.trim(),
      // 沒勾「加上連結按鈕」就送空字串 → 後端發純文字 DM。
      buttonText: buttonEnabled ? buttonText.trim() : '',
      buttonUrl: buttonEnabled ? buttonUrl.trim() : '',
      dailyLimit: dailyLimit ? Number(dailyLimit) : undefined,
      followGateEnabled: followGate,
      notFollowingText,
      recheckButtonText,
      emailCaptureEnabled: emailCapture,
      emailPromptText,
      claimButtonText,
      deliveryText,
      tag,
      oncePerContact,
      ...(mediaId ? {} : { platform: platform || null }),
    };
  }

  // 儲存：建立用 POST、更新用 PATCH。
  async function handleSave() {
    setError(null);
    setNotice(null);
    setActivationErrors([]);
    if (!name.trim()) {
      setError('請輸入自動化名稱');
      return;
    }
    setBusy(true);
    try {
      let id = savedId;
      if (id) {
        await patch(`/api/admin/automations/${id}`, payload());
      } else {
        const created = await apiPost<{ id: string }>('/api/admin/automations', payload());
        id = created.id;
        setSavedId(id);
      }
      setNotice('已儲存 ✓');
    } catch (e) {
      if ((e as ApiError).status === 401) {
        navigate('/login');
        return;
      }
      setError((e as ApiError).message ?? '儲存失敗');
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate() {
    if (!savedId) {
      setError('請先儲存再啟用');
      return;
    }
    setBusy(true);
    setError(null);
    setActivationErrors([]);
    try {
      await apiPost(`/api/admin/automations/${savedId}/activate`, {});
      setStatus('active');
      setNotice('已啟用 ✓');
    } catch (e) {
      const err = e as ApiError & { reasons?: string[] };
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      if (err.status === 422 && err.reasons) setActivationErrors(err.reasons);
      else setError(err.message ?? '啟用失敗');
    } finally {
      setBusy(false);
    }
  }

  async function handlePause() {
    if (!savedId) return;
    setBusy(true);
    try {
      await apiPost(`/api/admin/automations/${savedId}/pause`, {});
      setStatus('paused');
      setNotice('已暫停');
    } catch (e) {
      if ((e as ApiError).status === 401) {
        navigate('/login');
        return;
      }
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="container">
          <div className="state-note">載入中…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="container container-narrow">
        <Link to="/" className="back-link">
          ← 返回首頁
        </Link>

        <div className="status-line">
          <h1 className="page-title">
            {storyMode
              ? savedId
                ? '編輯限動自動化'
                : '設定限動自動化'
              : applyScope === 'next_post'
                ? '待命自動化：下一篇新貼文'
                : applyScope === 'account_default'
                  ? '全帳號預設自動化'
                  : applyScope === 'dm_keyword'
                    ? '私訊關鍵字自動回覆'
                    : applyScope === 'ref'
                      ? '廣告／ig.me 連結自動回覆'
                      : savedId
                    ? '編輯自動化'
                    : '設定自動化'}
          </h1>
          {applyScope === 'next_post' ? (
            <span className="badge badge-neutral">待綁定</span>
          ) : null}
          {status === 'active' ? (
            <span className="badge badge-success">啟用中</span>
          ) : status === 'paused' ? (
            <span className="badge badge-warning">已暫停</span>
          ) : (
            <span className="badge badge-neutral">草稿</span>
          )}
        </div>

        {storyMode ? (
          <p className="page-subtitle">
            有人回應這則限時動態、且訊息含關鍵字時，自動私訊指定內容。限動 24 小時後過期，自動化會自動暫停。
          </p>
        ) : applyScope === 'next_post' ? (
          <p className="page-subtitle">
            先把關鍵字與回覆設定好並啟用；下一篇發布的新貼文（含排程貼文上線）會自動接上這組自動化，連第一則留言都不會漏。
          </p>
        ) : applyScope === 'account_default' ? (
          <p className="page-subtitle">
            沒有專屬自動化的貼文都會套用這組設定（每個平台各一組）。個別貼文另外設定的自動化優先於此預設。
          </p>
        ) : applyScope === 'dm_keyword' ? (
          <p className="page-subtitle">
            有人私訊你、內容含關鍵字時自動回覆。只回覆主動私訊你的人，不會主動私訊任何人。
          </p>
        ) : applyScope === 'ref' ? (
          <p className="page-subtitle">
            有人點「傳送訊息」廣告，或點 ig.me/m/你的帳號?ref=代碼 這種連結開啟對話時自動回覆。下方填連結中 ref= 後面的代碼，或廣告編號。
          </p>
        ) : null}

        {error || activationErrors.length || notice ? (
          <div className="alerts-block">
            {error ? <div className="alert alert-danger">{error}</div> : null}
            {activationErrors.length ? (
              <div className="alert alert-danger">
                無法啟用：
                <ul className="alert-list">
                  {activationErrors.map((r) => (
                    <li key={r}>{ACTIVATION_REASON_TEXT[r] ?? r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {notice ? <div className="alert alert-success">{notice}</div> : null}
          </div>
        ) : null}

        <div className="card">
          {/* 基本 */}
          <div className="form-section">
            <div className="form-field">
              <label className="label" htmlFor="name">自動化名稱</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：AI 懶人包自動回覆" />
            </div>
            {!mediaId && !storyMode ? (
              <div className="form-field">
                <label className="label" htmlFor="platform">適用平台</label>
                <select
                  id="platform"
                  className="select"
                  value={platform}
                  disabled={applyScope === 'account_default' && Boolean(savedId)}
                  onChange={(e) => setPlatform(e.target.value as '' | 'instagram' | 'facebook')}
                >
                  <option value="">Instagram 和 Facebook</option>
                  <option value="instagram">只有 Instagram</option>
                  <option value="facebook">只有 Facebook</option>
                </select>
                {applyScope === 'account_default' && savedId ? (
                  <p className="field-help">全帳號預設建立後不能改平台；要換平台請另外新增一組。</p>
                ) : null}
              </div>
            ) : mediaPlatform === 'facebook' ? (
              <div className="form-field">
                <p className="field-help">
                  <span className="platform-tag is-fb is-inline contact-platform">FB</span>
                  這是 Facebook 粉專貼文：私訊會從粉專的 Messenger 送出。
                </p>
              </div>
            ) : null}
            {refMode ? null : (
            <div className="form-field">
              <label className="label" htmlFor="match">比對模式</label>
              <select id="match" className="select" value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)}>
                <option value="contains_any">包含任一關鍵字</option>
                <option value="exact_any">完全等於任一關鍵字</option>
                {messageMode ? null : <option value="all_comments">所有留言都觸發</option>}
              </select>
            </div>
            )}

            {refMode || matchType !== 'all_comments' ? (
              <div className="form-field">
                <label className="label">{refMode ? '連結代碼或廣告編號' : '關鍵字'}</label>
                <div className="chips">
                  {keywords.map((k) => (
                    <span className="chip" key={k}>
                      {k}
                      <button type="button" onClick={() => setKeywords(keywords.filter((x) => x !== k))} aria-label="移除">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  className="input"
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  onBlur={addKeyword}
                  placeholder={refMode ? '輸入代碼後按 Enter' : '輸入關鍵字後按 Enter'}
                />
                <p className="field-help">
                  {refMode
                    ? '連結是 ig.me/m/你的帳號?ref=fall_ad 就填 fall_ad；也可以填「傳送訊息」廣告的廣告編號。必須完全相同才會觸發。'
                    : applyScope === 'dm_keyword'
                      ? '私訊（正規化後）符合任一關鍵字即自動回覆。大小寫、全形半形、繁簡體會自動互通。'
                      : storyMode
                        ? '限動回應（正規化後）符合任一關鍵字即觸發私訊。大小寫、全形半形、繁簡體會自動互通。'
                        : '留言（正規化後）符合任一關鍵字即觸發。大小寫、全形半形、繁簡體會自動互通（寫繁體，簡體留言也會觸發）。'}
                </p>
              </div>
            ) : null}
          </div>

          {/* 公開回覆（限動、私訊類觸發沒有留言串，整區隱藏） */}
          {noPublicReply ? null : (
          <div className="form-section">
            <div className="toggle-row">
              <input id="pub" type="checkbox" checked={publicReplyEnabled} onChange={(e) => setPublicReplyEnabled(e.target.checked)} />
              <label htmlFor="pub">啟用公開回覆（在留言底下公開回一則）</label>
            </div>
            {publicReplyEnabled ? (
              <>
                {variants.map((v, i) => (
                  <div className="variant-row" key={i}>
                    <input className="input" value={v} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`公開回覆版本 ${i + 1}（例如：已私訊你囉 📩）`} />
                    {variants.length > 1 ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>
                        移除
                      </button>
                    ) : null}
                  </div>
                ))}
                {variants.length < 5 ? (
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setVariants([...variants, ''])}>
                    ＋ 新增版本
                  </button>
                ) : null}
                <p className="field-help">多個版本會隨機挑一則回覆，最多 5 個。</p>
              </>
            ) : null}
          </div>
          )}

          {/* 私訊 */}
          <div className="form-section">
            <div className="toggle-row">
              <input id="dm" type="checkbox" checked={privateReplyEnabled} onChange={(e) => setPrivateReplyEnabled(e.target.checked)} />
              <label htmlFor="dm">{messageMode ? '啟用私訊回覆' : '啟用私訊（私訊留言者一則訊息）'}</label>
            </div>
            {privateReplyEnabled ? (
              <>
                <div className="form-field">
                  <label className="label" htmlFor="odm">{gated ? '第一則私訊（會附上「領取」按鈕）' : '私訊內容'}</label>
                  <textarea id="odm" className="textarea" value={openingDm} onChange={(e) => setOpeningDm(e.target.value)} placeholder="這是影片中介紹的資料：&#10;https://..." />
                  <p className="field-help">
                    {gated
                      ? '對方按下領取按鈕後，才會檢查追蹤／索取 Email，全部通過才送出下方的交付訊息與連結。'
                      : '系統只會發這一則私訊。連結可以直接貼在文字裡。'}
                  </p>
                </div>

                <div className="toggle-row">
                  <input id="btn" type="checkbox" checked={buttonEnabled} onChange={(e) => setButtonEnabled(e.target.checked)} />
                  <label htmlFor="btn">{gated ? '交付訊息加上連結按鈕（選填）' : '加上可點擊的連結按鈕（選填）'}</label>
                </div>
                {buttonEnabled ? (
                  <>
                    <p className="field-help is-tight">
                      IG 私訊裡純文字的連結不一定可點；加按鈕能保證有一個可點擊的連結。
                    </p>
                    <div className="form-field">
                      <label className="label" htmlFor="btntext">按鈕文字</label>
                      <input id="btntext" className="input" value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="打開資料" />
                    </div>
                    <div className="form-field">
                      <label className="label" htmlFor="btnurl">按鈕網址（https:// 開頭）</label>
                      <input id="btnurl" className="input" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://..." />
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>

          {/* Sean 版：領取門檻與名單 */}
          {privateReplyEnabled ? (
            <details className="form-section advanced" open={gated || Boolean(tag) || oncePerContact}>
              <summary className="form-section-title">進階（選用）：先追蹤、先留 Email、標籤、每人一次</summary>
              <div className="toggle-row">
                <input id="fg" type="checkbox" checked={followGate} onChange={(e) => setFollowGate(e.target.checked)} />
                <label htmlFor="fg">要先追蹤才給（僅 Instagram；Facebook 無法查詢追蹤狀態，會直接放行）</label>
              </div>
              {followGate ? (
                <>
                  <div className="form-field">
                    <label className="label" htmlFor="nft">沒追蹤時的訊息</label>
                    <textarea id="nft" className="textarea" value={notFollowingText} onChange={(e) => setNotFollowingText(e.target.value)} placeholder={FUNNEL_DEFAULTS.notFollowingText} />
                  </div>
                  <div className="form-field">
                    <label className="label" htmlFor="rbt">重新檢查按鈕文字</label>
                    <input id="rbt" className="input" maxLength={20} value={recheckButtonText} onChange={(e) => setRecheckButtonText(e.target.value)} placeholder={FUNNEL_DEFAULTS.recheckButtonText} />
                  </div>
                </>
              ) : null}

              <div className="toggle-row">
                <input id="ec" type="checkbox" checked={emailCapture} onChange={(e) => setEmailCapture(e.target.checked)} />
                <label htmlFor="ec">要先留 Email 才給</label>
              </div>
              {emailCapture ? (
                <div className="form-field">
                  <label className="label" htmlFor="ept">索取 Email 的訊息</label>
                  <textarea id="ept" className="textarea" value={emailPromptText} onChange={(e) => setEmailPromptText(e.target.value)} placeholder={FUNNEL_DEFAULTS.emailPromptText} />
                  <p className="field-help">對方直接回覆 Email 即可；已經留過 Email 的人不會再被問。</p>
                </div>
              ) : null}

              {gated ? (
                <>
                  <div className="form-field">
                    <label className="label" htmlFor="cbt">領取按鈕文字</label>
                    <input id="cbt" className="input" maxLength={20} value={claimButtonText} onChange={(e) => setClaimButtonText(e.target.value)} placeholder={FUNNEL_DEFAULTS.claimButtonText} />
                  </div>
                  <div className="form-field">
                    <label className="label" htmlFor="dlt">通過門檻後的交付訊息</label>
                    <textarea id="dlt" className="textarea" value={deliveryText} onChange={(e) => setDeliveryText(e.target.value)} placeholder="留空則沿用第一則私訊的內容" />
                    <p className="field-help">這則會附上方設定的連結按鈕。</p>
                  </div>
                  <p className="field-help">
                    為什麼要先按按鈕：Instagram 規定對方要先跟你有私訊互動，系統才查得到他有沒有追蹤你。查詢失敗時一律放行，不會卡住真心想要資料的人。
                  </p>
                </>
              ) : null}

              <div className="form-field">
                <label className="label" htmlFor="tag">自動貼標籤（選填）</label>
                <input id="tag" className="input" maxLength={40} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="例如：10月懶人包" />
                <p className="field-help">觸發的人會出現在「名單」頁，可以依標籤篩選、匯出 CSV。</p>
              </div>
              <div className="toggle-row">
                <input id="opc" type="checkbox" checked={oncePerContact} onChange={(e) => setOncePerContact(e.target.checked)} />
                <label htmlFor="opc">每人只觸發一次（同一個人再留言或再私訊不會重複送）</label>
              </div>
            </details>
          ) : null}

          {/* 進階 */}
          <div className="form-section">
            <div className="form-field">
              <label className="label" htmlFor="daily">每日觸發上限（選填）</label>
              <input id="daily" className="input" type="number" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="例如 2000" />
            </div>
          </div>

          <div className="btn-row">
            {!savedId ? <span className="field-help is-inline">先儲存才能啟用</span> : null}
            <button className="btn btn-outline" onClick={handleSave} disabled={busy}>
              {busy ? '處理中…' : '儲存'}
            </button>
            {status !== 'active' ? (
              <button className="btn btn-primary" onClick={handleActivate} disabled={busy || !savedId}>
                啟用
              </button>
            ) : (
              <button className="btn btn-danger" onClick={handlePause} disabled={busy}>
                暫停
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// PATCH helper（apiPost 只做 POST，這裡補一個 PATCH）。
async function patch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const d = (await res.json()) as { error?: string };
      if (d.error) message = d.error;
    } catch {
      /* ignore */
    }
    throw { status: res.status, message } as ApiError;
  }
  return (await res.json()) as T;
}
