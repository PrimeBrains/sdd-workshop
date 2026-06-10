/**
 * 読取ルート（specs）の統合テスト — フィクスチャリポジトリ → Hono app → JSON レスポンス。
 * 完了条件（tasks.md 8.1）: 全読取エンドポイント呼び出しが契約型どおりの JSON を返す。
 * - GET /api/specs → SpecSummary[]（2.1。破損 spec.json も診断付きで含む）
 * - GET /api/specs/:feature → SpecDetail（2.2。validations は ValidationService 委譲、7.4）
 * - GET /api/specs/:feature/trace → TraceGraph（6.1。クロス spec 解決を含む）
 * - 不在 / 許可外文字パラメータ → 404 SPEC_NOT_FOUND の構造化エラー
 * エラー変換は task 8.3 のミドルウェア契約（AppError → ERROR_HTTP_STATUS + ApiError JSON）を
 * 写した薄いハンドラで検証する。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import { AppError, ERROR_HTTP_STATUS, ErrorCode } from "../errors/codes.js";
import { createKiroScanner } from "../services/kiro-scanner.js";
import { createSpecService } from "../services/spec-service.js";
import { createValidationService } from "../services/validation-service.js";
import { createSpecsRoutes } from "./specs.js";

// ---------------------------------------------------------------------------
// フィクスチャリポジトリ
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-api-specs-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

function makeSpec(context: RepoContext, feature: string, files: Record<string, string>): void {
  const dir = join(context.kiroDir, "specs", feature);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
}

const ALPHA_SPEC_JSON = JSON.stringify({
  feature_name: "alpha",
  app: "dashboard",
  phase: "tasks-approved",
  language: "japanese",
  approvals: {
    requirements: { generated: true, approved: true },
    design: { generated: true, approved: true },
    tasks: { generated: true, approved: true },
  },
  ready_for_implementation: true,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-02T00:00:00Z",
});

const ALPHA_REQUIREMENTS = [
  "# Requirements",
  "",
  "### Requirement 1: サンプル要件",
  "",
  "**Objective:** サンプルの目的。",
  "",
  "#### Acceptance Criteria",
  "",
  "1. The system shall list specs.",
  "   - 和訳: 一覧を返す。",
  "2. The system shall return detail.",
  "3. The system shall build trace.",
  "",
].join("\n");

const ALPHA_DESIGN = [
  "# Design",
  "",
  "## Requirements Traceability",
  "",
  "| Requirement | Summary | Components | Interfaces | Flows |",
  "|-------------|---------|------------|------------|-------|",
  "| 1.1, 1.2 | 一覧と詳細 | SpecListView | — | — |",
  "",
].join("\n");

const ALPHA_TASKS = [
  "# Tasks",
  "",
  "- [x] 1. メジャータスク",
  "- [ ] 1.1 サブタスク",
  "  - _Requirements: 1.1, beta/1.1, 9.9_",
  "",
].join("\n");

const ALPHA_VALIDATION_GAP = [
  "---",
  "type: gap",
  "feature: alpha",
  'date: "2026-06-01"',
  "---",
  "",
  "# Gap 分析",
  "",
  "本文。",
  "",
].join("\n");

const BETA_SPEC_JSON = JSON.stringify({
  feature_name: "beta",
  phase: "initialized",
  language: "japanese",
  approvals: {
    requirements: { generated: false, approved: false },
    design: { generated: false, approved: false },
    tasks: { generated: false, approved: false },
  },
  ready_for_implementation: false,
  created_at: "2026-06-03T00:00:00Z",
  updated_at: "2026-06-03T00:00:00Z",
});

const BETA_REQUIREMENTS = [
  "# Requirements",
  "",
  "### Requirement 1: ベータ要件",
  "",
  "#### Acceptance Criteria",
  "",
  "1. The system shall exist.",
  "",
].join("\n");

/** 正常 spec（alpha）/ クロス spec 参照先（beta）/ spec.json 破損（broken）の 3 spec を作る */
function makeFixtureTree(context: RepoContext): void {
  makeSpec(context, "alpha", {
    "spec.json": ALPHA_SPEC_JSON,
    "requirements.md": ALPHA_REQUIREMENTS,
    "design.md": ALPHA_DESIGN,
    "tasks.md": ALPHA_TASKS,
    "validation-gap.md": ALPHA_VALIDATION_GAP,
  });
  makeSpec(context, "beta", {
    "spec.json": BETA_SPEC_JSON,
    "requirements.md": BETA_REQUIREMENTS,
  });
  makeSpec(context, "broken", { "spec.json": "{ broken json" });
}

// ---------------------------------------------------------------------------
// app 組み立て（ValidationService → SpecService の readValidations seam をここで配線する）
// ---------------------------------------------------------------------------

/** task 8.3 のエラーミドルウェア契約を写した薄いハンドラ（AppError → ステータス + ApiError JSON） */
function withErrorHandler(app: Hono): Hono {
  app.onError((error, c) => {
    if (error instanceof AppError && error.code !== ErrorCode.REPO_INVALID) {
      return c.json(
        { error: { code: error.code, message: error.message } },
        ERROR_HTTP_STATUS[error.code],
      );
    }
    return c.json(
      { error: { code: ErrorCode.INTERNAL_ERROR, message: String(error) } },
      500,
    );
  });
  return app;
}

function makeApp(context: RepoContext): Hono {
  const scanner = createKiroScanner(context);
  const validationService = createValidationService(scanner);
  const specService = createSpecService({
    scanner,
    readValidations: (feature) => validationService.listForSpec(feature),
  });
  const app = withErrorHandler(new Hono());
  app.route("/api/specs", createSpecsRoutes({ specService, scanner }));
  return app;
}

async function getJson(app: Hono, path: string): Promise<{ status: number; body: any }> {
  const res = await app.request(path);
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// GET /api/specs（2.1）
// ---------------------------------------------------------------------------

describe("GET /api/specs", () => {
  it("全 spec をメタデータ + 成果物有無付きで feature 名昇順に返す（2.1）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const { status, body } = await getJson(makeApp(context), "/api/specs");

    expect(status).toBe(200);
    expect(body.map((entry: { feature: string }) => entry.feature)).toEqual([
      "alpha",
      "beta",
      "broken",
    ]);
    expect(body[0]).toEqual({
      feature: "alpha",
      app: "dashboard",
      phase: "tasks-approved",
      language: "japanese",
      approvals: {
        requirements: { generated: true, approved: true },
        design: { generated: true, approved: true },
        tasks: { generated: true, approved: true },
      },
      readyForImplementation: true,
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-02T00:00:00Z",
      artifacts: {
        brief: false,
        requirements: true,
        design: true,
        tasks: true,
        research: false,
        validationGap: true,
        validationDesign: false,
        validationImpl: false,
      },
      diagnostics: [],
    });
  });

  it("spec.json 破損の spec も省略せず、全 null メタ + parse-failure 診断で含める（2.3）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const { status, body } = await getJson(makeApp(context), "/api/specs");

    expect(status).toBe(200);
    const broken = body.find((entry: { feature: string }) => entry.feature === "broken");
    expect(broken.app).toBeNull();
    expect(broken.phase).toBeNull();
    expect(broken.approvals).toBeNull();
    expect(broken.diagnostics).toHaveLength(1);
    expect(broken.diagnostics[0].kind).toBe("parse-failure");
  });
});

// ---------------------------------------------------------------------------
// GET /api/specs/:feature（2.2, 7.4）
// ---------------------------------------------------------------------------

describe("GET /api/specs/:feature", () => {
  it("存在する全成果物の構造化表現 + validations を返す（2.2, 7.4）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const { status, body } = await getJson(makeApp(context), "/api/specs/alpha");

    expect(status).toBe(200);
    expect(body.summary.feature).toBe("alpha");
    expect(body.summary.app).toBe("dashboard");

    // requirements: AC が ID 付きで構造化されている
    expect(body.requirements.requirements).toHaveLength(1);
    const requirement = body.requirements.requirements[0];
    expect(requirement.kind).toBe("structured");
    expect(requirement.id).toBe("1");
    expect(
      requirement.criteria.map((criterion: { id: string }) => criterion.id),
    ).toEqual(["1.1", "1.2", "1.3"]);
    expect(requirement.criteria[0].translationJa).toBe("一覧を返す。");

    // design: Traceability 行が構造化されている
    expect(body.design.traceability).toHaveLength(1);
    expect(body.design.traceability[0].kind).toBe("structured");
    expect(body.design.traceability[0].components).toBe("SpecListView");

    // tasks: 階層付きで構造化されている
    expect(body.tasks.tasks.map((task: { id: string }) => task.id)).toEqual(["1"]);
    expect(
      body.tasks.tasks[0].subtasks.map((task: { id: string }) => task.id),
    ).toEqual(["1.1"]);

    // 不在の成果物は null（artifacts フラグと対応）
    expect(body.brief).toBeNull();
    expect(body.research).toBeNull();

    // validations: ValidationService 委譲（readValidations seam の配線）が効いている（7.4）
    expect(body.validations).toHaveLength(1);
    const gap = body.validations[0];
    expect(gap.type).toBe("gap");
    expect(gap.feature).toBe("alpha");
    expect(gap.date).toBe("2026-06-01");
    expect(gap.decision).toBeNull();
    expect(gap.content).toBe(ALPHA_VALIDATION_GAP);
    expect(gap.diagnostics).toEqual([]);
  });

  it("不在 spec には 404 SPEC_NOT_FOUND の構造化エラーを返す", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const { status, body } = await getJson(makeApp(context), "/api/specs/nope");

    expect(status).toBe(404);
    expect(body.error.code).toBe("SPEC_NOT_FOUND");
    expect(typeof body.error.message).toBe("string");
  });

  it("許可外文字（英数字 + - _ 以外）を含む feature はディレクトリが実在しても 404", async () => {
    const context = makeRepo();
    makeSpec(context, "evil.dir", {
      "spec.json": ALPHA_SPEC_JSON,
      "requirements.md": ALPHA_REQUIREMENTS,
    });
    const app = makeApp(context);

    const detail = await getJson(app, "/api/specs/evil.dir");
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe("SPEC_NOT_FOUND");

    const trace = await getJson(app, "/api/specs/evil.dir/trace");
    expect(trace.status).toBe(404);
    expect(trace.body.error.code).toBe("SPEC_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// GET /api/specs/:feature/trace（6.1）
// ---------------------------------------------------------------------------

describe("GET /api/specs/:feature/trace", () => {
  it("双方向グラフ（ノード + 完全列挙エッジ + 診断）を返し、クロス spec 参照を解決する（6.1, 6.6）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const { status, body } = await getJson(makeApp(context), "/api/specs/alpha/trace");

    expect(status).toBe(200);
    expect(body.feature).toBe("alpha");
    expect(body.nodes).toEqual({
      requirements: [
        { type: "requirement", id: "1.1" },
        { type: "requirement", id: "1.2" },
        { type: "requirement", id: "1.3" },
        { type: "requirement", id: "beta/1.1" },
      ],
      designElements: [{ type: "design", name: "SpecListView" }],
      tasks: [
        { type: "task", id: "1" },
        { type: "task", id: "1.1" },
      ],
    });
    expect(body.edges).toEqual([
      {
        from: { type: "requirement", id: "1.1" },
        to: { type: "design", name: "SpecListView" },
        source: "design-table",
        legacyExpanded: false,
      },
      {
        from: { type: "requirement", id: "1.2" },
        to: { type: "design", name: "SpecListView" },
        source: "design-table",
        legacyExpanded: false,
      },
      {
        from: { type: "requirement", id: "1.1" },
        to: { type: "task", id: "1.1" },
        source: "task-annotation",
        legacyExpanded: false,
      },
      {
        from: { type: "requirement", id: "beta/1.1" },
        to: { type: "task", id: "1.1" },
        source: "task-annotation",
        legacyExpanded: false,
      },
    ]);
    expect(body.diagnostics).toEqual([
      {
        kind: "broken-link",
        ref: "9.9",
        where: { type: "task", id: "1.1" },
        position: {
          startLine: expect.any(Number),
          endLine: expect.any(Number),
          startOffset: expect.any(Number),
          endOffset: expect.any(Number),
        },
      },
      { kind: "design-uncovered", requirementId: "1.3" },
      { kind: "task-uncovered", requirementId: "1.2" },
      { kind: "task-uncovered", requirementId: "1.3" },
    ]);
  });

  it("不在 spec には 404 SPEC_NOT_FOUND の構造化エラーを返す", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const { status, body } = await getJson(makeApp(context), "/api/specs/nope/trace");

    expect(status).toBe(404);
    expect(body.error.code).toBe("SPEC_NOT_FOUND");
  });
});
