/**
 * NextCommand 単体テスト — フェーズ → 次 CLI コマンド対応表の厳密値検証
 * （design.md「Model 層（純粋関数）」NextCommand / Requirements 2.5, 3.5, 4.2）。
 */
import { describe, expect, it } from "vitest";

import {
  nextCommandAfterApproval,
  nextCommandAfterRollback,
  PHASE_COMMANDS,
} from "./nextCommand";

describe("nextCommandAfterApproval", () => {
  it("requirements 承認後は /kiro-spec-design を案内する", () => {
    expect(nextCommandAfterApproval("requirements", "sdd-workflow-ui")).toBe(
      "/kiro-spec-design sdd-workflow-ui",
    );
  });

  it("design 承認後は /kiro-spec-tasks を案内する", () => {
    expect(nextCommandAfterApproval("design", "sdd-workflow-ui")).toBe(
      "/kiro-spec-tasks sdd-workflow-ui",
    );
  });

  it("tasks 承認後は /kiro-impl を案内する", () => {
    expect(nextCommandAfterApproval("tasks", "sdd-workflow-ui")).toBe(
      "/kiro-impl sdd-workflow-ui",
    );
  });

  it("feature 名を単一スペースで補間する（別 feature でも一致）", () => {
    expect(nextCommandAfterApproval("requirements", "sdd-review-ui")).toBe(
      "/kiro-spec-design sdd-review-ui",
    );
    expect(nextCommandAfterApproval("tasks", "evm-studio")).toBe(
      "/kiro-impl evm-studio",
    );
  });
});

describe("nextCommandAfterRollback", () => {
  it("requirements への手戻り後は /kiro-spec-requirements を案内する", () => {
    expect(nextCommandAfterRollback("requirements", "sdd-workflow-ui")).toBe(
      "/kiro-spec-requirements sdd-workflow-ui",
    );
  });

  it("design への手戻り後は /kiro-spec-design を案内する", () => {
    expect(nextCommandAfterRollback("design", "sdd-workflow-ui")).toBe(
      "/kiro-spec-design sdd-workflow-ui",
    );
  });

  it("tasks への手戻り後は /kiro-spec-tasks を案内する", () => {
    expect(nextCommandAfterRollback("tasks", "sdd-workflow-ui")).toBe(
      "/kiro-spec-tasks sdd-workflow-ui",
    );
  });

  it("feature 名を単一スペースで補間する（別 feature でも一致）", () => {
    expect(nextCommandAfterRollback("design", "sdd-review-ui")).toBe(
      "/kiro-spec-design sdd-review-ui",
    );
  });
});

describe("PHASE_COMMANDS", () => {
  it("ヘルプ用フェーズ表を固定順・厳密値で公開する", () => {
    expect(PHASE_COMMANDS).toEqual([
      {
        phase: "Discovery",
        artifact: "brief.md / roadmap.md",
        command: "/kiro-discovery",
      },
      {
        phase: "Requirements",
        artifact: "requirements.md",
        command: "/kiro-spec-requirements",
      },
      {
        phase: "Design",
        artifact: "design.md",
        command: "/kiro-spec-design",
      },
      {
        phase: "Tasks",
        artifact: "tasks.md",
        command: "/kiro-spec-tasks",
      },
      {
        phase: "Implementation",
        artifact: "実装コード",
        command: "/kiro-impl",
      },
    ]);
  });

  it("順序が固定である（先頭 Discovery・末尾 Implementation）", () => {
    expect(PHASE_COMMANDS[0]?.phase).toBe("Discovery");
    expect(PHASE_COMMANDS[PHASE_COMMANDS.length - 1]?.phase).toBe(
      "Implementation",
    );
    expect(PHASE_COMMANDS.map((entry) => entry.phase)).toEqual([
      "Discovery",
      "Requirements",
      "Design",
      "Tasks",
      "Implementation",
    ]);
  });
});
