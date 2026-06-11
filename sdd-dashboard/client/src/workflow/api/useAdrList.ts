/**
 * GET /api/adr の useQuery 薄ラッパ（design.md KnowledgeQueryHooks）。
 * review-ui の `get` を再利用し、変換・解釈をしない（エラーは NormalizedApiError のまま透過）。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { AdrSummary } from "@contracts/resources";
import { get, type NormalizedApiError } from "@/api/client";
import { workflowQueryKeys } from "./workflowQueryKeys";

export function useAdrList(): UseQueryResult<AdrSummary[], NormalizedApiError> {
  return useQuery<AdrSummary[], NormalizedApiError>({
    queryKey: workflowQueryKeys.adrList,
    queryFn: () => get<AdrSummary[]>("/api/adr"),
  });
}
