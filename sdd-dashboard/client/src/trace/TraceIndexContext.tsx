/**
 * TraceIndexContext — ページ単位で構築した `TraceIndex` を子コンポーネント（RefChip 等）へ
 * 配布する Context（tasks.md 5.3 / design.md「RefChip + CounterpartPopover」
 * Responsibilities「TraceIndex availability」）。
 *
 * RefChip は DocBlockList 越しに深くネストされるため、prop drilling を避けて Context で
 * 供給する（design.md の指定: context preferred）。SpecDocumentPage / ComparePane が
 * `useTraceIndex(feature)` の結果（loading 中は null）をそのまま Provider に渡す。
 *
 * グレースフルロード: trace 未取得（null）でも RefChip は素のテキストで描画できるよう、
 * Context のデフォルト値は null とする（Provider 不在でも crash させない）。
 */
import { createContext, useContext, type JSX, type ReactNode } from "react";
import type { TraceIndex } from "./traceIndex";

const TraceIndexContext = createContext<TraceIndex | null>(null);

export function TraceIndexProvider({
  index,
  children,
}: {
  index: TraceIndex | null;
  children: ReactNode;
}): JSX.Element {
  return <TraceIndexContext.Provider value={index}>{children}</TraceIndexContext.Provider>;
}

/**
 * 現在のページの `TraceIndex` を取得する。Provider 不在・trace 未取得では null を返す
 * （RefChip はそのとき素のテキスト描画にフォールバックする）。
 */
export function useTraceIndexContext(): TraceIndex | null {
  return useContext(TraceIndexContext);
}
