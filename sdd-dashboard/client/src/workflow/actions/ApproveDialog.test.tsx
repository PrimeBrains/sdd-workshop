/**
 * ApproveDialog の msw 結合テスト（tasks.md 4.2 / Requirements 2.2, 2.3, 2.4, 2.6）。
 *
 * 偽 pass 防止（testing-conventions.md）:
 * - 「キャンセル時に PUT が 0 件」を最初に確認し、確定経路を踏まないと PUT が出ないことを担保する
 * - 厳密値アサート: PUT 件数 / body / エラー code / message を具体値で突き合わせる
 *
 * SpecWorkflowActions を通して描画し、承認バッジ（承認ボタンの有無）が
 * キャッシュ更新で正しく変化する／変化しないことまで観測する。
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SpecApprovals, SpecSummary } from "@contracts/spec";

import { queryKeys } from "@/api/queryKeys";
import { createQueryClient } from "@/app/queryClient";
import { SpecWorkflowActions } from "./SpecWorkflowActions";

afterEach(cleanup);

// requirements 承認済み、design 生成済み・未承認、tasks 未生成 → approvablePhase = "design"。
const DESIGN_GENERATED: SpecApprovals = {
  requirements: { generated: true, approved: true },
  design: { generated: true, approved: false },
  tasks: { generated: false, approved: false },
};

// design 承認後の状態（approvablePhase = null、承認ボタンが消える）。
const DESIGN_APPROVED: SpecApprovals = {
  requirements: { generated: true, approved: true },
  design: { generated: true, approved: true },
  tasks: { generated: false, approved: false },
};

function makeSpec(feature: string, approvals: SpecApprovals): SpecSummary {
  return {
    feature,
    app: "sdd-dashboard",
    phase: "design",
    language: "ja",
    approvals,
    readyForImplementation: false,
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

const putRequests: { url: string; body: unknown }[] = [];
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  putRequests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

function renderActions(feature: string, spec: SpecSummary) {
  const client = createQueryClient();
  client.setQueryData(queryKeys.specs, [spec]);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SpecWorkflowActions feature={feature} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function openApproveDialog(feature: string, spec: SpecSummary) {
  renderActions(feature, spec);
  fireEvent.click(screen.getByRole("button", { name: "承認" }));
  return screen.getByRole("dialog");
}

describe("ApproveDialog キャンセル（2.3 / 9.3・偽 pass 防止）", () => {
  it("キャンセル時に PUT を 1 件も発行しない", async () => {
    server.use(
      http.put("/api/specs/:feature/approvals", async ({ request }) => {
        putRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(makeSpec("design-gen", DESIGN_APPROVED));
      }),
    );

    openApproveDialog("design-gen", makeSpec("design-gen", DESIGN_GENERATED));
    // 確認ステップで対象 feature / phase / ドキュメント名を表示する（2.2）
    expect(screen.getByText("design-gen")).toBeTruthy();
    expect(screen.getByText("design.md")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // 承認ボタンは依然 design を対象に表示される（状態不変）
    expect(screen.getByRole("button", { name: "承認" })).toBeTruthy();
    // PUT は 0 件
    expect(putRequests).toHaveLength(0);
  });
});

describe("ApproveDialog 確定（2.2 / 2.4）", () => {
  it("確定で PUT を 1 件発行し、承認状態を反映する（承認ボタンが消える）", async () => {
    const approved = makeSpec("design-gen", DESIGN_APPROVED);
    server.use(
      http.put("/api/specs/:feature/approvals", async ({ request }) => {
        putRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(approved);
      }),
      http.get("/api/specs", () => HttpResponse.json([approved])),
      http.get("/api/specs/:feature", () =>
        HttpResponse.json({
          summary: approved,
          brief: null,
          requirements: { requirements: [], otherBlocks: [] },
          design: { sections: [], traceability: [], componentRequirements: [] },
          tasks: { tasks: [], otherBlocks: [] },
          research: null,
          validations: [],
        }),
      ),
      http.get("/api/specs/:feature/trace", ({ params }) =>
        HttpResponse.json({
          feature: String(params.feature),
          nodes: { requirements: [], designElements: [], tasks: [] },
          edges: [],
          diagnostics: [],
        }),
      ),
    );

    openApproveDialog("design-gen", makeSpec("design-gen", DESIGN_GENERATED));

    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    // 成功確認表示が出る（4.4 で次コマンド案内に拡張されるプレースホルダ）
    await screen.findByText("承認しました");

    // PUT は厳密に 1 件、body は { phase: "design", approved: true }
    expect(putRequests).toHaveLength(1);
    expect(putRequests[0]?.url).toBe("/api/specs/design-gen/approvals");
    expect(putRequests[0]?.body).toEqual({ phase: "design", approved: true });

    // キャッシュ更新（invalidate→refetch）が反映されると approvablePhase = null となり、
    // 承認ボタンが消える（承認状態が UI に反映される・2.4）。成功表示も自然に解除される。
    await waitFor(() => expect(screen.queryByRole("button", { name: "承認" })).toBeNull());
    expect(screen.queryByText("承認しました")).toBeNull();
  });
});

describe("ApproveDialog 拒否（2.6）", () => {
  it("409 拒否でエラー code + message を厳密表示し、ダイアログを閉じず状態も不変", async () => {
    server.use(
      http.put("/api/specs/:feature/approvals", async ({ request }) => {
        putRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(
          {
            error: {
              code: "APPROVAL_ORDER_VIOLATION",
              message: "design を承認する前に requirements を承認してください。",
            },
          },
          { status: 409 },
        );
      }),
    );

    openApproveDialog("design-gen", makeSpec("design-gen", DESIGN_GENERATED));

    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    // 厳密値で code / message を表示
    await screen.findByText("APPROVAL_ORDER_VIOLATION");
    expect(
      screen.getByText("design を承認する前に requirements を承認してください。"),
    ).toBeTruthy();

    // PUT は試行されたが 1 件のみ、ダイアログは開いたまま（再試行・キャンセル可能）
    expect(putRequests).toHaveLength(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
    // 成功表示は出ていない（承認済みとして表示しない）
    expect(screen.queryByText("承認しました")).toBeNull();
    // まだ確定ボタンが残る（再試行できる）
    expect(screen.getByRole("button", { name: "承認する" })).toBeTruthy();
  });

  it("422 拒否で fieldErrors も表示する", async () => {
    server.use(
      http.put("/api/specs/:feature/approvals", () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "入力が不正です。",
              fieldErrors: { phase: ["phase が不正です。"] },
            },
          },
          { status: 422 },
        ),
      ),
    );

    openApproveDialog("design-gen", makeSpec("design-gen", DESIGN_GENERATED));

    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    await screen.findByText("VALIDATION_ERROR");
    expect(screen.getByText("phase が不正です。")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
