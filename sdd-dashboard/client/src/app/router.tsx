/**
 * ルートレジストリ（design.md「ルート表（本スペックが定義する URL 空間）」）。
 *
 * ビュー位置の真実は URL のみ（design.md State Management）。リロード・共有リンクで
 * 同じビュー構成が復元される（Requirement 1.4）。未知 URL は /specs へフォールバックする。
 *
 * sdd-workflow-ui は将来、予約名前空間（RESERVED_NAMESPACES）のルートを
 * 下記の連結点 1 箇所に `RouteObject[]` として連結する（design.md
 * Responsibilities & Constraints）。それまで予約パスはフォールバックに落ちる。
 */
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { AppShell } from "@/app/AppShell";
import {
  ComparePagePlaceholder,
  MatrixPagePlaceholder,
  ValidationReportPagePlaceholder,
} from "@/app/placeholders";
import { SpecListPage } from "@/features/specs/SpecListPage";
import { SpecOverviewPage } from "@/features/specs/SpecOverviewPage";
import { SpecDocumentPage } from "@/features/viewer/SpecDocumentPage";

/**
 * 予約名前空間（sdd-workflow-ui 向け契約宣言）。本スペックではルートとして実装しない。
 * review-ui が将来のルートを追加する際もこの名前空間を使用してはならない。
 */
export const RESERVED_NAMESPACES = ["/board", "/help", "/steering", "/skills", "/adr"] as const;

/** review ルート（本スペックが所有する URL 空間。プレースホルダは後続タスクが置き換える） */
const reviewRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/specs" replace /> },
  { path: "specs", element: <SpecListPage /> },
  { path: "specs/:feature", element: <SpecOverviewPage /> },
  // 静的セグメント（compare / matrix / validation）は :document より優先して一致する
  { path: "specs/:feature/compare", element: <ComparePagePlaceholder /> },
  { path: "specs/:feature/matrix", element: <MatrixPagePlaceholder /> },
  { path: "specs/:feature/validation/:type", element: <ValidationReportPagePlaceholder /> },
  { path: "specs/:feature/:document", element: <SpecDocumentPage /> },
];

/** 未知 URL（未実装の予約名前空間を含む）→ /specs フォールバック。必ず末尾に置く */
const fallbackRoute: RouteObject = { path: "*", element: <Navigate to="/specs" replace /> };

/** ルートレジストリ本体。AppShell をレイアウトとし、全ルートをその子に持つ */
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      ...reviewRoutes,
      // 連結点: sdd-workflow-ui はここに自身の RouteObject[] を連結する
      // （RESERVED_NAMESPACES のパスのみ。fallbackRoute より前であること）
      fallbackRoute,
    ],
  },
];

/** エントリ（main.tsx）用のブラウザルーター。テストは routes を createMemoryRouter に渡す */
export function createAppRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(routes);
}
