/**
 * AdrWriter — ADR 規約準拠ファイルの採番・生成（design.md AdrWriter ブロック。
 * Requirements 11.1, 11.2, 11.3, 11.5, 11.6）。
 *
 * 採番（11.1）:
 * - `.kiro/adr/` を走査して既存最大番号 + 1 を 4 桁ゼロ埋めで採番する（欠番を埋めない）。
 *   `^\d{4}-` にマッチする .md のみ対象で、template.md は自然に走査外
 * - スラッグはタイトルから kebab-case 導出（入力 slug で上書き可）。日本語タイトル等で
 *   空スラッグになる場合は "adr" へフォールバックする
 *
 * 生成内容（11.2, 11.3, 11.6 — adr.md 規約 / template.md と同形）:
 * - frontmatter 9 キー: id / title / status / date / app / specs / requirements /
 *   supersedes / superseded_by。status デフォルト proposed、date は当日（注入可能クロック）、
 *   app 省略時は null
 * - 本文: `# ADR-NNNN: <title>` + 必須 `## Context` / `## Decision` / `## Consequences`
 *   （+ alternatives 指定時のみ `## Alternatives`）
 *
 * 衝突保護（11.5）: 書込は SafePathGuard の exclusive 書込（生 EEXIST を投げる —
 * タスク 7.1 申し送り）で行い、EEXIST を AppError(ADR_NUMBER_CONFLICT, 409) へマップして
 * 既存ファイルを上書きしない。
 *
 * 監査（12.3 申し送り）: 拒否・失敗を含む全試行を throw の前に audit.record する。
 * AppError は outcome=rejected + errorCode、未知例外は outcome=failed。
 */
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import type { RepoContext } from "../../config.js";
import { AppError, ErrorCode } from "../../errors/codes.js";
import { extractFrontmatter, validateAdrFrontmatter } from "../../parsers/frontmatter.js";
import { parseMarkdown } from "../../parsers/markdown.js";
import type { CreateAdrInput } from "../../types/api.js";
import type { AdrDoc } from "../../types/resources.js";
import type { AuditLog } from "./audit-log.js";
import type { SafePathGuard } from "./safe-path.js";

export interface AdrWriter {
  /**
   * ADR を採番・生成し、作成後の構造化 ADR を返す（11.1, 11.2）。
   * @throws AppError(ADR_NUMBER_CONFLICT) 書込時に同番号ファイルが既存の場合（11.5）
   */
  create(input: CreateAdrInput): Promise<AdrDoc>;
}

export interface AdrWriterDeps {
  context: RepoContext;
  guard: SafePathGuard;
  audit: AuditLog;
  /** 当日決定用クロック（テスト注入用。デフォルトは現在時刻） */
  now?: () => Date;
}

/** ファイル名の連番部（`NNNN-` プレフィックス付き .md）にマッチするパターン */
const NUMBERED_ADR_PATTERN = /^(\d{4})-.*\.md$/;

export function createAdrWriter(deps: AdrWriterDeps): AdrWriter {
  const { context, guard, audit } = deps;
  const now = deps.now ?? (() => new Date());
  const adrDir = join(context.kiroDir, "adr");

  return {
    async create(input) {
      const id = (await scanMaxNumber(adrDir)) + 1;
      const fileName = `${padNumber(id)}-${deriveSlug(input.slug ?? input.title)}.md`;
      // 監査の対象パスは .kiro/ 起点の正準相対パス（他 writer と同語彙）
      const targetPath = `adr/${fileName}`;
      try {
        const content = renderAdr(id, input, formatLocalDate(now()));
        // adr/ 未作成のリポジトリでも書けるようにする（.kiro/ 内の固定サブディレクトリのみ）
        await mkdir(adrDir, { recursive: true });
        await guard.writeFileAtomic(join(adrDir, fileName), content, { exclusive: true });
        audit.record({ operation: "adr-create", targetPath, outcome: "success" });
        return toAdrDoc(fileName.slice(0, -".md".length), content);
      } catch (error) {
        // 生 EEXIST（7.1 申し送り）を採番衝突として 409 へマップする（11.5）
        const mapped = isEexist(error)
          ? new AppError(
              ErrorCode.ADR_NUMBER_CONFLICT,
              `ADR 番号が既存ファイルと衝突しました: ${fileName}`,
              { fileName },
            )
          : error;
        // 拒否を含む全試行を記録してから throw する（12.3）
        if (mapped instanceof AppError) {
          audit.record({ operation: "adr-create", targetPath, outcome: "rejected", errorCode: mapped.code });
        } else {
          audit.record({ operation: "adr-create", targetPath, outcome: "failed" });
        }
        throw mapped;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** adr/ 配下の `NNNN-*.md` の最大番号を返す（不在・空ディレクトリは 0） */
async function scanMaxNumber(adrDir: string): Promise<number> {
  let names: string[];
  try {
    names = await readdir(adrDir);
  } catch {
    return 0; // ディレクトリ不在 = 既存 ADR なし
  }
  let max = 0;
  for (const name of names) {
    const match = NUMBERED_ADR_PATTERN.exec(name);
    if (match?.[1] !== undefined) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return max;
}

/** 4 桁ゼロ埋め（11.1） */
function padNumber(id: number): string {
  return String(id).padStart(4, "0");
}

/**
 * kebab-case スラッグを導出する（11.1）。英数字以外はハイフンに畳み、
 * 空になる場合（日本語タイトル等）は "adr" へフォールバックする。
 */
function deriveSlug(base: string): string {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "adr" : slug;
}

/** ローカル時刻基準の YYYY-MM-DD（11.3 の「当日」） */
function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** adr.md 規約 / template.md と同形の ADR 全文を生成する（11.2, 11.3, 11.6） */
function renderAdr(id: number, input: CreateAdrInput, date: string): string {
  // キー順は template.md と一致させる。YAML.stringify が挿入順を保持し、
  // null / 空配列 / 特殊文字を含むタイトルも正しくシリアライズする
  const frontmatter = YAML.stringify({
    id,
    title: input.title,
    status: input.status ?? "proposed",
    date,
    app: input.app ?? null,
    specs: input.specs ?? [],
    requirements: input.requirements ?? [],
    supersedes: null,
    superseded_by: null,
  });
  const sections = [
    `# ADR-${padNumber(id)}: ${input.title}`,
    `## Context\n\n${input.context}`,
    `## Decision\n\n${input.decision}`,
    `## Consequences\n\n${input.consequences}`,
  ];
  if (input.alternatives !== undefined) {
    sections.push(`## Alternatives\n\n${input.alternatives}`);
  }
  return `---\n${frontmatter}---\n\n${sections.join("\n\n")}\n`;
}

/** 生成済み全文を AdrService.get と同じ手順で構造化する（返却契約: AdrDoc） */
function toAdrDoc(name: string, content: string): AdrDoc {
  const extraction = extractFrontmatter(content);
  const { frontmatter, diagnostics } =
    extraction.kind === "frontmatter"
      ? validateAdrFrontmatter(extraction.data, extraction.position)
      : { frontmatter: null, diagnostics: extraction.diagnostics };
  const { sections } = parseMarkdown(content);
  return { name, frontmatter, content, sections, diagnostics };
}

/** 生の Node EEXIST エラーか（exclusive 書込の衝突 — 7.1 申し送り） */
function isEexist(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "EEXIST";
}
