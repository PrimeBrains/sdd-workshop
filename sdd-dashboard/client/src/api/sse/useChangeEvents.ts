/**
 * SseInvalidationBridge — `ChangeEvent` の消費とクエリ無効化の唯一の経路
 * （design.md「SseInvalidationBridge（api/sse/useChangeEvents.ts）」/ Event Contract /
 * 「SSE 変更反映フロー」、Requirements 7.1 / 7.4、tasks.md 9.1）。
 *
 * 本タスク（9.1）の責務:
 * - `GET /api/events` へ `EventSource` で接続し `event: change` を購読する
 * - category 別キー写像で `QueryClient.invalidateQueries`（`refetchType: 'active'`）へ橋渡し
 *   - `spec` → `['specs']` + `['spec', feature]` + `['trace', feature]`
 *   - `steering` / `skill` / `adr` / `other` → 写像なし（何もしない → 7.4）
 * - 写像テーブル（DEFAULT_INVALIDATION_MAP / InvalidationMap）は export し、
 *   workflow-ui がエントリを追加できる拡張点とする
 * - 同一マイクロタスク内の連続イベントはキーを集約し 1 度の flush にまとめる（AI 生成バースト対策）
 * - アンマウント時に `EventSource.close()`（リソースリーク防止）
 *
 * NOTE: 接続状態のリアル管理（onerror→reconnecting / onopen→全キー回復）と ConnectionBanner は
 * タスク 9.2 の範囲。本タスクは最小限の `status`（"connected"）のみ公開する。
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { ChangeEvent } from "@contracts/events";
import { queryKeys } from "@/api/queryKeys";

/** SSE 接続状態（design.md Event Contract）。reconnecting への遷移は 9.2 で導入する */
export type SseStatus = "connected" | "reconnecting";

/**
 * category → 無効化キー生成。workflow-ui が将来エントリを追加する拡張点
 * （design.md Event Contract）。未定義カテゴリは写像なし（何もしない → 7.4）。
 */
export type InvalidationMap = Partial<
  Record<ChangeEvent["category"], (event: ChangeEvent) => QueryKey[]>
>;

/**
 * 既定の写像。`spec` のみを `['specs']` + `['spec', feature]` + `['trace', feature]` へ写像する。
 * 呼び出し側は本マップを spread で拡張できる（`{ ...DEFAULT_INVALIDATION_MAP, steering: ... }`）。
 */
export const DEFAULT_INVALIDATION_MAP: InvalidationMap = {
  spec: (event) => {
    if (event.feature === null) return [queryKeys.specs];
    return [queryKeys.specs, queryKeys.spec(event.feature), queryKeys.trace(event.feature)];
  },
};

/** SSE エンドポイント（design.md: `GET /api/events`） */
const EVENTS_PATH = "/api/events";

/** QueryKey を集合キーとして比較するための安定シリアライズ */
function serializeKey(key: QueryKey): string {
  return JSON.stringify(key);
}

export function useChangeEvents(map?: InvalidationMap): { status: SseStatus } {
  const queryClient = useQueryClient();
  // 接続状態。9.1 では connected 固定（onerror/onopen 制御は 9.2）。
  const [status] = useState<SseStatus>("connected");

  // 最新の写像をイベントハンドラから参照する（依存配列で再接続しないため ref 経由）。
  const mapRef = useRef<InvalidationMap>(map ?? DEFAULT_INVALIDATION_MAP);
  mapRef.current = map ?? DEFAULT_INVALIDATION_MAP;

  useEffect(() => {
    const source = new EventSource(EVENTS_PATH);

    // 同一マイクロタスク内のバーストを集約するバッファ。シリアライズ済みキー → 実キー。
    let pending: Map<string, QueryKey> | null = null;

    const flush = () => {
      const batch = pending;
      pending = null;
      if (batch === null) return;
      for (const key of batch.values()) {
        void queryClient.invalidateQueries({ queryKey: key, refetchType: "active" });
      }
    };

    const enqueue = (keys: QueryKey[]) => {
      if (keys.length === 0) return;
      if (pending === null) {
        pending = new Map();
        queueMicrotask(flush);
      }
      for (const key of keys) pending.set(serializeKey(key), key);
    };

    const handleChange = (event: MessageEvent) => {
      let payload: ChangeEvent;
      try {
        payload = JSON.parse(event.data) as ChangeEvent;
      } catch {
        // 解釈不能なペイロードは無視（イベント自体をデータとして保持しない契約）
        return;
      }
      const toKeys = mapRef.current[payload.category];
      if (toKeys === undefined) return; // 写像なしカテゴリ → 何もしない（7.4）
      enqueue(toKeys(payload));
    };

    source.addEventListener("change", handleChange);

    return () => {
      source.removeEventListener("change", handleChange);
      source.close();
    };
    // queryClient は安定参照。map は ref（mapRef）で参照するため依存に含めず、
    // 写像変更で EventSource を張り直さない（接続を維持する）。
  }, [queryClient]);

  return { status };
}
