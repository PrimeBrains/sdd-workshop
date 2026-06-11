/**
 * WorkflowInvalidationMap（design.md「WorkflowInvalidationMap」, Requirements 8.1 / 8.3）。
 *
 * review-ui の SseInvalidationBridge 拡張点（`InvalidationMap`）へ steering / skill / adr の
 * カテゴリ写像を追加する唯一の所有者。プレフィックス invalidate（`['steering']` 等）により
 * 一覧キーと本文キー（`['steering', name]`）の双方が無効化される。
 *
 * - `spec` カテゴリは review-ui 所有のまま（ボードの `['specs']` はそれで無効化される）→ ここでは持たない
 * - `other` カテゴリは写像なし（8.3）
 * - 結合（DEFAULT spread）は `integration.tsx` の `appChangeEventsMap` で行う。本マップ単体は
 *   ワークフロー 3 カテゴリのみを宣言し、`spec`/`other` を含まない（境界の単純さを保つ）
 *
 * キー値の唯一の出所は `workflowQueryKeys`（一覧キー）。値の変更は無効化経路を壊す破壊的変更。
 */
import type { InvalidationMap } from "@/api/sse/useChangeEvents";
import { workflowQueryKeys } from "@/workflow/api/workflowQueryKeys";

export const workflowInvalidationMap: InvalidationMap = {
  steering: () => [workflowQueryKeys.steeringList],
  skill: () => [workflowQueryKeys.skillList],
  adr: () => [workflowQueryKeys.adrList],
};
