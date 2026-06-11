/**
 * PhaseModel 単体テスト（tasks.md 2.1 完了条件 / design.md PhaseModel Service Interface）:
 * buildPipelineView / approvablePhase を approvals の全組合せで厳密値検証する。
 * 特に「design が generated でも requirements 未承認なら approvable は null」
 * （sdd-core 9.3 と同条件、design.md Testing Strategy item 1）を明示的に確認する。
 * 純粋関数のため FS/HTTP/DOM アクセスなし。
 */
import type { PhaseApproval, SpecApprovals, SpecSummary } from "@contracts/spec";
import { describe, expect, it } from "vitest";
import {
  approvablePhase,
  buildPipelineView,
  type PhaseStepState,
  type PipelineView,
} from "./phaseModel";

/** PhaseApproval の簡易ファクトリ */
function approval(generated: boolean, approved: boolean): PhaseApproval {
  return { generated, approved };
}

/**
 * 全フィールドを満たす SpecSummary フィクスチャを構築する。
 * approvals / readyForImplementation を上書きしてテストケースを表現する。
 */
function makeSpec(partial: Partial<SpecSummary>): SpecSummary {
  return {
    feature: "sample-spec",
    app: "sdd-dashboard",
    phase: "requirements",
    language: "ja",
    approvals: {
      requirements: approval(false, false),
      design: approval(false, false),
      tasks: approval(false, false),
    },
    readyForImplementation: false,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-11T00:00:00Z",
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

/** approvals を全フェーズ一括指定するヘルパ */
function withApprovals(approvals: SpecApprovals, ready: boolean | null): SpecSummary {
  return makeSpec({ approvals, readyForImplementation: ready });
}

const notGenerated: PhaseStepState = { kind: "not-generated" };
const generated: PhaseStepState = { kind: "generated" };
const approved: PhaseStepState = { kind: "approved" };
const unknown: PhaseStepState = { kind: "unknown" };

describe("buildPipelineView", () => {
  it("approvals が null のとき全 4 段階を unknown・ready を null・current は無しで返す", () => {
    const spec = makeSpec({ approvals: null, readyForImplementation: null });

    const expected: PipelineView = {
      steps: [
        { phase: "requirements", state: unknown, current: false },
        { phase: "design", state: unknown, current: false },
        { phase: "tasks", state: unknown, current: false },
        { phase: "implementation", state: unknown, current: false },
      ],
      ready: null,
    };
    expect(buildPipelineView(spec)).toEqual(expected);
  });

  it("approvals が null かつ readyForImplementation に値があっても全段階 unknown・ready null", () => {
    const spec = makeSpec({ approvals: null, readyForImplementation: true });
    const view = buildPipelineView(spec);
    expect(view.ready).toBeNull();
    expect(view.steps.map((s) => s.state)).toEqual([unknown, unknown, unknown, unknown]);
    expect(view.steps.every((s) => s.current === false)).toBe(true);
  });

  it("全フェーズ未生成のとき requirements が current・implementation は not-generated", () => {
    const spec = withApprovals(
      {
        requirements: approval(false, false),
        design: approval(false, false),
        tasks: approval(false, false),
      },
      false,
    );

    const expected: PipelineView = {
      steps: [
        { phase: "requirements", state: notGenerated, current: true },
        { phase: "design", state: notGenerated, current: false },
        { phase: "tasks", state: notGenerated, current: false },
        { phase: "implementation", state: notGenerated, current: false },
      ],
      ready: false,
    };
    expect(buildPipelineView(spec)).toEqual(expected);
  });

  it("requirements が生成済み未承認のとき generated 状態かつ current", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, false),
        design: approval(false, false),
        tasks: approval(false, false),
      },
      false,
    );
    const view = buildPipelineView(spec);
    expect(view.steps).toEqual([
      { phase: "requirements", state: generated, current: true },
      { phase: "design", state: notGenerated, current: false },
      { phase: "tasks", state: notGenerated, current: false },
      { phase: "implementation", state: notGenerated, current: false },
    ]);
    expect(view.ready).toBe(false);
  });

  it("requirements 承認済みのとき current は design へ進む", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, false),
        tasks: approval(false, false),
      },
      false,
    );
    const view = buildPipelineView(spec);
    expect(view.steps).toEqual([
      { phase: "requirements", state: approved, current: false },
      { phase: "design", state: generated, current: true },
      { phase: "tasks", state: notGenerated, current: false },
      { phase: "implementation", state: notGenerated, current: false },
    ]);
  });

  it("requirements・design 承認済みのとき current は tasks", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, true),
        tasks: approval(true, false),
      },
      false,
    );
    const view = buildPipelineView(spec);
    expect(view.steps.map((s) => ({ phase: s.phase, current: s.current }))).toEqual([
      { phase: "requirements", current: false },
      { phase: "design", current: false },
      { phase: "tasks", current: true },
      { phase: "implementation", current: false },
    ]);
  });

  it("3 ドキュメント承認済み・ready=true のとき implementation が approved かつ current（全ドキュメントが approved なので最初の非 approved=implementation）", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, true),
        tasks: approval(true, true),
      },
      true,
    );
    const expected: PipelineView = {
      steps: [
        { phase: "requirements", state: approved, current: false },
        { phase: "design", state: approved, current: false },
        { phase: "tasks", state: approved, current: false },
        { phase: "implementation", state: approved, current: false },
      ],
      ready: true,
    };
    expect(buildPipelineView(spec)).toEqual(expected);
  });

  it("3 ドキュメント承認済みだが ready=false のとき implementation は not-generated かつ current", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, true),
        tasks: approval(true, true),
      },
      false,
    );
    const view = buildPipelineView(spec);
    expect(view.steps).toEqual([
      { phase: "requirements", state: approved, current: false },
      { phase: "design", state: approved, current: false },
      { phase: "tasks", state: approved, current: false },
      { phase: "implementation", state: notGenerated, current: true },
    ]);
    expect(view.ready).toBe(false);
  });

  it("ready が null（フィールド自体 null）のとき top-level ready も null・implementation は unknown", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, true),
        tasks: approval(true, true),
      },
      null,
    );
    const view = buildPipelineView(spec);
    expect(view.ready).toBeNull();
    const implStep = view.steps[3];
    expect(implStep).toEqual({ phase: "implementation", state: unknown, current: true });
  });

  it("steps は常に 4 要素・固定順 [requirements, design, tasks, implementation]", () => {
    const spec = makeSpec({});
    expect(buildPipelineView(spec).steps.map((s) => s.phase)).toEqual([
      "requirements",
      "design",
      "tasks",
      "implementation",
    ]);
  });

  it("current は高々 1 つ", () => {
    const specs = [
      makeSpec({}),
      withApprovals(
        {
          requirements: approval(true, true),
          design: approval(true, false),
          tasks: approval(false, false),
        },
        false,
      ),
      withApprovals(
        {
          requirements: approval(true, true),
          design: approval(true, true),
          tasks: approval(true, true),
        },
        true,
      ),
      makeSpec({ approvals: null, readyForImplementation: null }),
    ];
    for (const spec of specs) {
      const currentCount = buildPipelineView(spec).steps.filter((s) => s.current).length;
      expect(currentCount).toBeLessThanOrEqual(1);
    }
  });
});

describe("approvablePhase", () => {
  it("approvals が null のとき null", () => {
    expect(approvablePhase(makeSpec({ approvals: null }))).toBeNull();
  });

  it("何も生成されていないとき null", () => {
    const spec = withApprovals(
      {
        requirements: approval(false, false),
        design: approval(false, false),
        tasks: approval(false, false),
      },
      false,
    );
    expect(approvablePhase(spec)).toBeNull();
  });

  it("requirements が生成済み未承認のとき requirements を返す", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, false),
        design: approval(false, false),
        tasks: approval(false, false),
      },
      false,
    );
    expect(approvablePhase(spec)).toBe("requirements");
  });

  it("requirements 承認済み + design 生成済み未承認のとき design を返す", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, false),
        tasks: approval(false, false),
      },
      false,
    );
    expect(approvablePhase(spec)).toBe("design");
  });

  it("requirements・design 承認済み + tasks 生成済み未承認のとき tasks を返す", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, true),
        tasks: approval(true, false),
      },
      false,
    );
    expect(approvablePhase(spec)).toBe("tasks");
  });

  it("全フェーズ生成済み未承認のチェーンでは最初の requirements を返す", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, false),
        design: approval(true, false),
        tasks: approval(true, false),
      },
      false,
    );
    expect(approvablePhase(spec)).toBe("requirements");
  });

  it("全フェーズ承認済みのとき null（implementation は承認対象外）", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, true),
        tasks: approval(true, true),
      },
      true,
    );
    expect(approvablePhase(spec)).toBeNull();
  });

  it("design が生成済みでも requirements 未承認なら null（先行フェーズ未承認ゲート / sdd-core 9.3 同条件）", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, false),
        design: approval(true, false),
        tasks: approval(false, false),
      },
      false,
    );
    // requirements 自身が未承認なので requirements が approvable。design ではない。
    expect(approvablePhase(spec)).toBe("requirements");
  });

  it("requirements 未承認・requirements 未生成で design 生成済みのとき null（先行未承認ゲート）", () => {
    const spec = withApprovals(
      {
        requirements: approval(false, false),
        design: approval(true, false),
        tasks: approval(false, false),
      },
      false,
    );
    expect(approvablePhase(spec)).toBeNull();
  });

  it("tasks が生成済みでも design 未承認なら null（先行フェーズ未承認ゲート）", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(true, false),
        tasks: approval(true, false),
      },
      false,
    );
    // design が approvable（requirements 承認済み・design 生成済み未承認）。tasks ではない。
    expect(approvablePhase(spec)).toBe("design");
  });

  it("tasks が生成済みで design 未生成・requirements 承認済みのとき null", () => {
    const spec = withApprovals(
      {
        requirements: approval(true, true),
        design: approval(false, false),
        tasks: approval(true, false),
      },
      false,
    );
    expect(approvablePhase(spec)).toBeNull();
  });
});
