/**
 * Task 5.1: import tRPC router
 * Requirements: 6.1, 6.7, 6.9, 6.10, 7.2
 *
 * Feature Flag: ENABLE_IMPORT_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { AppError } from '../errors/AppError.js'
import { importWbsYaml } from '../services/wbs-importer.js'
import type { ImportSummary } from '../services/wbs-importer.js'
import * as schema from '../db/schema.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_IMPORT_ROUTER = true

// ── Zod Schema ────────────────────────────────────────────────────────────────

export const importWbsYamlSchema = z.object({
  projectId:    z.number().int().positive(),
  tasksYaml:    z.string().min(1),
  staffingYaml: z.string().min(1),
  scheduleYaml: z.string().min(1),
})

// ── AppError → TRPCError conversion ───────────────────────────────────────────

function toTRPCError(e: AppError): TRPCError {
  const codeMap: Record<string, TRPCError['code']> = {
    PROJ_NOT_FOUND:       'NOT_FOUND',
    TASK_NOT_FOUND:       'NOT_FOUND',
    MEMBER_NOT_FOUND:     'NOT_FOUND',
    IMPORT_INVALID_YAML:  'BAD_REQUEST',
    IMPORT_PARSE_ERROR:   'BAD_REQUEST',
    IMPORT_MISSING_FIELD: 'BAD_REQUEST',
    MEMBER_INVALID_RATE:  'BAD_REQUEST',
  }
  return new TRPCError({
    code:    codeMap[e.code] ?? 'INTERNAL_SERVER_ERROR',
    message: e.message,
    cause:   e,
  })
}

// ── DB type ───────────────────────────────────────────────────────────────────

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

// ── Router factory ────────────────────────────────────────────────────────────

/**
 * Creates the import tRPC router bound to the given db instance.
 * Production code passes the singleton `db` from `db/index.ts`.
 * Tests pass an in-memory test db.
 */
export function createImportRouter(db: DrizzleDb) {
  const t = initTRPC.create()

  return t.router({
    // ── import.wbsYaml (Req 6.1, 6.7, 6.9, 6.10) ────────────────────────────
    wbsYaml: t.procedure
      .input(importWbsYamlSchema)
      .mutation(async ({ input }): Promise<ImportSummary> => {
        try {
          return importWbsYaml({
            db,
            projectId:    input.projectId,
            tasksYaml:    input.tasksYaml,
            staffingYaml: input.staffingYaml,
            scheduleYaml: input.scheduleYaml,
          })
        } catch (e) {
          if (e instanceof AppError) {
            throw toTRPCError(e)
          }
          throw e
        }
      }),
  })
}

// ── Convenience export ────────────────────────────────────────────────────────

export { createImportRouter as importRouter }
