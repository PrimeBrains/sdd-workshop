/**
 * API 契約型 — ApiError / RepoInfo / 書込リクエスト・レスポンス DTO
 * （design.md API Contract / AdrWriter / ApprovalWriter / RollbackWriter Contracts）。
 */
import type { ErrorCode } from "../errors/codes.js";
import type { PhaseName } from "./spec.js";

/** エラーレスポンス共通形（13.1。エラーミドルウェアが AppError から生成する） */
export interface ApiError {
  error: {
    code: ErrorCode; // ErrorCode 定数（機械可読）
    message: string; // 人間可読
    fieldErrors?: Record<string, string[]>; // 422 のみ
  };
}

/** 対象リポジトリ情報（GET /api/repo） */
export interface RepoInfo {
  /** リポジトリルートの絶対パス */
  repoRoot: string;
  /** リポジトリ名（ルートディレクトリ名） */
  name: string;
}

/** 承認フラグ更新リクエスト（PUT /api/specs/:feature/approvals → SpecSummary） */
export interface UpdateApprovalRequest {
  phase: PhaseName;
  approved: boolean;
}

/** フェーズ巻き戻しリクエスト（POST /api/specs/:feature/rollback → SpecSummary） */
export interface RollbackRequest {
  targetPhase: PhaseName;
}

/** ADR 作成リクエスト（POST /api/adr → AdrDoc, 201） */
export interface CreateAdrInput {
  title: string;
  context: string;
  decision: string;
  consequences: string;
  alternatives?: string;
  status?: "proposed" | "accepted";
  /** 所属アプリ（spec.json の app と同語彙）。省略時は frontmatter app: null（11.6） */
  app?: string;
  specs?: string[];
  /** クロス spec 形式 "<feature>/<id>" を zod + RefListParser で検証（11.4） */
  requirements?: string[];
  slug?: string;
}
