/**
 * SpecService — `.kiro/specs/` の一覧 / 詳細をパーサー合成で構造化して返す。
 * （design.md Service 層 SpecService。Requirements 1.4, 2.1, 2.2, 2.4）
 *
 * 制約:
 * - 毎リクエストでファイルを読み直す（キャッシュなし）。これにより
 *   ディスク変更が再起動なしで次のレスポンスへ反映される（1.4, 2.4。research.md Decision）
 * - 成果物ファイルの有無は KiroScanner のインベントリから判定する（2.1）
 * - spec.json 不在・不正でもエントリを返す（2.3 は SpecJsonParser が担い、
 *   本サービスは meta + diagnostics を透過するだけ）
 * - validation-{gap,design,impl}.md の構造化は ValidationService に委譲する。
 *   readValidations 注入点がその接続点（未接続時は空配列 = 委譲先なし）
 */
import { AppError, ErrorCode } from "../errors/codes.js";
import { parseDesign } from "../parsers/design.js";
import { parseMarkdown } from "../parsers/markdown.js";
import { parseRequirements } from "../parsers/requirements.js";
import { parseSpecJson } from "../parsers/spec-json.js";
import { parseTasks } from "../parsers/tasks.js";
import type { MarkdownContent } from "../types/document.js";
import type { ValidationReport } from "../types/resources.js";
import type { SpecDetail, SpecSummary } from "../types/spec.js";
import { ARTIFACT_FILES, type KiroScanner, type SpecDirEntry } from "./kiro-scanner.js";

/** スペック一覧 / 詳細の読取インターフェース（GET /api/specs, /api/specs/:feature） */
export interface SpecService {
  /** 全 spec の一覧（メタデータ + 成果物有無）。feature 名昇順（2.1） */
  list(): Promise<SpecSummary[]>;
  /** 単一 spec の詳細（存在する全成果物の構造化表現、2.2）。不在時 AppError(SPEC_NOT_FOUND) */
  get(feature: string): Promise<SpecDetail>;
}

export interface SpecServiceDeps {
  scanner: KiroScanner;
  /**
   * validation レポートの読取委譲先（ValidationService が実装、タスク 4.3）。
   * 未指定時は空配列を返す（SpecDetail.validations = []）。
   */
  readValidations?: (feature: string) => Promise<ValidationReport[]>;
}

/**
 * KiroScanner + 各パーサーを合成した SpecService を生成する。
 * Postcondition: 返るインスタンスは状態を持たず、各呼び出しが独立にディスクを読む。
 */
export function createSpecService(deps: SpecServiceDeps): SpecService {
  const { scanner } = deps;
  const readValidations = deps.readValidations ?? (() => Promise.resolve([]));

  /** インベントリ + spec.json 読取から SpecSummary を合成する（feature / artifacts は走査由来） */
  async function buildSummary(entry: SpecDirEntry): Promise<SpecSummary> {
    const source = await scanner.readSpecFile(entry.feature, "spec.json");
    const { meta, diagnostics } = parseSpecJson(source);
    return {
      feature: entry.feature,
      app: meta.app,
      phase: meta.phase,
      language: meta.language,
      approvals: meta.approvals,
      readyForImplementation: meta.readyForImplementation,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      artifacts: entry.artifacts,
      diagnostics,
    };
  }

  return {
    async list(): Promise<SpecSummary[]> {
      const entries = await scanner.listSpecDirs();
      return Promise.all(entries.map((entry) => buildSummary(entry)));
    },

    async get(feature: string): Promise<SpecDetail> {
      const entry = await scanner.findSpecDir(feature);
      if (entry === null) {
        throw new AppError(ErrorCode.SPEC_NOT_FOUND, `spec が存在しません: ${feature}`);
      }
      const [summary, brief, requirements, design, tasks, research, validations] =
        await Promise.all([
          buildSummary(entry),
          readArtifact(entry.feature, ARTIFACT_FILES.brief, toMarkdownContent),
          readArtifact(entry.feature, ARTIFACT_FILES.requirements, parseRequirements),
          readArtifact(entry.feature, ARTIFACT_FILES.design, parseDesign),
          readArtifact(entry.feature, ARTIFACT_FILES.tasks, parseTasks),
          readArtifact(entry.feature, ARTIFACT_FILES.research, toMarkdownContent),
          readValidations(entry.feature),
        ]);
      return { summary, brief, requirements, design, tasks, research, validations };
    },
  };

  /** 成果物ファイルを読み、存在時のみパーサーを適用する（不在は null = artifacts フラグと対応） */
  async function readArtifact<T>(
    feature: string,
    fileName: string,
    parse: (source: string) => T,
  ): Promise<T | null> {
    const source = await scanner.readSpecFile(feature, fileName);
    return source === null ? null : parse(source);
  }
}

/** brief / research 共通の markdown 読取ビュー（全文 + セクションツリー） */
function toMarkdownContent(source: string): MarkdownContent {
  return { content: source, sections: parseMarkdown(source).sections };
}
