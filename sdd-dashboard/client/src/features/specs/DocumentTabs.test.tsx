/**
 * DocumentTabs のテスト（tasks.md 2.2 / Requirements 1.2, 1.3 /
 * design.md File Structure Plan「成果物タブ（不在はディム表示）」）。
 *
 * 純粋な表示コンポーネントとしての単体検証:
 * - available な項目は遷移先への Link（href 厳密値）
 * - 不在項目は「未作成」付きの非リンクで、クリックしても遷移しない
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentTabs, type DocumentTabItem } from "@/features/specs/DocumentTabs";

afterEach(cleanup);

const items: readonly DocumentTabItem[] = [
  { key: "requirements", label: "requirements", available: true, to: "/specs/demo/requirements" },
  { key: "brief", label: "brief", available: false, to: "/specs/demo/brief" },
];

/** Link が要求するルーターコンテキスト付きで DocumentTabs を描画する */
function renderTabs() {
  const router = createMemoryRouter(
    [{ path: "/", element: <DocumentTabs label="成果物" items={items} /> }],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("DocumentTabs（Requirement 1.2 / 1.3）", () => {
  it("available 項目は to へのリンク、不在項目は aria-disabled な「未作成」非リンクになる", () => {
    renderTabs();

    const available = screen.getByTestId("doc-tab-requirements");
    expect(available.tagName).toBe("A");
    expect(available.getAttribute("data-state")).toBe("available");
    expect(available.getAttribute("href")).toBe("/specs/demo/requirements");
    expect(available.textContent).toBe("requirements");

    const missing = screen.getByTestId("doc-tab-brief");
    expect(missing.tagName).not.toBe("A");
    expect(missing.getAttribute("data-state")).toBe("missing");
    expect(missing.getAttribute("aria-disabled")).toBe("true");
    expect(missing.textContent).toContain("brief");
    expect(missing.textContent).toContain("未作成");
  });

  it("不在項目のクリックは URL を変えない（非エラー・非遷移）", () => {
    const router = renderTabs();

    fireEvent.click(screen.getByTestId("doc-tab-brief"));

    expect(router.state.location.pathname).toBe("/");
  });
});
