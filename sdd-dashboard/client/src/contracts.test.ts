/**
 * 契約型エイリアスの煙テスト（tasks.md 1.1 完了条件）:
 * `@contracts/spec` の `SpecSummary` を `import type` したコードが
 * 型チェック（tsc --noEmit）とテスト実行の両方を通ることを証明する。
 * 値 import は ESLint（@typescript-eslint/no-restricted-imports）で禁止されている。
 */
import type { SpecSummary } from "@contracts/spec";
import { describe, expect, it } from "vitest";

const fixture: SpecSummary = {
  feature: "sdd-review-ui",
  app: "sdd-dashboard",
  phase: "implementation",
  language: "ja",
  approvals: {
    requirements: { generated: true, approved: true },
    design: { generated: true, approved: true },
    tasks: { generated: true, approved: true },
  },
  readyForImplementation: true,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-11T00:00:00Z",
  artifacts: {
    brief: false,
    requirements: true,
    design: true,
    tasks: true,
    research: true,
    validationGap: false,
    validationDesign: true,
    validationImpl: false,
  },
  diagnostics: [],
};

function pickFeature(summary: SpecSummary): string {
  return summary.feature;
}

describe("@contracts/spec エイリアス", () => {
  it("SpecSummary の import type を満たすフィクスチャがフィールド厳密値で一致する", () => {
    expect(pickFeature(fixture)).toBe("sdd-review-ui");
    expect(fixture.approvals?.tasks.approved).toBe(true);
    expect(fixture.artifacts.validationImpl).toBe(false);
  });
});
