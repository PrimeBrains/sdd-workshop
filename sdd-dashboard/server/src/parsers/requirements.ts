/**
 * RequirementsParser — requirements.md を要件・AC・和訳の構造化データへ変換する純粋関数。
 * （design.md Parser 層 RequirementsParser。Requirements 3.1, 3.2, 3.3）
 *
 * 制約:
 * - FS アクセス禁止。入力は文字列のみ（MarkdownEngine との合成）
 * - 数値 ID 付き要件見出し（`### Requirement N: タイトル`）→ `{ id, title, objective }`、
 *   番号付きリスト → `{ id: "N.M", text }`、直後のインデント `- 和訳:` → `translationJa`
 * - 情報無欠落不変則（13.2, 13.3）: requirements + otherBlocks の position を連結すると
 *   元文書全体を隙間なくカバーする。要件として構造化されなかったセクションは
 *   `otherBlocks` にセクションとして保持し、どのセクションにも属さない範囲は
 *   coverGaps の RawBlock で回収する
 */
import type { ListItem, Paragraph, PhrasingContent, Root } from "mdast";
import type { Position, SectionNode } from "../types/document.js";
import type { RequirementsDoc } from "../types/spec.js";
import { coverGaps, nodeToPosition, parseMarkdown } from "./markdown.js";

type RequirementBlock = RequirementsDoc["requirements"][number];
type StructuredRequirement = Extract<RequirementBlock, { kind: "structured" }>;
type CriterionBlock = StructuredRequirement["criteria"][number];
type OtherBlock = RequirementsDoc["otherBlocks"][number];

/** 数値 ID 付き要件見出し（例: `Requirement 3: requirements.md の構造化パース`） */
const REQUIREMENT_TITLE = /^Requirement\s+(\d+)\s*[::]\s*(.*)$/u;
/** AC 直後のインデント箇条書きの和訳マーカー */
const TRANSLATION_MARKER = /^和訳[::]\s*([\s\S]*)$/u;
/** 番号付きリスト項目のマーカー（`1.` / `1)`） */
const ORDERED_MARKER = /^(\d+)[.)]/u;

/**
 * requirements.md ソースを RequirementsDoc へ変換する。
 * Postcondition: 例外を投げない。要件見出しが 1 つも無い入力でも
 * 全内容が otherBlocks（セクション or RawBlock）として返る。
 */
export function parseRequirements(source: string): RequirementsDoc {
  const { tree, sections } = parseMarkdown(source);

  const requirementSections: Array<{ id: string; title: string; section: SectionNode }> = [];
  const otherSections: Array<{ kind: "structured"; position: Position; section: SectionNode }> = [];
  collectSections(sections, requirementSections, otherSections);

  const requirements: RequirementBlock[] = requirementSections.map((head) =>
    buildRequirement(head, tree, source),
  );

  const covered: Position[] = [
    ...requirements.map((block) => block.position),
    ...otherSections.map((block) => block.position),
  ];
  const raws = coverGaps(source, covered, "要件構造の外側のコンテンツ");
  const otherBlocks: OtherBlock[] = [...otherSections, ...raws].sort(
    (a, b) => a.position.startOffset - b.position.startOffset,
  );

  return { requirements, otherBlocks };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * セクションツリーを走査し、要件見出しセクションと「それ以外の保持対象セクション」へ振り分ける。
 * 要件を子孫に含むセクションは自身を保持せず子へ降りる（見出し行等の残余は coverGaps が回収）。
 */
function collectSections(
  sections: SectionNode[],
  requirementSections: Array<{ id: string; title: string; section: SectionNode }>,
  otherSections: Array<{ kind: "structured"; position: Position; section: SectionNode }>,
): void {
  for (const section of sections) {
    const match = REQUIREMENT_TITLE.exec(section.title);
    if (match !== null) {
      requirementSections.push({ id: match[1] ?? "", title: (match[2] ?? "").trim(), section });
      continue;
    }
    if (containsRequirement(section)) {
      collectSections(section.children, requirementSections, otherSections);
    } else {
      otherSections.push({ kind: "structured", position: section.position, section });
    }
  }
}

/** 子孫に要件見出しセクションを含むか */
function containsRequirement(section: SectionNode): boolean {
  return section.children.some(
    (child) => REQUIREMENT_TITLE.test(child.title) || containsRequirement(child),
  );
}

/** 要件セクション範囲内の mdast ノードから Objective と AC（番号付きリスト）を抽出する */
function buildRequirement(
  head: { id: string; title: string; section: SectionNode },
  tree: Root,
  source: string,
): RequirementBlock {
  const range = head.section.position;
  let objective: string | null = null;
  const criteria: CriterionBlock[] = [];

  for (const node of tree.children) {
    const position = nodeToPosition(node);
    if (
      position === null ||
      position.startOffset < range.startOffset ||
      position.endOffset > range.endOffset
    ) {
      continue;
    }
    if (node.type === "paragraph" && objective === null) {
      objective = extractObjective(node, source);
    } else if (node.type === "list" && node.ordered === true) {
      for (const item of node.children) {
        const criterion = buildCriterion(head.id, item, source);
        if (criterion !== null) {
          criteria.push(criterion);
        }
      }
    }
  }

  return {
    kind: "structured",
    position: range,
    id: head.id,
    title: head.title,
    objective,
    criteria,
  };
}

/** `**Objective:** 本文` 形式の段落から本文を取り出す。形式不一致は null */
function extractObjective(paragraph: Paragraph, source: string): string | null {
  const first = paragraph.children[0];
  if (first === undefined || first.type !== "strong") {
    return null;
  }
  if (!/^Objective[::]?$/u.test(inlineText(first).trim())) {
    return null;
  }
  const strongPosition = nodeToPosition(first);
  const paragraphPosition = nodeToPosition(paragraph);
  if (strongPosition === null || paragraphPosition === null) {
    return null;
  }
  const rest = source.slice(strongPosition.endOffset, paragraphPosition.endOffset);
  return normalizeText(rest.replace(/^[::]\s*/u, ""));
}

/**
 * 番号付きリスト項目を AC エントリへ変換する（3.2, 3.3）。
 * 番号マーカーか本文段落を欠く項目は RawBlock として返し情報を保持する（13.2）。
 * position が取れない項目（remark では発生しない防衛分岐）のみ null。
 */
function buildCriterion(
  requirementId: string,
  item: ListItem,
  source: string,
): CriterionBlock | null {
  const position = nodeToPosition(item);
  if (position === null) {
    return null;
  }
  const marker = ORDERED_MARKER.exec(source.slice(position.startOffset, position.endOffset));
  const paragraph = item.children.find(
    (child): child is Paragraph => child.type === "paragraph",
  );
  const paragraphPosition = paragraph === undefined ? null : nodeToPosition(paragraph);
  if (marker === null || paragraphPosition === null) {
    return {
      kind: "raw",
      position,
      markdown: source.slice(position.startOffset, position.endOffset),
      reason: "受入基準として解釈できない番号付きリスト項目",
    };
  }
  return {
    kind: "structured",
    position,
    id: `${requirementId}.${marker[1] ?? ""}`,
    text: normalizeText(source.slice(paragraphPosition.startOffset, paragraphPosition.endOffset)),
    translationJa: extractTranslation(item, source),
  };
}

/** AC 直後のインデント `- 和訳:` 箇条書きの本文を取り出す（3.3）。無ければ null */
function extractTranslation(item: ListItem, source: string): string | null {
  for (const child of item.children) {
    if (child.type !== "list") {
      continue;
    }
    for (const nested of child.children) {
      const paragraph = nested.children.find(
        (grandchild): grandchild is Paragraph => grandchild.type === "paragraph",
      );
      const paragraphPosition = paragraph === undefined ? null : nodeToPosition(paragraph);
      if (paragraphPosition === null) {
        continue;
      }
      const text = normalizeText(
        source.slice(paragraphPosition.startOffset, paragraphPosition.endOffset),
      );
      const match = TRANSLATION_MARKER.exec(text);
      if (match !== null) {
        return (match[1] ?? "").trim();
      }
    }
  }
  return null;
}

/** ソース折り返しの改行 + 継続インデントを単一スペースへ正規化する */
function normalizeText(text: string): string {
  return text.replace(/\r?\n[ \t]*/gu, " ").trim();
}

/** インライン子孫の text / inlineCode を連結する（Objective マーカー判定用） */
function inlineText(node: PhrasingContent): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value;
  }
  if ("children" in node) {
    return node.children.map(inlineText).join("");
  }
  return "";
}
