/**
 * ApiClient（GET 限定 fetch ラッパ）のユニットテスト（tasks.md 1.2 / Requirement 1.5）。
 * - 非 2xx の sdd-core `ApiError` 形 → `NormalizedApiError`（code / message / status）正規化
 * - ネットワーク断 → `code: "NETWORK_ERROR"` / `status: null`
 * - 不正ボディ（非 JSON・形不一致・空文字）でも code / message が必ず非空
 *   （design.md Postconditions: ErrorPanel が 1.5 を満たすための前提）
 * - モジュールが GET 以外の書込メソッドを一切公開しない（design.md 8.1 構造的保証）
 */
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as clientModule from "@/api/client";
import { get, NormalizedApiError } from "@/api/client";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  // Monitoring（design.md）: NormalizedApiError は console.warn に出力される。
  // テスト出力を汚さないよう黙らせつつ、発火自体は検証する。
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function captureError(promise: Promise<unknown>): Promise<NormalizedApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(NormalizedApiError);
    return error as NormalizedApiError;
  }
  throw new Error("NormalizedApiError が throw されるべきところで resolve した");
}

describe("get<T>", () => {
  it("2xx の JSON ボディをそのまま返す（変換しない）", async () => {
    const body = { repoRoot: "/home/user/repo", name: "repo" };
    server.use(http.get("/api/repo", () => HttpResponse.json(body)));

    await expect(get<typeof body>("/api/repo")).resolves.toEqual(body);
  });

  it("500 + ApiError 形を code / message / status の厳密値で NormalizedApiError に正規化する", async () => {
    server.use(
      http.get("/api/specs", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "想定外のエラーが発生しました" } },
          { status: 500 },
        ),
      ),
    );

    const error = await captureError(get("/api/specs"));
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toBe("想定外のエラーが発生しました");
    expect(error.status).toBe(500);
    expect(error.fieldErrors).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it("404 + SPEC_NOT_FOUND を正規化する", async () => {
    server.use(
      http.get("/api/specs/missing", () =>
        HttpResponse.json(
          { error: { code: "SPEC_NOT_FOUND", message: "スペック missing が見つかりません" } },
          { status: 404 },
        ),
      ),
    );

    const error = await captureError(get("/api/specs/missing"));
    expect(error.code).toBe("SPEC_NOT_FOUND");
    expect(error.message).toBe("スペック missing が見つかりません");
    expect(error.status).toBe(404);
  });

  it("422 の error.fieldErrors をそのまま fieldErrors に引き継ぐ", async () => {
    const fieldErrors = { title: ["必須です"], requirements: ["形式が不正です", "重複しています"] };
    server.use(
      http.get("/api/specs", () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "入力検証に失敗しました", fieldErrors } },
          { status: 422 },
        ),
      ),
    );

    const error = await captureError(get("/api/specs"));
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual(fieldErrors);
  });

  it("ネットワーク断を code: NETWORK_ERROR / status: null に正規化し、message が非空である", async () => {
    server.use(http.get("/api/specs", () => HttpResponse.error()));

    const error = await captureError(get("/api/specs"));
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBeNull();
    expect(error.message).toBe(
      "サーバーに接続できませんでした。サーバーが起動しているか確認してください。",
    );
    expect(console.warn).toHaveBeenCalled();
  });

  it("非 JSON ボディの 500 でも code / message が非空に合成される", async () => {
    server.use(
      http.get("/api/specs", () =>
        new HttpResponse("<html>Internal Server Error</html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const error = await captureError(get("/api/specs"));
    expect(error.code).toBe("UNEXPECTED_RESPONSE");
    expect(error.message).toBe("サーバー応答を解釈できませんでした (HTTP 500)");
    expect(error.status).toBe(500);
  });

  it("ApiError 形でない JSON ボディ（error 欠落）でも code / message が非空に合成される", async () => {
    server.use(
      http.get("/api/specs", () => HttpResponse.json({ message: "wrong shape" }, { status: 500 })),
    );

    const error = await captureError(get("/api/specs"));
    expect(error.code).toBe("UNEXPECTED_RESPONSE");
    expect(error.message).toBe("サーバー応答を解釈できませんでした (HTTP 500)");
    expect(error.status).toBe(500);
  });

  it("code / message が空文字の ApiError 形でも非空の code / message に合成される", async () => {
    server.use(
      http.get("/api/specs", () =>
        HttpResponse.json({ error: { code: "", message: "" } }, { status: 500 }),
      ),
    );

    const error = await captureError(get("/api/specs"));
    expect(error.code).toBe("UNEXPECTED_RESPONSE");
    expect(error.message).toBe("サーバー応答を解釈できませんでした (HTTP 500)");
    expect(error.code.length).toBeGreaterThan(0);
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("2xx だが JSON として解釈できないボディも NormalizedApiError に正規化する", async () => {
    server.use(
      http.get("/api/specs", () =>
        new HttpResponse("not-json", { status: 200, headers: { "Content-Type": "text/plain" } }),
      ),
    );

    const error = await captureError(get("/api/specs"));
    expect(error.code).toBe("UNEXPECTED_RESPONSE");
    expect(error.message).toBe("サーバー応答を解釈できませんでした (HTTP 200)");
    expect(error.status).toBe(200);
  });
});

describe("書込能力の構造的排除（design.md 8.1）", () => {
  it("client モジュールの公開 API は get と NormalizedApiError のみで、post / put / delete を持たない", () => {
    expect(Object.keys(clientModule).sort()).toEqual(["NormalizedApiError", "get"]);
  });
});
