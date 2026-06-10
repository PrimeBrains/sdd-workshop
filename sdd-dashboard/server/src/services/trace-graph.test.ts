import { describe, expect, it } from "vitest";
import { parseDesign } from "../parsers/design.js";
import { parseRequirements } from "../parsers/requirements.js";
import { parseTasks } from "../parsers/tasks.js";
import type { Position } from "../types/document.js";
import type { ComponentRequirements, DesignDoc, TaskEntry } from "../types/spec.js";
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

// ---------------------------------------------------------------------------
// 診断 position 帰属の検証用ヘルパー（パーサーが付与した position を期待値に流用する）
// ---------------------------------------------------------------------------

/** Traceability 行（structured）の position を取り出す */
function rowPosition(row: DesignDoc["traceability"][number] | undefined): Position {
  if (row === undefined || row.kind !== "structured") {
    throw new Error("structured な Traceability 行を期待");
  }
  return row.position;
}

/** コンポーネント Requirements フィールドのエントリを名前で引く */
function componentEntry(doc: DesignDoc, component: string): ComponentRequirements {
  const entry = doc.componentRequirements.find((e) => e.component === component);
  if (entry === undefined) {
    throw new Error(`コンポーネント ${component} がフィクスチャに存在しない`);
  }
  return entry;
}

/** major / subtask を ID で引く */
function findTask(tasks: TaskEntry[], id: string): TaskEntry {
  for (const entry of tasks) {
    if (entry.id === id) {
      return entry;
    }
    const sub = entry.subtasks.find((subtask) => subtask.id === id);
    if (sub !== undefined) {
      return sub;
    }
  }
  throw new Error(`タスク ${id} がフィクスチャに存在しない`);
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

  it("不在 ID は broken-link、unparsable トークンは unparsable-ref へ転記される（6.4, 6.7）", () => {
    // タスク 2 の注記 `2.1, 9.9, 15.*`: 9.9 は不在 ID、15.* は解釈不能トークン。
    // 全要件がカバー済みのため uncovered 診断は出ない（網羅走査の結果が空）
    const taskTwoPosition = findTask(alphaTasks.tasks, "2").position;
    expect(graph.diagnostics).toEqual([
      { kind: "broken-link", ref: "9.9", where: task("2"), position: taskTwoPosition },
      { kind: "unparsable-ref", raw: "15.*", where: task("2"), position: taskTwoPosition },
    ]);
  });
});

describe("buildTraceGraph（クロス spec 解決の注入）", () => {
  it("リゾルバ未指定ではクロス spec 参照はエッジ・ノードにならず broken-link 診断になる（6.4, 6.6）", () => {
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
    // 未解決クロス spec 参照は出現箇所ごとに broken-link として報告される
    const taskTwoPosition = findTask(alphaTasks.tasks, "2").position;
    expect(graph.diagnostics).toEqual([
      {
        kind: "broken-link",
        ref: "beta/1.2",
        where: design("Builder"),
        position: componentEntry(alphaDesign, "Builder").position,
      },
      {
        kind: "broken-link",
        ref: "beta/1.2",
        where: task("1.2"),
        position: findTask(alphaTasks.tasks, "1.2").position,
      },
      { kind: "broken-link", ref: "9.9", where: task("2"), position: taskTwoPosition },
      { kind: "unparsable-ref", raw: "15.*", where: task("2"), position: taskTwoPosition },
    ]);
  });

  it("参照先 spec の requirements に存在しない ID は解決されず broken-link 診断になる（6.4, 6.6）", () => {
    const crossOnlyDesign = parseDesign(
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
    );
    const graph = buildTraceGraph(
      {
        feature: "alpha",
        requirements: alphaRequirements,
        design: crossOnlyDesign,
        tasks: null,
      },
      { resolveRequirements },
    );
    expect(graph.edges).toEqual([]);
    expect(graph.nodes.requirements).toEqual([req("1.1"), req("1.2"), req("1.3"), req("2.1")]);
    expect(graph.nodes.designElements).toEqual([design("Builder")]);
    // broken-link 1 件 + どの設計行・タスク注記にも現れない全 AC の uncovered（6.5）
    expect(graph.diagnostics).toEqual([
      {
        kind: "broken-link",
        ref: "beta/9.9",
        where: design("Builder"),
        position: componentEntry(crossOnlyDesign, "Builder").position,
      },
      { kind: "design-uncovered", requirementId: "1.1" },
      { kind: "design-uncovered", requirementId: "1.2" },
      { kind: "design-uncovered", requirementId: "1.3" },
      { kind: "design-uncovered", requirementId: "2.1" },
      { kind: "task-uncovered", requirementId: "1.1" },
      { kind: "task-uncovered", requirementId: "1.2" },
      { kind: "task-uncovered", requirementId: "1.3" },
      { kind: "task-uncovered", requirementId: "2.1" },
    ]);
  });
});

describe("buildTraceGraph（成果物欠落時の縮退）", () => {
  it("design / tasks が null なら全 AC が design-uncovered / task-uncovered になる（6.5）", () => {
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
    // 母集合は requirements の全 AC（成果物が無い = どの行にも現れない）
    expect(graph.diagnostics).toEqual([
      { kind: "design-uncovered", requirementId: "1.1" },
      { kind: "design-uncovered", requirementId: "1.2" },
      { kind: "design-uncovered", requirementId: "1.3" },
      { kind: "design-uncovered", requirementId: "2.1" },
      { kind: "task-uncovered", requirementId: "1.1" },
      { kind: "task-uncovered", requirementId: "1.2" },
      { kind: "task-uncovered", requirementId: "1.3" },
      { kind: "task-uncovered", requirementId: "2.1" },
    ]);
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

/**
 * 4 種診断の件数ちょうど検出用フィクスチャ "gamma"（タスク 5.2 完了条件）。
 * 仕込み: (a) 旧範囲 1.1-1.4 の展開後に不在 1.4、(b) 直接不在 9.9、
 * (c) どの設計行にも現れない 2.1、(d) どのタスク注記にも現れない 1.2 / 1.3 / 2.1、
 * (e) unparsable トークン 15.*（設計行）と `1.2 (一部)`（タスク注記）。
 */
const gammaRequirementsMd = `# Requirements

### Requirement 1: 診断

#### Acceptance Criteria

1. Gamma AC one.
2. Gamma AC two.
3. Gamma AC three.

### Requirement 2: 未カバー

#### Acceptance Criteria

1. Gamma AC four.
`;

const gammaDesignMd = `# Design

## Requirements Traceability

| Requirement | Summary | Components | Interfaces | Flows |
|-------------|---------|------------|------------|-------|
| 1.1-1.4 | 旧表記展開 | Legacy | — | — |
| 9.9 | 直接不在 | Direct | — | — |
| 15.* | 不正トークン | Wild | — | — |
`;

const gammaTasksMd = `# 実装計画

- [ ] 1. タスク
  - _Requirements: 1.1, 7.7, 1.2 (一部)_
`;

describe("buildTraceGraph（グラフ診断 — 4 種の件数ちょうど検出）", () => {
  const gammaRequirements = parseRequirements(gammaRequirementsMd);
  const gammaDesign = parseDesign(gammaDesignMd);
  const gammaTasks = parseTasks(gammaTasksMd);
  const graph = buildTraceGraph({
    feature: "gamma",
    requirements: gammaRequirements,
    design: gammaDesign,
    tasks: gammaTasks,
  });

  it("broken-link / design-uncovered / task-uncovered / unparsable-ref が期待件数ちょうど検出される（6.3, 6.4, 6.5, 6.7）", () => {
    const taskOnePosition = findTask(gammaTasks.tasks, "1").position;
    expect(graph.diagnostics).toEqual([
      // (a) 旧範囲 1.1-1.4 → 展開後 ID ごとの実在照合で 1.4 のみ不在（6.3）
      {
        kind: "broken-link",
        ref: "1.4",
        where: design("Legacy"),
        position: rowPosition(gammaDesign.traceability[0]),
      },
      // (b) 直接不在 9.9（6.4）
      {
        kind: "broken-link",
        ref: "9.9",
        where: design("Direct"),
        position: rowPosition(gammaDesign.traceability[1]),
      },
      // (e) 設計行の unparsable トークン（6.7）
      {
        kind: "unparsable-ref",
        raw: "15.*",
        where: design("Wild"),
        position: rowPosition(gammaDesign.traceability[2]),
      },
      // (b') タスク注記の不在 ID（6.4）と (e') unparsable 注記トークン（6.7）
      { kind: "broken-link", ref: "7.7", where: task("1"), position: taskOnePosition },
      { kind: "unparsable-ref", raw: "1.2 (一部)", where: task("1"), position: taskOnePosition },
      // (c) どの設計行にも現れない AC（6.5）
      { kind: "design-uncovered", requirementId: "2.1" },
      // (d) どのタスク注記にも現れない AC（6.5）
      { kind: "task-uncovered", requirementId: "1.2" },
      { kind: "task-uncovered", requirementId: "1.3" },
      { kind: "task-uncovered", requirementId: "2.1" },
    ]);
    // 種別ごとの件数ちょうど（完了条件の明示確認）
    const count = (kind: string) => graph.diagnostics.filter((d) => d.kind === kind).length;
    expect(count("broken-link")).toBe(3);
    expect(count("unparsable-ref")).toBe(2);
    expect(count("design-uncovered")).toBe(1);
    expect(count("task-uncovered")).toBe(3);
  });

  it("診断があってもグラフ構築は完了する（6.7）", () => {
    expect(graph.nodes.requirements).toEqual([req("1.1"), req("1.2"), req("1.3"), req("2.1")]);
    expect(graph.nodes.designElements).toEqual([
      design("Legacy"),
      design("Direct"),
      design("Wild"),
    ]);
    expect(graph.nodes.tasks).toEqual([task("1")]);
    expect(graph.edges).toEqual([
      // 旧範囲展開のうち実在する 1.1〜1.3 はエッジになる（6.3）
      edge("1.1", design("Legacy"), "design-table", true),
      edge("1.2", design("Legacy"), "design-table", true),
      edge("1.3", design("Legacy"), "design-table", true),
      edge("1.1", task("1"), "task-annotation"),
    ]);
  });
});
