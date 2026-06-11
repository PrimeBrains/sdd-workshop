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
import { lazy, Suspense, type JSX } from "react";
import type { RouteObject } from "react-router";

import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

import { HelpPage } from "@/workflow/help/HelpPage";
import { SteeringListPage } from "@/workflow/knowledge/steering/SteeringListPage";
import { SteeringDocPage } from "@/workflow/knowledge/steering/SteeringDocPage";
import { SkillListPage } from "@/workflow/knowledge/skills/SkillListPage";
import { SkillDocPage } from "@/workflow/knowledge/skills/SkillDocPage";
import { AdrListPage } from "@/workflow/knowledge/adr/AdrListPage";
import { AdrDetailPage } from "@/workflow/knowledge/adr/AdrDetailPage";

/**
 * board ルートは @xyflow/react を遅延ロードし、レビュー画面の初期ロードに影響させない
 * （design.md「Performance」route-level code splitting / Requirement 9.5 はローカルバンドル）。
 */
const BoardPage = lazy(() => import("./board/BoardPage"));

function BoardRoute(): JSX.Element {
  return (
    <Suspense fallback={<LoadingSkeleton label="ボードを読み込み中…" />}>
      <BoardPage />
    </Suspense>
  );
}

/**
 * 本スペックの URL 空間。review-ui の RESERVED_NAMESPACES に対応し、`app/router.tsx` の
 * 連結点で fallbackRoute より前に合成される。先頭スラッシュなしの相対パスで定義する
 * （連結先が `"/"` レイアウトの children のため）。
 */
export const workflowRoutes: RouteObject[] = [
  { path: "board", element: <BoardRoute /> },
  { path: "help", element: <HelpPage /> },
  { path: "steering", element: <SteeringListPage /> },
  { path: "steering/:name", element: <SteeringDocPage /> },
  { path: "skills", element: <SkillListPage /> },
  { path: "skills/:name", element: <SkillDocPage /> },
  { path: "adr", element: <AdrListPage /> },
  { path: "adr/:id", element: <AdrDetailPage /> },
];
