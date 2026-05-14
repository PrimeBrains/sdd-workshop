/**
 * Task 1.1–1.2: EVM tRPC router skeleton
 * Requirements: dashboard feature
 *
 * Feature Flag: ENABLE_EVM_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import { projects } from '../db/schema.js'
import * as schema from '../db/schema.js'
import type { TaskEvmMetrics } from '../services/evm-engine.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_EVM_ROUTER = true

// ── DB type ───────────────────────────────────────────────────────────────────

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

// ── Zod Schemas ───────────────────────────────────────────────────────────────

export const calculateInputSchema = z.object({
  projectId: z.number().int().positive(),
  baseDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'baseDate must be YYYY-MM-DD'),
})

// ── Output Types ──────────────────────────────────────────────────────────────

export interface EvmSummaryOutput {
  bac:  number; pv: number; ev: number; ac: number
  spi:  number | null; cpi: number | null
  eac:  number | null; vac: number | null; etc: number | null; tcpi: number | null
}

export interface AssigneeEvmOutput {
  assigneeId: number; assigneeName: string
  bac: number; ev: number; pv: number; ac: number
  spi: number | null; cpi: number | null
  status: 'critical' | 'warning' | 'normal' | 'na'
}

export interface AlertOutput {
  taskId: number; taskName: string; assigneeName: string
  spi: number | null; level: 'critical' | 'warning'
}

export interface SpiTrendPoint { snapshotDate: string; spi: number | null; cpi: number | null }

export interface FeverChartOutput { bufferConsumption: number; criticalChainCompletion: number; zone: 'GREEN' | 'YELLOW' | 'RED' }

export interface GanttTaskOutput {
  id: number; name: string; assigneeName: string | null
  plannedStart: string; plannedEnd: string; progressPct: number; spi: number | null
  level: number; sortOrder: number; isBuffer: boolean; isLeaf: boolean
}

export interface EvmCalculateOutput {
  summary: EvmSummaryOutput
  tasks: TaskEvmMetrics[]
  assignees: AssigneeEvmOutput[]
  alerts: AlertOutput[]
  feverChart: FeverChartOutput | null
  spiTrend: SpiTrendPoint[]
  gantt: GanttTaskOutput[]
}

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

// ── Router factory ────────────────────────────────────────────────────────────

/**
 * Creates the EVM tRPC router bound to the given db instance.
 * Production code passes the singleton `db` from `db/index.ts`.
 * Tests pass an in-memory test db.
 */
export function createEvmRouter(db: DrizzleDb) {
  const t = initTRPC.create()

  return t.router({
    // ── evm.calculate ─────────────────────────────────────────────────────────
    calculate: t.procedure
      .input(calculateInputSchema)
      .query(async ({ input }): Promise<EvmCalculateOutput> => {
        // プロジェクト存在確認
        const projectRows = await db.select().from(projects).where(eq(projects.id, input.projectId))
        const project = projectRows[0]
        if (!project) {
          throw toTRPCError(
            new AppError(ErrorCode.PROJ_NOT_FOUND, `Project not found: id=${input.projectId}`),
          )
        }

        // TODO: 本実装は task 2.x で行う。現時点はスタブ出力を返す
        const stubSummary: EvmSummaryOutput = {
          bac: 0, pv: 0, ev: 0, ac: 0,
          spi: null, cpi: null,
          eac: null, vac: null, etc: null, tcpi: null,
        }

        return {
          summary:    stubSummary,
          tasks:      [],
          assignees:  [],
          alerts:     [],
          feverChart: null,
          spiTrend:   [],
          gantt:      [],
        }
      }),
  })
}

// ── Convenience export for tests ──────────────────────────────────────────────

export { createEvmRouter as evmRouter }
