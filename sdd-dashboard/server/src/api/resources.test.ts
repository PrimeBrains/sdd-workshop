/**
 * 読取ルート（resources）の統合テスト — フィクスチャリポジトリ → Hono app → JSON レスポンス。
 * 完了条件（tasks.md 8.1）: 全読取エンドポイント呼び出しが契約型どおりの JSON を返す。
 * - GET /api/repo → RepoInfo
 * - GET /api/steering(:name) → SteeringDocSummary[] / SteeringDoc（7.1）
 * - GET /api/skills(:name) → SkillSummary[] / SkillDoc（7.2, 7.7）
 * - GET /api/adr(:id) → AdrSummary[] / AdrDoc（7.3, 7.6。:id = 拡張子なしファイル名）
 * - 不在 / 許可外文字パラメータ → 404 RESOURCE_NOT_FOUND の構造化エラー
 * エラー変換は task 8.3 のミドルウェア契約を写した薄いハンドラで検証する。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSkillsDir, type RepoContext } from "../config.js";
import { AppError, ERROR_HTTP_STATUS, ErrorCode } from "../errors/codes.js";
import { createAdrService } from "../services/adr-service.js";
import { createSkillService } from "../services/skill-service.js";
import { createSteeringService } from "../services/steering-service.js";
import { createResourcesRoutes } from "./resources.js";

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

const PRODUCT_MD = "# プロダクト概要\n\n## ゴール\n\n本文。\n";
const TECH_MD = "# 技術スタック\n\n本文。\n";

const SKILL_ALPHA_EN = [
  "---",
  "name: kiro-alpha",
  "description: テスト用スキル",
  "metadata:",
  '  origin: "custom"',
  "---",
  "",
  "# kiro-alpha",
  "",
  "English body.",
  "",
].join("\n");

const SKILL_ALPHA_JA = "# kiro-alpha (ja)\n\n日本語本文。\n";

const SKILL_PLAIN_EN = "# plain\n\nfrontmatter なしスキル。\n";

const ADR_0001 = [
  "---",
  "id: 1",
  "title: テスト決定",
  "status: accepted",
  'date: "2026-06-01"',
  "app: dashboard",
  "specs:",
  "  - alpha",
  "requirements:",
  '  - "alpha/1.1"',
  "supersedes: null",
  "superseded_by: null",
  "---",
  "",
  "# 0001: テスト決定",
  "",
  "## Context",
  "",
  "背景。",
  "",
  "## Decision",
  "",
  "決定。",
  "",
  "## Consequences",
  "",
  "帰結。",
  "",
].join("\n");

const ADR_0001_FRONTMATTER = {
  id: 1,
  title: "テスト決定",
  status: "accepted",
  date: "2026-06-01",
  app: "dashboard",
  specs: ["alpha"],
  requirements: ["alpha/1.1"],
  supersedes: null,
  superseded_by: null,
};

/** steering 2 件 / スキル 2 件（+非スキルディレクトリ）/ ADR 1 件 + template のフィクスチャ */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-api-resources-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  const context: RepoContext = { repoRoot, kiroDir, port: 0 };

  const steeringDir = join(kiroDir, "steering");
  mkdirSync(steeringDir, { recursive: true });
  writeFileSync(join(steeringDir, "product.md"), PRODUCT_MD);
  writeFileSync(join(steeringDir, "tech.md"), TECH_MD);

  const skillsDir = resolveSkillsDir(context);
  mkdirSync(join(skillsDir, "kiro-alpha"), { recursive: true });
  writeFileSync(join(skillsDir, "kiro-alpha", "SKILL.md"), SKILL_ALPHA_EN);
  writeFileSync(join(skillsDir, "kiro-alpha", "SKILL.ja.md"), SKILL_ALPHA_JA);
  mkdirSync(join(skillsDir, "plain"), { recursive: true });
  writeFileSync(join(skillsDir, "plain", "SKILL.md"), SKILL_PLAIN_EN);
  mkdirSync(join(skillsDir, "not-a-skill"), { recursive: true });
  writeFileSync(join(skillsDir, "not-a-skill", "README.md"), "# not a skill\n");

  const adrDir = join(kiroDir, "adr");
  mkdirSync(adrDir, { recursive: true });
  writeFileSync(join(adrDir, "0001-test-decision.md"), ADR_0001);
  writeFileSync(join(adrDir, "template.md"), "# ADR テンプレート\n");

  return context;
}

// ---------------------------------------------------------------------------
// app 組み立て
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
  const app = withErrorHandler(new Hono());
  app.route(
    "/api",
    createResourcesRoutes({
      context,
      steeringService: createSteeringService(context),
      skillService: createSkillService(context),
      adrService: createAdrService(context),
    }),
  );
  return app;
}

async function getJson(app: Hono, path: string): Promise<{ status: number; body: any }> {
  const res = await app.request(path);
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// GET /api/repo
// ---------------------------------------------------------------------------

describe("GET /api/repo", () => {
  it("リポジトリ絶対パスと名前（RepoInfo）を返す", async () => {
    const context = makeRepo();
    const { status, body } = await getJson(makeApp(context), "/api/repo");

    expect(status).toBe(200);
    expect(body).toEqual({
      repoRoot: context.repoRoot,
      name: basename(context.repoRoot),
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/steering(:name)（7.1）
// ---------------------------------------------------------------------------

describe("GET /api/steering", () => {
  it("全 steering 文書を name 昇順 + 先頭見出しタイトル付きで返す（7.1）", async () => {
    const context = makeRepo();
    const { status, body } = await getJson(makeApp(context), "/api/steering");

    expect(status).toBe(200);
    expect(body).toEqual([
      { name: "product", title: "プロダクト概要" },
      { name: "tech", title: "技術スタック" },
    ]);
  });

  it("GET /api/steering/:name は content + sections を返す（7.1）", async () => {
    const context = makeRepo();
    const { status, body } = await getJson(makeApp(context), "/api/steering/product");

    expect(status).toBe(200);
    expect(body.name).toBe("product");
    expect(body.content).toBe(PRODUCT_MD);
    expect(body.sections).toHaveLength(1);
    expect(body.sections[0].title).toBe("プロダクト概要");
    expect(body.sections[0].children.map((child: { title: string }) => child.title)).toEqual([
      "ゴール",
    ]);
  });

  it("不在・許可外文字の name には 404 RESOURCE_NOT_FOUND を返す", async () => {
    const context = makeRepo();
    const app = makeApp(context);

    const missing = await getJson(app, "/api/steering/nope");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const invalid = await getJson(app, "/api/steering/pro.duct");
    expect(invalid.status).toBe(404);
    expect(invalid.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// GET /api/skills(:name)（7.2, 7.7）
// ---------------------------------------------------------------------------

describe("GET /api/skills", () => {
  it("SKILL.md を含むディレクトリのみを en/ja 有無 + origin 付きで返す（7.2, 7.7）", async () => {
    const context = makeRepo();
    const { status, body } = await getJson(makeApp(context), "/api/skills");

    expect(status).toBe(200);
    expect(body).toEqual([
      { name: "kiro-alpha", hasEn: true, hasJa: true, origin: "custom" },
      { name: "plain", hasEn: true, hasJa: false, origin: null },
    ]);
  });

  it("GET /api/skills/:name は英日ペア（en 必須・ja nullable）を返す（7.2）", async () => {
    const context = makeRepo();
    const app = makeApp(context);

    const alpha = await getJson(app, "/api/skills/kiro-alpha");
    expect(alpha.status).toBe(200);
    expect(alpha.body.name).toBe("kiro-alpha");
    expect(alpha.body.en.content).toBe(SKILL_ALPHA_EN);
    expect(alpha.body.ja.content).toBe(SKILL_ALPHA_JA);
    expect(alpha.body.origin).toBe("custom");

    const plain = await getJson(app, "/api/skills/plain");
    expect(plain.status).toBe(200);
    expect(plain.body.ja).toBeNull();
    expect(plain.body.origin).toBeNull();
  });

  it("不在・許可外文字の name には 404 RESOURCE_NOT_FOUND を返す", async () => {
    const context = makeRepo();
    const app = makeApp(context);

    const missing = await getJson(app, "/api/skills/nope");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const invalid = await getJson(app, "/api/skills/kiro.alpha");
    expect(invalid.status).toBe(404);
    expect(invalid.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// GET /api/adr(:id)（7.3, 7.6）
// ---------------------------------------------------------------------------

describe("GET /api/adr", () => {
  it("template.md を除く全 ADR を frontmatter 付きで返す（7.3, 7.6）", async () => {
    const context = makeRepo();
    const { status, body } = await getJson(makeApp(context), "/api/adr");

    expect(status).toBe(200);
    expect(body).toEqual([
      {
        name: "0001-test-decision",
        frontmatter: ADR_0001_FRONTMATTER,
        diagnostics: [],
      },
    ]);
  });

  it("GET /api/adr/:id（:id = 拡張子なしファイル名）は frontmatter + 構造化本文を返す（7.3）", async () => {
    const context = makeRepo();
    const { status, body } = await getJson(makeApp(context), "/api/adr/0001-test-decision");

    expect(status).toBe(200);
    expect(body.name).toBe("0001-test-decision");
    expect(body.frontmatter).toEqual(ADR_0001_FRONTMATTER);
    expect(body.content).toBe(ADR_0001);
    expect(body.diagnostics).toEqual([]);
    expect(body.sections).toHaveLength(1);
    expect(body.sections[0].title).toBe("0001: テスト決定");
    expect(body.sections[0].children.map((child: { title: string }) => child.title)).toEqual([
      "Context",
      "Decision",
      "Consequences",
    ]);
  });

  it("不在・template・許可外文字の id には 404 RESOURCE_NOT_FOUND を返す", async () => {
    const context = makeRepo();
    const app = makeApp(context);

    const missing = await getJson(app, "/api/adr/0002-nope");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const template = await getJson(app, "/api/adr/template");
    expect(template.status).toBe(404);
    expect(template.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const invalid = await getJson(app, "/api/adr/0001.evil");
    expect(invalid.status).toBe(404);
    expect(invalid.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });
});
