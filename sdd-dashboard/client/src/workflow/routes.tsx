/**
 * workflowRoutes（design.md「ルート表（本スペックが定義する URL 空間）」「Shell Integration 層」）。
 *
 * 本ファイルは sdd-workflow-ui の URL 空間（review-ui が予約した名前空間
 * `/board` `/help` `/steering` `/steering/:name` `/skills` `/skills/:name`
 * `/adr` `/adr/:id`）の唯一の定義点である。`app/router.tsx` の連結点で予約名前空間へ
 * 合成され、リロード・共有リンクで同じビューが復元される（Requirement 1.5, 9.1）。
 * `/specs/**`（review-ui 所有）には新ルートを追加しない（Requirement 9.2）。
 *
 * 各ルートは後続タスクで実画面へ置き換わるまでの最小プレースホルダを描画する。
 * プレースホルダは読み取り専用（書込操作 UI = button を持たない / Requirement 8.1）。
 */
import type { JSX } from "react";
import { type RouteObject, useParams } from "react-router";

/** 後続タスクで実画面に差し替わる最小プレースホルダ（見出しのみ） */
function Placeholder({ testId, label }: { testId: string; label: string }): JSX.Element {
  return (
    <section data-testid={testId}>
      <h1 className="text-lg font-semibold text-slate-800">{label}</h1>
    </section>
  );
}

function BoardPlaceholder(): JSX.Element {
  return <Placeholder testId="workflow-board-page" label="Board" />;
}

function HelpPlaceholder(): JSX.Element {
  return <Placeholder testId="workflow-help-page" label="Help" />;
}

function SteeringListPlaceholder(): JSX.Element {
  return <Placeholder testId="workflow-steering-list-page" label="Steering" />;
}

function SteeringDocPlaceholder(): JSX.Element {
  const { name } = useParams();
  return <Placeholder testId="workflow-steering-doc-page" label={`Steering: ${name ?? ""}`} />;
}

function SkillListPlaceholder(): JSX.Element {
  return <Placeholder testId="workflow-skill-list-page" label="Skills" />;
}

function SkillDocPlaceholder(): JSX.Element {
  const { name } = useParams();
  return <Placeholder testId="workflow-skill-doc-page" label={`Skill: ${name ?? ""}`} />;
}

function AdrListPlaceholder(): JSX.Element {
  return <Placeholder testId="workflow-adr-list-page" label="ADR" />;
}

function AdrDetailPlaceholder(): JSX.Element {
  const { id } = useParams();
  return <Placeholder testId="workflow-adr-detail-page" label={`ADR: ${id ?? ""}`} />;
}

/**
 * 本スペックの URL 空間。review-ui の RESERVED_NAMESPACES に対応し、`app/router.tsx` の
 * 連結点で fallbackRoute より前に合成される。先頭スラッシュなしの相対パスで定義する
 * （連結先が `"/"` レイアウトの children のため）。
 */
export const workflowRoutes: RouteObject[] = [
  { path: "board", element: <BoardPlaceholder /> },
  { path: "help", element: <HelpPlaceholder /> },
  { path: "steering", element: <SteeringListPlaceholder /> },
  { path: "steering/:name", element: <SteeringDocPlaceholder /> },
  { path: "skills", element: <SkillListPlaceholder /> },
  { path: "skills/:name", element: <SkillDocPlaceholder /> },
  { path: "adr", element: <AdrListPlaceholder /> },
  { path: "adr/:id", element: <AdrDetailPlaceholder /> },
];
