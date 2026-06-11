/**
 * RequirementsView のテスト（tasks.md 4.1 / Requirements 2.1, 2.2 /
 * design.md RequirementsView・Testing Strategy Unit #5）。
 *
 * フィクスチャは本スペック（sdd-review-ui）の requirements.md 実構造のミニチュア:
 * 文書タイトル（h1）→ Introduction（h2）→ 序文 raw → Boundary Context（h2 + 子見出し）→
 * Requirement カード（AC: 和訳なし 1.1 / 和訳あり 1.2 / raw 行）→ 末尾 raw。
 *
 * - 完了条件: AC `1.2` のカードに英文と和訳がペアで描画され、ID チップが表示される
 * - 和訳なし AC は英文のみ（空の和訳要素を出さない）
 * - 要件カード: ID・タイトル・objective の厳密値
 * - アンカー: 要件 `req-1` / AC `req-1.2`（design.md JumpNavigation 規約・3.2 と互換）
 * - otherBlocks + raw を文書順（startOffset 順）で描画し、SectionNode の子見出しも
 *   正しいレベルで描画する（情報無欠落、2.5 / 3.2 レビューの持ち越し）
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Position } from "@contracts/document";
import type { RequirementsDoc } from "@contracts/spec";
import { RequirementsView } from "@/features/viewer/RequirementsView";

afterEach(cleanup);

function pos(startLine: number, endLine: number, startOffset: number, endOffset: number): Position {
  return { startLine, endLine, startOffset, endOffset };
}

const AC_11_TEXT =
  "When the user opens the dashboard, the sdd-review-ui client shall display the list of all specs with each spec's feature name, phase, approval state, and artifact availability.";
const AC_12_TEXT =
  "When the user selects a spec, the sdd-review-ui client shall present that spec's existing artifacts (brief, requirements, design, tasks, research) and validation reports as selectable document views.";
const AC_12_JA =
  "ユーザーがスペックを選択したとき、sdd-review-ui クライアントはそのスペックに存在する成果物（brief・requirements・design・tasks・research）と validation レポートを、選択可能なドキュメントビューとして提示する。";
const OBJECTIVE_1 =
  "レビュアーとして、スペックの一覧から対象スペックと成果物を選んで開きたい。エディタでファイルを探し回らずにレビューを始めるため。";

/** 本スペック requirements.md の実構造を縮約したフィクスチャ */
const fixtureDoc: RequirementsDoc = {
  requirements: [
    {
      kind: "structured",
      position: pos(16, 26, 450, 1200),
      id: "1",
      title: "スペック一覧とドキュメント選択",
      objective: OBJECTIVE_1,
      criteria: [
        {
          kind: "structured",
          position: pos(20, 20, 600, 780),
          id: "1.1",
          text: AC_11_TEXT,
          translationJa: null,
        },
        {
          kind: "structured",
          position: pos(21, 22, 781, 1080),
          id: "1.2",
          text: AC_12_TEXT,
          translationJa: AC_12_JA,
        },
        {
          kind: "raw",
          position: pos(23, 24, 1081, 1180),
          markdown: "- 構造化できなかった受入基準の行",
          reason: "AC 番号が解釈できません",
        },
      ],
    },
  ],
  otherBlocks: [
    {
      kind: "structured",
      position: pos(1, 1, 0, 23),
      section: { title: "Requirements Document", depth: 1, position: pos(1, 1, 0, 23), children: [] },
    },
    {
      kind: "structured",
      position: pos(3, 3, 25, 41),
      section: { title: "Introduction", depth: 2, position: pos(3, 3, 25, 41), children: [] },
    },
    {
      kind: "raw",
      position: pos(5, 5, 43, 150),
      markdown: "sdd-review-ui は SDD Dashboard のレビュアー体験を担う画面群である。",
      reason: "要件構造の外側のコンテンツ",
    },
    {
      kind: "structured",
      position: pos(7, 12, 152, 440),
      section: {
        title: "Boundary Context",
        depth: 2,
        position: pos(7, 12, 152, 440),
        children: [
          {
            title: "Adjacent expectations",
            depth: 3,
            position: pos(10, 12, 300, 440),
            children: [],
          },
        ],
      },
    },
    {
      kind: "raw",
      position: pos(28, 28, 1210, 1280),
      markdown: "要件群の後ろに残った生コンテンツ",
      reason: "要件構造の外側のコンテンツ",
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

describe("AC の英文 + 和訳ペア表示（Requirement 2.2 / 完了条件）", () => {
  it("AC 1.2 の項目内に英文と和訳がペアで描画され、ID チップが表示される", () => {
    const { container } = render(<RequirementsView doc={fixtureDoc} />);

    const item = container.querySelector('[id="req-1.2"]');
    expect(item).not.toBeNull();
    if (item === null) throw new Error("AC 1.2 のアンカー要素がありません");

    // 英文と和訳が同一項目内にペアで描画される（厳密値）
    expect(within(item as HTMLElement).getByText(AC_12_TEXT)).toBeTruthy();
    expect(within(item as HTMLElement).getByText(AC_12_JA)).toBeTruthy();
    // ID チップ
    const chip = within(item as HTMLElement).getByTestId("ac-id-chip");
    expect(chip.textContent).toBe("1.2");
  });

  it("和訳なしの AC は英文のみ描画する（空の和訳要素を出さない）", () => {
    const { container } = render(<RequirementsView doc={fixtureDoc} />);

    const item = container.querySelector('[id="req-1.1"]');
    expect(item).not.toBeNull();
    if (item === null) throw new Error("AC 1.1 のアンカー要素がありません");

    expect(within(item as HTMLElement).getByText(AC_11_TEXT)).toBeTruthy();
    expect(within(item as HTMLElement).queryByTestId("ac-translation")).toBeNull();
  });

  it("構造化できなかった AC 行は raw のまま全文描画される（情報無欠落）", () => {
    render(<RequirementsView doc={fixtureDoc} />);
    expect(screen.getByText("構造化できなかった受入基準の行")).toBeTruthy();
  });
});

describe("要件カードの構造化描画（Requirement 2.1）", () => {
  it("要件カードに ID・タイトル・objective を厳密値で描画する", () => {
    render(<RequirementsView doc={fixtureDoc} />);
    expect(
      screen.getByRole("heading", { name: "Requirement 1: スペック一覧とドキュメント選択" }),
    ).toBeTruthy();
    expect(screen.getByText(OBJECTIVE_1)).toBeTruthy();
  });

  it("要件と各 AC にアンカー ID（req-<id>）を払い出す", () => {
    const { container } = render(<RequirementsView doc={fixtureDoc} />);
    expect(container.querySelector('[id="req-1"]')).not.toBeNull();
    expect(container.querySelector('[id="req-1.1"]')).not.toBeNull();
    expect(container.querySelector('[id="req-1.2"]')).not.toBeNull();
  });
});

describe("otherBlocks + raw の文書順描画（情報無欠落）", () => {
  it("構造化セクション見出し・raw・要件カードを startOffset の文書順で描画する", () => {
    render(<RequirementsView doc={fixtureDoc} />);
    expectDocumentOrder([
      screen.getByRole("heading", { name: "Requirements Document" }),
      screen.getByRole("heading", { name: "Introduction" }),
      screen.getByText("sdd-review-ui は SDD Dashboard のレビュアー体験を担う画面群である。"),
      screen.getByRole("heading", { name: "Boundary Context" }),
      screen.getByRole("heading", { name: "Requirement 1: スペック一覧とドキュメント選択" }),
      screen.getByText("要件群の後ろに残った生コンテンツ"),
    ]);
  });

  it("SectionNode の子見出しも正しい見出しレベルで描画する（3.2 レビュー持ち越し）", () => {
    render(<RequirementsView doc={fixtureDoc} />);
    expect(screen.getByRole("heading", { level: 1, name: "Requirements Document" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Boundary Context" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Adjacent expectations" })).toBeTruthy();
    // 親見出しの直後に子見出しが続く（文書順）
    expectDocumentOrder([
      screen.getByRole("heading", { name: "Boundary Context" }),
      screen.getByRole("heading", { name: "Adjacent expectations" }),
    ]);
  });
});
