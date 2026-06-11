/**
 * GET /api/skills/:name の useQuery 薄ラッパ（design.md KnowledgeQueryHooks）。
 * review-ui の `get` を再利用し、変換・解釈をしない（エラーは NormalizedApiError のまま透過）。
 * Precondition: `name` はルートパラメータ由来（空文字では呼び出さない）。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SkillDoc } from "@contracts/resources";
import { get, type NormalizedApiError } from "@/api/client";
import { workflowQueryKeys } from "./workflowQueryKeys";

export function useSkillDoc(name: string): UseQueryResult<SkillDoc, NormalizedApiError> {
  return useQuery<SkillDoc, NormalizedApiError>({
    queryKey: workflowQueryKeys.skillDoc(name),
    queryFn: () => get<SkillDoc>(`/api/skills/${encodeURIComponent(name)}`),
  });
}
