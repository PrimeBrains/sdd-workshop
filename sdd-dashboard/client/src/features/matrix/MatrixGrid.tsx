/**
 * MatrixGrid — Req × Design × Task カバレッジグリッド
 * （tasks.md 7.1 / Requirements 5.1, 5.5 / design.md
 * 「MatrixPage + MatrixGrid + DiagnosticsPanel」Responsibilities & Constraints）。
 *
 * - 行 = `TraceIndex.nodes.requirements` の全要件 ID（昇順）。エッジゼロの要件も 1 行として描画する。
 * - 列グループ = Design（design 要素ノード）/ Task（タスク ID）。
 * - セル = エッジ有無 + `source` 種別（design-table / component-field / task-annotation）のマーク。
 *
 * データは `TraceIndex.coverOf(reqId)` の展開結果のみで構成する。UI 側でカバレッジを再判定したり
 * エッジを推論・重複排除・追加したりしない（5.5）。
 *
 * 1 セル（= 1 つの (req, node) 組）には複数のエッジが入りうる。サーバーの dedupe キーは `source` を
 * 含む（trace-graph.ts addEdge）ため、同一 design 要素を Traceability 表（design-table）と
 * コンポーネント Requirements フィールド（component-field）の両経路でカバーすると、同一セルに 2 本の
 * エッジが残る。本グリッドは「エッジ 1 本 = マーク 1 個」で描画し、セルが複数エッジを持つ場合は
 * source ごとのマークを併記する（潰さない）。よって「全マーク数 === グラフのエッジ数」が厳密に成立する
 * （完了条件）。
 *
 * 7.2 追加（Requirements 5.2, 5.4 / design.md「MatrixPage + MatrixGrid + DiagnosticsPanel」）:
 * - 未カバー行ハイライト（5.2）: `TraceIndex.uncovered.design` または `uncovered.task` に含まれる
 *   要件 ID の行に `UNCOVERED_ROW_CLASS` を付与する。集合は入力 diagnostics 由来で再計算しない（5.5）。
 * - マトリクスからの遷移（5.4）: 行ヘッダクリック → 当該要件ノード、列ヘッダ / セル（マーク有無に
 *   依らず）クリック → 当該 design / task ノードを `onJump(node)` で親へ通知する。アンカー解決と
 *   クロスドキュメント遷移は親（MatrixPage）の責務（anchorIdOf を単一所有点で使うため）。
 */
import type { JSX } from "react";
import type { NodeRef } from "@contracts/trace";
import type { TraceEdgeView, TraceIndex } from "@/trace/traceIndex";

/**
 * 未カバー要件行に付与する警告ハイライトクラス（assertable な単一定義）。
 * 実体スタイルは Tailwind ユーティリティで併記する。テストはこの定数で一致を検証する。
 */
export const UNCOVERED_ROW_CLASS = "matrix-row-uncovered";

interface MatrixGridProps {
  index: TraceIndex;
  /**
   * 行ヘッダ / 列ヘッダ / セルのクリックで対象ノードへの遷移を親へ委譲する（5.4）。
   * 親（MatrixPage）が anchorIdOf でアンカーへ写像しクロスドキュメント遷移する。
   */
  onJump: (node: NodeRef) => void;
}

/** 要件 ID（"1.2" 形式）の昇順比較。各セグメントを数値として比較し、想定外は文字列フォールバック。 */
function compareRequirementId(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = Number(pa[i] ?? "");
    const nb = Number(pb[i] ?? "");
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const cmp = a.localeCompare(b);
      if (cmp !== 0) return cmp;
      return 0;
    }
    if (na !== nb) return na - nb;
  }
  return 0;
}

/** design 列ノードの正準キー（TraceEdgeView の node と突き合わせる）。 */
function designKey(name: string): string {
  return `design:${name}`;
}

/** task 列ノードの正準キー。 */
function taskKey(id: string): string {
  return `task:${id}`;
}

/** TraceEdgeView の対向ノードを列キーへ写像する。 */
function edgeViewKey(view: TraceEdgeView): string {
  return view.node.type === "design" ? designKey(view.node.name) : taskKey(view.node.id);
}

/** source 種別ごとの表示グリフ（assertable な区別。title でも識別可能にする）。 */
const SOURCE_GLYPH: Record<TraceEdgeView["source"], string> = {
  "design-table": "▣",
  "component-field": "◆",
  "task-annotation": "✓",
};

const SOURCE_LABEL: Record<TraceEdgeView["source"], string> = {
  "design-table": "design 表",
  "component-field": "コンポーネント Requirements フィールド",
  "task-annotation": "タスク注記",
};

export function MatrixGrid({ index, onJump }: MatrixGridProps): JSX.Element {
  const requirementIds = index.nodes.requirements
    .filter((node): node is Extract<NodeRef, { type: "requirement" }> => node.type === "requirement")
    .map((node) => node.id)
    .sort(compareRequirementId);

  const designColumns = index.nodes.designElements.filter(
    (node): node is Extract<NodeRef, { type: "design" }> => node.type === "design",
  );
  const taskColumns = index.nodes.tasks.filter(
    (node): node is Extract<NodeRef, { type: "task" }> => node.type === "task",
  );

  // 未カバー判定は入力 diagnostics 由来の集合のみから導出する（再計算しない: 5.2 / 5.5）。
  // design / task いずれかの未カバーに該当する要件行を警告ハイライトする。
  const isUncovered = (reqId: string): boolean =>
    index.uncovered.design.has(reqId) || index.uncovered.task.has(reqId);

  return (
    <div className="overflow-auto">
      <table
        data-testid="matrix-grid"
        className="w-full border-collapse text-left text-sm"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-2 font-semibold"
            >
              要件 / 要素
            </th>
            {designColumns.map((node) => (
              <th
                key={designKey(node.name)}
                scope="col"
                data-testid={`matrix-col-${designKey(node.name)}`}
                data-col-group="design"
                className="cursor-pointer border-b border-slate-200 px-3 py-2 font-medium text-slate-700 hover:underline"
                onClick={() => onJump(node)}
              >
                {node.name}
              </th>
            ))}
            {taskColumns.map((node) => (
              <th
                key={taskKey(node.id)}
                scope="col"
                data-testid={`matrix-col-${taskKey(node.id)}`}
                data-col-group="task"
                className="cursor-pointer border-b border-slate-200 px-3 py-2 font-medium text-slate-700 hover:underline"
                onClick={() => onJump(node)}
              >
                {node.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requirementIds.map((reqId) => {
            // coverOf の展開結果のみからセルマークを構築する（再判定なし: 5.5）。
            // 1 セル = 1 列キーに複数エッジ（distinct source）が入りうるため、列キー → エッジ配列で保持する。
            // 各エッジ = 1 マークで描画し、潰さない（完了条件: 全マーク数 === エッジ数）。
            const cover = index.coverOf(reqId);
            const viewsByColumn = new Map<string, TraceEdgeView[]>();
            for (const view of [...cover.designs, ...cover.tasks]) {
              const key = edgeViewKey(view);
              const existing = viewsByColumn.get(key);
              if (existing === undefined) {
                viewsByColumn.set(key, [view]);
              } else {
                existing.push(view);
              }
            }

            const uncovered = isUncovered(reqId);
            return (
              <tr
                key={reqId}
                data-testid={`matrix-row-${reqId}`}
                data-req-id={reqId}
                data-uncovered={uncovered ? "true" : "false"}
                className={
                  uncovered
                    ? `border-b border-slate-100 ${UNCOVERED_ROW_CLASS} bg-amber-50`
                    : "border-b border-slate-100"
                }
              >
                <th
                  scope="row"
                  data-testid={`matrix-rowhead-${reqId}`}
                  className="sticky left-0 z-10 cursor-pointer bg-inherit px-3 py-2 font-mono text-xs font-semibold text-slate-700 hover:underline"
                  onClick={() => onJump({ type: "requirement", id: reqId })}
                >
                  {reqId}
                </th>
                {designColumns.map((node) => (
                  <MatrixCell
                    key={designKey(node.name)}
                    reqId={reqId}
                    colKey={designKey(node.name)}
                    views={viewsByColumn.get(designKey(node.name))}
                    onClick={() => onJump(node)}
                  />
                ))}
                {taskColumns.map((node) => (
                  <MatrixCell
                    key={taskKey(node.id)}
                    reqId={reqId}
                    colKey={taskKey(node.id)}
                    views={viewsByColumn.get(taskKey(node.id))}
                    onClick={() => onJump(node)}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface MatrixCellProps {
  reqId: string;
  colKey: string;
  views: TraceEdgeView[] | undefined;
  /** セルクリックで対向ノード（design / task）へ遷移する（マーク有無に依らず: 5.4 完了条件）。 */
  onClick: () => void;
}

/**
 * 単一セル。エッジ 1 本ごとに source マークを 1 個描画する（無いセルは空）。
 * 複数 source のエッジが同一セルに来た場合は併記し、潰さない（完了条件: 全マーク数 === エッジ数 / 5.5）。
 * セルクリックは（マーク有無に関わらず）列ノードへの遷移を発火する（5.4）。
 */
function MatrixCell({ reqId, colKey, views, onClick }: MatrixCellProps): JSX.Element {
  return (
    <td
      data-testid={`matrix-cell-${reqId}-${colKey}`}
      className="cursor-pointer px-3 py-2 text-center align-middle"
      onClick={onClick}
    >
      {views?.map((view, i) => (
        <span
          // 同一セルに同一 source が複数来ても安定するよう index も鍵に含める。
          key={`${view.source}-${i}`}
          data-testid={`matrix-cell-mark-${reqId}-${colKey}`}
          data-source={view.source}
          data-legacy-expanded={view.legacyExpanded ? "true" : "false"}
          title={SOURCE_LABEL[view.source]}
          aria-label={SOURCE_LABEL[view.source]}
          className="inline-block text-slate-700"
        >
          {SOURCE_GLYPH[view.source]}
        </span>
      ))}
    </td>
  );
}
