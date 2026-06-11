/**
 * SpecActionSlot の契約テスト（tasks.md 1.3 / design.md「AppShell + Router + SpecActionSlot」Service Interface）。
 *
 * - `register(render)` は登録解除関数を返し、登録した render が
 *   `SpecActionContext { feature, document }` 付きで Outlet に描画される
 * - unregister すると描画から消える
 * - 何も登録されていなければ Outlet は空（review-ui 自身は登録しない → Requirement 8.1）
 * - `document` は DocumentKind（brief/requirements/design/tasks/research）以外なら null
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SpecActionSlotOutlet,
  SpecActionSlotProvider,
  useSpecActionSlot,
  type SpecActionSlotApi,
} from "@/app/SpecActionSlot";

let capturedApi: SpecActionSlotApi | null = null;

function CaptureApi() {
  capturedApi = useSpecActionSlot();
  return null;
}

/** AppShell と同じ構図（レイアウト側に Outlet を置き、子ルートの params を参照する）を最小再現する */
function renderSlot(initialEntry: string) {
  const routes: RouteObject[] = [
    {
      element: (
        <SpecActionSlotProvider>
          <CaptureApi />
          <SpecActionSlotOutlet />
        </SpecActionSlotProvider>
      ),
      children: [
        { path: "/specs", element: null },
        { path: "/specs/:feature", element: null },
        { path: "/specs/:feature/:document", element: null },
      ],
    },
  ];
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return render(<RouterProvider router={router} />);
}

function registerProbe(): () => void {
  if (capturedApi === null) throw new Error("SpecActionSlotApi が取得できていません");
  let unregister: () => void = () => {};
  act(() => {
    unregister = capturedApi!.register((ctx) => (
      <span data-testid="registered-action">
        {ctx.feature}:{ctx.document ?? "null"}
      </span>
    ));
  });
  return () => act(() => unregister());
}

beforeEach(() => {
  capturedApi = null;
});

afterEach(() => {
  cleanup();
});

describe("SpecActionSlot", () => {
  it("何も登録されていなければ Outlet は空である（本スペックは何も登録しない → 8.1）", () => {
    renderSlot("/specs/foo/requirements");
    const slot = screen.getByTestId("spec-action-slot");
    expect(slot.textContent).toBe("");
    expect(screen.queryByTestId("registered-action")).toBeNull();
  });

  it("register した render が ctx { feature, document } 付きで描画される", () => {
    renderSlot("/specs/foo/requirements");
    registerProbe();
    expect(screen.getByTestId("registered-action").textContent).toBe("foo:requirements");
  });

  it("概要画面（document セグメントなし）では ctx.document は null", () => {
    renderSlot("/specs/foo");
    registerProbe();
    expect(screen.getByTestId("registered-action").textContent).toBe("foo:null");
  });

  it("DocumentKind 以外の document セグメントは null に正規化される", () => {
    renderSlot("/specs/foo/unknown-doc");
    registerProbe();
    expect(screen.getByTestId("registered-action").textContent).toBe("foo:null");
  });

  it("register の戻り値（unregister）を呼ぶと描画から消える", () => {
    renderSlot("/specs/foo/design");
    const unregister = registerProbe();
    expect(screen.getByTestId("registered-action").textContent).toBe("foo:design");
    unregister();
    expect(screen.queryByTestId("registered-action")).toBeNull();
    expect(screen.getByTestId("spec-action-slot").textContent).toBe("");
  });

  it("feature を持たないルート（/specs 一覧）では Outlet は何も描画しない", () => {
    renderSlot("/specs");
    expect(screen.queryByTestId("spec-action-slot")).toBeNull();
  });
});
