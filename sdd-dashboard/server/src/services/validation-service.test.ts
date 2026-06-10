import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import { createKiroScanner } from "./kiro-scanner.js";
import { createSpecService } from "./spec-service.js";
import { createValidationService } from "./validation-service.js";

const tempDirs: string[] = [];

/** 一時リポジトリ（.kiro/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-validation-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

/** `.kiro/specs/<feature>/` 配下にファイル群を作る */
function makeSpec(context: RepoContext, feature: string, files: Record<string, string>): void {
  const dir = join(context.kiroDir, "specs", feature);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

/** decision を持たない gap レポート fixture（gap は decision キー自体がない） */
const GAP_REPORT = `---
type: gap
feature: sdd-core
date: 2026-06-08
---

# Gap Analysis: sdd-core

## 概要

既存実装との差分。
`;

/** decision 付きの design レポート fixture */
const DESIGN_REPORT = `---
type: design
feature: sdd-core
date: 2026-06-09
decision: GO
---

# Design Validation: sdd-core

## 判定

GO。
`;

const IMPL_REPORT = `---
type: impl
feature: sdd-core
date: 2026-06-10
decision: PASS
---

# Implementation Validation: sdd-core
`;

describe("ValidationService / listForSpec", () => {
  it("存在する validation-{gap,design,impl}.md を gap → design → impl 順で構造化して返す（7.4）", async () => {
    const context = makeRepo();
    makeSpec(context, "sdd-core", {
      "validation-gap.md": GAP_REPORT,
      "validation-design.md": DESIGN_REPORT,
      "validation-impl.md": IMPL_REPORT,
    });
    const service = createValidationService(createKiroScanner(context));

    const reports = await service.listForSpec("sdd-core");

    expect(reports).toHaveLength(3);
    expect(reports.map((report) => report.type)).toEqual(["gap", "design", "impl"]);
    // gap: decision キーを持たない → null（完了条件）
    expect(reports[0]).toMatchObject({
      type: "gap",
      feature: "sdd-core",
      date: "2026-06-08",
      decision: null,
      content: GAP_REPORT,
      diagnostics: [],
    });
    // design: decision 存在時は値を返す
    expect(reports[1]).toMatchObject({
      type: "design",
      feature: "sdd-core",
      date: "2026-06-09",
      decision: "GO",
    });
    expect(reports[2]).toMatchObject({ type: "impl", decision: "PASS" });
    // 本文はセクション構造化されている
    expect(reports[0]?.sections[0]?.title).toBe("Gap Analysis: sdd-core");
  });

  it("存在するレポートだけを返す（不在ファイルはスキップ）", async () => {
    const context = makeRepo();
    makeSpec(context, "sdd-core", { "validation-design.md": DESIGN_REPORT });
    const service = createValidationService(createKiroScanner(context));

    const reports = await service.listForSpec("sdd-core");

    expect(reports).toHaveLength(1);
    expect(reports[0]?.type).toBe("design");
  });

  it("spec ディレクトリ不在・不正な feature 名は空配列を返す", async () => {
    const context = makeRepo();
    const service = createValidationService(createKiroScanner(context));

    await expect(service.listForSpec("missing")).resolves.toEqual([]);
    await expect(service.listForSpec("../escape")).resolves.toEqual([]);
  });

  it("frontmatter 欠落時はファイル名由来の type + 要求 feature + parse-failure 診断で返す（7.5）", async () => {
    const context = makeRepo();
    const raw = "# 生のレポート\n\nfrontmatter なし。\n";
    makeSpec(context, "sdd-core", { "validation-gap.md": raw });
    const service = createValidationService(createKiroScanner(context));

    const reports = await service.listForSpec("sdd-core");

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      type: "gap",
      feature: "sdd-core",
      date: null,
      decision: null,
      content: raw, // 生 markdown として全文を返す
    });
    expect(reports[0]?.diagnostics).toEqual([
      expect.objectContaining({ kind: "parse-failure" }),
    ]);
  });

  it("SpecService の readValidations 注入点に接続できる（シグネチャ契約。4.1 → 4.3 handover）", async () => {
    const context = makeRepo();
    makeSpec(context, "sdd-core", {
      "spec.json": JSON.stringify({ feature_name: "sdd-core" }),
      "validation-gap.md": GAP_REPORT,
    });
    const scanner = createKiroScanner(context);
    const validationService = createValidationService(scanner);
    const specService = createSpecService({
      scanner,
      readValidations: (feature) => validationService.listForSpec(feature),
    });

    const detail = await specService.get("sdd-core");

    expect(detail.validations).toHaveLength(1);
    expect(detail.validations[0]).toMatchObject({ type: "gap", decision: null });
  });
});
