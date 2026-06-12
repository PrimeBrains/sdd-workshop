/**
 * MermaidBlock — `mermaid` フェンスコードブロックの図描画（design.md DocBlockList +
 * RawBlockView + MermaidBlock + MarkdownDoc / Requirements 2.8, 2.9）。
 *
 * セキュリティ設定（design.md Security Considerations）:
 * - mermaid は `securityLevel: 'strict'`（図中の raw HTML / script を無効化）で
 *   モジュールレベルにちょうど 1 回だけ初期化する
 * - mermaid が生成した SVG の DOM 注入は**本コンポーネントのみ**に許される管理された例外。
 *   注入するのは mermaid 由来の `svg` 文字列だけであり、markdown 由来 HTML は通さない
 * - 描画失敗（構文エラー等）時は生コード全文を目に見える警告とともに表示し、
 *   黙って欠落させない（2.9 — 情報無欠落原則）
 */
import { memo, useEffect, useState } from "react";
import mermaid from "mermaid";

export interface MermaidBlockProps {
  /** フェンスコードブロック内の mermaid ソース全文 */
  code: string;
}

/** `securityLevel: 'strict'` での初期化をモジュールレベルでちょうど 1 回に限定するガード */
let mermaidInitialized = false;

function ensureMermaidInitialized(): void {
  if (mermaidInitialized) {
    return;
  }
  mermaid.initialize({ securityLevel: "strict", startOnLoad: false });
  mermaidInitialized = true;
}

/** mermaid.render に渡す要素 ID の連番（同一画面内の複数ブロックで衝突しないように） */
let renderSeq = 0;

type RenderState =
  | { kind: "pending" }
  | { kind: "success"; svg: string }
  | { kind: "error"; message: string };

export const MermaidBlock = memo(function MermaidBlock({ code }: MermaidBlockProps) {
  const [renderId] = useState(() => `mermaid-block-${++renderSeq}`);
  const [state, setState] = useState<RenderState>({ kind: "pending" });

  useEffect(() => {
    let cancelled = false;
    ensureMermaidInitialized();
    setState({ kind: "pending" });
    (async () => {
      try {
        const { svg } = await mermaid.render(renderId, code);
        if (!cancelled) {
          setState({ kind: "success", svg });
        }
      } catch (error) {
        // mermaid は失敗時に body 直下へ一時要素（id / d{id}）を残すことがあるため掃除する
        document.getElementById(renderId)?.remove();
        document.getElementById(`d${renderId}`)?.remove();
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, renderId]);

  if (state.kind === "success") {
    return (
      <div
        data-testid="mermaid-block"
        className="mermaid-block overflow-x-auto rounded-lg border border-line bg-white p-3.5 text-center"
        // eslint-disable-next-line no-restricted-syntax -- design.md Security Considerations が規定する管理された唯一の例外: securityLevel 'strict' の mermaid が生成した SVG 文字列のみを注入する（markdown 由来 HTML は通らない）
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        className="rounded border border-bad-line bg-bad-soft px-3 py-2 text-sm"
      >
        <p className="font-medium text-bad">
          mermaid の描画に失敗しました: {state.message}
        </p>
        {/* 生コード全文をそのまま表示する（黙って欠落させない: 2.9） */}
        <pre className="mt-2 overflow-x-auto">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  // 描画完了までも情報を欠落させない: 生コードをプレースホルダとして表示する
  return (
    <pre className="overflow-x-auto">
      <code>{code}</code>
    </pre>
  );
});
