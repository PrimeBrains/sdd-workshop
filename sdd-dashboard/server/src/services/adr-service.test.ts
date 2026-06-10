import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import { AppError, ErrorCode } from "../errors/codes.js";
import type { SectionNode } from "../types/document.js";
import { createAdrService } from "./adr-service.js";

const tempDirs: string[] = [];

/** 一時リポジトリ（.kiro/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-adr-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

/** `.kiro/adr/` 配下にファイル群を作る */
function makeAdrDir(context: RepoContext, files: Record<string, string>): void {
  const dir = join(context.kiroDir, "adr");
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
}

/** SectionNode ツリーを title/depth/children のみの比較用形へ縮約する */
function outline(sections: SectionNode[]): unknown[] {
  return sections.map((section) => ({
    title: section.title,
    depth: section.depth,
    children: outline(section.children),
  }));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

/** 実 ADR-0001 相当の fixture（app あり。9 キー完備） */
const ADR_0001 = `---
id: 1
title: SDD Dashboard は DB なしの薄いローカル Web アプリとして実装する
status: accepted
date: 2026-06-10
app: sdd-dashboard
specs: [sdd-core, sdd-review-ui, sdd-workflow-ui]
requirements: []
supersedes: null
superseded_by: null
---

# ADR-0001: SDD Dashboard は DB なしの薄いローカル Web アプリとして実装する

## Context

背景の説明。

## Decision

決定内容と理由。

## Consequences

- 正: 同期問題が原理的に発生しない

## Alternatives

- 静的サイト生成 — 棄却
`;

/** app キーなし（リポジトリ横断の決定）+ supersedes 文字列の fixture */
const ADR_0002_NO_APP = `---
id: 2
title: リポジトリ横断の決定
status: proposed
date: 2026-06-11
specs: []
requirements: [sdd-core/7.3]
supersedes: "0001"
superseded_by: null
---

# ADR-0002: リポジトリ横断の決定

## Context

app を持たない ADR。
`;

const TEMPLATE = `---
id: 0
title: テンプレート
---

# ADR テンプレート
`;

describe("AdrService / list", () => {
  it("template.md を除く全 ADR を name 昇順 + frontmatter 9 キー付きで返す（7.3, 7.6）", async () => {
    const context = makeRepo();
    makeAdrDir(context, {
      "0002-cross-cutting.md": ADR_0002_NO_APP,
      "0001-sdd-dashboard-local-web-app.md": ADR_0001,
      "template.md": TEMPLATE,
      "notes.txt": "markdown ではないので含めない",
    });
    const service = createAdrService(context);

    const summaries = await service.list();

    expect(summaries).toEqual([
      {
        name: "0001-sdd-dashboard-local-web-app",
        frontmatter: {
          id: 1,
          title: "SDD Dashboard は DB なしの薄いローカル Web アプリとして実装する",
          status: "accepted",
          date: "2026-06-10",
          app: "sdd-dashboard",
          specs: ["sdd-core", "sdd-review-ui", "sdd-workflow-ui"],
          requirements: [],
          supersedes: null,
          superseded_by: null,
        },
        diagnostics: [],
      },
      {
        name: "0002-cross-cutting",
        frontmatter: {
          id: 2,
          title: "リポジトリ横断の決定",
          status: "proposed",
          date: "2026-06-11",
          app: null, // app 欠落 = リポジトリ横断の決定（7.6）
          specs: [],
          requirements: ["sdd-core/7.3"],
          supersedes: "0001",
          superseded_by: null,
        },
        diagnostics: [],
      },
    ]);
  });

  it("frontmatter 欠落の ADR は frontmatter: null + parse-failure 診断で返す（7.5）", async () => {
    const context = makeRepo();
    makeAdrDir(context, {
      "0003-no-frontmatter.md": "# ADR-0003: frontmatter なし\n\n本文のみ。\n",
    });
    const service = createAdrService(context);

    const summaries = await service.list();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.name).toBe("0003-no-frontmatter");
    expect(summaries[0]?.frontmatter).toBeNull();
    expect(summaries[0]?.diagnostics).toEqual([
      expect.objectContaining({ kind: "parse-failure" }),
    ]);
  });

  it("既知キーの型不正は frontmatter: null + invalid-key 診断で返す", async () => {
    const context = makeRepo();
    makeAdrDir(context, {
      // supersedes が YAML number（型は string | null。handover 2.2 → 4.3）
      "0004-bad-key.md": `---
id: 4
title: 型不正
status: proposed
date: 2026-06-12
specs: []
requirements: []
supersedes: 3
superseded_by: null
---

# ADR-0004
`,
    });
    const service = createAdrService(context);

    const summaries = await service.list();

    expect(summaries[0]?.frontmatter).toBeNull();
    expect(summaries[0]?.diagnostics).toEqual([
      expect.objectContaining({
        kind: "invalid-key",
        message: expect.stringContaining("supersedes"),
      }),
    ]);
  });

  it("adr ディレクトリ不在時は空配列を返す", async () => {
    const context = makeRepo();
    const service = createAdrService(context);

    await expect(service.list()).resolves.toEqual([]);
  });
});

describe("AdrService / get", () => {
  it("frontmatter + 全文 + 構造化本文付きの AdrDoc を返す（7.3）", async () => {
    const context = makeRepo();
    makeAdrDir(context, { "0001-sdd-dashboard-local-web-app.md": ADR_0001 });
    const service = createAdrService(context);

    const doc = await service.get("0001-sdd-dashboard-local-web-app");

    expect(doc.name).toBe("0001-sdd-dashboard-local-web-app");
    expect(doc.content).toBe(ADR_0001);
    expect(doc.frontmatter).toMatchObject({ id: 1, app: "sdd-dashboard" });
    expect(doc.diagnostics).toEqual([]);
    expect(outline(doc.sections)).toEqual([
      {
        title: "ADR-0001: SDD Dashboard は DB なしの薄いローカル Web アプリとして実装する",
        depth: 1,
        children: [
          { title: "Context", depth: 2, children: [] },
          { title: "Decision", depth: 2, children: [] },
          { title: "Consequences", depth: 2, children: [] },
          { title: "Alternatives", depth: 2, children: [] },
        ],
      },
    ]);
  });

  it("不在の ADR は AppError(RESOURCE_NOT_FOUND) を投げる", async () => {
    const context = makeRepo();
    makeAdrDir(context, { "0001-sdd-dashboard-local-web-app.md": ADR_0001 });
    const service = createAdrService(context);

    const promise = service.get("9999-missing");
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it("template は ADR ではないため RESOURCE_NOT_FOUND を投げる", async () => {
    const context = makeRepo();
    makeAdrDir(context, { "template.md": TEMPLATE });
    const service = createAdrService(context);

    await expect(service.get("template")).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it("パス区切りを含む id は adr/ 外へ解決せず RESOURCE_NOT_FOUND を投げる", async () => {
    const context = makeRepo();
    makeAdrDir(context, { "0001-sdd-dashboard-local-web-app.md": ADR_0001 });
    // adr/ の外（.kiro/ 直下）にファイルを置き、トラバーサルで届かないことを確認する
    writeFileSync(join(context.kiroDir, "secret.md"), "# Secret\n");
    const service = createAdrService(context);

    await expect(service.get("../secret")).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });
});
