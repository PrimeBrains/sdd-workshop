/**
 * 書込専用 fetch ラッパ — sdd-core 書込契約（approvals / rollback）の SPA 内唯一の消費点
 * （design.md「WriteClient + ApprovalMutation / RollbackMutation」/ Requirement 2.4, 3.4, 9.4）。
 *
 * - 公開するのは `updateApproval` / `rollback` の 2 メソッドのみ。汎用 `post` / `put` は
 *   export しない（書込能力の構造的排除 = 9.4 の保証）
 * - `fetch` の直接使用は `src/api/client.ts` に次ぐ SPA 内 2 つ目（最後）の許可ファイル
 *   （eslint.config.js の no-restricted-globals / no-restricted-properties の ignores に追加）
 * - 非 2xx は sdd-core `ApiError` 形をパースし、review-ui 所有の共有型 `NormalizedApiError`
 *   （`@/api/client`）へ正規化して throw する。同形の型は再宣言しない（design.md 508）
 * - ネットワーク断 = `NETWORK_ERROR`(status=null) / 解釈不能応答 = `UNEXPECTED_RESPONSE`。
 *   正規化の語彙・手順は review-ui `src/api/client.ts` の `get` と一致させる
 */
import type { ApiError } from "@contracts/api";
import type { PhaseName, SpecSummary } from "@contracts/spec";
import { NormalizedApiError } from "@/api/client";

/** sdd-core `ApiError` 形（`{ error: { code, message, fieldErrors? } }`）の構造ガード（client.ts と同等） */
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

/**
 * 書込リクエストの共通処理: 同一オリジン解決 → 送信 → 正規化。
 * 成功時は `SpecSummary` を解決し、失敗・断・解釈不能は `NormalizedApiError` を throw する。
 */
async function sendWrite(
  method: "PUT" | "POST",
  path: string,
  body: unknown,
): Promise<SpecSummary> {
  let response: Response;
  try {
    // 同一オリジン解決のみ（ベース URL の定義ではない）。client.ts と同じ方針
    response = await fetch(new URL(path, window.location.origin), {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new NormalizedApiError(
      "NETWORK_ERROR",
      "サーバーに接続できませんでした。サーバーが起動しているか確認してください。",
      null,
    );
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    // 非 JSON ボディ（成功・失敗を問わず契約違反）→ 合成コードで正規化
    throw unexpectedResponseError(response.status);
  }

  if (!response.ok) {
    if (isApiErrorBody(parsed)) {
      throw new NormalizedApiError(
        parsed.error.code,
        parsed.error.message,
        response.status,
        parsed.error.fieldErrors,
      );
    }
    throw unexpectedResponseError(response.status);
  }

  return parsed as SpecSummary;
}

/**
 * 承認フラグ更新（`PUT /api/specs/:feature/approvals`）。
 * Precondition: 承認は `approved: true` でのみ呼ぶ（承認解除 UI は提供しない、design.md 547）。
 */
export function updateApproval(
  feature: string,
  phase: PhaseName,
  approved: boolean,
): Promise<SpecSummary> {
  return sendWrite("PUT", `/api/specs/${encodeURIComponent(feature)}/approvals`, {
    phase,
    approved,
  });
}

/** フェーズ巻き戻し（`POST /api/specs/:feature/rollback`）。 */
export function rollback(feature: string, targetPhase: PhaseName): Promise<SpecSummary> {
  return sendWrite("POST", `/api/specs/${encodeURIComponent(feature)}/rollback`, {
    targetPhase,
  });
}
