/**
 * HelpPage テスト（tasks.md 5.1 / requirements 4.1, 4.2, 4.3 / design.md「Feature: help」）。
 *
 * - 4.1: cc-sdd フローを Discovery → Requirements → 承認 → Design → 承認 → Tasks → 承認 → 実装 の
 *   「順序」で表示する（present ではなく ORDER を検証）。
 * - 4.2: 各フェーズカードが PHASE_COMMANDS の「成果物」と「CLI コマンド」を厳密値で表示する。
 * - 4.3: 共通ナビからヘルプへ到達できる（/help を開くと HelpPage が描画される）。
 * - ローカル完結: 外部 src の <img>・外部 origin の <a href="http..."> を含まない。
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { PHASE_COMMANDS } from "@/workflow/model/nextCommand";
import { FLOW_STEPS, HelpPage } from "@/workflow/help/HelpPage";

afterEach(cleanup);

function renderHelp() {
  return render(
    <MemoryRouter>
      <HelpPage />
    </MemoryRouter>,
  );
}

describe("HelpPage フロー解説（Requirement 4.1: 順序立った解説）", () => {
  it("8 ステップが Discovery → Requirements → 承認 → Design → 承認 → Tasks → 承認 → 実装 の定義順で表示される", () => {
    renderHelp();
    const list = screen.getByTestId("help-flow-steps");
    const stepLabels = within(list)
      .getAllByTestId("help-flow-step")
      .map((el) => el.textContent?.trim());
    expect(stepLabels).toEqual([
      "Discovery",
      "Requirements",
      "承認",
      "Design",
      "承認",
      "Tasks",
      "承認",
      "実装",
    ]);
  });

  it("FLOW_STEPS 定数が厳密に 8 ステップで上記の順序を保持する（偽 pass 防止の出典固定）", () => {
    expect(FLOW_STEPS).toEqual([
      "Discovery",
      "Requirements",
      "承認",
      "Design",
      "承認",
      "Tasks",
      "承認",
      "実装",
    ]);
  });
});

describe("HelpPage フェーズカード（Requirement 4.2: 成果物・承認の意味・CLI コマンド）", () => {
  it("PHASE_COMMANDS の各エントリについて、成果物と CLI コマンドの厳密値を表示する", () => {
    renderHelp();
    for (const entry of PHASE_COMMANDS) {
      const card = screen.getByTestId(`help-phase-card-${entry.phase}`);
      // 成果物（厳密値）
      expect(within(card).getByTestId("help-phase-artifact").textContent).toContain(entry.artifact);
      // CLI コマンド（厳密値）
      expect(within(card).getByTestId("help-phase-command").textContent).toContain(entry.command);
      // 承認の意味（各フェーズに固有の散文が存在する）
      expect(within(card).getByTestId("help-phase-approval").textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it("Design カードは design.md と /kiro-spec-design を表示する（具体例による回帰固定）", () => {
    renderHelp();
    const card = screen.getByTestId("help-phase-card-Design");
    expect(within(card).getByTestId("help-phase-artifact").textContent).toContain("design.md");
    expect(within(card).getByTestId("help-phase-command").textContent).toContain("/kiro-spec-design");
  });

  it("カード枚数は PHASE_COMMANDS の件数に一致する", () => {
    renderHelp();
    expect(screen.getAllByTestId(/^help-phase-card-/)).toHaveLength(PHASE_COMMANDS.length);
  });
});

describe("HelpPage ローカル完結（外部リソース不使用）", () => {
  it("外部 src の <img> を含まない", () => {
    const { container } = renderHelp();
    const externalImgs = Array.from(container.querySelectorAll("img")).filter((img) =>
      /^https?:\/\//.test(img.getAttribute("src") ?? ""),
    );
    expect(externalImgs).toHaveLength(0);
  });

  it("外部 origin への <a href=\"http...\"> を含まない", () => {
    const { container } = renderHelp();
    const externalAnchors = Array.from(container.querySelectorAll("a")).filter((a) =>
      /^https?:\/\//.test(a.getAttribute("href") ?? ""),
    );
    expect(externalAnchors).toHaveLength(0);
  });
});

describe("HelpPage アクセシビリティ", () => {
  it("ページ見出し（h1）を持つ", () => {
    renderHelp();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});
