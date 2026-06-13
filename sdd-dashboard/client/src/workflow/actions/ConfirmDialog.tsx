/**
 * ConfirmDialog — 承認・手戻りの確認ゲートの唯一の基盤
 * （design.md「SpecWorkflowActions + ConfirmDialog ...」/ Requirements 2.3, 3.3, 9.3）。
 *
 * 構造的保証（9.3）: 書込につながる動作は `onConfirm` コールバック経由でのみ起こる。
 * このコンポーネントは `onConfirm` を「確定ボタンのクリック」以外のいかなる経路からも
 * 呼ばない（マウント時・Esc・背景クリックはいずれも `onCancel` か無操作）。
 * したがって 4.2/4.3 は `onConfirm` に mutation を差し込むだけで誤発火しない。
 *
 * - 確定 / キャンセルの 2 操作。Esc / 背景クリックはキャンセル扱い（2.3, 3.3）
 * - `pending` 中は確定ボタンを無効化し二重送信を防ぐ
 * - `error` があれば `code` + `message`（fieldErrors も）をダイアログ内に表示する
 * - `dangerouslySetInnerHTML` は使わない（tech.md）
 */
import { useEffect, useRef, type JSX, type ReactNode } from "react";
import type { NormalizedApiError } from "@/api/client";
import { btnClass } from "@/shared/ui";

export interface ConfirmDialogProps {
  title: string;
  /** 対象表示・影響表示など */
  children: ReactNode;
  confirmLabel: string;
  pending: boolean;
  error: NormalizedApiError | null;
  /** 書込はこのコールバック経由のみ（9.3 の構造的保証） */
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);

  // 初期フォーカスをダイアログパネルへ移し、Esc を確実に受け取れるようにする。
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    // 背景（オーバーレイ）クリックはキャンセル扱い（2.3, 3.3）。
    <div
      data-testid="confirm-dialog-backdrop"
      className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="bg-paper-warm w-full max-w-md rounded-xl p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)] outline-none"
        // パネル内クリックは背景へ伝播させない（誤キャンセル防止）。
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h2 className="text-ink text-base font-semibold">{title}</h2>

        <div className="text-ink mt-3 text-sm">{children}</div>

        {error !== null ? (
          <div
            role="alert"
            className="border-bad-line bg-bad-soft text-bad mt-4 rounded-md border p-3 text-sm"
          >
            <p className="font-mono text-xs font-semibold tracking-wide">{error.code}</p>
            <p className="mt-1">{error.message}</p>
            {error.fieldErrors !== undefined ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {Object.entries(error.fieldErrors).flatMap(([field, messages]) =>
                  messages.map((message) => (
                    <li key={`${field}:${message}`}>{message}</li>
                  )),
                )}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btnClass("default")}>
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`${btnClass("primary")} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
