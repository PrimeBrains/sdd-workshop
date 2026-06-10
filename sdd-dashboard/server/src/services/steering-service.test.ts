import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import { AppError, ErrorCode } from "../errors/codes.js";
import type { SectionNode } from "../types/document.js";
import { createSteeringService } from "./steering-service.js";

const tempDirs: string[] = [];

/** 一時リポジトリ（.kiro/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-steering-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  return { repoRoot, kiroDir, port: 0 };
}

/** `.kiro/steering/` 配下にファイル群を作る */
function makeSteering(context: RepoContext, files: Record<string, string>): void {
  const dir = join(context.kiroDir, "steering");
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

describe("SteeringService / list", () => {
  it("steering 配下の全 markdown を name 昇順 + 先頭見出しタイトル付きで返す（7.1）", async () => {
    const context = makeRepo();
    makeSteering(context, {
      "tech.md": "# Technology Stack\n\n## Runtime\n",
      "product.md": "# Product Overview\n",
      "notes.md": "見出しのないメモ\n",
      "ignore.txt": "markdown ではないので含めない",
    });
    const service = createSteeringService(context);

    const summaries = await service.list();

    expect(summaries).toEqual([
      { name: "notes", title: null },
      { name: "product", title: "Product Overview" },
      { name: "tech", title: "Technology Stack" },
    ]);
  });

  it("steering ディレクトリ不在時は空配列を返す", async () => {
    const context = makeRepo();
    const service = createSteeringService(context);

    await expect(service.list()).resolves.toEqual([]);
  });
});

describe("SteeringService / get", () => {
  it("内容 + セクション構造付きの SteeringDoc を返す（7.1）", async () => {
    const context = makeRepo();
    const source = "# Tech\n\n本文\n\n## Stack\n\n- Node\n\n## Commands\n";
    makeSteering(context, { "tech.md": source });
    const service = createSteeringService(context);

    const doc = await service.get("tech");

    expect(doc.name).toBe("tech");
    expect(doc.content).toBe(source);
    expect(outline(doc.sections)).toEqual([
      {
        title: "Tech",
        depth: 1,
        children: [
          { title: "Stack", depth: 2, children: [] },
          { title: "Commands", depth: 2, children: [] },
        ],
      },
    ]);
  });

  it("不在の steering 文書は AppError(RESOURCE_NOT_FOUND) を投げる", async () => {
    const context = makeRepo();
    makeSteering(context, { "tech.md": "# Tech\n" });
    const service = createSteeringService(context);

    const promise = service.get("missing");
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });

  it("パス区切りを含む name は steering 外へ解決せず RESOURCE_NOT_FOUND を投げる", async () => {
    const context = makeRepo();
    makeSteering(context, { "tech.md": "# Tech\n" });
    // steering/ の外（.kiro/ 直下）にファイルを置き、トラバーサルで届かないことを確認する
    writeFileSync(join(context.kiroDir, "secret.md"), "# Secret\n");
    const service = createSteeringService(context);

    await expect(service.get("../secret")).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });
});
