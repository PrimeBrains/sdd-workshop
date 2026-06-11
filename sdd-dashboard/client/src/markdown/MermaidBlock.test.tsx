/**
 * MermaidBlock のユニットテスト（tasks.md 3.3 / Requirements 2.8, 2.9 / design.md Unit #7）。
 * - 正常な mermaid フェンスが svg として描画され、注入先が MermaidBlock コンテナに限定されること（2.8）
 * - 構文エラー時に目に見える警告 + 生コード全文（厳密一致）へフォールバックし、黙って欠落させないこと（2.9）
 * - mermaid 以外のフェンスは通常のコードブロックのままで、MermaidBlock が起動しないこと
 * - mermaid.initialize が `securityLevel: 'strict'` でちょうど 1 回だけ呼ばれること（Security Considerations）
 * - MarkdownDoc 経路でも mermaid フェンスが MermaidBlock へディスパッチされること（safeMarkdownOptions 共有）
 *
 * jsdom は SVG 計測 API（getBBox 等）を欠くため、mermaid モジュールは vi.mock で決定的に
 * モックする（design.md Testing Strategy。実ブラウザ描画は E2E 10.1 で担保）。
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mermaid from "mermaid";
import { MarkdownDoc } from "@/markdown/MarkdownDoc";
import { RawBlockView } from "@/markdown/RawBlockView";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

const mockedRender = vi.mocked(mermaid.render);
const mockedInitialize = vi.mocked(mermaid.initialize);

const MOCK_SVG = '<svg aria-roledescription="flowchart-v2"><g><text>A</text></g></svg>';

beforeEach(() => {
  // initialize はモジュールレベルガード（ちょうど 1 回）の検証対象なのでリセットしない
  mockedRender.mockReset();
});

afterEach(cleanup);

describe("MermaidBlock", () => {
  it("正常な mermaid フェンスを svg として描画し、注入は MermaidBlock コンテナ内のみ・code フォールバックなし（Requirement 2.8）", async () => {
    mockedRender.mockResolvedValue({ svg: MOCK_SVG, diagramType: "flowchart-v2" });
    const code = "graph TD;\n  A-->B;";
    const { container } = render(<RawBlockView markdown={"```mermaid\n" + code + "\n```"} />);

    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });
    const svg = container.querySelector("svg");
    // 生成 SVG の注入先は MermaidBlock コンテナのみ（design.md Security Considerations）
    expect(svg?.closest('[data-testid="mermaid-block"]')).not.toBeNull();
    // 図として描画されたら code フォールバックは残らない
    expect(container.querySelector("code")).toBeNull();
    // mermaid.render にフェンス内のソース全文が渡される
    expect(mockedRender).toHaveBeenCalledWith(expect.any(String), code);
  });

  it("構文エラー時は目に見える警告 + 生コード全文（厳密一致）を表示し、svg を描画しない（Requirement 2.9）", async () => {
    mockedRender.mockRejectedValue(new Error("Parse error on line 2"));
    const code = "graph TD;\n  A--*B;;";
    const { container } = render(<RawBlockView markdown={"```mermaid\n" + code + "\n```"} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("mermaid の描画に失敗しました");
    expect(alert.textContent).toContain("Parse error on line 2");
    // 生コード全文の厳密一致（情報無欠落: 黙って欠落させない）
    const codeEl = alert.querySelector("pre code");
    expect(codeEl).not.toBeNull();
    expect(codeEl?.textContent).toBe(code);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("mermaid 以外のフェンス（ts）は通常のコードブロックのままで MermaidBlock を起動しない", () => {
    const { container } = render(
      <RawBlockView markdown={"```ts\nconst x: number = 1;\n```"} />,
    );

    const codeEl = container.querySelector("pre code");
    expect(codeEl).not.toBeNull();
    expect(codeEl?.textContent).toBe("const x: number = 1;\n");
    expect(container.querySelector('[data-testid="mermaid-block"]')).toBeNull();
    expect(mockedRender).not.toHaveBeenCalled();
  });

  it("mermaid.initialize は securityLevel: 'strict' でちょうど 1 回だけ呼ばれる（design.md Security Considerations）", async () => {
    mockedRender.mockResolvedValue({ svg: MOCK_SVG, diagramType: "flowchart-v2" });
    const { container } = render(
      <RawBlockView
        markdown={"```mermaid\ngraph TD;\n```\n\n```mermaid\ngraph LR;\n```"}
      />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll("svg")).toHaveLength(2);
    });
    // 複数ブロック・複数描画をまたいでも初期化はモジュールレベルで 1 回のみ
    expect(mockedInitialize).toHaveBeenCalledTimes(1);
    expect(mockedInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict", startOnLoad: false }),
    );
  });

  it("MarkdownDoc 経路でも mermaid フェンスを MermaidBlock へディスパッチする（safeMarkdownOptions 共有）", async () => {
    mockedRender.mockResolvedValue({ svg: MOCK_SVG, diagramType: "flowchart-v2" });
    const { container } = render(
      <MarkdownDoc
        doc={{ content: "# 設計図\n\n```mermaid\ngraph TD;\n  A-->B;\n```", sections: [] }}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull();
    });
    expect(
      container.querySelector("svg")?.closest('[data-testid="mermaid-block"]'),
    ).not.toBeNull();
  });
});
