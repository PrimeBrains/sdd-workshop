/**
 * ConnectionBanner（shared/ConnectionBanner.tsx, tasks.md 9.2）の単体テスト。
 *
 * design.md Error Handling「SSE 切断 → ConnectionBanner『再接続中』表示」、Requirements 7.3。
 * RTL auto-cleanup 無効のため afterEach(cleanup)。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConnectionBanner } from "@/shared/ConnectionBanner";

afterEach(cleanup);

describe("ConnectionBanner", () => {
  it("status=connected のときは何も描画しない", () => {
    const { container } = render(<ConnectionBanner status="connected" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("connection-banner")).toBeNull();
  });

  it("status=reconnecting のとき「再接続中…」を厳密値で表示する", () => {
    render(<ConnectionBanner status="reconnecting" />);
    const banner = screen.getByTestId("connection-banner");
    expect(banner.textContent).toBe("再接続中…");
    // role=status（live region）で支援技術にも切断を通知する
    expect(banner.getAttribute("role")).toBe("status");
  });

  it("書込操作の UI 要素（button）を持たない（8.1: 読み取り専用）", () => {
    render(<ConnectionBanner status="reconnecting" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
