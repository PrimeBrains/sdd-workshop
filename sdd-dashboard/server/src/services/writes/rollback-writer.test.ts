import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../../config.js";
import { AppError, ERROR_HTTP_STATUS, ErrorCode } from "../../errors/codes.js";
import type { PhaseApproval, PhaseName, SpecApprovals } from "../../types/spec.js";
import { createKiroScanner } from "../kiro-scanner.js";
import type { AuditEntry } from "./audit-log.js";
import { createAuditLog } from "./audit-log.js";
import { createRollbackWriter } from "./rollback-writer.js";
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

/** tasks-approved 相当の全フラグ true */
function allApproved(): SpecApprovals {
  return approvals(ap(true, true), ap(true, true), ap(true, true));
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
      phase: "tasks-approved",
      approvals: flags,
      ready_for_implementation: true,
    },
    null,
    2,
  )}\n`;
}

const ARTIFACT_FILES = ["requirements.md", "design.md", "tasks.md"] as const;

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
  specDir: string;
  specPath: string;
  auditEntries: AuditEntry[];
  writer: ReturnType<typeof createRollbackWriter>;
}

/**
 * .kiro/specs/alpha/ に spec.json + 3 成果物 md を持つ一時リポジトリと、
 * 監査 sink 注入済み RollbackWriter を作る。
 */
function makeFixture(flags: SpecApprovals): Fixture {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-rollbackwriter-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  const specDir = join(kiroDir, "specs", "alpha");
  mkdirSync(specDir, { recursive: true });
  const specPath = join(specDir, "spec.json");
  writeFileSync(specPath, specJsonOf(flags));
  for (const file of ARTIFACT_FILES) {
    writeFileSync(join(specDir, file), `# ${file}\n\n本文\n`);
  }

  const context: RepoContext = { repoRoot, kiroDir, port: 0 };
  const scanner = createKiroScanner(context);
  const guard = createSafePathGuard(context);
  const specJsonWriter = createSpecJsonWriter({ scanner, guard, now: fixedNow });
  const auditEntries: AuditEntry[] = [];
  const audit = createAuditLog({
    sink: (line) => auditEntries.push(JSON.parse(line) as AuditEntry),
    now: fixedNow,
  });
  const writer = createRollbackWriter({ specJsonWriter, audit });
  return { context, specDir, specPath, auditEntries, writer };
}

/** 成果物 md の mtime / 内容のスナップショット */
function snapshotArtifacts(specDir: string): Map<string, { mtimeMs: number; content: string }> {
  const snapshot = new Map<string, { mtimeMs: number; content: string }>();
  for (const file of ARTIFACT_FILES) {
    const path = join(specDir, file);
    snapshot.set(file, {
      mtimeMs: statSync(path).mtimeMs,
      content: readFileSync(path, "utf8"),
    });
  }
  return snapshot;
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

describe("createRollbackWriter / rollback", () => {
  it("tasks-approved から requirements への巻き戻しで期待フラグ集合になり成果物 md は不変（10.1, 10.2, 10.4）", async () => {
    const { writer, specDir, specPath, auditEntries } = makeFixture(allApproved());
    const before = snapshotArtifacts(specDir);
    const specBefore = readFileSync(specPath, "utf8");

    const summary = await writer.rollback("alpha", "requirements");

    // 対象フェーズ: approved のみ false（generated は維持）。後続フェーズ: 両フラグクリア（10.1）
    expect(summary.approvals).toEqual(
      approvals(ap(true, false), ap(false, false), ap(false, false)),
    );
    expect(summary.phase).toBe("requirements-generated");
    expect(summary.readyForImplementation).toBe(false); // 10.2
    expect(summary.updatedAt).toBe(FIXED_AT);

    const written = JSON.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
    expect(written["phase"]).toBe("requirements-generated");
    expect(written["ready_for_implementation"]).toBe(false);
    expect(written["app"]).toBe("demo-app"); // 未変更フィールド保持
    expect(readFileSync(specPath, "utf8")).not.toBe(specBefore); // spec.json は更新される

    // 成果物 md は mtime も内容も完全に不変（10.4）
    const after = snapshotArtifacts(specDir);
    for (const file of ARTIFACT_FILES) {
      expect(after.get(file)?.mtimeMs).toBe(before.get(file)?.mtimeMs);
      expect(after.get(file)?.content).toBe(before.get(file)?.content);
    }

    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "rollback",
        targetPath: "specs/alpha/spec.json",
        outcome: "success",
        errorCode: null,
      },
    ]);
  });

  it("design への巻き戻しでは requirements を変更せず design.approved と tasks 両フラグをクリアする（10.1）", async () => {
    const { writer } = makeFixture(allApproved());

    const summary = await writer.rollback("alpha", "design");

    expect(summary.approvals).toEqual(approvals(ap(true, true), ap(true, false), ap(false, false)));
    expect(summary.phase).toBe("design-generated");
    expect(summary.readyForImplementation).toBe(false);
  });

  it("tasks への巻き戻しでは tasks.approved のみ false になり generated は維持される（10.1, 10.2）", async () => {
    const { writer, specPath } = makeFixture(allApproved());

    const summary = await writer.rollback("alpha", "tasks");

    expect(summary.approvals).toEqual(approvals(ap(true, true), ap(true, true), ap(true, false)));
    expect(summary.phase).toBe("tasks-generated");
    expect(summary.readyForImplementation).toBe(false);
    const written = JSON.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
    expect(written["ready_for_implementation"]).toBe(false);
  });

  it("不明フェーズ名を VALIDATION_FAILED（422 相当）で拒否し spec.json に書き込まず監査記録する（10.3, 10.4, 12.3）", async () => {
    const { writer, specPath, auditEntries } = makeFixture(allApproved());
    const before = readFileSync(specPath, "utf8");

    const error = await captureError(writer.rollback("alpha", "implementation" as PhaseName));

    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(ERROR_HTTP_STATUS[ErrorCode.VALIDATION_FAILED]).toBe(422);
    expect(readFileSync(specPath, "utf8")).toBe(before); // 書込されない
    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "rollback",
        targetPath: "specs/alpha/spec.json",
        outcome: "rejected",
        errorCode: "VALIDATION_FAILED",
      },
    ]);
  });

  it("不在スペックへの巻き戻しは SPEC_NOT_FOUND（404 相当）で拒否され監査記録される（10.3, 12.3）", async () => {
    const { writer, auditEntries } = makeFixture(allApproved());

    const error = await captureError(writer.rollback("missing", "requirements"));

    expect(error.code).toBe(ErrorCode.SPEC_NOT_FOUND);
    expect(ERROR_HTTP_STATUS[ErrorCode.SPEC_NOT_FOUND]).toBe(404);
    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "rollback",
        targetPath: "specs/missing/spec.json",
        outcome: "rejected",
        errorCode: "SPEC_NOT_FOUND",
      },
    ]);
  });

  it("AppError 以外の失敗は outcome=failed で監査記録して透過する（12.3）", async () => {
    const boom = new Error("disk on fire");
    const failingSpecJsonWriter = {
      update: () => Promise.reject(boom),
    };
    const auditEntries: AuditEntry[] = [];
    const audit = createAuditLog({
      sink: (line) => auditEntries.push(JSON.parse(line) as AuditEntry),
      now: fixedNow,
    });
    const writer = createRollbackWriter({ specJsonWriter: failingSpecJsonWriter, audit });

    const error = await writer.rollback("alpha", "requirements").then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBe(boom);
    expect(auditEntries).toEqual([
      {
        at: FIXED_AT,
        operation: "rollback",
        targetPath: "specs/alpha/spec.json",
        outcome: "failed",
        errorCode: null,
      },
    ]);
  });
});
