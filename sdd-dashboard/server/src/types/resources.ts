/**
 * リソース契約型 — SteeringDoc / SkillDoc / AdrDoc / ValidationReport
 * （design.md types/resources.ts 抜粋 + API Contract）。
 * 所属アプリ（app）・由来分類（origin）は下流 UI のグルーピング契約として design.md で確定済み。
 */
import type { Diagnostic, MarkdownContent, SectionNode } from "./document.js";

/** steering 文書の一覧エントリ（GET /api/steering） */
export interface SteeringDocSummary {
  /** ファイル名（拡張子なし。例: "tech"） */
  name: string;
  /** 先頭見出しのタイトル。見出しがない場合 null */
  title: string | null;
}

/** steering 文書の詳細（GET /api/steering/:name — content + sections） */
export interface SteeringDoc {
  name: string;
  content: string;
  sections: SectionNode[];
}

/** スキルの一覧エントリ（GET /api/skills — en/ja 有無・origin 付き） */
export interface SkillSummary {
  /** スキルディレクトリ名（例: "kiro-spec-design"） */
  name: string;
  hasEn: boolean;
  hasJa: boolean;
  /** SKILL.md frontmatter の metadata.origin（"cc-sdd" | "custom"）。欠落時 null（7.7） */
  origin: string | null;
}

/** スキル詳細（GET /api/skills/:name — en 必須・ja nullable・origin nullable） */
export interface SkillDoc {
  name: string;
  /** SKILL.md（英語正本） */
  en: MarkdownContent;
  /** SKILL.ja.md。欠落時 null（7.2） */
  ja: MarkdownContent | null;
  /** SKILL.md frontmatter の metadata.origin（"cc-sdd" | "custom"）。欠落時 null（7.7） */
  origin: string | null;
}

/**
 * ADR frontmatter（adr.md 規約の 9 キー）。
 * 未知キーは欠落させず保持する（FrontmatterParser、情報無欠落原則）。
 */
export interface AdrFrontmatter {
  id: number;
  title: string;
  status: string; // "proposed" | "accepted" | "superseded" 等（規約側の語彙）
  date: string; // YYYY-MM-DD
  /** 所属アプリ（spec.json の app と同語彙）。null = リポジトリ横断の決定（7.6） */
  app: string | null;
  specs: string[];
  requirements: string[]; // クロス spec 形式 "<feature>/<id>"
  supersedes: string | null;
  superseded_by: string | null;
  /** 規約外の未知キー（保持のみ。落とさない） */
  [key: string]: unknown;
}

/** ADR 一覧エントリ（GET /api/adr — frontmatter、app 含む） */
export interface AdrSummary {
  /** ファイル名（拡張子なし。例: "0001-sdd-dashboard-local-web-app"） */
  name: string;
  /** frontmatter パース失敗時 null + diagnostics */
  frontmatter: AdrFrontmatter | null;
  diagnostics: Diagnostic[];
}

/** ADR 詳細（GET /api/adr/:id — frontmatter + 構造化本文） */
export interface AdrDoc {
  name: string;
  frontmatter: AdrFrontmatter | null;
  content: string;
  sections: SectionNode[];
  diagnostics: Diagnostic[];
}

/** validation レポート種別（validation-{gap,design,impl}.md） */
export type ValidationType = "gap" | "design" | "impl";

/** validation レポートの構造化（7.4。decision は存在時のみ — gap レポートは持たない） */
export interface ValidationReport {
  type: ValidationType;
  feature: string;
  date: string | null;
  decision: string | null;
  content: string;
  sections: SectionNode[];
  diagnostics: Diagnostic[];
}
