/**
 * useTraceIndex（design.md File Structure Plan / tasks.md 5.1）。
 *
 * `useTraceGraph`（api 層）と `buildTraceIndex`（純粋関数）を合成するフック。
 * グラフ取得済みのときのみ `TraceIndex` を構築し、graph をキーに `useMemo` で再計算を抑える。
 * loading / error / undefined では `index: null` を返し、呼び出し側がグレースフルに扱えるようにする。
 */
import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { TraceGraph } from "@contracts/trace";
import type { NormalizedApiError } from "@/api/client";
import { useTraceGraph } from "@/api/useTraceGraph";
import { buildTraceIndex, type TraceIndex } from "./traceIndex";

export interface UseTraceIndexResult {
  index: TraceIndex | null;
  query: UseQueryResult<TraceGraph, NormalizedApiError>;
}

export function useTraceIndex(feature: string): UseTraceIndexResult {
  const query = useTraceGraph(feature);
  const graph = query.data;
  const index = useMemo(() => (graph === undefined ? null : buildTraceIndex(graph)), [graph]);
  return { index, query };
}
