/**
 * OriginBadge テスト（tasks.md 6.2 / requirements 6.6 /
 * design.md「Feature: knowledge → OriginBadge」）。
 *
 * - origin の各値 → 固定ラベル（厳密値）を検証する:
 *   "cc-sdd" → "cc-sdd 標準" / "custom" → "独自スキル" / null → "未分類"。
 * - 規約外の未知 origin 文字列も「未分類」へフォールバックする（情報を落とさず非エラー）。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OriginBadge } from "./OriginBadge";

afterEach(cleanup);

describe("OriginBadge（Requirement 6.6: origin 分類バッジ）", () => {
  it.each([
    ["cc-sdd", "cc-sdd 標準"],
    ["custom", "独自スキル"],
    [null, "未分類"],
  ] as const)("origin=%s のとき厳密ラベル %s を表示する", (origin, label) => {
    render(<OriginBadge origin={origin} />);
    const badge = screen.getByTestId("origin-badge");
    expect(badge.textContent).toBe(label);
  });

  it("規約外の未知 origin 文字列は『未分類』にフォールバックする", () => {
    render(<OriginBadge origin="something-else" />);
    expect(screen.getByTestId("origin-badge").textContent).toBe("未分類");
  });
});
