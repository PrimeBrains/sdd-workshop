/**
 * EventBus — プロセス内の型付き pub/sub（design.md Watch 層 EventBus。Requirements 8.2, 8.5, 8.6）。
 *
 * - subscribe は unsubscribe 関数を返す。SSE 側は onAbort で必ず呼ぶ（8.5）
 * - publish は登録中の全 subscriber へ同期的に同報する（8.6）
 * - ある listener の例外は他の listener への配信を妨げない
 */
import type { ChangeEvent } from "../types/events.js";

/** ChangeEvent の配信ハブ（design.md Event Contract） */
export interface EventBus {
  /** 登録中の全 subscriber へ同期配信する */
  publish(event: ChangeEvent): void;
  /** listener を登録し、解除関数を返す（二重呼び出しは no-op） */
  subscribe(listener: (event: ChangeEvent) => void): () => void;
  /** 現在登録中の subscriber 数（切断時のリソース解放検証用。8.5） */
  subscriberCount(): number;
}

/**
 * 新しい EventBus を生成する。
 * 同一 listener 関数の複数回 subscribe は独立した購読として扱う。
 */
export function createEventBus(): EventBus {
  const subscriptions = new Set<{ readonly listener: (event: ChangeEvent) => void }>();

  return {
    publish(event: ChangeEvent): void {
      // 配信中の subscribe/unsubscribe で反復が壊れないようスナップショットを取る
      for (const subscription of [...subscriptions]) {
        try {
          subscription.listener(event);
        } catch (error) {
          // 1 subscriber の失敗で他クライアントへの配信を止めない（8.6）
          console.error("[event-bus] listener threw:", error);
        }
      }
    },

    subscribe(listener: (event: ChangeEvent) => void): () => void {
      const subscription = { listener };
      subscriptions.add(subscription);
      return () => {
        subscriptions.delete(subscription);
      };
    },

    subscriberCount(): number {
      return subscriptions.size;
    },
  };
}
