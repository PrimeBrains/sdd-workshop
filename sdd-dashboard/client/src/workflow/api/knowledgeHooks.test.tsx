/**
 * ナレッジ読取フックの結合テスト（tasks.md 1.3 / Requirement 9.6）。
 *
 * - 成功: msw のフィクスチャと data が厳密一致する（変換なしの薄ラッパであること）
 * - 失敗（9.6 中核）: 404 → RESOURCE_NOT_FOUND / status 404、500 → INTERNAL_ERROR / status 500 が
 *   NormalizedApiError として error に厳密値で入る
 * - ErrorPanel + 再試行（完了条件）: 1 回目失敗 → 2 回目成功 の msw 構成で、
 *   ErrorPanel が厳密な code を表示し、再試行ボタンクリックで refetch が発火して成功データが描画される
 *
 * 再試行の決定性のため、テスト用 QueryClient は retry: false（createQueryClient は retry: 1 のため不可）。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import type {
  AdrDoc,
  AdrSummary,
  SkillDoc,
  SkillSummary,
  SteeringDoc,
  SteeringDocSummary,
} from "@contracts/resources";
import { NormalizedApiError } from "@/api/client";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { useAdrDoc } from "./useAdrDoc";
import { useAdrList } from "./useAdrList";
import { useSkillDoc } from "./useSkillDoc";
import { useSkillList } from "./useSkillList";
import { useSteeringDoc } from "./useSteeringDoc";
import { useSteeringList } from "./useSteeringList";

// --- フィクスチャ（厳密一致の基準） ---
const steeringListFixture: SteeringDocSummary[] = [{ name: "tech", title: "Tech" }];
const steeringDocFixture: SteeringDoc = { name: "tech", content: "# Tech\n本文", sections: [] };
const skillListFixture: SkillSummary[] = [
  { name: "kiro-spec-design", hasEn: true, hasJa: true, origin: "cc-sdd" },
];
const skillDocFixture: SkillDoc = {
  name: "kiro-spec-design",
  en: { content: "# SKILL\nen body", sections: [] },
  ja: null,
  origin: "cc-sdd",
};
const adrListFixture: AdrSummary[] = [
  { name: "0001-x", frontmatter: null, diagnostics: [] },
];
const adrDocFixture: AdrDoc = {
  name: "0001-x",
  frontmatter: null,
  content: "# ADR",
  sections: [],
  diagnostics: [],
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** retry: false で失敗を即座に error へ surfacing する（createQueryClient は retry: 1） */
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("ナレッジ読取フック: 成功時は data がフィクスチャと厳密一致する（薄ラッパ）", () => {
  it("useSteeringList → GET /api/steering", async () => {
    server.use(http.get("/api/steering", () => HttpResponse.json(steeringListFixture)));
    const { result } = renderHook(() => useSteeringList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(steeringListFixture);
  });

  it("useSteeringDoc(name) → GET /api/steering/:name（encodeURIComponent）", async () => {
    server.use(
      http.get("/api/steering/:name", ({ params }) => {
        expect(params.name).toBe("tech");
        return HttpResponse.json(steeringDocFixture);
      }),
    );
    const { result } = renderHook(() => useSteeringDoc("tech"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(steeringDocFixture);
  });

  it("useSkillList → GET /api/skills", async () => {
    server.use(http.get("/api/skills", () => HttpResponse.json(skillListFixture)));
    const { result } = renderHook(() => useSkillList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(skillListFixture);
  });

  it("useSkillDoc(name) → GET /api/skills/:name", async () => {
    server.use(http.get("/api/skills/:name", () => HttpResponse.json(skillDocFixture)));
    const { result } = renderHook(() => useSkillDoc("kiro-spec-design"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(skillDocFixture);
  });

  it("useAdrList → GET /api/adr", async () => {
    server.use(http.get("/api/adr", () => HttpResponse.json(adrListFixture)));
    const { result } = renderHook(() => useAdrList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(adrListFixture);
  });

  it("useAdrDoc(id) → GET /api/adr/:id", async () => {
    server.use(http.get("/api/adr/:id", () => HttpResponse.json(adrDocFixture)));
    const { result } = renderHook(() => useAdrDoc("0001"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(adrDocFixture);
  });
});

describe("ナレッジ読取フック: 失敗時は NormalizedApiError が厳密値で透過する（9.6）", () => {
  it("404 → error は code=RESOURCE_NOT_FOUND / status=404", async () => {
    server.use(
      http.get("/api/steering/:name", () =>
        HttpResponse.json(
          { error: { code: "RESOURCE_NOT_FOUND", message: "steering missing が見つかりません" } },
          { status: 404 },
        ),
      ),
    );
    const { result } = renderHook(() => useSteeringDoc("missing"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(error).toBeInstanceOf(NormalizedApiError);
    expect(error?.code).toBe("RESOURCE_NOT_FOUND");
    expect(error?.status).toBe(404);
  });

  it("500 → error は code=INTERNAL_ERROR / status=500", async () => {
    server.use(
      http.get("/api/skills", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "想定外のエラーが発生しました" } },
          { status: 500 },
        ),
      ),
    );
    const { result } = renderHook(() => useSkillList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(error).toBeInstanceOf(NormalizedApiError);
    expect(error?.code).toBe("INTERNAL_ERROR");
    expect(error?.status).toBe(500);
  });
});

/** error 時に ErrorPanel を描画し、再試行で query.refetch を発火する最小ハーネス */
function AdrListHarness() {
  const query = useAdrList();
  if (query.isError && query.error) {
    return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.data) {
    return <div data-testid="adr-name">{query.data[0]?.name}</div>;
  }
  return <div data-testid="loading">loading</div>;
}

describe("ErrorPanel + 再試行（完了条件 9.6）", () => {
  it("1 回目失敗で ErrorPanel が厳密 code を表示し、再試行ボタンで refetch が発火して成功データが描画される", async () => {
    let call = 0;
    server.use(
      http.get("/api/adr", () => {
        call += 1;
        if (call === 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "想定外のエラーが発生しました" } },
            { status: 500 },
          );
        }
        return HttpResponse.json(adrListFixture);
      }),
    );

    render(<AdrListHarness />, { wrapper: makeWrapper() });

    // 1 回目: ErrorPanel が厳密 code を表示する
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("INTERNAL_ERROR");

    // 偽 pass 防止: 再試行を押すまでリクエストは 1 回のまま
    expect(call).toBe(1);

    // 再試行 → 2 回目は成功フィクスチャ
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(screen.getByTestId("adr-name").textContent).toBe("0001-x"));
    expect(call).toBe(2);
  });
});
