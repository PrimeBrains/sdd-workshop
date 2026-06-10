/**
 * DesignParser — design.md をセクションツリー + トレーサビリティ構造へ変換する純粋関数。
 * （design.md Parser 層 DesignParser。Requirements 4.1, 4.2, 4.3, 4.4）
 *
 * 制約:
 * - FS アクセス禁止。入力は文字列のみ（MarkdownEngine / RefListParser の合成）
 * - 参照文法の解釈は RefListParser に全面委譲し、本モジュールでは再実装しない
 * - `Requirements Traceability` セクション内のテーブル行 → TraceabilityRow（4.2）。
 *   セル数が合わない行は RawBlock + 診断（reason）で返し、残りの行の抽出を継続する（4.4）
 * - 参照の 3 源泉のうち design 由来の 2 つを抽出する（4.3）:
 *   サマリー表の `Req Coverage` 列、コンポーネント詳細 `| Field | Detail |` 表の
 *   `Requirements` 行。実在照合は TraceGraphBuilder の責務であり行わない
 */
import type { Table, TableCell, TableRow } from "mdast";
import type { Position, SectionNode } from "../types/document.js";
import type { ComponentRequirements, DesignDoc, TraceabilityRow } from "../types/spec.js";
import { nodeToPosition, parseMarkdown } from "./markdown.js";
import { parseRefList } from "./ref-list.js";

type TraceabilityBlock = DesignDoc["traceability"][number];

/** Traceability 表の固定列数（Requirement / Summary / Components / Interfaces / Flows） */
const TRACEABILITY_COLUMNS = 5;

/**
 * design.md ソースを DesignDoc へ変換する。
 * Postcondition: 例外を投げない。Traceability セクションが無い文書では
 * traceability / componentRequirements は空配列になり sections のみ返る。
 */
export function parseDesign(source: string): DesignDoc {
  const { tree, sections } = parseMarkdown(source);

  // GFM テーブルはネストしないため root 直下の走査で全テーブルを得られる
  const tables: Table[] = [];
  for (const node of tree.children) {
    if (node.type === "table") {
      tables.push(node);
    }
  }

  const traceabilityRanges = collectTraceabilityRanges(sections);
  const traceability: TraceabilityBlock[] = [];
  const componentRequirements: ComponentRequirements[] = [];

  for (const table of tables) {
    const position = nodeToPosition(table);
    if (position === null) {
      continue;
    }
    if (traceabilityRanges.some((range) => contains(range, position))) {
      traceability.push(...parseTraceabilityTable(table, source));
      continue;
    }
    componentRequirements.push(
      ...parseSummaryTable(table, source),
      ...parseFieldTable(table, source, sections, position),
    );
  }

  return { sections, traceability, componentRequirements };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** `Requirements Traceability` セクション（任意の深さ）の position 範囲を集める */
function collectTraceabilityRanges(sections: SectionNode[]): Position[] {
  const ranges: Position[] = [];
  for (const section of sections) {
    if (section.title === "Requirements Traceability") {
      ranges.push(section.position);
    }
    ranges.push(...collectTraceabilityRanges(section.children));
  }
  return ranges;
}

/** inner 範囲が outer 範囲に完全に含まれるか */
function contains(outer: Position, inner: Position): boolean {
  return inner.startOffset >= outer.startOffset && inner.endOffset <= outer.endOffset;
}

/**
 * Traceability 表のデータ行を TraceabilityRow へ構造化する（4.2）。
 * 5 セルに満たない / 超える行は RawBlock + 診断として返し、後続行の抽出を継続する（4.4）。
 */
function parseTraceabilityTable(table: Table, source: string): TraceabilityBlock[] {
  const blocks: TraceabilityBlock[] = [];
  for (const row of table.children.slice(1)) {
    const position = nodeToPosition(row);
    if (position === null) {
      continue; // remark では発生しない防衛分岐
    }
    if (row.children.length !== TRACEABILITY_COLUMNS) {
      blocks.push({
        kind: "raw",
        position,
        markdown: source.slice(position.startOffset, position.endOffset),
        reason: `Traceability 行のセル数が ${TRACEABILITY_COLUMNS} 列ではない（実際: ${row.children.length} 列）`,
      });
      continue;
    }
    const cells = row.children.map((cell) => cellRaw(cell, source));
    const structured: TraceabilityRow = {
      refs: parseRefList(cells[0] ?? ""),
      summary: cells[1] ?? "",
      components: cells[2] ?? "",
      interfaces: cells[3] ?? "",
      flows: cells[4] ?? "",
    };
    blocks.push({ kind: "structured", position, ...structured });
  }
  return blocks;
}

/**
 * サマリー表（ヘッダーに `Component` 列と `Req Coverage` 列を持つ表）の各行から
 * コンポーネント名と参照を抽出する（4.3）。
 */
function parseSummaryTable(table: Table, source: string): ComponentRequirements[] {
  const header = table.children[0];
  if (header === undefined) {
    return [];
  }
  const titles = header.children.map((cell) => cellText(cell).trim());
  const componentColumn = titles.indexOf("Component");
  const coverageColumn = titles.indexOf("Req Coverage");
  if (componentColumn === -1 || coverageColumn === -1) {
    return [];
  }

  const entries: ComponentRequirements[] = [];
  for (const row of table.children.slice(1)) {
    const position = nodeToPosition(row);
    const componentCell = row.children[componentColumn];
    const coverageCell = row.children[coverageColumn];
    if (position === null || componentCell === undefined || coverageCell === undefined) {
      continue;
    }
    entries.push({
      component: cellText(componentCell).trim(),
      refs: parseRefList(cellRaw(coverageCell, source)),
      position,
    });
  }
  return entries;
}

/**
 * コンポーネント詳細の `| Field | Detail |` 表から `Requirements` 行を抽出する（4.3）。
 * コンポーネント名は表を含む最深セクションの見出しタイトル。
 */
function parseFieldTable(
  table: Table,
  source: string,
  sections: SectionNode[],
  tablePosition: Position,
): ComponentRequirements[] {
  const header = table.children[0];
  if (header === undefined) {
    return [];
  }
  const titles = header.children.map((cell) => cellText(cell).trim());
  if (titles.length !== 2 || titles[0] !== "Field" || titles[1] !== "Detail") {
    return [];
  }

  const entries: ComponentRequirements[] = [];
  for (const row of table.children.slice(1)) {
    const position = nodeToPosition(row);
    const [fieldCell, detailCell] = row.children;
    if (position === null || fieldCell === undefined || detailCell === undefined) {
      continue;
    }
    if (cellText(fieldCell).trim() !== "Requirements") {
      continue;
    }
    entries.push({
      component: deepestSectionTitle(sections, tablePosition) ?? "",
      refs: parseRefList(cellRaw(detailCell, source)),
      position,
    });
  }
  return entries;
}

/** range を含む最深セクションのタイトル。どのセクションにも属さなければ null */
function deepestSectionTitle(sections: SectionNode[], range: Position): string | null {
  for (const section of sections) {
    if (!contains(section.position, range)) {
      continue;
    }
    return deepestSectionTitle(section.children, range) ?? section.title;
  }
  return null;
}

/**
 * セル内容の原文テキスト（インラインコードのバッククォート等を保持）。
 * mdast の tableCell position は区切りパイプを含むため、インライン子ノードの
 * 範囲 [先頭子の start, 末尾子の end) をソースから切り出す。子が無いセルは空文字列。
 */
function cellRaw(cell: TableCell, source: string): string {
  const first = cell.children[0];
  const last = cell.children[cell.children.length - 1];
  if (first === undefined || last === undefined) {
    return "";
  }
  const start = nodeToPosition(first);
  const end = nodeToPosition(last);
  if (start === null || end === null) {
    return "";
  }
  return source.slice(start.startOffset, end.endOffset).trim();
}

/** セルのインラインテキスト（text / inlineCode の値を連結。バッククォートは落ちる） */
function cellText(cell: TableCell): string {
  return inlineText(cell);
}

/** インライン子孫の text / inlineCode を連結する */
function inlineText(node: { type: string; value?: unknown; children?: unknown }): string {
  if ((node.type === "text" || node.type === "inlineCode") && typeof node.value === "string") {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    return (node.children as Array<{ type: string; value?: unknown; children?: unknown }>)
      .map(inlineText)
      .join("");
  }
  return "";
}
