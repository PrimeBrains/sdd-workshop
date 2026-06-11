/**
 * workflowQueryKeys の厳密値テスト（tasks.md 1.3 / design.md「workflowQueryKeys.ts は唯一の定義」）。
 *
 * 値は task 1.4 の prefix 無効化（['steering'] / ['skills'] / ['adr']）の前提であり、
 * 変更はキャッシュ無効化経路を壊す破壊的変更。厳密値で固定する。
 */
import { describe, expect, it } from "vitest";
import { workflowQueryKeys } from "./workflowQueryKeys";

describe("workflowQueryKeys（prefix 無効化の前提となる厳密値）", () => {
  it("steering の一覧キーは ['steering']、本文キーは ['steering', name]", () => {
    expect(workflowQueryKeys.steeringList).toEqual(["steering"]);
    expect(workflowQueryKeys.steeringDoc("tech")).toEqual(["steering", "tech"]);
  });

  it("skills の一覧キーは ['skills']、本文キーは ['skills', name]", () => {
    expect(workflowQueryKeys.skillList).toEqual(["skills"]);
    expect(workflowQueryKeys.skillDoc("kiro-spec-design")).toEqual(["skills", "kiro-spec-design"]);
  });

  it("adr の一覧キーは ['adr']、本文キーは ['adr', id]", () => {
    expect(workflowQueryKeys.adrList).toEqual(["adr"]);
    expect(workflowQueryKeys.adrDoc("0001")).toEqual(["adr", "0001"]);
  });

  it("本文キーの先頭要素は一覧キーと一致する（prefix 無効化が一覧にも波及する）", () => {
    expect(workflowQueryKeys.steeringDoc("x")[0]).toBe(workflowQueryKeys.steeringList[0]);
    expect(workflowQueryKeys.skillDoc("x")[0]).toBe(workflowQueryKeys.skillList[0]);
    expect(workflowQueryKeys.adrDoc("x")[0]).toBe(workflowQueryKeys.adrList[0]);
  });
});
