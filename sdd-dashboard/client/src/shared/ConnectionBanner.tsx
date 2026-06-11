/**
 * ConnectionBanner — SSE 切断インジケータ（design.md「ErrorPanel + ConnectionBanner + LoadingSkeleton」
 * / Error Handling「SSE 切断 → ConnectionBanner『再接続中』表示 + 自動再接続 + 復帰時全キー invalidate」、
 * Requirements 7.3、tasks.md 9.2）。
 *
 * 表示ロジックのみを持つ純粋な presentational コンポーネント:
 * - `status === "reconnecting"` のとき「再接続中…」インジケータを表示する
 * - `status === "connected"` のときは何も描画しない（null）
 *
 * 接続状態の管理（onerror→reconnecting / onopen→connected）は SseInvalidationBridge
 * （useChangeEvents）が所有し、本コンポーネントはその status を受け取って表示するだけ。
 * 書込操作の UI 要素（ボタン等）は一切持たない（8.1: 読み取り専用）。EventSource は
 * 自動再接続するため再試行ボタンも不要。
 */
import type { JSX } from "react";
import type { SseStatus } from "@/api/sse/useChangeEvents";

interface ConnectionBannerProps {
  status: SseStatus;
}

export function ConnectionBanner({ status }: ConnectionBannerProps): JSX.Element | null {
  if (status !== "reconnecting") return null;
  return (
    <div
      role="status"
      data-testid="connection-banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
    >
      再接続中…
    </div>
  );
}
