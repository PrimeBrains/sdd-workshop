/**
 * QueryClient 設定（design.md File Structure Plan「再試行・staleTime」）。
 * ローカル単一ユーザーツール向けのデフォルト選定（queryClient.test.ts が厳密値で固定）:
 *
 * - retry: 1 — 一過性の失敗のみ吸収する。失敗を再試行ループで隠さず速やかに
 *   ErrorPanel へ到達させ、以降の再試行は Requirement 1.5 の再試行ボタン（手動）に委ねる
 * - staleTime: 30_000 — 鮮度の主経路は SSE 無効化（SseInvalidationBridge）。
 *   マウントの度の再取得を避けつつ、SSE 不通時も 30 秒で自然回復する
 * - refetchOnWindowFocus: false — ローカルツールではフォーカス切替が頻繁で、
 *   フォーカス再取得は不要なリクエストを生むだけ（鮮度は SSE が担う）
 */
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
