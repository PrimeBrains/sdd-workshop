import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../errors/codes.js";
import { createAuditLog } from "./audit-log.js";

/** 固定時刻クロック（タイムスタンプの厳密値アサート用） */
const fixedNow = (): Date => new Date("2026-06-10T12:34:56.000Z");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAuditLog / record", () => {
  it("成功した書込試行を timestamp・操作種別・対象パス・結果付きの JSON 1 行として記録する（12.3）", () => {
    const lines: string[] = [];
    const audit = createAuditLog({ sink: (line) => lines.push(line), now: fixedNow });

    const entry = audit.record({
      operation: "approval-update",
      targetPath: "/repo/.kiro/specs/alpha/spec.json",
      outcome: "success",
    });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      at: "2026-06-10T12:34:56.000Z",
      operation: "approval-update",
      targetPath: "/repo/.kiro/specs/alpha/spec.json",
      outcome: "success",
      errorCode: null,
    });
    expect(entry.errorCode).toBeNull();
  });

  it("拒否された書込試行も errorCode 付きで記録する（12.2, 12.3）", () => {
    const lines: string[] = [];
    const audit = createAuditLog({ sink: (line) => lines.push(line), now: fixedNow });

    audit.record({
      operation: "adr-create",
      targetPath: "/etc/passwd",
      outcome: "rejected",
      errorCode: ErrorCode.WRITE_PATH_FORBIDDEN,
    });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      at: "2026-06-10T12:34:56.000Z",
      operation: "adr-create",
      targetPath: "/etc/passwd",
      outcome: "rejected",
      errorCode: "WRITE_PATH_FORBIDDEN",
    });
  });

  it("途中失敗した書込試行を outcome=failed で記録する（12.3, 12.4）", () => {
    const lines: string[] = [];
    const audit = createAuditLog({ sink: (line) => lines.push(line), now: fixedNow });

    audit.record({
      operation: "rollback",
      targetPath: "/repo/.kiro/specs/alpha/spec.json",
      outcome: "failed",
      errorCode: ErrorCode.INTERNAL_ERROR,
    });

    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      operation: "rollback",
      outcome: "failed",
      errorCode: "INTERNAL_ERROR",
    });
  });

  it("試行ごとに 1 行ずつ追記し、各行が独立した JSON として読める（12.3）", () => {
    const lines: string[] = [];
    const audit = createAuditLog({ sink: (line) => lines.push(line), now: fixedNow });

    audit.record({ operation: "approval-update", targetPath: "/a", outcome: "success" });
    audit.record({ operation: "rollback", targetPath: "/b", outcome: "rejected", errorCode: "X" });
    audit.record({ operation: "adr-create", targetPath: "/c", outcome: "failed", errorCode: "Y" });

    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).not.toContain("\n");
      expect(() => JSON.parse(line)).not.toThrow();
    }
    expect(lines.map((line) => (JSON.parse(line) as { outcome: string }).outcome)).toEqual([
      "success",
      "rejected",
      "failed",
    ]);
  });

  it("デフォルト sink は stderr（サーバーログ）へ 1 行で出力し、.kiro/ 内には書かない", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const audit = createAuditLog({ now: fixedNow });

    audit.record({
      operation: "approval-update",
      targetPath: "/repo/.kiro/specs/alpha/spec.json",
      outcome: "success",
    });

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = String(writeSpy.mock.calls[0]?.[0]);
    expect(written.endsWith("\n")).toBe(true);
    expect(JSON.parse(written.trimEnd())).toMatchObject({
      at: "2026-06-10T12:34:56.000Z",
      outcome: "success",
    });
  });
});
