/**
 * AdrStatusBadge テスト（tasks.md 6.3 / requirements 7.1 /
 * design.md「Feature: knowledge → AdrStatusBadge」）。
 *
 * - proposed / accepted / deprecated / superseded の各 status が、status テキストをそのまま表示し、
 *   それぞれ固有のスタイル（className）を持つことを厳密に検証する。
 * - 未知 status は中立フォールバックスタイルで、なお status テキストを表示する（情報を落とさない）。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdrStatusBadge } from "./AdrStatusBadge";

afterEach(cleanup);

const KNOWN_STATUSES = ["proposed", "accepted", "deprecated", "superseded"] as const;

describe("AdrStatusBadge（Requirement 7.1: status バッジ色分け）", () => {
  it("既知 4 status はそれぞれ status テキストをそのまま表示する", () => {
    for (const status of KNOWN_STATUSES) {
      cleanup();
      render(<AdrStatusBadge status={status} />);
      const badge = screen.getByTestId("adr-status-badge");
      expect(badge.textContent).toBe(status);
      expect(badge.getAttribute("data-status")).toBe(status);
    }
  });

  it("既知 4 status は互いに異なる（distinct な）スタイルを持つ", () => {
    const classNames = KNOWN_STATUSES.map((status) => {
      cleanup();
      render(<AdrStatusBadge status={status} />);
      const className = screen.getByTestId("adr-status-badge").className;
      return className;
    });
    // 4 status すべてのスタイルが相互に異なる（色分けされている）こと。
    expect(new Set(classNames).size).toBe(KNOWN_STATUSES.length);
  });

  it("未知 status は中立フォールバックでも status テキストをそのまま表示する", () => {
    render(<AdrStatusBadge status="mystery" />);
    const badge = screen.getByTestId("adr-status-badge");
    expect(badge.textContent).toBe("mystery");
    // 既知 4 status のいずれの専用スタイルとも一致しない中立スタイル。
    const knownClasses = KNOWN_STATUSES.map((status) => {
      cleanup();
      render(<AdrStatusBadge status={status} />);
      return screen.getByTestId("adr-status-badge").className;
    });
    cleanup();
    render(<AdrStatusBadge status="mystery" />);
    const fallbackClass = screen.getByTestId("adr-status-badge").className;
    expect(knownClasses).not.toContain(fallbackClass);
  });
});
