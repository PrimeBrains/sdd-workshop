/**
 * クエリキー定義の唯一の場所（design.md Data Models / File Structure Plan）。
 * SseInvalidationBridge（api/sse/useChangeEvents.ts）は無効化時に必ずここの定義を共有する。
 * 値の変更はキャッシュ無効化経路を壊す破壊的変更（queryKeys.test.ts が厳密値で固定）。
 */
export const queryKeys = {
  /** GET /api/repo */
  repo: ["repo"],
  /** GET /api/specs */
  specs: ["specs"],
  /** GET /api/specs/:feature */
  spec: (feature: string) => ["spec", feature] as const,
  /** GET /api/specs/:feature/trace */
  trace: (feature: string) => ["trace", feature] as const,
} as const;
