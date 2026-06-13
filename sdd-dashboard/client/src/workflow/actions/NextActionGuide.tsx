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
import { btnClass } from "@/shared/ui";

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
      className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-paper-warm w-full max-w-md rounded-xl p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
        <h2 className="text-ink text-base font-semibold">{heading}</h2>
        {summary !== undefined ? (
          <div className="text-ink mt-3 text-sm">{summary}</div>
        ) : null}
        <p className="text-ink mt-4 text-sm font-medium">次に実行するコマンド</p>
        <div className="mt-1 flex items-center gap-2">
          <code
            data-testid="next-command"
            className="bg-fill-soft text-ink flex-1 select-all rounded px-2 py-1.5 font-mono text-sm"
          >
            {command}
          </code>
          <button type="button" onClick={handleCopy} className={btnClass("default")}>
            コピー
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className={btnClass("primary")}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
