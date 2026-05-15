/**
 * Task 3.1 (App.tsx), 4.3: QueryClientProvider + tRPC プロバイダー + ルート追加
 * Requirements: 5.1
 */

import { httpBatchLink } from '@trpc/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { trpc, queryClient } from './lib/trpc'
import ProgressInputPage from './pages/ProgressInputPage'
import WorkbenchPage from './pages/WorkbenchPage'

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/trpc',
    }),
  ],
})

function Router() {
  const path = window.location.pathname

  // `/progress` は次フェーズ (Phase 4.5) で削除予定。それまでは互換のため残す。
  if (path === '/progress') {
    return <ProgressInputPage />
  }

  // ルート `/` は WorkbenchPage を表示する (要件 1.1, 1.5, 16.1, 16.2)
  return <WorkbenchPage />
}

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
    </trpc.Provider>
  )
}
