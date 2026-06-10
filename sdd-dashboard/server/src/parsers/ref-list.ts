/**
 * RefListParser — trace-notation.md の参照文法を解釈する唯一の実装（純粋関数）。
 * （design.md Parser 層 RefListParser。Requirements 6.2, 6.3, 6.6, 6.7）
 *
 * 制約:
 * - FS アクセス禁止。入力は文字列のみ
 * - 例外を投げない。必ず入力トークン数 = 出力要素数（6.7）
 * - 旧範囲表記は「同一 major かつ両端 minor が整数（昇順）」の場合のみ
 *   閉区間で連番展開し `legacy: true` を付ける（6.3）。
 *   major 跨ぎ・非整数・降順・ワイルドカード・括弧付き注記は unparsable
 * - 実在照合（requirements.md との突き合わせ）は TraceGraphBuilder の責務であり行わない
 */
import type { RefToken } from "../types/trace.js";

/** 単一 ID: `1.2`（要件）/ `3`・`3.2`（タスク）。先頭ゼロ等も数値表記なら受理 */
const ID_PATTERN = /^\d+(?:\.\d+)?$/;

/** 旧範囲表記: `<major>.<minor>-<major>.<minor>`（minor は整数表記のみマッチ） */
const RANGE_PATTERN =
  /^(?<fromMajor>\d+)\.(?<fromMinor>\d+)-(?<toMajor>\d+)\.(?<toMinor>\d+)$/;

/** クロス spec 参照: `<feature-name>/<ID>`（例 `sdd-core/1.2`） */
const CROSS_SPEC_PATTERN = /^(?<feature>[A-Za-z0-9][A-Za-z0-9_-]*)\/(?<id>\d+(?:\.\d+)?)$/;

/**
 * ref-list 文字列をカンマ分割し、トークンごとに id / range / cross-spec /
 * unparsable を判別する。空文字列・空白のみは空配列（design.md Preconditions）。
 */
export function parseRefList(input: string): RefToken[] {
  if (input.trim() === "") return [];
  return input.split(",").map((token) => classifyToken(token.trim()));
}

/** 1 トークンを判別する。どの表記にも一致しなければ unparsable（6.7） */
function classifyToken(raw: string): RefToken {
  if (ID_PATTERN.test(raw)) {
    return { kind: "id", id: raw, raw };
  }

  const range = RANGE_PATTERN.exec(raw)?.groups;
  if (range?.fromMajor !== undefined && range.fromMinor !== undefined &&
      range.toMajor !== undefined && range.toMinor !== undefined) {
    const expanded = expandRange(range.fromMajor, range.fromMinor, range.toMajor, range.toMinor);
    if (expanded !== null) {
      return {
        kind: "range",
        from: `${range.fromMajor}.${range.fromMinor}`,
        to: `${range.toMajor}.${range.toMinor}`,
        expanded,
        legacy: true,
        raw,
      };
    }
    return { kind: "unparsable", raw };
  }

  const crossSpec = CROSS_SPEC_PATTERN.exec(raw)?.groups;
  if (crossSpec?.feature !== undefined && crossSpec.id !== undefined) {
    return { kind: "cross-spec", feature: crossSpec.feature, id: crossSpec.id, raw };
  }

  return { kind: "unparsable", raw };
}

/**
 * 同一 major・整数 minor・昇順の場合のみ閉区間で連番展開する（6.3）。
 * 展開不能（major 跨ぎ・降順）は null を返し、呼び出し側で unparsable にする。
 */
function expandRange(
  fromMajor: string,
  fromMinor: string,
  toMajor: string,
  toMinor: string,
): string[] | null {
  if (fromMajor !== toMajor) return null;
  const start = Number.parseInt(fromMinor, 10);
  const end = Number.parseInt(toMinor, 10);
  if (start > end) return null;
  const expanded: string[] = [];
  for (let minor = start; minor <= end; minor += 1) {
    expanded.push(`${fromMajor}.${minor}`);
  }
  return expanded;
}
