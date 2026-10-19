// Sean 版改版：手繪線條風插圖（原創）。主角是一隻小熊（熊恩），用一致的墨線粗細與圓角收尾，
// 填色只用 tokens.css 的粉彩色票，深淺模式都清楚。純裝飾，一律 aria-hidden。
type Props = { className?: string; size?: number };

const ink = 'var(--ink)';
const stroke = { stroke: ink, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const line = { ...stroke, fill: 'none' };
const paper = 'var(--color-surface)';

function Frame({ children, className, size = 160 }: Props & { children: React.ReactNode }) {
  return (
    <svg className={className} width={size} height={(size * 3) / 4} viewBox="0 0 160 120" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

// 小熊的頭（多張插圖共用）
function BearHead({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="-17" cy="-17" r="8" fill={paper} {...stroke} />
      <circle cx="17" cy="-17" r="8" fill={paper} {...stroke} />
      <circle cx="-17" cy="-17" r="3.2" fill="var(--pastel-berry)" stroke="none" />
      <circle cx="17" cy="-17" r="3.2" fill="var(--pastel-berry)" stroke="none" />
      <ellipse cx="0" cy="0" rx="24" ry="22" fill={paper} {...stroke} />
      <circle cx="-8.5" cy="-3" r="2.1" fill={ink} />
      <circle cx="8.5" cy="-3" r="2.1" fill={ink} />
      <ellipse cx="0" cy="7" rx="8.5" ry="6.5" fill="var(--paper-deep)" {...stroke} strokeWidth={2} />
      <path d="M-2.6 4.6 Q0 3.4 2.6 4.6 Q0 7.4 -2.6 4.6Z" fill={ink} stroke="none" />
      <path d="M-3.4 9.6 Q0 12 3.4 9.6" {...line} strokeWidth={1.8} />
      <ellipse cx="-15" cy="6" rx="3.6" ry="2.2" fill="var(--pastel-berry)" opacity="0.8" />
      <ellipse cx="15" cy="6" rx="3.6" ry="2.2" fill="var(--pastel-berry)" opacity="0.8" />
    </g>
  );
}

export function BearWave(p: Props) {
  return (
    <Frame {...p}>
      {/* 身體 */}
      <path d="M58 118 Q56 84 80 80 Q104 84 102 118" fill={paper} {...stroke} />
      {/* 揮手的手 */}
      <path d="M100 92 Q114 82 116 62" {...line} />
      <circle cx="116" cy="58" r="6" fill={paper} {...stroke} />
      <path d="M124 48 q4 -2 6 2 M126 58 q4 0 5 4" {...line} strokeWidth={2} />
      {/* 拿手機的手 */}
      <rect x="40" y="86" width="16" height="26" rx="4" fill="var(--pastel-sky)" {...stroke} />
      <path d="M44 92 h8 M44 97 h6" {...line} strokeWidth={1.8} />
      <path d="M62 96 Q56 100 54 104" {...line} />
      <BearHead x={80} y={58} />
    </Frame>
  );
}

export function CommentToDm(p: Props) {
  return (
    <Frame {...p}>
      {/* 留言泡泡 */}
      <path d="M14 30 h52 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-30 l-12 10 v-10 h-10 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10z" fill="var(--pastel-berry)" {...stroke} />
      <path d="M22 44 h40 M22 54 h26" {...line} strokeWidth={2} />
      {/* 弧線箭頭 */}
      <path d="M72 82 Q92 100 108 82" {...line} strokeDasharray="1 7" />
      <path d="M102 80 l7 1 l-1 7" {...line} />
      {/* 信封 */}
      <rect x="92" y="28" width="58" height="40" rx="6" fill={paper} {...stroke} />
      <path d="M94 32 L121 52 L148 32" {...line} />
      <path d="M121 58 c-4 -5 -11 -1 -7 4 l7 6 l7 -6 c4 -5 -3 -9 -7 -4z" fill="var(--pastel-peach)" {...stroke} strokeWidth={2} />
    </Frame>
  );
}

export function StoryReply(p: Props) {
  return (
    <Frame {...p}>
      <circle cx="58" cy="58" r="40" fill="none" stroke="var(--pastel-peach)" strokeWidth={6} strokeDasharray="22 8" strokeLinecap="round" />
      <circle cx="58" cy="58" r="32" fill="var(--pastel-butter)" {...stroke} />
      <BearHead x={58} y={66} s={0.85} />
      <path d="M106 26 h38 a8 8 0 0 1 8 8 v14 a8 8 0 0 1 -8 8 h-24 l-10 8 v-8 h-4 a8 8 0 0 1 -8 -8 v-14 a8 8 0 0 1 8 -8z" fill="var(--pastel-sky)" {...stroke} />
      <circle cx="116" cy="41" r="2.4" fill={ink} />
      <circle cx="125" cy="41" r="2.4" fill={ink} />
      <circle cx="134" cy="41" r="2.4" fill={ink} />
    </Frame>
  );
}

export function KeywordChat(p: Props) {
  return (
    <Frame {...p}>
      <path d="M12 22 h62 a10 10 0 0 1 10 10 v16 a10 10 0 0 1 -10 10 h-44 l-12 10 v-10 h-6 a10 10 0 0 1 -10 -10 v-16 a10 10 0 0 1 10 -10z" fill={paper} {...stroke} />
      <rect x="22" y="33" width="34" height="14" rx="7" fill="var(--pastel-butter)" {...stroke} strokeWidth={2} />
      <path d="M62 40 h12" {...line} strokeWidth={2} />
      <path d="M148 58 h-62 a10 10 0 0 0 -10 10 v16 a10 10 0 0 0 10 10 h44 l12 10 v-10 h6 a10 10 0 0 0 10 -10 v-16 a10 10 0 0 0 -10 -10z" fill="var(--pastel-sage)" {...stroke} />
      <path d="M90 72 h40 M90 81 h26" {...line} strokeWidth={2} />
      {/* 閃一下的小星 */}
      <path d="M118 22 v12 M112 28 h12" {...line} strokeWidth={2} />
    </Frame>
  );
}

export function SetupChecklist(p: Props) {
  return (
    <Frame {...p}>
      <rect x="40" y="16" width="70" height="96" rx="10" fill={paper} {...stroke} />
      <rect x="60" y="10" width="30" height="14" rx="5" fill="var(--pastel-sky)" {...stroke} strokeWidth={2} />
      {[40, 62, 84].map((y, i) => (
        <g key={y}>
          <rect x="52" y={y} width="14" height="14" rx="4" fill={i < 2 ? 'var(--pastel-sage)' : paper} {...stroke} strokeWidth={2} />
          {i < 2 ? <path d={`M55 ${y + 7.5} l3 3 l6 -6`} {...line} strokeWidth={2} /> : null}
          <path d={`M74 ${y + 7} h26`} {...line} strokeWidth={2} />
        </g>
      ))}
      {/* 熊掌 */}
      <g transform="translate(124 86)">
        <ellipse cx="0" cy="6" rx="13" ry="11" fill="var(--pastel-peach)" {...stroke} />
        <circle cx="-11" cy="-9" r="4.4" fill="var(--pastel-peach)" {...stroke} strokeWidth={2} />
        <circle cx="-2" cy="-14" r="4.4" fill="var(--pastel-peach)" {...stroke} strokeWidth={2} />
        <circle cx="8" cy="-12" r="4.4" fill="var(--pastel-peach)" {...stroke} strokeWidth={2} />
      </g>
    </Frame>
  );
}

export function BearMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-30 -30 60 60" aria-hidden="true" focusable="false">
      <BearHead x={0} y={4} s={0.95} />
    </svg>
  );
}
