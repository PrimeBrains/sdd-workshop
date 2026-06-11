/**
 * ErrorPanel のユニットテスト（tasks.md 1.2 / Requirement 1.5）。
 * 機械可読なエラーコードと人間可読なメッセージの厳密値表示 + 再試行操作（コールバック発火）を検証する。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NormalizedApiError } from "@/api/client";
import { ErrorPanel } from "@/shared/ErrorPanel";

afterEach(cleanup);

describe("ErrorPanel", () => {
  it("code と message を厳密値で表示する（Requirement 1.5）", () => {
    const error = new NormalizedApiError("INTERNAL_ERROR", "想定外のエラーが発生しました", 500);
    render(<ErrorPanel error={error} onRetry={() => {}} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("INTERNAL_ERROR");
    expect(alert.textContent).toContain("想定外のエラーが発生しました");
    expect(screen.getByText("INTERNAL_ERROR").textContent).toBe("INTERNAL_ERROR");
    expect(screen.getByText("想定外のエラーが発生しました").textContent).toBe(
      "想定外のエラーが発生しました",
    );
  });

  it("NETWORK_ERROR（status: null）も code / message を表示できる", () => {
    const error = new NormalizedApiError(
      "NETWORK_ERROR",
      "サーバーに接続できませんでした。サーバーが起動しているか確認してください。",
      null,
    );
    render(<ErrorPanel error={error} onRetry={() => {}} />);

    expect(screen.getByText("NETWORK_ERROR")).toBeTruthy();
    expect(
      screen.getByText("サーバーに接続できませんでした。サーバーが起動しているか確認してください。"),
    ).toBeTruthy();
  });

  it("再試行ボタンのクリックで onRetry が 1 回発火する", () => {
    const error = new NormalizedApiError("SPEC_NOT_FOUND", "スペックが見つかりません", 404);
    const onRetry = vi.fn();
    render(<ErrorPanel error={error} onRetry={onRetry} />);

    expect(onRetry).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "再試行" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
