/**
 * RollbackImpact 単体テスト — 巻き戻し影響予測の厳密値検証
 * （design.md「Model 層（純粋関数）」RollbackImpact / Requirements 3.2、
 *  sdd-core RollbackWriter セマンティクス 10.1/10.2 の写像）。
 */
import type { PhaseName, SpecApprovals, SpecSummary } from "@contracts/spec";
import { describe, expect, it } from "vitest";

import { computeRollbackImpact } from "./rollbackImpact";

/** approvals 全フェーズの { generated, approved } をまとめて指定するヘルパ。 */
function makeApprovals(
  flags: Record<PhaseName, { generated: boolean; approved: boolean }>,
): SpecApprovals {
  return flags;
}

/** テスト用 SpecSummary フィクスチャ。必要フィールドのみ部分指定する。 */
function makeSpec(partial: Partial<SpecSummary>): SpecSummary {
  return {
    feature: "sdd-workflow-ui",
    app: null,
    phase: null,
    language: null,
    approvals: null,
    readyForImplementation: null,
    createdAt: null,
    updatedAt: null,
    artifacts: {
      brief: false,
      requirements: false,
      design: false,
      tasks: false,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    },
    diagnostics: [],
    ...partial,
  };
}

/** 全フェーズ生成済み・承認済み・ready=true のスペック。 */
function allApprovedReadySpec(): SpecSummary {
  return makeSpec({
    approvals: makeApprovals({
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: true },
    }),
    readyForImplementation: true,
  });
}

describe("computeRollbackImpact", () => {
  describe("全承認済み・ready=true（完了ゲートケース、厳密一致）", () => {
    it("target=requirements: 全承認解除・design/tasks クリア・ready 喪失", () => {
      expect(
        computeRollbackImpact(allApprovedReadySpec(), "requirements"),
      ).toEqual({
        targetPhase: "requirements",
        revokedApproval: ["requirements", "design", "tasks"],
        clearedPhases: ["design", "tasks"],
        losesReady: true,
        nextCommand: "/kiro-spec-requirements sdd-workflow-ui",
      });
    });

    it("target=design: design/tasks 承認解除・tasks クリア・ready 喪失", () => {
      expect(computeRollbackImpact(allApprovedReadySpec(), "design")).toEqual({
        targetPhase: "design",
        revokedApproval: ["design", "tasks"],
        clearedPhases: ["tasks"],
        losesReady: true,
        nextCommand: "/kiro-spec-design sdd-workflow-ui",
      });
    });

    it("target=tasks: tasks のみ承認解除・クリアなし・ready 喪失", () => {
      expect(computeRollbackImpact(allApprovedReadySpec(), "tasks")).toEqual({
        targetPhase: "tasks",
        revokedApproval: ["tasks"],
        clearedPhases: [],
        losesReady: true,
        nextCommand: "/kiro-spec-tasks sdd-workflow-ui",
      });
    });
  });

  describe("部分承認ケース", () => {
    it("requirements+design 承認済み・tasks 生成済み未承認・ready=false", () => {
      const spec = makeSpec({
        feature: "sdd-review-ui",
        approvals: makeApprovals({
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: true },
          tasks: { generated: true, approved: false },
        }),
        readyForImplementation: false,
      });

      // target=requirements:
      //   revokedApproval は承認済みのみ → tasks（未承認）は除外
      //   clearedPhases は生成済み後続 → design・tasks（両方 generated=true）
      expect(computeRollbackImpact(spec, "requirements")).toEqual({
        targetPhase: "requirements",
        revokedApproval: ["requirements", "design"],
        clearedPhases: ["design", "tasks"],
        losesReady: false,
        nextCommand: "/kiro-spec-requirements sdd-review-ui",
      });
    });

    it("後続が未生成なら clearedPhases から除外される", () => {
      const spec = makeSpec({
        approvals: makeApprovals({
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: false },
          tasks: { generated: false, approved: false },
        }),
        readyForImplementation: false,
      });

      // target=requirements: 後続 design（generated=true）は clear 対象、
      //   tasks（generated=false）は除外。design は未承認なので revoke 対象外。
      expect(computeRollbackImpact(spec, "requirements")).toEqual({
        targetPhase: "requirements",
        revokedApproval: ["requirements"],
        clearedPhases: ["design"],
        losesReady: false,
        nextCommand: "/kiro-spec-requirements sdd-workflow-ui",
      });
    });
  });

  describe("境界ケース", () => {
    it("approvals=null: 承認解除・クリアなし・ready 喪失なし、nextCommand は導出", () => {
      const spec = makeSpec({
        feature: "evm-studio",
        approvals: null,
        readyForImplementation: null,
      });

      expect(computeRollbackImpact(spec, "design")).toEqual({
        targetPhase: "design",
        revokedApproval: [],
        clearedPhases: [],
        losesReady: false,
        nextCommand: "/kiro-spec-design evm-studio",
      });
    });

    it("readyForImplementation=false: losesReady=false", () => {
      const spec = makeSpec({
        approvals: makeApprovals({
          requirements: { generated: true, approved: true },
          design: { generated: false, approved: false },
          tasks: { generated: false, approved: false },
        }),
        readyForImplementation: false,
      });

      expect(computeRollbackImpact(spec, "tasks").losesReady).toBe(false);
    });
  });
});
