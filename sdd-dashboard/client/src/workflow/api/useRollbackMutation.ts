/**
 * 巻き戻し mutation フック（design.md「WriteClient + RollbackMutation」/ Requirement 3.4, 8.2）。
 *
 * - `writeClient.rollback` を実行
 * - 成功時: 返却 `SpecSummary` を `['specs']` / `['spec', feature]` キャッシュへ反映し、
 *   `['specs']` / `['spec', feature]` / `['trace', feature]` を invalidate する（8.2）
 * - エラーは `NormalizedApiError` のまま透過。`isPending` で二重送信防止
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { PhaseName, SpecSummary } from "@contracts/spec";
import type { NormalizedApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { reflectSpecSummary } from "./reflectSpecSummary";
import { rollback } from "./writeClient";

export function useRollbackMutation(
  feature: string,
): UseMutationResult<SpecSummary, NormalizedApiError, { targetPhase: PhaseName }> {
  const queryClient = useQueryClient();
  return useMutation<SpecSummary, NormalizedApiError, { targetPhase: PhaseName }>({
    mutationFn: ({ targetPhase }) => rollback(feature, targetPhase),
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
