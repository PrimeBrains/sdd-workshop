/**
 * データ取得エラーの画面単位表示（design.md Error Handling / Requirement 1.5）。
 * 機械可読な `code` と人間可読な `message` を表示し、再試行ボタンで渡された
 * refetch コールバックを発火する。エラー解釈はしない（NormalizedApiError をそのまま表示）。
 */
import type { NormalizedApiError } from "@/api/client";

interface ErrorPanelProps {
  error: NormalizedApiError;
  /** 再試行ボタンで発火する refetch コールバック */
  onRetry: () => void;
}

export function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  return (
    <div
      role="alert"
      className="m-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"
    >
      <p className="font-mono text-xs font-semibold tracking-wide">{error.code}</p>
      <p className="mt-1">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded border border-red-300 bg-white px-3 py-1 font-medium hover:bg-red-100"
      >
        再試行
      </button>
    </div>
  );
}
