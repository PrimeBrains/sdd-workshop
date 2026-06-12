/**
 * DesignView のテスト（tasks.md 4.2 / Requirements 2.3 /
 * design.md DesignView・Requirements Traceability 2.3）。
 *
 * フィクスチャは本スペック（sdd-review-ui）の design.md 実構造のミニチュア:
 * セクション見出しツリー（Overview → Goals / Architecture）+ Requirements Traceability
 * テーブル（`refs: RefToken[]` の各 kind: id / range(legacy) / cross-spec / unparsable）。
 *
 * - 完了条件: セクションツリーナビに全見出しタイトルが表示され、Traceability 行の
 *   参照 ID 群が行ごとに厳密値で描画される
 * - ナビクリックで該当セクションの `design-<slug>` 要素へ scrollIntoView する
 * - セクション見出しアンカー: 要素 id = `design-<slug>`（slug 正規化）
 * - 本文は DocBlockList で文書順に描画（raw 行も欠落しない）
 * - RefToken の各 kind が静的チップとして原文どおり描画される（5.3 まで非インタラクティブ）
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { type ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Position } from "@contracts/document";
import type { DesignDoc } from "@contracts/spec";
import { DesignView } from "@/features/viewer/DesignView";

afterEach(cleanup);

/**
 * RefChip（5.3）は react-router フックを使うため Router 配下で描画する。TraceIndexProvider は
 * 与えないため index=null で、参照チップは素のテキストへグレースフルに退避する
 * （ビューアの構造化描画テストは trace に依存しない）。
 */
function renderInRouter(ui: ReactElement) {
  return render(<MemoryRouter initialEntries={["/specs/demo/design"]}>{ui}</MemoryRouter>);
}

/** scrollIntoView が呼ばれた要素の記録（jsdom に実装が無いため差し替える） */
let scrolledElements: Element[];
beforeEach(() => {
  scrolledElements = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledElements.push(this);
  };
});

function pos(startLine: number, endLine: number, startOffset: number, endOffset: number): Position {
  return { startLine, endLine, startOffset, endOffset };
}

/** 本スペック design.md の実構造を縮約したフィクスチャ */
const fixtureDoc: DesignDoc = {
  sections: [
    {
      title: "Overview",
      depth: 2,
      position: pos(1, 20, 0, 400),
      children: [
        { title: "Goals", depth: 3, position: pos(5, 10, 80, 200), children: [] },
        { title: "Architecture Pattern & Boundary Map", depth: 3, position: pos(11, 20, 201, 400), children: [] },
      ],
    },
    {
      title: "Requirements Traceability",
      depth: 2,
      position: pos(21, 30, 401, 700),
      children: [],
    },
  ],
  traceability: [
    {
      kind: "structured",
      position: pos(23, 23, 420, 470),
      refs: [{ kind: "id", id: "1.1", raw: "1.1" }],
      summary: "スペック一覧表示",
      components: "SpecListPage",
      interfaces: "useSpecs",
      flows: "—",
    },
    {
      kind: "structured",
      position: pos(24, 24, 471, 540),
      refs: [
        { kind: "range", from: "3.1", to: "3.3", expanded: ["3.1", "3.2", "3.3"], legacy: true, raw: "3.1-3.3" },
        { kind: "cross-spec", feature: "sdd-core", id: "7.4", raw: "sdd-core/7.4" },
      ],
      summary: "相互リンクナビゲーション",
      components: "RefChip",
      interfaces: "coverOf",
      flows: "相互リンクジャンプ",
    },
    {
      kind: "structured",
      position: pos(25, 25, 541, 600),
      refs: [{ kind: "unparsable", raw: "1.1〜(全部)" }],
      summary: "情報無欠落",
      components: "DocBlockList",
      interfaces: "DocBlock union",
      flows: "—",
    },
    {
      kind: "raw",
      position: pos(26, 26, 601, 650),
      markdown: "壊れたトレーサビリティ行（セル数不一致）",
      reason: "セル数が一致しません",
    },
  ],
  componentRequirements: [
    { component: "SpecListPage", refs: [{ kind: "id", id: "1.1", raw: "1.1" }], position: pos(40, 40, 800, 830) },
  ],
  // 本文全文（情報無欠落）。見出しは sections と同じタイトルで、本文に design アンカーが払い出される
  content: [
    "## Overview",
    "",
    "概要本文。",
    "",
    "### Goals",
    "",
    "目標本文。",
    "",
    "### Architecture Pattern & Boundary Map",
    "",
    "アーキテクチャ本文。",
    "",
    "## Requirements Traceability",
    "",
    "（構造化ビューを参照）",
    "",
  ].join("\n"),
};

/** elements が DOM 上でこの順に並んでいることを検証する */
function expectDocumentOrder(elements: ReadonlyArray<Element>): void {
  elements.forEach((element, index) => {
    const next = elements[index + 1];
    if (next === undefined) return;
    expect(
      element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
      `要素 ${index} は要素 ${index + 1} より前に描画される`,
    ).toBeTruthy();
  });
}

describe("セクションツリーナビ（Requirement 2.3 / 完了条件）", () => {
  it("ナビにセクションツリーの全見出しタイトルが表示される", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    const nav = screen.getByTestId("design-section-nav");
    // 親・子・深いネストを含む全見出しタイトル（厳密値）
    expect(within(nav).getByText("Overview")).toBeTruthy();
    expect(within(nav).getByText("Goals")).toBeTruthy();
    expect(within(nav).getByText("Architecture Pattern & Boundary Map")).toBeTruthy();
    expect(within(nav).getByText("Requirements Traceability")).toBeTruthy();
  });

  it("ナビ項目クリックで該当セクションの design-<slug> 要素へ scrollIntoView する", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    const nav = screen.getByTestId("design-section-nav");
    const link = within(nav).getByText("Architecture Pattern & Boundary Map");
    link.click();
    expect(scrolledElements).toHaveLength(1);
    // design 名 slug: trim → 小文字 → 非英数を `-`
    expect(scrolledElements[0]?.id).toBe("design-architecture-pattern---boundary-map");
  });
});

describe("セクション見出しの design アンカー（slug 正規化）", () => {
  it("既知のセクション名に対し要素 id = design-<slug> を払い出す", () => {
    const { container } = renderInRouter(<DesignView doc={fixtureDoc} />);
    expect(container.querySelector('[id="design-overview"]')).not.toBeNull();
    expect(container.querySelector('[id="design-goals"]')).not.toBeNull();
    expect(container.querySelector('[id="design-requirements-traceability"]')).not.toBeNull();
    // 記号・空白入り名称の slug 正規化（厳密値）
    expect(container.querySelector('[id="design-architecture-pattern---boundary-map"]')).not.toBeNull();
  });
});

describe("Requirements Traceability テーブル（Requirement 2.3 / 完了条件）", () => {
  it("構造化テーブル（table 要素）として描画される", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("各行の参照 ID 群が行ごとに厳密値で描画される（refs: RefToken[]）", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    const rows = screen.getAllByTestId("traceability-row");
    expect(rows).toHaveLength(3); // structured 行のみ（raw 行は別経路）

    // 行 1: id チップ + summary / components / interfaces / flows
    const row1 = within(rows[0] as HTMLElement);
    const chips1 = row1.getAllByTestId("ref-chip");
    expect(chips1.map((c) => c.textContent)).toEqual(["1.1"]);
    expect(rows[0]?.textContent).toContain("スペック一覧表示");
    expect(rows[0]?.textContent).toContain("SpecListPage");
    expect(rows[0]?.textContent).toContain("useSpecs");

    // 行 2: range(legacy) は展開 ID（3.1 / 3.2 / 3.3）+ cross-spec（原文）。
    // RefChip（5.3）で range は展開 ID チップ + legacy バッジに変わる。
    const row2 = within(rows[1] as HTMLElement);
    const chips2 = row2.getAllByTestId("ref-chip");
    expect(chips2.map((c) => c.textContent)).toEqual(["3.1", "3.2", "3.3", "sdd-core/7.4"]);
    // legacy バッジが付く
    expect(row2.getByTestId("ref-chip-legacy-badge").textContent).toBe("legacy");

    // 行 3: unparsable（raw テキストそのまま）
    const row3 = within(rows[2] as HTMLElement);
    const chips3 = row3.getAllByTestId("ref-chip");
    expect(chips3.map((c) => c.textContent)).toEqual(["1.1〜(全部)"]);
  });
});

describe("RefToken kind の RefChip 描画（5.3）", () => {
  it("id / range（展開）/ cross-spec / unparsable が原文どおりのテキストで描画される", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    const chips = screen.getAllByTestId("ref-chip");
    const texts = chips.map((c) => c.textContent);
    expect(texts).toContain("1.1");
    // range は展開 ID で表示（5.3）
    expect(texts).toContain("3.1");
    expect(texts).toContain("3.3");
    expect(texts).toContain("sdd-core/7.4");
    expect(texts).toContain("1.1〜(全部)");
  });

  it("cross-spec / unparsable のチップ種別が data-ref-kind で識別できる", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    const chips = screen.getAllByTestId("ref-chip");
    const crossSpec = chips.find((c) => c.getAttribute("data-ref-kind") === "cross-spec");
    const unparsable = chips.find((c) => c.getAttribute("data-ref-kind") === "unparsable");
    expect(crossSpec?.textContent).toBe("sdd-core/7.4");
    expect(unparsable?.textContent).toBe("1.1〜(全部)");
  });
});

describe("本文全文描画（情報無欠落、postmortem #0004）", () => {
  it("raw トレーサビリティ行も欠落させず全文描画する", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    expect(screen.getByText("壊れたトレーサビリティ行（セル数不一致）")).toBeTruthy();
  });

  it("design.md 本文（プローズ）を全文描画する（見出しだけにならない）", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    expect(screen.getByTestId("design-body")).toBeTruthy();
    expect(screen.getByText("概要本文。")).toBeTruthy();
    expect(screen.getByText("アーキテクチャ本文。")).toBeTruthy();
  });

  it("本文見出しに design-<slug> アンカーと data-node-* を払い出す（compare/jump 互換）", () => {
    const { container } = renderInRouter(<DesignView doc={fixtureDoc} />);
    const overview = container.querySelector('[id="design-overview"]');
    expect(overview).not.toBeNull();
    expect(overview?.getAttribute("data-node-type")).toBe("design");
    expect(overview?.getAttribute("data-node-name")).toBe("Overview");
  });

  it("本文見出し → Traceability テーブルが文書順で描画される（8.1）", () => {
    renderInRouter(<DesignView doc={fixtureDoc} />);
    expectDocumentOrder([
      screen.getByRole("heading", { name: "Overview" }),
      screen.getByRole("heading", { name: "Goals" }),
      screen.getByRole("table"),
    ]);
  });
});
