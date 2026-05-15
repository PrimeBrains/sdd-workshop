/**
 * Unit Conversion Module (Actual Cost)
 *
 * 工数の単位変換ロジック（純関数）。
 * 1 人日 (MD) = 8 時間 (h) として相互変換する。
 * Progress Input Panel の MD/h トグル UI から切り離してテスト可能にするため、
 * 副作用なしの純関数として実装する。
 *
 * Requirements: 8.4, 8.5, 8.6
 */

/** 人日 (MD) → 時間 (h) に変換する。 */
export function mdToHours(md: number): number {
  return md * 8
}

/** 時間 (h) → 人日 (MD) に変換する。 */
export function hoursToMd(h: number): number {
  return h / 8
}
