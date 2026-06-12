/**
 * RawBlockView のユニットテスト（tasks.md 3.1 / Requirements 2.5, 2.6, 2.7）。
 * - raw HTML（script / img タグ）が不活性テキストとして表示され、DOM に要素が生成されないこと（2.6）
 * - urlTransform が外部オリジン URL・危険スキームを無効化し、同一オリジン / 相対 / フラグメントを保持すること（2.6, 8.2）
 * - GFM テーブルが table 要素として描画されること（2.7）
 * - 生表示ボーダーと reason ツールチップ（title 属性）が付くこと（2.5, 2.6）
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RawBlockView } from "@/markdown/RawBlockView";

afterEach(cleanup);

describe("RawBlockView", () => {
  it("<script> と raw HTML の <img> を不活性テキストとして表示し、script / img 要素を DOM に生成しない（Requirement 2.6）", () => {
    const markdown =
      '<script>alert(1)</script>\n\n<img src="http://evil/x">\n\n通常の段落です。';
    const { container } = render(<RawBlockView markdown={markdown} />);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    // 不活性テキストとして全文が見える（情報無欠落: 2.5）
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.textContent).toContain('<img src="http://evil/x">');
    expect(container.textContent).toContain("通常の段落です。");
  });

  it("外部オリジンの画像 src / リンク href を無効化し、相対・フラグメント URL は保持する（Requirement 2.6, 8.2）", () => {
    const markdown = [
      "![外部画像](http://evil.example/x.png)",
      "[外部リンク](https://evil.example/page)",
      "[相対リンク](./design.md)",
      "[アンカー](#sec-1)",
    ].join("\n\n");
    render(<RawBlockView markdown={markdown} />);

    // 外部 URL は属性ごと除去される（DOM のどこにも外部 URL が残らない）
    expect(screen.getByAltText("外部画像").getAttribute("src")).toBeNull();
    expect(screen.getByText("外部リンク").getAttribute("href")).toBeNull();
    expect(document.body.innerHTML).not.toContain("evil.example");
    // 相対 / フラグメントはそのまま保持
    expect(screen.getByText("相対リンク").getAttribute("href")).toBe("./design.md");
    expect(screen.getByText("アンカー").getAttribute("href")).toBe("#sec-1");
  });

  it("同一オリジンの絶対 http(s) URL は保持する（Requirement 8.2）", () => {
    const sameOriginUrl = `${window.location.origin}/assets/local.png`;
    render(<RawBlockView markdown={`![ローカル画像](${sameOriginUrl})`} />);

    expect(screen.getByAltText("ローカル画像").getAttribute("src")).toBe(sameOriginUrl);
  });

  it("javascript: スキームのリンクを無効化する（Requirement 2.6）", () => {
    render(<RawBlockView markdown="[クリック](javascript:alert(1))" />);

    const link = screen.getByText("クリック");
    expect(link.getAttribute("href")).toBeNull();
    expect(document.body.innerHTML).not.toContain("javascript:");
  });

  it("GFM テーブルを table 要素として描画する（Requirement 2.7）", () => {
    const markdown = "| 列A | 列B |\n| --- | --- |\n| 値1 | 値2 |";
    const { container } = render(<RawBlockView markdown={markdown} />);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(screen.getByText("列A").tagName).toBe("TH");
    expect(screen.getByText("値1").tagName).toBe("TD");
    expect(screen.getByText("値2").tagName).toBe("TD");
  });

  it("severity=failure のとき警告ボーダーを表示し、reason を title ツールチップに付ける（postmortem #0004）", () => {
    render(
      <RawBlockView
        markdown="生表示の本文です。"
        reason="パース失敗: 不明なセクション"
        severity="failure"
      />,
    );

    const wrapper = screen.getByTitle("パース失敗: 不明なセクション");
    expect(wrapper.className).toContain("border");
    expect(wrapper.textContent).toContain("生表示の本文です。");
  });

  it("severity 省略（正常な非構造化コンテンツ）は警告ボーダーを付けず通常描画する（postmortem #0004）", () => {
    const { container } = render(<RawBlockView markdown="本文" />);

    const wrapper = container.firstElementChild;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className ?? "").not.toContain("border");
    expect(wrapper?.getAttribute("title")).toBeNull();
    expect(wrapper?.textContent).toContain("本文");
  });

  it("severity=gap も警告ボーダーを付けない（coverGaps の正常コンテンツ）", () => {
    const { container } = render(<RawBlockView markdown="見出し本文" severity="gap" />);

    const wrapper = container.firstElementChild;
    expect(wrapper?.className ?? "").not.toContain("border");
    expect(wrapper?.textContent).toContain("見出し本文");
  });
});
