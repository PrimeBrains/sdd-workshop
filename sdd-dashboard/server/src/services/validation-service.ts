/**
 * ValidationService — スペックディレクトリの validation-{gap,design,impl}.md を
 * frontmatter（type / feature / date / decision）+ 構造化本文付きで返す。
 * （design.md Service 層 ValidationService。Requirements 7.4, 7.5）
 *
 * 制約:
 * - キャッシュなし。ファイル読取は KiroScanner.readSpecFile に委譲する
 *   （不在・不正な feature 名は scanner が null を返す = 空配列で表現）
 * - `listForSpec` は SpecService の `readValidations` 注入点
 *   （`(feature: string) => Promise<ValidationReport[]>`）と同一シグネチャ。
 *   接続はタスク 8.1（API 組み立て）で行う
 * - frontmatter 欠落・不正は throw せず、ファイル名由来の type + 要求 feature に
 *   フォールバックし、全文を content に保持 + parse-failure 診断で返す（7.5）
 * - decision は存在時のみ値を持つ（gap レポートは decision キー自体を持たない → null）
 */
import { extractFrontmatter, validateValidationFrontmatter } from "../parsers/frontmatter.js";
import { parseMarkdown } from "../parsers/markdown.js";
import type { ValidationReport, ValidationType } from "../types/resources.js";
import { ARTIFACT_FILES, type KiroScanner } from "./kiro-scanner.js";

/** validation 種別 → ファイル名（gap → design → impl のワークフロー順。返却順もこれに従う） */
const VALIDATION_FILES: ReadonlyArray<{ type: ValidationType; fileName: string }> = [
  { type: "gap", fileName: ARTIFACT_FILES.validationGap },
  { type: "design", fileName: ARTIFACT_FILES.validationDesign },
  { type: "impl", fileName: ARTIFACT_FILES.validationImpl },
];

/** validation レポート読取インターフェース（SpecDetail.validations の供給元） */
export interface ValidationService {
  /** 存在するレポートのみを gap → design → impl 順で返す。spec 不在時は空配列 */
  listForSpec(feature: string): Promise<ValidationReport[]>;
}

/**
 * KiroScanner に紐づく ValidationService を生成する。
 * Postcondition: 返るインスタンスは状態（キャッシュ）を持たない。
 */
export function createValidationService(scanner: KiroScanner): ValidationService {
  return {
    async listForSpec(feature: string): Promise<ValidationReport[]> {
      const reports = await Promise.all(
        VALIDATION_FILES.map(async ({ type, fileName }) => {
          const source = await scanner.readSpecFile(feature, fileName);
          return source === null ? null : buildReport(type, feature, source);
        }),
      );
      return reports.filter((report): report is ValidationReport => report !== null);
    },
  };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * 1 レポートを構造化する（7.4）。frontmatter が有効ならその値を採用し、
 * 欠落・不正時はファイル名由来の type + 要求 feature へフォールバックする（7.5）。
 */
function buildReport(
  fallbackType: ValidationType,
  requestedFeature: string,
  source: string,
): ValidationReport {
  const { sections } = parseMarkdown(source);
  const extraction = extractFrontmatter(source);
  if (extraction.kind === "raw") {
    return {
      type: fallbackType,
      feature: requestedFeature,
      date: null,
      decision: null,
      content: source,
      sections,
      diagnostics: extraction.diagnostics,
    };
  }
  const { frontmatter, diagnostics } = validateValidationFrontmatter(
    extraction.data,
    extraction.position,
  );
  return {
    type: frontmatter?.type ?? fallbackType,
    feature: frontmatter?.feature ?? requestedFeature,
    date: frontmatter?.date ?? null,
    decision: frontmatter?.decision ?? null,
    content: source,
    sections,
    diagnostics,
  };
}
