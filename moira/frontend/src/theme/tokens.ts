// warm-light design tokens — ported from mockup/shared.jsx (the EVM object,
// 24-50), the user-designated visual language. Single palette for all 5 Moira
// surfaces (UI-DESIGN-BRIEF §1 "テーマ").

export const EVM = {
  // ink (text / foreground)
  ink: '#1c1a16',
  ink2: '#4a463d',
  ink3: '#827d70',
  ink4: '#b1ab9d',

  // background & lines
  rule: '#e4dfd2',
  ruleSoft: '#efebde',
  paper: '#f7f4ec',
  paperWarm: '#fbf9f2',
  card: '#ffffff',

  // brand (Prime Brains yellow-green)
  brand: '#9bc132',
  brandDeep: '#7ea61f',
  brandSoft: '#e8f1cd',
  brandWash: 'rgba(155,193,50,0.10)',

  // status (warm-tuned, low chroma)
  ok: '#5d8a3a',
  okSoft: '#dfe9cf',
  warn: '#c89a2d',
  warnSoft: '#f3e7c4',
  crit: '#b8482e',
  critSoft: '#f1d5c8',
  na: '#9a958a',

  // agent accent (Gantt agent rows — A5/R-U11 visual distinction)
  agent: '#6c7a59',

  // schedule semantics
  behind: '#d97706', // predicted later than frozen slot (R-S7)
  ahead: '#2d8a4e', // predicted earlier than frozen slot

  // typography
  font: "'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  fontSerif: "'Source Serif 4', 'Source Serif Pro', 'Hiragino Mincho ProN', serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export type EvmTokens = typeof EVM;
