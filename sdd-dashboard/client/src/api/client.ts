/**
 * GET 限定 fetch ラッパ — sdd-core 読取契約の唯一の消費点
 * （design.md「ApiClient + QueryHooks」/ Requirement 1.5, 8.1）。
 *
 * - POST / PUT / DELETE は実装しない（書込能力の構造的排除、design.md 8.1）
 * - `fetch` の直接使用はこのファイルのみ許可（eslint.config.js の
 *   no-restricted-globals / no-restricted-properties で他ファイルは禁止）
 * - ベース URL は定義しない: パスを同一オリジン（`window.location.origin`）で
 *   解決するだけで、dev ではプロキシ先を vite.config.ts の 1 箇所が決める
 * - Postcondition: throw する `NormalizedApiError` の `code` / `message` は必ず非空
 *   （ErrorPanel が Requirement 1.5 を満たすための前提。非 JSON・形不一致ボディも合成する）
 */
import type { ApiError } from "@contracts/api";

/**
 * 正規化済み API エラー（design.md Service Interface）。
 * `code` は sdd-core ErrorCode、またはクライアント側合成コード
 * （`NETWORK_ERROR` = ネットワーク断 / `UNEXPECTED_RESPONSE` = 解釈不能応答）。
 */
export class NormalizedApiError extends Error {
  override readonly name = "NormalizedApiError";

  constructor(
    /** 機械可読コード（常に非空） */
    public readonly code: string,
    /** 人間可読メッセージ（常に非空） */
    message: string,
    /** HTTP ステータス。ネットワーク断は null */
    public readonly status: number | null,
    /** 422 時に sdd-core ApiError の error.fieldErrors から転記（本スペックでは未使用、sdd-workflow-ui 向け） */
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

/** sdd-core `ApiError` 形（`{ error: { code, message, fieldErrors? } }`）の構造ガード。code / message の非空まで検証する */
function isApiErrorBody(body: unknown): body is ApiError {
  if (typeof body !== "object" || body === null) return false;
  const errorField = (body as { error?: unknown }).error;
  if (typeof errorField !== "object" || errorField === null) return false;
  const { code, message } = errorField as { code?: unknown; message?: unknown };
  return (
    typeof code === "string" && code.length > 0 && typeof message === "string" && message.length > 0
  );
}

/** ApiError 形として解釈できない応答に合成するエラー（Postcondition: 非空 code / message） */
function unexpectedResponseError(status: number): NormalizedApiError {
  return new NormalizedApiError(
    "UNEXPECTED_RESPONSE",
    `サーバー応答を解釈できませんでした (HTTP ${status})`,
    status,
  );
}

/** Monitoring（design.md）: 計測基盤を持たないローカルツールの開発時手がかりとして warn 出力する */
function warnAndReturn(error: NormalizedApiError): NormalizedApiError {
  console.warn("[api] NormalizedApiError", {
    code: error.code,
    message: error.message,
    status: error.status,
  });
  return error;
}

/**
 * sdd-core 読取 API への GET。非 2xx・ネットワーク断・解釈不能応答は
 * `NormalizedApiError` を throw する。
 */
export async function get<T>(path: string): Promise<T> {
  let response: Response;
  try {
    // 同一オリジン解決のみ（ベース URL の定義ではない）。jsdom / ブラウザ双方で絶対 URL になる
    response = await fetch(new URL(path, window.location.origin), {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw warnAndReturn(
      new NormalizedApiError(
        "NETWORK_ERROR",
        "サーバーに接続できませんでした。サーバーが起動しているか確認してください。",
        null,
      ),
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // 非 JSON ボディ（成功・失敗を問わず契約違反）→ 合成コードで正規化
    throw warnAndReturn(unexpectedResponseError(response.status));
  }

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw warnAndReturn(
        new NormalizedApiError(
          body.error.code,
          body.error.message,
          response.status,
          body.error.fieldErrors,
        ),
      );
    }
    throw warnAndReturn(unexpectedResponseError(response.status));
  }

  return body as T;
}
