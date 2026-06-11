/**
 * MarkdownDoc のユニットテスト（tasks.md 3.1 / Requirement 2.7）。
 * - brief / research 等の MarkdownContent（content + sections）を見出し・整形テキストとして全文描画する
 * - RawBlockView と同一の安全設定を共有する（raw HTML 不活性化・外部 URL 無効化）
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MarkdownContent } from "@contracts/document";
import { MarkdownDoc } from "@/markdown/MarkdownDoc";

afterEach(cleanup);

describe("MarkdownDoc", () => {
  it("セクション見出しと本文を整形済みテキストとして描画する（Requirement 2.7）", () => {
    const doc: MarkdownContent = {
      content: "# 概要\n\nプロジェクトの背景説明です。\n\n## 詳細\n\n- 項目一\n- 項目二",
      sections: [
        {
          title: "概要",
          depth: 1,
          position: { startLine: 1, endLine: 7, startOffset: 0, endOffset: 48 },
          children: [
            {
              title: "詳細",
              depth: 2,
              position: { startLine: 5, endLine: 7, startOffset: 22, endOffset: 48 },
              children: [],
            },
          ],
        },
      ],
    };
    render(<MarkdownDoc doc={doc} />);

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("概要");
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.textContent).toBe("詳細");
    expect(screen.getByText("プロジェクトの背景説明です。")).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["項目一", "項目二"]);
  });

  it("GFM テーブルを table 要素として描画する（Requirement 2.7）", () => {
    const doc: MarkdownContent = {
      content: "| 項目 | 値 |\n| --- | --- |\n| 名称 | sdd-core |",
      sections: [],
    };
    const { container } = render(<MarkdownDoc doc={doc} />);

    expect(container.querySelector("table")).not.toBeNull();
    expect(screen.getByText("名称").tagName).toBe("TD");
    expect(screen.getByText("sdd-core").tagName).toBe("TD");
  });

  it("RawBlockView と同一の安全設定を共有する: raw HTML は不活性テキスト、外部画像は無効化（Requirement 2.6, 2.7）", () => {
    const doc: MarkdownContent = {
      content:
        '<script>alert(1)</script>\n\n![外部画像](http://evil.example/x.png)\n\n本文です。',
      sections: [],
    };
    const { container } = render(<MarkdownDoc doc={doc} />);

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(screen.getByAltText("外部画像").getAttribute("src")).toBeNull();
    expect(document.body.innerHTML).not.toContain("evil.example");
    expect(container.textContent).toContain("本文です。");
  });
});
