import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import { ARTIFACT_FILES, createKiroScanner } from "./kiro-scanner.js";

const tempDirs: string[] = [];

/** 一時リポジトリ（.kiro/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-scanner-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

/** spec ディレクトリと成果物ファイルを作る */
function makeSpec(context: RepoContext, feature: string, files: Record<string, string>): string {
  const dir = join(context.kiroDir, "specs", feature);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("ARTIFACT_FILES", () => {
  it("8 種の成果物すべてに対応ファイル名を持つ", () => {
    expect(ARTIFACT_FILES).toEqual({
      brief: "brief.md",
      requirements: "requirements.md",
      design: "design.md",
      tasks: "tasks.md",
      research: "research.md",
      validationGap: "validation-gap.md",
      validationDesign: "validation-design.md",
      validationImpl: "validation-impl.md",
    });
  });
});

describe("createKiroScanner / listSpecDirs", () => {
  it(".kiro/specs/ 配下の spec ディレクトリを feature 名昇順でインベントリ化する（2.1）", async () => {
    const context = makeRepo();
    makeSpec(context, "beta", { "brief.md": "# beta" });
    makeSpec(context, "alpha", {
      "spec.json": "{}",
      "brief.md": "# alpha",
      "requirements.md": "# Req",
      "design.md": "# Design",
      "tasks.md": "# Tasks",
      "research.md": "# Research",
      "validation-gap.md": "gap",
      "validation-design.md": "design",
      "validation-impl.md": "impl",
    });
    const scanner = createKiroScanner(context);

    const entries = await scanner.listSpecDirs();

    expect(entries.map((entry) => entry.feature)).toEqual(["alpha", "beta"]);
    expect(entries[0]?.artifacts).toEqual({
      brief: true,
      requirements: true,
      design: true,
      tasks: true,
      research: true,
      validationGap: true,
      validationDesign: true,
      validationImpl: true,
    });
    expect(entries[1]?.artifacts).toEqual({
      brief: true,
      requirements: false,
      design: false,
      tasks: false,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    });
    expect(entries[0]?.dir).toBe(join(context.kiroDir, "specs", "alpha"));
  });

  it(".kiro/specs/ が存在しない場合は空配列を返す（クラッシュしない）", async () => {
    const context = makeRepo();
    const scanner = createKiroScanner(context);
    await expect(scanner.listSpecDirs()).resolves.toEqual([]);
  });

  it("specs/ 直下の通常ファイルはインベントリに含めない", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", { "brief.md": "# alpha" });
    writeFileSync(join(context.kiroDir, "specs", "README.md"), "not a spec");
    const scanner = createKiroScanner(context);

    const entries = await scanner.listSpecDirs();

    expect(entries.map((entry) => entry.feature)).toEqual(["alpha"]);
  });

  it("キャッシュを持たず、走査後に追加された spec が次の走査へ即時反映される（1.4, 2.4）", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", { "brief.md": "# alpha" });
    const scanner = createKiroScanner(context);

    const before = await scanner.listSpecDirs();
    expect(before).toHaveLength(1);

    makeSpec(context, "beta", { "requirements.md": "# Req" });
    const after = await scanner.listSpecDirs();
    expect(after.map((entry) => entry.feature)).toEqual(["alpha", "beta"]);
    expect(after[1]?.artifacts.requirements).toBe(true);
  });
});

describe("createKiroScanner / findSpecDir", () => {
  it("存在する feature のインベントリを返し、不在の feature は null を返す", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", { "spec.json": "{}", "tasks.md": "# Tasks" });
    const scanner = createKiroScanner(context);

    const found = await scanner.findSpecDir("alpha");
    expect(found?.feature).toBe("alpha");
    expect(found?.artifacts.tasks).toBe(true);
    expect(found?.artifacts.brief).toBe(false);

    await expect(scanner.findSpecDir("missing")).resolves.toBeNull();
  });

  it("パス区切りや親参照を含む feature 名は specs/ 外へ出ずに null を返す", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", { "brief.md": "# alpha" });
    const scanner = createKiroScanner(context);

    await expect(scanner.findSpecDir("../steering")).resolves.toBeNull();
    await expect(scanner.findSpecDir("alpha/../alpha")).resolves.toBeNull();
    await expect(scanner.findSpecDir("")).resolves.toBeNull();
  });
});

describe("createKiroScanner / readSpecFile", () => {
  it("成果物ファイルの内容を毎回ディスクから読み直し、書き換えが即時反映される（2.4）", async () => {
    const context = makeRepo();
    const dir = makeSpec(context, "alpha", { "requirements.md": "before" });
    const scanner = createKiroScanner(context);

    await expect(scanner.readSpecFile("alpha", "requirements.md")).resolves.toBe("before");

    writeFileSync(join(dir, "requirements.md"), "after");
    await expect(scanner.readSpecFile("alpha", "requirements.md")).resolves.toBe("after");
  });

  it("不在ファイル・不在 feature・不正な名前は null を返す", async () => {
    const context = makeRepo();
    makeSpec(context, "alpha", { "brief.md": "# alpha" });
    const scanner = createKiroScanner(context);

    await expect(scanner.readSpecFile("alpha", "design.md")).resolves.toBeNull();
    await expect(scanner.readSpecFile("missing", "brief.md")).resolves.toBeNull();
    await expect(scanner.readSpecFile("../..", "brief.md")).resolves.toBeNull();
    await expect(scanner.readSpecFile("alpha", "../alpha/brief.md")).resolves.toBeNull();
  });
});
