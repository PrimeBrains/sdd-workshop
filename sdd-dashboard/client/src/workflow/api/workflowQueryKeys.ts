/**
 * ワークフロー・ナレッジ（steering / skills / adr）クエリキーの唯一の定義場所
 * （design.md「workflowQueryKeys.ts # steering / skills / adr クエリキーの唯一の定義」）。
 *
 * review-ui の queryKeys.ts と同規律: タプルは `as const`、パラメータ付きは関数。
 * 本文キーは一覧キーと先頭要素を共有し、task 1.4 の prefix 無効化
 * （['steering'] / ['skills'] / ['adr']）が一覧・本文の双方へ波及することを保証する。
 * 値の変更はキャッシュ無効化経路を壊す破壊的変更（workflowQueryKeys.test.ts が厳密値で固定）。
 */
export const workflowQueryKeys = {
  /** GET /api/steering */
  steeringList: ["steering"],
  /** GET /api/steering/:name */
  steeringDoc: (name: string) => ["steering", name] as const,
  /** GET /api/skills */
  skillList: ["skills"],
  /** GET /api/skills/:name */
  skillDoc: (name: string) => ["skills", name] as const,
  /** GET /api/adr */
  adrList: ["adr"],
  /** GET /api/adr/:id */
  adrDoc: (id: string) => ["adr", id] as const,
} as const;
