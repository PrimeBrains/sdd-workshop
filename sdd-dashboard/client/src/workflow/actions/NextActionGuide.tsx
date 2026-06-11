/**
 * NextActionGuide — 承認・手戻りの mutation 成功後に表示する「次アクション案内」パネル
 * （design.md「Feature: actions → NextActionGuide」/ Requirements 2.5, 3.5）。
 *
 * 表示専用（presentational）。HTTP・状態遷移は持たず、与えられた command と summary を描画する。
 * - 成功見出し + 更新後の状態サマリ（任意）
 * - 次に実行すべき CLI コマンドを厳密値の選択可能テキストとして提示
 * - コピー操作（navigator.clipboard.writeText に command の厳密値を渡す）
 * - 閉じる操作
 *
 * command は NextCommand（nextCommandAfterApproval / nextCommandAfterRollback）が唯一の出典であり、
 * ここで `/kiro-spec-*` をハードコードしない。dangerouslySetInnerHTML・外部 URL も用いない。
 */
import { type JSX, type ReactNode } from "react";

interface NextActionGuideProps {
  /** 次に実行すべき CLI コマンド（NextCommand 由来の厳密値）。 */
  command: string;
  /** 更新後の状態サマリ（任意）。 */
  summary?: ReactNode;
  /** ダイアログを閉じる。 */
  onClose: () => void;
  /** 成功見出し。既定は「完了しました」。呼び出し側で文脈に応じて上書きする。 */
  heading?: string;
  /** 背景の aria-label（呼び出し側の文脈を反映）。 */
  ariaLabel: string;
}

export function NextActionGuide({
  command,
  summary,
  onClose,
  heading = "完了しました",
  ariaLabel,
}: NextActionGuideProps): JSX.Element {
  // navigator.clipboard が未定義の環境ではクラッシュさせず何もしない（ガード）。
  const handleCopy = (): void => {
    const clipboard = navigator.clipboard;
    if (clipboard?.writeText) {
      void clipboard.writeText(command);
    }
  };

  return (
    <div
      data-testid="confirm-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900">{heading}</h2>
        {summary !== undefined ? (
          <div className="mt-3 text-sm text-gray-700">{summary}</div>
        ) : null}
        <p className="mt-4 text-sm font-medium text-gray-900">次に実行するコマンド</p>
        <div className="mt-1 flex items-center gap-2">
          <code
            data-testid="next-command"
            className="flex-1 select-all rounded bg-gray-100 px-2 py-1.5 font-mono text-sm text-gray-900"
          >
            {command}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            コピー
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
