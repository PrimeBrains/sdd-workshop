/**
 * Task 3.1: tRPC クライアント設定
 * Requirements: 5.1
 */

import { createTRPCReact } from '@trpc/react-query'
import { QueryClient } from '@tanstack/react-query'
import type { AppRouter } from '../../../server/src/router'

export const trpc = createTRPCReact<AppRouter>()

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})
