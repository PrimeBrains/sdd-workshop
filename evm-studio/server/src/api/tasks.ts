/**
 * Task 3.2: Tasks CRUD tRPC router
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 *
 * Feature Flag: ENABLE_TASKS_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, asc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import { tasks, taskDependencies, progressSnapshots } from '../db/schema.js'
import type { Task } from '../db/schema.js'
import * as schema from '../db/schema.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_TASKS_ROUTER = true

// ── Zod Schemas ───────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  projectId:    z.number().int().positive(),
  name:         z.string().min(1).max(500),
  estimateDays: z.number().nonnegative(),
  plannedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  parentId:     z.number().int().positive().optional(),
  assigneeId:   z.number().int().positive().optional(),
  level:        z.number().int().nonnegative().default(1),
  sortOrder:    z.number().int().nonnegative().default(0),
  isBuffer:     z.boolean().default(false),
  isLeaf:       z.boolean().default(true),
  remarks:      z.string().optional(),
})

export const updateTaskSchema = z.object({
  id:           z.number().int().positive(),
  name:         z.string().min(1).max(500).optional(),
  estimateDays: z.number().nonnegative().optional(),
  plannedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualStart:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualEnd:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  parentId:     z.number().int().positive().optional(),
  assigneeId:   z.number().int().positive().optional(),
  level:        z.number().int().nonnegative().optional(),
  sortOrder:    z.number().int().nonnegative().optional(),
  isBuffer:     z.boolean().optional(),
  isLeaf:       z.boolean().optional(),
  remarks:      z.string().optional(),
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
 * Creates the tasks tRPC router bound to the given db instance.
 * Production code passes the singleton `db` from `db/index.ts`.
 * Tests pass an in-memory test db.
 */
export function createTasksRouter(db: DrizzleDb) {
  const t = initTRPC.create()

  return t.router({
    // ── tasks.listByProject (Req 3.2) ────────────────────────────────────────
    listByProject: t.procedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ input }): Promise<Task[]> => {
        return db
          .select()
          .from(tasks)
          .where(eq(tasks.projectId, input.projectId))
          .orderBy(asc(tasks.sortOrder))
      }),

    // ── tasks.getById (Req 3.3, 3.4) ────────────────────────────────────────
    getById: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }): Promise<Task> => {
        const rows = await db.select().from(tasks).where(eq(tasks.id, input.id))
        const task = rows[0]
        if (!task) {
          throw toTRPCError(
            new AppError(ErrorCode.TASK_NOT_FOUND, `Task not found: id=${input.id}`),
          )
        }
        return task
      }),

    // ── tasks.create (Req 3.1, 3.7, 3.8, 3.9) ───────────────────────────────
    create: t.procedure
      .input(createTaskSchema)
      .mutation(async ({ input }): Promise<Task> => {
        const rows = await db
          .insert(tasks)
          .values({
            projectId:    input.projectId,
            name:         input.name,
            estimateDays: input.estimateDays,
            plannedStart: input.plannedStart,
            plannedEnd:   input.plannedEnd,
            parentId:     input.parentId,
            assigneeId:   input.assigneeId,
            level:        input.level,
            sortOrder:    input.sortOrder,
            isBuffer:     input.isBuffer,
            isLeaf:       input.isLeaf,
            remarks:      input.remarks,
          })
          .returning()
        const task = rows[0]
        if (!task) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create task' })
        }
        return task
      }),

    // ── tasks.update (Req 3.5, 3.7, 3.8, 3.9) ───────────────────────────────
    update: t.procedure
      .input(updateTaskSchema)
      .mutation(async ({ input }): Promise<Task> => {
        // Verify existence first
        const existing = await db.select().from(tasks).where(eq(tasks.id, input.id))
        if (!existing[0]) {
          throw toTRPCError(
            new AppError(ErrorCode.TASK_NOT_FOUND, `Task not found: id=${input.id}`),
          )
        }

        const updateData: Partial<{
          name: string
          estimateDays: number
          plannedStart: string
          plannedEnd: string
          actualStart: string
          actualEnd: string
          parentId: number
          assigneeId: number
          level: number
          sortOrder: number
          isBuffer: boolean
          isLeaf: boolean
          remarks: string
          updatedAt: Date
        }> = {
          updatedAt: new Date(),
        }

        if (input.name !== undefined)         updateData.name         = input.name
        if (input.estimateDays !== undefined) updateData.estimateDays = input.estimateDays
        if (input.plannedStart !== undefined) updateData.plannedStart = input.plannedStart
        if (input.plannedEnd !== undefined)   updateData.plannedEnd   = input.plannedEnd
        if (input.actualStart !== undefined)  updateData.actualStart  = input.actualStart
        if (input.actualEnd !== undefined)    updateData.actualEnd    = input.actualEnd
        if (input.parentId !== undefined)     updateData.parentId     = input.parentId
        if (input.assigneeId !== undefined)   updateData.assigneeId   = input.assigneeId
        if (input.level !== undefined)        updateData.level        = input.level
        if (input.sortOrder !== undefined)    updateData.sortOrder    = input.sortOrder
        if (input.isBuffer !== undefined)     updateData.isBuffer     = input.isBuffer
        if (input.isLeaf !== undefined)       updateData.isLeaf       = input.isLeaf
        if (input.remarks !== undefined)      updateData.remarks      = input.remarks

        const rows = await db
          .update(tasks)
          .set(updateData)
          .where(eq(tasks.id, input.id))
          .returning()
        const task = rows[0]
        if (!task) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update task' })
        }
        return task
      }),

    // ── tasks.delete (Req 3.6) ───────────────────────────────────────────────
    delete: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }): Promise<{ success: true }> => {
        // Verify existence first
        const existing = await db.select().from(tasks).where(eq(tasks.id, input.id))
        if (!existing[0]) {
          throw toTRPCError(
            new AppError(ErrorCode.TASK_NOT_FOUND, `Task not found: id=${input.id}`),
          )
        }

        // CASCADE deletion of task_dependencies and progress_snapshots is handled
        // by FK constraints (PRAGMA foreign_keys = ON + ON DELETE CASCADE in schema).
        // Both taskDependencies.taskId and taskDependencies.dependsOnTaskId have
        // ON DELETE CASCADE, so deleting the task removes all related rows.
        await db.delete(tasks).where(eq(tasks.id, input.id))
        return { success: true }
      }),
  })
}

// ── Convenience export for tests ──────────────────────────────────────────────

/**
 * Alias for use in tests: `tasksRouter` is the factory function.
 * Usage in tests: `const router = createTasksRouter(testDb)`
 */
export { createTasksRouter as tasksRouter }
