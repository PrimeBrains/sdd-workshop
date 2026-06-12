/**
 * UiRecipes（shared/ui.ts）のユニットテスト（tasks.md 1.4 / Requirements 1.5, 3.1）。
 * variant→クラス列の対応を固定し、返値がトークン utility のみで構成されること
 * （既定パレット名・直値 hex を含まないこと）と純関数性（同一入力→同一出力）を検証する。
 * 正典: skeleton-client/src/styles.css の .badge / .chip / button.btn / .card。
 */
import { describe, expect, it } from "vitest";
import {
  badgeClass,
  btnClass,
  cardClass,
  chipClass,
  type BadgeVariant,
  type BtnVariant,
  type ChipVariant,
} from "@/shared/ui";

/** Tailwind 既定パレット名（slate 等）+ 数値スケールの検出。gray-mid / gray-soft はトークンなので gray-[0-9] のみ禁止 */
const DEFAULT_PALETTE_PATTERN = /\b(slate|gray|zinc|neutral|stone|amber|emerald|indigo|rose|sky|red|blue|green|yellow|orange|purple|violet|teal|cyan)-[0-9]/;

const ALL_OUTPUTS: Array<[label: string, value: string]> = [
  ["badgeClass(ok)", badgeClass("ok")],
  ["badgeClass(warn)", badgeClass("warn")],
  ["badgeClass(bad)", badgeClass("bad")],
  ["badgeClass(gray)", badgeClass("gray")],
  ["chipClass(default)", chipClass("default")],
  ["chipClass(danger)", chipClass("danger")],
  ["chipClass(plain)", chipClass("plain")],
  ["btnClass(default)", btnClass("default")],
  ["btnClass(primary)", btnClass("primary")],
  ["btnClass(danger)", btnClass("danger")],
  ["cardClass()", cardClass()],
];

describe("badgeClass", () => {
  const base = "inline-block px-[9px] py-px rounded-full text-[11px] font-semibold border align-middle";

  it.each<[BadgeVariant, string]>([
    ["ok", `${base} bg-ok-soft text-ok border-ok-line`],
    ["warn", `${base} bg-warn-soft text-warn-ink border-warn-line`],
    ["bad", `${base} bg-bad-soft text-bad border-bad-line`],
    ["gray", `${base} bg-gray-soft text-ink-soft border-line`],
  ])("variant %s はスケルトン .badge.%s 準拠のクラス列を返す", (variant, expected) => {
    expect(badgeClass(variant)).toBe(expected);
  });
});

describe("chipClass", () => {
  const base = "inline-block font-mono text-[11px] px-[7px] rounded-md border mx-0.5 my-px";

  it.each<[ChipVariant, string]>([
    ["default", `${base} cursor-pointer bg-brand-soft text-chip-ink border-chip-line hover:bg-chip-hover`],
    ["danger", `${base} cursor-pointer bg-bad-soft text-bad border-bad-line`],
    ["plain", `${base} cursor-default bg-gray-soft text-ink-soft border-line`],
  ])("variant %s はスケルトン .chip 準拠のクラス列を返す", (variant, expected) => {
    expect(chipClass(variant)).toBe(expected);
  });

  it("引数省略時は default variant と同一のクラス列を返す", () => {
    expect(chipClass()).toBe(chipClass("default"));
  });
});

describe("btnClass", () => {
  const base = "text-[12.5px] px-3.5 py-1.5 rounded-lg cursor-pointer border";

  it.each<[BtnVariant, string]>([
    ["default", `${base} border-line bg-white text-ink`],
    ["primary", `${base} border-brand bg-brand text-white font-semibold`],
    ["danger", `${base} border-bad-line bg-white text-bad`],
  ])("variant %s はスケルトン button.btn 準拠のクラス列を返す", (variant, expected) => {
    expect(btnClass(variant)).toBe(expected);
  });

  it("引数省略時は default variant と同一のクラス列を返す", () => {
    expect(btnClass()).toBe(btnClass("default"));
  });
});

describe("cardClass", () => {
  it("スケルトン .card 準拠（paper-warm 背景 + line 枠 + 角丸 10px）のクラス列を返す", () => {
    expect(cardClass()).toBe("bg-paper-warm border border-line rounded-[10px] px-[18px] py-4");
  });
});

describe("トークン utility 制約（Requirement 1.5）", () => {
  it.each(ALL_OUTPUTS)("%s は既定パレット名（slate 等）を含まない", (_label, value) => {
    expect(value).not.toMatch(DEFAULT_PALETTE_PATTERN);
  });

  it.each(ALL_OUTPUTS)("%s は直値 hex（#）を含まない", (_label, value) => {
    expect(value).not.toContain("#");
  });
});

describe("純関数性", () => {
  it("同一 variant の呼び出しは常に同一文字列を返す", () => {
    expect(badgeClass("ok")).toBe(badgeClass("ok"));
    expect(badgeClass("warn")).toBe(badgeClass("warn"));
    expect(badgeClass("bad")).toBe(badgeClass("bad"));
    expect(badgeClass("gray")).toBe(badgeClass("gray"));
    expect(chipClass("danger")).toBe(chipClass("danger"));
    expect(chipClass("plain")).toBe(chipClass("plain"));
    expect(btnClass("primary")).toBe(btnClass("primary"));
    expect(btnClass("danger")).toBe(btnClass("danger"));
    expect(cardClass()).toBe(cardClass());
  });
});
