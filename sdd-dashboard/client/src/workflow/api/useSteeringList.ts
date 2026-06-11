/**
 * GET /api/steering の useQuery 薄ラッパ（design.md KnowledgeQueryHooks）。
 * review-ui の `get` を再利用し、変換・解釈をしない（エラーは NormalizedApiError のまま透過）。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SteeringDocSummary } from "@contracts/resources";
import { get, type NormalizedApiError } from "@/api/client";
import { workflowQueryKeys } from "./workflowQueryKeys";

export function useSteeringList(): UseQueryResult<SteeringDocSummary[], NormalizedApiError> {
  return useQuery<SteeringDocSummary[], NormalizedApiError>({
    queryKey: workflowQueryKeys.steeringList,
    queryFn: () => get<SteeringDocSummary[]>("/api/steering"),
  });
}
