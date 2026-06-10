/**
 * SSE イベント契約型 — ChangeEvent（design.md KiroWatcher + EventBus Event Contract）。
 * GET /api/events は `event: change` / data: ChangeEvent(JSON) として配信する（8.2）。
 */

/** 変更種別（chokidar イベントに対応） */
export type ChangeType = "add" | "change" | "unlink";

/** 変更パスのカテゴリ分類 */
export type ChangeCategory = "spec" | "steering" | "skill" | "adr" | "other";

/** ファイル変更イベント（SSE ペイロード） */
export interface ChangeEvent {
  type: ChangeType;
  /** リポジトリルートからの相対パス */
  path: string;
  category: ChangeCategory;
  /** category=spec のとき .kiro/specs/<feature>/ の feature 名。それ以外は null */
  feature: string | null;
  /** ISO 8601 */
  at: string;
}
