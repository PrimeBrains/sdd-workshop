/**
 * SpecMetaBadges のテスト（tasks.md 2.1 / design.md「SpecMetaBadges = phase / approvals / ready 表示」）。
 *
 * - phase / 承認状態（フェーズ別 generated/approved）/ readyForImplementation をバッジ表示する
 * - spec.json 不正（メタデータ null）でも throw せず、null セーフなフォールバック表示になる
 *   （Requirement 1.1: 全スペックを省略なく一覧表示するための前提）
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SpecSummary } from "@contracts/spec";
import { SpecMetaBadges } from "@/features/specs/SpecMetaBadges";

afterEach(() => {
  cleanup();
});

function makeSummary(overrides: Partial<SpecSummary>): SpecSummary {
  return {
    feature: "fixture-normal",
    app: "demo-app",
    phase: "tasks-approved",
    language: "japanese",
    approvals: {
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: true },
    },
    readyForImplementation: true,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-05T00:00:00Z",
    artifacts: {
      brief: true,
      requirements: true,
      design: true,
      tasks: true,
      research: true,
      validationGap: true,
      validationDesign: true,
      validationImpl: true,
    },
    diagnostics: [],
    ...overrides,
  };
}

describe("SpecMetaBadges（正常メタデータ）", () => {
  it("phase 文字列・全フェーズ approved・ready を厳密値で表示する", () => {
    render(<SpecMetaBadges summary={makeSummary({})} />);

    expect(screen.getByTestId("phase-badge").textContent).toBe("tasks-approved");
    expect(screen.getByTestId("approval-requirements").getAttribute("data-state")).toBe("approved");
    expect(screen.getByTestId("approval-design").getAttribute("data-state")).toBe("approved");
    expect(screen.getByTestId("approval-tasks").getAttribute("data-state")).toBe("approved");
    expect(screen.getByTestId("ready-badge").getAttribute("data-state")).toBe("ready");
    expect(screen.getByTestId("ready-badge").textContent).toBe("実装可");
  });

  it("generated だが未 approved のフェーズは generated、未 generated は pending になる", () => {
    render(
      <SpecMetaBadges
        summary={makeSummary({
          approvals: {
            requirements: { generated: true, approved: true },
            design: { generated: true, approved: false },
            tasks: { generated: false, approved: false },
          },
          readyForImplementation: false,
        })}
      />,
    );

    expect(screen.getByTestId("approval-requirements").getAttribute("data-state")).toBe("approved");
    expect(screen.getByTestId("approval-design").getAttribute("data-state")).toBe("generated");
    expect(screen.getByTestId("approval-tasks").getAttribute("data-state")).toBe("pending");
    expect(screen.getByTestId("ready-badge").getAttribute("data-state")).toBe("not-ready");
    expect(screen.getByTestId("ready-badge").textContent).toBe("実装準備中");
  });
});

describe("SpecMetaBadges（spec.json 不正 → メタデータ null のフォールバック）", () => {
  it("phase / approvals / readyForImplementation が null でも throw せず unknown 表示になる", () => {
    render(
      <SpecMetaBadges
        summary={makeSummary({
          phase: null,
          approvals: null,
          readyForImplementation: null,
        })}
      />,
    );

    expect(screen.getByTestId("phase-badge").textContent).toBe("不明");
    expect(screen.getByTestId("approval-requirements").getAttribute("data-state")).toBe("unknown");
    expect(screen.getByTestId("approval-design").getAttribute("data-state")).toBe("unknown");
    expect(screen.getByTestId("approval-tasks").getAttribute("data-state")).toBe("unknown");
    expect(screen.getByTestId("ready-badge").getAttribute("data-state")).toBe("unknown");
    expect(screen.getByTestId("ready-badge").textContent).toBe("実装可否不明");
  });
});
