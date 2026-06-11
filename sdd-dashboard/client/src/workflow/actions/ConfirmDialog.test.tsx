/**
 * ConfirmDialog の単体テスト（tasks.md 4.1 / Requirements 2.3, 3.3, 9.3）。
 *
 * 確認ゲートの構造的保証を厳密に検証する:
 * - onConfirm はマウント時に自動発火しない（書込はユーザー操作経由のみ。9.3）
 * - 確定ボタンクリックで onConfirm が 1 回だけ呼ばれる
 * - キャンセルボタン / Esc / 背景クリックは onCancel（2.3, 3.3）
 * - pending=true で確定ボタンが無効化され、クリックしても onConfirm を呼ばない（二重送信防止）
 * - error の code / message（および fieldErrors）を厳密値で表示する
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NormalizedApiError } from "@/api/client";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

function renderDialog(
  overrides: Partial<ComponentProps<typeof ConfirmDialog>> = {},
): { onConfirm: ReturnType<typeof vi.fn>; onCancel: ReturnType<typeof vi.fn> } {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="承認の確認"
      confirmLabel="承認する"
      pending={false}
      error={null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    >
      <p>対象: sample-spec / requirements</p>
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("マウント時に onConfirm を自動発火しない（書込はユーザー操作経由のみ・9.3）", () => {
    const { onConfirm } = renderDialog();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("title・children・confirmLabel を表示する", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("承認の確認")).toBeTruthy();
    expect(screen.getByText("対象: sample-spec / requirements")).toBeTruthy();
    expect(screen.getByRole("button", { name: "承認する" })).toBeTruthy();
  });

  it("確定ボタンクリックで onConfirm が 1 回だけ呼ばれる", () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("キャンセルボタンで onCancel が呼ばれ、onConfirm は呼ばれない", () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Esc キーで onCancel が呼ばれる（2.3, 3.3）", () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("背景（オーバーレイ）クリックで onCancel が呼ばれる（2.3, 3.3）", () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.click(screen.getByTestId("confirm-dialog-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ダイアログ本文（パネル）内クリックは onCancel を呼ばない", () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByText("対象: sample-spec / requirements"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("pending=true で確定ボタンが無効化され、クリックしても onConfirm を呼ばない（二重送信防止）", () => {
    const { onConfirm } = renderDialog({ pending: true });
    const confirm = screen.getByRole("button", { name: "承認する" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("error の code と message を厳密値で表示する", () => {
    renderDialog({
      error: new NormalizedApiError("PHASE_NOT_GENERATED", "ドキュメントが未生成です", 422),
    });
    expect(screen.getByText("PHASE_NOT_GENERATED")).toBeTruthy();
    expect(screen.getByText("ドキュメントが未生成です")).toBeTruthy();
  });

  it("error が無いときはエラー表示領域を描画しない", () => {
    renderDialog();
    expect(screen.queryByText("PHASE_NOT_GENERATED")).toBeNull();
  });

  it("error.fieldErrors を表示する", () => {
    renderDialog({
      error: new NormalizedApiError("VALIDATION_FAILED", "検証に失敗しました", 422, {
        design: ["先行フェーズが未承認です", "再生成が必要です"],
      }),
    });
    expect(screen.getByText("VALIDATION_FAILED")).toBeTruthy();
    expect(screen.getByText("検証に失敗しました")).toBeTruthy();
    expect(screen.getByText("先行フェーズが未承認です")).toBeTruthy();
    expect(screen.getByText("再生成が必要です")).toBeTruthy();
  });
});
