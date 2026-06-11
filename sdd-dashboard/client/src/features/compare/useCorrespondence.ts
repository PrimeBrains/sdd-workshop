/**
 * useCorrespondence — 一方のペインで選択された要素から、対向ペインの対応アンカー集合を
 * TraceIndex の隣接のみから算出する純粋関数
 * （tasks.md 6.2 / Requirements 4.3, 4.4 / design.md「ComparePage + useCorrespondence」・
 * State Management `useCorrespondence(selection, traceIndex, targetDocument) => { anchorIds }`）。
 *
 * 4.3（グラフ由来のみ）: 対応関係は TraceIndex のエッジ（= サーバーが完全列挙した TraceGraph）
 * からのみ導く。独自の対応付け（文字列ヒューリスティック・名称一致など）は一切しない。
 * グラフにエッジを持たないノードは対応先を生まない（= 対向ペインで何も光らない）。
 *
 * 方向（5.1 TraceIndex の隣接規約に従う）:
 * - 選択ノードが requirement → `coverOf(id)` で {designs, tasks} を引き、対向ペインの
 *   文書種別に一致する側（design なら designs / tasks なら tasks）だけを採る
 * - 選択ノードが design / task → `requirementsOf(node)` で参照元の要件を引く
 * いずれも対向ペインの `targetDocument` に対応する NodeRef.type 以外は除外する（フィルタ）。
 *
 * アンカー ID への写像は anchorIdOf（5.2）に委譲する（アンカー規約の単一所有者）。
 * 戻り値の anchorIds は重複排除済み・入力エッジ列挙順を保つ。
 *
 * 純粋関数（React / DOM 非依存）。`useCorrespondence` の名は design.md の State Management に従う。
 */
import type { NodeRef } from "@contracts/trace";
import type { DocumentKind } from "@/app/SpecActionSlot";
import { anchorIdOf } from "@/navigation/anchors";
import type { TraceEdgeView, TraceIndex } from "@/trace/traceIndex";

/**
 * 対向ペインの対応要素へ付与する持続ハイライトの CSS クラス（ジャンプ着地の一時ハイライト
 * `jump-highlight` とは別。実体スタイルは index.css）。テストから規約として参照できるよう
 * 本モジュールが単一定義する。
 */
export const CORRESPONDENCE_HIGHLIGHT_CLASS = "correspondence-highlight";

/** 一方のペインで選択された要素（design.md State Management `CompareSelection`）。 */
export interface CompareSelection {
  /** 選択が発生したペイン（左右いずれか）。対向ペインの判定には使わず、出所の記録用。 */
  pane: "left" | "right";
  /** 選択された要素のグラフノード参照。 */
  node: NodeRef;
}

/** useCorrespondence の戻り値（対向ペインでハイライトすべきアンカー ID 集合）。 */
export interface CorrespondenceResult {
  /** 対向ペインでハイライトする DOM アンカー ID 列（重複排除済み・入力順保持）。 */
  anchorIds: string[];
}

/**
 * DocumentKind → グラフノード種別の対応。
 * brief / research はグラフノードを持たない（対応先なし）ため undefined を返す。
 */
function nodeTypeOf(document: DocumentKind): NodeRef["type"] | undefined {
  switch (document) {
    case "requirements":
      return "requirement";
    case "design":
      return "design";
    case "tasks":
      return "task";
    case "brief":
    case "research":
      return undefined;
  }
}

/**
 * 選択ノードから対向文書方向の隣接ノードを TraceIndex のみから引く（グラフ由来のみ）。
 * - requirement → coverOf（targetType により designs / tasks を選択。それ以外の対向は空）
 * - design / task → requirementsOf（対向が requirement のときのみ意味を持つ）
 */
function adjacentNodes(
  node: NodeRef,
  targetType: NodeRef["type"],
  traceIndex: TraceIndex,
): TraceEdgeView[] {
  if (node.type === "requirement") {
    if (targetType === "requirement") return []; // 要件 → 要件のエッジはグラフに存在しない
    const cover = traceIndex.coverOf(node.id);
    return targetType === "design" ? cover.designs : cover.tasks;
  }
  // design / task ノードは参照元の要件のみを隣接に持つ（5.1）。
  if (targetType !== "requirement") return [];
  return traceIndex.requirementsOf(node);
}

/**
 * 選択要素 → 対向ペインの対応アンカー集合を算出する（グラフ由来のみ）。
 *
 * @param selection 一方のペインで選択された要素（null のとき対応先なし）
 * @param traceIndex 現在のスペックの TraceIndex（null のとき = グラフ未取得 → 対応先なし）
 * @param targetDocument 対向ペインの文書種別（この種別に一致するノードのみへ写像する）
 *
 * Postconditions:
 * - 戻り値の anchorIds はすべて targetDocument に対応する種別のノード由来である（フィルタ済み）。
 * - グラフにエッジを持たないノード・graph 不在では空集合（4.3: 独自対応付けをしない）。
 */
export function useCorrespondence(
  selection: CompareSelection | null,
  traceIndex: TraceIndex | null,
  targetDocument: DocumentKind,
): CorrespondenceResult {
  if (selection === null || traceIndex === null) {
    return { anchorIds: [] };
  }
  const targetType = nodeTypeOf(targetDocument);
  if (targetType === undefined) {
    // brief / research はグラフノードを持たない対向。対応先は存在しない。
    return { anchorIds: [] };
  }

  const adjacent = adjacentNodes(selection.node, targetType, traceIndex);

  // 対向文書種別に一致するノードのみ採用（フィルタ）→ anchorIdOf へ写像 → 重複排除（入力順保持）。
  const anchorIds: string[] = [];
  const seen = new Set<string>();
  for (const edge of adjacent) {
    if (edge.node.type !== targetType) continue;
    const anchorId = anchorIdOf(edge.node);
    if (seen.has(anchorId)) continue;
    seen.add(anchorId);
    anchorIds.push(anchorId);
  }
  return { anchorIds };
}
