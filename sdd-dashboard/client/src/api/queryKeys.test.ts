/**
 * queryKeys のユニットテスト（tasks.md 1.2）。
 * クエリキー定義の唯一の場所として、design.md Data Models の厳密値
 * `['repo']` / `['specs']` / `['spec', feature]` / `['trace', feature]` を保証する。
 * SseInvalidationBridge（タスク 6.x）が同じ定義を共有する前提のため、値の変更は破壊的変更。
 */
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/api/queryKeys";

describe("queryKeys", () => {
  it("repo キーは ['repo'] の厳密値である", () => {
    expect(queryKeys.repo).toEqual(["repo"]);
  });

  it("specs キーは ['specs'] の厳密値である", () => {
    expect(queryKeys.specs).toEqual(["specs"]);
  });

  it("spec(feature) は ['spec', feature] の厳密値である", () => {
    expect(queryKeys.spec("sdd-review-ui")).toEqual(["spec", "sdd-review-ui"]);
  });

  it("trace(feature) は ['trace', feature] の厳密値である", () => {
    expect(queryKeys.trace("sdd-review-ui")).toEqual(["trace", "sdd-review-ui"]);
  });

  it("公開キーは repo / specs / spec / trace の 4 種のみである", () => {
    expect(Object.keys(queryKeys).sort()).toEqual(["repo", "spec", "specs", "trace"]);
  });
});
