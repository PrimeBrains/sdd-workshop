/**
 * KiroWatcher — chokidar v4 によるファイル監視 + 分類 + デバウンス
 * （design.md Watch 層 KiroWatcher。Requirements 8.1, 8.2, 8.3）。
 *
 * - 監視対象は `.kiro/` とスキルディレクトリ（resolveSkillsDir。8.1）
 * - chokidar v4 は glob 非対応のため `ignored` は関数フィルタ:
 *   dotfile（`.tmp-*` 含む）と md/json 以外のファイルを除外する（8.3）
 * - `awaitWriteFinish` + 100ms デバウンスでバーストを集約し、
 *   デバウンス窓内の同一パス連続変更は最後の 1 件に集約する（8.2: 検知から配信まで 2 秒以内）
 * - パスからカテゴリ（spec / steering / adr / skill / other）と feature 名
 *   （`.kiro/specs/<feature>/` 配下のみ）を分類して ChangeEvent を EventBus へ発行する
 */
import type { Stats } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { watch } from "chokidar";
import { resolveSkillsDir, type RepoContext } from "../config.js";
import type { ChangeCategory, ChangeEvent, ChangeType } from "../types/events.js";
import type { EventBus } from "./event-bus.js";

/** デバウンス窓（design.md: 100ms でバーストを集約） */
export const DEBOUNCE_MS = 100;

/** 起動済みの監視ハンドル */
export interface KiroWatcher {
  /** 監視を停止し、未 flush のデバウンス済みイベントを破棄する */
  close(): Promise<void>;
}

/**
 * `.kiro/` とスキルディレクトリの監視を開始する。
 * 戻り値の Promise は chokidar の ready（初期スキャン完了）後に解決する。
 * Postcondition: 解決後の FS 変更は ignored フィルタ通過分のみ ChangeEvent として bus へ届く。
 */
export async function startKiroWatcher(context: RepoContext, bus: EventBus): Promise<KiroWatcher> {
  const skillsDir = resolveSkillsDir(context);
  const roots = [context.kiroDir, skillsDir];

  const watcher = watch(roots, {
    ignoreInitial: true,
    ignored: (path: string, stats?: Stats) => isIgnored(roots, path, stats),
    // 書込途中の中間状態を拾わない（短い閾値で 2 秒以内の配信を守る）
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
  });

  // デバウンス: 相対パスをキーに最後のイベントだけを保持し、静止後にまとめて publish
  const pending = new Map<string, ChangeEvent>();
  let timer: NodeJS.Timeout | null = null;
  let closed = false;

  function flush(): void {
    timer = null;
    const events = [...pending.values()];
    pending.clear();
    for (const event of events) {
      bus.publish(event);
    }
  }

  function onFsEvent(type: ChangeType, absPath: string): void {
    if (closed) {
      return;
    }
    const segments = segmentsFromRoots(roots, absPath);
    // unlink は stats なしで ignored を通過し得るため、発行直前にも関連性を検査する（8.3）
    if (segments === null || !isRelevantFile(segments)) {
      return;
    }
    const repoRelPath = toPosix(relative(context.repoRoot, absPath));
    const { category, feature } = classify(repoRelPath, toPosix(relative(context.repoRoot, skillsDir)));
    pending.set(repoRelPath, {
      type,
      path: repoRelPath,
      category,
      feature,
      at: new Date().toISOString(),
    });
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(flush, DEBOUNCE_MS);
  }

  watcher.on("add", (path) => onFsEvent("add", path));
  watcher.on("change", (path) => onFsEvent("change", path));
  watcher.on("unlink", (path) => onFsEvent("unlink", path));

  await new Promise<void>((resolve, reject) => {
    watcher.once("ready", () => resolve());
    watcher.once("error", (error) => reject(error));
  });

  return {
    async close(): Promise<void> {
      closed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pending.clear();
      await watcher.close();
    },
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー（純粋関数）
// ---------------------------------------------------------------------------

/** OS パス区切りを `/` に正規化する（ChangeEvent.path はリポジトリルートからの相対 posix パス） */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/**
 * 監視ルートのいずれかから見た相対パスセグメントを返す。
 * ルート自身は `[]`、どのルート配下でもなければ null。
 */
function segmentsFromRoots(roots: readonly string[], path: string): string[] | null {
  for (const root of roots) {
    const rel = relative(root, path);
    if (rel === "") {
      return [];
    }
    if (!rel.startsWith("..") && !isAbsolute(rel)) {
      return rel.split(sep);
    }
  }
  return null;
}

/** dotfile（`.tmp-*` を含む）をパス中のどの階層でも除外する */
function hasHiddenSegment(segments: readonly string[]): boolean {
  return segments.some((segment) => segment.startsWith(".") || segment.startsWith(".tmp-"));
}

/** ダッシュボードのリソースに関連するファイルか（dotfile/.tmp-* でなく、md/json）（8.3） */
function isRelevantFile(segments: readonly string[]): boolean {
  if (segments.length === 0 || hasHiddenSegment(segments)) {
    return false;
  }
  const basename = segments[segments.length - 1] ?? "";
  return basename.endsWith(".md") || basename.endsWith(".json");
}

/**
 * chokidar v4 の ignored 関数フィルタ（glob 非対応のため関数で表現）。
 * ディレクトリの走査は妨げず、dotfile・`.tmp-*`・md/json 以外のファイルを除外する。
 */
function isIgnored(roots: readonly string[], path: string, stats?: Stats): boolean {
  const segments = segmentsFromRoots(roots, path);
  if (segments === null || segments.length === 0) {
    // ルート自身・ルート外は除外しない（走査の起点を塞がない）
    return false;
  }
  if (hasHiddenSegment(segments)) {
    return true;
  }
  // 拡張子フィルタはファイル確定時のみ（ディレクトリ走査を止めないため）
  return stats?.isFile() === true && !isRelevantFile(segments);
}

/**
 * リポジトリルートからの相対 posix パスをカテゴリと feature に分類する。
 * - `.kiro/specs/<feature>/...`（feature ディレクトリ配下のみ）→ spec + feature
 * - `.kiro/steering/...` → steering / `.kiro/adr/...` → adr
 * - スキルディレクトリ配下 → skill / それ以外 → other
 */
function classify(
  repoRelPath: string,
  skillsRelPrefix: string,
): { category: ChangeCategory; feature: string | null } {
  if (repoRelPath === skillsRelPrefix || repoRelPath.startsWith(`${skillsRelPrefix}/`)) {
    return { category: "skill", feature: null };
  }
  const parts = repoRelPath.split("/");
  if (parts[0] === ".kiro") {
    if (parts[1] === "specs" && parts.length >= 4 && parts[2] !== undefined) {
      return { category: "spec", feature: parts[2] };
    }
    if (parts[1] === "steering") {
      return { category: "steering", feature: null };
    }
    if (parts[1] === "adr") {
      return { category: "adr", feature: null };
    }
  }
  return { category: "other", feature: null };
}
