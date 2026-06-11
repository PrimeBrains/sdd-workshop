/**
 * useHashScrollRestore のテスト（tasks.md 3.2 / Requirement 3.9 /
 * design.md JumpNavigation「ルート読み込み時は URL ハッシュからフォーカス対象を復元してスクロール」）。
 *
 * jsdom は実スクロールを持たないため `Element.prototype.scrollIntoView` を
 * 差し替え、「どの要素に対して呼ばれたか」を記録して検証する。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type JSX } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useHashScrollRestore } from "@/navigation/useHashScrollRestore";

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
});

function Page({ ready }: { ready: boolean }): JSX.Element {
  useHashScrollRestore(ready);
  return (
    <div>
      <p id="anchor-target">対象要素</p>
      <p id="other">別の要素</p>
    </div>
  );
}

function renderAt(url: string, ready: boolean) {
  const router = createMemoryRouter([{ path: "/doc", element: <Page ready={ready} /> }], {
    initialEntries: [url],
  });
  return render(<RouterProvider router={router} />);
}

describe("useHashScrollRestore（Requirement 3.9: ディープリンクのフォーカス復元）", () => {
  it("ready=true かつ URL ハッシュがあるとき、該当 id の要素へ scrollIntoView する", () => {
    renderAt("/doc#anchor-target", true);
    expect(scrolledElements).toHaveLength(1);
    expect(scrolledElements[0]?.id).toBe("anchor-target");
  });

  it("URL エンコードされたハッシュ（例: req-1.2 を含むパーセントエンコード）をデコードして解決する", () => {
    renderAt(`/doc#${encodeURIComponent("anchor-target")}`, true);
    expect(scrolledElements).toHaveLength(1);
    expect(scrolledElements[0]?.id).toBe("anchor-target");
  });

  it("ready=false（データ未到着）の間はスクロールせず、ready=true への遷移後に 1 回だけスクロールする", () => {
    /** データ到着（ready: false → true）をテスト内ボタンで再現するハーネス */
    function TogglePage(): JSX.Element {
      const [ready, setReady] = useState(false);
      useHashScrollRestore(ready);
      return (
        <div>
          <p id="anchor-target">対象要素</p>
          <button type="button" onClick={() => setReady(true)}>
            ready にする
          </button>
        </div>
      );
    }
    const router = createMemoryRouter([{ path: "/doc", element: <TogglePage /> }], {
      initialEntries: ["/doc#anchor-target"],
    });
    render(<RouterProvider router={router} />);
    expect(scrolledElements).toHaveLength(0);

    const button = screen.getByRole("button", { name: "ready にする" });
    fireEvent.click(button);
    expect(scrolledElements).toHaveLength(1);
    expect(scrolledElements[0]?.id).toBe("anchor-target");

    // ready=true のままの再レンダーでは再スクロールしない
    fireEvent.click(button);
    expect(scrolledElements).toHaveLength(1);
  });

  it("ハッシュが無い URL ではスクロールしない", () => {
    renderAt("/doc", true);
    expect(scrolledElements).toHaveLength(0);
  });

  it("ハッシュに対応する要素が存在しない場合は何もしない（エラーにしない）", () => {
    renderAt("/doc#missing-anchor", true);
    expect(scrolledElements).toHaveLength(0);
  });
});
