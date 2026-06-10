/**
 * ErrorCode 定数 + AppError クラス — エラーコード語彙の唯一の定義場所。
 * design.md「Error Categories and Responses」表と 1:1 対応する（Requirement 13.1）。
 * steering tech.md の ErrorCode 定数パターンに従い、文字列リテラルの直書きは禁止
 * （`ErrorCode` 型により未定義コードはコンパイルエラーになる）。
 */

export const ErrorCode = {
  /** リポジトリパス不在 / `.kiro/` 不在（1.2）。起動時 exit(1) であり HTTP 応答にはならない */
  REPO_INVALID: "REPO_INVALID",
  /** 不在 feature への詳細 / trace / 書込要求 */
  SPEC_NOT_FOUND: "SPEC_NOT_FOUND",
  /** 不在 steering / skill / ADR */
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  /** zod 入力検証失敗（fieldErrors 付き、11.4） */
  VALIDATION_FAILED: "VALIDATION_FAILED",
  /** generated=false フェーズへの承認（9.2） */
  APPROVAL_NOT_GENERATED: "APPROVAL_NOT_GENERATED",
  /** 先行フェーズ未承認（9.3） */
  APPROVAL_ORDER_VIOLATION: "APPROVAL_ORDER_VIOLATION",
  /** ADR 連番衝突（11.5） */
  ADR_NUMBER_CONFLICT: "ADR_NUMBER_CONFLICT",
  /** `.kiro/` 外への書込解決（12.2） */
  WRITE_PATH_FORBIDDEN: "WRITE_PATH_FORBIDDEN",
  /** 未知例外（13.4。プロセス継続） */
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** HTTP 応答になり得るコード（REPO_INVALID は起動時 exit(1) のため除外） */
export type HttpErrorCode = Exclude<ErrorCode, typeof ErrorCode.REPO_INVALID>;

/**
 * ErrorCode → HTTP ステータスの対応（design.md エラー表の右列）。
 * API 層のエラーミドルウェアはこの表のみを参照して AppError を ApiError JSON へ変換する。
 */
export const ERROR_HTTP_STATUS: Readonly<Record<HttpErrorCode, 403 | 404 | 409 | 422 | 500>> = {
  SPEC_NOT_FOUND: 404,
  RESOURCE_NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  APPROVAL_NOT_GENERATED: 409,
  APPROVAL_ORDER_VIOLATION: 409,
  ADR_NUMBER_CONFLICT: 409,
  WRITE_PATH_FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
};

/**
 * ビジネス層が throw する構造化エラー。
 * code は ErrorCode 定数のみ受け付け（未定義リテラルはコンパイルエラー）、
 * details は 422 の fieldErrors 等の付帯情報を運ぶ任意フィールド。
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
