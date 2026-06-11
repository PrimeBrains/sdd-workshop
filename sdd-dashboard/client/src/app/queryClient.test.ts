/**
 * createQueryClient のユニットテスト（tasks.md 1.2）。
 * design.md「QueryClient 設定（再試行・staleTime）」で選定したローカルツール向け
 * デフォルト値を厳密値で固定する（変更時はこのテストと実装コメントを同時に更新する）。
 */
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { createQueryClient } from "@/app/queryClient";

describe("createQueryClient", () => {
  it("QueryClient インスタンスを生成する", () => {
    expect(createQueryClient()).toBeInstanceOf(QueryClient);
  });

  it("queries のデフォルトが retry: 1 / staleTime: 30000 / refetchOnWindowFocus: false である", () => {
    const queryClient = createQueryClient();
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.retry).toBe(1);
    expect(defaults?.staleTime).toBe(30_000);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });

  it("呼び出しごとに独立したインスタンスを返す（キャッシュ共有しない）", () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });
});
