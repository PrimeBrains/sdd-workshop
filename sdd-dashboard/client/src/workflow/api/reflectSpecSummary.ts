/**
 * 書込成功時のキャッシュ反映ヘルパ（design.md「書込成功後の状態反映」/ Requirement 8.2）。
 *
 * 返却された `SpecSummary` を review-ui のキャッシュ構造へ正しく反映する:
 * - `['specs']`: `SpecSummary[]` の該当 feature エントリを置換（不在ならノータッチ）
 * - `['spec', feature]`: `SpecDetail`（`{ summary, ... }`）の `.summary` のみ更新（不在ならノータッチ）
 * その後、呼び出し側が 3 キーを invalidate して SSE 経路と同一の post-state へ収束させる（冪等）。
 *
 * `setQueryData` はキャッシュ不在時に updater が undefined を受ける。その場合は no-op として
 * undefined を返し、未マウントのクエリを誤って materialize しない（防御的反映）。
 */
import type { QueryClient } from "@tanstack/react-query";
import type { SpecDetail, SpecSummary } from "@contracts/spec";
import { queryKeys } from "@/api/queryKeys";

export function reflectSpecSummary(
  queryClient: QueryClient,
  feature: string,
  summary: SpecSummary,
): void {
  // ['specs']: 該当 feature を置換（リスト不在なら何もしない）
  queryClient.setQueryData<SpecSummary[]>(queryKeys.specs, (current) => {
    if (!current) return current;
    return current.map((entry) => (entry.feature === summary.feature ? summary : entry));
  });

  // ['spec', feature]: SpecDetail.summary のみ更新（詳細不在なら何もしない）
  queryClient.setQueryData<SpecDetail>(queryKeys.spec(feature), (current) => {
    if (!current) return current;
    return { ...current, summary };
  });
}
