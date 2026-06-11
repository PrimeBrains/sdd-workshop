/**
 * JumpBackBar + jumpHistory 結合テスト
 * （tasks.md 5.4 完了条件 / Requirement 3.4 / design.md Integration Test #2
 * 「JumpBackBar の戻るで出自へ復帰」）。
 *
 * 完了条件: 2 回連続ジャンプ後に戻るを 2 回押すと、逆順で各出自（ドキュメント + アンカー位置）へ
 * 復帰する。RefChip による実ジャンプ（CrosslinkJumpProvider / useJump）と jumpHistory を
 * 実構造（単一 DocPage が `/specs/:feature/:document` を担いホストが mount され続ける）で結線して検証する。
 *
 * jsdom はスクロールを持たないため scrollIntoView を差し替え、どの要素へ呼ばれたか（= 着地位置）を
 * 記録する。各ステップで「ルート（pathname + hash）」と「scrollIntoView の対象アンカー」を厳密照合する。
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type JSX } from "react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeRef, TraceGraph } from "@contracts/trace";
import { CrosslinkJumpProvider } from "@/navigation/JumpContext";
import { JumpHistoryProvider } from "@/navigation/jumpHistory";
import { buildTraceIndex } from "@/trace/traceIndex";
import { TraceIndexProvider } from "@/trace/TraceIndexContext";
import { RefChip } from "@/features/crosslink/RefChip";
import { JumpBackBar } from "@/features/crosslink/JumpBackBar";

/** scrollIntoView は jsdom に無いため差し替え、着地要素を記録する */
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
 * フィクスチャ: 要件 1.2 ⇄ design "DesignX"。
 * - requirements の AC チップ（origin=req 1.2）→ design "DesignX" へジャンプ（3.1）
 * - design の参照チップ（origin=design "DesignX"、token=1.2）→ 要件 1.2 へジャンプ（3.2）
 * この 2 段で requirements → design → requirements の 2 連続ジャンプを構成する。
 */
const graph: TraceGraph = {
  feature: "demo",
  nodes: {
    requirements: [{ type: "requirement", id: "1.2" }],
    designElements: [{ type: "design", name: "DesignX" }],
    tasks: [],
  },
  edges: [
    {
      from: { type: "requirement", id: "1.2" },
      to: { type: "design", name: "DesignX" },
      source: "design-table",
      legacyExpanded: false,
    },
  ],
  diagnostics: [],
};
const index = buildTraceIndex(graph);

const REQ_ORIGIN: NodeRef = { type: "requirement", id: "1.2" };
const DESIGN_ORIGIN: NodeRef = { type: "design", name: "DesignX" };

/**
 * 単一 DocPage が `/specs/:feature/:document` を担い、ドキュメント切替を跨いでも
 * JumpHistory / CrosslinkJump ホストが mount され続ける実構造を再現する。
 * 各ドキュメントに対象アンカーを描画し、着地時のスクロールを観測できるようにする。
 */
function DocPage(): JSX.Element {
  const document = useParams().document;
  return (
    <JumpHistoryProvider>
      <CrosslinkJumpProvider>
        <TraceIndexProvider index={index}>
          <div>
            <JumpBackBar />
            {document === "requirements" && (
              <>
                {/* origin=要件 1.2 の AC チップ。対応先 design "DesignX" へジャンプ */}
                <RefChip token={{ kind: "id", id: "1.2", raw: "1.2" }} origin={REQ_ORIGIN} />
                <p id="req-1.2">要件 1.2 本文</p>
              </>
            )}
            {document === "design" && (
              <>
                <p id="design-designx">DesignX セクション</p>
                {/* origin=design "DesignX" の参照チップ。token=1.2 → 要件 1.2 へジャンプ */}
                <RefChip token={{ kind: "id", id: "1.2", raw: "1.2" }} origin={DESIGN_ORIGIN} />
              </>
            )}
          </div>
        </TraceIndexProvider>
      </CrosslinkJumpProvider>
    </JumpHistoryProvider>
  );
}

function renderApp(url = "/specs/demo/requirements") {
  const router = createMemoryRouter(
    [{ path: "/specs/:feature/:document", element: <DocPage /> }],
    { initialEntries: [url] },
  );
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router };
}

/** ポップオーバーから指定ラベルの対応先を選んでジャンプする */
function selectCounterpart(label: string): void {
  fireEvent.click(screen.getByTestId("ref-chip"));
  const item = screen.getAllByTestId("counterpart-item").find((i) => i.textContent === label);
  expect(item).toBeDefined();
  fireEvent.click(item as HTMLElement);
}

describe("完了条件: 2 連続ジャンプ → 戻る 2 回で逆順に各出自（ドキュメント + アンカー）へ復帰（3.4）", () => {
  it("requirements/req-1.2 → design → requirements を 2 連続ジャンプし、戻る 2 回で逆順復帰する", () => {
    const { router } = renderApp();

    // --- 前進ジャンプ 1: requirements(req-1.2) → design#design-designx ---
    selectCounterpart("DesignX");
    expect(router.state.location.pathname).toBe("/specs/demo/design");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#design-designx");
    expect(scrolledElements.at(-1)?.id).toBe("design-designx");

    // --- 前進ジャンプ 2: design(design-designx) → requirements#req-1.2 ---
    selectCounterpart("1.2");
    expect(router.state.location.pathname).toBe("/specs/demo/requirements");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#req-1.2");
    expect(scrolledElements.at(-1)?.id).toBe("req-1.2");

    // --- 戻る 1 回目: 直近の出自 = design(design-designx) へ復帰 ---
    fireEvent.click(screen.getByTestId("jump-back-button"));
    expect(router.state.location.pathname).toBe("/specs/demo/design");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#design-designx");
    expect(scrolledElements.at(-1)?.id).toBe("design-designx");

    // --- 戻る 2 回目: その前の出自 = requirements(req-1.2) へ復帰（逆順） ---
    fireEvent.click(screen.getByTestId("jump-back-button"));
    expect(router.state.location.pathname).toBe("/specs/demo/requirements");
    expect(decodeURIComponent(router.state.location.hash)).toBe("#req-1.2");
    expect(scrolledElements.at(-1)?.id).toBe("req-1.2");

    // 履歴が尽き、JumpBackBar は非表示に戻る（canGoBack=false → 3.4）
    expect(screen.queryByTestId("jump-back-bar")).toBeNull();
  });
});

describe("canGoBack による JumpBackBar の表示制御（3.4）", () => {
  it("初期（履歴空）は JumpBackBar が非表示", () => {
    renderApp();
    expect(screen.queryByTestId("jump-back-bar")).toBeNull();
  });

  it("1 回ジャンプすると JumpBackBar が表示され、出自ラベルと戻るボタンを持つ", () => {
    renderApp();
    selectCounterpart("DesignX");

    const bar = screen.getByTestId("jump-back-bar");
    // 出自ラベル: 戻り先ドキュメント + アンカー（requirements / req-1.2）
    expect(within(bar).getByTestId("jump-back-origin").textContent).toContain("requirements");
    expect(within(bar).getByTestId("jump-back-origin").textContent).toContain("req-1.2");
    // 戻るボタンを持つ
    expect(within(bar).getByTestId("jump-back-button")).toBeTruthy();
  });
});

describe("back() は履歴を再 push しない（無限スタック / back ループ防止 → 3.4）", () => {
  it("1 回ジャンプ → 1 回戻ると履歴が尽き、JumpBackBar は再表示されない", () => {
    renderApp();
    // 前進ジャンプ 1 回（履歴 depth 1）
    selectCounterpart("DesignX");
    expect(screen.getByTestId("jump-back-bar")).toBeTruthy();

    // 戻る 1 回 → depth 0。back() 自体は push しないので履歴は積み増されない
    fireEvent.click(screen.getByTestId("jump-back-button"));
    expect(screen.queryByTestId("jump-back-bar")).toBeNull();
  });
});
