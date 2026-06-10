/**
 * FrontmatterParser — 先頭 `---` ブロックの YAML 抽出と既知キー検証（純粋関数）。
 * （design.md Parser 層 FrontmatterParser。Requirements 7.3, 7.4, 7.5, 7.6）
 *
 * 制約:
 * - FS アクセス禁止。入力は文字列 / パース済みマップのみ
 * - frontmatter が欠落・不正な場合は本文全体を RawBlock + 診断で返す（7.5）。
 *   パース失敗はエラーではなく診断であり、どんな入力でも例外を投げない
 * - 既知キー（ADR 9 キー / validation レポート 4 キー）は型を検証するが、
 *   未知キーは欠落させず保持する（情報無欠落原則）
 * - 情報無欠落不変則: 抽出成功時は `position` の範囲 + `body` の連結が
 *   元文書全体と一致し、失敗時は RawBlock が文書全体をカバーする
 */
import YAML from "yaml";
import type { Diagnostic, Position, RawBlock } from "../types/document.js";
import type { AdrFrontmatter, ValidationType } from "../types/resources.js";
import { coverGaps, nodeToPosition, parseMarkdown } from "./markdown.js";

/**
 * frontmatter 抽出結果。
 * - `frontmatter`: 先頭 `---` ブロックを YAML マップとしてパースできた。
 *   `data` は未知キーを含む生のマップ、`body` はブロック直後から文書末尾まで
 * - `raw`: 欠落・構文不正・非マップ。文書全体を RawBlock + 診断で返す（7.5）
 */
export type FrontmatterExtraction =
  | {
      kind: "frontmatter";
      /** パース済み YAML マップ（既知・未知キーすべて保持） */
      data: Record<string, unknown>;
      /** `---` ブロック（区切り行含む）のソース位置 */
      position: Position;
      /** frontmatter ブロック直後から文書末尾までの本文（改行含む生スライス） */
      body: string;
    }
  | {
      kind: "raw";
      /** 文書全体の生 markdown フォールバック */
      raw: RawBlock;
      /** parse-failure 診断（位置を特定できる場合はブロック位置付き） */
      diagnostics: Diagnostic[];
    };

/** 既知キー検証の結果。違反が 1 件でもあれば frontmatter は null + 違反ごとの診断 */
export interface KnownKeyResult<T> {
  frontmatter: T | null;
  diagnostics: Diagnostic[];
}

/** validation レポート frontmatter（7.4 の既知 4 キー。未知キーは保持） */
export interface ValidationFrontmatter {
  type: ValidationType;
  feature: string;
  /** 欠落時 null */
  date: string | null;
  /** 欠落時 null（gap レポートは decision を持たない） */
  decision: string | null;
  /** 規約外の未知キー（保持のみ。落とさない） */
  [key: string]: unknown;
}

const MISSING_FRONTMATTER_MESSAGE = "frontmatter が欠落しています（先頭 --- ブロックなし）";
const NOT_A_MAP_MESSAGE = "frontmatter が YAML マップではありません";

const VALIDATION_TYPES: readonly string[] = ["gap", "design", "impl"];

/**
 * 先頭 `---` ブロックを YAML マップとして抽出する。
 * Postcondition: 例外を投げない。失敗時は文書全体を RawBlock + 診断で返す（7.5）。
 */
export function extractFrontmatter(source: string): FrontmatterExtraction {
  const { tree } = parseMarkdown(source);
  const first = tree.children[0];
  if (first === undefined || first.type !== "yaml") {
    return rawFallback(source, MISSING_FRONTMATTER_MESSAGE, null);
  }
  const position = nodeToPosition(first);
  if (position === null) {
    // remark-frontmatter は常に position を付与するため到達しない想定の防衛
    return rawFallback(source, MISSING_FRONTMATTER_MESSAGE, null);
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(first.value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return rawFallback(source, `frontmatter の YAML 構文が不正です: ${detail}`, position);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return rawFallback(source, NOT_A_MAP_MESSAGE, position);
  }
  return {
    kind: "frontmatter",
    data: parsed as Record<string, unknown>,
    position,
    body: source.slice(position.endOffset),
  };
}

/**
 * ADR frontmatter の既知 9 キー（adr.md 規約）を検証する（7.3, 7.6）。
 * - 必須: id (number) / title / status / date (string) / specs / requirements (string[])
 * - nullable: app / supersedes / superseded_by（欠落・null → null。7.6）
 * - 未知キーはそのまま保持。違反が 1 件でもあれば frontmatter: null + 違反ごとの診断
 */
export function validateAdrFrontmatter(
  data: Record<string, unknown>,
  position: Position | null = null,
): KnownKeyResult<AdrFrontmatter> {
  const diagnostics: Diagnostic[] = [];
  const id = requireNumber(data, "id", diagnostics, position);
  const title = requireString(data, "title", diagnostics, position);
  const status = requireString(data, "status", diagnostics, position);
  const date = requireString(data, "date", diagnostics, position);
  const app = nullableString(data, "app", diagnostics, position);
  const specs = requireStringArray(data, "specs", diagnostics, position);
  const requirements = requireStringArray(data, "requirements", diagnostics, position);
  const supersedes = nullableString(data, "supersedes", diagnostics, position);
  const supersededBy = nullableString(data, "superseded_by", diagnostics, position);

  if (
    id === undefined ||
    title === undefined ||
    status === undefined ||
    date === undefined ||
    app === undefined ||
    specs === undefined ||
    requirements === undefined ||
    supersedes === undefined ||
    supersededBy === undefined
  ) {
    return { frontmatter: null, diagnostics };
  }
  return {
    frontmatter: {
      ...data,
      id,
      title,
      status,
      date,
      app,
      specs,
      requirements,
      supersedes,
      superseded_by: supersededBy,
    },
    diagnostics,
  };
}

/**
 * validation レポート frontmatter の既知 4 キーを検証する（7.4）。
 * - 必須: type ("gap" | "design" | "impl") / feature (string)
 * - nullable: date / decision（欠落・null → null）
 * - 未知キーはそのまま保持。違反が 1 件でもあれば frontmatter: null + 違反ごとの診断
 */
export function validateValidationFrontmatter(
  data: Record<string, unknown>,
  position: Position | null = null,
): KnownKeyResult<ValidationFrontmatter> {
  const diagnostics: Diagnostic[] = [];
  const type = requireValidationType(data, diagnostics, position);
  const feature = requireString(data, "feature", diagnostics, position);
  const date = nullableString(data, "date", diagnostics, position);
  const decision = nullableString(data, "decision", diagnostics, position);

  if (type === undefined || feature === undefined || date === undefined || decision === undefined) {
    return { frontmatter: null, diagnostics };
  }
  return {
    frontmatter: { ...data, type, feature, date, decision },
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** 文書全体を RawBlock + parse-failure 診断で返す（7.5）。reason と診断 message は同一文字列 */
function rawFallback(
  source: string,
  reason: string,
  blockPosition: Position | null,
): FrontmatterExtraction {
  // coverGaps([], …) は文書全体を 1 個の RawBlock として返す（空文書は空配列）
  const raw: RawBlock = coverGaps(source, [], reason)[0] ?? {
    kind: "raw",
    position: { startLine: 1, endLine: 1, startOffset: 0, endOffset: 0 },
    markdown: "",
    reason,
  };
  return {
    kind: "raw",
    raw,
    diagnostics: [{ kind: "parse-failure", message: reason, position: blockPosition }],
  };
}

function missingKeyDiagnostic(key: string, position: Position | null): Diagnostic {
  return {
    kind: "missing-key",
    message: `frontmatter の必須キー "${key}" が欠落しています`,
    position,
  };
}

function invalidKeyDiagnostic(key: string, expected: string, position: Position | null): Diagnostic {
  return {
    kind: "invalid-key",
    message: `frontmatter キー "${key}" の型が不正です（期待: ${expected}）`,
    position,
  };
}

/** 必須 string キー。欠落 → missing-key、型不正 → invalid-key（いずれも undefined を返す） */
function requireString(
  data: Record<string, unknown>,
  key: string,
  diagnostics: Diagnostic[],
  position: Position | null,
): string | undefined {
  const value = data[key];
  if (typeof value === "string") {
    return value;
  }
  diagnostics.push(
    value === undefined
      ? missingKeyDiagnostic(key, position)
      : invalidKeyDiagnostic(key, "string", position),
  );
  return undefined;
}

/** 必須 number キー（有限数のみ） */
function requireNumber(
  data: Record<string, unknown>,
  key: string,
  diagnostics: Diagnostic[],
  position: Position | null,
): number | undefined {
  const value = data[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  diagnostics.push(
    value === undefined
      ? missingKeyDiagnostic(key, position)
      : invalidKeyDiagnostic(key, "number", position),
  );
  return undefined;
}

/** 必須 string[] キー（全要素 string の配列のみ） */
function requireStringArray(
  data: Record<string, unknown>,
  key: string,
  diagnostics: Diagnostic[],
  position: Position | null,
): string[] | undefined {
  const value = data[key];
  if (Array.isArray(value) && value.every((item): item is string => typeof item === "string")) {
    return value;
  }
  diagnostics.push(
    value === undefined
      ? missingKeyDiagnostic(key, position)
      : invalidKeyDiagnostic(key, "string[]", position),
  );
  return undefined;
}

/** nullable string キー。欠落・明示 null → null（診断なし）、それ以外の非 string → invalid-key */
function nullableString(
  data: Record<string, unknown>,
  key: string,
  diagnostics: Diagnostic[],
  position: Position | null,
): string | null | undefined {
  const value = data[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  diagnostics.push(invalidKeyDiagnostic(key, "string | null", position));
  return undefined;
}

/** 必須 type キー（"gap" | "design" | "impl" のみ） */
function requireValidationType(
  data: Record<string, unknown>,
  diagnostics: Diagnostic[],
  position: Position | null,
): ValidationType | undefined {
  const value = data["type"];
  if (typeof value === "string" && VALIDATION_TYPES.includes(value)) {
    return value as ValidationType;
  }
  diagnostics.push(
    value === undefined
      ? missingKeyDiagnostic("type", position)
      : invalidKeyDiagnostic("type", '"gap" | "design" | "impl"', position),
  );
  return undefined;
}
