/**
 * SpecJsonParser — spec.json 文字列の構造化メタデータ変換（純粋関数）。
 * （design.md Parser 層 SpecJsonParser。Requirements 2.3, 2.5）
 *
 * 制約:
 * - FS アクセス禁止。入力はファイル内容の文字列（欠落時は null）のみ。
 *   ファイル読取・feature 名・artifacts の合成は SpecService が担う
 * - パース失敗はエラーではなく診断であり、どんな入力でも例外を投げない。
 *   欠落・不正 JSON でもメタデータを全 null + parse-failure 診断で返し、
 *   エントリ自体を落とさない（2.3）
 * - 任意の `app` フィールドは `app: string | null` として公開し、
 *   欠落・明示 null は診断なしで null（未分類）とする（2.5）
 * - フィールド単位の欠落・型不正は当該フィールドのみ null + 診断とし、
 *   他フィールドの抽出を継続する（SpecSummary の null + diagnostics 契約）
 */
import type { Diagnostic } from "../types/document.js";
import type { PhaseApproval, PhaseName, SpecApprovals } from "../types/spec.js";

/**
 * spec.json 由来のメタデータ（SpecSummary のうち SpecJsonParser が担う部分集合）。
 * feature / artifacts は呼び出し側（SpecService）がディレクトリ走査から補完する。
 */
export interface SpecJsonMeta {
  /** 任意の所属アプリ。欠落・null 時は null = 未分類（2.5） */
  app: string | null;
  phase: string | null;
  language: string | null;
  approvals: SpecApprovals | null;
  readyForImplementation: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * パース結果。失敗でもエントリを残すため常にこの形で返る（2.3）。
 * - 成功: meta に抽出値、raw は null
 * - JSON 構文不正・非オブジェクト: meta 全 null、raw に元文字列を保持（情報無欠落）
 * - 欠落（source: null）: meta 全 null、raw も null
 */
export interface SpecJsonParseResult {
  meta: SpecJsonMeta;
  /** JSON として解釈できなかった場合の元文字列。成功・ファイル欠落時は null */
  raw: string | null;
  diagnostics: Diagnostic[];
}

const PHASE_NAMES: readonly PhaseName[] = ["requirements", "design", "tasks"];

/**
 * spec.json の内容文字列を構造化メタデータへ変換する。
 * @param source ファイル内容。ファイル欠落時は null を渡す
 * Postcondition: 例外を投げない。診断の position は常に null（JSON に行位置概念を持たせない）
 */
export function parseSpecJson(source: string | null): SpecJsonParseResult {
  if (source === null) {
    return failure(null, "spec.json が存在しません");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return failure(source, `spec.json の JSON 構文が不正です: ${detail}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return failure(source, "spec.json のトップレベルが JSON オブジェクトではありません");
  }

  const data = parsed as Record<string, unknown>;
  const diagnostics: Diagnostic[] = [];
  return {
    meta: {
      app: optionalString(data, "app", diagnostics),
      phase: requireString(data, "phase", diagnostics),
      language: requireString(data, "language", diagnostics),
      approvals: requireApprovals(data, diagnostics),
      readyForImplementation: requireBoolean(data, "ready_for_implementation", diagnostics),
      createdAt: requireString(data, "created_at", diagnostics),
      updatedAt: requireString(data, "updated_at", diagnostics),
    },
    raw: null,
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** 全 null メタ + parse-failure 診断（2.3。raw は JSON として読めなかった元文字列） */
function failure(raw: string | null, message: string): SpecJsonParseResult {
  return {
    meta: {
      app: null,
      phase: null,
      language: null,
      approvals: null,
      readyForImplementation: null,
      createdAt: null,
      updatedAt: null,
    },
    raw,
    diagnostics: [{ kind: "parse-failure", message, position: null }],
  };
}

function missingKeyDiagnostic(key: string): Diagnostic {
  return {
    kind: "missing-key",
    message: `spec.json の必須キー "${key}" が欠落しています`,
    position: null,
  };
}

function invalidKeyDiagnostic(key: string, expected: string): Diagnostic {
  return {
    kind: "invalid-key",
    message: `spec.json キー "${key}" の型が不正です（期待: ${expected}）`,
    position: null,
  };
}

/** 必須 string キー。欠落 → missing-key、型不正 → invalid-key（いずれも null を返す） */
function requireString(
  data: Record<string, unknown>,
  key: string,
  diagnostics: Diagnostic[],
): string | null {
  const value = data[key];
  if (typeof value === "string") {
    return value;
  }
  diagnostics.push(
    value === undefined ? missingKeyDiagnostic(key) : invalidKeyDiagnostic(key, "string"),
  );
  return null;
}

/** 必須 boolean キー */
function requireBoolean(
  data: Record<string, unknown>,
  key: string,
  diagnostics: Diagnostic[],
): boolean | null {
  const value = data[key];
  if (typeof value === "boolean") {
    return value;
  }
  diagnostics.push(
    value === undefined ? missingKeyDiagnostic(key) : invalidKeyDiagnostic(key, "boolean"),
  );
  return null;
}

/** 任意 string キー。欠落・明示 null は診断なしで null（2.5）、非 string → invalid-key */
function optionalString(
  data: Record<string, unknown>,
  key: string,
  diagnostics: Diagnostic[],
): string | null {
  const value = data[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  diagnostics.push(invalidKeyDiagnostic(key, "string | null"));
  return null;
}

/**
 * 必須 approvals キー。requirements / design / tasks の 3 フェーズすべてが
 * `{ generated: boolean, approved: boolean }` の形である場合のみ採用し、
 * それ以外は全体を null + 診断 1 件とする（フェーズ間順序の検証は ApprovalWriter の責務）
 */
function requireApprovals(
  data: Record<string, unknown>,
  diagnostics: Diagnostic[],
): SpecApprovals | null {
  const value = data["approvals"];
  if (value === undefined) {
    diagnostics.push(missingKeyDiagnostic("approvals"));
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    diagnostics.push(invalidKeyDiagnostic("approvals", "Record<PhaseName, PhaseApproval>"));
    return null;
  }
  const record = value as Record<string, unknown>;
  const result: Partial<Record<PhaseName, PhaseApproval>> = {};
  for (const phase of PHASE_NAMES) {
    const entry = toPhaseApproval(record[phase]);
    if (entry === null) {
      diagnostics.push(invalidKeyDiagnostic("approvals", "Record<PhaseName, PhaseApproval>"));
      return null;
    }
    result[phase] = entry;
  }
  return result as SpecApprovals;
}

/** `{ generated: boolean, approved: boolean }` 形のみ採用（未知キーは無視） */
function toPhaseApproval(value: unknown): PhaseApproval | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const { generated, approved } = value as Record<string, unknown>;
  if (typeof generated !== "boolean" || typeof approved !== "boolean") {
    return null;
  }
  return { generated, approved };
}
