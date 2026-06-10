import { describe, expect, it } from "vitest";
import { parseDesign } from "../parsers/design.js";
import { parseRequirements } from "../parsers/requirements.js";
import { parseTasks } from "../parsers/tasks.js";
import type { NodeRef, TraceEdge } from "../types/trace.js";
import { buildTraceGraph } from "./trace-graph.js";

/**
 * 合成フィクスチャ spec "alpha"（要件 1.1, 1.2, 1.3, 2.1）。
 * エッジ 3 源泉（design Traceability 行 / コンポーネント Requirements フィールド /
 * タスク `_Requirements:_` 注記）と、クロス spec 参照（beta/1.2）・旧範囲表記
 * （1.1-1.3）・不在 ID（9.9）・unparsable（15.*）を含み、完全エッジ集合を手計算できる。
 */
const alphaRequirementsMd = `# Requirements

## Introduction

トレースグラフ検証用フィクスチャ。

### Requirement 1: パース

**Objective:** パースしたい

#### Acceptance Criteria

1. The system shall parse A.
2. The system shall parse B.
3. The system shall parse C.

### Requirement 2: 構築

**Objective:** 構築したい

#### Acceptance Criteria

1. The system shall build.
`;

const alphaDesignMd = `# Design

## Requirements Traceability

| Requirement | Summary | Components | Interfaces | Flows |
|-------------|---------|------------|------------|-------|
| 1.1, 1.2 | パース | Parser | parse() | — |
| 1.3, 2.1 | 構築 | Builder, Parser | build() | — |
| 1.1-1.3 | 旧表記 | Legacy | — | — |
| 2.1 | 行ラベル試験 | — | — | — |

## Components

### Parser

| Field | Detail |
|-------|--------|
| Intent | パース |
| Requirements | 1.1, 1.2 |

### Builder

| Field | Detail |
|-------|--------|
| Intent | 構築 |
| Requirements | 1.3, 2.1, beta/1.2 |
`;

const alphaTasksMd = `# 実装計画

- [ ] 1. メジャー
- [ ] 1.1 サブタスク A
  - 詳細
  - _Requirements: 1.1, 1.2_
- [x] 1.2 サブタスク B
  - _Requirements: 1.3, beta/1.2_
- [ ] 2. メジャー2
  - _Requirements: 2.1, 9.9, 15.*_
`;

/** クロス spec 参照先フィクスチャ "beta"（要件 1.1, 1.2） */
const betaRequirementsMd = `# Requirements

### Requirement 1: 外部要件

#### Acceptance Criteria

1. Beta AC one.
2. Beta AC two.
`;

const alphaRequirements = parseRequirements(alphaRequirementsMd);
const alphaDesign = parseDesign(alphaDesignMd);
const alphaTasks = parseTasks(alphaTasksMd);
const betaRequirements = parseRequirements(betaRequirementsMd);

const resolveRequirements = (feature: string) =>
  feature === "beta" ? betaRequirements : null;

function buildAlphaGraph() {
  return buildTraceGraph(
    {
      feature: "alpha",
      requirements: alphaRequirements,
      design: alphaDesign,
      tasks: alphaTasks,
    },
    { resolveRequirements },
  );
}

const req = (id: string): NodeRef => ({ type: "requirement", id });
const design = (name: string): NodeRef => ({ type: "design", name });
const task = (id: string): NodeRef => ({ type: "task", id });

function edge(
  fromId: string,
  to: NodeRef,
  source: TraceEdge["source"],
  legacyExpanded = false,
): TraceEdge {
  return { from: req(fromId), to, source, legacyExpanded };
}

/** 手計算した完全エッジ集合（design 表 → コンポーネントフィールド → タスク注記の順） */
const expectedEdges: TraceEdge[] = [
  // design Traceability 行（source: "design-table"）
  edge("1.1", design("Parser"), "design-table"),
  edge("1.2", design("Parser"), "design-table"),
  edge("1.3", design("Builder"), "design-table"),
  edge("1.3", design("Parser"), "design-table"),
  edge("2.1", design("Builder"), "design-table"),
  edge("2.1", design("Parser"), "design-table"),
  // 旧範囲表記 1.1-1.3 の展開（legacyExpanded: true、6.3 の展開 + 実在照合）
  edge("1.1", design("Legacy"), "design-table", true),
  edge("1.2", design("Legacy"), "design-table", true),
  edge("1.3", design("Legacy"), "design-table", true),
  // Components 列が空（—）の行は Summary を行ラベルとして design ノードにする
  edge("2.1", design("行ラベル試験"), "design-table"),
  // コンポーネント Requirements フィールド（source: "component-field"）
  edge("1.1", design("Parser"), "component-field"),
  edge("1.2", design("Parser"), "component-field"),
  edge("1.3", design("Builder"), "component-field"),
  edge("2.1", design("Builder"), "component-field"),
  // クロス spec 参照 beta/1.2 は beta の requirements に対して解決される（6.6）
  edge("beta/1.2", design("Builder"), "component-field"),
  // タスク `_Requirements:_` 注記（source: "task-annotation"）
  edge("1.1", task("1.1"), "task-annotation"),
  edge("1.2", task("1.1"), "task-annotation"),
  edge("1.3", task("1.2"), "task-annotation"),
  edge("beta/1.2", task("1.2"), "task-annotation"),
  // 9.9（不在 ID）と 15.*（unparsable）はエッジにならない（診断はタスク 5.2 の責務）
  edge("2.1", task("2"), "task-annotation"),
];

/** node の両方向対応先を edges から列挙する（クライアント側両方向インデックスの再現） */
function counterparts(edges: TraceEdge[], node: NodeRef): NodeRef[] {
  const same = (a: NodeRef, b: NodeRef) =>
    a.type === b.type &&
    (a.type === "design" ? a.name === (b as { name: string }).name
      : a.id === (b as { id: string }).id);
  return edges.flatMap((e) => {
    if (same(e.from, node)) return [e.to];
    if (same(e.to, node)) return [e.from];
    return [];
  });
}

/** NodeRef 集合の比較用キー */
function key(node: NodeRef): string {
  return node.type === "design" ? `design:${node.name}` : `${node.type}:${node.id}`;
}

describe("buildTraceGraph（フィクスチャ spec alpha）", () => {
  const graph = buildAlphaGraph();

  it("全ノードを種別ごとに列挙する（6.1）", () => {
    expect(graph.feature).toBe("alpha");
    expect(graph.nodes.requirements).toEqual([
      req("1.1"),
      req("1.2"),
      req("1.3"),
      req("2.1"),
      // 解決されたクロス spec 参照先は修飾 ID でノードに含まれる（6.6）
      req("beta/1.2"),
    ]);
    expect(graph.nodes.designElements).toEqual([
      design("Parser"),
      design("Builder"),
      design("Legacy"),
      design("行ラベル試験"),
    ]);
    expect(graph.nodes.tasks).toEqual([task("1"), task("1.1"), task("1.2"), task("2")]);
  });

  it("3 源泉の完全エッジ集合を厳密値で列挙する（6.1, 6.2）", () => {
    expect(graph.edges).toEqual(expectedEdges);
  });

  it("要件→設計→タスクの両方向でノード対応を辿れる（6.1）", () => {
    // 要件 1.3 → 設計 / タスク方向
    expect(new Set(counterparts(graph.edges, req("1.3")).map(key))).toEqual(
      new Set(["design:Builder", "design:Parser", "design:Legacy", "task:1.2"]),
    );
    // 設計 Parser → 要件方向（逆引き）
    expect(new Set(counterparts(graph.edges, design("Parser")).map(key))).toEqual(
      new Set(["requirement:1.1", "requirement:1.2", "requirement:1.3", "requirement:2.1"]),
    );
    // タスク 1.2 → 要件方向（逆引き、クロス spec 含む）
    expect(new Set(counterparts(graph.edges, task("1.2")).map(key))).toEqual(
      new Set(["requirement:1.3", "requirement:beta/1.2"]),
    );
  });

  it("診断はこの段階では空配列で返る（診断生成はタスク 5.2 の責務）", () => {
    expect(graph.diagnostics).toEqual([]);
  });
});

describe("buildTraceGraph（クロス spec 解決の注入）", () => {
  it("リゾルバ未指定ではクロス spec 参照はエッジ・ノードにならない（6.6）", () => {
    const graph = buildTraceGraph({
      feature: "alpha",
      requirements: alphaRequirements,
      design: alphaDesign,
      tasks: alphaTasks,
    });
    expect(graph.nodes.requirements).toEqual([
      req("1.1"),
      req("1.2"),
      req("1.3"),
      req("2.1"),
    ]);
    expect(graph.edges).toEqual(
      expectedEdges.filter((e) => e.from.type !== "requirement" || e.from.id !== "beta/1.2"),
    );
  });

  it("参照先 spec の requirements に存在しない ID は解決されない（6.6）", () => {
    const graph = buildTraceGraph(
      {
        feature: "alpha",
        requirements: alphaRequirements,
        design: parseDesign(
          [
            "# Design",
            "",
            "### Builder",
            "",
            "| Field | Detail |",
            "|-------|--------|",
            "| Requirements | beta/9.9 |",
            "",
          ].join("\n"),
        ),
        tasks: null,
      },
      { resolveRequirements },
    );
    expect(graph.edges).toEqual([]);
    expect(graph.nodes.requirements).toEqual([req("1.1"), req("1.2"), req("1.3"), req("2.1")]);
    expect(graph.nodes.designElements).toEqual([design("Builder")]);
  });
});

describe("buildTraceGraph（成果物欠落時の縮退）", () => {
  it("design / tasks が null でも requirements ノードのみのグラフを返す", () => {
    const graph = buildTraceGraph({
      feature: "alpha",
      requirements: alphaRequirements,
      design: null,
      tasks: null,
    });
    expect(graph.nodes.requirements).toEqual([req("1.1"), req("1.2"), req("1.3"), req("2.1")]);
    expect(graph.nodes.designElements).toEqual([]);
    expect(graph.nodes.tasks).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.diagnostics).toEqual([]);
  });

  it("全成果物 null でも例外を投げず空グラフを返す", () => {
    const graph = buildTraceGraph({
      feature: "empty",
      requirements: null,
      design: null,
      tasks: null,
    });
    expect(graph).toEqual({
      feature: "empty",
      nodes: { requirements: [], designElements: [], tasks: [] },
      edges: [],
      diagnostics: [],
    });
  });
});
