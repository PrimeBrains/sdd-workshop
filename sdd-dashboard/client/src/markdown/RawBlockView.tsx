/**
 * RawBlockView — raw markdown の安全描画の唯一の所有者（design.md DocBlockList + RawBlockView +
 * MermaidBlock + MarkdownDoc / Requirements 2.5, 2.6, 8.2）。
 *
 * セキュリティ設定（design.md Security Considerations「XSS が最大の脅威面」）:
 * - raw HTML 非描画: rehype-raw を導入しない。react-markdown のデフォルト動作で
 *   raw HTML ノードは不活性テキストノードに変換され、script / img 等の要素は生成されない（2.6）
 * - `urlTransform` で外部オリジンの http(s) URL と危険スキーム（`javascript:` 等）を無効化し、
 *   同一オリジン・相対 URL・フラグメントアンカーのみ許可する（8.2）
 * - `dangerouslySetInnerHTML` 不使用（ESLint で静的に禁止）
 *
 * MarkdownDoc は本モジュールの `safeMarkdownOptions` を共有する（安全設定の単一定義）。
 */
import { memo } from "react";
import Markdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "@/markdown/MermaidBlock";

export interface RawBlockViewProps {
  markdown: string;
  /** 構造化失敗の診断ツールチップ（title 属性として表示） */
  reason?: string;
}

/**
 * 外部オリジン URL と危険スキームを無効化する urlTransform。
 * `undefined` を返すと react-markdown は属性自体を出力しない（外部 URL が DOM に残らない）。
 */
export function safeUrlTransform(url: string): string | undefined {
  // フラグメントアンカーは文書内ジャンプとして常に許可
  if (url.startsWith("#")) {
    return url;
  }
  try {
    const resolved = new URL(url, window.location.href);
    // http(s) 以外のスキーム（javascript:, data:, vbscript: 等）を遮断
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return undefined;
    }
    // 外部オリジンへの取得・遷移を遮断（完全ローカル動作: 8.2）。相対 URL は
    // location 基準で解決されるため同一オリジンとして保持される
    if (resolved.origin !== window.location.origin) {
      return undefined;
    }
    return url;
  } catch {
    // URL として解釈できない値は不正として無効化
    return undefined;
  }
}

/** フェンスコードブロックの言語クラス。hast properties では配列、React props では文字列になりうる */
const MERMAID_LANGUAGE_CLASS = "language-mermaid";

function hasMermaidLanguageClass(className: unknown): boolean {
  if (typeof className === "string") {
    return className.split(/\s+/).includes(MERMAID_LANGUAGE_CLASS);
  }
  return Array.isArray(className) && className.includes(MERMAID_LANGUAGE_CLASS);
}

/**
 * 言語指定 `mermaid` のフェンスコードブロックを MermaidBlock へディスパッチする
 * コンポーネント上書き（design.md / Requirements 2.8, 2.9）。それ以外の言語・インライン
 * コードはデフォルト描画のまま変更しない。`pre` は mermaid のときのみアンラップし、
 * `<pre>` 内に図コンテナを入れない。
 */
const markdownComponents: Components = {
  code({ node, className, children, ...rest }) {
    void node; // DOM 要素へ spread しないよう rest から除外するためだけに取り出す
    if (hasMermaidLanguageClass(className)) {
      // フェンス内ソース全文を渡す（react-markdown は末尾に改行 1 つを付与するため除去）
      return <MermaidBlock code={String(children ?? "").replace(/\n$/, "")} />;
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
  pre({ node, children, ...rest }) {
    const codeChild = node?.children.find(
      (child) => child.type === "element" && child.tagName === "code",
    );
    if (
      codeChild?.type === "element" &&
      hasMermaidLanguageClass(codeChild.properties.className)
    ) {
      return <>{children}</>;
    }
    return <pre {...rest}>{children}</pre>;
  },
};

/**
 * RawBlockView / MarkdownDoc が共有する安全描画設定（単一定義）。
 * remarkPlugins / components はモジュールレベルで固定し、再レンダー間で参照安定にする。
 */
export const safeMarkdownOptions = {
  remarkPlugins: [remarkGfm],
  urlTransform: safeUrlTransform,
  components: markdownComponents,
} satisfies Options;

/**
 * 生 markdown フォールバックの表示。「生表示」であることを示す控えめなボーダーを常に付け、
 * `reason` があれば title ツールチップで診断理由を示す。
 */
export const RawBlockView = memo(function RawBlockView({ markdown, reason }: RawBlockViewProps) {
  return (
    <div
      className="rounded border border-dashed border-amber-400/70 bg-amber-50/40 px-3 py-2"
      title={reason}
    >
      <Markdown {...safeMarkdownOptions}>{markdown}</Markdown>
    </div>
  );
});
