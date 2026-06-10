import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import { AppError, ErrorCode } from "../errors/codes.js";
import type { ValidationReport } from "../types/resources.js";
import { createKiroScanner } from "./kiro-scanner.js";
import { createSpecService } from "./spec-service.js";

const tempDirs: string[] = [];

function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-spec-service-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

function makeSpec(context: RepoContext, feature: string, files: Record<string, string>): string {
  const dir = join(context.kiroDir, "specs", feature);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
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
  "1. The system shall do the first thing.",
  "2. The system shall do the second thing.",
  "",
].join("\n");

const ALPHA_DESIGN = ["# Design", "", "## Overview", "", "本文。", ""].join("\n");

const ALPHA_TASKS = [
  "# Tasks",
  "",
  "- [x] 1. メジャータスク",
  "- [x] 1.1 サブタスク",
  "  - _Requirements: 1.1_",
  "",
].join("\n");

/** complete spec / brief-only spec / broken spec.json の 3 spec を持つフィクスチャ */
function makeFixtureTree(context: RepoContext): void {
  makeSpec(context, "alpha", {
    "spec.json": ALPHA_SPEC_JSON,
    "brief.md": "# alpha brief\n\n## Goal\n\n本文。\n",
    "requirements.md": ALPHA_REQUIREMENTS,
    "design.md": ALPHA_DESIGN,
    "tasks.md": ALPHA_TASKS,
    "research.md": "# research\n",
  });
  makeSpec(context, "brief-only", { "brief.md": "# brief only\n" });
  makeSpec(context, "broken", {
    "spec.json": "{ this is not json",
    "requirements.md": ALPHA_REQUIREMENTS,
  });
}

function makeService(context: RepoContext) {
  return createSpecService({ scanner: createKiroScanner(context) });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SpecService.list", () => {
  it("全 spec ディレクトリをメタデータ + 成果物有無フラグ付きで件数どおり返す（2.1）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const service = makeService(context);

    const summaries = await service.list();

    expect(summaries).toHaveLength(3);
    expect(summaries.map((summary) => summary.feature)).toEqual(["alpha", "brief-only", "broken"]);

    const alpha = summaries[0];
    expect(alpha?.app).toBe("dashboard");
    expect(alpha?.phase).toBe("tasks-approved");
    expect(alpha?.language).toBe("japanese");
    expect(alpha?.readyForImplementation).toBe(true);
    expect(alpha?.createdAt).toBe("2026-06-01T00:00:00Z");
    expect(alpha?.updatedAt).toBe("2026-06-02T00:00:00Z");
    expect(alpha?.approvals).toEqual({
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: true },
    });
    expect(alpha?.diagnostics).toEqual([]);
    expect(alpha?.artifacts).toEqual({
      brief: true,
      requirements: true,
      design: true,
      tasks: true,
      research: true,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    });

    const briefOnly = summaries[1];
    expect(briefOnly?.artifacts).toEqual({
      brief: true,
      requirements: false,
      design: false,
      tasks: false,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    });
  });

  it("spec.json 不在・不正 JSON でもエントリを省略せず null メタ + parse-failure 診断で返す（2.3）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const service = makeService(context);

    const summaries = await service.list();
    const briefOnly = summaries.find((summary) => summary.feature === "brief-only");
    const broken = summaries.find((summary) => summary.feature === "broken");

    for (const summary of [briefOnly, broken]) {
      expect(summary).toBeDefined();
      expect(summary?.app).toBeNull();
      expect(summary?.phase).toBeNull();
      expect(summary?.approvals).toBeNull();
      expect(summary?.diagnostics.some((diagnostic) => diagnostic.kind === "parse-failure")).toBe(
        true,
      );
    }
    expect(broken?.artifacts.requirements).toBe(true);
  });

  it(".kiro/specs/ が存在しない場合は空一覧を返す", async () => {
    const context = makeRepo();
    const service = makeService(context);
    await expect(service.list()).resolves.toEqual([]);
  });

  it("キャッシュを持たず、spec 追加が次の list 呼び出しへ即時反映される（1.4, 2.4）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const service = makeService(context);

    expect(await service.list()).toHaveLength(3);

    makeSpec(context, "delta", { "spec.json": ALPHA_SPEC_JSON });
    const after = await service.list();
    expect(after).toHaveLength(4);
    expect(after.map((summary) => summary.feature)).toContain("delta");
  });
});

describe("SpecService.get", () => {
  it("存在する成果物すべての構造化表現を返す（2.2）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const service = makeService(context);

    const detail = await service.get("alpha");

    expect(detail.summary.feature).toBe("alpha");
    expect(detail.summary.app).toBe("dashboard");

    expect(detail.brief?.content).toContain("# alpha brief");
    expect(detail.brief?.sections.map((section) => section.title)).toEqual(["alpha brief"]);

    const requirement = detail.requirements?.requirements[0];
    expect(requirement?.kind).toBe("structured");
    if (requirement?.kind === "structured") {
      expect(requirement.id).toBe("1");
      expect(requirement.title).toBe("サンプル要件");
      expect(requirement.criteria).toHaveLength(2);
    }

    expect(detail.design?.sections.map((section) => section.title)).toEqual(["Design"]);

    const task = detail.tasks?.tasks[0];
    expect(task?.id).toBe("1");
    expect(task?.subtasks[0]?.id).toBe("1.1");

    expect(detail.research?.content).toContain("# research");
    expect(detail.validations).toEqual([]);
  });

  it("不在の成果物は null になる（artifacts フラグと対応）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const service = makeService(context);

    const detail = await service.get("brief-only");

    expect(detail.brief).not.toBeNull();
    expect(detail.requirements).toBeNull();
    expect(detail.design).toBeNull();
    expect(detail.tasks).toBeNull();
    expect(detail.research).toBeNull();
    expect(detail.summary.artifacts.brief).toBe(true);
    expect(detail.summary.artifacts.requirements).toBe(false);
  });

  it("不在 feature は AppError(SPEC_NOT_FOUND) を投げる", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const service = makeService(context);

    const promise = service.get("missing");
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ code: ErrorCode.SPEC_NOT_FOUND });
  });

  it("ファイル書き換え後の再取得で新しい内容が返る（再起動不要、1.4, 2.4）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const service = makeService(context);

    const before = await service.get("alpha");
    const beforeRequirement = before.requirements?.requirements[0];
    if (beforeRequirement?.kind === "structured") {
      expect(beforeRequirement.title).toBe("サンプル要件");
      expect(beforeRequirement.criteria).toHaveLength(2);
    }

    writeFileSync(
      join(context.kiroDir, "specs", "alpha", "requirements.md"),
      [
        "# Requirements",
        "",
        "### Requirement 1: 書き換え後の要件",
        "",
        "**Objective:** 更新された目的。",
        "",
        "#### Acceptance Criteria",
        "",
        "1. The system shall reflect the rewrite.",
        "",
      ].join("\n"),
    );

    const after = await service.get("alpha");
    const afterRequirement = after.requirements?.requirements[0];
    expect(afterRequirement?.kind).toBe("structured");
    if (afterRequirement?.kind === "structured") {
      expect(afterRequirement.title).toBe("書き換え後の要件");
      expect(afterRequirement.criteria).toHaveLength(1);
    }
  });

  it("validation レポート読取は注入された reader へ委譲する（ValidationService 接続点）", async () => {
    const context = makeRepo();
    makeFixtureTree(context);
    const report: ValidationReport = {
      type: "gap",
      feature: "alpha",
      date: "2026-06-01",
      decision: null,
      content: "# gap",
      sections: [],
      diagnostics: [],
    };
    const calls: string[] = [];
    const service = createSpecService({
      scanner: createKiroScanner(context),
      readValidations: (feature) => {
        calls.push(feature);
        return Promise.resolve([report]);
      },
    });

    const detail = await service.get("alpha");

    expect(calls).toEqual(["alpha"]);
    expect(detail.validations).toEqual([report]);
  });
});
