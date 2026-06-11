/**
 * DesignView — design.md の構造化ビューア
 * （tasks.md 4.2 / Requirements 2.3 / design.md DesignView・Requirements Traceability 2.3）。
 *
 * - `SectionNode` ツリーを左ナビとして描画し、クリックで該当セクションの
 *   `design-<slug>` 要素へスクロールする（2.3）。スクロール挙動は
 *   useHashScrollRestore / useJump（5.2）と同じ `scrollIntoView({ block: "center" })`
 * - 本文（セクション見出し）は DocBlockList で描画する。各見出しに design 要素アンカー
 *   `design-<slug>` を払い出す（slug 正規化: trim → 小文字 → 非英数を `-`）。
 *   5.2 anchors.ts（anchorIdOf）が規約の単一所有者となるため、同一アルゴリズムを
 *   ローカルに実装してディープリンク互換を保つ
 * - Requirements Traceability を構造化テーブル（`<table>`）として描画し、各行の
 *   `refs: RefToken[]` を参照チップ列として描画する。チップは 5.3（RefChip）までは
 *   静的・非インタラクティブで、RefToken の kind 別に原文（raw）を忠実に表示する
 * - パースできなかった Traceability 行（raw）は DocBlockList 経由で全文描画する
 *   （情報無欠落、2.5）。並べ替え・スキップをしない
 * - DocBlockList の memo 前提を守るため、renderStructured はモジュールレベル関数で参照安定
 *
 * 境界: セクションツリーナビ・本文・Traceability テーブルのみ。RefChip の対応先解決・
 * ジャンプ（5.3）、anchors.ts / useJump（5.2）は本タスクの範囲外。
 */
import type { JSX, ReactNode } from "react";
import type { SectionNode } from "@contracts/document";
import type { DesignDoc, TraceabilityRow } from "@contracts/spec";
import type { RefToken } from "@contracts/trace";
import { DocBlockList, type StructuredBlock } from "@/markdown/DocBlockList";

export interface DesignViewProps {
  doc: DesignDoc;
}

/**
 * design 要素名 → アンカー ID の slug 部分（trim → 小文字 → 非英数を `-`）。
 * design.md JumpNavigation 規約（`design "RawBlockView"` → `design-rawblockview`）に揃える。
 * 5.2 anchors.ts（anchorIdOf）が規約の単一所有者になるため、同一アルゴリズムを保つ。
 */
function designSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
}

/** design 要素アンカー ID（`design-<slug>`） */
function designAnchorId(name: string): string {
  return `design-${designSlug(name)}`;
}

/** RefToken の表示テキスト（kind 別に原文を忠実に表示。解釈は RefChip 5.3 の責務） */
function refTokenText(token: RefToken): string {
  return token.raw;
}

/** RefToken の安定キー（同一行内で raw が重複しても位置で区別する） */
function refTokenKey(token: RefToken, index: number): string {
  return `${index}:${token.raw}`;
}

/**
 * 参照チップ列（5.3 RefChip までは静的・非インタラクティブ）。
 * RefToken の kind 別の原文テキストをそのまま表示する（exact-value testable）。
 */
function RefChipList({ refs }: { refs: readonly RefToken[] }): JSX.Element {
  return (
    <span className="flex flex-wrap gap-1">
      {refs.map((token, index) => (
        <span
          key={refTokenKey(token, index)}
          data-testid="ref-chip"
          data-ref-kind={token.kind}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700"
        >
          {refTokenText(token)}
        </span>
      ))}
    </span>
  );
}

/** SectionNode.depth（1-6）→ 見出しタグ。範囲外の depth は h6 に丸める */
const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function headingTag(depth: number): (typeof HEADING_TAGS)[number] {
  return HEADING_TAGS[Math.min(Math.max(depth, 1), 6) - 1] ?? "h6";
}

/**
 * セクション見出しツリーを本文として再帰描画する。各見出しに design 要素アンカー
 * （`design-<slug>`）を払い出す（契約 SectionNode は見出し階層のみを運ぶ）。
 */
function SectionHeadingTree({ section }: { section: SectionNode }): JSX.Element {
  const Heading = headingTag(section.depth);
  return (
    <>
      <Heading id={designAnchorId(section.title)} className="text-base font-semibold">
        {section.title}
      </Heading>
      {section.children.map((child) => (
        <SectionHeadingTree key={child.position.startOffset} section={child} />
      ))}
    </>
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

/** Traceability テーブルの 1 行（DocBlockList へ渡すため module-level で参照安定にする） */
function renderTraceabilityRow(block: StructuredBlock<TraceabilityRow>): ReactNode {
  return (
    <tr data-testid="traceability-row" className="border-t border-slate-200 align-top">
      <td className="px-2 py-1">
        <RefChipList refs={block.refs} />
      </td>
      <td className="px-2 py-1 text-sm">{block.summary}</td>
      <td className="px-2 py-1 text-sm">{block.components}</td>
      <td className="px-2 py-1 text-sm">{block.interfaces}</td>
      <td className="px-2 py-1 text-sm">{block.flows}</td>
    </tr>
  );
}

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
        {/* 本文: セクション見出しツリー（design アンカー付き） */}
        <section className="space-y-1">
          {doc.sections.map((section) => (
            <SectionHeadingTree key={section.position.startOffset} section={section} />
          ))}
        </section>

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
      </article>
    </div>
  );
}
