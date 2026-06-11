/**
 * GET /api/repo の useQuery 薄ラッパ（design.md QueryHooks）。変換・解釈をしない。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { RepoInfo } from "@contracts/api";
import { get, type NormalizedApiError } from "./client";
import { queryKeys } from "./queryKeys";

export function useRepoInfo(): UseQueryResult<RepoInfo, NormalizedApiError> {
  return useQuery<RepoInfo, NormalizedApiError>({
    queryKey: queryKeys.repo,
    queryFn: () => get<RepoInfo>("/api/repo"),
  });
}
