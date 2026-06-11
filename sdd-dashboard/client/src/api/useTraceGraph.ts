/**
 * GET /api/specs/:feature/trace の useQuery 薄ラッパ（design.md QueryHooks）。変換・解釈をしない。
 * Precondition: `feature` はルートパラメータ由来（空文字では呼び出さない）。
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TraceGraph } from "@contracts/trace";
import { get, type NormalizedApiError } from "./client";
import { queryKeys } from "./queryKeys";

export function useTraceGraph(feature: string): UseQueryResult<TraceGraph, NormalizedApiError> {
  return useQuery<TraceGraph, NormalizedApiError>({
    queryKey: queryKeys.trace(feature),
    queryFn: () => get<TraceGraph>(`/api/specs/${encodeURIComponent(feature)}/trace`),
  });
}
