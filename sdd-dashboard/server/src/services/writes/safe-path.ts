/**
 * SafePathGuard — `.kiro/` 限定書込のパスガード + アトミック書込（Requirements 12.1, 12.2, 12.4）。
 * FS パス解決を所有するのは Config（RepoContext）と本モジュールのみ（design.md Domain boundaries）。
 * すべての書込はここを経由する。`.kiro/` 外へ解決されるパスは AppError(WRITE_PATH_FORBIDDEN) で拒否。
 */
import { randomBytes } from "node:crypto";
import { link, lstat, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { RepoContext } from "../../config.js";
import { AppError, ErrorCode } from "../../errors/codes.js";

export interface SafePathGuard {
  /**
   * 候補パスを正規化し、実在する最近接祖先の realpath を解決した上で
   * `.kiro/` プレフィックス内であることを検査する（12.1, 12.2）。
   * 相対パスは `.kiro/` 起点として解釈する。
   * @returns 検証済み絶対パス（symlink 解決済みの実体パス）
   * @throws AppError(WRITE_PATH_FORBIDDEN) `.kiro/` 外へ解決される場合
   */
  assertWritablePath(candidate: string): Promise<string>;
  /**
   * 同一ディレクトリの `.tmp-<random>` へ書いて rename するアトミック書込（12.4）。
   * 失敗時は対象ファイルが旧内容のまま残る（部分書込を残さない）。
   * `exclusive: true` で既存ファイルがある場合に EEXIST で失敗する（上書きしない。11.5 が利用）。
   * 内部で assertWritablePath を通すため、`.kiro/` 外には決して書かない（多層防御）。
   */
  writeFileAtomic(path: string, content: string, opts?: { exclusive?: boolean }): Promise<void>;
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/** path が dangling symlink（リンク自体は存在するが参照先が無い）かを判定する */
async function isDanglingSymlink(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * 実在する最近接祖先まで遡って realpath を解決し、未存在の残り成分を結合して返す。
 * 新規ファイル（未作成 ADR 等）でも symlink 経由の脱出を検出できる標準手法。
 * 途中に dangling symlink がある場合は null を返す（参照先を解決できず安全性を保証できないため拒否対象）。
 */
async function resolveWithExistingAncestor(absPath: string): Promise<string | null> {
  const suffix: string[] = [];
  let current = absPath;
  for (;;) {
    try {
      const real = await realpath(current);
      return suffix.length === 0 ? real : join(real, ...suffix);
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }
      // realpath が ENOENT でも lstat が symlink を返すなら dangling symlink（書込で参照先が生成され得る）
      if (await isDanglingSymlink(current)) {
        return null;
      }
      const parent = dirname(current);
      if (parent === current) {
        throw error; // ファイルシステムルートまで遡っても実在しない（通常到達しない）
      }
      suffix.unshift(basename(current));
      current = parent;
    }
  }
}

export function createSafePathGuard(context: RepoContext): SafePathGuard {
  async function assertWritablePath(candidate: string): Promise<string> {
    // 相対パスは .kiro/ 起点で解決し、`..` 連鎖を正規化する
    const normalized = resolve(context.kiroDir, candidate);
    const resolved = await resolveWithExistingAncestor(normalized);
    // kiroDir 側も realpath 比較（リポジトリ自体が symlink 経由で参照されるケースに対応）
    const kiroReal = await realpath(context.kiroDir);
    if (resolved === null || !resolved.startsWith(kiroReal + sep)) {
      throw new AppError(
        ErrorCode.WRITE_PATH_FORBIDDEN,
        `write target resolves outside .kiro/: ${candidate}`,
        { candidate, resolved },
      );
    }
    return resolved;
  }

  async function writeFileAtomic(
    path: string,
    content: string,
    opts?: { exclusive?: boolean },
  ): Promise<void> {
    const target = await assertWritablePath(path);
    // 同一ディレクトリの temp に書く（rename の原子性はファイルシステム境界を跨ぐと失われるため）。
    // `.tmp-` プレフィックスは KiroWatcher の ignored フィルタ対象（8.3）と一致させる。
    const tempPath = join(dirname(target), `.tmp-${randomBytes(8).toString("hex")}`);
    try {
      await writeFile(tempPath, content, "utf8");
      if (opts?.exclusive === true) {
        // link は対象が既存なら EEXIST で原子的に失敗する（既存ファイルを上書きしない）
        await link(tempPath, target);
        await unlink(tempPath);
      } else {
        await rename(tempPath, target);
      }
    } catch (error) {
      await unlink(tempPath).catch(() => {
        /* temp が未作成 / 削除済みなら何もしない */
      });
      throw error;
    }
  }

  return { assertWritablePath, writeFileAtomic };
}
