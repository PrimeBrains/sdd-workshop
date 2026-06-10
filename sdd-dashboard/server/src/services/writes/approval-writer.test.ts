import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../../config.js";
import { AppError, ERROR_HTTP_STATUS, ErrorCode } from "../../errors/codes.js";
import type { PhaseApproval, SpecApprovals } from "../../types/spec.js";
import { createKiroScanner } from "../kiro-scanner.js";
import type { AuditEntry } from "./audit-log.js";
import { createAuditLog } from "./audit-log.js";
import { createApprovalWriter } from "./approval-writer.js";
import { createSafePathGuard } from "./safe-path.js";
import { createSpecJsonWriter } from "./spec-json-writer.js";

/** 固定時刻クロック（updated_at / 監査 at の厳密値アサート用） */
const FIXED_AT = "2026-06-10T12:34:56.000Z";
const fixedNow = (): Date => new Date(FIXED_AT);

function ap(generated: boolean, approved: boolean): PhaseApproval {
  return { generated, approved };
}

function approvals(
  requirements: PhaseApproval,
  design: PhaseApproval,
  tasks: PhaseApproval,
): SpecApprovals {
  return { requirements, design, tasks };
}

/** 既知フィールドのみの spec.json + 保持対象の未知フィールド app */
function specJsonOf(flags: SpecApprovals): string {
  return `${JSON.stringify(
    {
      feature_name: "alpha",
      app: "demo-app",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      language: "ja",
      phase: "design-generated",
      approvals: flags,
      ready_for_implementation: false,
    },
    null,
    2,
  )}\n`;
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

interface Fixture {
  context: RepoContext;
  specPath: string;
  auditEntries: AuditEntry[];
  writer: ReturnType<typeof createApprovalWriter>;
}

/** .kiro/specs/alpha/spec.json 付き一時リポジトリ + 監査 sink 注入済み ApprovalWriter */
function makeFixture(flags: SpecApprovals): Fixture {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-approvalwriter-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  const specDir = join(kiroDir, "specs", "alpha");
  mkdirSync(specDir, { recursive: true });
  const specPath = join(specDir, "spec.json");
  writeFileSync(specPath, specJsonOf(flags));

  const context: RepoContext = { repoRoot, kiroDir, port: 0 };
  const scanner = createKiroScanner(context);
  const guard = createSafePathGuard(context);
  const specJsonWriter = createSpecJsonWriter({ scanner, guard, now: fixedNow });
  const auditEntries: AuditEntry[] = [];
  const audit = createAuditLog({
    sink: (line) => auditEntries.push(JSON.parse(line) as AuditEntry),
    now: fixedNow,
  });
  const writer = createApprovalWriter({ specJsonWriter, audit });
  return { context, specPath, auditEntries, writer };
}

/** AppError として拒否されたエラーを取り出す */
async function captureError(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
}

describe("createApprovalWriter / updateApproval", () => {
  it("3 フェーズを順に承認すると ready_for_implementation=true / phase=tasks-approved になる（9.1, 9.4）", async () => {
    const { writer, specPath, auditEntries } = makeFixture(
      approvals(ap(true, false), ap(true, false), ap(true, false)),
    );

    await writer.updateApproval("alpha", "requirements", true);
    await writer.updateApproval("alpha", "design", true);
    const summary = await writer.updateApproval("alpha", "tasks", true);

    expect(summary.approvals).toEqual(approvals(ap(true, true), ap(true, true), ap(true, true)));
    expect(summary.phase).toBe("tasks-approved");
    expect(summary.readyForImplementation).toBe(true);
    expect(summary.updatedAt).toBe(FIXED_AT);

    const written = JSON.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
    expect(written["phase"]).toBe("tasks-approved");
    expect(written["ready_for_implementation"]).toBe(true);
    expect(written["app"]).toBe("demo-app"); // 未変更フィールド保持（9.5）

    // 全試行が監査記録される（12.3 申し送り）
    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "approval-update",
        targetPath: "specs/alpha/spec.json",
        outcome: "success",
        errorCode: null,
      },
      {
        at: FIXED_AT,
        operation: "approval-update",
        targetPath: "specs/alpha/spec.json",
        outcome: "success",
        errorCode: null,
      },
      {
        at: FIXED_AT,
        operation: "approval-update",
        targetPath: "specs/alpha/spec.json",
        outcome: "success",
        errorCode: null,
      },
    ]);
  });

  it("先行フェーズなしの requirements は単独で承認できる（9.1, 9.3）", async () => {
    const { writer } = makeFixture(approvals(ap(true, false), ap(false, false), ap(false, false)));

    const summary = await writer.updateApproval("alpha", "requirements", true);

    expect(summary.approvals).toEqual(
      approvals(ap(true, true), ap(false, false), ap(false, false)),
    );
    expect(summary.phase).toBe("requirements-generated");
    expect(summary.readyForImplementation).toBe(false);
  });

  it("generated=false のフェーズへの承認を APPROVAL_NOT_GENERATED（409 相当）で拒否し監査記録する（9.2, 12.3）", async () => {
    const { writer, specPath, auditEntries } = makeFixture(
      approvals(ap(true, true), ap(false, false), ap(false, false)),
    );
    const before = readFileSync(specPath, "utf8");

    const error = await captureError(writer.updateApproval("alpha", "design", true));

    expect(error.code).toBe(ErrorCode.APPROVAL_NOT_GENERATED);
    expect(ERROR_HTTP_STATUS[ErrorCode.APPROVAL_NOT_GENERATED]).toBe(409);
    expect(readFileSync(specPath, "utf8")).toBe(before); // 書込されない
    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "approval-update",
        targetPath: "specs/alpha/spec.json",
        outcome: "rejected",
        errorCode: "APPROVAL_NOT_GENERATED",
      },
    ]);
  });

  it("先行フェーズ未承認の design への承認を APPROVAL_ORDER_VIOLATION（409 相当）で拒否し監査記録する（9.3, 12.3）", async () => {
    const { writer, specPath, auditEntries } = makeFixture(
      approvals(ap(true, false), ap(true, false), ap(false, false)),
    );
    const before = readFileSync(specPath, "utf8");

    const error = await captureError(writer.updateApproval("alpha", "design", true));

    expect(error.code).toBe(ErrorCode.APPROVAL_ORDER_VIOLATION);
    expect(ERROR_HTTP_STATUS[ErrorCode.APPROVAL_ORDER_VIOLATION]).toBe(409);
    expect(readFileSync(specPath, "utf8")).toBe(before);
    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "approval-update",
        targetPath: "specs/alpha/spec.json",
        outcome: "rejected",
        errorCode: "APPROVAL_ORDER_VIOLATION",
      },
    ]);
  });

  it("design 未承認のまま tasks を承認すると APPROVAL_ORDER_VIOLATION（9.3）", async () => {
    const { writer } = makeFixture(approvals(ap(true, true), ap(true, false), ap(true, false)));

    const error = await captureError(writer.updateApproval("alpha", "tasks", true));

    expect(error.code).toBe(ErrorCode.APPROVAL_ORDER_VIOLATION);
  });

  it("generated=false と先行未承認が同時に該当する場合は APPROVAL_NOT_GENERATED を優先する（9.2）", async () => {
    const { writer } = makeFixture(approvals(ap(true, false), ap(false, false), ap(false, false)));

    const error = await captureError(writer.updateApproval("alpha", "design", true));

    expect(error.code).toBe(ErrorCode.APPROVAL_NOT_GENERATED);
  });

  it("承認解除（approved=false）は順序検証なしで通り ready_for_implementation=false に再計算する（9.4）", async () => {
    const { writer, specPath } = makeFixture(
      approvals(ap(true, true), ap(true, true), ap(true, true)),
    );

    const summary = await writer.updateApproval("alpha", "tasks", false);

    expect(summary.approvals).toEqual(approvals(ap(true, true), ap(true, true), ap(true, false)));
    expect(summary.phase).toBe("tasks-generated");
    expect(summary.readyForImplementation).toBe(false);
    const written = JSON.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
    expect(written["ready_for_implementation"]).toBe(false);
    expect(written["phase"]).toBe("tasks-generated");
  });

  it("不在 feature への承認は SPEC_NOT_FOUND で拒否され監査記録される（12.3）", async () => {
    const { writer, auditEntries } = makeFixture(
      approvals(ap(true, false), ap(false, false), ap(false, false)),
    );

    const error = await captureError(writer.updateApproval("missing", "requirements", true));

    expect(error.code).toBe(ErrorCode.SPEC_NOT_FOUND);
    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "approval-update",
        targetPath: "specs/missing/spec.json",
        outcome: "rejected",
        errorCode: "SPEC_NOT_FOUND",
      },
    ]);
  });

  it("AppError 以外の失敗は outcome=failed で監査記録して透過する（12.3）", async () => {
    const { auditEntries } = makeFixture(
      approvals(ap(true, false), ap(false, false), ap(false, false)),
    );
    const boom = new Error("disk on fire");
    const failingSpecJsonWriter = {
      update: () => Promise.reject(boom),
    };
    const audit = createAuditLog({
      sink: (line) => auditEntries.push(JSON.parse(line) as AuditEntry),
      now: fixedNow,
    });
    const writer = createApprovalWriter({ specJsonWriter: failingSpecJsonWriter, audit });

    const error = await writer.updateApproval("alpha", "requirements", true).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBe(boom);
    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "approval-update",
        targetPath: "specs/alpha/spec.json",
        outcome: "failed",
        errorCode: null,
      },
    ]);
  });
});
