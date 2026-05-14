/**
 * Task 2.1–2.4: Progress tRPC router
 * Requirements: 1.1–1.7, 2.1–2.4, 3.1–3.4, 4.1–4.3, 6.1–6.4
 *
 * Feature Flag: ENABLE_PROGRESS_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, asc, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import pino from 'pino'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import { progressSnapshots, tasks, members, holidays } from '../db/schema.js'
import type { ProgressSnapshot } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { calculateTaskPv } from '../services/evm-engine.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_PROGRESS_ROUTER = true

// ── Logger ────────────────────────────────────────────────────────────────────

const logger = pino({ name: 'progress-router' })

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const recordProgressSchema = z.object({
  taskId:       z.number().int().positive(),
  snapshotDate: dateString,
  progressPct:  z.number().int().min(0).max(100),
  acDays:       z.number().nonnegative(),
})

// ── AppError → TRPCError conversion ───────────────────────────────────────────

function toTRPCError(e: AppError): TRPCError {
  const codeMap: Record<string, TRPCError['code']> = {
    PROJ_NOT_FOUND:       'NOT_FOUND',
    TASK_NOT_FOUND:       'NOT_FOUND',
    SNAP_TASK_NOT_FOUND:  'NOT_FOUND',
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
 * Creates the progress tRPC router bound to the given db instance.
 * Production code passes the singleton `db` from `db/index.ts`.
 * Tests pass an in-memory test db.
 */
export function createProgressRouter(db: DrizzleDb) {
  const t = initTRPC.create()

  return t.router({
    // ── progress.record (Req 1.1–1.7) ─────────────────────────────────────────
    record: t.procedure
      .input(recordProgressSchema)
      .mutation(async ({ input }): Promise<ProgressSnapshot> => {
        logger.info({ taskId: input.taskId, snapshotDate: input.snapshotDate }, 'progress.record called')

        // タスク存在確認
        const taskRows = await db.select().from(tasks).where(eq(tasks.id, input.taskId))
        const task = taskRows[0]
        if (!task) {
          throw toTRPCError(
            new AppError(ErrorCode.SNAP_TASK_NOT_FOUND, `Task not found: id=${input.taskId}`),
          )
        }

        // pv_days 計算用に members と holidays を取得
        const projectMembers = await db
          .select()
          .from(members)
          .where(eq(members.projectId, task.projectId))

        const projectHolidays = await db
          .select()
          .from(holidays)
          .where(eq(holidays.projectId, task.projectId))

        // assignee 未設定時は availabilityRate = 1.0
        const member =
          task.assigneeId !== null
            ? projectMembers.find((m) => m.id === task.assigneeId) ?? null
            : null
        const availabilityRate = member?.availabilityRate ?? 1.0

        // ev_days / pv_days 計算
        const evDays = task.estimateDays * (input.progressPct / 100)
        const pvDays = calculateTaskPv(task, input.snapshotDate, availabilityRate, projectHolidays)

        // upsert: (task_id, snapshot_date) がすでに存在する場合は更新
        const rows = await db
          .insert(progressSnapshots)
          .values({
            taskId:       input.taskId,
            snapshotDate: input.snapshotDate,
            progressPct:  input.progressPct,
            pvDays,
            evDays,
            acDays:       input.acDays,
          })
          .onConflictDoUpdate({
            target: [progressSnapshots.taskId, progressSnapshots.snapshotDate],
            set: {
              progressPct: sql`excluded.progress_pct`,
              pvDays:      sql`excluded.pv_days`,
              evDays:      sql`excluded.ev_days`,
              acDays:      sql`excluded.ac_days`,
            },
          })
          .returning()

        const snapshot = rows[0]
        if (!snapshot) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to record progress' })
        }

        logger.info({ taskId: input.taskId, snapshotDate: input.snapshotDate }, 'progress.record succeeded')
        return snapshot
      }),

    // ── progress.getByDate (Req 2.1–2.4) ──────────────────────────────────────
    getByDate: t.procedure
      .input(z.object({
        projectId:    z.number().int().positive(),
        snapshotDate: dateString,
      }))
      .query(async ({ input }): Promise<ProgressSnapshot[]> => {
        return db
          .select({
            id:           progressSnapshots.id,
            taskId:       progressSnapshots.taskId,
            snapshotDate: progressSnapshots.snapshotDate,
            progressPct:  progressSnapshots.progressPct,
            pvDays:       progressSnapshots.pvDays,
            evDays:       progressSnapshots.evDays,
            acDays:       progressSnapshots.acDays,
            createdAt:    progressSnapshots.createdAt,
          })
          .from(progressSnapshots)
          .innerJoin(tasks, eq(tasks.id, progressSnapshots.taskId))
          .where(
            sql`${tasks.projectId} = ${input.projectId} AND ${progressSnapshots.snapshotDate} = ${input.snapshotDate}`,
          )
          .orderBy(asc(progressSnapshots.taskId))
      }),

    // ── progress.getLatest (Req 3.1–3.4) ──────────────────────────────────────
    getLatest: t.procedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ input }): Promise<ProgressSnapshot[]> => {
        // 各タスクの MAX(snapshot_date) を持つスナップショットのみを返す相関サブクエリ
        return db
          .select({
            id:           progressSnapshots.id,
            taskId:       progressSnapshots.taskId,
            snapshotDate: progressSnapshots.snapshotDate,
            progressPct:  progressSnapshots.progressPct,
            pvDays:       progressSnapshots.pvDays,
            evDays:       progressSnapshots.evDays,
            acDays:       progressSnapshots.acDays,
            createdAt:    progressSnapshots.createdAt,
          })
          .from(progressSnapshots)
          .innerJoin(tasks, eq(tasks.id, progressSnapshots.taskId))
          .where(
            sql`${tasks.projectId} = ${input.projectId} AND ${progressSnapshots.snapshotDate} = (SELECT MAX(s2.snapshot_date) FROM progress_snapshots s2 WHERE s2.task_id = ${progressSnapshots.taskId})`,
          )
      }),

    // ── progress.getHistory (Req 4.1–4.3) ─────────────────────────────────────
    getHistory: t.procedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .query(async ({ input }): Promise<ProgressSnapshot[]> => {
        return db
          .select()
          .from(progressSnapshots)
          .where(eq(progressSnapshots.taskId, input.taskId))
          .orderBy(asc(progressSnapshots.snapshotDate))
      }),
  })
}

// ── Convenience export for tests ──────────────────────────────────────────────

/**
 * Alias for use in tests: `progressRouter` is the factory function.
 * Usage in tests: `const router = createProgressRouter(testDb)`
 */
export { createProgressRouter as progressRouter }
