// Sean 版改版：第一次登入的功能導覽（參考 Hilos 的 guided tour）。
// 一張奶油黃卡片置中，插圖＋標題＋一句說明＋黑色膠囊按鈕，底下圓點顯示進度；左右切換用彈簧滑動。
// 看完（或按右上角關閉）記在 localStorage，之後可從側欄「功能導覽」再打開。
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { BearWave, CommentToDm, KeywordChat, SetupChecklist, StoryReply } from './Illustrations';

const DONE_KEY = 'ig_tour_done';
export const OPEN_TOUR_EVENT = 'ig:open-tour';

export function openTour() {
  window.dispatchEvent(new Event(OPEN_TOUR_EVENT));
}

const SLIDES = [
  {
    art: BearWave,
    kicker: '歡迎',
    title: '幫你自動回覆粉絲的小幫手',
    body: '有人留言、回覆限時動態、私訊你關鍵字，系統就會替你把資料或連結私訊過去，不用整天守著手機。',
    tint: 'var(--pastel-butter)',
  },
  {
    art: CommentToDm,
    kicker: '留言自動私訊',
    title: '留言「我要」，私訊馬上到',
    body: 'Instagram 與 Facebook 粉專的貼文、Reels 都可以設定關鍵字。對方一留言，就收到你準備好的訊息和連結。',
    tint: 'var(--pastel-berry)',
  },
  {
    art: StoryReply,
    kicker: '限時動態',
    title: '回覆限動也能自動接手',
    body: '粉絲回覆你的 Instagram 限時動態時自動私訊。（Facebook 粉專的限動 Meta 不提供，這項只有 Instagram。）',
    tint: 'var(--pastel-peach)',
  },
  {
    art: KeywordChat,
    kicker: '私訊關鍵字',
    title: '私訊特定字，自動回答',
    body: '例如有人私訊「價格」就回價目表、私訊「地址」就回地圖。Instagram 私訊與 Messenger 都適用。',
    tint: 'var(--pastel-sky)',
  },
  {
    art: SetupChecklist,
    kicker: '開始之前',
    title: '先花 20 分鐘連結帳號',
    body: '設定精靈會一步步帶你建立 Meta App、連結 Instagram 與粉專。每一步都有說明和複製按鈕，照著做就好。',
    tint: 'var(--pastel-sage)',
  },
];

function readDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true; // 存取不了時不要每次都跳出來
  }
}

export function GuidedTour({ autoOpen }: { autoOpen: boolean }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [[index, dir], setPage] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const show = () => {
      setPage([0, 0]);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, show);
    if (autoOpen && !readDone()) show();
    return () => window.removeEventListener(OPEN_TOUR_EVENT, show);
  }, [autoOpen]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch {
      /* 忽略 */
    }
  }, []);

  const go = useCallback(
    (next: number) => setPage(([cur]) => [Math.max(0, Math.min(SLIDES.length - 1, next)), next > cur ? 1 : -1]),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, go, close]);

  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;
  const Art = slide.art;
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.9 };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="tour-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.22 }}
          onClick={close}
        >
          <motion.div
            className="tour-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? false : { opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0, backgroundColor: slide.tint }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ ...spring, backgroundColor: { duration: reduce ? 0 : 0.35 } }}
          >
            <button type="button" className="tour-close" onClick={close} aria-label="關閉導覽">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="tour-stage">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div
                  key={index}
                  className="tour-slide"
                  custom={dir}
                  variants={{
                    enter: (d: number) => ({ x: reduce ? 0 : d * 56, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (d: number) => ({ x: reduce ? 0 : d * -56, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={spring}
                >
                  <Art className="tour-art" size={180} />
                  <p className="tour-kicker">{slide.kicker}</p>
                  <h2 id="tour-title" className="tour-title">
                    {slide.title}
                  </h2>
                  <p className="tour-body">{slide.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="tour-actions">
              {last ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    close();
                    navigate('/setup');
                  }}
                >
                  打開設定精靈
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => go(index + 1)}>
                  下一步
                </button>
              )}
              {last ? null : (
                <button type="button" className="tour-skip" onClick={close}>
                  略過導覽
                </button>
              )}
            </div>
            <div className="tour-dots" role="tablist" aria-label="導覽頁數">
              {SLIDES.map((s, i) => (
                <button
                  key={s.kicker}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`第 ${i + 1} 頁：${s.kicker}`}
                  className="tour-dot-btn"
                  onClick={() => go(i)}
                >
                  <motion.span className="tour-dot" animate={{ width: i === index ? 22 : 6, opacity: i === index ? 1 : 0.35 }} transition={spring} />
                </button>
              ))}
            </div>
            {index > 0 ? (
              <button type="button" className="tour-arrow is-prev" onClick={() => go(index - 1)} aria-label="上一頁">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
            {!last ? (
              <button type="button" className="tour-arrow is-next" onClick={() => go(index + 1)} aria-label="下一頁">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
