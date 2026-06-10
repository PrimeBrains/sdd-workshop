/**
 * SkillService — スキルディレクトリ走査と SKILL.md / SKILL.ja.md 英日ペア解決 +
 * frontmatter `metadata.origin` 抽出。（design.md Service 層 SkillService。Requirements 7.2, 7.7）
 *
 * 制約:
 * - キャッシュなし。毎呼び出しでディスクを読み直す（1.4, 2.4 と同じ鮮度保証）
 * - スキルディレクトリは `repoRoot/.claude/skills/`（design.md「読取対象」）。
 *   パス解決は config.ts の `resolveSkillsDir` に集約し、watcher 等も同関数を参照すること
 * - SKILL.md を含むディレクトリのみをスキルとして扱う（7.2）。SKILL.ja.md 欠落時は ja: null
 * - `metadata.origin` が欠落（frontmatter なし・metadata なし・非 string 含む）なら origin: null（7.7）
 * - パス区切りを含む name は skills/ 外へ解決せず「不在」として扱う
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveSkillsDir, type RepoContext } from "../config.js";
import { AppError, ErrorCode } from "../errors/codes.js";
import { extractFrontmatter } from "../parsers/frontmatter.js";
import { parseMarkdown } from "../parsers/markdown.js";
import type { MarkdownContent } from "../types/document.js";
import type { SkillDoc, SkillSummary } from "../types/resources.js";

/** SKILL.md（英語正本）のファイル名 */
export const SKILL_EN_FILE = "SKILL.md";
/** SKILL.ja.md（日本語版、任意）のファイル名 */
export const SKILL_JA_FILE = "SKILL.ja.md";

/** スキル読取インターフェース（GET /api/skills, /api/skills/:name） */
export interface SkillService {
  /** SKILL.md を含む全スキルの一覧（name 昇順、en/ja 有無 + origin 付き）。ディレクトリ不在時は空配列 */
  list(): Promise<SkillSummary[]>;
  /** 単一スキルの英日ペア（en 必須・ja nullable・origin nullable）。不在は AppError(RESOURCE_NOT_FOUND) */
  get(name: string): Promise<SkillDoc>;
}

/**
 * RepoContext に紐づく SkillService を生成する。
 * Postcondition: 返るインスタンスは状態（キャッシュ）を持たない。
 */
export function createSkillService(context: RepoContext): SkillService {
  const skillsDir = resolveSkillsDir(context);

  return {
    async list(): Promise<SkillSummary[]> {
      const dirents = await readdirOrNull(skillsDir);
      if (dirents === null) {
        return [];
      }
      const names = dirents
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort();
      const summaries = await Promise.all(
        names.map(async (name): Promise<SkillSummary | null> => {
          const en = await readFileOrNull(join(skillsDir, name, SKILL_EN_FILE));
          if (en === null) {
            // SKILL.md を持たないディレクトリはスキルではない（7.2）
            return null;
          }
          const ja = await readFileOrNull(join(skillsDir, name, SKILL_JA_FILE));
          return { name, hasEn: true, hasJa: ja !== null, origin: extractOrigin(en) };
        }),
      );
      return summaries.filter((summary): summary is SkillSummary => summary !== null);
    },

    async get(name: string): Promise<SkillDoc> {
      const en = isSafeName(name)
        ? await readFileOrNull(join(skillsDir, name, SKILL_EN_FILE))
        : null;
      if (en === null) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, `スキルが存在しません: ${name}`);
      }
      const ja = await readFileOrNull(join(skillsDir, name, SKILL_JA_FILE));
      return {
        name,
        en: toMarkdownContent(en),
        ja: ja === null ? null : toMarkdownContent(ja),
        origin: extractOrigin(en),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * SKILL.md frontmatter から `metadata.origin` を抽出する（7.7）。
 * frontmatter 欠落・`metadata` 非マップ・`origin` 欠落 / 非 string はすべて null。
 */
function extractOrigin(source: string): string | null {
  const extraction = extractFrontmatter(source);
  if (extraction.kind !== "frontmatter") {
    return null;
  }
  const metadata = extraction.data["metadata"];
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const origin = (metadata as Record<string, unknown>)["origin"];
  return typeof origin === "string" ? origin : null;
}

/** 全文 + セクションツリーの共通読取ビューへ変換する */
function toMarkdownContent(source: string): MarkdownContent {
  const { sections } = parseMarkdown(source);
  return { content: source, sections };
}

/** 単一ディレクトリ名として安全な名前か（skills/ 外へ解決され得る入力を拒否） */
function isSafeName(name: string): boolean {
  return name.length > 0 && !name.includes("/") && !name.includes("\\") && name !== "." && name !== "..";
}

/** readdir の不在（ENOENT / ENOTDIR 等）を null で表現する */
async function readdirOrNull(
  dir: string,
): Promise<Array<{ name: string; isDirectory(): boolean }> | null> {
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
