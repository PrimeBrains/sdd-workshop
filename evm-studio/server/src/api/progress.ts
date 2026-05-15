/**
 * Tasks 2.1–2.4b: Progress tRPC router (再実装)
 * Requirements: 1.4, 1.5, 1.6, 2.1–2.10, 3.1–3.4, 4.1–4.5, 4.5.1–4.5.6, 5.1–5.3, 9.1–9.4
 *
 * Feature Flag: ENABLE_PROGRESS_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import pino from 'pino'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import { progressSnapshots, tasks } from '../db/schema.js'
import type { ProgressSnapshot } from '../db/schema.js'
import * as schema from '../db/schema.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_PROGRESS_ROUTER = true

// ── Logger ────────────────────────────────────────────────────────────────────

const logger = pino({ name: 'progress-router' })

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * progress.record の入力スキーマ
 * - note は 1000 文字以下、nullable + optional（未指定・null・空文字を NULL に正規化）
 */
export const recordProgressSchema = z.object({
  taskId:       z.number().int().positive(),
  snapshotDate: dateString,
  progressPct:  z.number().int().min(0).max(100),
  acDays:       z.number().min(0),
  note:         z.string().max(1000).nullable().optional(),
})

export type RecordProgressInput = z.infer<typeof recordProgressSchema>

// ── AppError → TRPCError 変換 ─────────────────────────────────────────────────

function toTRPCError(e: AppError): TRPCError {
  const codeMap: Record<string, TRPCError['code']> = {
    SNAP_TASK_NOT_FOUND: 'NOT_FOUND',
    SNAP_FUTURE_DATE:    'BAD_REQUEST',
    SNAP_NOTE_TOO_LONG:  'BAD_REQUEST',
    PROJ_NOT_FOUND:      'NOT_FOUND',
    TASK_NOT_FOUND:      'NOT_FOUND',
    MEMBER_NOT_FOUND:    'NOT_FOUND',
  }
  return new TRPCError({
    code:    codeMap[e.code] ?? 'INTERNAL_SERVER_ERROR',
    message: e.message,
    cause:   e,
  })
}

// ── DB type ───────────────────────────────────────────────────────────────────

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

// ── 軽量ペイロード型（getByDateRange 用） ─────────────────────────────────────

export interface ProgressSnapshotLean {
  taskId:       number
  snapshotDate: string
  progressPct:  number
  acDays:       number
}

// ── Router factory ────────────────────────────────────────────────────────────

/**
 * Creates the progress tRPC router bound to the given db instance.
 * Production code passes the singleton `db` from `db/index.ts`.
 * Tests pass an in-memory test db.
 */
export function createProgressRouter(db: DrizzleDb) {
  const t = initTRPC.create()

  return t.router({
    // ── progress.record (Req 1.4–1.6, 2.1–2.10, 9.1–9.4) ──────────────────────
    record: t.procedure
      .input(recordProgressSchema)
      .mutation(async ({ input }): Promise<ProgressSnapshot> => {
        try {
          // 未来日付 reject: サーバー側 today を baseDate とみなす
          const today = new Date().toISOString().slice(0, 10)
          if (input.snapshotDate > today) {
            throw new AppError(
              ErrorCode.SNAP_FUTURE_DATE,
              `スナップショット日付は基準日(${today})以前を指定してください: ${input.snapshotDate}`,
            )
          }

          // タスク存在確認
          const taskRows = await db.select().from(tasks).where(eq(tasks.id, input.taskId))
          if (taskRows.length === 0) {
            throw new AppError(
              ErrorCode.SNAP_TASK_NOT_FOUND,
              `Task not found: id=${input.taskId}`,
            )
          }

          // note 正規化: '' / undefined → null
          const normalizedNote =
            input.note === '' || input.note === undefined ? null : input.note

          // Drizzle upsert on (taskId, snapshotDate)
          const rows = await db
            .insert(progressSnapshots)
            .values({
              taskId:       input.taskId,
              snapshotDate: input.snapshotDate,
              progressPct:  input.progressPct,
              acDays:       input.acDays,
              note:         normalizedNote,
            })
            .onConflictDoUpdate({
              target: [progressSnapshots.taskId, progressSnapshots.snapshotDate],
              set: {
                progressPct: sql`excluded.progress_pct`,
                acDays:      sql`excluded.ac_days`,
                note:        sql`excluded.note`,
              },
            })
            .returning()

          const snapshot = rows[0]
          if (!snapshot) {
            throw new TRPCError({
              code:    'INTERNAL_SERVER_ERROR',
              message: 'Failed to record progress',
            })
          }

          logger.info(
            {
              taskId:       input.taskId,
              snapshotDate: input.snapshotDate,
              progressPct:  input.progressPct,
            },
            'progress.record',
          )
          return snapshot
        } catch (e) {
          if (e instanceof AppError) {
            logger.warn({ taskId: input.taskId, code: e.code }, 'progress.record failed')
            throw toTRPCError(e)
          }
          throw e
        }
      }),

    // ── progress.getLatest (Req 3.1–3.4) ──────────────────────────────────────
    getLatest: t.procedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .query(async ({ input }): Promise<ProgressSnapshot | null> => {
        const rows = await db
          .select()
          .from(progressSnapshots)
          .where(eq(progressSnapshots.taskId, input.taskId))
          .orderBy(desc(progressSnapshots.snapshotDate))
          .limit(1)

        return rows[0] ?? null
      }),

    // ── progress.getByDate (Req 4.1–4.5) ──────────────────────────────────────
    getByDate: t.procedure
      .input(z.object({
        projectId:    z.number().int().positive(),
        snapshotDate: dateString,
      }))
      .query(async ({ input }): Promise<ProgressSnapshot[]> => {
        const rows = await db
          .select({
            id:           progressSnapshots.id,
            taskId:       progressSnapshots.taskId,
            snapshotDate: progressSnapshots.snapshotDate,
            progressPct:  progressSnapshots.progressPct,
            pvDays:       progressSnapshots.pvDays,
            evDays:       progressSnapshots.evDays,
            acDays:       progressSnapshots.acDays,
            note:         progressSnapshots.note,
            createdAt:    progressSnapshots.createdAt,
          })
          .from(progressSnapshots)
          .innerJoin(tasks, eq(tasks.id, progressSnapshots.taskId))
          .where(
            and(
              eq(tasks.projectId, input.projectId),
              eq(progressSnapshots.snapshotDate, input.snapshotDate),
            ),
          )
          .orderBy(asc(progressSnapshots.taskId))

        return rows
      }),

    // ── progress.getByDateRange (Req 4.5.1–4.5.6) ─────────────────────────────
    getByDateRange: t.procedure
      .input(z.object({
        projectId: z.number().int().positive(),
        startDate: dateString,
        endDate:   dateString,
      }))
      .query(async ({ input }): Promise<ProgressSnapshotLean[]> => {
        const rows = await db
          .select({
            taskId:       progressSnapshots.taskId,
            snapshotDate: progressSnapshots.snapshotDate,
            progressPct:  progressSnapshots.progressPct,
            acDays:       progressSnapshots.acDays,
          })
          .from(progressSnapshots)
          .innerJoin(tasks, eq(tasks.id, progressSnapshots.taskId))
          .where(
            and(
              eq(tasks.projectId, input.projectId),
              gte(progressSnapshots.snapshotDate, input.startDate),
              lte(progressSnapshots.snapshotDate, input.endDate),
            ),
          )
          .orderBy(asc(progressSnapshots.snapshotDate), asc(progressSnapshots.taskId))

        return rows
      }),

    // ── progress.getHistory (Req 5.1–5.3) ─────────────────────────────────────
    getHistory: t.procedure
      .input(z.object({ taskId: z.number().int().positive() }))
      .query(async ({ input }): Promise<ProgressSnapshot[]> => {
        const rows = await db
          .select()
          .from(progressSnapshots)
          .where(eq(progressSnapshots.taskId, input.taskId))
          .orderBy(asc(progressSnapshots.snapshotDate))

        return rows
      }),
  })
}

// ── Convenience export for tests ──────────────────────────────────────────────

/**
 * Alias for use in tests: `progressRouter` is the factory function.
 * Usage in tests: `const router = createProgressRouter(testDb)`
 */
export { createProgressRouter as progressRouter }
