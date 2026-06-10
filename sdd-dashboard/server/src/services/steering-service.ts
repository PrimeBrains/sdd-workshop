/**
 * SteeringService — `.kiro/steering/` 配下の markdown を内容 + セクション構造付きで返す。
 * （design.md Service 層 SteeringService。Requirement 7.1）
 *
 * 制約:
 * - キャッシュなし。毎呼び出しでディスクを読み直す（1.4, 2.4 と同じ鮮度保証）
 * - パスは RepoContext.kiroDir からのみ解決する（steering SSoT）
 * - パス区切りを含む name は steering/ 外へ解決せず「不在」として扱う
 * - 不在ディレクトリは空配列、不在文書は AppError(RESOURCE_NOT_FOUND)
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RepoContext } from "../config.js";
import { AppError, ErrorCode } from "../errors/codes.js";
import { parseMarkdown } from "../parsers/markdown.js";
import type { SteeringDoc, SteeringDocSummary } from "../types/resources.js";

/** steering 読取インターフェース（GET /api/steering, /api/steering/:name） */
export interface SteeringService {
  /** 全 steering 文書の一覧（name 昇順、先頭見出しタイトル付き）。ディレクトリ不在時は空配列 */
  list(): Promise<SteeringDocSummary[]>;
  /** 単一文書の内容 + セクション構造。不在・不正な name は AppError(RESOURCE_NOT_FOUND) */
  get(name: string): Promise<SteeringDoc>;
}

/**
 * RepoContext に紐づく SteeringService を生成する。
 * Postcondition: 返るインスタンスは状態（キャッシュ）を持たない。
 */
export function createSteeringService(context: RepoContext): SteeringService {
  const steeringDir = join(context.kiroDir, "steering");

  return {
    async list(): Promise<SteeringDocSummary[]> {
      const dirents = await readdirOrNull(steeringDir);
      if (dirents === null) {
        return [];
      }
      const names = dirents
        .filter((dirent) => dirent.isFile() && dirent.name.endsWith(".md"))
        .map((dirent) => dirent.name.slice(0, -".md".length))
        .sort();
      return Promise.all(
        names.map(async (name) => {
          const source = await readFile(join(steeringDir, `${name}.md`), "utf-8");
          const { sections } = parseMarkdown(source);
          return { name, title: sections[0]?.title ?? null };
        }),
      );
    },

    async get(name: string): Promise<SteeringDoc> {
      const source = isSafeName(name)
        ? await readFileOrNull(join(steeringDir, `${name}.md`))
        : null;
      if (source === null) {
        throw new AppError(
          ErrorCode.RESOURCE_NOT_FOUND,
          `steering 文書が存在しません: ${name}`,
        );
      }
      const { sections } = parseMarkdown(source);
      return { name, content: source, sections };
    },
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** 単一ファイル名として安全な名前か（steering/ 外へ解決され得る入力を拒否） */
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
