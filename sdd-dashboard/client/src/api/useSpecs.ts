/**
 * GET /api/specs の useQuery 薄ラッパ（design.md QueryHooks）。変換・解釈をしない。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SpecSummary } from "@contracts/spec";
import { get, type NormalizedApiError } from "./client";
import { queryKeys } from "./queryKeys";

export function useSpecs(): UseQueryResult<SpecSummary[], NormalizedApiError> {
  return useQuery<SpecSummary[], NormalizedApiError>({
    queryKey: queryKeys.specs,
    queryFn: () => get<SpecSummary[]>("/api/specs"),
  });
}
