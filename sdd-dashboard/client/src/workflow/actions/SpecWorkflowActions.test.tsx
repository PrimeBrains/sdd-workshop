/**
 * SpecWorkflowActions の結合テスト（tasks.md 4.1 / Requirements 2.1, 3.1, 9.2, 9.3）。
 *
 * ボタン可視条件を approvablePhase / approvals から導出する厳密検証:
 * - 全承認済みスペック → 承認ボタンなし・手戻りボタンあり（2.1, 3.1）
 * - 生成済み未承認フェーズ（先行は承認済み）を持つスペック → 承認・手戻り両方あり
 * - approvals:null の壊れたスペック → 承認・手戻りいずれもなし
 * - SpecActionSlot（Provider + registerWorkflow + Outlet）経由で /specs/:feature の
 *   ヘッダスロットにボタンが現れること（完了条件・9.2 を壊さない）
 *
 * 偽 pass 防止: 各ケースで「あるべきボタンの存在」と「あってはならないボタンの不在」を
 * 厳密に突き合わせる。データ空でも pass する緩いアサートは使わない。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  MemoryRouter,
  Outlet,
  RouterProvider,
} from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { SpecSummary, SpecApprovals } from "@contracts/spec";

import {
  SpecActionSlotOutlet,
  SpecActionSlotProvider,
  useSpecActionSlot,
} from "@/app/SpecActionSlot";
import { queryKeys } from "@/api/queryKeys";
import { registerWorkflow } from "@/workflow/integration";
import { SpecWorkflowActions } from "./SpecWorkflowActions";
import { useEffect, type JSX } from "react";

afterEach(cleanup);

const ALL_APPROVED: SpecApprovals = {
  requirements: { generated: true, approved: true },
  design: { generated: true, approved: true },
  tasks: { generated: true, approved: true },
};

// requirements 承認済み、design 生成済み・未承認、tasks 未生成。
const DESIGN_GENERATED: SpecApprovals = {
  requirements: { generated: true, approved: true },
  design: { generated: true, approved: false },
  tasks: { generated: false, approved: false },
};

function makeSpec(feature: string, approvals: SpecApprovals | null): SpecSummary {
  return {
    feature,
    app: "sdd-dashboard",
    phase: "design",
    language: "ja",
    approvals,
    readyForImplementation: approvals === ALL_APPROVED,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-11T00:00:00Z",
    artifacts: {
      brief: false,
      requirements: true,
      design: true,
      tasks: false,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    },
    diagnostics: [],
  };
}

function makeClient(specs: SpecSummary[]): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.specs, specs);
  return client;
}

/** SpecWorkflowActions を直接 feature 指定で描画する最小ラッパ。 */
function renderActions(feature: string, specs: SpecSummary[]) {
  return render(
    <QueryClientProvider client={makeClient(specs)}>
      <MemoryRouter>
        <SpecWorkflowActions feature={feature} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SpecWorkflowActions ボタン可視条件", () => {
  it("全承認済みスペック: 承認ボタンなし・手戻りボタンあり（2.1, 3.1）", () => {
    renderActions("all-approved", [makeSpec("all-approved", ALL_APPROVED)]);
    expect(screen.queryByRole("button", { name: "承認" })).toBeNull();
    expect(screen.getByRole("button", { name: "手戻り" })).toBeTruthy();
  });

  it("生成済み未承認フェーズを持つスペック: 承認・手戻り両方あり（2.1, 3.1）", () => {
    renderActions("design-gen", [makeSpec("design-gen", DESIGN_GENERATED)]);
    expect(screen.getByRole("button", { name: "承認" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "手戻り" })).toBeTruthy();
  });

  it("approvals:null の壊れたスペック: 承認・手戻りいずれもなし", () => {
    renderActions("broken", [makeSpec("broken", null)]);
    expect(screen.queryByRole("button", { name: "承認" })).toBeNull();
    expect(screen.queryByRole("button", { name: "手戻り" })).toBeNull();
  });

  it("specs キャッシュに該当 feature が無い場合は何も描画しない", () => {
    const { container } = renderActions("missing", [makeSpec("other", ALL_APPROVED)]);
    expect(screen.queryByRole("button", { name: "承認" })).toBeNull();
    expect(screen.queryByRole("button", { name: "手戻り" })).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("承認ボタンクリックで ConfirmDialog が開き、キャンセルで閉じる（書込なし）", async () => {
    renderActions("design-gen", [makeSpec("design-gen", DESIGN_GENERATED)]);

    fireEvent.click(screen.getByRole("button", { name: "承認" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    // 対象 feature / phase を表示する（feature 文字列と承認可能フェーズ "design" を厳密表示）
    expect(screen.getByText("design-gen")).toBeTruthy();
    expect(screen.getByText("design")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

/** AppShell 相当: Provider 配下で registerWorkflow を登録し、ヘッダスロットを描画する。 */
function SlotRegistrar(): null {
  const slot = useSpecActionSlot();
  useEffect(() => registerWorkflow(slot), [slot]);
  return null;
}

function ShellLayout(): JSX.Element {
  return (
    <SpecActionSlotProvider>
      <SlotRegistrar />
      <header>
        <SpecActionSlotOutlet />
      </header>
      <Outlet />
    </SpecActionSlotProvider>
  );
}

describe("SpecActionSlot 経由のヘッダスロット表示（完了条件・9.2）", () => {
  function renderShell(specs: SpecSummary[], feature: string) {
    const router = createMemoryRouter(
      [
        {
          element: <ShellLayout />,
          children: [
            { path: "/specs/:feature", element: <main>review screen</main> },
          ],
        },
      ],
      { initialEntries: [`/specs/${feature}`] },
    );
    return render(
      <QueryClientProvider client={makeClient(specs)}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  it("生成済み未承認フェーズのスペックのレビュー画面ヘッダに承認・手戻りボタンが出る", async () => {
    renderShell([makeSpec("design-gen", DESIGN_GENERATED)], "design-gen");
    const slot = await screen.findByTestId("spec-action-slot");
    expect(slot).toBeTruthy();
    expect(screen.getByRole("button", { name: "承認" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "手戻り" })).toBeTruthy();
    // 既存レビュー画面の内容は変わらず描画される（9.2）
    expect(screen.getByText("review screen")).toBeTruthy();
  });

  it("全承認済みスペックのヘッダには承認ボタンが出ない", async () => {
    renderShell([makeSpec("all-approved", ALL_APPROVED)], "all-approved");
    await screen.findByTestId("spec-action-slot");
    expect(screen.queryByRole("button", { name: "承認" })).toBeNull();
    expect(screen.getByRole("button", { name: "手戻り" })).toBeTruthy();
  });
});
