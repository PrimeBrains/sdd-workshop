/**
 * RollbackDialog の msw 結合テスト（tasks.md 4.3 / Requirements 3.1, 3.2, 3.3, 3.4, 3.6）。
 *
 * 偽 pass 防止（testing-conventions.md）:
 * - 「キャンセル時に POST が 0 件」を最初に確認し、確定経路を踏まないと POST が出ないことを担保する
 * - 厳密値アサート: POST 件数 / body / エラー code / message を具体値で突き合わせる
 *
 * 影響表示（3.2）は computeRollbackImpact の結果を実行前に可視化する。
 * SpecWorkflowActions を通して描画し、巻き戻しによる状態更新が UI に反映されることまで観測する。
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

// 全フェーズ生成済み・承認済み（ready）。requirements 巻き戻しで design / tasks の承認が解除される。
const ALL_APPROVED: SpecApprovals = {
  requirements: { generated: true, approved: true },
  design: { generated: true, approved: true },
  tasks: { generated: true, approved: true },
};

// requirements へ巻き戻した後のサーバー返却状態（後続クリア・ready=false）。
const AFTER_ROLLBACK: SpecApprovals = {
  requirements: { generated: true, approved: false },
  design: { generated: false, approved: false },
  tasks: { generated: false, approved: false },
};

function makeSpec(
  feature: string,
  approvals: SpecApprovals,
  readyForImplementation: boolean,
): SpecSummary {
  return {
    feature,
    app: "sdd-dashboard",
    phase: "tasks",
    language: "ja",
    approvals,
    readyForImplementation,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-11T00:00:00Z",
    artifacts: {
      brief: false,
      requirements: true,
      design: true,
      tasks: true,
      research: false,
      validationGap: false,
      validationDesign: false,
      validationImpl: false,
    },
    diagnostics: [],
  };
}

const postRequests: { url: string; body: unknown }[] = [];
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  postRequests.length = 0;
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

function openRollbackDialog(feature: string, spec: SpecSummary) {
  renderActions(feature, spec);
  fireEvent.click(screen.getByRole("button", { name: "手戻り" }));
  return screen.getByRole("dialog");
}

describe("RollbackDialog 影響表示（3.1 / 3.2）", () => {
  it("target=requirements 選択時に design / tasks の承認解除と実装準備解除を列挙する", () => {
    openRollbackDialog("all-approved", makeSpec("all-approved", ALL_APPROVED, true));

    // 巻き戻し先として requirements を選択（既定が requirements でない場合も確実に選択する）。
    fireEvent.click(screen.getByRole("radio", { name: "requirements" }));

    // 影響表示: design / tasks の承認解除が列挙される（3.2）。
    const revoked = screen.getByTestId("rollback-impact-revoked");
    expect(revoked.textContent).toContain("design");
    expect(revoked.textContent).toContain("tasks");

    // 実装準備解除が表示される（losesReady = true）。
    expect(screen.getByText("実装準備解除")).toBeTruthy();
  });
});

describe("RollbackDialog キャンセル（3.3・偽 pass 防止）", () => {
  it("キャンセル時に POST を 1 件も発行しない", async () => {
    server.use(
      http.post("/api/specs/:feature/rollback", async ({ request }) => {
        postRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(makeSpec("all-approved", AFTER_ROLLBACK, false));
      }),
    );

    openRollbackDialog("all-approved", makeSpec("all-approved", ALL_APPROVED, true));

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // 手戻りボタンは依然表示される（状態不変）。
    expect(screen.getByRole("button", { name: "手戻り" })).toBeTruthy();
    // POST は 0 件。
    expect(postRequests).toHaveLength(0);
  });
});

describe("RollbackDialog 確定（3.4）", () => {
  it("確定で POST を 1 件発行し、更新後の状態を反映する", async () => {
    const rolledBack = makeSpec("all-approved", AFTER_ROLLBACK, false);
    server.use(
      http.post("/api/specs/:feature/rollback", async ({ request }) => {
        postRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(rolledBack);
      }),
      http.get("/api/specs", () => HttpResponse.json([rolledBack])),
      http.get("/api/specs/:feature", () =>
        HttpResponse.json({
          summary: rolledBack,
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

    openRollbackDialog("all-approved", makeSpec("all-approved", ALL_APPROVED, true));

    fireEvent.click(screen.getByRole("radio", { name: "requirements" }));
    fireEvent.click(screen.getByRole("button", { name: "巻き戻す" }));

    // 成功確認表示が出る（4.4 で次コマンド案内に拡張されるプレースホルダ）。
    await screen.findByText("巻き戻しました");

    // POST は厳密に 1 件、body は { targetPhase: "requirements" }。
    expect(postRequests).toHaveLength(1);
    expect(postRequests[0]?.url).toBe("/api/specs/all-approved/rollback");
    expect(postRequests[0]?.body).toEqual({ targetPhase: "requirements" });

    // キャッシュ更新（invalidate→refetch）が反映されると requirements が未承認に戻り、
    // approvablePhase = requirements となって承認ボタンが現れる（状態更新の具体的観測）。
    await waitFor(() => expect(screen.queryByRole("button", { name: "承認" })).toBeTruthy());
  });
});

describe("RollbackDialog 次アクション案内（3.5 / 完了条件）", () => {
  it("requirements への手戻り成功後に /kiro-spec-requirements {feature} を厳密値で案内する", async () => {
    const rolledBack = makeSpec("sdd-workflow-ui", AFTER_ROLLBACK, false);
    server.use(
      http.post("/api/specs/:feature/rollback", async ({ request }) => {
        postRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(rolledBack);
      }),
      http.get("/api/specs", () => HttpResponse.json([rolledBack])),
    );

    openRollbackDialog("sdd-workflow-ui", makeSpec("sdd-workflow-ui", ALL_APPROVED, true));

    fireEvent.click(screen.getByRole("radio", { name: "requirements" }));
    fireEvent.click(screen.getByRole("button", { name: "巻き戻す" }));

    // 成功見出し + 次コマンドの厳密値（3.5 完了条件）。
    await screen.findByText("巻き戻しました");
    const command = await screen.findByTestId("next-command");
    expect(command.textContent).toBe("/kiro-spec-requirements sdd-workflow-ui");

    // POST body は requirements への手戻りの厳密値。
    expect(postRequests).toHaveLength(1);
    expect(postRequests[0]?.body).toEqual({ targetPhase: "requirements" });
  });
});

describe("RollbackDialog 拒否（3.6）", () => {
  it("404 拒否でエラー code + message を厳密表示し、ダイアログを閉じず状態も不変", async () => {
    server.use(
      http.post("/api/specs/:feature/rollback", async ({ request }) => {
        postRequests.push({ url: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(
          {
            error: {
              code: "SPEC_NOT_FOUND",
              message: "スペックが見つかりませんでした。",
            },
          },
          { status: 404 },
        );
      }),
    );

    openRollbackDialog("all-approved", makeSpec("all-approved", ALL_APPROVED, true));

    fireEvent.click(screen.getByRole("radio", { name: "requirements" }));
    fireEvent.click(screen.getByRole("button", { name: "巻き戻す" }));

    // 厳密値で code / message を表示。
    await screen.findByText("SPEC_NOT_FOUND");
    expect(screen.getByText("スペックが見つかりませんでした。")).toBeTruthy();

    // POST は試行されたが 1 件のみ、ダイアログは開いたまま（再試行・キャンセル可能）。
    expect(postRequests).toHaveLength(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
    // 成功表示は出ていない（巻き戻し済みとして表示しない）。
    expect(screen.queryByText("巻き戻しました")).toBeNull();
    // 確定ボタンが残る（再試行できる）。
    expect(screen.getByRole("button", { name: "巻き戻す" })).toBeTruthy();
  });

  it("422 拒否で fieldErrors も表示する", async () => {
    server.use(
      http.post("/api/specs/:feature/rollback", () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "入力が不正です。",
              fieldErrors: { targetPhase: ["targetPhase が不正です。"] },
            },
          },
          { status: 422 },
        ),
      ),
    );

    openRollbackDialog("all-approved", makeSpec("all-approved", ALL_APPROVED, true));

    fireEvent.click(screen.getByRole("radio", { name: "requirements" }));
    fireEvent.click(screen.getByRole("button", { name: "巻き戻す" }));

    await screen.findByText("VALIDATION_FAILED");
    expect(screen.getByText("targetPhase が不正です。")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
