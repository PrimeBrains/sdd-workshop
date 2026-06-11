/**
 * GET /api/skills の useQuery 薄ラッパ（design.md KnowledgeQueryHooks）。
 * review-ui の `get` を再利用し、変換・解釈をしない（エラーは NormalizedApiError のまま透過）。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SkillSummary } from "@contracts/resources";
import { get, type NormalizedApiError } from "@/api/client";
import { workflowQueryKeys } from "./workflowQueryKeys";

export function useSkillList(): UseQueryResult<SkillSummary[], NormalizedApiError> {
  return useQuery<SkillSummary[], NormalizedApiError>({
    queryKey: workflowQueryKeys.skillList,
    queryFn: () => get<SkillSummary[]>("/api/skills"),
  });
}
