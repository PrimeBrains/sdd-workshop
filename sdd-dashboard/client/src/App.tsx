/**
 * アプリケーションルート。1.1 時点では空のページ（タイトルのみ）。
 * AppShell / ルーティングはタスク 1.3 で実装する。
 */
import type { JSX } from "react";

export function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <h1 className="text-xl font-bold text-slate-800">SDD Review UI</h1>
    </main>
  );
}
