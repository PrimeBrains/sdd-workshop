/**
 * MarkdownEngine — markdown 文字列を position 付き mdast とセクションツリーへ変換し、
 * 構造化できなかった範囲を RawBlock として切り出す純粋関数群。
 * （design.md Parser 層 MarkdownEngine。Requirements 3.4, 4.1, 13.2, 13.3）
 *
 * 制約:
 * - FS アクセス禁止。入力は文字列のみ
 * - `parseMarkdown` / `coverGaps` はどんな入力でも例外を投げない
 * - 情報無欠落不変則: 構造化済み position 群 + coverGaps の RawBlock 群を連結すると
 *   元文書全体 `[0, source.length)` を隙間なくカバーする（13.3）
 */
import type { Heading, Root, RootContent } from "mdast";
import type { Literal, Node, Parent } from "unist";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Position, RawBlock, SectionNode } from "../types/document.js";

/** remark プロセッサ（パースのみ。状態を持たないため module スコープで共有） */
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml"]);

/** mdast ノードの unist position を共通 Position へ変換する。offset 欠落時は null */
export function nodeToPosition(node: Node): Position | null {
  const { position } = node;
  if (
    position === undefined ||
    position.start.offset === undefined ||
    position.end.offset === undefined
  ) {
    return null;
  }
  return {
    startLine: position.start.line,
    endLine: position.end.line,
    startOffset: position.start.offset,
    endOffset: position.end.offset,
  };
}

/**
 * markdown 文字列を position 付き mdast と見出し階層セクションツリーへ変換する。
 * Postcondition: 例外を投げない。パース不能時は空の root / 空 sections を返し、
 * 呼び出し側が coverGaps で全文を 1 個の RawBlock として回収できる。
 */
export function parseMarkdown(source: string): { tree: Root; sections: SectionNode[] } {
  try {
    const tree = processor.parse(source);
    return { tree, sections: buildSectionTree(tree, source) };
  } catch {
    // remark は基本的に throw しないが、Postcondition（throw しない）を防衛的に保証する
    return { tree: { type: "root", children: [] }, sections: [] };
  }
}

/**
 * 構造化済み position 群の補集合（隙間）を RawBlock 列として返す（13.2）。
 * どんな covered 入力（負・NaN・逆転・範囲外・重複）でも例外を投げず、
 * 有効範囲へ clamp / 無効 range は無視して不変則を保つ。
 */
export function coverGaps(source: string, covered: Position[], reason: string): RawBlock[] {
  const length = source.length;
  const clamp = (value: number): number => Math.min(Math.max(Math.trunc(value), 0), length);

  // 1. sanitize: 有効な [start, end) range のみ残す
  const ranges: Array<{ start: number; end: number }> = [];
  for (const position of covered) {
    if (!Number.isFinite(position.startOffset) || !Number.isFinite(position.endOffset)) {
      continue;
    }
    const start = clamp(position.startOffset);
    const end = clamp(position.endOffset);
    if (end > start) {
      ranges.push({ start, end });
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);

  // 2. 補集合（隙間）を走査
  const lineStarts = computeLineStarts(source);
  const gaps: RawBlock[] = [];
  let cursor = 0;
  const pushGap = (start: number, end: number): void => {
    if (end > start) {
      gaps.push({
        kind: "raw",
        position: positionFromOffsets(lineStarts, start, end),
        markdown: source.slice(start, end),
        reason,
      });
    }
  };
  for (const range of ranges) {
    pushGap(cursor, range.start);
    cursor = Math.max(cursor, range.end);
  }
  pushGap(cursor, length);
  return gaps;
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** 各行の開始オフセット（1-origin 行番号 n の開始 = lineStarts[n - 1]）。\n 区切り */
function computeLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/** オフセットを含む行番号（1-origin）を二分探索で求める */
function lineOfOffset(lineStarts: number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((lineStarts[mid] ?? 0) <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low + 1;
}

/**
 * `[startOffset, endOffset)` の文字範囲から Position を組み立てる。
 * endLine は最後にカバーする文字（endOffset - 1）の行（mdast の end.line と同じ感覚）。
 */
function positionFromOffsets(lineStarts: number[], startOffset: number, endOffset: number): Position {
  return {
    startLine: lineOfOffset(lineStarts, startOffset),
    endLine: lineOfOffset(lineStarts, Math.max(startOffset, endOffset - 1)),
    startOffset,
    endOffset,
  };
}

/** インライン子孫の text / inlineCode を連結して見出しタイトルを得る */
function extractText(node: Node): string {
  if (node.type === "text" || node.type === "inlineCode") {
    const value = (node as Partial<Literal>).value;
    return typeof value === "string" ? value : "";
  }
  const children = (node as Partial<Parent>).children;
  if (children === undefined) {
    return "";
  }
  return children.map(extractText).join("");
}

/**
 * トップレベル見出しからセクションツリーを構築する。
 * セクション範囲: 見出し開始 〜 次の depth<=N トップレベル見出し直前（なければ文書末尾）。
 */
function buildSectionTree(tree: Root, source: string): SectionNode[] {
  const headings: Array<{ node: Heading; startOffset: number; startLine: number }> = [];
  for (const child of tree.children as RootContent[]) {
    if (child.type !== "heading") {
      continue;
    }
    const position = nodeToPosition(child);
    if (position === null) {
      continue;
    }
    headings.push({ node: child, startOffset: position.startOffset, startLine: position.startLine });
  }

  const lineStarts = computeLineStarts(source);
  const roots: SectionNode[] = [];
  const stack: SectionNode[] = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (heading === undefined) {
      continue;
    }
    const depth = heading.node.depth;
    // 次の depth<=N トップレベル見出しの開始がこのセクションの終端
    let endOffset = source.length;
    for (let j = i + 1; j < headings.length; j++) {
      const later = headings[j];
      if (later !== undefined && later.node.depth <= depth) {
        endOffset = later.startOffset;
        break;
      }
    }
    const section: SectionNode = {
      title: extractText(heading.node).trim(),
      depth,
      position: {
        startLine: heading.startLine,
        endLine: lineOfOffset(lineStarts, Math.max(heading.startOffset, endOffset - 1)),
        startOffset: heading.startOffset,
        endOffset,
      },
      children: [],
    };
    while (stack.length > 0 && (stack[stack.length - 1]?.depth ?? 0) >= depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent === undefined) {
      roots.push(section);
    } else {
      parent.children.push(section);
    }
    stack.push(section);
  }
  return roots;
}
