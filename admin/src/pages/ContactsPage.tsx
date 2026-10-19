// Sean 版新增：聯絡人名單頁——搜尋、標籤篩選、只看有 Email、匯出 CSV、刪除（資料刪除要求）。
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { apiDelete, apiDownload, apiGet, type ApiError } from '../api/client';

interface Contact {
  igsid: string;
  platform?: string;
  username: string | null;
  name: string | null;
  email: string | null;
  tags: string[];
  isFollower: number | null;
  lastSeenAt: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ContactsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [hasEmail, setHasEmail] = useState(false);
  const [rows, setRows] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = new URLSearchParams();
  if (q.trim()) query.set('q', q.trim());
  if (tag) query.set('tag', tag);
  if (hasEmail) query.set('hasEmail', '1');
  const qs = query.toString();

  const handleError = useCallback(
    (e: unknown) => {
      if ((e as ApiError).status === 401) navigate('/login');
      else setError((e as ApiError).message);
    },
    [navigate],
  );

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ total: number; contacts: Contact[] }>(`/api/admin/contacts${qs ? `?${qs}` : ''}`);
      setRows(r.contacts);
      setTotal(r.total);
      setError(null);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [qs, handleError]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    apiGet<{ tags: Array<{ tag: string; count: number }> }>('/api/admin/contacts/tags')
      .then((r) => setTags(r.tags))
      .catch(handleError);
  }, [handleError]);

  async function remove(c: Contact) {
    const who = c.username ? `@${c.username}` : '這位聯絡人';
    if (!window.confirm(`刪除 ${who} 的所有資料（名單、標籤、Email、執行紀錄中的身分）？\n用於處理資料刪除要求，刪除後無法復原。`)) return;
    try {
      await apiDelete(`/api/admin/contacts/${encodeURIComponent(c.igsid)}`);
      setNotice(`已刪除 ${who}`);
      void load();
    } catch (e) {
      handleError(e);
    }
  }

  return (
    <>
      <AppHeader />
      <div className="container page-stack">
        <div>
          <h1 className="page-title">名單</h1>
          <p className="page-subtitle">
            觸發過自動回覆的人（Instagram 與 Facebook）。留言、限動回應、私訊、按按鈕都會記錄；自動化設定的標籤會貼在這裡。
          </p>
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}
        {notice ? <div className="alert alert-success">{notice}</div> : null}

        <div className="card contacts-filters">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋帳號、名稱、Email"
            aria-label="搜尋"
          />
          <select className="select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="標籤">
            <option value="">全部標籤</option>
            {tags.map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.tag}（{t.count}）
              </option>
            ))}
          </select>
          <div className="toggle-row">
            <input id="he" type="checkbox" checked={hasEmail} onChange={(e) => setHasEmail(e.target.checked)} />
            <label htmlFor="he">只看有 Email</label>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              apiDownload(`/api/admin/contacts/export.csv${qs ? `?${qs}` : ''}`, 'contacts.csv').catch((e) => {
                if ((e as ApiError).status === 401) navigate('/login');
                else setError('匯出失敗，請稍後再試。');
              })
            }
          >
            匯出 CSV
          </button>
        </div>

        <div className="table-wrap">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>帳號</th>
                  <th>名稱</th>
                  <th>Email</th>
                  <th>標籤</th>
                  <th>追蹤</th>
                  <th>最後互動</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="cell-muted">載入中…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="cell-muted">
                      {qs ? '沒有符合條件的人' : '還沒有人觸發自動回覆'}
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.igsid}>
                      <td className="cell-strong nowrap">
                        {c.platform === 'facebook' ? (
                          <span className="platform-tag is-fb is-inline contact-platform">FB</span>
                        ) : (
                          <span className="platform-tag is-inline contact-platform">IG</span>
                        )}
                        {c.platform === 'facebook' ? (
                          <span>{c.name ?? 'Facebook 用戶'}</span>
                        ) : c.username ? (
                          <a href={`https://www.instagram.com/${encodeURIComponent(c.username)}/`} target="_blank" rel="noreferrer">
                            @{c.username}
                          </a>
                        ) : (
                          <span className="cell-muted">尚未取得</span>
                        )}
                      </td>
                      <td className="nowrap">{c.name ?? ''}</td>
                      <td className="nowrap">{c.email ?? ''}</td>
                      <td>
                        <div className="chips">
                          {c.tags.map((t) => (
                            <span className="chip" key={t}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="nowrap">
                        {c.platform === 'facebook' ? (
                          <span className="cell-muted">不適用</span>
                        ) : c.isFollower == null ? (
                          <span className="cell-muted">未查</span>
                        ) : c.isFollower ? (
                          <span className="badge badge-success">有</span>
                        ) : (
                          <span className="badge badge-neutral">沒有</span>
                        )}
                      </td>
                      <td className="cell-muted nowrap">{fmtTime(c.lastSeenAt)}</td>
                      <td className="nowrap">
                        <button className="btn btn-ghost btn-sm" onClick={() => void remove(c)}>
                          刪除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {!loading && total > rows.length ? (
          <p className="field-help">顯示最近 {rows.length} 人，共 {total} 人。匯出 CSV 會包含全部。</p>
        ) : null}
      </div>
    </>
  );
}
