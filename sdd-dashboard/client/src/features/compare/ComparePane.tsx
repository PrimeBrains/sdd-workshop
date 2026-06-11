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
import { useEffect, useRef, type JSX, type MouseEvent } from "react";
import type { SpecDetail } from "@contracts/spec";
import type { NodeRef } from "@contracts/trace";
import { type DocumentKind } from "@/app/SpecActionSlot";
import { CORRESPONDENCE_HIGHLIGHT_CLASS } from "@/features/compare/useCorrespondence";
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
  /**
   * 要素選択通知（6.2）。ビューア内の選択可能要素（`data-node-*` を持つ要件カード /
   * design 見出し / タスク）クリックで復元した NodeRef を親へ通知する。選択不能領域の
   * クリックでは発火しない（null を渡さない = 選択を消さない）。未指定なら選択機能を無効化。
   */
  onSelectNode?: (node: NodeRef) => void;
  /**
   * 対向ペインの選択から算出された、本ペインでハイライトすべきアンカー ID 集合（6.2）。
   * グラフ由来のみ（useCorrespondence の出力）。空配列でハイライト解除。
   */
  highlightAnchorIds?: readonly string[];
}

/**
 * クリック要素から最も近い選択可能要素（`data-node-type`）を辿って NodeRef を復元する。
 * 比較ビュー専用の delegation。design は slug 不可逆のため `data-node-name` を用いる。
 * 認識できない要素では null（選択を発火しない）。
 */
function nodeRefFromEventTarget(target: EventTarget | null): NodeRef | null {
  if (!(target instanceof Element)) return null;
  const host = target.closest<HTMLElement>("[data-node-type]");
  if (host === null) return null;
  const type = host.dataset["nodeType"];
  if (type === "requirement") {
    const id = host.dataset["nodeId"];
    return id !== undefined ? { type: "requirement", id } : null;
  }
  if (type === "task") {
    const id = host.dataset["nodeId"];
    return id !== undefined ? { type: "task", id } : null;
  }
  if (type === "design") {
    const name = host.dataset["nodeName"];
    return name !== undefined ? { type: "design", name } : null;
  }
  return null;
}

export function ComparePane({
  side,
  kind,
  detail,
  onKindChange,
  onSelectNode,
  highlightAnchorIds,
}: ComparePaneProps): JSX.Element {
  const selectId = `compare-pane-select-${side}`;
  const bodyRef = useRef<HTMLDivElement>(null);

  // 対向ペインの選択から算出されたアンカー集合を本ペイン内の要素へ反映する（6.2）。
  // 付与 / 除去はこのペインのスコープ内に限定し（自ペインの要素のみ getElementById でなく
  // querySelector でスコープ）、先頭の対応要素を画面内へスクロールする。
  useEffect(() => {
    const root = bodyRef.current;
    if (root === null) return;
    // 前回付与分を一旦全除去（選択変更・解除で確実にクリアする）。
    for (const el of root.querySelectorAll(`.${CORRESPONDENCE_HIGHLIGHT_CLASS}`)) {
      el.classList.remove(CORRESPONDENCE_HIGHLIGHT_CLASS);
    }
    const anchorIds = highlightAnchorIds ?? [];
    let firstTarget: Element | null = null;
    for (const anchorId of anchorIds) {
      // 属性セレクタ `[id="..."]` で本ペインのスコープ内のみ解決する。
      // - getElementById は文書全体で最初の一致を返すため、両ペインが同一文書種別のとき
      //   対向ペインの同一アンカーを誤って拾う（root.contains で弾くと自ペイン分も漏れる）。
      // - `#id` セレクタは ID 中のドット（`req-1.2`）をエスケープする必要があるが、属性
      //   セレクタの引用値は不要（CSS.escape 非依存）。
      const el = root.querySelector(`[id="${anchorId}"]`);
      if (el === null) continue;
      el.classList.add(CORRESPONDENCE_HIGHLIGHT_CLASS);
      if (firstTarget === null) firstTarget = el;
    }
    firstTarget?.scrollIntoView({ block: "center" });
    // クリーンアップ: アンマウント / 依存変化時に付与分を除去する。
    return () => {
      for (const el of root.querySelectorAll(`.${CORRESPONDENCE_HIGHLIGHT_CLASS}`)) {
        el.classList.remove(CORRESPONDENCE_HIGHLIGHT_CLASS);
      }
    };
  }, [highlightAnchorIds, kind]);

  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    if (onSelectNode === undefined) return;
    const node = nodeRefFromEventTarget(event.target);
    if (node !== null) onSelectNode(node);
  }

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
      {/* ペインは独立スクロール可能。key を kind で安定させ文書切替で確実に作り直す。
          選択は delegation（onClick）で捕捉し、対応ハイライトは bodyRef スコープに限定する（6.2）。
          RefChip のクロスリンクナビ（5.3 / 4.4）は子の onClick が先に処理され、選択 delegation は
          NodeRef を持つ要素以外では発火しないため両立する（選択ハイライトが RefChip を壊さない）。 */}
      <div
        ref={bodyRef}
        onClick={handleClick}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        <DocumentView key={kind} kind={kind} detail={detail} />
      </div>
    </section>
  );
}
