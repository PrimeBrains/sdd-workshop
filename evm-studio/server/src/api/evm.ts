/**
 * Task 1.1–1.2: EVM tRPC router skeleton
 * Task 8.1: 新 EVM 計算 API スキーマ・型定義
 * Task 8.2: `evm.calculate` を集約レスポンス対応に書き換える
 *
 * Requirements: 9.1-9.6, 11.5, 12.1, 12.2
 *
 * Feature Flag: ENABLE_EVM_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and, between } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import pino from 'pino'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import {
  projects,
  tasks,
  members,
  holidays,
  progressSnapshots,
  taskDependencies,
} from '../db/schema.js'
import type { Holiday, Member, ProgressSnapshot, Project, Task, TaskDependency } from '../db/schema.js'
import * as schema from '../db/schema.js'
import type { EvmSummary } from '../services/evm-engine.js'
import { calculateEvmMetrics, calculatePrevDate, calculatePrevDayDelta } from '../services/evm-engine.js'
import type { AssigneeEvm, AssigneePrevDay } from '../services/evm-assignees.js'
import { aggregateAssignees, aggregateAssigneesAt } from '../services/evm-assignees.js'
import type { TaskEvm, TaskPrevDiff, AlertEntry } from '../services/evm-tasks.js'
import { rollupTasks, rollupTasksPrevDiff, filterAlerts } from '../services/evm-tasks.js'
import type { SpiTrendPoint as SpiTrendPointService } from '../services/evm-trend.js'
import { buildSpiTrend } from '../services/evm-trend.js'
import type { FeverChart } from '../services/evm-fever.js'
import { calculateFever } from '../services/evm-fever.js'
import type { GanttMeta } from '../services/evm-gantt.js'
import { buildGanttMeta } from '../services/evm-gantt.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_EVM_ROUTER = true

// ── pino logger ───────────────────────────────────────────────────────────────
const logger = pino({ name: 'evm-router' })

// ── DB type ───────────────────────────────────────────────────────────────────

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

// ── Zod Schemas ───────────────────────────────────────────────────────────────

/**
 * 旧入力スキーマ。client コンポーネントや旧テストとの互換のため引き続きエクスポートする。
 * 実体は `evmCalculateSchema` のサブセット (options 無し)。
 */
export const calculateInputSchema = z.object({
  projectId: z.number().int().positive(),
  baseDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'baseDate must be YYYY-MM-DD'),
})

// ── Legacy Output Types ───────────────────────────────────────────────────────
//
// dashboard 仕様で先行実装された client コンポーネント
// (`ProjectSummaryCards`, `AssigneeTable`, `AlertBanner`, `GanttChart`,
//  `SpiTrendChart`, `FeverChart`) が import しているため、
// 型としては引き続きエクスポートする。
// 新ハンドラは下記の `EvmCalculateOutput` を返すため、
// 旧クライアントは別途のタスクで新 shape へ移行される予定。

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

// ── 新 EVM 計算 API スキーマ・型（タスク 8.1） ───────────────────────────────────
//
// Requirements: 9.1, 9.5
// `evm.calculate` を統合計算 API に拡張するための入力スキーマと出力型。

export const evmCalculateSchema = z.object({
  projectId: z.number().int().positive(),
  baseDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // YYYY-MM-DD
  options: z.object({
    prevDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    trendWindowDays:  z.number().int().positive().optional(),
  }).optional(),
})

export type EvmCalculateInput = z.infer<typeof evmCalculateSchema>

export type EvmCalculateOutput = {
  summary: EvmSummary & { spiDelta: number; cpiDelta: number }
  prevDay: {
    summary:   EvmSummary
    assignees: ReadonlyArray<AssigneePrevDay>
    tasks:     ReadonlyArray<TaskPrevDiff>
  } | null
  assignees: ReadonlyArray<AssigneeEvm>
  alerts:    ReadonlyArray<AlertEntry>
  spiTrend:  ReadonlyArray<SpiTrendPointService>
  fever:     FeverChart | null
  tasks:     ReadonlyArray<TaskEvm>
  gantt:     GanttMeta
}

// ── AppError → TRPCError conversion ───────────────────────────────────────────

/**
 * `AppError.code` を tRPC の HTTP/RPC レベルのエラーコードへ変換する（要件 11.5）。
 *
 * - `PROJ_NOT_FOUND` 系 → `NOT_FOUND`
 * - `EVM_INVALID_BASE_DATE` / 各種バリデーションエラー → `BAD_REQUEST`
 * - `EVM_INVALID_AVAILABILITY_RATE` / `EVM_CIRCULAR_DEPENDENCY` → `INTERNAL_SERVER_ERROR`
 *   （データ起因の不整合は呼び出し側では対処不能のため 5xx 扱い）
 */
function toTRPCError(e: AppError): TRPCError {
  const codeMap: Record<string, TRPCError['code']> = {
    PROJ_NOT_FOUND:                'NOT_FOUND',
    TASK_NOT_FOUND:                'NOT_FOUND',
    SNAP_TASK_NOT_FOUND:           'NOT_FOUND',
    MEMBER_NOT_FOUND:              'NOT_FOUND',
    IMPORT_INVALID_YAML:           'BAD_REQUEST',
    IMPORT_PARSE_ERROR:            'BAD_REQUEST',
    IMPORT_MISSING_FIELD:          'BAD_REQUEST',
    MEMBER_INVALID_RATE:           'BAD_REQUEST',
    EVM_INVALID_BASE_DATE:         'BAD_REQUEST',
    EVM_INVALID_AVAILABILITY_RATE: 'INTERNAL_SERVER_ERROR',
    EVM_CIRCULAR_DEPENDENCY:       'INTERNAL_SERVER_ERROR',
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
    //
    // 要件 9.1-9.6, 11.5, 12.1, 12.2:
    // - 入力 `{ projectId, baseDate, options? }`、出力 `EvmCalculateOutput`
    // - DB I/O は 1 回（project / tasks / dependencies / members / holidays /
    //   範囲スナップショット）で完結させ、純粋関数群で計算する
    // - エラーは `AppError` → `TRPCError` に変換
    calculate: t.procedure
      .input(evmCalculateSchema)
      .query(async ({ input }): Promise<EvmCalculateOutput> => {
        const t0 = Date.now()
        const { projectId, baseDate, options } = input

        try {
          // ── DB I/O（1 回に集約: 要件 9.6 / 12.2） ─────────────────────────────

          // 1) プロジェクト
          const projectRows = await db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
          const project: Project | undefined = projectRows[0]
          if (!project) {
            throw new AppError(
              ErrorCode.PROJ_NOT_FOUND,
              `Project not found: id=${projectId}`,
            )
          }

          // 2) タスク
          const projectTasks: Task[] = await db
            .select()
            .from(tasks)
            .where(eq(tasks.projectId, projectId))

          // 3) タスク依存関係（プロジェクト内タスクの id 経由で絞り込み）
          const projectDeps: TaskDependency[] = await db
            .select()
            .from(taskDependencies)
            .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
            .where(eq(tasks.projectId, projectId))
            .then((rows) => rows.map((r) => r.task_dependencies))

          // 4) メンバー
          const projectMembers: Member[] = await db
            .select()
            .from(members)
            .where(eq(members.projectId, projectId))

          // 5) 休日
          const projectHolidays: Holiday[] = await db
            .select()
            .from(holidays)
            .where(eq(holidays.projectId, projectId))

          // 6) 範囲スナップショット [project.startDate, baseDate]
          //    `progress.getByDateRange` は未実装のため Drizzle で直接取得する。
          const snapshotRows = await db
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
            .innerJoin(tasks, eq(progressSnapshots.taskId, tasks.id))
            .where(
              and(
                eq(tasks.projectId, projectId),
                between(progressSnapshots.snapshotDate, project.startDate, baseDate),
              ),
            )
          const projectSnapshots: ProgressSnapshot[] = snapshotRows

          // ── 純粋関数群への dispatch ───────────────────────────────────────────

          // baseDate 時点で taskId ごとに 1 件採用 (≤ baseDate の最新)。
          // `calculateEvmMetrics` は受け取った snapshots を taskId フィルタで線形検索する
          // ため、ここで pre-filter しておくことで「baseDate 以前最新」を保証する。
          const latestSnapshotsAt = (cutoff: string): ProgressSnapshot[] => {
            const byTask = new Map<number, ProgressSnapshot>()
            for (const s of projectSnapshots) {
              if (s.snapshotDate > cutoff) continue
              const cur = byTask.get(s.taskId)
              if (cur === undefined || s.snapshotDate > cur.snapshotDate) {
                byTask.set(s.taskId, s)
              }
            }
            return Array.from(byTask.values())
          }

          const baseDateSnapshots = latestSnapshotsAt(baseDate)

          // 1) 当日サマリー
          const currentMetrics = calculateEvmMetrics({
            tasks: projectTasks,
            members: projectMembers,
            holidays: projectHolidays,
            snapshots: baseDateSnapshots,
            baseDate,
            project: { startDate: project.startDate, endDate: project.endDate },
          })
          const currentSummary: EvmSummary = {
            bac:  currentMetrics.bac,
            pv:   currentMetrics.pv,
            ev:   currentMetrics.ev,
            ac:   currentMetrics.ac,
            spi:  currentMetrics.spi,
            cpi:  currentMetrics.cpi,
            eac:  currentMetrics.eac,
            vac:  currentMetrics.vac,
            etc:  currentMetrics.etc,
            tcpi: currentMetrics.tcpi,
          }

          // 2) 前営業日 + 前日比 Delta
          const prevDate = calculatePrevDate(baseDate, projectHolidays, options?.prevDate)

          // prevDate がプロジェクト開始日以前、または該当スナップショットが 0 件のときは
          // prevDay = null を返す（要件 2.x / 9.4）。
          const prevDateSnapshots = latestSnapshotsAt(prevDate)
          const hasPrevSnapshots = projectSnapshots.some((s) => s.snapshotDate <= prevDate)
          const prevDateIsBeforeStart = prevDate < project.startDate

          let previousSummary: EvmSummary | null = null
          let prevAssignees: ReadonlyArray<AssigneePrevDay> = []
          let prevTasks: ReadonlyArray<TaskPrevDiff> = []

          if (!prevDateIsBeforeStart && hasPrevSnapshots) {
            const prevMetrics = calculateEvmMetrics({
              tasks: projectTasks,
              members: projectMembers,
              holidays: projectHolidays,
              snapshots: prevDateSnapshots,
              baseDate: prevDate,
              project: { startDate: project.startDate, endDate: project.endDate },
            })
            previousSummary = {
              bac:  prevMetrics.bac,
              pv:   prevMetrics.pv,
              ev:   prevMetrics.ev,
              ac:   prevMetrics.ac,
              spi:  prevMetrics.spi,
              cpi:  prevMetrics.cpi,
              eac:  prevMetrics.eac,
              vac:  prevMetrics.vac,
              etc:  prevMetrics.etc,
              tcpi: prevMetrics.tcpi,
            }
            prevAssignees = aggregateAssigneesAt({
              baseDate: prevDate,
              members: projectMembers,
              tasks: projectTasks,
              snapshots: prevDateSnapshots,
              holidays: projectHolidays,
            })
            prevTasks = rollupTasksPrevDiff({
              project: { startDate: project.startDate },
              tasks: projectTasks,
              members: projectMembers,
              snapshots: projectSnapshots,
              holidays: projectHolidays,
              prevDate,
            })
          }

          const { spiDelta, cpiDelta } = calculatePrevDayDelta(currentSummary, previousSummary)

          // 3) 担当者別集計（当日）
          const assignees = aggregateAssignees({
            baseDate,
            members: projectMembers,
            tasks: projectTasks,
            snapshots: baseDateSnapshots,
            holidays: projectHolidays,
          })

          // 4) SPI トレンド（[project.startDate, baseDate] 範囲、または直近 N 日）
          //    `exactOptionalPropertyTypes` 環境下では `undefined` を直接代入できないため
          //    `trendWindowDays` 指定有無で 2 分岐させる。
          const spiTrend = buildSpiTrend({
            baseDate,
            project: { startDate: project.startDate, endDate: project.endDate },
            tasks: projectTasks,
            members: projectMembers,
            holidays: projectHolidays,
            snapshots: projectSnapshots,
            ...(options?.trendWindowDays !== undefined
              ? { trendWindowDays: options.trendWindowDays }
              : {}),
          })

          // 5) フィーバーチャート（バッファ無しの場合 null）
          const fever = calculateFever({
            baseDate,
            tasks: projectTasks,
            dependencies: projectDeps,
            snapshots: projectSnapshots,
            holidays: projectHolidays,
            ...(options?.trendWindowDays !== undefined
              ? { trendWindowDays: options.trendWindowDays }
              : {}),
          })

          // 6) タスクロールアップ（当日）
          const rolledTasks = rollupTasks({
            project: { startDate: project.startDate },
            tasks: projectTasks,
            members: projectMembers,
            snapshots: projectSnapshots,
            holidays: projectHolidays,
            baseDate,
          })

          // 7) アラート（葉タスクの SPI 閾値）
          const alerts = filterAlerts(rolledTasks)

          // 8) ガント描画用日付軸メタ
          const gantt = buildGanttMeta({
            project: { startDate: project.startDate, endDate: project.endDate },
            baseDate,
          })

          // ── 集約レスポンス組み立て ────────────────────────────────────────────
          const output: EvmCalculateOutput = {
            summary: { ...currentSummary, spiDelta, cpiDelta },
            prevDay: previousSummary === null
              ? null
              : {
                  summary:   previousSummary,
                  assignees: prevAssignees,
                  tasks:     prevTasks,
                },
            assignees,
            alerts,
            spiTrend,
            fever,
            tasks: rolledTasks,
            gantt,
          }

          logger.info(
            { projectId, baseDate, durationMs: Date.now() - t0 },
            'evm.calculate',
          )

          return output
        } catch (e) {
          if (e instanceof AppError) {
            throw toTRPCError(e)
          }
          throw e
        }
      }),
  })
}

// ── Convenience export for tests ──────────────────────────────────────────────

export { createEvmRouter as evmRouter }
