/**
 * ComparePane — 2 ペイン比較画面の片側ペイン
 * （tasks.md 6.1 / Requirements 4.1, 4.2 / design.md「ComparePane embeds viewer」・
 * File Structure Plan `features/compare/ComparePane.tsx`）。
 *
 * - 自身の `kind` の文書を DocumentView（features/viewer の単一ディスパッチ）で描画する。
 *   ディスパッチ規律（種別 → ビューア、不在 → MissingArtifact）は DocumentView が単一所有し、
 *   ペインは「どの文書を出すか」だけを担う（SpecDocumentPage と分岐させない）
 * - 全 5 種別を選べるセレクタを持ち、変更時に `onKindChange(next)` を発火する。URL クエリの
 *   書き換え（ビュー位置の真実: 4.2）は親 ComparePage が担い、ペインは view-state 通知に徹する
 * - 不在文書は DocumentView の MissingArtifact で表示される（Requirement 1.3 と一貫）
 * - ペインは独立スクロール可能（`overflow-y-auto`）。`compare-pane-<side>` でペインを識別する
 *
 * 書込操作 UI は持たない（セレクタは view-state であってリポジトリへの書込ではない: 8.1）。
 */
import { type JSX } from "react";
import type { SpecDetail } from "@contracts/spec";
import { type DocumentKind } from "@/app/SpecActionSlot";
import { DocumentView } from "@/features/viewer/DocumentView";

/** セレクタが提供する文書種別（語彙の単一定義は SpecActionSlot の DocumentKind） */
const DOCUMENT_KINDS: readonly DocumentKind[] = [
  "brief",
  "requirements",
  "design",
  "tasks",
  "research",
];

export interface ComparePaneProps {
  /** 左右いずれのペインか（data-testid とラベルに使う） */
  side: "left" | "right";
  /** このペインが表示する文書種別 */
  kind: DocumentKind;
  /** スペック詳細（両ペインで共有。ペインは自身の kind 部分のみ描画する） */
  detail: SpecDetail;
  /** セレクタ変更通知。URL クエリの書き換えは親が担う（4.2） */
  onKindChange: (next: DocumentKind) => void;
}

export function ComparePane({ side, kind, detail, onKindChange }: ComparePaneProps): JSX.Element {
  const selectId = `compare-pane-select-${side}`;
  return (
    <section
      data-testid={`compare-pane-${side}`}
      className="flex min-w-0 flex-1 flex-col rounded-md border border-slate-200"
    >
      <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <label htmlFor={selectId} className="text-xs font-medium text-slate-500">
          {side === "left" ? "左" : "右"}
        </label>
        <select
          id={selectId}
          data-testid="compare-pane-select"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          value={kind}
          onChange={(event) => {
            // option 値は DOCUMENT_KINDS から払い出すため DocumentKind であることが保証される
            onKindChange(event.target.value as DocumentKind);
          }}
        >
          {DOCUMENT_KINDS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </header>
      {/* ペインは独立スクロール可能。key を kind で安定させ文書切替で確実に作り直す */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <DocumentView key={kind} kind={kind} detail={detail} />
      </div>
    </section>
  );
}
