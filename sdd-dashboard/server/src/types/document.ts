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

/**
 * 構造化に失敗した範囲の生 markdown フォールバック（理由付き）。
 *
 * `severity` は「装飾の意味と適用条件を一致させる」ための区別（postmortem #0004）:
 * - `"failure"`: 真の構造化失敗（例: Traceability 行のセル数不一致、受入基準として
 *   解釈できない番号付きリスト項目）。表示側は警告装飾（点線ボーダー等）を付ける。
 * - `"gap"` / 省略: `coverGaps` が回収した正常な非構造化コンテンツ（見出し・前文等）。
 *   情報無欠落のために raw として運ぶだけで失敗ではないため、表示側は通常描画する。
 */
export interface RawBlock {
  kind: "raw";
  position: Position;
  markdown: string;
  reason: string;
  severity?: "gap" | "failure";
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
