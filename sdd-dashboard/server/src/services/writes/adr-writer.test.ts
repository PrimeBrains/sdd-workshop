import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../../config.js";
import { AppError, ErrorCode } from "../../errors/codes.js";
import { extractFrontmatter, validateAdrFrontmatter } from "../../parsers/frontmatter.js";
import type { CreateAdrInput } from "../../types/api.js";
import type { AdrFrontmatter } from "../../types/resources.js";
import { createAdrWriter } from "./adr-writer.js";
import { createAuditLog, type AuditEntry } from "./audit-log.js";
import { createSafePathGuard, type SafePathGuard } from "./safe-path.js";

const tempDirs: string[] = [];

/** 固定クロック（ローカル時刻 2026-06-11） */
const FIXED_NOW = () => new Date(2026, 5, 11, 10, 30, 0);
const TODAY = "2026-06-11";

/** 一時リポジトリ（.kiro/adr/ 付き）を作り RepoContext を返す */
function makeRepo(options: { withAdrDir?: boolean } = {}): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-adrwriter-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(kiroDir);
  if (options.withAdrDir !== false) {
    mkdirSync(join(kiroDir, "adr"));
  }
  return { repoRoot, kiroDir, port: 0 };
}

/** AdrWriter + 監査エントリ収集を組み立てる */
function makeWriter(context: RepoContext, guard?: SafePathGuard) {
  const auditEntries: AuditEntry[] = [];
  const audit = createAuditLog({
    sink: (line) => auditEntries.push(JSON.parse(line) as AuditEntry),
  });
  const writer = createAdrWriter({
    context,
    guard: guard ?? createSafePathGuard(context),
    audit,
    now: FIXED_NOW,
  });
  return { writer, auditEntries };
}

/** 必須フィールドのみの最小入力 */
function minimalInput(overrides: Partial<CreateAdrInput> = {}): CreateAdrInput {
  return {
    title: "Use Local Web App",
    context: "背景の説明。",
    decision: "ローカル Web アプリとして実装する。",
    consequences: "正負の帰結。",
    ...overrides,
  };
}

/** 作成済みファイルを FrontmatterParser で読み戻し、検証済み frontmatter を返す */
function readBackFrontmatter(
  context: RepoContext,
  fileName: string,
): { frontmatter: AdrFrontmatter | null; body: string } {
  const source = readFileSync(join(context.kiroDir, "adr", fileName), "utf-8");
  const extraction = extractFrontmatter(source);
  expect(extraction.kind).toBe("frontmatter");
  if (extraction.kind !== "frontmatter") {
    throw new Error("unreachable");
  }
  const { frontmatter, diagnostics } = validateAdrFrontmatter(extraction.data, extraction.position);
  expect(diagnostics).toEqual([]);
  return { frontmatter, body: extraction.body };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createAdrWriter / 採番とファイル名（11.1）", () => {
  it("空の adr/ では 0001 から採番し、タイトル由来の kebab-case スラッグで命名する", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    const doc = await writer.create(minimalInput({ title: "Use Local Web App" }));

    expect(doc.name).toBe("0001-use-local-web-app");
    const source = readFileSync(join(context.kiroDir, "adr", "0001-use-local-web-app.md"), "utf-8");
    expect(source).toBe(doc.content);
  });

  it("既存最大番号 + 1 で採番する（欠番は埋めず、template.md は走査から除外）", async () => {
    const context = makeRepo();
    writeFileSync(join(context.kiroDir, "adr", "0002-alpha.md"), "---\nid: 2\n---\n");
    writeFileSync(join(context.kiroDir, "adr", "0007-beta.md"), "---\nid: 7\n---\n");
    writeFileSync(join(context.kiroDir, "adr", "template.md"), "---\nid: 0\n---\n");
    const { writer } = makeWriter(context);

    const doc = await writer.create(minimalInput({ title: "Next Decision" }));

    expect(doc.name).toBe("0008-next-decision");
    expect(doc.frontmatter?.id).toBe(8);
  });

  it("入力の slug がタイトル由来のスラッグを上書きする", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    const doc = await writer.create(minimalInput({ slug: "custom-slug" }));

    expect(doc.name).toBe("0001-custom-slug");
  });

  it("日本語タイトル等で空スラッグになる場合は adr へフォールバックする", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    const doc = await writer.create(minimalInput({ title: "ローカル構成の決定" }));

    expect(doc.name).toBe("0001-adr");
  });

  it("adr/ ディレクトリが未作成でも作成して書き込む", async () => {
    const context = makeRepo({ withAdrDir: false });
    const { writer } = makeWriter(context);

    const doc = await writer.create(minimalInput());

    expect(doc.name).toBe("0001-use-local-web-app");
    const { frontmatter } = readBackFrontmatter(context, "0001-use-local-web-app.md");
    expect(frontmatter?.id).toBe(1);
  });

  it("連続 2 回の作成で番号が 1 ずつ増える", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    const first = await writer.create(minimalInput({ title: "First Decision" }));
    const second = await writer.create(minimalInput({ title: "Second Decision" }));

    expect(first.name).toBe("0001-first-decision");
    expect(second.name).toBe("0002-second-decision");
    expect(first.frontmatter?.id).toBe(1);
    expect(second.frontmatter?.id).toBe(2);
  });
});

describe("createAdrWriter / frontmatter 9 キーのラウンドトリップ（11.2, 11.3, 11.6）", () => {
  it("app 指定時: 全 9 キーが FrontmatterParser で厳密値読取できる", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    await writer.create(
      minimalInput({
        title: "Adopt Hono",
        status: "accepted",
        app: "sdd-dashboard",
        specs: ["sdd-core"],
        requirements: ["sdd-core/11.1", "sdd-core/11.2"],
      }),
    );

    const { frontmatter } = readBackFrontmatter(context, "0001-adopt-hono.md");
    expect(frontmatter).toMatchObject({
      id: 1,
      title: "Adopt Hono",
      status: "accepted",
      date: TODAY,
      app: "sdd-dashboard",
      specs: ["sdd-core"],
      requirements: ["sdd-core/11.1", "sdd-core/11.2"],
      supersedes: null,
      superseded_by: null,
    });
  });

  it("app 省略時: frontmatter の app は null になる（11.6）", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    await writer.create(minimalInput());

    const { frontmatter } = readBackFrontmatter(context, "0001-use-local-web-app.md");
    expect(frontmatter?.app).toBeNull();
  });

  it("status 省略時は proposed、date は当日にデフォルトされる（11.3）", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    await writer.create(minimalInput());

    const { frontmatter } = readBackFrontmatter(context, "0001-use-local-web-app.md");
    expect(frontmatter?.status).toBe("proposed");
    expect(frontmatter?.date).toBe(TODAY);
  });

  it("specs / requirements 省略時は空配列になる", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    await writer.create(minimalInput());

    const { frontmatter } = readBackFrontmatter(context, "0001-use-local-web-app.md");
    expect(frontmatter?.specs).toEqual([]);
    expect(frontmatter?.requirements).toEqual([]);
  });
});

describe("createAdrWriter / 本文セクション（11.2）", () => {
  it("必須セクション Context / Decision / Consequences を入力本文付きで生成する", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    const doc = await writer.create(
      minimalInput({
        context: "背景テキスト",
        decision: "決定テキスト",
        consequences: "帰結テキスト",
      }),
    );

    expect(doc.content).toContain("# ADR-0001: Use Local Web App");
    expect(doc.content).toContain("## Context\n\n背景テキスト");
    expect(doc.content).toContain("## Decision\n\n決定テキスト");
    expect(doc.content).toContain("## Consequences\n\n帰結テキスト");
    expect(doc.content).not.toContain("## Alternatives");
  });

  it("alternatives 指定時のみ ## Alternatives セクションを生成する", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    const doc = await writer.create(minimalInput({ alternatives: "棄却案テキスト" }));

    expect(doc.content).toContain("## Alternatives\n\n棄却案テキスト");
  });

  it("返却 AdrDoc は構造化済み（frontmatter 非 null + sections + 診断なし）", async () => {
    const context = makeRepo();
    const { writer } = makeWriter(context);

    const doc = await writer.create(minimalInput());

    expect(doc.frontmatter).not.toBeNull();
    expect(doc.diagnostics).toEqual([]);
    expect(doc.sections.length).toBeGreaterThan(0);
  });
});

describe("createAdrWriter / 番号衝突と監査（11.5, 12.3）", () => {
  it("書込時に番号が衝突したら ADR_NUMBER_CONFLICT で失敗し、既存ファイルを上書きしない", async () => {
    const context = makeRepo();
    const realGuard = createSafePathGuard(context);
    const conflictingPath = join(context.kiroDir, "adr", "0001-race-decision.md");
    // 採番走査の後・書込の前に他プロセスが同番号で書いた状況をシミュレートする
    const racingGuard: SafePathGuard = {
      assertWritablePath: (candidate) => realGuard.assertWritablePath(candidate),
      writeFileAtomic: (path, content, opts) => {
        writeFileSync(conflictingPath, "既存の内容");
        return realGuard.writeFileAtomic(path, content, opts);
      },
    };
    const { writer, auditEntries } = makeWriter(context, racingGuard);

    const error = await writer.create(minimalInput({ title: "Race Decision" })).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ErrorCode.ADR_NUMBER_CONFLICT);
    // 既存ファイルは保護される（11.5）
    expect(readFileSync(conflictingPath, "utf-8")).toBe("既存の内容");
    // 拒否も throw の前に監査記録される（12.3 申し送り）
    expect(auditEntries).toEqual([
      expect.objectContaining({
        operation: "adr-create",
        targetPath: "adr/0001-race-decision.md",
        outcome: "rejected",
        errorCode: ErrorCode.ADR_NUMBER_CONFLICT,
      }),
    ]);
  });

  it("成功時に operation=adr-create / outcome=success の監査エントリを記録する", async () => {
    const context = makeRepo();
    const { writer, auditEntries } = makeWriter(context);

    await writer.create(minimalInput());

    expect(auditEntries).toEqual([
      expect.objectContaining({
        operation: "adr-create",
        targetPath: "adr/0001-use-local-web-app.md",
        outcome: "success",
        errorCode: null,
      }),
    ]);
  });
});
