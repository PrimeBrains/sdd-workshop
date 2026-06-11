/**
 * DiagnosticsPanel — トレーサビリティ診断（broken-link / unparsable-ref）の一覧
 * （tasks.md 7.2 / Requirements 5.3, 5.5 / design.md「MatrixPage + MatrixGrid +
 * DiagnosticsPanel」DiagnosticsPanel に broken-link / unparsable-ref を raw・発生元・位置付きで一覧）。
 *
 * - 入力は `TraceIndex.allDiagnostics`（5.1。入力 diagnostics と要素単位で同一）。
 * - 描画対象は `broken-link` / `unparsable-ref` のみ。各行に raw テキスト（ref / raw）・
 *   発生元（`where` ノード）・行番号（`position.startLine`）を**そのまま**表示する。
 * - `design-uncovered` / `task-uncovered` はパネルに出さない。これらは MatrixGrid の
 *   要件行ハイライトを駆動する（design.md「設計未カバー…の要件 ID を視覚的にハイライト」）。
 * - 5.5（as-is）: 追加・脱落・再判定をしない。allDiagnostics の link 系をちょうど列挙する。
 *
 * 書込操作 UI は持たない（読み取り専用ビュー: Requirement 8.1）。
 */
import type { JSX } from "react";
import type { NodeRef, TraceDiagnostic } from "@contracts/trace";
import type { TraceIndex } from "@/trace/traceIndex";

interface DiagnosticsPanelProps {
  index: TraceIndex;
}

/** パネルに掲示する診断（発生元 where と位置 position を持つ link 系のみ）。 */
type LinkDiagnostic = Extract<TraceDiagnostic, { kind: "broken-link" | "unparsable-ref" }>;

/** 発生元 NodeRef を人間可読な厳密キーへ（design:Name / task:Id / requirement:Id）。 */
function originLabel(node: NodeRef): string {
  return node.type === "design" ? `design:${node.name}` : `${node.type}:${node.id}`;
}

/** broken-link は `ref`、unparsable-ref は `raw` を生テキストとして表示する。 */
function rawTextOf(diagnostic: LinkDiagnostic): string {
  return diagnostic.kind === "broken-link" ? diagnostic.ref : diagnostic.raw;
}

function isLinkDiagnostic(diagnostic: TraceDiagnostic): diagnostic is LinkDiagnostic {
  return diagnostic.kind === "broken-link" || diagnostic.kind === "unparsable-ref";
}

export function DiagnosticsPanel({ index }: DiagnosticsPanelProps): JSX.Element {
  // allDiagnostics の入力順を保ったまま link 系のみを抽出する（追加・並べ替えなし: 5.5）。
  const linkDiagnostics = index.allDiagnostics.filter(isLinkDiagnostic);

  return (
    <section
      data-testid="diagnostics-panel"
      className="mt-6 rounded border border-slate-200 bg-white p-3"
    >
      <h2 className="text-sm font-semibold text-slate-700">診断（リンク切れ / 解析不能参照）</h2>
      {linkDiagnostics.length === 0 ? (
        <p data-testid="diagnostics-panel-empty" className="mt-2 text-sm text-slate-500">
          診断なし
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {linkDiagnostics.map((diagnostic, i) => (
            <li
              // 入力順インデックスを鍵に含める（同一 raw / origin が複数来ても安定する）。
              key={`${diagnostic.kind}-${i}`}
              data-testid={`diagnostic-${diagnostic.kind}-${i}`}
              data-kind={diagnostic.kind}
              className="flex flex-wrap items-center gap-2 rounded bg-amber-50 px-2 py-1 text-xs"
            >
              <span
                className={
                  diagnostic.kind === "broken-link"
                    ? "rounded bg-rose-100 px-1 font-medium text-rose-700"
                    : "rounded bg-amber-100 px-1 font-medium text-amber-700"
                }
              >
                {diagnostic.kind === "broken-link" ? "リンク切れ" : "解析不能"}
              </span>
              <code data-testid="diagnostic-raw" className="font-mono text-slate-800">
                {rawTextOf(diagnostic)}
              </code>
              <span className="text-slate-500">発生元:</span>
              <span data-testid="diagnostic-origin" className="font-mono text-slate-700">
                {originLabel(diagnostic.where)}
              </span>
              <span className="text-slate-500">行:</span>
              <span data-testid="diagnostic-line" className="font-mono text-slate-700">
                {diagnostic.position.startLine}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
