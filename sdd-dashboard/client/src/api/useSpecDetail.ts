/**
 * GET /api/specs/:feature の useQuery 薄ラッパ（design.md QueryHooks）。変換・解釈をしない。
 * Precondition: `feature` はルートパラメータ由来（空文字では呼び出さない）。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SpecDetail } from "@contracts/spec";
import { get, type NormalizedApiError } from "./client";
import { queryKeys } from "./queryKeys";

export function useSpecDetail(feature: string): UseQueryResult<SpecDetail, NormalizedApiError> {
  return useQuery<SpecDetail, NormalizedApiError>({
    queryKey: queryKeys.spec(feature),
    queryFn: () => get<SpecDetail>(`/api/specs/${encodeURIComponent(feature)}`),
  });
}
