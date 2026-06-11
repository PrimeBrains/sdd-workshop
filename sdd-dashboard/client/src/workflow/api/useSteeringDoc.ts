/**
 * GET /api/steering/:name の useQuery 薄ラッパ（design.md KnowledgeQueryHooks）。
 * review-ui の `get` を再利用し、変換・解釈をしない（エラーは NormalizedApiError のまま透過）。
 * Precondition: `name` はルートパラメータ由来（空文字では呼び出さない）。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SteeringDoc } from "@contracts/resources";
import { get, type NormalizedApiError } from "@/api/client";
import { workflowQueryKeys } from "./workflowQueryKeys";

export function useSteeringDoc(name: string): UseQueryResult<SteeringDoc, NormalizedApiError> {
  return useQuery<SteeringDoc, NormalizedApiError>({
    queryKey: workflowQueryKeys.steeringDoc(name),
    queryFn: () => get<SteeringDoc>(`/api/steering/${encodeURIComponent(name)}`),
  });
}
