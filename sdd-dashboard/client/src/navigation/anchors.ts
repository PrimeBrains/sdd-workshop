/**
 * anchors — `NodeRef` → DOM アンカー ID 規約の単一所有者
 * （tasks.md 5.2 / Requirement 3.3 / design.md JumpNavigation Service Interface
 * 「アンカー ID 規約は anchors.ts のみが所有」）。
 *
 * 全ビューア・マトリクス・比較が `anchorIdOf` を共有することで、相互リンクジャンプ・
 * ディープリンク復元（useHashScrollRestore）が同一の決定的アンカー ID 上で成立する。
 * 4.x ビューアの暫定払い出し（`req-<id>` / `task-<id>` / `design-<slug>`）と完全一致する
 * 値を生成し、既存ディープリンクの互換を保つ。
 *
 * 純粋関数のみ（React / DOM 非依存）。
 */
import type { NodeRef } from "@contracts/trace";

/**
 * design 要素名 → アンカー ID の slug 部分。
 * 正規化: trim → 小文字 → 非英数 1 文字を `-` 1 文字へ。
 * 連続記号・連続空白はそのまま連続ハイフンになる（例: `A & B` → `a---b`）。
 * 4.2 DesignView の暫定実装と完全一致させる（ディープリンク互換）。
 */
function designSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
}

/**
 * `NodeRef` → DOM アンカー ID の決定的変換。
 * - requirement `"1.2"` → `req-1.2`
 * - task `"3.2"` → `task-3.2`
 * - design `"RawBlockView"` → `design-rawblockview`（slug 正規化）
 */
export function anchorIdOf(node: NodeRef): string {
  switch (node.type) {
    case "requirement":
      return `req-${node.id}`;
    case "task":
      return `task-${node.id}`;
    case "design":
      return `design-${designSlug(node.name)}`;
  }
}

/**
 * ジャンプ着地時に付与する一時ハイライトの CSS クラス（useJump が ~2 秒後に除去する）。
 * テストから ID 規約と同様に参照できるよう単一定義としてここに置く。
 * 実体スタイルは index.css に定義する。
 */
export const HIGHLIGHT_CLASS = "jump-highlight";
