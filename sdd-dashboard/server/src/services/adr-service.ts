/**
 * AdrService — `.kiro/adr/` 配下の ADR を frontmatter 9 キー + 構造化本文付きで返す。
 * （design.md Service 層 AdrService。Requirements 7.3, 7.5, 7.6）
 *
 * 制約:
 * - キャッシュなし。毎呼び出しでディスクを読み直す（1.4, 2.4 と同じ鮮度保証）
 * - パスは RepoContext.kiroDir からのみ解決する（steering SSoT）
 * - `template.md` は ADR 雛形であり ADR コレクションに含めない（adr.md 規約。
 *   list から除外し、get でも「不在」として扱う = list と membership を一致させる）
 * - frontmatter 欠落・不正は throw せず frontmatter: null + 診断で返す（7.5）。
 *   `app` 欠落は null = リポジトリ横断の決定（7.6）。supersedes / superseded_by は
 *   AdrFrontmatter の型どおり string | null のみ受理し、YAML number は invalid-key 診断
 *   とする（型強制はしない。タスク 2.2 handover の「strings only」方針）
 * - パス区切りを含む id は adr/ 外へ解決せず「不在」として扱う
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RepoContext } from "../config.js";
import { AppError, ErrorCode } from "../errors/codes.js";
import { extractFrontmatter, validateAdrFrontmatter } from "../parsers/frontmatter.js";
import { parseMarkdown } from "../parsers/markdown.js";
import type { Diagnostic } from "../types/document.js";
import type { AdrDoc, AdrFrontmatter, AdrSummary } from "../types/resources.js";

/** ADR 雛形ファイル名（一覧・取得の対象外） */
export const ADR_TEMPLATE_FILE = "template.md";

/** ADR 読取インターフェース（GET /api/adr, /api/adr/:id） */
export interface AdrService {
  /** template.md を除く全 ADR の一覧（name 昇順、frontmatter + 診断付き）。ディレクトリ不在時は空配列 */
  list(): Promise<AdrSummary[]>;
  /** 単一 ADR の詳細（id = 拡張子なしファイル名）。不在・不正な id は AppError(RESOURCE_NOT_FOUND) */
  get(id: string): Promise<AdrDoc>;
}

/**
 * RepoContext に紐づく AdrService を生成する。
 * Postcondition: 返るインスタンスは状態（キャッシュ）を持たない。
 */
export function createAdrService(context: RepoContext): AdrService {
  const adrDir = join(context.kiroDir, "adr");

  return {
    async list(): Promise<AdrSummary[]> {
      const dirents = await readdirOrNull(adrDir);
      if (dirents === null) {
        return [];
      }
      const names = dirents
        .filter(
          (dirent) =>
            dirent.isFile() && dirent.name.endsWith(".md") && dirent.name !== ADR_TEMPLATE_FILE,
        )
        .map((dirent) => dirent.name.slice(0, -".md".length))
        .sort();
      return Promise.all(
        names.map(async (name) => {
          const source = await readFile(join(adrDir, `${name}.md`), "utf-8");
          const { frontmatter, diagnostics } = parseAdrFrontmatter(source);
          return { name, frontmatter, diagnostics };
        }),
      );
    },

    async get(id: string): Promise<AdrDoc> {
      const source =
        isSafeName(id) && `${id}.md` !== ADR_TEMPLATE_FILE
          ? await readFileOrNull(join(adrDir, `${id}.md`))
          : null;
      if (source === null) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, `ADR が存在しません: ${id}`);
      }
      const { frontmatter, diagnostics } = parseAdrFrontmatter(source);
      const { sections } = parseMarkdown(source);
      return { name: id, frontmatter, content: source, sections, diagnostics };
    },
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** frontmatter 抽出 + ADR 既知 9 キー検証（7.3, 7.6。失敗は診断で表現し throw しない） */
function parseAdrFrontmatter(source: string): {
  frontmatter: AdrFrontmatter | null;
  diagnostics: Diagnostic[];
} {
  const extraction = extractFrontmatter(source);
  if (extraction.kind === "raw") {
    return { frontmatter: null, diagnostics: extraction.diagnostics };
  }
  return validateAdrFrontmatter(extraction.data, extraction.position);
}

/** 単一ファイル名として安全な名前か（adr/ 外へ解決され得る入力を拒否） */
function isSafeName(name: string): boolean {
  return name.length > 0 && !name.includes("/") && !name.includes("\\") && name !== "." && name !== "..";
}

/** readdir の不在（ENOENT / ENOTDIR 等）を null で表現する */
async function readdirOrNull(
  dir: string,
): Promise<Array<{ name: string; isFile(): boolean }> | null> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/** readFile の不在を null で表現する */
async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}
