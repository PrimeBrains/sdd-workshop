/**
 * 文書共通型 — Position / DocBlock / SectionNode 等（design.md MarkdownEngine Service Interface）。
 * 全パーサー共通の不変則: 出力ブロック列の position を連結すると元文書全体を
 * 隙間なくカバーする（情報無欠落原則、Requirement 13.2 / 13.3）。
 */

/** ソース文書内の位置（行は 1-origin、文字オフセットは 0-origin） */
export interface Position {
  startLine: number; // 1-origin
  endLine: number;
  startOffset: number; // 0-origin 文字オフセット
  endOffset: number;
}

/** 構造化に失敗した範囲の生 markdown フォールバック（理由付き） */
export interface RawBlock {
  kind: "raw";
  position: Position;
  markdown: string;
  reason: string;
}

/**
 * 文書 DTO の基本単位: 構造化要素 or 生フォールバックの union。
 * structured | raw の和がソース文書全体を欠落なくカバーする（13.2, 13.3）。
 */
export type DocBlock<T> = ({ kind: "structured"; position: Position } & T) | RawBlock;

/** 見出し階層のセクションツリーノード */
export interface SectionNode {
  title: string;
  depth: number; // 1-6
  position: Position;
  children: SectionNode[];
}

/** markdown 文書の内容 + セクション構造（steering / skill / brief 等の共通読取ビュー） */
export interface MarkdownContent {
  /** 元文書の全文（情報無欠落の最終フォールバック） */
  content: string;
  sections: SectionNode[];
}

/**
 * パース診断の共通形。パース失敗はエラーではなく（throw しない）、
 * 診断として正常レスポンスに含める（design.md Error Strategy）。
 */
export interface Diagnostic {
  /** 診断種別（例: "parse-failure"） */
  kind: string;
  message: string;
  /** 位置を特定できない診断（ファイル全体の不正 JSON 等）は null */
  position: Position | null;
}
