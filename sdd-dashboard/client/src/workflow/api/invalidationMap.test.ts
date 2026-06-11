/**
 * WorkflowInvalidationMap（design.md「WorkflowInvalidationMap」, Requirements 8.1 / 8.3）の単体テスト。
 *
 * - steering / skill / adr の各カテゴリ写像が厳密キーへ写像されること（8.1）
 * - `spec` / `other` カテゴリのエントリが存在しないこと（8.3 / 所有境界）
 * - 結合済み `appChangeEventsMap` は DEFAULT 由来の `spec` を保持しつつ 3 カテゴリを追加すること
 *   （merge-not-replace の正しさ）
 */
import type { ChangeEvent } from "@contracts/events";
import { describe, expect, it } from "vitest";
import { workflowInvalidationMap } from "@/workflow/api/invalidationMap";
import { appChangeEventsMap } from "@/workflow/integration";

function changeEvent(over: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    type: "change",
    path: ".kiro/steering/product.md",
    category: "steering",
    feature: null,
    at: "2026-06-11T00:00:00Z",
    ...over,
  };
}

describe("workflowInvalidationMap", () => {
  it("steering 写像は [['steering']] を返す（8.1）", () => {
    const keys = workflowInvalidationMap.steering?.(changeEvent({ category: "steering" }));
    expect(keys).toEqual([["steering"]]);
  });

  it("skill 写像は [['skills']] を返す（8.1）", () => {
    const keys = workflowInvalidationMap.skill?.(changeEvent({ category: "skill" }));
    expect(keys).toEqual([["skills"]]);
  });

  it("adr 写像は [['adr']] を返す（8.1）", () => {
    const keys = workflowInvalidationMap.adr?.(changeEvent({ category: "adr" }));
    expect(keys).toEqual([["adr"]]);
  });

  it("spec / other のエントリは持たない（所有境界 / 8.3）", () => {
    expect(Object.keys(workflowInvalidationMap).sort()).toEqual(["adr", "skill", "steering"]);
    expect(workflowInvalidationMap.spec).toBeUndefined();
    expect(workflowInvalidationMap.other).toBeUndefined();
  });
});

describe("appChangeEventsMap（DEFAULT spread + workflow の結合）", () => {
  it("DEFAULT 由来の spec を保持する（merge-not-replace の回帰）", () => {
    const keys = appChangeEventsMap.spec?.(
      changeEvent({ category: "spec", feature: "f", path: ".kiro/specs/f/requirements.md" }),
    );
    expect(keys).toEqual([["specs"], ["spec", "f"], ["trace", "f"]]);
  });

  it("workflow の 3 カテゴリを追加する（8.1）", () => {
    expect(appChangeEventsMap.steering?.(changeEvent({ category: "steering" }))).toEqual([
      ["steering"],
    ]);
    expect(appChangeEventsMap.skill?.(changeEvent({ category: "skill" }))).toEqual([["skills"]]);
    expect(appChangeEventsMap.adr?.(changeEvent({ category: "adr" }))).toEqual([["adr"]]);
  });

  it("spec + steering + skill + adr の 4 カテゴリを持ち、other は持たない", () => {
    expect(Object.keys(appChangeEventsMap).sort()).toEqual(["adr", "skill", "spec", "steering"]);
    expect(appChangeEventsMap.other).toBeUndefined();
  });
});
