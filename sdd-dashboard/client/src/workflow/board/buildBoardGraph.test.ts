/**
 * BoardGraphBuilder 単体テスト — SpecSummary[] → ノード/エッジ/座標の厳密値検証
 * （design.md「Feature: board」BoardGraph / SpecPipelineNodeData / Postconditions、
 *  Requirements 1.1, 1.3）。
 *
 * 検証対象 Postcondition: 入力スペック数 = レーン数（省略なし、1.3）／同一入力 → 同一座標（決定性）。
 * 3 スペックフィクスチャ（正常 / 一部未生成 / spec.json 破損）でレーン数・ノード状態・
 * 診断フラグ・座標を厳密値でアサートする。
 */
import type { SpecApprovals, SpecSummary } from "@contracts/spec";
import { describe, expect, it } from "vitest";

import { buildPipelineView } from "@/workflow/model/phaseModel";

import { ROW_GAP, buildBoardGraph } from "./buildBoardGraph";

/** approvals 全フェーズの { generated, approved } をまとめて指定するヘルパ。 */
function makeApprovals(
  flags: SpecApprovals,
): SpecApprovals {
  return flags;
}

/** テスト用 SpecSummary フィクスチャ。必要フィールドのみ部分指定する。 */
function makeSpec(partial: Partial<SpecSummary>): SpecSummary {
  return {
    feature: "spec-x",
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

/** 正常: 全フェーズ生成済み・承認済み・ready=true・診断なし。 */
function normalSpec(): SpecSummary {
  return makeSpec({
    feature: "alpha",
    approvals: makeApprovals({
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: true },
    }),
    readyForImplementation: true,
  });
}

/** 一部未生成: requirements のみ承認済み、design 生成済み未承認、tasks 未生成。診断なし。 */
function partialSpec(): SpecSummary {
  return makeSpec({
    feature: "bravo",
    approvals: makeApprovals({
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: false },
      tasks: { generated: false, approved: false },
    }),
    readyForImplementation: false,
  });
}

/** spec.json 破損: approvals=null・診断非空。 */
function brokenSpec(): SpecSummary {
  return makeSpec({
    feature: "charlie",
    approvals: null,
    readyForImplementation: null,
    diagnostics: [{ kind: "parse-failure", message: "invalid JSON", position: null }],
  });
}

describe("buildBoardGraph", () => {
  it("入力スペック数 = レーン数（破損スペックも省略しない）", () => {
    const specs = [normalSpec(), partialSpec(), brokenSpec()];
    const { nodes } = buildBoardGraph(specs);
    expect(nodes).toHaveLength(3);
    expect(nodes.map((n) => n.id)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("各ノードの id / type / position が決定論的な厳密値で一致する", () => {
    const specs = [normalSpec(), partialSpec(), brokenSpec()];
    const { nodes } = buildBoardGraph(specs);

    expect(nodes[0]?.id).toBe("alpha");
    expect(nodes[0]?.type).toBe("specPipeline");
    expect(nodes[0]?.position).toEqual({ x: 0, y: 0 });

    expect(nodes[1]?.id).toBe("bravo");
    expect(nodes[1]?.type).toBe("specPipeline");
    expect(nodes[1]?.position).toEqual({ x: 0, y: ROW_GAP });

    expect(nodes[2]?.id).toBe("charlie");
    expect(nodes[2]?.type).toBe("specPipeline");
    expect(nodes[2]?.position).toEqual({ x: 0, y: 2 * ROW_GAP });
  });

  it("各ノードの data.pipeline が buildPipelineView と一致する", () => {
    const normal = normalSpec();
    const partial = partialSpec();
    const broken = brokenSpec();
    const { nodes } = buildBoardGraph([normal, partial, broken]);

    expect(nodes[0]?.data.feature).toBe("alpha");
    expect(nodes[0]?.data.pipeline).toEqual(buildPipelineView(normal));
    expect(nodes[1]?.data.pipeline).toEqual(buildPipelineView(partial));
    expect(nodes[2]?.data.pipeline).toEqual(buildPipelineView(broken));
  });

  it("破損スペックは全段階 unknown の PipelineView を持つ", () => {
    const broken = brokenSpec();
    const { nodes } = buildBoardGraph([broken]);
    const pipeline = nodes[0]?.data.pipeline;
    expect(pipeline?.ready).toBeNull();
    expect(pipeline?.steps.map((s) => s.state.kind)).toEqual([
      "unknown",
      "unknown",
      "unknown",
      "unknown",
    ]);
  });

  it("hasDiagnostics は diagnostics 非空のときだけ true", () => {
    const { nodes } = buildBoardGraph([normalSpec(), partialSpec(), brokenSpec()]);
    expect(nodes[0]?.data.hasDiagnostics).toBe(false);
    expect(nodes[1]?.data.hasDiagnostics).toBe(false);
    expect(nodes[2]?.data.hasDiagnostics).toBe(true);
  });

  it("edges は空配列（フェーズ進行はノード内描画のため）", () => {
    const { edges } = buildBoardGraph([normalSpec(), partialSpec(), brokenSpec()]);
    expect(edges).toEqual([]);
  });

  it("同一入力 → 同一座標（決定性）", () => {
    const specs = [normalSpec(), partialSpec(), brokenSpec()];
    const first = buildBoardGraph(specs);
    const second = buildBoardGraph(specs);
    expect(first.nodes.map((n) => n.position)).toEqual(second.nodes.map((n) => n.position));
  });

  it("空入力 → ノード・エッジともに空", () => {
    const graph = buildBoardGraph([]);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});
