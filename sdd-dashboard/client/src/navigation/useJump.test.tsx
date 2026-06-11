/**
 * useJump のテスト（tasks.md 5.2 / Requirement 3.3 /
 * design.md JumpNavigation Service Interface・Testing Strategy 完了条件）。
 *
 * jsdom は実スクロールを持たないため `Element.prototype.scrollIntoView` を差し替え、
 * 「どの要素に対して呼ばれたか」を記録する。2 秒の一時ハイライト除去はフェイク
 * タイマーで検証する。
 *
 * 範囲（5.2）: `jumpTo` + `lastResolution`。`back` / `canGoBack` は jumpHistory（5.4）の
 * 責務でありここでは検証しない。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type JSX } from "react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HIGHLIGHT_CLASS } from "@/navigation/anchors";
import { useJump, type JumpTarget } from "@/navigation/useJump";

/** scrollIntoView が呼ばれた要素の記録（this 経由で捕捉する） */
let scrolledElements: Element[];

beforeEach(() => {
  scrolledElements = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledElements.push(this);
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** jumpTo を発火するボタンを持つテスト用ページ（同一ドキュメント内ジャンプ） */
function JumpPage({ target }: { target: JumpTarget }): JSX.Element {
  const { jumpTo, lastResolution } = useJump();
  return (
    <div>
      <p id="anchor-target">対象要素</p>
      <p id="other">別の要素</p>
      <button type="button" onClick={() => jumpTo(target)}>
        ジャンプ
      </button>
      <span data-testid="resolution">
        {lastResolution === null ? "none" : String(lastResolution.resolved)}
      </span>
    </div>
  );
}

function renderJumpPage(target: JumpTarget, url = "/specs/feat/design") {
  const router = createMemoryRouter(
    [{ path: "/specs/:feature/:document", element: <JumpPage target={target} /> }],
    { initialEntries: [url] },
  );
  return render(<RouterProvider router={router} />);
}

describe("useJump（Requirement 3.3: ジャンプ実行 + 一時ハイライト）", () => {
  it("同一ドキュメント内のアンカーへジャンプすると対象要素へ scrollIntoView しハイライトクラスを付与する", () => {
    renderJumpPage({ feature: "feat", document: "design", anchorId: "anchor-target" });
    fireEvent.click(screen.getByRole("button", { name: "ジャンプ" }));

    expect(scrolledElements).toHaveLength(1);
    const target = window.document.getElementById("anchor-target");
    expect(scrolledElements[0]).toBe(target);
    expect(target?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
    expect(screen.getByTestId("resolution").textContent).toBe("true");
  });

  it("2 秒後に一時ハイライトクラスが除去される（フェイクタイマー）", () => {
    vi.useFakeTimers();
    renderJumpPage({ feature: "feat", document: "design", anchorId: "anchor-target" });
    fireEvent.click(screen.getByRole("button", { name: "ジャンプ" }));

    const target = window.document.getElementById("anchor-target");
    expect(target?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(target?.classList.contains(HIGHLIGHT_CLASS)).toBe(false);
  });

  it("アンカー要素が存在しないとき throw せず lastResolution.resolved === false を返す", () => {
    renderJumpPage({ feature: "feat", document: "design", anchorId: "missing-anchor" });
    fireEvent.click(screen.getByRole("button", { name: "ジャンプ" }));

    // 黙ってトップへスクロールしない（フォールバックは呼び出し側 = RefChip 5.3 の責務）
    expect(scrolledElements).toHaveLength(0);
    expect(screen.getByTestId("resolution").textContent).toBe("false");
  });

  it("クロスドキュメントのジャンプはルート + ハッシュへ遷移し、遷移先で対象要素へスクロールする", () => {
    // 実アプリでは単一の SpecDocumentPage が `/specs/:feature/:document` を担い、document を
    // 跨いでも useJump ホストは mount され続ける。その構造を 1 つの DocPage で再現する。
    function DocPage(): JSX.Element {
      const { jumpTo } = useJump();
      const document = useParams().document;
      return (
        <div>
          {document === "design" && (
            <button
              type="button"
              onClick={() => jumpTo({ feature: "feat", document: "tasks", anchorId: "task-3.2" })}
            >
              tasks へジャンプ
            </button>
          )}
          {document === "tasks" && <p id="task-3.2">タスク 3.2</p>}
        </div>
      );
    }
    const router = createMemoryRouter(
      [{ path: "/specs/:feature/:document", element: <DocPage /> }],
      { initialEntries: ["/specs/feat/design"] },
    );
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("button", { name: "tasks へジャンプ" }));

    // 遷移先 tasks ページの対象要素へスクロールされる
    expect(scrolledElements).toHaveLength(1);
    expect(scrolledElements[0]?.id).toBe("task-3.2");
    // URL ハッシュにアンカーが符号化されている
    expect(router.state.location.pathname).toBe("/specs/feat/tasks");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#task-3.2");
  });
});
