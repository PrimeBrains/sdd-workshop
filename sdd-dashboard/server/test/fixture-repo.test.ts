/**
 * フィクスチャリポジトリ統合テスト — tasks.md 9.1。
 * （design.md Testing Strategy「Integration Tests」。Requirements 2.1, 2.2, 2.3, 6.3, 6.4, 6.5, 13.3）
 *
 * 本番アプリ全体（createApp）を `test/fixtures/repo/` の固定フィクスチャ `.kiro` ツリーへ
 * マウントし、HTTP レスポンスを厳密値でアサートする。フィクスチャは手で監査可能な最小構成:
 * - fixture-normal: 新表記・完全整合（全 8 成果物 + validation 3 種。gap は decision キーなし）
 * - fixture-legacy: 旧範囲表記（design `1.1-1.3` / tasks `1.1-1.2`）+ リンク切れ参照
 * - fixture-broken: spec.json 破損 + 構造化不能 tasks.md + frontmatter 破損 validation-impl.md
 *
 * ## 期待値の導出（RED: フィクスチャと parser/builder 仕様から手計算。実行前に確定）
 *
 * fixture-legacy の AC 母集合 = [1.1, 1.2, 1.3, 2.1, 2.2]（Requirement 1 に AC 3 件、2 に 2 件）。
 *
 * design.md Traceability:
 *   行1 `1.1-1.3` → 旧表記展開 [1.1, 1.2, 1.3]（全実在）→ legacyExpanded エッジ 3 本 → Importer
 *   行2 `2.1, 9.9` → 2.1 エッジ 1 本 → Notifier、9.9 は不在 → broken-link（行2 = design.md 8 行目）
 *   → design カバー = {1.1, 1.2, 1.3, 2.1} → design-uncovered = [2.2]（1 件）
 * tasks.md:
 *   task 1 `1.1-1.2` → 展開 [1.1, 1.2] → legacyExpanded エッジ 2 本
 *   task 2 `2.1, 3.5` → 2.1 エッジ 1 本、3.5 は不在 → broken-link（task 2 = tasks.md 5 行目開始）
 *   → task カバー = {1.1, 1.2, 2.1} → task-uncovered = [1.3, 2.2]（2 件）
 * 診断合計 = broken-link 2 + design-uncovered 1 + task-uncovered 2 = 5 件
 * （順序は trace-graph.ts の規約: 出現箇所診断（源泉処理順）→ design-uncovered → task-uncovered）。
 * エッジ合計 = design-table 4 + task-annotation 3 = 7 本。
 *
 * fixture-normal は全 AC（1.1, 1.2, 2.1, 2.2）が design 行・タスク注記の両方でカバーされ
 * 診断 0 件。エッジ = design-table 4 + component-field 2（SearchService 詳細表）+
 * task-annotation 4 = 10 本。
 *
 * fixture-broken の一覧エントリ = spec.json JSON 構文不正の parse-failure 診断ちょうど 1 件
 * （メタデータ全 null、エントリ自体は省略されない。2.3）。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Hono } from "hono";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/api/app.js";
import { createRepoContext } from "../src/config.js";
import type { Position } from "../src/types/document.js";
import type {
  AdrDoc,
  AdrSummary,
  SkillDoc,
  SkillSummary,
  SteeringDoc,
  SteeringDocSummary,
} from "../src/types/resources.js";
import type {
  DesignDoc,
  RequirementsDoc,
  SpecDetail,
  SpecSummary,
  TaskEntry,
  TasksDoc,
} from "../src/types/spec.js";
import type { TraceGraph } from "../src/types/trace.js";
import { createEventBus } from "../src/watcher/event-bus.js";

// ---------------------------------------------------------------------------
// フィクスチャリポジトリへの本番アプリのマウント
// ---------------------------------------------------------------------------

const FIXTURE_REPO = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "repo");

let app: Hono;

beforeAll(() => {
  // 本番のコンテキスト解決（createRepoContext）+ 本番の組み立て（createApp）をそのまま使う
  const result = createRepoContext(FIXTURE_REPO, 0);
  if (!result.ok) {
    throw new Error(`フィクスチャリポジトリが不正です: ${result.message}`);
  }
  app = createApp({
    context: result.context,
    bus: createEventBus(),
    auditSink: () => undefined,
    logError: () => undefined,
  });
});

/** GET して 200 を確認し JSON を返す */
async function getJson<T>(path: string): Promise<T> {
  const res = await app.request(path);
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

/** フィクスチャ内の元ファイルを読む（情報無欠落の照合対象） */
function readFixture(...segments: string[]): string {
  return readFileSync(join(FIXTURE_REPO, ...segments), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. GET /api/specs — 一覧: 件数・成果物フラグ・破損 spec.json の診断（2.1, 2.3）
// ---------------------------------------------------------------------------

describe("GET /api/specs（一覧、2.1, 2.3）", () => {
  it("3 spec すべてを feature 名昇順で返す（破損 spec も省略しない）", async () => {
    const specs = await getJson<SpecSummary[]>("/api/specs");
    expect(specs.map((s) => s.feature)).toEqual([
      "fixture-broken",
      "fixture-legacy",
      "fixture-normal",
    ]);
  });

  it("fixture-normal: メタデータ・成果物フラグ全 8 種を厳密値で返す", async () => {
    const specs = await getJson<SpecSummary[]>("/api/specs");
    const normal = specs.find((s) => s.feature === "fixture-normal");
    expect(normal).toEqual({
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
    });
  });

  it("fixture-legacy: app 欠落は null（未分類）、診断なし、成果物フラグ厳密値", async () => {
    const specs = await getJson<SpecSummary[]>("/api/specs");
    const legacy = specs.find((s) => s.feature === "fixture-legacy");
    expect(legacy?.app).toBeNull();
    expect(legacy?.diagnostics).toEqual([]);
    expect(legacy?.artifacts).toEqual({
      brief: false,
      requirements: true,
      design: true,
      tasks: true,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    });
  });

  it("fixture-broken: spec.json 破損でもエントリが返り、parse-failure 診断ちょうど 1 件 + メタ全 null（2.3）", async () => {
    const specs = await getJson<SpecSummary[]>("/api/specs");
    const broken = specs.find((s) => s.feature === "fixture-broken");
    expect(broken).toBeDefined();
    expect(broken?.app).toBeNull();
    expect(broken?.phase).toBeNull();
    expect(broken?.language).toBeNull();
    expect(broken?.approvals).toBeNull();
    expect(broken?.readyForImplementation).toBeNull();
    expect(broken?.createdAt).toBeNull();
    expect(broken?.updatedAt).toBeNull();
    expect(broken?.diagnostics).toHaveLength(1);
    expect(broken?.diagnostics[0]).toMatchObject({ kind: "parse-failure", position: null });
    expect(broken?.diagnostics[0]?.message).toMatch(/JSON 構文が不正/);
    expect(broken?.artifacts).toEqual({
      brief: false,
      requirements: true,
      design: false,
      tasks: true,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: true,
    });
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/specs/fixture-normal — 詳細: 構造化値の厳密検証（2.2）
// ---------------------------------------------------------------------------

describe("GET /api/specs/fixture-normal（詳細、2.2）", () => {
  it("requirements: 要件 ID・タイトル・Objective・AC・和訳を厳密値で構造化する", async () => {
    const detail = await getJson<SpecDetail>("/api/specs/fixture-normal");
    const doc = detail.requirements;
    expect(doc).not.toBeNull();
    const projected = (doc as RequirementsDoc).requirements.map((block) =>
      block.kind === "structured"
        ? {
            id: block.id,
            title: block.title,
            objective: block.objective,
            criteria: block.criteria.map((c) =>
              c.kind === "structured" ? { id: c.id, text: c.text, ja: c.translationJa } : c,
            ),
          }
        : block,
    );
    expect(projected).toEqual([
      {
        id: "1",
        title: "検索機能",
        objective: "利用者として、語句で記事を検索したい。目的の記事へ素早く到達するため。",
        criteria: [
          {
            id: "1.1",
            text: "When a user submits a keyword, the system shall return matching articles.",
            ja: "利用者がキーワードを送信したとき、システムは一致する記事を返す。",
          },
          {
            id: "1.2",
            text: "If no article matches, the system shall return an empty list.",
            ja: "一致する記事がない場合、システムは空のリストを返す。",
          },
        ],
      },
      {
        id: "2",
        title: "記事表示",
        objective: "利用者として、記事本文を読みたい。検索結果から内容を確認するため。",
        criteria: [
          {
            id: "2.1",
            text: "When a user opens an article, the system shall render its body.",
            ja: "利用者が記事を開いたとき、システムは本文を描画する。",
          },
          {
            id: "2.2",
            text: "The system shall show the last updated date of the article.",
            ja: "システムは記事の最終更新日を表示する。",
          },
        ],
      },
    ]);
  });

  it("design: Traceability 2 行とコンポーネント Requirements フィールドを厳密値で構造化する", async () => {
    const detail = await getJson<SpecDetail>("/api/specs/fixture-normal");
    const design = detail.design as DesignDoc;
    expect(design).not.toBeNull();
    const rows = design.traceability.map((row) =>
      row.kind === "structured"
        ? {
            refs: row.refs,
            summary: row.summary,
            components: row.components,
            interfaces: row.interfaces,
            flows: row.flows,
          }
        : row,
    );
    expect(rows).toEqual([
      {
        refs: [
          { kind: "id", id: "1.1", raw: "1.1" },
          { kind: "id", id: "1.2", raw: "1.2" },
        ],
        summary: "検索",
        components: "SearchService",
        interfaces: "search()",
        flows: "検索フロー",
      },
      {
        refs: [
          { kind: "id", id: "2.1", raw: "2.1" },
          { kind: "id", id: "2.2", raw: "2.2" },
        ],
        summary: "表示",
        components: "ArticleView",
        interfaces: "render()",
        flows: "表示フロー",
      },
    ]);
    expect(
      design.componentRequirements.map((e) => ({ component: e.component, refs: e.refs })),
    ).toEqual([
      {
        component: "SearchService",
        refs: [
          { kind: "id", id: "1.1", raw: "1.1" },
          { kind: "id", id: "1.2", raw: "1.2" },
        ],
      },
    ]);
  });

  it("tasks: 階層・チェック状態・(P)・注記 3 種を厳密値で構造化する", async () => {
    const detail = await getJson<SpecDetail>("/api/specs/fixture-normal");
    const tasks = (detail.tasks as TasksDoc).tasks;
    const project = (t: TaskEntry): Record<string, unknown> => ({
      id: t.id,
      description: t.description,
      checked: t.checked,
      parallel: t.parallel,
      optional: t.optional,
      details: t.details,
      requirements: t.requirements,
      depends: t.depends,
      boundary: t.boundary,
      subtasks: t.subtasks.map(project),
    });
    expect(tasks.map(project)).toEqual([
      {
        id: "1",
        description: "検索と表示を実装する",
        checked: true,
        parallel: false,
        optional: false,
        details: [],
        requirements: [],
        depends: [],
        boundary: null,
        subtasks: [
          {
            id: "1.1",
            description: "検索 API を実装する",
            checked: true,
            parallel: true,
            optional: false,
            details: ["キーワード一致と空結果を実装する"],
            requirements: [
              { kind: "id", id: "1.1", raw: "1.1" },
              { kind: "id", id: "1.2", raw: "1.2" },
            ],
            depends: [],
            boundary: null,
            subtasks: [],
          },
          {
            id: "1.2",
            description: "記事表示を実装する",
            checked: false,
            parallel: false,
            optional: false,
            details: [],
            requirements: [
              { kind: "id", id: "2.1", raw: "2.1" },
              { kind: "id", id: "2.2", raw: "2.2" },
            ],
            depends: ["1.1"],
            boundary: "src/article-view.ts",
            subtasks: [],
          },
        ],
      },
    ]);
  });

  it("validations: gap（decision キーなし → null）/ design / impl を厳密値で返す", async () => {
    const detail = await getJson<SpecDetail>("/api/specs/fixture-normal");
    expect(
      detail.validations.map((v) => ({
        type: v.type,
        feature: v.feature,
        date: v.date,
        decision: v.decision,
        diagnostics: v.diagnostics,
      })),
    ).toEqual([
      {
        type: "gap",
        feature: "fixture-normal",
        date: "2026-06-02",
        decision: null,
        diagnostics: [],
      },
      {
        type: "design",
        feature: "fixture-normal",
        date: "2026-06-03",
        decision: "GO",
        diagnostics: [],
      },
      {
        type: "impl",
        feature: "fixture-normal",
        date: "2026-06-05",
        decision: "GO",
        diagnostics: [],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/specs/:feature/trace — 旧表記展開と診断件数の厳密検証（6.3, 6.4, 6.5）
// ---------------------------------------------------------------------------

describe("GET /api/specs/fixture-legacy/trace（旧範囲表記、6.3, 6.4, 6.5）", () => {
  it("詳細応答の参照トークン: 旧範囲表記が legacy フラグ付きで厳密に展開される（6.3）", async () => {
    const detail = await getJson<SpecDetail>("/api/specs/fixture-legacy");
    const row0 = (detail.design as DesignDoc).traceability[0];
    expect(row0?.kind).toBe("structured");
    if (row0?.kind === "structured") {
      expect(row0.refs[0]).toEqual({
        kind: "range",
        from: "1.1",
        to: "1.3",
        expanded: ["1.1", "1.2", "1.3"],
        legacy: true,
        raw: "1.1-1.3",
      });
    }
    expect((detail.tasks as TasksDoc).tasks[0]?.requirements[0]).toEqual({
      kind: "range",
      from: "1.1",
      to: "1.2",
      expanded: ["1.1", "1.2"],
      legacy: true,
      raw: "1.1-1.2",
    });
  });

  it("エッジ: 展開 ID ごとの legacyExpanded エッジを含む全 7 本を厳密に列挙する（6.1, 6.3）", async () => {
    const trace = await getJson<TraceGraph>("/api/specs/fixture-legacy/trace");
    expect(trace.feature).toBe("fixture-legacy");
    expect(trace.edges).toEqual([
      // design 行1: 1.1-1.3 の展開（legacyExpanded: true）
      { from: { type: "requirement", id: "1.1" }, to: { type: "design", name: "Importer" }, source: "design-table", legacyExpanded: true },
      { from: { type: "requirement", id: "1.2" }, to: { type: "design", name: "Importer" }, source: "design-table", legacyExpanded: true },
      { from: { type: "requirement", id: "1.3" }, to: { type: "design", name: "Importer" }, source: "design-table", legacyExpanded: true },
      // design 行2: 2.1 のみ（9.9 はリンク切れでエッジにならない）
      { from: { type: "requirement", id: "2.1" }, to: { type: "design", name: "Notifier" }, source: "design-table", legacyExpanded: false },
      // task 1: 1.1-1.2 の展開
      { from: { type: "requirement", id: "1.1" }, to: { type: "task", id: "1" }, source: "task-annotation", legacyExpanded: true },
      { from: { type: "requirement", id: "1.2" }, to: { type: "task", id: "1" }, source: "task-annotation", legacyExpanded: true },
      // task 2: 2.1 のみ（3.5 はリンク切れでエッジにならない）
      { from: { type: "requirement", id: "2.1" }, to: { type: "task", id: "2" }, source: "task-annotation", legacyExpanded: false },
    ]);
  });

  it("診断: broken-link 2 / design-uncovered 1 / task-uncovered 2 の計 5 件を厳密値で返す（6.4, 6.5）", async () => {
    const trace = await getJson<TraceGraph>("/api/specs/fixture-legacy/trace");
    // 件数の厳密検証（手計算: ヘッダーコメントの導出参照）
    const count = (kind: string): number =>
      trace.diagnostics.filter((d) => d.kind === kind).length;
    expect(count("broken-link")).toBe(2);
    expect(count("design-uncovered")).toBe(1);
    expect(count("task-uncovered")).toBe(2);
    expect(count("unparsable-ref")).toBe(0);
    expect(trace.diagnostics).toHaveLength(5);
    // 内容と順序（出現箇所診断 → design-uncovered → task-uncovered）
    expect(trace.diagnostics).toMatchObject([
      {
        kind: "broken-link",
        ref: "9.9",
        where: { type: "design", name: "Notifier" },
        position: { startLine: 8, endLine: 8 }, // design.md の Traceability 行2
      },
      {
        kind: "broken-link",
        ref: "3.5",
        where: { type: "task", id: "2" },
        position: { startLine: 5 }, // tasks.md の task 2 項目（5-6 行）
      },
      { kind: "design-uncovered", requirementId: "2.2" },
      { kind: "task-uncovered", requirementId: "1.3" },
      { kind: "task-uncovered", requirementId: "2.2" },
    ]);
  });

  it("ノード: 要件 AC 全 5 件・設計要素 2 件・タスク 2 件を厳密に列挙する", async () => {
    const trace = await getJson<TraceGraph>("/api/specs/fixture-legacy/trace");
    expect(trace.nodes).toEqual({
      requirements: [
        { type: "requirement", id: "1.1" },
        { type: "requirement", id: "1.2" },
        { type: "requirement", id: "1.3" },
        { type: "requirement", id: "2.1" },
        { type: "requirement", id: "2.2" },
      ],
      designElements: [
        { type: "design", name: "Importer" },
        { type: "design", name: "Notifier" },
      ],
      tasks: [
        { type: "task", id: "1" },
        { type: "task", id: "2" },
      ],
    });
  });
});

describe("GET /api/specs/fixture-normal/trace（完全整合 spec）", () => {
  it("診断 0 件・エッジ 10 本（design 4 + component 2 + task 4）・legacy なし", async () => {
    const trace = await getJson<TraceGraph>("/api/specs/fixture-normal/trace");
    expect(trace.diagnostics).toEqual([]);
    expect(trace.edges).toHaveLength(10);
    expect(trace.edges.every((e) => e.legacyExpanded === false)).toBe(true);
    expect(trace.edges.filter((e) => e.source === "design-table")).toHaveLength(4);
    expect(trace.edges.filter((e) => e.source === "component-field")).toHaveLength(2);
    expect(trace.edges.filter((e) => e.source === "task-annotation")).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 4. 情報無欠落不変則 — 構造化 + raw ブロック = 元文書全体（13.3）
// ---------------------------------------------------------------------------

/** API レスポンス上のブロック: position + （raw の場合）レスポンスが運ぶ markdown 本文 */
interface ResponseBlock {
  position: Position;
  /** raw ブロックのみ。レスポンス側のペイロードから復元に使う */
  markdown?: string;
}

/**
 * ブロック列が元文書 [0, length) を隙間なく・重複なくタイルし、
 * 「構造化部分は position で元文書を指し、raw 部分はレスポンス自身の markdown を運ぶ」
 * 復元結果が元文書と一致することを検証する（13.3）。
 */
function assertNoInfoLoss(original: string, blocks: ResponseBlock[]): void {
  const sorted = [...blocks].sort((a, b) => a.position.startOffset - b.position.startOffset);
  let cursor = 0;
  let reconstructed = "";
  for (const block of sorted) {
    expect(block.position.startOffset).toBe(cursor); // 隙間も重複もない
    const slice = original.slice(block.position.startOffset, block.position.endOffset);
    if (block.markdown !== undefined) {
      // raw ブロックはレスポンス自身が元文書の該当範囲を欠落なく運ぶ
      expect(block.markdown).toBe(slice);
      reconstructed += block.markdown;
    } else {
      reconstructed += slice;
    }
    cursor = block.position.endOffset;
  }
  expect(cursor).toBe(original.length);
  expect(reconstructed).toBe(original);
}

/** RequirementsDoc のトップレベルブロック列（requirements + otherBlocks） */
function requirementsBlocks(doc: RequirementsDoc): ResponseBlock[] {
  return [
    ...doc.requirements.map((b) =>
      b.kind === "raw" ? { position: b.position, markdown: b.markdown } : { position: b.position },
    ),
    ...doc.otherBlocks.map((b) =>
      b.kind === "raw" ? { position: b.position, markdown: b.markdown } : { position: b.position },
    ),
  ];
}

/** TasksDoc のトップレベルブロック列（全タスクのフラット展開 + otherBlocks） */
function tasksBlocks(doc: TasksDoc): ResponseBlock[] {
  const flatten = (tasks: TaskEntry[]): TaskEntry[] =>
    tasks.flatMap((t) => [t, ...flatten(t.subtasks)]);
  return [
    ...flatten(doc.tasks).map((t) => ({ position: t.position })),
    ...doc.otherBlocks.map((b) => ({ position: b.position, markdown: b.markdown })),
  ];
}

describe("情報無欠落不変則（13.3）— 全 spec の全成果物で構造化 + raw = 元文書全体", () => {
  const specsUnderTest = ["fixture-normal", "fixture-legacy", "fixture-broken"] as const;

  it.each(specsUnderTest)("%s: requirements.md / tasks.md がタイルし復元一致する", async (feature) => {
    const detail = await getJson<SpecDetail>(`/api/specs/${feature}`);

    const requirementsSource = readFixture(".kiro", "specs", feature, "requirements.md");
    assertNoInfoLoss(requirementsSource, requirementsBlocks(detail.requirements as RequirementsDoc));

    const tasksSource = readFixture(".kiro", "specs", feature, "tasks.md");
    assertNoInfoLoss(tasksSource, tasksBlocks(detail.tasks as TasksDoc));
  });

  it.each(["fixture-normal", "fixture-legacy"] as const)(
    "%s: design.md のトップレベルセクションが全文をカバーし raw 行が原文一致する",
    async (feature) => {
      const detail = await getJson<SpecDetail>(`/api/specs/${feature}`);
      const design = detail.design as DesignDoc;
      const source = readFixture(".kiro", "specs", feature, "design.md");
      assertNoInfoLoss(
        source,
        design.sections.map((s) => ({ position: s.position })),
      );
      for (const row of design.traceability) {
        if (row.kind === "raw") {
          expect(row.markdown).toBe(
            source.slice(row.position.startOffset, row.position.endOffset),
          );
        }
      }
    },
  );

  it("fixture-normal: brief / research / validation 3 種は content が元文書全文と一致する", async () => {
    const detail = await getJson<SpecDetail>("/api/specs/fixture-normal");
    expect(detail.brief?.content).toBe(readFixture(".kiro", "specs", "fixture-normal", "brief.md"));
    expect(detail.research?.content).toBe(
      readFixture(".kiro", "specs", "fixture-normal", "research.md"),
    );
    const files = {
      gap: "validation-gap.md",
      design: "validation-design.md",
      impl: "validation-impl.md",
    } as const;
    expect(detail.validations).toHaveLength(3);
    for (const report of detail.validations) {
      expect(report.content).toBe(
        readFixture(".kiro", "specs", "fixture-normal", files[report.type]),
      );
    }
  });

  it("fixture-broken: 構造化不能なタスク行は raw として保持され、構造化タスクは task 2 のみ", async () => {
    const detail = await getJson<SpecDetail>("/api/specs/fixture-broken");
    const tasks = detail.tasks as TasksDoc;
    expect(tasks.tasks.map((t) => t.id)).toEqual(["2"]);
    expect(tasks.tasks[0]?.requirements).toEqual([{ kind: "id", id: "1.1", raw: "1.1" }]);
    // 解釈不能だった 2 行はいずれかの raw ブロックに原文のまま残る（欠落しない）
    const rawText = tasks.otherBlocks.map((b) => b.markdown).join("");
    expect(rawText).toContain("[~] 1. 非標準チェック状態の行（構造化できない）");
    expect(rawText).toContain("メモ: ID なしのチェックボックス行（構造化できない）");
  });

  it("fixture-broken: frontmatter 破損 validation-impl.md は parse-failure 診断 + 全文保持（7.5, 13.3）", async () => {
    const detail = await getJson<SpecDetail>("/api/specs/fixture-broken");
    expect(detail.validations).toHaveLength(1);
    const report = detail.validations[0];
    expect(report).toMatchObject({
      type: "impl", // ファイル名由来のフォールバック
      feature: "fixture-broken", // 要求 feature へのフォールバック
      date: null,
      decision: null,
    });
    expect(report?.diagnostics).toHaveLength(1);
    expect(report?.diagnostics[0]?.kind).toBe("parse-failure");
    expect(report?.content).toBe(
      readFixture(".kiro", "specs", "fixture-broken", "validation-impl.md"),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. steering / skills / ADR — 読取 API 全カバー + 情報無欠落
// ---------------------------------------------------------------------------

describe("リソース読取（steering / skills / ADR）", () => {
  it("GET /api/steering: 2 文書を name 昇順・先頭見出しタイトル付きで返す", async () => {
    const list = await getJson<SteeringDocSummary[]>("/api/steering");
    expect(list).toEqual([
      { name: "product", title: "Product Overview" },
      { name: "tech", title: "Technology Stack" },
    ]);
  });

  it("GET /api/steering/product: content が元文書全文と一致する", async () => {
    const doc = await getJson<SteeringDoc>("/api/steering/product");
    expect(doc.name).toBe("product");
    expect(doc.content).toBe(readFixture(".kiro", "steering", "product.md"));
  });

  it("GET /api/skills: en/ja 有無と metadata.origin を厳密値で返す", async () => {
    const list = await getJson<SkillSummary[]>("/api/skills");
    expect(list).toEqual([
      { name: "fixture-skill", hasEn: true, hasJa: true, origin: "custom" },
    ]);
  });

  it("GET /api/skills/fixture-skill: 英日とも content が元文書全文と一致する", async () => {
    const doc = await getJson<SkillDoc>("/api/skills/fixture-skill");
    expect(doc.origin).toBe("custom");
    expect(doc.en.content).toBe(readFixture(".claude", "skills", "fixture-skill", "SKILL.md"));
    expect(doc.ja?.content).toBe(
      readFixture(".claude", "skills", "fixture-skill", "SKILL.ja.md"),
    );
  });

  it("GET /api/adr: template.md を除く 1 件のみ、frontmatter（string supersedes 含む）厳密値", async () => {
    const list = await getJson<AdrSummary[]>("/api/adr");
    expect(list).toEqual([
      {
        name: "0001-fixture-decision",
        frontmatter: {
          id: 1,
          title: "フィクスチャ構成を採用する",
          status: "accepted",
          date: "2026-06-04",
          app: null,
          specs: ["fixture-normal"],
          requirements: ["fixture-normal/1.1"],
          supersedes: "0000",
          superseded_by: null,
        },
        diagnostics: [],
      },
    ]);
  });

  it("GET /api/adr/0001-fixture-decision: content が元文書全文と一致しセクション構造を持つ", async () => {
    const doc = await getJson<AdrDoc>("/api/adr/0001-fixture-decision");
    expect(doc.content).toBe(readFixture(".kiro", "adr", "0001-fixture-decision.md"));
    expect(doc.diagnostics).toEqual([]);
    // 本文セクション（H1 配下に Context / Decision / Consequences）
    expect(doc.sections.map((s) => s.title)).toEqual(["ADR-0001: フィクスチャ構成を採用する"]);
    expect(doc.sections[0]?.children.map((s) => s.title)).toEqual([
      "Context",
      "Decision",
      "Consequences",
    ]);
  });
});
