/**
 * KiroScanner — `.kiro/specs/` のディレクトリ走査とファイルインベントリ化。
 * （design.md Service 層 KiroScanner。Requirement 2.1）
 *
 * 制約:
 * - キャッシュを一切持たない。すべてのメソッドが呼び出しのたびに
 *   ディスクを読み直し、変更が次の呼び出しへ即時反映される（1.4, 2.4 の構造的担保）
 * - パスは RepoContext 経由でのみ解決する（独自のパス解決禁止、steering SSoT）
 * - feature 名にパス区切り・親参照を含む入力は `.kiro/specs/` 外へ出さず
 *   「不在」として扱う（null 返却。書込系のガードは SafePathGuard の責務）
 * - 不在（specs/ ディレクトリ・spec・ファイル）は例外ではなく空配列 / null
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RepoContext } from "../config.js";
import type { ArtifactName } from "../types/spec.js";

/** 成果物種別 → spec ディレクトリ内のファイル名（types/spec.ts ArtifactName と 1:1） */
export const ARTIFACT_FILES: Readonly<Record<ArtifactName, string>> = {
  brief: "brief.md",
  requirements: "requirements.md",
  design: "design.md",
  tasks: "tasks.md",
  research: "research.md",
  validationGap: "validation-gap.md",
  validationDesign: "validation-design.md",
  validationImpl: "validation-impl.md",
};

/** spec ディレクトリ 1 件分のインベントリ（走査時点のスナップショット） */
export interface SpecDirEntry {
  /** spec ディレクトリ名 = feature 名 */
  feature: string;
  /** spec ディレクトリの絶対パス */
  dir: string;
  /** ディレクトリ直下に存在するファイル名の集合 */
  files: ReadonlySet<string>;
  /** 成果物ファイルの有無フラグ（ARTIFACT_FILES の存在判定） */
  artifacts: Record<ArtifactName, boolean>;
}

/** `.kiro/specs/` 走査インターフェース。全メソッドが毎回ディスクを読み直す */
export interface KiroScanner {
  /** 全 spec ディレクトリのインベントリを feature 名昇順で返す。specs/ 不在時は空配列 */
  listSpecDirs(): Promise<SpecDirEntry[]>;
  /** 単一 spec のインベントリ。不在・不正な feature 名は null */
  findSpecDir(feature: string): Promise<SpecDirEntry | null>;
  /** spec ディレクトリ直下のファイル内容。不在・不正な名前は null */
  readSpecFile(feature: string, fileName: string): Promise<string | null>;
}

/**
 * RepoContext に紐づく KiroScanner を生成する。
 * Postcondition: 返るインスタンスは状態（キャッシュ）を持たない。
 */
export function createKiroScanner(context: RepoContext): KiroScanner {
  const specsDir = join(context.kiroDir, "specs");

  return {
    async listSpecDirs(): Promise<SpecDirEntry[]> {
      const dirents = await readdirOrNull(specsDir);
      if (dirents === null) {
        return [];
      }
      const features = dirents
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort();
      const entries = await Promise.all(features.map((feature) => inventory(specsDir, feature)));
      return entries.filter((entry): entry is SpecDirEntry => entry !== null);
    },

    async findSpecDir(feature: string): Promise<SpecDirEntry | null> {
      if (!isSafeName(feature)) {
        return null;
      }
      return inventory(specsDir, feature);
    },

    async readSpecFile(feature: string, fileName: string): Promise<string | null> {
      if (!isSafeName(feature) || !isSafeName(fileName)) {
        return null;
      }
      try {
        return await readFile(join(specsDir, feature, fileName), "utf-8");
      } catch {
        return null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** 単一ディレクトリ名 / ファイル名として安全な名前か（specs/ 外へ解決され得る入力を拒否） */
function isSafeName(name: string): boolean {
  return name.length > 0 && !name.includes("/") && !name.includes("\\") && name !== "." && name !== "..";
}

/** readdir の不在（ENOENT / ENOTDIR 等）を null で表現する */
async function readdirOrNull(
  dir: string,
): Promise<Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> | null> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/** spec ディレクトリ 1 件を読み取りインベントリ化する。不在時は null */
async function inventory(specsDir: string, feature: string): Promise<SpecDirEntry | null> {
  const dir = join(specsDir, feature);
  const dirents = await readdirOrNull(dir);
  if (dirents === null) {
    return null;
  }
  const files = new Set(dirents.filter((dirent) => dirent.isFile()).map((dirent) => dirent.name));
  const artifacts = Object.fromEntries(
    Object.entries(ARTIFACT_FILES).map(([artifact, fileName]) => [artifact, files.has(fileName)]),
  ) as Record<ArtifactName, boolean>;
  return { feature, dir, files, artifacts };
}
