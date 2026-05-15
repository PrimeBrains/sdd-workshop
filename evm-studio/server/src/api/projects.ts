/**
 * Task 3.1: Project CRUD tRPC router
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 *
 * Feature Flag: ENABLE_PROJECT_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import { projects } from '../db/schema.js'
import type { Project } from '../db/schema.js'
import * as schema from '../db/schema.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_PROJECT_ROUTER = true

// ── Zod Schemas ───────────────────────────────────────────────────────────────

// Task 4.1: status / code を入力スキーマに追加 (Req 1.3, 1.4, 6.3)
// - status は z.enum で 4 値に制限し、未指定時は 'active' をデフォルト適用する
// - code は NULL 許容のオプショナル文字列
export const createProjectSchema = z.object({
  name:      z.string().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status:    z.enum(['active', 'paused', 'draft', 'archived']).default('active'),
  code:      z.string().nullable().optional(),
})

export const updateProjectSchema = z.object({
  id:        z.number().int().positive(),
  name:      z.string().min(1).max(200).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status:    z.enum(['active', 'paused', 'draft', 'archived']).optional(),
  code:      z.string().nullable().optional(),
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
 * Creates the projects tRPC router bound to the given db instance.
 * Production code passes the singleton `db` from `db/index.ts`.
 * Tests pass an in-memory test db.
 */
export function createProjectsRouter(db: DrizzleDb) {
  const t = initTRPC.create()

  return t.router({
    // ── projects.list (Req 2.2, 1.5, 6.1) ────────────────────────────────────
    // 戻り値は Drizzle 推論型 `Project` のまま。schema.ts に `status` / `code`
    // を追加済みのため、レスポンスにはそれらの新カラムも自動的に含まれる。
    list: t.procedure.query(async (): Promise<Project[]> => {
      return db.select().from(projects)
    }),

    // ── projects.getById (Req 2.3, 2.4, 1.5, 6.1) ────────────────────────────
    // 戻り値は Drizzle 推論型 `Project` のまま。`status` / `code` を含む全カラム
    // をクライアントに返す。
    getById: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }): Promise<Project> => {
        const rows = await db.select().from(projects).where(eq(projects.id, input.id))
        const project = rows[0]
        if (!project) {
          throw toTRPCError(
            new AppError(ErrorCode.PROJ_NOT_FOUND, `Project not found: id=${input.id}`),
          )
        }
        return project
      }),

    // ── projects.create (Req 2.1, 2.7, 1.3, 1.4, 6.3) ───────────────────────
    create: t.procedure
      .input(createProjectSchema)
      .mutation(async ({ input }): Promise<Project> => {
        // status は Zod の .default('active') により常に値あり。
        // code は省略時 undefined / null のいずれも DB 上は NULL として保存される。
        const rows = await db
          .insert(projects)
          .values({
            name:      input.name,
            startDate: input.startDate,
            endDate:   input.endDate,
            status:    input.status,
            code:      input.code ?? null,
          })
          .returning()
        const project = rows[0]
        if (!project) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create project' })
        }
        return project
      }),

    // ── projects.update (Req 2.5, 2.7, 1.3, 1.4, 6.3) ───────────────────────
    update: t.procedure
      .input(updateProjectSchema)
      .mutation(async ({ input }): Promise<Project> => {
        // Verify existence first
        const existing = await db.select().from(projects).where(eq(projects.id, input.id))
        if (!existing[0]) {
          throw toTRPCError(
            new AppError(ErrorCode.PROJ_NOT_FOUND, `Project not found: id=${input.id}`),
          )
        }

        const updateData: Partial<{
          name: string
          startDate: string
          endDate: string
          status: 'active' | 'paused' | 'draft' | 'archived'
          code: string | null
          updatedAt: Date
        }> = {
          updatedAt: new Date(),
        }
        if (input.name !== undefined)      updateData.name      = input.name
        if (input.startDate !== undefined) updateData.startDate = input.startDate
        if (input.endDate !== undefined)   updateData.endDate   = input.endDate
        if (input.status !== undefined)    updateData.status    = input.status
        if (input.code !== undefined)      updateData.code      = input.code

        const rows = await db
          .update(projects)
          .set(updateData)
          .where(eq(projects.id, input.id))
          .returning()
        const project = rows[0]
        if (!project) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update project' })
        }
        return project
      }),

    // ── projects.delete (Req 2.6) ────────────────────────────────────────────
    delete: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }): Promise<{ success: true }> => {
        // Verify existence first
        const existing = await db.select().from(projects).where(eq(projects.id, input.id))
        if (!existing[0]) {
          throw toTRPCError(
            new AppError(ErrorCode.PROJ_NOT_FOUND, `Project not found: id=${input.id}`),
          )
        }

        // CASCADE deletion of tasks/members/holidays is handled by FK constraints
        // (PRAGMA foreign_keys = ON + ON DELETE CASCADE in schema)
        await db.delete(projects).where(eq(projects.id, input.id))
        return { success: true }
      }),
  })
}

// ── Convenience export for tests (re-exports the factory as projectsRouter) ───

/**
 * Alias for use in tests: `projectsRouter` is the factory function.
 * Usage in tests: `const router = createProjectsRouter(testDb)`
 */
export { createProjectsRouter as projectsRouter }
