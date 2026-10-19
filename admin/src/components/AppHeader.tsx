// 共用導覽（Sean 版改版：左側欄）。桌面版固定在左邊；窄螢幕變成頂端列＋抽屜。
// 內容：品牌、「新增自動化」選單、頁面導覽、功能導覽、帳號與登出。也負責掛上第一次登入的功能導覽。
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { apiGet, apiPost, type ApiError, setToken } from '../api/client';
import { GuidedTour, openTour } from './GuidedTour';
import { BearMark } from './Illustrations';

const NEW_OPTIONS = [
  { scope: 'account_default', title: '所有貼文都套用', desc: '任何貼文有人留關鍵字就私訊（可分平台）' },
  { scope: 'next_post', title: '下一篇新貼文', desc: '新貼文一上線自動接上，第一則留言也不漏' },
  { scope: 'dm_keyword', title: '私訊關鍵字', desc: '有人私訊特定字就自動回覆' },
  { scope: 'ref', title: '廣告或 ig.me 連結', desc: '從「傳送訊息」廣告或帶參數的連結開啟對話時回覆' },
] as const;

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV = [
  { to: '/', label: '首頁', end: true, d: 'M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z' },
  { to: '/contacts', label: '名單', end: false, d: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8' },
  { to: '/setup', label: '設定精靈', end: false, d: 'M9 11l2 2 4-4M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' },
  { to: '/account', label: '帳號設定', end: false, d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
];

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    apiGet<{ email: string }>('/api/admin/auth/me')
      .then((r) => setEmail(r.email))
      .catch(() => setEmail(''));
  }, []);

  // 換頁時收起抽屜與選單。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawer(false);
    setNewOpen(false);
  }, [location.pathname]);

  // session 過期自動登出：每 5 分鐘＋分頁重新取得焦點時檢查一次，
  // 過期（401）就導回登入頁——避免頁面停留在過期的舊資料上，操作看似沒反應。
  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        await apiGet('/api/admin/auth/me');
      } catch (e) {
        if (!cancelled && (e as ApiError).status === 401) navigate('/login?expired=1');
      }
    }
    const timer = setInterval(checkSession, 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [navigate]);

  async function logout() {
    try {
      await apiPost('/api/admin/auth/logout', {});
    } catch {
      /* ignore */
    }
    setToken(null);
    navigate('/login');
  }

  const pop = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -6, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -4, scale: 0.98 },
      };

  const panel = (
    <>
      <NavLink to="/" className="side-brand">
        <BearMark size={30} />
        <span>
          IG／FB 自動私訊
          <small>{email || '　'}</small>
        </span>
      </NavLink>

      <div className="side-new">
        <button type="button" className="btn btn-primary btn-block" aria-expanded={newOpen} onClick={() => setNewOpen((v) => !v)}>
          新增自動回覆
        </button>
        <AnimatePresence>
          {newOpen ? (
            <motion.div className="side-pop" {...pop} transition={{ type: 'spring', stiffness: 520, damping: 36 }}>
              {NEW_OPTIONS.map((o) => (
                <button key={o.scope} type="button" onClick={() => navigate(`/automations/new?scope=${o.scope}`)}>
                  <strong>{o.title}</strong>
                  <span>{o.desc}</span>
                </button>
              ))}
              <p className="side-pop-note">單一貼文的規則：到首頁點那篇貼文設定。</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <nav className="side-nav" aria-label="主要導覽">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link${isActive ? ' is-active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive ? <motion.span layoutId="side-active" className="side-link-bg" transition={{ type: 'spring', stiffness: 500, damping: 40 }} /> : null}
                <Icon d={n.d} />
                <span>{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" className="side-link" onClick={openTour}>
          <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
          <span>功能導覽</span>
        </button>
      </nav>

      <div className="side-foot">
        <button type="button" className="side-link" onClick={logout}>
          <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          <span>登出</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="app-sidebar">{panel}</aside>

      <header className="app-topbar">
        <NavLink to="/" className="side-brand is-compact">
          <BearMark size={26} />
          <span>IG／FB 自動私訊</span>
        </NavLink>
        <button type="button" className="topbar-menu" aria-label="打開選單" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <AnimatePresence>
        {drawer ? (
          <>
            <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside
              className="app-drawer"
              initial={reduce ? false : { x: '-100%' }}
              animate={{ x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            >
              {panel}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <GuidedTour autoOpen />
    </>
  );
}
