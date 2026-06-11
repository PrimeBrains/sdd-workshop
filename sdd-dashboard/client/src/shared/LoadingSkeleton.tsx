/**
 * 読込中表示（design.md File Structure Plan `shared/LoadingSkeleton.tsx`）。
 * 画面単位のデータ取得待ちを示す最小スケルトン。書込操作 UI は持たない（Requirement 8.1）。
 */
import type { JSX } from "react";

interface LoadingSkeletonProps {
  /** スクリーンリーダー・テスト向けの読込中ラベル */
  label?: string;
}

export function LoadingSkeleton({ label = "読み込み中…" }: LoadingSkeletonProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loading-skeleton"
      className="m-4 animate-pulse rounded-md border border-slate-200 bg-slate-100 p-4 text-sm text-slate-400"
    >
      {label}
    </div>
  );
}
