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

/** 左ナビ: セクションツリーをクリック可能なリストとして描画する */
function SectionNav({ sections }: { sections: readonly SectionNode[] }): JSX.Element {
  return (
    <ul className="space-y-1 text-sm">
      {sections.map((section) => (
        <li key={section.position.startOffset}>
          <button
            type="button"
            onClick={() => scrollToSection(section.title)}
            className="text-left text-slate-700 hover:text-slate-900 hover:underline"
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

/** Traceability テーブルの 1 行（DocBlockList へ渡すため module-level で参照安定にする） */
function renderTraceabilityRow(block: StructuredBlock<TraceabilityRow>): ReactNode {
  const reqIds = traceRowAnchorIds(block.refs);
  return (
    <tr data-testid="traceability-row" className="border-t border-slate-200 align-top">
      <td className="px-2 py-1">
        {/* 3.10 フォールバック着地点: 行が表す各要件のトレーサビリティ行アンカー */}
        {reqIds.map((id) => (
          <span key={id} id={`trace-row-${id}`} data-testid="trace-row-anchor" />
        ))}
        <RefChipList refs={block.refs} origin={rowDesignOrigin(block)} />
      </td>
      <td className="px-2 py-1 text-sm">{block.summary}</td>
      <td className="px-2 py-1 text-sm">{block.components}</td>
      <td className="px-2 py-1 text-sm">{block.interfaces}</td>
      <td className="px-2 py-1 text-sm">{block.flows}</td>
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

/** 見出しレベル別の見た目（最小限。詳細な意匠は sdd-design-system の再スキンで扱う） */
const HEADING_CLASS: Record<string, string> = {
  h1: "mt-4 text-lg font-bold",
  h2: "mt-4 text-base font-semibold",
  h3: "mt-3 text-sm font-semibold",
  h4: "mt-2 text-sm font-semibold",
  h5: "mt-2 text-sm font-semibold",
  h6: "mt-2 text-sm font-semibold",
};

/**
 * design 本文の見出しコンポーネント工場。見出しに design 要素アンカー（`design-<slug>`）と
 * 比較ビュー（6.2）の選択用 `data-node-type` / `data-node-name` を払い出す。名は hast 由来の
 * 見出しテキスト（SectionNode.title と同じ抽出規則）で、左ナビのスクロール先と一致する。
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
      <Tag
        id={designAnchorId(title)}
        data-node-type="design"
        data-node-name={title}
        className={HEADING_CLASS[Tag]}
      >
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
      {/* 左ナビ: セクションツリー（クリックで該当セクションへスクロール） */}
      <nav
        data-testid="design-section-nav"
        aria-label="セクション"
        className="w-56 shrink-0 border-r border-slate-200 pr-4"
      >
        <SectionNav sections={doc.sections} />
      </nav>

      <article className="min-w-0 flex-1 space-y-6">
        {/* Requirements Traceability: 構造化テーブル（raw 行は DocBlockList で全文描画） */}
        <section>
          <h2 className="text-base font-semibold">Requirements Traceability</h2>
          <table className="mt-2 w-full border-collapse text-left">
            <thead>
              <tr className="text-xs font-semibold text-slate-500">
                <th className="px-2 py-1">Requirement</th>
                <th className="px-2 py-1">Summary</th>
                <th className="px-2 py-1">Components</th>
                <th className="px-2 py-1">Interfaces</th>
                <th className="px-2 py-1">Flows</th>
              </tr>
            </thead>
            <tbody>
              <DocBlockList blocks={doc.traceability} renderStructured={renderTraceabilityRow} />
            </tbody>
          </table>
        </section>

        {/* 本文: design.md 全文（情報無欠落）。見出しに design アンカー・data-node-* を付与する */}
        <section data-testid="design-body" className="space-y-3 leading-relaxed">
          <Markdown {...designMarkdownOptions}>{doc.content}</Markdown>
        </section>
      </article>
    </div>
  );
}
