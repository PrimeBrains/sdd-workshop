import { describe, expect, it } from "vitest";
import { AppError, ERROR_HTTP_STATUS, ErrorCode } from "./codes.js";

describe("ErrorCode", () => {
  it("design.md エラー表の全コードを DOMAIN_REASON 形式で定義する（キー = 値）", () => {
    expect(ErrorCode).toEqual({
      REPO_INVALID: "REPO_INVALID",
      SPEC_NOT_FOUND: "SPEC_NOT_FOUND",
      RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
      VALIDATION_FAILED: "VALIDATION_FAILED",
      APPROVAL_NOT_GENERATED: "APPROVAL_NOT_GENERATED",
      APPROVAL_ORDER_VIOLATION: "APPROVAL_ORDER_VIOLATION",
      ADR_NUMBER_CONFLICT: "ADR_NUMBER_CONFLICT",
      WRITE_PATH_FORBIDDEN: "WRITE_PATH_FORBIDDEN",
      INTERNAL_ERROR: "INTERNAL_ERROR",
    });
  });

  it("未定義の文字列リテラルは ErrorCode 型として受け付けない（型レベル検証）", () => {
    // @ts-expect-error -- "NOT_A_CODE" は ErrorCode 語彙に存在しないためコンパイルエラーになる
    const bad: ErrorCode = "NOT_A_CODE";
    // @ts-expect-error -- AppError も未定義リテラルを拒否する
    void new AppError("UNKNOWN_CODE", "msg");
    void bad;
    // 正常系: 定数経由の参照は通る
    const ok: ErrorCode = ErrorCode.SPEC_NOT_FOUND;
    expect(ok).toBe("SPEC_NOT_FOUND");
  });
});

describe("ERROR_HTTP_STATUS", () => {
  it("design.md エラー表どおりに HTTP ステータスへ対応付ける（REPO_INVALID は起動時 exit(1) のため対象外）", () => {
    expect(ERROR_HTTP_STATUS).toEqual({
      SPEC_NOT_FOUND: 404,
      RESOURCE_NOT_FOUND: 404,
      VALIDATION_FAILED: 422,
      APPROVAL_NOT_GENERATED: 409,
      APPROVAL_ORDER_VIOLATION: 409,
      ADR_NUMBER_CONFLICT: 409,
      WRITE_PATH_FORBIDDEN: 403,
      INTERNAL_ERROR: 500,
    });
    expect("REPO_INVALID" in ERROR_HTTP_STATUS).toBe(false);
  });
});

describe("AppError", () => {
  it("Error を継承し code と message を保持する", () => {
    const error = new AppError(ErrorCode.SPEC_NOT_FOUND, "spec not found: nope");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AppError");
    expect(error.code).toBe("SPEC_NOT_FOUND");
    expect(error.message).toBe("spec not found: nope");
  });

  it("details 未指定時は undefined を保持する", () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, "boom");
    expect(error.details).toBeUndefined();
  });

  it("任意の details を保持する（422 fieldErrors 等の付帯情報用）", () => {
    const details = { fieldErrors: { title: ["required"] } };
    const error = new AppError(ErrorCode.VALIDATION_FAILED, "invalid input", details);
    expect(error.details).toEqual(details);
  });

  it("instanceof による判別が catch 節で機能する", () => {
    const caught = (() => {
      try {
        throw new AppError(ErrorCode.WRITE_PATH_FORBIDDEN, "outside .kiro/");
      } catch (e) {
        return e;
      }
    })();
    expect(caught instanceof AppError && caught.code === ErrorCode.WRITE_PATH_FORBIDDEN).toBe(true);
  });
});
