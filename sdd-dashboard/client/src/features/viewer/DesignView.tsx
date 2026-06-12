/**
 * DesignView — design.md の構造化ビューア
 * （tasks.md 4.2 / Requirements 2.3 / design.md DesignView・Requirements Traceability 2.3。
 * postmortem #0004 で本文全文描画を追加）。
 *
 * - `SectionNode` ツリーを左ナビとして描画し、クリックで該当セクションの
 *   `design-<slug>` 要素へスクロールする（2.3）。スクロール挙動は
 *   useHashScrollRestore / useJump（5.2）と同じ `scrollIntoView({ block: "center" })`
 * - Requirements Traceability を構造化テーブル（`<table>`）として描画し、各行の
 *   `refs: RefToken[]` を参照チップ列として描画する（RefChip 5.3）
 * - 本文（design.md 全文）を Markdown として全文描画する（情報無欠落、postmortem #0004）。
 *   正典スケルトン SpecViewer の DesignTab と同じく、構造化ビュー（ナビ + Traceability 表）と
 *   並べて本文を全文表示する。design.md は大半がプローズ・図表のため、見出しだけでなく
 *   本文・図・コードを欠落させない
 * - 本文の各見出しに design 要素アンカー `design-<slug>` と `data-node-*` を払い出す
 *   （slug 正規化は anchors.ts の anchorIdOf が単一所有）。これにより左ナビのスクロール先・
 *   比較ビュー（6.2）の選択/対応ハイライトが本文見出し上で成立する
 * - パースできなかった Traceability 行（raw）は DocBlockList 経由で全文描画する（2.5）
 * - DocBlockList の memo 前提を守るため、renderStructured はモジュールレベル関数で参照安定
 *
 * 境界: セクションツリーナビ・Traceability テーブル・本文全文描画のみ。RefChip の対応先解決・
 * ジャンプ（5.3）、anchors.ts / useJump（5.2）は本タスクの範囲外。
 */
import type { JSX, ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import type { SectionNode } from "@contracts/document";
import type { DesignDoc, TraceabilityRow } from "@contracts/spec";
import type { NodeRef, RefToken } from "@contracts/trace";
import { RefChip } from "@/features/crosslink/RefChip";
import { DocBlockList, type StructuredBlock } from "@/markdown/DocBlockList";
import { safeMarkdownOptions } from "@/markdown/RawBlockView";
import { anchorIdOf } from "@/navigation/anchors";

export interface DesignViewProps {
  doc: DesignDoc;
}

/**
 * design 要素アンカー ID（`design-<slug>`）。anchors.ts（anchorIdOf）が slug 正規化
 * （trim → 小文字 → 非英数を `-`）を含め規約を単一所有する。
 */
function designAnchorId(name: string): string {
  return anchorIdOf({ type: "design", name });
}

/** RefToken の安定キー（同一行内で raw が重複しても位置で区別する） */
function refTokenKey(token: RefToken, index: number): string {
  return `${index}:${token.raw}`;
}

/**
 * 参照チップ列。各 RefToken を RefChip（5.3）に委譲し、対応先ポップオーバー・ジャンプ・
 * broken-link 表示を提供する。origin は当該行の design コンテキスト（要件 → 設計の逆方向）。
 */
function RefChipList({ refs, origin }: { refs: readonly RefToken[]; origin: NodeRef }): JSX.Element {
  return (
    <span className="flex flex-wrap gap-1">
      {refs.map((token, index) => (
        <RefChip key={refTokenKey(token, index)} token={token} origin={origin} />
      ))}
    </span>
  );
}

/** ナビ項目クリック: 該当セクションの design-<slug> 要素へスクロールする */
function scrollToSection(title: string): void {
  // 明示的に window.document を参照する（ルートパラメータ `document` との取り違え防止）
  const target = window.document.getElementById(designAnchorId(title));
  target?.scrollIntoView({ block: "center" });
}

/** 左ナビ: セクションツリーをクリック可能なリストとして描画する（skeleton .toc 準拠 12px / ink-soft / hover brand） */
function SectionNav({ sections }: { sections: readonly SectionNode[] }): JSX.Element {
  return (
    <ul className="space-y-1 text-[12px]">
      {sections.map((section) => (
        <li key={section.position.startOffset}>
          <button
            type="button"
            onClick={() => scrollToSection(section.title)}
            className="text-left text-ink-soft hover:text-brand"
          >
            {section.title}
          </button>
          {section.children.length > 0 && (
            <div className="pl-3">
              <SectionNav sections={section.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * トレーサビリティ行の design アンカー名（broken-link 照合・ジャンプ origin 用）。
 * 行は要件 → 設計の対応を表す。design 側の文脈ラベルとして summary を用いる。
 */
function rowDesignOrigin(row: TraceabilityRow): NodeRef {
  return { type: "design", name: row.summary };
}

/**
 * 行に付与するトレーサビリティ行アンカー（`trace-row-<reqId>`）。
 * 3.10 フォールバック（design 対応先のアンカー未解決時）の着地先になる。
 * 行内の最初の id / range 参照の要件 ID をキーにする（無ければアンカーを払い出さない）。
 */
function traceRowAnchorIds(refs: readonly RefToken[]): string[] {
  const ids: string[] = [];
  for (const ref of refs) {
    if (ref.kind === "id") ids.push(ref.id);
    else if (ref.kind === "range") ids.push(...ref.expanded);
  }
  return ids;
}

/** skeleton table.matrix 準拠のセル装飾（罫線 1px line・padding 5px 9px。8.2） */
const MATRIX_CELL_CLASS = "border border-line px-[9px] py-[5px]";

/** skeleton table.matrix 準拠のヘッダ装飾（セル装飾 + fill-soft 背景。8.2） */
const MATRIX_HEADER_CLASS = `${MATRIX_CELL_CLASS} bg-fill-soft`;

/** Traceability テーブルの 1 行（DocBlockList へ渡すため module-level で参照安定にする） */
function renderTraceabilityRow(block: StructuredBlock<TraceabilityRow>): ReactNode {
  const reqIds = traceRowAnchorIds(block.refs);
  return (
    <tr data-testid="traceability-row" className="align-top">
      <td className={MATRIX_CELL_CLASS}>
        {/* 3.10 フォールバック着地点: 行が表す各要件のトレーサビリティ行アンカー */}
        {reqIds.map((id) => (
          <span key={id} id={`trace-row-${id}`} data-testid="trace-row-anchor" />
        ))}
        <RefChipList refs={block.refs} origin={rowDesignOrigin(block)} />
      </td>
      <td className={MATRIX_CELL_CLASS}>{block.summary}</td>
      <td className={MATRIX_CELL_CLASS}>{block.components}</td>
      <td className={MATRIX_CELL_CLASS}>{block.interfaces}</td>
      <td className={MATRIX_CELL_CLASS}>{block.flows}</td>
    </tr>
  );
}

/** hast ノードからプレーンテキストを抽出する（見出しの design 名 / アンカー算出用） */
function hastText(node: unknown): string {
  if (node === null || typeof node !== "object") return "";
  const n = node as { type?: string; value?: unknown; children?: unknown };
  if ((n.type === "text" || n.type === "inlineCode") && typeof n.value === "string") {
    return n.value;
  }
  if (Array.isArray(n.children)) {
    return n.children.map(hastText).join("");
  }
  return "";
}

/**
 * design 本文の見出しコンポーネント工場。見出しに design 要素アンカー（`design-<slug>`）と
 * 比較ビュー（6.2）の選択用 `data-node-type` / `data-node-name` を払い出す。名は hast 由来の
 * 見出しテキスト（SectionNode.title と同じ抽出規則）で、左ナビのスクロール先と一致する。
 * 見た目は本文ラッパーの `.md` スコープ（MarkdownTheme / index.css）に委ね、ここでは
 * className を持たない（RawBlockView / MarkdownDoc の描画と同一の skeleton 準拠タイポグラフィ）。
 */
function makeDesignHeading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return function DesignHeading({
    node,
    children,
  }: {
    node?: unknown;
    children?: ReactNode;
  }): JSX.Element {
    const title = hastText(node).trim();
    return (
      <Tag id={designAnchorId(title)} data-node-type="design" data-node-name={title}>
        {children}
      </Tag>
    );
  };
}

/**
 * 本文描画の Markdown 設定。安全設定（raw HTML 不活性化・外部 URL 無効化・mermaid 図）は
 * RawBlockView の `safeMarkdownOptions` を共有し、見出しのみ design アンカー付きへ上書きする。
 */
const designMarkdownComponents: Components = {
  ...(safeMarkdownOptions.components as Components),
  h1: makeDesignHeading("h1"),
  h2: makeDesignHeading("h2"),
  h3: makeDesignHeading("h3"),
  h4: makeDesignHeading("h4"),
  h5: makeDesignHeading("h5"),
  h6: makeDesignHeading("h6"),
};

const designMarkdownOptions = {
  ...safeMarkdownOptions,
  components: designMarkdownComponents,
};

export function DesignView({ doc }: DesignViewProps): JSX.Element {
  return (
    <div className="flex gap-6">
      {/* 左ナビ: セクションツリー（クリックで該当セクションへスクロール）。
          skeleton .toc 準拠の sticky（top 20px・max-height 85vh・内部スクロール）。
          フレックス子で sticky を効かせるため self-start が必須（8.4） */}
      <nav
        data-testid="design-section-nav"
        aria-label="セクション"
        className="sticky top-5 max-h-[85vh] w-56 shrink-0 self-start overflow-y-auto border-r border-line pr-4"
      >
        <SectionNav sections={doc.sections} />
      </nav>

      <article className="min-w-0 flex-1 space-y-6">
        {/* 本文: design.md 全文（情報無欠落）。見出しに design アンカー・data-node-* を付与する。
            `md` は MarkdownTheme（index.css）の装飾スコープで、`.md pre` / `.md table` の
            overflow-x: auto がページ横スクロールを防ぐ封じ込め契約（8.3）。13.5px は
            skeleton `.md` の基本サイズ（RawBlockView / MarkdownDoc と同一の付与方法） */}
        <section data-testid="design-body" className="md space-y-3 text-[13.5px] leading-relaxed">
          <Markdown {...designMarkdownOptions}>{doc.content}</Markdown>
        </section>

        {/* Requirements Traceability: 構造化テーブル（raw 行は DocBlockList で全文描画）。
            skeleton table.matrix 準拠の装飾（12.5px・セル罫線 line・ヘッダ fill-soft 11.5px。8.2） */}
        <section>
          <h2 className="text-base font-semibold">Requirements Traceability</h2>
          <table className="mt-2 w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="text-[11.5px] font-semibold">
                <th className={MATRIX_HEADER_CLASS}>Requirement</th>
                <th className={MATRIX_HEADER_CLASS}>Summary</th>
                <th className={MATRIX_HEADER_CLASS}>Components</th>
                <th className={MATRIX_HEADER_CLASS}>Interfaces</th>
                <th className={MATRIX_HEADER_CLASS}>Flows</th>
              </tr>
            </thead>
            <tbody>
              <DocBlockList blocks={doc.traceability} renderStructured={renderTraceabilityRow} />
            </tbody>
          </table>
        </section>
      </article>
    </div>
  );
}
