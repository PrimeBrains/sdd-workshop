/**
 * RefChip + CounterpartPopover のテスト（tasks.md 5.3 / Requirements 3.1, 3.2, 3.5, 3.6, 3.10 /
 * design.md「RefChip + CounterpartPopover」・相互リンクジャンプフロー・Integration Test #2/#3）。
 *
 * 完了条件:
 *  A. AC チップ → ポップオーバー → design 対応先選択で design ルートへ遷移しハイライトされる（3.1）
 *  B. broken-link チップはクリックしても遷移しない（リンク切れ表示 → 3.5）
 *  C. アンカー未解決の design 対応先選択でトレーサビリティ行へ遷移する（3.10、デッドクリックなし）
 * 追加:
 *  - cross-spec チップ → 対象スペックの requirements ルート + アンカーへ遷移（3.6）
 *  - unparsable チップ → 非リンク・raw そのまま・ポップオーバーなし
 *  - range（legacy）チップ → 展開 ID + legacy バッジ
 *
 * TraceIndex は実フィクスチャグラフから buildTraceIndex で構築し Provider で配布する。
 * ジャンプ・遷移は createMemoryRouter（実 useJump / useNavigate）で検証する。
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type JSX } from "react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeRef, TraceGraph } from "@contracts/trace";
import { HIGHLIGHT_CLASS } from "@/navigation/anchors";
import { CrosslinkJumpProvider } from "@/navigation/JumpContext";
import { buildTraceIndex } from "@/trace/traceIndex";
import { TraceIndexProvider } from "@/trace/TraceIndexContext";
import { RefChip, type RefChipProps } from "./RefChip";

/** scrollIntoView は jsdom に無いため差し替え、どの要素へ呼ばれたか記録する */
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

/**
 * フィクスチャグラフ:
 * - 要件 1.2 → design "DesignView"（design-table）+ task 4.3（task-annotation）
 * - 要件 9.9 → design "GhostElement"（実 DOM に存在しないアンカー → 3.10 フォールバック検証用）
 * - broken-link: 要件 5.5 の参照 "5.5" が origin=design "BrokenOrigin" で壊れている
 */
const graph: TraceGraph = {
  feature: "demo",
  nodes: {
    requirements: [
      { type: "requirement", id: "1.2" },
      { type: "requirement", id: "9.9" },
      { type: "requirement", id: "5.5" },
    ],
    designElements: [
      { type: "design", name: "DesignView" },
      { type: "design", name: "GhostElement" },
    ],
    tasks: [{ type: "task", id: "4.3" }],
  },
  edges: [
    {
      from: { type: "requirement", id: "1.2" },
      to: { type: "design", name: "DesignView" },
      source: "design-table",
      legacyExpanded: false,
    },
    {
      from: { type: "requirement", id: "1.2" },
      to: { type: "task", id: "4.3" },
      source: "task-annotation",
      legacyExpanded: false,
    },
    {
      from: { type: "requirement", id: "9.9" },
      to: { type: "design", name: "GhostElement" },
      source: "design-table",
      legacyExpanded: false,
    },
  ],
  diagnostics: [
    {
      kind: "broken-link",
      ref: "5.5",
      where: { type: "design", name: "BrokenOrigin" },
      position: { startLine: 10, endLine: 10, startOffset: 100, endOffset: 110 },
    },
  ],
};

const index = buildTraceIndex(graph);

/**
 * 単一 DocPage が `/specs/:feature/:document` を担い、document を跨いでも RefChip ホストが
 * mount され続ける実構造を再現する。各 document に対象アンカーを描画する。
 */
function renderRefChip(
  props: RefChipProps,
  { url = "/specs/demo/requirements", indexValue = index as ReturnType<typeof buildTraceIndex> | null } = {},
) {
  function DocPage(): JSX.Element {
    const document = useParams().document;
    // 実 SpecDocumentPage と同様、Provider 群はドキュメント切替（下の分岐の remount）を跨いで安定させる
    return (
      <CrosslinkJumpProvider>
        <TraceIndexProvider index={indexValue}>
          <div>
            {document === "requirements" && (
              <>
                <RefChip {...props} />
                <p id="req-1.2">要件 1.2 本文</p>
                <p id="req-5.5">要件 5.5 本文</p>
              </>
            )}
            {document === "design" && (
              <>
                <p id="design-designview">DesignView セクション</p>
                {/* GhostElement のアンカーはあえて描画しない（未解決 → 3.10 フォールバック） */}
                <span id="trace-row-9.9" data-testid="trace-row-target">
                  トレーサビリティ行 9.9
                </span>
              </>
            )}
            {document === "tasks" && <p id="task-4.3">タスク 4.3 本文</p>}
          </div>
        </TraceIndexProvider>
      </CrosslinkJumpProvider>
    );
  }
  const router = createMemoryRouter(
    [{ path: "/specs/:feature/:document", element: <DocPage /> }],
    { initialEntries: [url] },
  );
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router };
}

const REQ_12_ORIGIN: NodeRef = { type: "requirement", id: "1.2" };

describe("完了条件 A: AC チップ → ポップオーバー → design 対応先選択でジャンプ（3.1）", () => {
  it("AC チップをクリックすると design / task 対応先がポップオーバーに一覧される", () => {
    renderRefChip({ token: { kind: "id", id: "1.2", raw: "1.2" }, origin: REQ_12_ORIGIN });
    fireEvent.click(screen.getByTestId("ref-chip"));

    const popover = screen.getByTestId("counterpart-popover");
    const items = within(popover).getAllByTestId("counterpart-item");
    // design "DesignView" と task "4.3" が対応先として出る（coverOf）
    expect(items.map((i) => i.textContent)).toEqual(expect.arrayContaining(["DesignView", "4.3"]));
  });

  it("design 対応先を選ぶと design ルート + ハッシュへ遷移し対象がハイライトされる", () => {
    const { router } = renderRefChip({
      token: { kind: "id", id: "1.2", raw: "1.2" },
      origin: REQ_12_ORIGIN,
    });
    fireEvent.click(screen.getByTestId("ref-chip"));
    const designItem = screen
      .getAllByTestId("counterpart-item")
      .find((i) => i.textContent === "DesignView");
    expect(designItem).toBeDefined();
    fireEvent.click(designItem as HTMLElement);

    // design ルート + アンカーハッシュへ遷移
    expect(router.state.location.pathname).toBe("/specs/demo/design");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#design-designview");
    // 対象セクションへスクロール + ハイライト
    const target = window.document.getElementById("design-designview");
    expect(scrolledElements).toContain(target);
    expect(target?.classList.contains(HIGHLIGHT_CLASS)).toBe(true);
  });
});

describe("完了条件 B: broken-link チップはクリックしても遷移しない（3.5）", () => {
  it("broken-link 該当の参照はリンク切れスタイルで描画されポップオーバーを開かない", () => {
    // origin=design "BrokenOrigin"、参照 "5.5" が broken-link 診断に該当する
    const { router } = renderRefChip({
      token: { kind: "id", id: "5.5", raw: "5.5" },
      origin: { type: "design", name: "BrokenOrigin" },
    });
    const chip = screen.getByTestId("ref-chip");
    expect(chip.getAttribute("data-broken")).toBe("true");

    fireEvent.click(chip);
    // ポップオーバーは開かず、ナビゲーションも発生しない
    expect(screen.queryByTestId("counterpart-popover")).toBeNull();
    expect(router.state.location.pathname).toBe("/specs/demo/requirements");
    expect(router.state.location.hash).toBe("");
  });
});

describe("完了条件 C: アンカー未解決の design 対応先 → トレーサビリティ行へ（3.10）", () => {
  it("design アンカーが解決できないとき trace-row-<reqId> へフォールバック遷移する（デッドクリックなし）", () => {
    // 要件 9.9 → design "GhostElement"。design ルートに該当アンカーは描画しない（未解決）
    const { router } = renderRefChip({
      token: { kind: "id", id: "9.9", raw: "9.9" },
      origin: { type: "requirement", id: "9.9" },
    });
    fireEvent.click(screen.getByTestId("ref-chip"));
    const ghost = screen
      .getAllByTestId("counterpart-item")
      .find((i) => i.textContent === "GhostElement");
    expect(ghost).toBeDefined();
    fireEvent.click(ghost as HTMLElement);

    // design ルートのトレーサビリティ行アンカーへフォールバック（要件 9.9 の行）
    expect(router.state.location.pathname).toBe("/specs/demo/design");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#trace-row-9.9");
  });
});

describe("cross-spec チップ → 対象スペックの requirements ルート + アンカー（3.6）", () => {
  it("cross-spec チップをクリックすると他スペックの requirements#req-<id> へ遷移する", () => {
    const { router } = renderRefChip({
      token: { kind: "cross-spec", feature: "sdd-core", id: "7.4", raw: "sdd-core/7.4" },
      origin: REQ_12_ORIGIN,
    });
    const chip = screen.getByTestId("ref-chip");
    expect(chip.getAttribute("data-ref-kind")).toBe("cross-spec");
    fireEvent.click(chip);

    expect(router.state.location.pathname).toBe("/specs/sdd-core/requirements");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#req-7.4");
  });
});

describe("unparsable チップ → 非リンク・raw そのまま（ポップオーバーなし）", () => {
  it("unparsable は button でなく raw を表示し、クリックしてもポップオーバーを開かない", () => {
    renderRefChip({ token: { kind: "unparsable", raw: "1.1〜(全部)" }, origin: REQ_12_ORIGIN });
    const chip = screen.getByTestId("ref-chip");
    expect(chip.tagName).not.toBe("BUTTON");
    expect(chip.textContent).toBe("1.1〜(全部)");
    fireEvent.click(chip);
    expect(screen.queryByTestId("counterpart-popover")).toBeNull();
  });
});

describe("range（legacy）チップ → 展開 ID + legacy バッジ", () => {
  it("展開された各 ID が個別チップとして描画され legacy バッジが付く", () => {
    renderRefChip({
      token: {
        kind: "range",
        from: "1.2",
        to: "1.2",
        expanded: ["1.2"],
        legacy: true,
        raw: "1.2-1.2",
      },
      origin: REQ_12_ORIGIN,
    });
    // 展開された id チップ（1.2）
    const chips = screen.getAllByTestId("ref-chip");
    expect(chips.map((c) => c.textContent)).toContain("1.2");
    // legacy バッジ
    expect(screen.getByTestId("ref-chip-legacy-badge").textContent).toBe("legacy");
  });
});

describe("trace 未取得（index === null）: 素のテキストへグレースフル退避", () => {
  it("Provider が null のとき非インタラクティブな raw テキストチップを描画する", () => {
    renderRefChip(
      { token: { kind: "id", id: "1.2", raw: "1.2" }, origin: REQ_12_ORIGIN },
      { indexValue: null },
    );
    const chip = screen.getByTestId("ref-chip");
    expect(chip.tagName).not.toBe("BUTTON");
    expect(chip.textContent).toBe("1.2");
  });
});

/** ポップオーバーのアクセシビリティ（Esc で閉じる） */
describe("CounterpartPopover アクセシビリティ", () => {
  it("Esc キーでポップオーバーを閉じる", () => {
    renderRefChip({ token: { kind: "id", id: "1.2", raw: "1.2" }, origin: REQ_12_ORIGIN });
    fireEvent.click(screen.getByTestId("ref-chip"));
    expect(screen.getByTestId("counterpart-popover")).toBeTruthy();
    fireEvent.keyDown(window.document, { key: "Escape" });
    expect(screen.queryByTestId("counterpart-popover")).toBeNull();
  });
});
