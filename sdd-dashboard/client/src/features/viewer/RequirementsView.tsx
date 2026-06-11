/**
 * RequirementsView — requirements.md の構造化ビューア
 * （tasks.md 4.1 / Requirements 2.1, 2.2 / design.md RequirementsView・File Structure Plan）。
 *
 * - `RequirementsDoc.requirements` を要件カード（ID・タイトル・objective + AC リスト）として
 *   描画する（2.1）。各 AC は ID チップ + 英文 + `translationJa`（存在時は同一項目内にペア
 *   表示、和訳なしは英文のみ → 2.2）
 * - requirements + otherBlocks を position（startOffset）順にマージし、raw フォールバックを
 *   含め DocBlockList 経由で文書順に描画する（情報無欠落、2.5。サーバー側不変則
 *   「position 連結 = 元文書全体」を表示順でも保つ）
 * - otherBlocks の構造化セクション（Introduction / Boundary Context）は SectionNode ツリーを
 *   再帰的に正しい見出しレベルで描画する（本文テキストは契約上 raw ブロックが運ぶ）
 * - アンカー ID は要件・AC とも `req-<id>`（design.md JumpNavigation 規約・3.2 の暫定払い出し
 *   と互換。5.2 anchors.ts（anchorIdOf）が規約の単一所有者となる）
 * - AC の ID チップは非インタラクティブな表示のみ（参照の構造化解釈は RefChip 5.3 の責務）
 * - パース診断: RequirementsDoc 契約は文書単位の diagnostics を運ばない。raw ブロックの
 *   `reason` は RawBlockView（DocBlockList 経由）が title ツールチップで表示する
 * - DocBlockList の memo 前提を守るため、renderStructured はモジュールレベル関数で参照安定
 */
import { useMemo, type JSX, type ReactNode } from "react";
import type { DocBlock, SectionNode } from "@contracts/document";
import type { RequirementsDoc } from "@contracts/spec";
import { DocBlockList, type StructuredBlock } from "@/markdown/DocBlockList";

export interface RequirementsViewProps {
  doc: RequirementsDoc;
}

type RequirementBlock = RequirementsDoc["requirements"][number];
type StructuredRequirement = Extract<RequirementBlock, { kind: "structured" }>;
type CriterionPayload = { id: string; text: string; translationJa: string | null };

/** マージ後リストの structured ペイロード（要件 or セクション見出し） */
type MergedPayload = Omit<StructuredRequirement, "kind" | "position"> | { section: SectionNode };

/**
 * requirements + otherBlocks を position（startOffset）順にマージする。
 * サーバー側不変則（position 連結 = 元文書全体）を表示順でも保つ（情報無欠落、2.5）。
 */
function mergeRequirementsBlocks(doc: RequirementsDoc): Array<DocBlock<MergedPayload>> {
  return [...doc.requirements, ...doc.otherBlocks].sort(
    (a, b) => a.position.startOffset - b.position.startOffset,
  );
}

/** SectionNode.depth（1-6）→ 見出しタグ。範囲外の depth は h6 に丸める */
const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function headingTag(depth: number): (typeof HEADING_TAGS)[number] {
  return HEADING_TAGS[Math.min(Math.max(depth, 1), 6) - 1] ?? "h6";
}

/**
 * otherBlocks の構造化セクションを見出しツリーとして再帰描画する。
 * 契約（SectionNode）は見出し階層のみを運ぶ — 本文は raw ブロックとして別途届くため、
 * 子見出しを含む全タイトルを正しいレベルで描画すれば情報無欠落が保たれる。
 */
function SectionHeadingTree({ section }: { section: SectionNode }): JSX.Element {
  const Heading = headingTag(section.depth);
  return (
    <>
      <Heading className="text-base font-semibold">{section.title}</Heading>
      {section.children.map((child) => (
        <SectionHeadingTree key={child.position.startOffset} section={child} />
      ))}
    </>
  );
}

/** AC 1 件の描画（DocBlockList の memo 前提のためモジュールレベルで参照安定にする） */
function renderCriterion(block: StructuredBlock<CriterionPayload>): ReactNode {
  return (
    // アンカー ID `req-<AC id>`（design.md JumpNavigation 規約。5.2 anchors.ts が単一所有者になる）
    <div id={`req-${block.id}`} className="flex items-start gap-2 text-sm">
      {/* ID チップ（非インタラクティブ。参照の構造化解釈は RefChip 5.3 の責務） */}
      <span
        data-testid="ac-id-chip"
        className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700"
      >
        {block.id}
      </span>
      <div>
        <p>{block.text}</p>
        {/* 英文と和訳を同一項目内にペア表示（2.2）。和訳なしは英文のみ（空要素を出さない） */}
        {block.translationJa !== null && (
          <p data-testid="ac-translation" className="mt-0.5 text-slate-600">
            {block.translationJa}
          </p>
        )}
      </div>
    </div>
  );
}

/** 要件カード: ID・タイトル・objective + AC リスト（2.1） */
function RequirementCard({ requirement }: { requirement: StructuredRequirement }): JSX.Element {
  return (
    <section id={`req-${requirement.id}`} className="rounded-md border border-slate-200 p-3">
      <h2 className="text-base font-semibold">
        Requirement {requirement.id}: {requirement.title}
      </h2>
      {requirement.objective !== null && (
        <p className="mt-1 text-sm text-slate-700">{requirement.objective}</p>
      )}
      <div className="mt-2 space-y-2">
        <DocBlockList blocks={requirement.criteria} renderStructured={renderCriterion} />
      </div>
    </section>
  );
}

/** マージ後リストの structured 描画（モジュールレベルで参照安定 — DocBlockList の memo 前提） */
function renderMergedBlock(block: StructuredBlock<MergedPayload>): ReactNode {
  if ("section" in block) {
    return <SectionHeadingTree section={block.section} />;
  }
  return <RequirementCard requirement={block} />;
}

export function RequirementsView({ doc }: RequirementsViewProps): JSX.Element {
  const blocks = useMemo(() => mergeRequirementsBlocks(doc), [doc]);
  return (
    <article data-testid="requirements-view" className="space-y-3">
      <DocBlockList<MergedPayload> blocks={blocks} renderStructured={renderMergedBlock} />
    </article>
  );
}
