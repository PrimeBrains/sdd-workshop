import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSkillsDir, type RepoContext } from "../config.js";
import { AppError, ErrorCode } from "../errors/codes.js";
import { createSkillService } from "./skill-service.js";

const tempDirs: string[] = [];

/** 一時リポジトリ（.kiro/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-skill-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

/** `.claude/skills/<name>/` にファイル群を作る */
function makeSkill(context: RepoContext, name: string, files: Record<string, string>): void {
  const dir = join(resolveSkillsDir(context), name);
  mkdirSync(dir, { recursive: true });
  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(dir, fileName), content);
  }
}

/** 実リポジトリと同形の frontmatter（metadata.origin はネスト + 引用符付き） */
function skillMarkdown(name: string, origin: string | null): string {
  const originBlock = origin === null ? "" : `metadata:\n  origin: "${origin}"\n`;
  return `---\nname: ${name}\ndescription: test skill\n${originBlock}---\n\n# ${name}\n\n## Overview\n`;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("resolveSkillsDir", () => {
  it("repoRoot 直下の .claude/skills を返す", () => {
    const context = makeRepo();
    expect(resolveSkillsDir(context)).toBe(join(context.repoRoot, ".claude", "skills"));
  });
});

describe("SkillService / list", () => {
  it("SKILL.md を含むディレクトリのみを name 昇順で en/ja 有無 + origin 付きで返す（7.2, 7.7）", async () => {
    const context = makeRepo();
    makeSkill(context, "kiro-debug", {
      "SKILL.md": skillMarkdown("kiro-debug", "cc-sdd"),
      "SKILL.ja.md": "# kiro-debug（日本語）\n",
    });
    makeSkill(context, "atelier-draft", {
      "SKILL.md": skillMarkdown("atelier-draft", "custom"),
    });
    makeSkill(context, "no-origin", {
      "SKILL.md": skillMarkdown("no-origin", null),
    });
    // SKILL.md を持たないディレクトリは一覧から除外される（7.2）
    makeSkill(context, "not-a-skill", { "README.md": "# not a skill\n" });
    const service = createSkillService(context);

    const summaries = await service.list();

    expect(summaries).toEqual([
      { name: "atelier-draft", hasEn: true, hasJa: false, origin: "custom" },
      { name: "kiro-debug", hasEn: true, hasJa: true, origin: "cc-sdd" },
      { name: "no-origin", hasEn: true, hasJa: false, origin: null },
    ]);
  });

  it("skills ディレクトリ不在時は空配列を返す", async () => {
    const context = makeRepo();
    const service = createSkillService(context);

    await expect(service.list()).resolves.toEqual([]);
  });
});

describe("SkillService / get", () => {
  it("ja あり: SKILL.md / SKILL.ja.md を英日ペアとして返す（7.2）", async () => {
    const context = makeRepo();
    const en = skillMarkdown("kiro-debug", "cc-sdd");
    const ja = "# kiro-debug（日本語）\n\n## 概要\n";
    makeSkill(context, "kiro-debug", { "SKILL.md": en, "SKILL.ja.md": ja });
    const service = createSkillService(context);

    const doc = await service.get("kiro-debug");

    expect(doc.name).toBe("kiro-debug");
    expect(doc.origin).toBe("cc-sdd");
    expect(doc.en.content).toBe(en);
    expect(doc.en.sections.map((section) => section.title)).toEqual(["kiro-debug"]);
    expect(doc.ja).not.toBeNull();
    expect(doc.ja?.content).toBe(ja);
    expect(doc.ja?.sections.map((section) => section.title)).toEqual(["kiro-debug（日本語）"]);
  });

  it("ja なし: ja は null を返す（7.2）", async () => {
    const context = makeRepo();
    makeSkill(context, "atelier-draft", { "SKILL.md": skillMarkdown("atelier-draft", "custom") });
    const service = createSkillService(context);

    const doc = await service.get("atelier-draft");

    expect(doc.ja).toBeNull();
    expect(doc.origin).toBe("custom");
  });

  it("metadata.origin 欠落時は origin: null を返す（7.7）", async () => {
    const context = makeRepo();
    makeSkill(context, "no-origin", { "SKILL.md": skillMarkdown("no-origin", null) });
    const service = createSkillService(context);

    const doc = await service.get("no-origin");

    expect(doc.origin).toBeNull();
  });

  it("frontmatter 自体がない SKILL.md でも origin: null で返す（7.7）", async () => {
    const context = makeRepo();
    const source = "# bare-skill\n\nfrontmatter なし\n";
    makeSkill(context, "bare-skill", { "SKILL.md": source });
    const service = createSkillService(context);

    const doc = await service.get("bare-skill");

    expect(doc.origin).toBeNull();
    expect(doc.en.content).toBe(source);
  });

  it("不在スキル / SKILL.md なしディレクトリは AppError(RESOURCE_NOT_FOUND) を投げる", async () => {
    const context = makeRepo();
    makeSkill(context, "not-a-skill", { "README.md": "# not a skill\n" });
    const service = createSkillService(context);

    const missing = service.get("missing");
    await expect(missing).rejects.toBeInstanceOf(AppError);
    await expect(missing).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });

    await expect(service.get("not-a-skill")).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it("パス区切りを含む name は skills 外へ解決せず RESOURCE_NOT_FOUND を投げる", async () => {
    const context = makeRepo();
    // skills/ の外にディレクトリ + SKILL.md を置き、トラバーサルで届かないことを確認する
    const outside = join(context.repoRoot, ".claude", "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "SKILL.md"), "# outside\n");
    const service = createSkillService(context);

    await expect(service.get("../outside")).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });
});
