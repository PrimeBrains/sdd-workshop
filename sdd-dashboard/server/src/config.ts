/**
 * RepoContext — リポジトリパス・`.kiro/` パス・ポートの唯一の定義場所。
 * 他モジュールはパス/ポートを独自解決せず、必ずこの RepoContext を import 経由で参照する
 * （steering structure.md「Single Source of Truth」、design.md Config 層）。
 */
import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import { ErrorCode } from "./errors/codes.js";

/**
 * デフォルトポート（Requirement 1.3 の「文書化されたデフォルトポート」）。
 * クライアント（sdd-dashboard の vite proxy `/api` → `http://localhost:7411`）が
 * 参照する値と一致させており、sdd-core はウォーキングスケルトンサーバーの
 * ドロップイン置き換えとして同じポートで待ち受ける。
 */
export const DEFAULT_PORT = 7411;

/** 対象リポジトリの解決済みコンテキスト。全読み書きは kiroDir を唯一の真実として扱う。 */
export interface RepoContext {
  /** リポジトリルートの絶対パス */
  readonly repoRoot: string;
  /** `.kiro/` ディレクトリの絶対パス（読み書きの唯一の対象） */
  readonly kiroDir: string;
  /** HTTP サーバーの待受ポート */
  readonly port: number;
}

export type RepoContextResult =
  | { readonly ok: true; readonly context: RepoContext }
  | {
      readonly ok: false;
      /** ErrorCode 語彙の定数（errors/codes.ts が唯一の定義場所。リテラル直書きは型エラー） */
      readonly code: ErrorCode;
      readonly message: string;
    };

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * CLI 引数のリポジトリパスを絶対パスへ解決し、検証済み RepoContext を生成する。
 * - パス不在 / 非ディレクトリ / `.kiro/` 不在の場合は、不正パスを明示するメッセージを返す（1.2）
 * - port 未指定時は DEFAULT_PORT を採用する（1.3）
 * process.exit は呼ばない（終了制御はエントリ層の責務）。
 */
export function createRepoContext(
  repoPathArg: string,
  port: number | undefined,
  cwd: string = process.cwd(),
): RepoContextResult {
  const repoRoot = resolve(cwd, repoPathArg);
  if (!isDirectory(repoRoot)) {
    return {
      ok: false,
      code: ErrorCode.REPO_INVALID,
      message: `${ErrorCode.REPO_INVALID}: repository path does not exist or is not a directory: ${repoRoot}`,
    };
  }
  const kiroDir = join(repoRoot, ".kiro");
  if (!isDirectory(kiroDir)) {
    return {
      ok: false,
      code: ErrorCode.REPO_INVALID,
      message: `${ErrorCode.REPO_INVALID}: repository has no .kiro/ directory: ${repoRoot} (expected ${kiroDir})`,
    };
  }
  return {
    ok: true,
    context: { repoRoot, kiroDir, port: port ?? DEFAULT_PORT },
  };
}
