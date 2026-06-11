/**
 * 承認 mutation フック（design.md「WriteClient + ApprovalMutation」/ Requirement 2.4, 8.2）。
 *
 * - `writeClient.updateApproval` を実行（承認は `approved: true` 固定）
 * - 成功時: 返却 `SpecSummary` を `['specs']` / `['spec', feature]` キャッシュへ反映し、
 *   `['specs']` / `['spec', feature]` / `['trace', feature]` を invalidate する
 *   （SSE 由来の invalidate と同一キー集合 → 冪等、8.2）
 * - エラーは writeClient が正規化した `NormalizedApiError` のまま透過（ダイアログが code/message を表示）
 * - `isPending` は UseMutationResult 経由で公開され、ダイアログが二重送信を防止する
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { PhaseName, SpecSummary } from "@contracts/spec";
import type { NormalizedApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { reflectSpecSummary } from "./reflectSpecSummary";
import { updateApproval } from "./writeClient";

export function useApprovalMutation(
  feature: string,
): UseMutationResult<SpecSummary, NormalizedApiError, { phase: PhaseName }> {
  const queryClient = useQueryClient();
  return useMutation<SpecSummary, NormalizedApiError, { phase: PhaseName }>({
    mutationFn: ({ phase }) => updateApproval(feature, phase, true),
    onSuccess: async (summary) => {
      reflectSpecSummary(queryClient, feature, summary);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.specs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.spec(feature) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trace(feature) }),
      ]);
    },
  });
}
