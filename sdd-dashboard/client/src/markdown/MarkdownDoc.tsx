/**
 * MarkdownDoc — brief / research など「構造化スキーマを持たない文書」の全体描画
 * （design.md / Requirement 2.7）。
 *
 * sdd-core の `MarkdownContent`（content 全文 + sections ツリー）を受け取り、
 * セクション見出しを含む全文を整形済みテキストとして描画する。
 * 安全設定は RawBlockView の `safeMarkdownOptions` を共有する（raw HTML 不活性化・
 * 外部 URL 無効化の単一定義 — design.md Security Considerations）。
 */
import { memo } from "react";
import Markdown from "react-markdown";
import type { MarkdownContent } from "@contracts/document";
import { safeMarkdownOptions } from "@/markdown/RawBlockView";

export interface MarkdownDocProps {
  /** SpecDetail の brief / research フィールド等（MarkdownContent） */
  doc: MarkdownContent;
}

export const MarkdownDoc = memo(function MarkdownDoc({ doc }: MarkdownDocProps) {
  return (
    <article className="space-y-3 leading-relaxed">
      <Markdown {...safeMarkdownOptions}>{doc.content}</Markdown>
    </article>
  );
});
