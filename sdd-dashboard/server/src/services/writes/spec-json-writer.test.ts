import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoContext } from "../../config.js";
import { AppError, ErrorCode } from "../../errors/codes.js";
import type { PhaseApproval, SpecApprovals } from "../../types/spec.js";
import { createKiroScanner } from "../kiro-scanner.js";
import { createSafePathGuard } from "./safe-path.js";
import { createSpecJsonWriter, derivePhase, deriveReady } from "./spec-json-writer.js";

/** 固定時刻クロック（updated_at の厳密値アサート用） */
const FIXED_AT = "2026-06-10T12:34:56.000Z";
const fixedNow = (): Date => new Date(FIXED_AT);

/** PhaseApproval の短縮コンストラクタ */
function ap(generated: boolean, approved: boolean): PhaseApproval {
  return { generated, approved };
}

/** approvals の短縮コンストラクタ（requirements / design / tasks の順） */
function approvals(
  requirements: PhaseApproval,
  design: PhaseApproval,
  tasks: PhaseApproval,
): SpecApprovals {
  return { requirements, design, tasks };
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

/** 一時リポジトリ（.kiro/specs/alpha/spec.json 付き）を作る */
function makeRepo(specJson: string | null): { context: RepoContext; specPath: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-specjsonwriter-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  const specDir = join(kiroDir, "specs", "alpha");
  mkdirSync(specDir, { recursive: true });
  const specPath = join(specDir, "spec.json");
  if (specJson !== null) {
    writeFileSync(specPath, specJson);
  }
  return { context: { repoRoot, kiroDir, port: 0 }, specPath };
}

function makeWriter(context: RepoContext) {
  const scanner = createKiroScanner(context);
  const guard = createSafePathGuard(context);
  return createSpecJsonWriter({ scanner, guard, now: fixedNow });
}

/** 未知フィールド（app / future_field / approvals 内の note）を含む典型 spec.json */
const BASE_SPEC_JSON = `${JSON.stringify(
  {
    feature_name: "alpha",
    app: "demo-app",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    language: "ja",
    phase: "design-generated",
    approvals: {
      requirements: { generated: true, approved: true, note: "reviewed by pb" },
      design: { generated: true, approved: false },
      tasks: { generated: false, approved: false },
    },
    ready_for_implementation: false,
    future_field: { nested: [1, 2, 3] },
  },
  null,
  2,
)}\n`;

describe("derivePhase", () => {
  it("全フラグ false → initialized", () => {
    expect(derivePhase(approvals(ap(false, false), ap(false, false), ap(false, false)))).toBe(
      "initialized",
    );
  });

  it("requirements.generated のみ → requirements-generated", () => {
    expect(derivePhase(approvals(ap(true, false), ap(false, false), ap(false, false)))).toBe(
      "requirements-generated",
    );
  });

  it("requirements 承認済みでも design 未生成なら requirements-generated のまま", () => {
    expect(derivePhase(approvals(ap(true, true), ap(false, false), ap(false, false)))).toBe(
      "requirements-generated",
    );
  });

  it("design.generated → design-generated", () => {
    expect(derivePhase(approvals(ap(true, true), ap(true, false), ap(false, false)))).toBe(
      "design-generated",
    );
  });

  it("design 承認済みでも tasks 未生成なら design-generated のまま", () => {
    expect(derivePhase(approvals(ap(true, true), ap(true, true), ap(false, false)))).toBe(
      "design-generated",
    );
  });

  it("tasks.generated → tasks-generated", () => {
    expect(derivePhase(approvals(ap(true, true), ap(true, true), ap(true, false)))).toBe(
      "tasks-generated",
    );
  });

  it("tasks.approved → tasks-approved（9.4 の最終状態）", () => {
    expect(derivePhase(approvals(ap(true, true), ap(true, true), ap(true, true)))).toBe(
      "tasks-approved",
    );
  });
});

describe("deriveReady", () => {
  it("3 フェーズすべて approved の場合のみ true（9.4）", () => {
    expect(deriveReady(approvals(ap(true, true), ap(true, true), ap(true, true)))).toBe(true);
  });

  it("1 フェーズでも未承認なら false（9.4）", () => {
    expect(deriveReady(approvals(ap(true, true), ap(true, true), ap(true, false)))).toBe(false);
    expect(deriveReady(approvals(ap(true, true), ap(true, false), ap(true, true)))).toBe(false);
    expect(deriveReady(approvals(ap(true, false), ap(true, true), ap(true, true)))).toBe(false);
    expect(deriveReady(approvals(ap(false, false), ap(false, false), ap(false, false)))).toBe(
      false,
    );
  });
});

describe("createSpecJsonWriter / update", () => {
  it("未変更フィールド（app・future_field・approvals 内未知キー）を逐語的に保持し updated_at のみ刷新する（9.5）", async () => {
    const { context, specPath } = makeRepo(BASE_SPEC_JSON);
    const writer = makeWriter(context);

    await writer.update("alpha", (current) => ({
      ...current,
      design: { ...current.design, approved: true },
    }));

    const written = readFileSync(specPath, "utf8");
    expect(written.endsWith("\n")).toBe(true);
    expect(JSON.parse(written)).toEqual({
      feature_name: "alpha",
      app: "demo-app",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: FIXED_AT,
      language: "ja",
      phase: "design-generated",
      approvals: {
        requirements: { generated: true, approved: true, note: "reviewed by pb" },
        design: { generated: true, approved: true },
        tasks: { generated: false, approved: false },
      },
      ready_for_implementation: false,
      future_field: { nested: [1, 2, 3] },
    });
  });

  it("3 フェーズ承認済みの approvals へ変換すると phase=tasks-approved / ready_for_implementation=true を導出する（9.4）", async () => {
    const { context, specPath } = makeRepo(BASE_SPEC_JSON);
    const writer = makeWriter(context);

    await writer.update("alpha", () =>
      approvals(ap(true, true), ap(true, true), ap(true, true)),
    );

    const written = JSON.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
    expect(written["phase"]).toBe("tasks-approved");
    expect(written["ready_for_implementation"]).toBe(true);
  });

  it("更新後の SpecSummary（メタデータ + artifacts）を返す（9.1 の返却値基盤）", async () => {
    const { context } = makeRepo(BASE_SPEC_JSON);
    const writer = makeWriter(context);

    const summary = await writer.update("alpha", (current) => ({
      ...current,
      design: { ...current.design, approved: true },
    }));

    expect(summary).toEqual({
      feature: "alpha",
      app: "demo-app",
      phase: "design-generated",
      language: "ja",
      approvals: approvals(ap(true, true), ap(true, true), ap(false, false)),
      readyForImplementation: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: FIXED_AT,
      artifacts: {
        brief: false,
        requirements: false,
        design: false,
        tasks: false,
        research: false,
        validationGap: false,
        validationDesign: false,
        validationImpl: false,
      },
      diagnostics: [],
    });
  });

  it("変換関数が throw した場合はファイルを書き換えずエラーを透過する", async () => {
    const { context, specPath } = makeRepo(BASE_SPEC_JSON);
    const writer = makeWriter(context);
    const boom = new AppError(ErrorCode.APPROVAL_ORDER_VIOLATION, "boom");

    await expect(
      writer.update("alpha", () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(readFileSync(specPath, "utf8")).toBe(BASE_SPEC_JSON);
  });

  it("不在 feature は AppError(SPEC_NOT_FOUND)", async () => {
    const { context } = makeRepo(BASE_SPEC_JSON);
    const writer = makeWriter(context);

    const error = await writer.update("missing", (current) => current).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ErrorCode.SPEC_NOT_FOUND);
  });

  it("spec.json 不在は AppError(VALIDATION_FAILED)（承認対象の前提メタデータがない）", async () => {
    const { context } = makeRepo(null);
    const writer = makeWriter(context);

    const error = await writer.update("alpha", (current) => current).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it("approvals が不正な spec.json は AppError(VALIDATION_FAILED) で書込しない", async () => {
    const broken = `${JSON.stringify({ phase: "initialized", approvals: { requirements: "yes" } }, null, 2)}\n`;
    const { context, specPath } = makeRepo(broken);
    const writer = makeWriter(context);

    const error = await writer.update("alpha", (current) => current).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(readFileSync(specPath, "utf8")).toBe(broken);
  });
});
