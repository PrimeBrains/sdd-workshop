/**
 * AppSectionHeader の表示テスト（tasks.md 3.2 / Requirements 1.7, 1.8）。
 * app 名（null は「未分類」）とサマリーカウントを厳密値で検証する。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppSectionHeader } from "./AppSectionHeader";

afterEach(cleanup);

describe("AppSectionHeader（1.7, 1.8）", () => {
  it("app 名とサマリーカウントを厳密に表示する", () => {
    render(
      <AppSectionHeader
        app="sdd-dashboard"
        summary={{ specCount: 5, readyCount: 2, implementationCompleteCount: 1 }}
      />,
    );
    expect(screen.getByTestId("app-section-name").textContent).toBe("sdd-dashboard");
    expect(screen.getByTestId("app-section-spec-count").textContent).toBe("5");
    expect(screen.getByTestId("app-section-ready-count").textContent).toBe("2");
    expect(screen.getByTestId("app-section-impl-complete-count").textContent).toBe("1");
  });

  it("app=null のとき「未分類」ラベルを表示する（1.8）", () => {
    render(
      <AppSectionHeader
        app={null}
        summary={{ specCount: 3, readyCount: 0, implementationCompleteCount: 0 }}
      />,
    );
    expect(screen.getByTestId("app-section-name").textContent).toBe("未分類");
    expect(screen.getByTestId("app-section-spec-count").textContent).toBe("3");
    expect(screen.getByTestId("app-section-ready-count").textContent).toBe("0");
    expect(screen.getByTestId("app-section-impl-complete-count").textContent).toBe("0");
  });
});
