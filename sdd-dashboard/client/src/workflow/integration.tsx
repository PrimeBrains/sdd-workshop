/**
 * Workflow ShellIntegration（design.md「WorkflowRoutes + ShellIntegration」, Requirements 8.1 / 8.3 / 9.1 / 9.2）。
 *
 * review-ui が公開する 2 つの拡張点への接続を 1 箇所に集約する:
 * - SseInvalidationBridge（`useChangeEvents`）へ steering/skill/adr カテゴリ写像を注入する
 *   `appChangeEventsMap` を提供する
 * - `SpecActionSlot.register` へ操作 UI のレンダラを登録する `registerWorkflow()` を提供する
 *
 * 設計上は「`main.tsx` から 1 行で呼び出す」とされているが、`useChangeEvents` /
 * `useSpecActionSlot` は React フックであり、`SpecActionSlotProvider` 配下のコンポーネント
 * ツリー内でのみ実行できる。そのため実際の連結は AppShell（宣言済み Modified File）の接続点で行う:
 * - AppShell の `useChangeEvents()` 呼び出しへ `appChangeEventsMap` を渡す
 * - `<WorkflowSlotRegistrar/>` を Provider 配下にマウントし、`registerWorkflow` を登録/解除する
 */
import { useEffect, type JSX } from "react";
import {
  DEFAULT_INVALIDATION_MAP,
  type InvalidationMap,
} from "@/api/sse/useChangeEvents";
import { useSpecActionSlot, type SpecActionSlotApi } from "@/app/SpecActionSlot";
import { workflowInvalidationMap } from "@/workflow/api/invalidationMap";

/**
 * ライブ Bridge へ渡す結合済み写像。DEFAULT を spread して `spec`（review-ui 所有）を保持しつつ、
 * ワークフローの steering/skill/adr を追加する（merge-not-replace: `useChangeEvents(map)` は
 * 既定マップを「置換」するため、必ず DEFAULT を含める必要がある）。
 */
export const appChangeEventsMap: InvalidationMap = {
  ...DEFAULT_INVALIDATION_MAP,
  ...workflowInvalidationMap,
};

/**
 * SpecActionSlot へワークフローの操作 UI レンダラを登録する。戻り値は解除関数。
 * タスク 4.1 までは何も描画しない（`SpecWorkflowActions` は 4.1 で差し替える）。
 */
export function registerWorkflow(slot: SpecActionSlotApi): () => void {
  return slot.register(() => null);
}

/**
 * `SpecActionSlotProvider` 配下でワークフロー登録を行う最小コンポーネント。
 * マウント時に `registerWorkflow` を実行し、アンマウント時に解除する。AppShell が描画する。
 */
export function WorkflowSlotRegistrar(): JSX.Element | null {
  const slot = useSpecActionSlot();
  useEffect(() => registerWorkflow(slot), [slot]);
  return null;
}
