import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/App";

describe("App", () => {
  it("ルートコンポーネントが見出し「SDD Review UI」を厳密値で描画する", () => {
    render(<App />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("SDD Review UI");
  });
});
