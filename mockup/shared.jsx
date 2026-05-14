// shared.jsx — EVM Studio dashboard: tokens, mock data, atoms, chart primitives.
// Globals are written to window so other Babel scripts can use them.

// One-time CSS injection
if (typeof document !== 'undefined' && !document.getElementById('evm-styles')) {
  const s = document.createElement('style');
  s.id = 'evm-styles';
  s.textContent = `
    .evm-gantt-row:hover { background: #f3f1e8 !important; }
    .evm-project-btn:hover { background: rgba(155,193,50,0.07) !important; }
    .evm-tab:hover:not(.active) { color: #1c1a16 !important; }
    .evm-btn:hover { background: rgba(155,193,50,0.12) !important; border-color: #9bc132 !important; }
    .evm-icon-btn:hover { background: rgba(0,0,0,0.05) !important; color: #1c1a16 !important; }
    .evm-chip { transition: background .12s, border-color .12s, color .12s; }
    .evm-chip:hover { background: #efebde !important; }
    .evm-chip.active { background: rgba(155,193,50,0.16) !important; border-color: #7ea61f !important; color: #7ea61f !important; }
    .evm-popover { animation: evmPop .12s ease-out; transform-origin: top right; }
    @keyframes evmPop { from { opacity: 0; transform: scale(0.96) translateY(-4px) } to { opacity: 1; transform: none } }
    .evm-assignee-row:hover { background: rgba(155,193,50,0.06) !important; }
  `;
  document.head.appendChild(s);
}

const EVM = {
  ink:       '#1c1a16',
  ink2:      '#4a463d',
  ink3:      '#827d70',
  ink4:      '#b1ab9d',
  rule:      '#e4dfd2',
  ruleSoft:  '#efebde',
  paper:     '#f7f4ec',
  paperWarm: '#fbf9f2',
  card:      '#ffffff',
  brand:     '#9bc132',          // Prime Brains 黄緑
  brandDeep: '#7ea61f',
  brandSoft: '#e8f1cd',
  brandWash: 'rgba(155,193,50,0.10)',
  // status (warm-tuned, low chroma)
  ok:        '#5d8a3a',
  okSoft:    '#dfe9cf',
  warn:      '#c89a2d',
  warnSoft:  '#f3e7c4',
  crit:      '#b8482e',
  critSoft:  '#f1d5c8',
  na:        '#9a958a',
  font:      "'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  fontSerif: "'Source Serif 4', 'Source Serif Pro', 'Hiragino Mincho ProN', serif",
  fontBrand: "'Cinzel', 'Trajan Pro', 'Source Serif 4', serif",
  fontMono:  "'JetBrains Mono', ui-monospace, monospace",
};

// ── Mock data (正常運用 シナリオ) ────────────────────────────────────────
const PROJECTS = [
  { id: 1, name: '次世代UI基盤刷新 — Phase 2', code: 'NXP-002', status: 'active', members: 6, taskCount: 12 },
  { id: 2, name: '受発注ハブ統合', code: 'OHX-014', status: 'active', members: 8, taskCount: 21 },
  { id: 3, name: '社内データ可視化PoC', code: 'IDV-007', status: 'paused', members: 3, taskCount: 9 },
  { id: 4, name: 'モバイル決済モジュール v3', code: 'MPM-031', status: 'active', members: 5, taskCount: 17 },
  { id: 5, name: 'BPM ガイドライン整備', code: 'BPM-002', status: 'draft', members: 2, taskCount: 6 },
];

const BASE_DATE = '2026-05-13';

const SUMMARY = {
  bac:  48_000_000,
  pv:   28_500_000,
  ev:   27_360_000,
  ac:   26_200_000,
  spi:  0.96,
  cpi:  1.04,
  eac:  46_150_000,
  vac:  +1_850_000,
  etc:  19_950_000,
  tcpi: 0.95,
};

const MEMBERS = [
  { id: 1, name: '田中 美咲',     role: 'PM',       initials: '田美' },
  { id: 2, name: '佐藤 拓海',     role: 'Lead Eng', initials: '佐拓' },
  { id: 3, name: '鈴木 蒼一郎',   role: 'Engineer', initials: '鈴蒼' },
  { id: 4, name: '山本 楓',       role: 'Designer', initials: '山楓' },
  { id: 5, name: '中村 葵',       role: 'QA',       initials: '中葵' },
  { id: 6, name: '高橋 直樹',     role: 'Engineer', initials: '高直' },
];

const ASSIGNEES = [
  { id: 1, name: '田中 美咲',   bac: 4_800_000,  ev: 4_600_000,  pv: 4_700_000,  ac: 4_200_000,  spi: 0.98, cpi: 1.10, status: 'normal' },
  { id: 2, name: '佐藤 拓海',   bac: 12_400_000, ev: 7_640_000,  pv: 7_900_000,  ac: 7_320_000,  spi: 0.97, cpi: 1.04, status: 'normal' },
  { id: 3, name: '鈴木 蒼一郎', bac: 11_200_000, ev: 6_120_000,  pv: 6_700_000,  ac: 6_010_000,  spi: 0.91, cpi: 1.02, status: 'normal' },
  { id: 4, name: '山本 楓',     bac:  9_400_000, ev: 5_840_000,  pv: 5_660_000,  ac: 5_280_000,  spi: 1.03, cpi: 1.11, status: 'normal' },
  { id: 5, name: '中村 葵',     bac:  4_800_000, ev: 1_320_000,  pv: 1_540_000,  ac: 1_390_000,  spi: 0.86, cpi: 0.95, status: 'warning' },
  { id: 6, name: '高橋 直樹',   bac:  5_400_000, ev: 1_840_000,  pv: 2_000_000,  ac: 2_000_000,  spi: 0.92, cpi: 0.92, status: 'normal' },
];

// 1 warning alert — banner appears but not in crisis
const ALERTS = [
  { taskId: 41, taskName: '結合テスト計画書レビュー', assigneeName: '中村 葵', spi: 0.86, level: 'warning' },
];

// SPI/CPI trend (8 snapshots over ~6 weeks)
const SPI_TREND = [
  { d: '04-01', spi: 0.84, cpi: 0.97 },
  { d: '04-08', spi: 0.86, cpi: 0.99 },
  { d: '04-15', spi: 0.89, cpi: 1.00 },
  { d: '04-22', spi: 0.91, cpi: 1.01 },
  { d: '04-29', spi: 0.93, cpi: 1.02 },
  { d: '05-04', spi: 0.94, cpi: 1.03 },
  { d: '05-08', spi: 0.95, cpi: 1.04 },
  { d: '05-13', spi: 0.96, cpi: 1.04 },
];

const FEVER = {
  bufferConsumption: 0.32,
  criticalChainCompletion: 0.58,
  zone: 'GREEN',
  // history for trace
  trail: [
    { x: 0.05, y: 0.02 },
    { x: 0.18, y: 0.10 },
    { x: 0.31, y: 0.18 },
    { x: 0.42, y: 0.22 },
    { x: 0.51, y: 0.28 },
    { x: 0.58, y: 0.32 },
  ],
};

// Gantt tasks (WBS hierarchy)
// startDay/endDay = offsets within the 60-day project window (day 0 = 03-15, baseDate ≈ day 59)
const GANTT_RANGE = { startISO: '2026-03-15', endISO: '2026-06-26', totalDays: 103, baseDay: 59 };
const TASKS = [
  { id: 10, code: '1',   name: '要件定義',                level: 1, start:  0, end: 14, progress: 100, spi: 1.00, assignee: null,         leaf: false },
  { id: 11, code: '1.1', name: 'ユースケース整理',         level: 2, start:  0, end:  9, progress: 100, spi: 1.00, assignee: '田中 美咲',  leaf: true },
  { id: 12, code: '1.2', name: 'ステークホルダーレビュー', level: 2, start:  8, end: 14, progress: 100, spi: 0.95, assignee: '田中 美咲',  leaf: true },
  { id: 20, code: '2',   name: '設計',                    level: 1, start: 12, end: 38, progress:  92, spi: 0.97, assignee: null,         leaf: false },
  { id: 21, code: '2.1', name: 'アーキテクチャ設計',       level: 2, start: 12, end: 24, progress: 100, spi: 1.02, assignee: '佐藤 拓海',  leaf: true },
  { id: 22, code: '2.2', name: 'データモデル設計',         level: 2, start: 18, end: 32, progress:  95, spi: 0.93, assignee: '鈴木 蒼一郎', leaf: true },
  { id: 23, code: '2.3', name: 'UIデザインシステム整備',   level: 2, start: 20, end: 38, progress:  88, spi: 1.03, assignee: '山本 楓',    leaf: true },
  { id: 30, code: '3',   name: '実装',                    level: 1, start: 30, end: 78, progress:  46, spi: 0.95, assignee: null,         leaf: false },
  { id: 31, code: '3.1', name: 'API実装',                 level: 2, start: 30, end: 62, progress:  72, spi: 0.97, assignee: '佐藤 拓海',  leaf: true },
  { id: 32, code: '3.2', name: 'フロント実装',             level: 2, start: 36, end: 72, progress:  58, spi: 0.91, assignee: '鈴木 蒼一郎', leaf: true },
  { id: 33, code: '3.3', name: 'デザイン適用',             level: 2, start: 44, end: 78, progress:  40, spi: 1.04, assignee: '山本 楓',    leaf: true },
  { id: 40, code: '4',   name: '検証',                    level: 1, start: 60, end: 95, progress:   8, spi: 0.86, assignee: null,         leaf: false },
  { id: 41, code: '4.1', name: '結合テスト計画書レビュー', level: 2, start: 60, end: 70, progress:  18, spi: 0.86, assignee: '中村 葵',    leaf: true },
  { id: 42, code: '4.2', name: '受入テスト',               level: 2, start: 78, end: 95, progress:   0, spi: null, assignee: '高橋 直樹',  leaf: true },
  { id: 90, code: 'B',   name: 'プロジェクトバッファ',     level: 1, start: 95, end:103, progress:   0, spi: null, assignee: null,         leaf: true, buffer: true },
];

// ── Number formatters ───────────────────────────────────────────────────
const fmtYen = (n) => '¥' + (n / 1_000_000).toFixed(2) + 'M';
const fmtPct = (n) => (n * 100).toFixed(1) + '%';
const fmtNum = (n, d = 2) => n == null ? 'N/A' : n.toFixed(d);
const fmtSignedYen = (n) => (n >= 0 ? '+' : '−') + '¥' + (Math.abs(n) / 1_000_000).toFixed(2) + 'M';

const statusColor = (s) => s === 'critical' ? EVM.crit : s === 'warning' ? EVM.warn : s === 'normal' ? EVM.ok : EVM.na;
const spiTone = (spi) => spi == null ? 'na' : spi < 0.8 ? 'critical' : spi < 0.9 ? 'warning' : 'normal';

// ── Atoms ───────────────────────────────────────────────────────────────
function Card({ children, style, pad = 20, ...rest }) {
  return (
    <div
      style={{
        background: EVM.card, border: `1px solid ${EVM.rule}`,
        borderRadius: 6, padding: pad, ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, style }) {
  return (
    <div style={{
      fontFamily: EVM.font, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: EVM.ink3, fontWeight: 600, ...style,
    }}>{children}</div>
  );
}

function Pill({ tone = 'neutral', children, style }) {
  const palette = {
    neutral: { bg: EVM.paperWarm, fg: EVM.ink2, border: EVM.rule },
    brand:   { bg: EVM.brandSoft, fg: EVM.brandDeep, border: '#cee08a' },
    normal:  { bg: EVM.okSoft,    fg: EVM.ok,        border: '#cfdcb4' },
    warning: { bg: EVM.warnSoft,  fg: '#8a6c1a',     border: '#e6d29a' },
    critical:{ bg: EVM.critSoft,  fg: EVM.crit,      border: '#e0b8a6' },
    na:      { bg: EVM.paperWarm, fg: EVM.ink3,      border: EVM.rule },
  };
  const p = palette[tone] || palette.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: p.bg, color: p.fg, border: `1px solid ${p.border}`,
      fontFamily: EVM.font, letterSpacing: '0.02em', ...style,
    }}>{children}</span>
  );
}

function Dot({ tone = 'normal', size = 8 }) {
  const c = tone === 'critical' ? EVM.crit : tone === 'warning' ? EVM.warn : tone === 'normal' ? EVM.ok : EVM.na;
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: c, flex: '0 0 auto',
    }} />
  );
}

function Avatar({ initials, size = 28, tone }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: tone === 'brand' ? EVM.brandSoft : EVM.paperWarm,
      color: tone === 'brand' ? EVM.brandDeep : EVM.ink2,
      border: `1px solid ${tone === 'brand' ? '#cee08a' : EVM.rule}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, letterSpacing: '0.02em',
      fontFamily: EVM.font, flex: '0 0 auto',
    }}>{initials}</span>
  );
}

// PB brand mark — uses the user-supplied logo PNG
function BrandMark({ size = 28 }) {
  return (
    <img src="assets/prime-brains-logo.png" alt="Prime Brains"
      style={{ height: size, width: 'auto', display: 'block', opacity: 0.92 }} />
  );
}

// ── Chart: SPI/CPI trend (SVG line chart) ───────────────────────────────
function SpiTrendChart({ w = 480, h = 220, data = SPI_TREND, padTop = 14, padBottom = 28, padL = 38, padR = 14 }) {
  const [hovered, setHovered] = React.useState(null);
  const innerW = w - padL - padR;
  const innerH = h - padTop - padBottom;
  const yMin = 0.7, yMax = 1.15;
  const y = (v) => padTop + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const x = (i) => padL + (i / (data.length - 1)) * innerW;
  const yTicks = [0.8, 0.9, 1.0, 1.1];

  const path = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  const tooltip = hovered !== null ? (() => {
    const d = data[hovered];
    const tx = x(hovered);
    const tw = 138, th = 66;
    const flip = tx > w - tw - 20;
    const rx = flip ? tx - tw - 14 : tx + 14;
    const ry = Math.max(padTop + 4, Math.min(y(d.spi) - th / 2, h - padBottom - th - 4));
    return { d, tx, tw, th, rx, ry };
  })() : null;

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {/* horizontal grid */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)}
            stroke={t === 1.0 ? EVM.ink3 : EVM.ruleSoft}
            strokeWidth={1}
            strokeDasharray={t === 1.0 ? '3 3' : ''} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end"
            style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink3, fontVariantNumeric: 'tabular-nums' }}>
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {/* x labels */}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={h - padBottom + 14} textAnchor="middle"
          style={{ fontFamily: EVM.font, fontSize: 10, fill: hovered === i ? EVM.ink : EVM.ink3 }}>{d.d}</text>
      ))}
      {/* CPI line */}
      <path d={path('cpi')} fill="none" stroke={EVM.ink2} strokeWidth="1.4" strokeDasharray="4 3" />
      {data.map((d, i) => <circle key={'c'+i} cx={x(i)} cy={y(d.cpi)} r={2.4} fill={EVM.card} stroke={EVM.ink2} strokeWidth="1.4"/>)}
      {/* SPI line */}
      <path d={path('spi')} fill="none" stroke={EVM.brandDeep} strokeWidth="2" />
      {data.map((d, i) => <circle key={'s'+i} cx={x(i)} cy={y(d.spi)} r={hovered === i ? 5 : 3} fill={EVM.brandDeep} style={{ transition: 'r 0.1s' }}/>)}
      {/* latest annotation */}
      {hovered !== data.length - 1 && (
        <g>
          <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].spi)} r={6} fill="none" stroke={EVM.brandDeep} strokeWidth="1.2" opacity="0.35"/>
          <text x={x(data.length - 1) + 9} y={y(data[data.length - 1].spi) - 6}
            style={{ fontFamily: EVM.font, fontSize: 11, fontWeight: 600, fill: EVM.brandDeep, fontVariantNumeric: 'tabular-nums' }}>
            SPI {data[data.length - 1].spi.toFixed(2)}
          </text>
        </g>
      )}
      {/* Legend */}
      <g transform={`translate(${padL}, ${padTop - 6})`}>
        <line x1="0" x2="14" y1="0" y2="0" stroke={EVM.brandDeep} strokeWidth="2"/>
        <text x="18" y="3" style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink2, fontWeight: 600 }}>SPI</text>
        <line x1="50" x2="64" y1="0" y2="0" stroke={EVM.ink2} strokeWidth="1.4" strokeDasharray="4 3"/>
        <text x="68" y="3" style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink2, fontWeight: 600 }}>CPI</text>
      </g>
      {/* Invisible hit areas — vertical strips per x position */}
      {data.map((d, i) => {
        const cx = x(i);
        const colW = i === 0 || i === data.length - 1
          ? innerW / (data.length - 1) / 2
          : innerW / (data.length - 1);
        const rx = i === 0 ? cx : cx - colW / 2;
        return (
          <rect key={'hit'+i} x={rx} y={padTop} width={colW} height={innerH}
            fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}/>
        );
      })}
      {/* Tooltip */}
      {tooltip && (
        <g style={{ pointerEvents: 'none' }}>
          <line x1={tooltip.tx} x2={tooltip.tx} y1={padTop} y2={h - padBottom}
            stroke={EVM.brandDeep} strokeWidth="1" strokeDasharray="3 2" opacity="0.35"/>
          <rect x={tooltip.rx} y={tooltip.ry} width={tooltip.tw} height={tooltip.th} rx={5}
            fill={EVM.card} stroke={EVM.rule} strokeWidth="1"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.10))' }}/>
          <text x={tooltip.rx + 10} y={tooltip.ry + 15}
            style={{ fontFamily: EVM.fontMono, fontSize: 10, fill: EVM.ink3 }}>{tooltip.d.d}</text>
          <rect x={tooltip.rx + 10} y={tooltip.ry + 24} width={10} height={3} rx={1} fill={EVM.brandDeep}/>
          <text x={tooltip.rx + 24} y={tooltip.ry + 30}
            style={{ fontFamily: EVM.fontMono, fontSize: 12, fill: EVM.brandDeep, fontWeight: 700 }}>
            SPI {tooltip.d.spi.toFixed(2)}
          </text>
          <line x1={tooltip.rx + 10} x2={tooltip.rx + 20} y1={tooltip.ry + 48} y2={tooltip.ry + 48}
            stroke={EVM.ink2} strokeWidth="1.5" strokeDasharray="3 2"/>
          <text x={tooltip.rx + 24} y={tooltip.ry + 52}
            style={{ fontFamily: EVM.fontMono, fontSize: 12, fill: EVM.ink2 }}>
            CPI {tooltip.d.cpi.toFixed(2)}
          </text>
        </g>
      )}
    </svg>
  );
}

// ── Chart: CCPM Fever Chart ─────────────────────────────────────────────
function FeverChart({ w = 380, h = 280, data = FEVER, padTop = 18, padBottom = 30, padL = 40, padR = 14 }) {
  const [hovered, setHovered] = React.useState(null); // null | 'current' | number (trail index)
  const innerW = w - padL - padR;
  const innerH = h - padTop - padBottom;
  const x = (v) => padL + v * innerW;
  const y = (v) => padTop + (1 - v) * innerH;
  const green  = `${x(0)},${y(0)} ${x(1)},${y(0.67)} ${x(1)},${y(0)}`;
  const yellow = `${x(0)},${y(0)} ${x(1)},${y(1)} ${x(1)},${y(0.67)}`;
  const red    = `${x(0)},${y(0)} ${x(0)},${y(1)} ${x(1)},${y(1)}`;

  const dot = { x: data.criticalChainCompletion, y: data.bufferConsumption };
  const ticks = [0, 0.25, 0.5, 0.75, 1.0];

  const makeTooltip = (px, py, isCurrent) => {
    const tw = 148, th = isCurrent ? 74 : 60;
    const flipX = x(px) > w - tw - 20;
    const flipY = y(py) < padTop + th + 10;
    const rx = flipX ? x(px) - tw - 14 : x(px) + 14;
    const ry = flipY ? y(py) + 14 : y(py) - th - 14;
    return { rx, ry, tw, th, px, py, isCurrent };
  };

  const tooltip = hovered === 'current'
    ? makeTooltip(dot.x, dot.y, true)
    : typeof hovered === 'number'
      ? makeTooltip(data.trail[hovered].x, data.trail[hovered].y, false)
      : null;

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {/* Zones */}
      <polygon points={red}    fill={EVM.critSoft}  opacity="0.7"/>
      <polygon points={yellow} fill={EVM.warnSoft}  opacity="0.7"/>
      <polygon points={green}  fill={EVM.brandSoft} opacity="0.7"/>
      {/* axes ticks */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(0) + 4} stroke={EVM.ink3} strokeWidth="1"/>
          <text x={x(t)} y={y(0) + 16} textAnchor="middle" style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink3, fontVariantNumeric: 'tabular-nums' }}>{(t*100).toFixed(0)}%</text>
          <line x1={x(0) - 4} x2={x(0)} y1={y(t)} y2={y(t)} stroke={EVM.ink3} strokeWidth="1"/>
          <text x={x(0) - 8} y={y(t) + 3} textAnchor="end" style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink3, fontVariantNumeric: 'tabular-nums' }}>{(t*100).toFixed(0)}%</text>
        </g>
      ))}
      {/* axis lines */}
      <line x1={x(0)} x2={x(1)} y1={y(0)} y2={y(0)} stroke={EVM.ink2} strokeWidth="1"/>
      <line x1={x(0)} x2={x(0)} y1={y(0)} y2={y(1)} stroke={EVM.ink2} strokeWidth="1"/>
      {/* trail */}
      <path d={data.trail.map((p,i) => `${i?'L':'M'} ${x(p.x)} ${y(p.y)}`).join(' ')}
        fill="none" stroke={EVM.brandDeep} strokeWidth="1" strokeDasharray="2 2" opacity="0.55"/>
      {data.trail.slice(0,-1).map((p, i) => (
        <circle key={i} cx={x(p.x)} cy={y(p.y)} r={hovered === i ? 5 : 2}
          fill={EVM.brandDeep} opacity={0.35 + i * 0.1}/>
      ))}
      {/* current dot */}
      <circle cx={x(dot.x)} cy={y(dot.y)} r={11} fill={EVM.brand} opacity="0.18"/>
      <circle cx={x(dot.x)} cy={y(dot.y)} r={hovered === 'current' ? 8 : 6.5}
        fill={EVM.brandDeep} stroke={EVM.card} strokeWidth="2.5"/>
      {/* labels */}
      <text x={x(0.5)} y={h - 4} textAnchor="middle"
        style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink3, letterSpacing: '0.06em' }}>クリティカルチェーン完了率</text>
      <text x={10} y={h/2} textAnchor="middle"
        transform={`rotate(-90 10 ${h/2})`}
        style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink3, letterSpacing: '0.06em' }}>バッファ消費率</text>
      {/* zone label (hide when current dot is hovered) */}
      {hovered !== 'current' && (
        <g transform={`translate(${x(dot.x) + 14}, ${y(dot.y) - 14})`}>
          <rect x={-2} y={-12} width="68" height="20" rx="3" fill={EVM.card} stroke={EVM.brand} strokeWidth="1"/>
          <text x="32" y="2" textAnchor="middle"
            style={{ fontFamily: EVM.font, fontSize: 10, fontWeight: 600, fill: EVM.brandDeep, letterSpacing: '0.04em' }}>{data.zone}</text>
        </g>
      )}
      {/* Invisible hit areas — trail points */}
      {data.trail.slice(0,-1).map((p, i) => (
        <circle key={'hit-t'+i} cx={x(p.x)} cy={y(p.y)} r={12}
          fill="transparent" style={{ cursor: 'crosshair' }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}/>
      ))}
      {/* Invisible hit area — current dot */}
      <circle cx={x(dot.x)} cy={y(dot.y)} r={16}
        fill="transparent" style={{ cursor: 'crosshair' }}
        onMouseEnter={() => setHovered('current')}
        onMouseLeave={() => setHovered(null)}/>
      {/* Tooltip */}
      {tooltip && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={tooltip.rx} y={tooltip.ry} width={tooltip.tw} height={tooltip.th} rx={5}
            fill={EVM.card} stroke={EVM.rule} strokeWidth="1"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.10))' }}/>
          {tooltip.isCurrent && (
            <text x={tooltip.rx + 10} y={tooltip.ry + 15}
              style={{ fontFamily: EVM.font, fontSize: 10, fontWeight: 700, fill: EVM.brandDeep, letterSpacing: '0.08em' }}>
              現在 · {data.zone}
            </text>
          )}
          {!tooltip.isCurrent && (
            <text x={tooltip.rx + 10} y={tooltip.ry + 15}
              style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink3 }}>
              過去スナップショット
            </text>
          )}
          <text x={tooltip.rx + 10} y={tooltip.ry + (tooltip.isCurrent ? 35 : 32)}
            style={{ fontFamily: EVM.fontMono, fontSize: 11, fill: EVM.ink2 }}>
            CC完了　<tspan fontWeight="700" fill={EVM.ink}>{(tooltip.px * 100).toFixed(0)}%</tspan>
          </text>
          <text x={tooltip.rx + 10} y={tooltip.ry + (tooltip.isCurrent ? 55 : 50)}
            style={{ fontFamily: EVM.fontMono, fontSize: 11, fill: EVM.ink2 }}>
            BF消費　<tspan fontWeight="700" fill={EVM.ink}>{(tooltip.py * 100).toFixed(0)}%</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}

// ── Sparkline (compact SPI mini-line) ───────────────────────────────────
function Sparkline({ data = SPI_TREND.map(d => d.spi), w = 100, h = 28, color = EVM.brandDeep }) {
  if (!data.length) return null;
  const yMin = Math.min(...data, 0.8), yMax = Math.max(...data, 1.0);
  const y = (v) => 4 + (1 - (v - yMin) / (yMax - yMin || 1)) * (h - 8);
  const x = (i) => (i / (data.length - 1)) * w;
  const d = data.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.5" fill={color}/>
    </svg>
  );
}

// ── Mini Gantt ──────────────────────────────────────────────────────────
let _ganttIdCounter = 0;

function fmtDay(startISO, offset) {
  if (offset == null) return '—';
  const [y, m, d] = startISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offset);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

const GANTT_INFO_COLS = [
  { key: 'days',    label: '工数(MD)', w: 44 },
  { key: 'planned', label: '予定期間', w: 84 },
  { key: 'actual',  label: '実績期間', w: 84 },
  { key: 'pct',     label: '進捗',     w: 44 },
];
const GANTT_INFO_W = GANTT_INFO_COLS.reduce((s, c) => s + c.w, 0);

function Gantt({
  tasks = TASKS, range = GANTT_RANGE,
  width = 720, rowH = 26, labelW = 280,
  baseDate = BASE_DATE, compact = false,
  selectedTaskId = null, onTaskClick = null,
  months: monthsProp,
  startISO = null,
  showInfoCols = false,
}) {
  const gid = React.useRef(`g${++_ganttIdCounter}`).current;
  const infoW = showInfoCols ? GANTT_INFO_W : 0;
  const innerW = width - labelW - infoW;
  const dayW = innerW / range.totalDays;
  const months = monthsProp || range.months || [
    { d:  0, l: '3月' }, { d: 17, l: '4月' },
    { d: 47, l: '5月' }, { d: 78, l: '6月' },
  ];
  const baseDay = range.baseDay;

  // 雷線: 末端タスク（バッファ・完了除外）の実績進捗X座標を収集
  const baseDayX = labelW + infoW + baseDay * dayW;
  const thunderPts = [];
  tasks.forEach((t, i) => {
    if (!t.leaf || t.buffer || t.progress >= 100) return; // 完了済み・バッファは除外
    const px = labelW + infoW + (t.start + (t.end - t.start) * (t.progress / 100)) * dayW;
    const py = i * rowH + rowH / 2;
    thunderPts.push({ x: px, y: py, ahead: px >= baseDayX });
  });
  // ジグザグパス: 最初の未完了タスク行から開始し、各タスクへ伸び戻る
  let thunderPath = '';
  if (thunderPts.length > 0) {
    thunderPath = `M ${baseDayX.toFixed(1)} ${thunderPts[0].y.toFixed(1)}`;
    thunderPath += ` H ${thunderPts[0].x.toFixed(1)} H ${baseDayX.toFixed(1)}`;
    for (let j = 1; j < thunderPts.length; j++) {
      const pt = thunderPts[j];
      thunderPath += ` V ${pt.y.toFixed(1)} H ${pt.x.toFixed(1)} H ${baseDayX.toFixed(1)}`;
    }
  }
  const totalRowsH = tasks.length * rowH;

  return (
    <div style={{ fontFamily: EVM.font, fontSize: 12, color: EVM.ink2, position: 'relative' }}>
      {/* timeline header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end',
        height: 28, borderBottom: `1px solid ${EVM.rule}`,
        position: 'relative',
      }}>
        <div style={{ width: labelW, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
          <span style={{ fontSize: 10, color: EVM.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>WBS</span>
        </div>
        {showInfoCols && (
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', borderLeft: `1px solid ${EVM.rule}` }}>
            {GANTT_INFO_COLS.map(col => (
              <div key={col.key} style={{
                width: col.w, textAlign: 'right', paddingRight: 6, paddingBottom: 4,
                fontSize: 9, color: EVM.ink3, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase',
                borderRight: `1px solid ${EVM.rule}`,
              }}>{col.label}</div>
            ))}
          </div>
        )}
        <div style={{ position: 'relative', flex: '1 1 auto', height: '100%' }}>
          {months.map((m, i) => (
            <div key={i} style={{
              position: 'absolute', left: m.d * dayW, top: 0, bottom: 0,
              paddingLeft: 6, borderLeft: `1px solid ${EVM.rule}`,
              display: 'flex', alignItems: 'flex-end', paddingBottom: 4,
              fontSize: 10, color: EVM.ink3, fontWeight: 600, letterSpacing: '0.04em',
            }}>{m.l}</div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div style={{ position: 'relative' }}>
        {/* 基準日 vertical line */}
        <div style={{
          position: 'absolute', left: baseDayX, top: 0,
          bottom: 0, width: 0, borderLeft: `1px dashed rgba(91,142,193,0.45)`, zIndex: 2, pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', top: -1, left: -28, fontSize: 9,
            color: EVM.brandDeep, fontWeight: 700, letterSpacing: '0.06em',
            background: EVM.brandSoft, padding: '1px 6px', borderRadius: 3,
            border: `1px solid ${EVM.brand}`,
          }}>基準日</div>
        </div>

        {/* 雷線 (progress line) SVG overlay */}
        {thunderPath && (
          <svg style={{
            position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 3,
            overflow: 'visible',
          }} width={width} height={totalRowsH}>
            <defs>
              <clipPath id={`${gid}-clip-behind`}>
                <rect x={0} y={0} width={baseDayX} height={totalRowsH + rowH}/>
              </clipPath>
              <clipPath id={`${gid}-clip-ahead`}>
                <rect x={baseDayX} y={0} width={width} height={totalRowsH + rowH}/>
              </clipPath>
            </defs>
            {/* 遅延部分（基準日より左）: オレンジ */}
            <path d={thunderPath} fill="none"
              stroke="#d97706" strokeWidth="2.5" strokeLinejoin="miter" strokeLinecap="square"
              clipPath={`url(#${gid}-clip-behind)`} opacity="0.9"/>
            {/* 先行部分（基準日より右）: グリーン */}
            <path d={thunderPath} fill="none"
              stroke="#2d8a4e" strokeWidth="2.5" strokeLinejoin="miter" strokeLinecap="square"
              clipPath={`url(#${gid}-clip-ahead)`} opacity="0.9"/>
            {/* 各タスクの進捗点に丸 */}
            {thunderPts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3}
                fill={p.ahead ? '#2d8a4e' : '#d97706'} opacity="0.9"
                stroke={EVM.card} strokeWidth="1"/>
            ))}
          </svg>
        )}

        {tasks.map((t, i) => {
          const tone = spiTone(t.spi);
          const barColor = t.buffer ? EVM.ink4 :
            tone === 'critical' ? EVM.crit :
            tone === 'warning'  ? EVM.warn :
            tone === 'normal'   ? '#5b8ec1' : EVM.ink4;
          const fillColor = t.buffer ? 'transparent' :
            tone === 'critical' ? EVM.crit :
            tone === 'warning'  ? EVM.warn :
            tone === 'normal'   ? '#3d6f9f' : EVM.ink4;
          const left  = labelW + t.start * dayW;
          const wpx   = (t.end - t.start) * dayW;
          const fillW = wpx * (t.progress / 100);
          const selected = selectedTaskId === t.id;
          const clickable = !!onTaskClick;

          return (
            <div key={t.id}
              onClick={clickable ? () => onTaskClick(t) : undefined}
              className={clickable ? 'evm-gantt-row' : undefined}
              style={{
                display: 'flex', alignItems: 'center', height: rowH,
                borderBottom: `1px solid ${EVM.ruleSoft}`,
                background: selected ? EVM.brandWash : (i % 2 === 0 ? EVM.card : EVM.paperWarm),
                cursor: clickable ? 'pointer' : 'default',
                position: 'relative',
                outline: selected ? `1.5px solid ${EVM.brandDeep}` : 'none',
                outlineOffset: '-1.5px',
                transition: 'background 0.12s',
              }}
            >
              {selected && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                  background: EVM.brandDeep,
                }}/>
              )}
              <div style={{
                width: labelW, flex: '0 0 auto',
                paddingLeft: 4 + (t.level - 1) * 14,
                display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
              }}>
                <span style={{
                  fontFamily: EVM.fontMono, fontSize: 10, color: EVM.ink3,
                  width: 28, flex: '0 0 auto',
                }}>{t.code}</span>
                <span style={{
                  fontWeight: t.leaf ? 400 : 600, color: t.leaf ? EVM.ink2 : EVM.ink,
                  fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  flex: '1 1 auto',
                }}>{t.name}</span>
                {!compact && t.assignee && (
                  <span style={{ fontSize: 10, color: EVM.ink3, flex: '0 0 auto' }}>{t.assignee}</span>
                )}
              </div>
              {showInfoCols && (() => {
                const tone = spiTone(t.spi);
                const pctColor = t.buffer ? EVM.ink4
                  : t.progress >= 100 ? EVM.ok
                  : tone === 'critical' ? EVM.crit
                  : tone === 'warning'  ? '#8a6c1a'
                  : EVM.ink2;
                const actualStartDay = t.progress > 0 ? t.start : null;
                const actualEndDay   = t.progress >= 100 ? t.end : null;
                const plannedStr = startISO
                  ? `${fmtDay(startISO, t.start)}-${fmtDay(startISO, t.end)}`
                  : `${t.start}-${t.end}`;
                const actualStr = startISO
                  ? (actualStartDay == null ? '—'
                    : `${fmtDay(startISO, actualStartDay)}-${actualEndDay != null ? fmtDay(startISO, actualEndDay) : '…'}`)
                  : '—';
                return (
                  <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', height: '100%', borderLeft: `1px solid ${EVM.ruleSoft}` }}>
                    {/* 工数 */}
                    <div style={{ width: 44, textAlign: 'right', paddingRight: 6,
                      fontFamily: EVM.fontMono, fontSize: 10, color: EVM.ink3,
                      borderRight: `1px solid ${EVM.ruleSoft}` }}>
                      {t.buffer ? '' : `${t.end - t.start}`}
                    </div>
                    {/* 予定期間 */}
                    <div style={{ width: 84, textAlign: 'right', paddingRight: 6,
                      fontFamily: EVM.fontMono, fontSize: 10, color: EVM.ink3,
                      borderRight: `1px solid ${EVM.ruleSoft}` }}>
                      {t.buffer ? '' : plannedStr}
                    </div>
                    {/* 実績期間 */}
                    <div style={{ width: 84, textAlign: 'right', paddingRight: 6,
                      fontFamily: EVM.fontMono, fontSize: 10, color: EVM.ink3,
                      borderRight: `1px solid ${EVM.ruleSoft}` }}>
                      {t.buffer ? '' : actualStr}
                    </div>
                    {/* 進捗 */}
                    <div style={{ width: 44, textAlign: 'right', paddingRight: 6,
                      fontFamily: EVM.fontMono, fontSize: 10, fontWeight: 600,
                      color: pctColor }}>
                      {t.buffer ? '' : `${t.progress}%`}
                    </div>
                  </div>
                );
              })()}
              <div style={{ position: 'relative', flex: '1 1 auto', height: '100%' }}>
                {t.leaf || t.buffer ? (
                  <div style={{
                    position: 'absolute', left: t.start * dayW, top: (rowH - 14) / 2,
                    width: wpx, height: 14, borderRadius: 3,
                    border: `1px solid ${barColor}`,
                    background: t.buffer ?
                      `repeating-linear-gradient(135deg, ${EVM.ink4} 0 4px, ${EVM.paperWarm} 4px 8px)` :
                      `${EVM.card}`,
                    overflow: 'hidden',
                  }}>
                    {!t.buffer && (
                      <div style={{
                        width: fillW, height: '100%', background: fillColor,
                      }} />
                    )}
                  </div>
                ) : (
                  // parent: thin span line
                  <div style={{
                    position: 'absolute', left: t.start * dayW, top: rowH / 2 - 2,
                    width: wpx, height: 4,
                    background: `linear-gradient(90deg, ${EVM.ink2}, ${EVM.ink2})`,
                  }}>
                    <div style={{ position: 'absolute', left: -1, top: -3, width: 0, height: 0,
                      borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                      borderTop: `5px solid ${EVM.ink2}` }} />
                    <div style={{ position: 'absolute', right: -1, top: -3, width: 0, height: 0,
                      borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                      borderTop: `5px solid ${EVM.ink2}` }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Summary cards content (just the data row + variants) ────────────────
function SummaryStat({ label, value, sub, tone = 'neutral', big = false }) {
  const t = tone === 'critical' ? { fg: EVM.crit, bg: EVM.critSoft } :
            tone === 'warning'  ? { fg: '#8a6c1a', bg: EVM.warnSoft } :
            tone === 'normal'   ? { fg: EVM.ok,   bg: EVM.okSoft }   :
            tone === 'brand'    ? { fg: EVM.brandDeep, bg: EVM.brandSoft } :
            { fg: EVM.ink, bg: 'transparent' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{
        fontFamily: EVM.font, fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: EVM.ink3, fontWeight: 600,
      }}>{label}</div>
      <div style={{
        fontFamily: EVM.fontSerif, fontWeight: 400, color: t.fg,
        fontSize: big ? 34 : 26, lineHeight: 1.05, letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums slashed-zero',
      }}>{value}</div>
      {sub && (
        <div style={{ fontFamily: EVM.font, fontSize: 11, color: EVM.ink3 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Header bar (project selector + base date) ───────────────────────────
function ProjectHeader({ projectId = 1, variant = 'default' }) {
  const proj = PROJECTS.find(p => p.id === projectId);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 20px', borderBottom: `1px solid ${EVM.rule}`,
      background: EVM.card,
    }}>
      <BrandMark size={26}/>
      <div style={{ width: 1, height: 22, background: EVM.rule }}/>
      <div style={{ fontFamily: EVM.fontBrand, fontSize: 13, letterSpacing: '0.18em', color: EVM.ink2 }}>EVM STUDIO</div>
      <div style={{ flex: 1 }}/>
      {/* Project picker */}
      <button style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
        background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, borderRadius: 4,
        fontFamily: EVM.font, fontSize: 13, color: EVM.ink, cursor: 'pointer',
      }}>
        <Dot tone="normal" size={6}/>
        <span style={{ fontWeight: 500 }}>{proj.name}</span>
        <span style={{ color: EVM.ink3, fontSize: 11, fontFamily: EVM.fontMono }}>{proj.code}</span>
        <span style={{ marginLeft: 4, color: EVM.ink3 }}>⌄</span>
      </button>
      {/* Base date */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: EVM.paperWarm, border: `1px solid ${EVM.rule}`, borderRadius: 4,
        fontFamily: EVM.font, fontSize: 13,
      }}>
        <span style={{ fontSize: 10, color: EVM.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>基準日</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: EVM.ink }}>{BASE_DATE}</span>
        <span style={{ color: EVM.ink3 }}>📅</span>
      </div>
      {/* User avatar */}
      <Avatar initials="田美" tone="brand" size={30}/>
    </div>
  );
}

// Expose globally for other Babel scripts
Object.assign(window, {
  EVM, PROJECTS, BASE_DATE, SUMMARY, MEMBERS, ASSIGNEES, ALERTS, SPI_TREND, FEVER, GANTT_RANGE, TASKS,
  fmtYen, fmtPct, fmtNum, fmtSignedYen, statusColor, spiTone,
  Card, Eyebrow, Pill, Dot, Avatar, BrandMark,
  SpiTrendChart, FeverChart, Sparkline, Gantt, SummaryStat, ProjectHeader,
});
