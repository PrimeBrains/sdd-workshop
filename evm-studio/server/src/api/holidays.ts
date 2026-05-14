/**
 * Task 3.4: Holiday CRUD tRPC router
 * Requirements: 5.1, 5.2, 5.3, 5.4
 *
 * Feature Flag: ENABLE_HOLIDAYS_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, asc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { holidays } from '../db/schema.js'
import type { Holiday } from '../db/schema.js'
import * as schema from '../db/schema.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export let ENABLE_HOLIDAYS_ROUTER = true

/** Test-only setter — allows tests to flip the flag and verify RED phase. */
export function setEnableHolidaysRouter(value: boolean): void {
  ENABLE_HOLIDAYS_ROUTER = value
}

// ── Zod Schemas ───────────────────────────────────────────────────────────────

export const createHolidaySchema = z.object({
  projectId: z.number().int().positive(),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// ── DB type ───────────────────────────────────────────────────────────────────

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

// ── Router factory ────────────────────────────────────────────────────────────

/**
 * Creates the holidays tRPC router bound to the given db instance.
 * Production code passes the singleton `db` from `db/index.ts`.
 * Tests pass an in-memory test db.
 *
 * When ENABLE_HOLIDAYS_ROUTER is false, every procedure throws an error
 * to demonstrate the RED phase (feature flag controls router behaviour).
 */
export function createHolidaysRouter(db: DrizzleDb) {
  const t = initTRPC.create()
  const { router, procedure: publicProcedure } = t

  if (!ENABLE_HOLIDAYS_ROUTER) {
    return router({
      listByProject: publicProcedure
        .input(z.object({ projectId: z.number() }))
        .query(() => { throw new Error('holidays router disabled') }),
      create: publicProcedure
        .input(z.object({ projectId: z.number(), date: z.string() }))
        .mutation(() => { throw new Error('holidays router disabled') }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(() => { throw new Error('holidays router disabled') }),
    })
  }

  return router({
    // ── holidays.listByProject (Req 5.2) ─────────────────────────────────────
    listByProject: publicProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ input }): Promise<Holiday[]> => {
        return db
          .select()
          .from(holidays)
          .where(eq(holidays.projectId, input.projectId))
          .orderBy(asc(holidays.date))
      }),

    // ── holidays.create (Req 5.1, 5.4) ───────────────────────────────────────
    create: publicProcedure
      .input(createHolidaySchema)
      .mutation(async ({ input }): Promise<Holiday> => {
        const rows = await db
          .insert(holidays)
          .values({
            projectId: input.projectId,
            date:      input.date,
          })
          .returning()
        const holiday = rows[0]
        if (!holiday) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create holiday' })
        }
        return holiday
      }),

    // ── holidays.delete (Req 5.3) ─────────────────────────────────────────────
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }): Promise<{ success: true }> => {
        await db.delete(holidays).where(eq(holidays.id, input.id))
        return { success: true }
      }),
  })
}

// ── Convenience export for tests ──────────────────────────────────────────────

/**
 * Alias for use in tests: `holidaysRouter` is the factory function.
 * Usage in tests: `const router = createHolidaysRouter(testDb)`
 */
export { createHolidaysRouter as holidaysRouter }
