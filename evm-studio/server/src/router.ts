/**
 * Task 5.2: tRPC appRouter
 * Requirements: 1.7, 1.8, 7.1, 7.2, 7.5
 *
 * Feature Flag: ENABLE_APP_ROUTER
 */

import { initTRPC } from '@trpc/server'
import { db } from './db/index.js'
import { createProjectsRouter } from './api/projects.js'
import { createTasksRouter } from './api/tasks.js'
import { createMembersRouter } from './api/members.js'
import { createHolidaysRouter } from './api/holidays.js'
import { createImportRouter } from './api/import.js'
import { createProgressRouter } from './api/progress.js'
import { createEvmRouter } from './api/evm.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_APP_ROUTER = true

// ── tRPC instance ─────────────────────────────────────────────────────────────
const t = initTRPC.create()

// ── appRouter ─────────────────────────────────────────────────────────────────
/**
 * Root tRPC router that mounts all sub-routers.
 * All routers receive the singleton `db` instance so tests can inject an in-memory db
 * via the individual createXxxRouter() factories instead.
 */
export const appRouter = t.router({
  projects: createProjectsRouter(db),
  tasks:    createTasksRouter(db),
  members:  createMembersRouter(db),
  holidays: createHolidaysRouter(db),
  import:   createImportRouter(db),
  progress: createProgressRouter(db),
  evm:      createEvmRouter(db),
})

export type AppRouter = typeof appRouter
