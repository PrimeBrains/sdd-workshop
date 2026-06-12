/**
 * スペック契約型 — SpecSummary / SpecDetail / PhaseName / 各成果物の構造化型
 * （design.md SpecService / RequirementsParser / DesignParser / TasksParser Contracts）。
 */
import type { Diagnostic, DocBlock, MarkdownContent, Position, RawBlock, SectionNode } from "./document.js";
import type { ValidationReport } from "./resources.js";
import type { RefToken } from "./trace.js";

/** 承認フェーズ名（spec.json approvals のキーと同語彙） */
export type PhaseName = "requirements" | "design" | "tasks";

/** spec.json approvals の 1 フェーズ分のフラグ */
export interface PhaseApproval {
  generated: boolean;
  approved: boolean;
}

/** spec.json approvals（requirements → design → tasks の順序制約は ApprovalWriter が検証） */
export type SpecApprovals = Record<PhaseName, PhaseApproval>;

/** スペックディレクトリ内の成果物ファイル種別 */
export type ArtifactName =
  | "brief"
  | "requirements"
  | "design"
  | "tasks"
  | "research"
  | "validationGap"
  | "validationDesign"
  | "validationImpl";

/**
 * スペック一覧エントリ（GET /api/specs）。spec.json 不正でもエントリは返り、
 * メタデータ各フィールドは null + diagnostics で表現する（2.3）。
 */
export interface SpecSummary {
  feature: string;
  /** spec.json の app フィールド。欠落時 null（UI は未分類として扱う、2.5） */
  app: string | null;
  phase: string | null;
  language: string | null;
  approvals: SpecApprovals | null;
  readyForImplementation: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  artifacts: Record<ArtifactName, boolean>;
  diagnostics: Diagnostic[]; // spec.json 不正等
}

/** requirements.md の構造化（RequirementsParser、3.1, 3.2, 3.3） */
export interface RequirementsDoc {
  requirements: Array<
    DocBlock<{
      id: string;
      title: string;
      objective: string | null;
      criteria: Array<DocBlock<{ id: string; text: string; translationJa: string | null }>>;
    }>
  >;
  otherBlocks: DocBlock<{ section: SectionNode }>[];
}

/** design.md Requirements Traceability テーブルの 1 行（4.2） */
export interface TraceabilityRow {
  refs: RefToken[];
  summary: string;
  components: string;
  interfaces: string;
  flows: string;
}

/** コンポーネント詳細の `| Requirements |` 行 / サマリー表 `Req Coverage` 列からの参照抽出（4.3） */
export interface ComponentRequirements {
  component: string;
  refs: RefToken[];
  position: Position;
}

/**
 * design.md の構造化（DesignParser、4.1-4.4）。
 * パースできない Traceability 行は RawBlock として残し、残りの行の抽出を継続する（4.4）。
 *
 * `content` は design.md の全文（情報無欠落）。design.md は大半がプローズ・図表で、
 * `sections`（見出し階層）/ `traceability` / `componentRequirements` は構造化抽出のみを
 * 運ぶため、本文を欠落させないよう全文を保持し、ビューアが構造化ビュー（ナビ + 表）と
 * 並べて本文を全文描画する（postmortem #0004。正典スケルトン SpecViewer の DesignTab と一致）。
 */
export interface DesignDoc {
  sections: SectionNode[];
  traceability: Array<DocBlock<TraceabilityRow>>;
  componentRequirements: ComponentRequirements[];
  content: string;
}

/** tasks.md のタスクエントリ（TasksParser、5.1-5.4） */
export interface TaskEntry {
  id: string; // "3" | "3.2"
  description: string;
  checked: boolean;
  parallel: boolean; // (P)
  optional: boolean; // - [ ]*
  details: string[];
  requirements: RefToken[];
  depends: string[];
  boundary: string | null;
  position: Position;
  subtasks: TaskEntry[]; // major のみ非空
}

/** tasks.md の構造化。タスク以外・構造化不能範囲は rawBlocks に保持する（情報無欠落） */
export interface TasksDoc {
  tasks: TaskEntry[];
  otherBlocks: RawBlock[];
}

/**
 * スペック詳細（GET /api/specs/:feature）: 全成果物の構造化表現 + validations。
 * 不在の成果物は null（artifacts フラグと対応）。
 */
export interface SpecDetail {
  summary: SpecSummary;
  brief: MarkdownContent | null;
  requirements: RequirementsDoc | null;
  design: DesignDoc | null;
  tasks: TasksDoc | null;
  research: MarkdownContent | null;
  validations: ValidationReport[];
}
