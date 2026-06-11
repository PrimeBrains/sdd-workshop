/**
 * URL ナビゲーション状態とブラウザ履歴統合の結合テスト
 * （tasks.md 5.5 / Requirements 3.7, 3.8 / design.md AppShell + Router State Management
 *  「URL が唯一のビュー位置の真実」・JumpNavigation「jumpTo はブラウザ履歴 push で URL に反映」・
 *  Integration Test #2「AC フォーカス → design ジャンプ → ブラウザ戻りで AC のフォーカス + スクロール復元」）。
 *
 * 検証対象:
 * - 3.7: 画面・スペック・ドキュメント・フォーカス対象を URL（パス + ハッシュ）へ符号化し、
 *   `jumpTo` を含むすべての遷移をブラウザ履歴 push で行う（replace でない）。
 *   同一ドキュメント内ジャンプも URL ハッシュを更新し履歴へ push する（戻れるようにする）。
 * - 3.8: ブラウザの戻る / 進む（router.navigate(-1) / (1)）で、直前 / 直後のナビゲーション状態
 *   （フォーカス・スクロール対象を含む）が復元される。戻り先の URL ハッシュのフォーカス対象へ
 *   再スクロールされる。
 *
 * jsdom は実スクロールを持たないため `Element.prototype.scrollIntoView` を差し替え記録する。
 * react-router 7 の createMemoryRouter は履歴スタックを持ち、`router.navigate(-1)` で戻り、
 * `router.navigate(1)` で進める（ブラウザ戻る / 進むに相当）。これでフォーカス + スクロール復元を検証する。
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type JSX } from "react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useHashScrollRestore } from "@/navigation/useHashScrollRestore";
import { useJump } from "@/navigation/useJump";

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

/**
 * 単一の SpecDocumentPage が `/specs/:feature/:document` を担う実アプリ構造を再現する。
 * - document=requirements: AC `req-1.2` を持ち、そこから design へジャンプするボタンを置く
 * - document=design: design セクション `design-foo` を持つ
 * useHashScrollRestore（3.9 / 3.8 の hash 変化再スクロール）と useJump（5.2）を併存させる。
 */
function DocPage(): JSX.Element {
  const { jumpTo } = useJump();
  const { document } = useParams();
  // 本テストはデータ取得をモックしないため常に ready=true でフォーカス復元を有効化する
  useHashScrollRestore(true);
  return (
    <div>
      {document === "requirements" && (
        <>
          <p id="req-1.1">AC 1.1</p>
          <p id="req-1.2">AC 1.2</p>
          <button
            type="button"
            onClick={() => jumpTo({ feature: "foo", document: "design", anchorId: "design-foo" })}
          >
            design へジャンプ
          </button>
          <button
            type="button"
            onClick={() => jumpTo({ feature: "foo", document: "requirements", anchorId: "req-1.1" })}
          >
            同一文書内ジャンプ
          </button>
        </>
      )}
      {document === "design" && <p id="design-foo">design セクション foo</p>}
    </div>
  );
}

function makeRouter(initialEntries: string[]) {
  return createMemoryRouter([{ path: "/specs/:feature/:document", element: <DocPage /> }], {
    initialEntries,
  });
}

describe("URL ナビゲーション状態とブラウザ履歴統合（Requirements 3.7, 3.8）", () => {
  it("完了条件 A: AC フォーカス → design へジャンプ → ブラウザ戻りで元の AC のフォーカス + スクロール位置が復元される", async () => {
    // AC フォーカス付き URL を直接開く（3.9 ディープリンク）。req-1.2 へスクロール復元される。
    const router = makeRouter(["/specs/foo/requirements#req-1.2"]);
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(scrolledElements.some((el) => el.id === "req-1.2")).toBe(true);
    });
    scrolledElements = [];

    // design へジャンプ → URL が design ルート + ハッシュへ遷移し、履歴へ push される
    fireEvent.click(screen.getByRole("button", { name: "design へジャンプ" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/foo/design");
    });
    expect(decodeURIComponent(router.state.location.hash)).toBe("#design-foo");
    expect(scrolledElements.some((el) => el.id === "design-foo")).toBe(true);
    scrolledElements = [];

    // ブラウザ戻る（履歴 push されているので 1 つ前 = 元の AC へ戻る → 3.8）
    await router.navigate(-1);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/foo/requirements");
    });
    // URL が元の AC フォーカスへ復元される
    expect(decodeURIComponent(router.state.location.hash)).toBe("#req-1.2");
    // フォーカス + スクロール対象（req-1.2）が再スクロールされる（3.8）
    await waitFor(() => {
      expect(scrolledElements.some((el) => el.id === "req-1.2")).toBe(true);
    });
  });

  it("完了条件 B: ジャンプ後の URL を直接開くと同じフォーカス状態が再現される（3.9 ディープリンク）", async () => {
    // 完了条件 A のジャンプ後 URL（/specs/foo/design#design-foo）を直接オープン
    const router = makeRouter(["/specs/foo/design#design-foo"]);
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(scrolledElements.some((el) => el.id === "design-foo")).toBe(true);
    });
    expect(router.state.location.pathname).toBe("/specs/foo/design");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#design-foo");
  });

  it("3.7: jumpTo はブラウザ履歴へ push する（戻ると直前のナビゲーション状態が残っている）", async () => {
    const router = makeRouter(["/specs/foo/requirements#req-1.2"]);
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("button", { name: "design へジャンプ" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/foo/design");
    });

    // push（replace でない）なら戻ると直前の状態が復元される
    await router.navigate(-1);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/foo/requirements");
    });
    expect(decodeURIComponent(router.state.location.hash)).toBe("#req-1.2");

    // 進む（forward）で再び design へ戻れる（3.8 の進む方向）
    await router.navigate(1);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/specs/foo/design");
    });
    expect(decodeURIComponent(router.state.location.hash)).toBe("#design-foo");
  });

  it("3.7: 同一ドキュメント内ジャンプも URL ハッシュを更新し履歴へ push する（戻れる）", async () => {
    const router = makeRouter(["/specs/foo/requirements#req-1.2"]);
    render(<RouterProvider router={router} />);

    // 同一文書内（requirements 内）で req-1.1 へジャンプ
    fireEvent.click(screen.getByRole("button", { name: "同一文書内ジャンプ" }));
    await waitFor(() => {
      expect(decodeURIComponent(router.state.location.hash)).toBe("#req-1.1");
    });
    // パスは変わらず、フォーカス対象がスクロールされる
    expect(router.state.location.pathname).toBe("/specs/foo/requirements");
    expect(scrolledElements.some((el) => el.id === "req-1.1")).toBe(true);
    scrolledElements = [];

    // ブラウザ戻る → 同一文書内の直前のフォーカス（req-1.2）へ復元される（3.8）
    await router.navigate(-1);
    await waitFor(() => {
      expect(decodeURIComponent(router.state.location.hash)).toBe("#req-1.2");
    });
    await waitFor(() => {
      expect(scrolledElements.some((el) => el.id === "req-1.2")).toBe(true);
    });
  });
});
