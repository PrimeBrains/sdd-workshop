/**
 * anchors（anchorIdOf）のテスト（tasks.md 5.2 / Requirement 3.3 /
 * design.md JumpNavigation Service Interface・Testing Strategy Unit #2）。
 *
 * `anchorIdOf` は `NodeRef` → DOM アンカー ID の決定的変換。既存の暫定払い出し
 * （RequirementsView の `req-<id>`、TasksView の `task-<id>`、DesignView の
 * `design-<slug>`）と完全一致する厳密値を生成し、ディープリンク互換を保つ。
 */
import { describe, expect, it } from "vitest";
import type { NodeRef } from "@contracts/trace";
import { anchorIdOf } from "@/navigation/anchors";

describe("anchorIdOf（Requirement 3.3: アンカー ID 規約の単一所有者）", () => {
  it("requirement ノードは req-<id> を生成する", () => {
    expect(anchorIdOf({ type: "requirement", id: "1.2" })).toBe("req-1.2");
  });

  it("task ノードは task-<id> を生成する", () => {
    expect(anchorIdOf({ type: "task", id: "3.2" })).toBe("task-3.2");
  });

  it("design ノードは design-<slug>（trim → 小文字 → 非英数を `-`）を生成する", () => {
    expect(anchorIdOf({ type: "design", name: "RawBlockView" })).toBe("design-rawblockview");
  });

  it("空白・記号入りの design 名を slug 正規化する（DesignView 出力と厳密一致）", () => {
    // 連続記号 → 連続ハイフン（` & ` → `---`）。DesignView.test の期待値と完全一致させる
    expect(anchorIdOf({ type: "design", name: "Architecture Pattern & Boundary Map" })).toBe(
      "design-architecture-pattern---boundary-map",
    );
  });

  it("design 名の前後空白を trim してから slug 化する", () => {
    expect(anchorIdOf({ type: "design", name: "  Overview  " })).toBe("design-overview");
  });

  it("同一入力に対し同一出力を返す（決定性）", () => {
    const node: NodeRef = { type: "design", name: "RawBlockView" };
    expect(anchorIdOf(node)).toBe(anchorIdOf(node));
    expect(anchorIdOf({ type: "requirement", id: "1.2" })).toBe(
      anchorIdOf({ type: "requirement", id: "1.2" }),
    );
  });
});
