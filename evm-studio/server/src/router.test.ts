/**
 * Task 5.2: router.ts unit tests
 * Requirements: 1.7, 7.1, 7.2, 7.5
 *
 * Verifies:
 *  - appRouter is exported and has the expected top-level keys
 *  - AppRouter type is exported (compile-time check via type assertion)
 *  - ENABLE_APP_ROUTER feature flag is true
 */

import { describe, it, expect } from 'vitest'
import { appRouter, type AppRouter, ENABLE_APP_ROUTER } from './router.js'

describe('appRouter', () => {
  it('should have all expected sub-router keys', () => {
    // The tRPC router exposes its procedure map via _def.procedures
    // We check the top-level router definition keys instead.
    const routerDef = appRouter._def.record
    expect(routerDef).toHaveProperty('projects')
    expect(routerDef).toHaveProperty('tasks')
    expect(routerDef).toHaveProperty('members')
    expect(routerDef).toHaveProperty('holidays')
    expect(routerDef).toHaveProperty('import')
  })

  it('should export ENABLE_APP_ROUTER feature flag as true', () => {
    expect(ENABLE_APP_ROUTER).toBe(true)
  })

  it('should export AppRouter type (compile-time assertion)', () => {
    // This is a compile-time check: if AppRouter type is not exported, tsc will fail.
    // At runtime we just verify appRouter is truthy.
    type _AppRouterCheck = AppRouter
    expect(appRouter).toBeTruthy()
  })
})
