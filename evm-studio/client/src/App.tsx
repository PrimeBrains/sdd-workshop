/**
 * Task 3.1 (App.tsx), 4.3: QueryClientProvider + tRPC プロバイダー + ルート追加
 * Requirements: 5.1
 */

import { httpBatchLink } from '@trpc/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { trpc, queryClient } from './lib/trpc'
import ProgressInputPage from './pages/ProgressInputPage'
import DashboardPage from './pages/DashboardPage'

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/trpc',
    }),
  ],
})

function Router() {
  const path = window.location.pathname

  if (path === '/progress') {
    return <ProgressInputPage />
  }

  if (path === '/dashboard') {
    return <DashboardPage />
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">EVM Studio</h1>
        <div className="flex flex-col gap-2">
          <a href="/progress" className="text-blue-600 hover:underline text-sm">
            進捗入力ページへ
          </a>
          <a href="/dashboard" className="text-blue-600 hover:underline text-sm">
            ダッシュボードへ
          </a>
        </div>
      </div>
    </div>
  )
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
