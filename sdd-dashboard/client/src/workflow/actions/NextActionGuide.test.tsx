/**
 * NextActionGuide のユニットテスト（tasks.md 4.4 / Requirements 2.5, 3.5）。
 *
 * 厳密値アサート（testing-conventions.md）:
 * - 与えた command が厳密値で描画される
 * - コピー操作が navigator.clipboard.writeText に command の厳密値を渡す
 * - 閉じる操作で onClose が呼ばれる
 * - clipboard 未定義環境でもコピーがクラッシュしない
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NextActionGuide } from "./NextActionGuide";

afterEach(cleanup);

const COMMAND = "/kiro-spec-design sdd-workflow-ui";

function withClipboard(writeText: () => void, run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  try {
    run();
  } finally {
    if (original) {
      Object.defineProperty(navigator, "clipboard", original);
    } else {
      Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "clipboard");
    }
  }
}

describe("NextActionGuide", () => {
  it("与えた command を厳密値で描画する", () => {
    render(<NextActionGuide command={COMMAND} onClose={() => {}} ariaLabel="完了" />);
    expect(screen.getByTestId("next-command").textContent).toBe(COMMAND);
  });

  it("コピーで navigator.clipboard.writeText に command の厳密値を渡す", () => {
    const writeText = vi.fn();
    withClipboard(writeText, () => {
      render(<NextActionGuide command={COMMAND} onClose={() => {}} ariaLabel="完了" />);
      fireEvent.click(screen.getByRole("button", { name: "コピー" }));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(COMMAND);
  });

  it("閉じるで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(<NextActionGuide command={COMMAND} onClose={onClose} ariaLabel="完了" />);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("summary を渡すと描画する", () => {
    render(
      <NextActionGuide
        command={COMMAND}
        summary={<span>requirements を承認しました</span>}
        onClose={() => {}}
        ariaLabel="完了"
      />,
    );
    expect(screen.getByText("requirements を承認しました")).toBeTruthy();
  });

  it("clipboard 未定義環境でもコピーがクラッシュしない", () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    try {
      render(<NextActionGuide command={COMMAND} onClose={() => {}} ariaLabel="完了" />);
      expect(() =>
        fireEvent.click(screen.getByRole("button", { name: "コピー" })),
      ).not.toThrow();
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
    }
  });
});
