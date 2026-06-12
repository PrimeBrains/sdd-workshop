/**
 * UiRecipes（tasks.md 1.4 / Requirements 1.5, 3.1）。
 * 頻出装飾（badge / chip / btn / card）の className を型付き純関数で一元生成する。
 * 正典: skeleton-client/src/styles.css の .badge / .chip / button.btn / .card。
 * 返値は @theme トークン utility のみで構成される静的文字列（直値・既定パレット不使用）。
 * 追加装飾（マージン等のレイアウト調整）は呼び出し側で連結してよい（色は不可）。
 */

export type BadgeVariant = "ok" | "warn" | "bad" | "gray";
export type ChipVariant = "default" | "danger" | "plain";
export type BtnVariant = "default" | "primary" | "danger";

/** スケルトン .badge 共通: inline pill、padding 1px 9px、11px/600、枠 1px */
const BADGE_BASE =
  "inline-block px-[9px] py-px rounded-full text-[11px] font-semibold border align-middle";

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  ok: `${BADGE_BASE} bg-ok-soft text-ok border-ok-line`,
  warn: `${BADGE_BASE} bg-warn-soft text-warn-ink border-warn-line`,
  bad: `${BADGE_BASE} bg-bad-soft text-bad border-bad-line`,
  gray: `${BADGE_BASE} bg-gray-soft text-ink-soft border-line`,
};

/** スケルトン .chip 共通: mono 11px、padding 0 7px、角丸 6px、margin 1px 2px */
const CHIP_BASE = "inline-block font-mono text-[11px] px-[7px] rounded-md border mx-0.5 my-px";

const CHIP_VARIANTS: Record<ChipVariant, string> = {
  default: `${CHIP_BASE} cursor-pointer bg-brand-soft text-chip-ink border-chip-line hover:bg-chip-hover`,
  danger: `${CHIP_BASE} cursor-pointer bg-bad-soft text-bad border-bad-line`,
  plain: `${CHIP_BASE} cursor-default bg-gray-soft text-ink-soft border-line`,
};

/** スケルトン button.btn 共通: 12.5px、padding 6px 14px、角丸 8px */
const BTN_BASE = "text-[12.5px] px-3.5 py-1.5 rounded-lg cursor-pointer border";

const BTN_VARIANTS: Record<BtnVariant, string> = {
  default: `${BTN_BASE} border-line bg-white text-ink`,
  primary: `${BTN_BASE} border-brand bg-brand text-white font-semibold`,
  danger: `${BTN_BASE} border-bad-line bg-white text-bad`,
};

/** スケルトン .badge 準拠: pill 形状 + 状態色（背景 soft / 文字 / 枠 line の 3 点セット） */
export function badgeClass(variant: BadgeVariant): string {
  return BADGE_VARIANTS[variant];
}

/** スケルトン .chip 準拠: mono フォント + brand-soft 背景。danger / plain で配色切替 */
export function chipClass(variant: ChipVariant = "default"): string {
  return CHIP_VARIANTS[variant];
}

/** スケルトン button.btn 準拠: 白地 + line 枠。primary は brand 塗り、danger は bad 文字 */
export function btnClass(variant: BtnVariant = "default"): string {
  return BTN_VARIANTS[variant];
}

/** スケルトン .card 準拠: paper-warm 背景 + line 枠 + 角丸 10px + padding 16px 18px */
export function cardClass(): string {
  return "bg-paper-warm border border-line rounded-[10px] px-[18px] py-4";
}
