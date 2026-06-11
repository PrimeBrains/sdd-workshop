/**
 * TasksView のテスト（tasks.md 4.3 / Requirement 2.4 /
 * design.md TasksView・Requirements Traceability 2.4）。
 *
 * フィクスチャは本スペックの tasks.md 実構造のミニチュア:
 * メジャータスク（checked）配下にサブタスク（`(P)` / `*`（後送り）/ requirements チップ・
 * depends リンク・boundary・details bullet を持つ）を入れ子にした構造。
 *
 * - 完了条件: `(P)` バッジ・`*` バッジ・checked マーカーが該当タスクに厳密に描画され、
 *   3 種注記（requirements チップ / depends リンク / boundary テキスト）が該当タスクに
 *   厳密値で描画される
 * - 階層: サブタスクがメジャータスク配下に入れ子描画される
 * - アンカー: タスク要素 id = `task-<id>`（厳密値）
 * - depends リンクは `#task-<id>` を指す（対象アンカー互換）
 * - details bullet が描画される
 * - チェックボックスは読み取り専用（変更を起こすインタラクティブ要素を出さない、8.1）
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { type ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Position } from "@contracts/document";
import type { TasksDoc } from "@contracts/spec";
import { TasksView } from "@/features/viewer/TasksView";

afterEach(cleanup);

/**
 * RefChip（5.3）は react-router フックを使うため Router 配下で描画する。TraceIndexProvider は
 * 与えないため index=null で、参照チップは素のテキストへグレースフルに退避する
 * （ビューアの構造化描画テストは trace に依存しない）。
 */
function renderInRouter(ui: ReactElement) {
  return render(<MemoryRouter initialEntries={["/specs/demo/tasks"]}>{ui}</MemoryRouter>);
}

function pos(startLine: number, endLine: number, startOffset: number, endOffset: number): Position {
  return { startLine, endLine, startOffset, endOffset };
}

/** 本スペック tasks.md の実構造を縮約したフィクスチャ */
const fixtureDoc: TasksDoc = {
  tasks: [
    {
      id: "4",
      description: "構造化ビューアを実装する",
      checked: true,
      parallel: false,
      optional: false,
      details: ["ビューアの土台を整える"],
      requirements: [{ kind: "id", id: "2.1", raw: "2.1" }],
      depends: [],
      boundary: null,
      position: pos(20, 40, 400, 900),
      subtasks: [
        {
          id: "4.3",
          description: "tasks ビューアを実装する",
          checked: false,
          parallel: true,
          optional: false,
          details: ["TaskEntry 階層を描画する", "アンカー ID を払い出す"],
          requirements: [
            { kind: "id", id: "2.4", raw: "2.4" },
            { kind: "range", from: "3.1", to: "3.3", expanded: ["3.1", "3.2", "3.3"], legacy: true, raw: "3.1-3.3" },
          ],
          depends: ["4"],
          boundary: "TasksView",
          position: pos(28, 35, 560, 800),
          subtasks: [],
        },
        {
          id: "4.4",
          description: "後送りのビューア仕上げ",
          checked: false,
          parallel: false,
          optional: true,
          details: [],
          requirements: [],
          depends: ["4.3"],
          boundary: null,
          position: pos(36, 40, 801, 900),
          subtasks: [],
        },
      ],
    },
  ],
  otherBlocks: [
    {
      kind: "raw",
      position: pos(1, 2, 0, 59),
      markdown: "# Implementation Plan の序文",
      reason: "タスク外コンテンツ",
    },
  ],
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

/** id=`task-<id>` のアンカー要素（サブタスクを含むタスク全体）を取得する */
function taskEl(id: string): HTMLElement {
  const el = document.getElementById(`task-${id}`);
  expect(el, `task-${id} のアンカー要素が存在する`).not.toBeNull();
  return el as HTMLElement;
}

/**
 * タスク自身の行（サブタスクを除く固有内容）を取得する。マーカー・注記の「該当タスク
 * のみ」アサーションはネストしたサブタスクの内容を含めないこのスコープで行う。
 */
function taskRow(id: string): HTMLElement {
  const row = taskEl(id).querySelector<HTMLElement>(`[data-task-id="${id}"]`);
  expect(row, `task ${id} の task-row が存在する`).not.toBeNull();
  return row as HTMLElement;
}

describe("マーカー・注記の厳密描画（Requirement 2.4 / 完了条件）", () => {
  it("(P) バッジは parallel タスク（4.3）にのみ描画される", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    // 4.3 のみ (P)
    expect(within(taskRow("4.3")).getByTestId("task-parallel-badge")).toBeTruthy();
    // メジャー 4・後送り 4.4 には出ない（自身の行スコープで判定）
    expect(within(taskRow("4")).queryByTestId("task-parallel-badge")).toBeNull();
    expect(within(taskRow("4.4")).queryByTestId("task-parallel-badge")).toBeNull();
  });

  it("* バッジ（後送り）は optional タスク（4.4）にのみ描画される", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    expect(within(taskRow("4.4")).getByTestId("task-optional-badge")).toBeTruthy();
    expect(within(taskRow("4")).queryByTestId("task-optional-badge")).toBeNull();
    expect(within(taskRow("4.3")).queryByTestId("task-optional-badge")).toBeNull();
  });

  it("completion マーカーは checked タスク（4）のみ checked、未完タスクは unchecked で描画される", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    const major = within(taskRow("4")).getByTestId("task-checkbox");
    const sub = within(taskRow("4.3")).getByTestId("task-checkbox");
    expect(major.getAttribute("data-checked")).toBe("true");
    expect(sub.getAttribute("data-checked")).toBe("false");
  });

  it("requirements チップ・depends リンク・boundary テキストが該当タスク（4.3）に厳密値で描画される", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    const sub = within(taskRow("4.3"));
    // requirements チップ（RefChip 5.3）。range は展開 ID（3.1 / 3.2 / 3.3）+ legacy バッジ
    const chips = sub.getAllByTestId("ref-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["2.4", "3.1", "3.2", "3.3"]);
    expect(sub.getByTestId("ref-chip-legacy-badge").textContent).toBe("legacy");
    // depends リンク（タスクアンカーへ）
    const depLinks = sub.getAllByTestId("task-depends-link");
    expect(depLinks.map((l) => l.textContent)).toEqual(["4"]);
    // boundary テキスト
    expect(sub.getByTestId("task-boundary").textContent).toContain("TasksView");
  });

  it("空の注記はタスクに描画されない（4 の depends / boundary は無し）", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    const major = within(taskRow("4"));
    expect(major.queryByTestId("task-depends-link")).toBeNull();
    expect(major.queryByTestId("task-boundary")).toBeNull();
  });
});

describe("タスク階層（メジャー → サブタスクの入れ子）", () => {
  it("サブタスク（4.3 / 4.4）がメジャータスク（4）の要素配下に入れ子描画される", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    const major = taskEl("4");
    expect(major.contains(taskEl("4.3"))).toBe(true);
    expect(major.contains(taskEl("4.4"))).toBe(true);
    // 文書順（4 → 4.3 → 4.4）
    expectDocumentOrder([taskEl("4"), taskEl("4.3"), taskEl("4.4")]);
  });
});

describe("アンカー ID（task-<id>）", () => {
  it("各タスクに要素 id = task-<id> を払い出す（厳密値）", () => {
    const { container } = renderInRouter(<TasksView doc={fixtureDoc} />);
    expect(container.querySelector('[id="task-4"]')).not.toBeNull();
    expect(container.querySelector('[id="task-4.3"]')).not.toBeNull();
    expect(container.querySelector('[id="task-4.4"]')).not.toBeNull();
  });
});

describe("depends リンクのターゲット（#task-<id>）", () => {
  it("4.3 の depends リンクは #task-4（メジャー 4 のアンカー）を指す", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    const link = within(taskEl("4.3")).getByTestId("task-depends-link");
    expect(link.getAttribute("href")).toBe("#task-4");
  });

  it("4.4 の depends リンクは #task-4.3 を指す", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    const link = within(taskEl("4.4")).getByTestId("task-depends-link");
    expect(link.getAttribute("href")).toBe("#task-4.3");
  });
});

describe("details bullet", () => {
  it("各タスクの details bullet が描画される", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    expect(within(taskEl("4")).getByText("ビューアの土台を整える")).toBeTruthy();
    const sub = within(taskEl("4.3"));
    expect(sub.getByText("TaskEntry 階層を描画する")).toBeTruthy();
    expect(sub.getByText("アンカー ID を払い出す")).toBeTruthy();
  });
});

describe("チェックボックスは読み取り専用（Requirement 8.1）", () => {
  it("完了状態を変更するインタラクティブ要素（input / button）を出さない", () => {
    const { container } = renderInRouter(<TasksView doc={fixtureDoc} />);
    // checkbox 表示は input でも button でもない（変更不可・読み取り専用）
    container.querySelectorAll('[data-testid="task-checkbox"]').forEach((cb) => {
      expect(cb.tagName).not.toBe("INPUT");
      expect(cb.tagName).not.toBe("BUTTON");
    });
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });
});

describe("情報無欠落（Requirement 2.5 経路）", () => {
  it("otherBlocks の raw ブロックも文書順で全文描画する", () => {
    renderInRouter(<TasksView doc={fixtureDoc} />);
    // raw markdown は RawBlockView 経由で描画される（`#` は見出しとして整形される）
    expect(screen.getByRole("heading", { name: "Implementation Plan の序文" })).toBeTruthy();
  });
});
