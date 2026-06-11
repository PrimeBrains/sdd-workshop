/**
 * GET /api/adr/:id の useQuery 薄ラッパ（design.md KnowledgeQueryHooks）。
 * review-ui の `get` を再利用し、変換・解釈をしない（エラーは NormalizedApiError のまま透過）。
 * Precondition: `id` はルートパラメータ由来（空文字では呼び出さない）。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { AdrDoc } from "@contracts/resources";
import { get, type NormalizedApiError } from "@/api/client";
import { workflowQueryKeys } from "./workflowQueryKeys";

export function useAdrDoc(id: string): UseQueryResult<AdrDoc, NormalizedApiError> {
  return useQuery<AdrDoc, NormalizedApiError>({
    queryKey: workflowQueryKeys.adrDoc(id),
    queryFn: () => get<AdrDoc>(`/api/adr/${encodeURIComponent(id)}`),
  });
}
