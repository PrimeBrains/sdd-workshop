/**
 * DocBlockList のユニットテスト（tasks.md 3.1 / Requirement 2.5）。
 * - structured / raw 混在フィクスチャの描画テキスト連結（空白正規化後）が元文書全文と一致する
 *   （情報無欠落: design.md Invariant「blocks の全要素が DOM に描画される」）
 * - DocBlock union を入力順のままディスパッチする（並べ替え・スキップなし）
 * - raw ブロックは RawBlockView（reason ツールチップ付き）へディスパッチされる
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DocBlock, Position } from "@contracts/document";
import { DocBlockList } from "@/markdown/DocBlockList";

afterEach(cleanup);

interface TextPayload {
  text: string;
}

const structuredText1 = "構造化ブロック一の本文です。";
const rawMarkdown = "生フォールバック部分の本文です。";
const structuredText2 = "構造化ブロック二の本文です。";
const sourceDoc = `${structuredText1}\n\n${rawMarkdown}\n\n${structuredText2}`;

/** sourceDoc 内の部分文字列から Position を計算する（連結 = 全文の不変則を満たすフィクスチャ） */
function positionOf(text: string): Position {
  const startOffset = sourceDoc.indexOf(text);
  const before = sourceDoc.slice(0, startOffset);
  const startLine = before.split("\n").length;
  return {
    startLine,
    endLine: startLine + text.split("\n").length - 1,
    startOffset,
    endOffset: startOffset + text.length,
  };
}

const blocks: ReadonlyArray<DocBlock<TextPayload>> = [
  { kind: "structured", position: positionOf(structuredText1), text: structuredText1 },
  {
    kind: "raw",
    position: positionOf(rawMarkdown),
    markdown: rawMarkdown,
    reason: "構造化に失敗したためフォールバック",
  },
  { kind: "structured", position: positionOf(structuredText2), text: structuredText2 },
];

/** 空白正規化: ブロック要素間の改行・空白差を吸収して内容のみを比較する */
const normalize = (s: string): string => s.replace(/\s+/g, "");

describe("DocBlockList", () => {
  it("structured / raw 混在の描画テキスト連結（空白正規化後）が元文書全文と一致する（Requirement 2.5）", () => {
    const { container } = render(
      <DocBlockList blocks={blocks} renderStructured={(block) => <p>{block.text}</p>} />,
    );

    expect(normalize(container.textContent ?? "")).toBe(normalize(sourceDoc));
  });

  it("入力順のままディスパッチする: raw ブロックが structured の間の位置に保たれる（Requirement 2.5）", () => {
    const { container } = render(
      <DocBlockList blocks={blocks} renderStructured={(block) => <p>{block.text}</p>} />,
    );

    const text = container.textContent ?? "";
    const idx1 = text.indexOf(structuredText1);
    const idxRaw = text.indexOf(rawMarkdown);
    const idx2 = text.indexOf(structuredText2);
    expect(idx1).toBe(0);
    expect(idxRaw).toBeGreaterThan(idx1);
    expect(idx2).toBeGreaterThan(idxRaw);
  });

  it("raw ブロックを reason ツールチップ + 生表示ボーダー付きの RawBlockView へディスパッチする（Requirement 2.5, 2.6）", () => {
    render(
      <DocBlockList blocks={blocks} renderStructured={(block) => <p>{block.text}</p>} />,
    );

    const rawWrapper = screen.getByTitle("構造化に失敗したためフォールバック");
    expect(rawWrapper.className).toContain("border");
    expect(rawWrapper.textContent).toContain(rawMarkdown);
  });

  it("空の blocks では何も描画しない", () => {
    const { container } = render(
      <DocBlockList<TextPayload> blocks={[]} renderStructured={(block) => <p>{block.text}</p>} />,
    );

    expect(container.textContent).toBe("");
  });
});
