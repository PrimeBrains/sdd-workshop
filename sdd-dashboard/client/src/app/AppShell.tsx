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

/** リポジトリ名（装飾情報）。読込中・失敗時は非致命的に非表示とする */
function HeaderRepoName(): JSX.Element | null {
  const repo = useRepoInfo();
  if (repo.data === undefined) return null;
  return (
    <span data-testid="repo-name" className="text-sm text-slate-500">
      {repo.data.name}
    </span>
  );
}

function SpecSidebar(): JSX.Element {
  const specs = useSpecs();
  return (
    <nav aria-label="スペック一覧" className="p-3">
      {specs.isPending && <p className="px-2 text-sm text-slate-400">読み込み中…</p>}
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
                  `block rounded px-2 py-1 text-sm ${
                    isActive
                      ? "bg-slate-200 font-medium text-slate-900"
                      : "text-slate-600 hover:bg-slate-100"
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
  const { status } = useChangeEvents();
  return (
    <SpecActionSlotProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <Link to="/specs" className="text-base font-bold text-slate-800">
            SDD Review UI
          </Link>
          <HeaderRepoName />
          {/* スペック画面ヘッダ右端 = workflow-ui の操作挿入点（本スペックでは空） */}
          <div className="ml-auto">
            <SpecActionSlotOutlet />
          </div>
        </header>
        <div className="flex flex-1">
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
            <SpecSidebar />
          </aside>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
        <ConnectionBanner status={status} />
      </div>
    </SpecActionSlotProvider>
  );
}
