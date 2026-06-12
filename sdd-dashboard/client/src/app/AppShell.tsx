/**
 * SPA レイアウトシェル（design.md「AppShell + Router + SpecActionSlot」）。
 *
 * - ヘッダ: アプリ名 + リポジトリ名（GET /api/repo）+ スペック画面ヘッダ右端の
 *   `SpecActionSlotOutlet`（workflow-ui の操作挿入点。本スペックでは常に空 → 8.1）
 * - スペックサイドバー: GET /api/specs の feature 名を NavLink で列挙
 * - コンテンツ領域: `<Outlet/>`
 * - ConnectionBanner: SseInvalidationBridge（useChangeEvents）をアプリ全体で常駐させ、
 *   その接続状態を表示する（切断時「再接続中」/ 9.2 / Requirements 7.3）。ブリッジを
 *   シェルで張ることで SSE 購読がアプリ全域で有効になる
 *
 * ナビゲーション領域は宣言済みの連結点: sdd-workflow-ui は予約名前空間
 * （router.tsx の RESERVED_NAMESPACES）向けナビリンク追加に限り本ファイルを
 * 最小修正してよい（design.md Responsibilities & Constraints）。
 *
 * データ取得の失敗は非致命的に扱う: シェル骨格とコンテンツ領域は常に描画され、
 * ヘッダのリポジトリ名は非表示・サイドバーは ErrorPanel（再試行つき → 1.5）に留める。
 */
import type { JSX } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useChangeEvents } from "@/api/sse/useChangeEvents";
import { useRepoInfo } from "@/api/useRepoInfo";
import { useSpecs } from "@/api/useSpecs";
import { SpecActionSlotOutlet, SpecActionSlotProvider } from "@/app/SpecActionSlot";
import { ConnectionBanner } from "@/shared/ConnectionBanner";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { appChangeEventsMap, WorkflowSlotRegistrar } from "@/workflow/integration";

/** リポジトリ名（装飾情報）。読込中・失敗時は非致命的に非表示とする */
function HeaderRepoName(): JSX.Element | null {
  const repo = useRepoInfo();
  if (repo.data === undefined) return null;
  return (
    <span data-testid="repo-name" className="text-sm text-ink-soft">
      {repo.data.name}
    </span>
  );
}

/** workflow ルート（予約名前空間）への共通ナビ。spec サイドバーとは独立し /specs/** には触れない */
const WORKFLOW_NAV_LINKS = [
  { to: "/board", label: "Board" },
  { to: "/help", label: "Help" },
  { to: "/steering", label: "Steering" },
  { to: "/skills", label: "Skills" },
  { to: "/adr", label: "ADR" },
] as const;

function WorkflowNav(): JSX.Element {
  return (
    <nav aria-label="ワークフロー" className="border-b border-white/10 p-3">
      <ul className="space-y-1">
        {WORKFLOW_NAV_LINKS.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) =>
                `block border-l-[3px] py-1 pl-[5px] pr-2 text-sm ${
                  isActive
                    ? "border-brand bg-brand/25 font-medium text-white"
                    : "border-transparent text-sidebar-muted hover:bg-white/[0.06] hover:text-white"
                }`
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SpecSidebar(): JSX.Element {
  const specs = useSpecs();
  return (
    <nav aria-label="スペック一覧" className="p-3">
      {specs.isPending && <p className="px-2 text-sm text-sidebar-soft">読み込み中…</p>}
      {specs.isError && (
        <ErrorPanel
          error={specs.error}
          onRetry={() => {
            void specs.refetch();
          }}
        />
      )}
      {specs.data !== undefined && (
        <ul className="space-y-1">
          {specs.data.map((spec) => (
            <li key={spec.feature}>
              <NavLink
                to={`/specs/${spec.feature}`}
                className={({ isActive }) =>
                  `block border-l-[3px] py-1 pl-[5px] pr-2 text-sm ${
                    isActive
                      ? "border-brand bg-brand/25 font-medium text-white"
                      : "border-transparent text-sidebar-muted hover:bg-white/[0.06] hover:text-white"
                  }`
                }
              >
                {spec.feature}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

export function AppShell(): JSX.Element {
  // SseInvalidationBridge をアプリ全体で常駐させ、変更通知の購読と接続状態の管理を一元化する。
  // workflow-ui の steering/skill/adr カテゴリ写像を結合した map を注入する（spec は DEFAULT を保持）。
  const { status } = useChangeEvents(appChangeEventsMap);
  return (
    <SpecActionSlotProvider>
      {/* SpecActionSlot へ workflow 操作 UI を登録する（Provider 配下で実行する必要がある） */}
      <WorkflowSlotRegistrar />
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <header className="flex items-center gap-3 border-b border-line bg-paper-warm px-4 py-3">
          <Link to="/specs" className="text-base font-bold text-ink">
            SDD Review UI
          </Link>
          <HeaderRepoName />
          {/* スペック画面ヘッダ右端 = workflow-ui の操作挿入点（本スペックでは空） */}
          <div className="ml-auto">
            <SpecActionSlotOutlet />
          </div>
        </header>
        <div className="flex flex-1">
          <aside className="w-56 shrink-0 bg-sidebar text-sidebar-ink">
            <WorkflowNav />
            <SpecSidebar />
          </aside>
          <main className="min-w-0 max-w-[1280px] flex-1 px-[34px] py-[26px]">
            <Outlet />
          </main>
        </div>
        <ConnectionBanner status={status} />
      </div>
    </SpecActionSlotProvider>
  );
}
