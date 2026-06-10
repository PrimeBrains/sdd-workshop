/**
 * 書込ルートの統合テスト — フィクスチャリポジトリ → Hono app → JSON レスポンス。
 * 完了条件（tasks.md 8.2）: 不正ボディが 422 + fieldErrors、正常ボディが
 * 更新後メタデータ / 作成済み ADR を返す。
 * - PUT /api/specs/:feature/approvals → SpecSummary（9.1。zod 検証 + writer 委譲）
 * - POST /api/specs/:feature/rollback → SpecSummary（10.3。不明フェーズは 422 fieldErrors）
 * - POST /api/adr → AdrDoc 201（11.4。requirements 参照は RefListParser でフィールド単位検証）
 * - エラー経路: 422 VALIDATION_FAILED（fieldErrors）/ 409 APPROVAL_ORDER_VIOLATION /
 *   404 SPEC_NOT_FOUND
 * すべての書込は SafePathGuard 経由（12.1 — writer 構成で保証し、ディスク実体で検証する）。
 * エラー変換は task 8.3 のミドルウェア契約（AppError → ERROR_HTTP_STATUS + ApiError JSON、
 * details.fieldErrors → error.fieldErrors）を写した薄いハンドラで検証する。
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import { AppError, ERROR_HTTP_STATUS, ErrorCode } from "../errors/codes.js";
import { createKiroScanner } from "../services/kiro-scanner.js";
import { createAdrWriter } from "../services/writes/adr-writer.js";
import { createApprovalWriter } from "../services/writes/approval-writer.js";
import { createAuditLog } from "../services/writes/audit-log.js";
import { createRollbackWriter } from "../services/writes/rollback-writer.js";
import { createSafePathGuard } from "../services/writes/safe-path.js";
import { createSpecJsonWriter } from "../services/writes/spec-json-writer.js";
import { createWritesRoutes } from "./writes.js";

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
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-api-writes-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

function makeSpec(context: RepoContext, feature: string, specJson: object): void {
  const dir = join(context.kiroDir, "specs", feature);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "spec.json"), JSON.stringify(specJson, null, 2));
}

/** requirements 承認済み・design 生成済み（未承認）— design 承認が通る状態 */
const ALPHA_SPEC_JSON = {
  feature_name: "alpha",
  app: "dashboard",
  phase: "design-generated",
  language: "japanese",
  approvals: {
    requirements: { generated: true, approved: true },
    design: { generated: true, approved: false },
    tasks: { generated: false, approved: false },
  },
  ready_for_implementation: false,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-02T00:00:00Z",
};

/** requirements 未承認のまま design 生成済み — design 承認が順序違反になる状態 */
const BETA_SPEC_JSON = {
  feature_name: "beta",
  phase: "design-generated",
  language: "japanese",
  approvals: {
    requirements: { generated: true, approved: false },
    design: { generated: true, approved: false },
    tasks: { generated: false, approved: false },
  },
  ready_for_implementation: false,
  created_at: "2026-06-03T00:00:00Z",
  updated_at: "2026-06-03T00:00:00Z",
};

// ---------------------------------------------------------------------------
// app 組み立て（writer 群はすべて SafePathGuard 経由 — 12.1）
// ---------------------------------------------------------------------------

/** updated_at / ADR date の厳密値検証用の固定クロック */
const FIXED_NOW = () => new Date("2026-06-11T12:00:00.000Z");
const FIXED_UPDATED_AT = "2026-06-11T12:00:00.000Z";

/**
 * task 8.3 のエラーミドルウェア契約を写した薄いハンドラ
 * （AppError → ステータス + ApiError JSON。details.fieldErrors → error.fieldErrors）。
 */
function withErrorHandler(app: Hono): Hono {
  app.onError((error, c) => {
    if (error instanceof AppError && error.code !== ErrorCode.REPO_INVALID) {
      const details = error.details as { fieldErrors?: Record<string, string[]> } | undefined;
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(details?.fieldErrors !== undefined ? { fieldErrors: details.fieldErrors } : {}),
          },
        },
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
  const guard = createSafePathGuard(context);
  const audit = createAuditLog({ sink: () => {} });
  const specJsonWriter = createSpecJsonWriter({ scanner, guard, now: FIXED_NOW });
  const app = withErrorHandler(new Hono());
  app.route(
    "/api",
    createWritesRoutes({
      approvalWriter: createApprovalWriter({ specJsonWriter, audit }),
      rollbackWriter: createRollbackWriter({ specJsonWriter, audit }),
      adrWriter: createAdrWriter({ context, guard, audit, now: FIXED_NOW }),
    }),
  );
  return app;
}

async function send(
  app: Hono,
  method: "PUT" | "POST",
  path: string,
  body: unknown,
): Promise<{ status: number; body: any }> {
  const res = await app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// PUT /api/specs/:feature/approvals（9.1, 11.4 の fieldErrors 形）
// ---------------------------------------------------------------------------

describe("PUT /api/specs/:feature/approvals", () => {
  it("正常ボディで承認フラグを更新し、更新後の SpecSummary を返す（9.1）", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", ALPHA_SPEC_JSON);
    const { status, body } = await send(makeApp(context), "PUT", "/api/specs/alpha/approvals", {
      phase: "design",
      approved: true,
    });

    expect(status).toBe(200);
    expect(body.feature).toBe("alpha");
    expect(body.app).toBe("dashboard");
    expect(body.approvals).toEqual({
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: false, approved: false },
    });
    expect(body.phase).toBe("design-generated");
    expect(body.readyForImplementation).toBe(false);
    expect(body.updatedAt).toBe(FIXED_UPDATED_AT);
    expect(body.diagnostics).toEqual([]);

    // ディスクの spec.json も更新されている（SafePathGuard 経由のアトミック書込）
    const onDisk = JSON.parse(
      readFileSync(join(context.kiroDir, "specs", "alpha", "spec.json"), "utf-8"),
    );
    expect(onDisk.approvals.design.approved).toBe(true);
    expect(onDisk.updated_at).toBe(FIXED_UPDATED_AT);
  });

  it("不正ボディには 422 VALIDATION_FAILED + フィールド単位 fieldErrors を返す", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", ALPHA_SPEC_JSON);
    const { status, body } = await send(makeApp(context), "PUT", "/api/specs/alpha/approvals", {
      phase: "deploy",
      approved: "yes",
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(typeof body.error.message).toBe("string");
    expect(body.error.fieldErrors).toEqual({
      phase: [expect.any(String)],
      approved: [expect.any(String)],
    });
  });

  it("JSON として解釈できないボディには 422 VALIDATION_FAILED を返す", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", ALPHA_SPEC_JSON);
    const { status, body } = await send(
      makeApp(context),
      "PUT",
      "/api/specs/alpha/approvals",
      "{ not json",
    );

    expect(status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("先行フェーズ未承認の承認要求には 409 APPROVAL_ORDER_VIOLATION を返す（9.3）", async () => {
    const context = makeRepo();
    makeSpec(context, "beta", BETA_SPEC_JSON);
    const { status, body } = await send(makeApp(context), "PUT", "/api/specs/beta/approvals", {
      phase: "design",
      approved: true,
    });

    expect(status).toBe(409);
    expect(body.error.code).toBe("APPROVAL_ORDER_VIOLATION");

    // 拒否時はディスクの spec.json が変更されない
    const onDisk = JSON.parse(
      readFileSync(join(context.kiroDir, "specs", "beta", "spec.json"), "utf-8"),
    );
    expect(onDisk.approvals.design.approved).toBe(false);
    expect(onDisk.updated_at).toBe("2026-06-03T00:00:00Z");
  });

  it("不在 spec には 404 SPEC_NOT_FOUND を返す", async () => {
    const context = makeRepo();
    const { status, body } = await send(makeApp(context), "PUT", "/api/specs/nope/approvals", {
      phase: "requirements",
      approved: true,
    });

    expect(status).toBe(404);
    expect(body.error.code).toBe("SPEC_NOT_FOUND");
  });

  it("許可外文字を含む feature はディレクトリが実在しても 404", async () => {
    const context = makeRepo();
    const dir = join(context.kiroDir, "specs", "evil.dir");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "spec.json"), JSON.stringify(ALPHA_SPEC_JSON));
    const { status, body } = await send(
      makeApp(context),
      "PUT",
      "/api/specs/evil.dir/approvals",
      { phase: "design", approved: true },
    );

    expect(status).toBe(404);
    expect(body.error.code).toBe("SPEC_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// POST /api/specs/:feature/rollback（10.3）
// ---------------------------------------------------------------------------

describe("POST /api/specs/:feature/rollback", () => {
  it("正常ボディで巻き戻し、更新後の SpecSummary を返す（10.1, 10.2）", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", ALPHA_SPEC_JSON);
    const { status, body } = await send(makeApp(context), "POST", "/api/specs/alpha/rollback", {
      targetPhase: "requirements",
    });

    expect(status).toBe(200);
    expect(body.feature).toBe("alpha");
    expect(body.approvals).toEqual({
      requirements: { generated: true, approved: false },
      design: { generated: false, approved: false },
      tasks: { generated: false, approved: false },
    });
    expect(body.phase).toBe("requirements-generated");
    expect(body.readyForImplementation).toBe(false);
    expect(body.updatedAt).toBe(FIXED_UPDATED_AT);
  });

  it("不明な targetPhase には 422 + fieldErrors.targetPhase を返す（10.3）", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", ALPHA_SPEC_JSON);
    const { status, body } = await send(makeApp(context), "POST", "/api/specs/alpha/rollback", {
      targetPhase: "implementation",
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fieldErrors).toEqual({ targetPhase: [expect.any(String)] });
  });

  it("targetPhase 欠落には 422 + fieldErrors.targetPhase を返す", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", ALPHA_SPEC_JSON);
    const { status, body } = await send(makeApp(context), "POST", "/api/specs/alpha/rollback", {});

    expect(status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fieldErrors).toEqual({ targetPhase: [expect.any(String)] });
  });

  it("不在 spec には 404 SPEC_NOT_FOUND を返す（10.3）", async () => {
    const context = makeRepo();
    const { status, body } = await send(makeApp(context), "POST", "/api/specs/nope/rollback", {
      targetPhase: "design",
    });

    expect(status).toBe(404);
    expect(body.error.code).toBe("SPEC_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// POST /api/adr（11.4）
// ---------------------------------------------------------------------------

describe("POST /api/adr", () => {
  it("正常ボディで ADR を作成し、201 + 作成済み AdrDoc を返す（11.1, 11.2, 11.3）", async () => {
    const context = makeRepo();
    const { status, body } = await send(makeApp(context), "POST", "/api/adr", {
      title: "Use Local Web App",
      context: "背景の説明。",
      decision: "ローカル Web アプリとして実装する。",
      consequences: "正負の帰結。",
      requirements: ["1.2", "sdd-core/3.1"],
    });

    expect(status).toBe(201);
    expect(body.name).toBe("0001-use-local-web-app");
    expect(body.frontmatter).toMatchObject({
      id: 1,
      title: "Use Local Web App",
      status: "proposed",
      date: "2026-06-11",
      app: null,
      specs: [],
      requirements: ["1.2", "sdd-core/3.1"],
      supersedes: null,
      superseded_by: null,
    });
    expect(body.diagnostics).toEqual([]);
    expect(body.content).toContain("# ADR-0001: Use Local Web App");
    expect(body.content).toContain("## Context");
    expect(body.content).toContain("## Decision");
    expect(body.content).toContain("## Consequences");

    // ファイルがディスク上の .kiro/adr/ に実在する（SafePathGuard 経由の書込）
    const filePath = join(context.kiroDir, "adr", "0001-use-local-web-app.md");
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf-8")).toBe(body.content);
  });

  it("必須フィールド欠落には 422 + フィールド単位 fieldErrors を返す（11.4）", async () => {
    const context = makeRepo();
    const { status, body } = await send(makeApp(context), "POST", "/api/adr", {
      title: "Only Title",
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fieldErrors).toEqual({
      context: [expect.any(String)],
      decision: [expect.any(String)],
      consequences: [expect.any(String)],
    });

    // 拒否時にはファイルが作られない
    expect(existsSync(join(context.kiroDir, "adr"))).toBe(false);
  });

  it("requirements 参照が ID / クロス spec 形式でなければ 422 + fieldErrors.requirements（11.4）", async () => {
    const context = makeRepo();
    const { status, body } = await send(makeApp(context), "POST", "/api/adr", {
      title: "Bad Refs",
      context: "c",
      decision: "d",
      consequences: "q",
      requirements: ["sdd-core/1.2", "not/a/ref", "1.1-1.3"],
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fieldErrors).toEqual({
      requirements: [expect.any(String), expect.any(String)],
    });
  });
});
