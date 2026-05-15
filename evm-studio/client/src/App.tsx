/**
 * Task 3.1 (App.tsx), 4.5: QueryClientProvider + tRPC プロバイダー + ルート定義
 * Requirements: 1.5, 5.1, 16.2
 *
 * `/progress` ルートは Phase 4.5 で削除済み。進捗入力は GanttFullscreen 内に
 * ホストされる ProgressInputPanel から行う。
 */

import { httpBatchLink } from '@trpc/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { trpc, queryClient } from './lib/trpc'
import WorkbenchPage from './pages/WorkbenchPage'

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/trpc',
    }),
  ],
})

function Router() {
  // 単一画面: 常に WorkbenchPage を表示する (要件 1.1, 1.5, 16.1, 16.2)
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
