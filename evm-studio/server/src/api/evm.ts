/**
 * Task 1.1–1.2: EVM tRPC router skeleton
 * Requirements: dashboard feature
 *
 * Feature Flag: ENABLE_EVM_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, asc, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import { projects, tasks, members, holidays, progressSnapshots, taskDependencies } from '../db/schema.js'
import * as schema from '../db/schema.js'
import type { TaskEvmMetrics } from '../services/evm-engine.js'
import { calculateEvmMetrics, calculateFeverChart } from '../services/evm-engine.js'
import { findCriticalPath } from '../services/critical-path.js'

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

        // ── Task 2.1: DB クエリ集約と EVM メトリクス計算 ─────────────────────────

        // プロジェクトに属するタスク・メンバー・休日を取得
        const projectTasks = await db
          .select()
          .from(tasks)
          .where(eq(tasks.projectId, input.projectId))

        const projectMembers = await db
          .select()
          .from(members)
          .where(eq(members.projectId, input.projectId))

        const projectHolidays = await db
          .select()
          .from(holidays)
          .where(eq(holidays.projectId, input.projectId))

        // 各タスクの最新スナップショット（相関サブクエリ）
        const latestSnapshots = await db
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
          .innerJoin(tasks, eq(progressSnapshots.taskId, tasks.id))
          .where(
            sql`${tasks.projectId} = ${input.projectId} AND ${progressSnapshots.snapshotDate} = (SELECT MAX(s2.snapshot_date) FROM progress_snapshots s2 WHERE s2.task_id = ${progressSnapshots.taskId})`,
          )

        // プロジェクト全体 EVM 計算
        const evmInput = {
          tasks: projectTasks,
          members: projectMembers,
          holidays: projectHolidays,
          snapshots: latestSnapshots,
          baseDate: input.baseDate,
        }
        const projectMetrics = calculateEvmMetrics(evmInput)

        // summary フィールドに変換
        const summary: EvmSummaryOutput = {
          bac:  projectMetrics.bac,
          pv:   projectMetrics.pv,
          ev:   projectMetrics.ev,
          ac:   projectMetrics.ac,
          spi:  projectMetrics.spi,
          cpi:  projectMetrics.cpi,
          eac:  projectMetrics.eac,
          vac:  projectMetrics.vac,
          etc:  projectMetrics.etc,
          tcpi: projectMetrics.tcpi,
        }

        // ── Task 2.2: 担当者別 EVM 集計 ──────────────────────────────────────────

        // assigneeId でタスクをグループ化
        const tasksByAssignee = new Map<number, typeof projectTasks>()
        for (const task of projectTasks) {
          if (task.assigneeId === null) continue
          const group = tasksByAssignee.get(task.assigneeId) ?? []
          group.push(task)
          tasksByAssignee.set(task.assigneeId, group)
        }

        const assignees: AssigneeEvmOutput[] = []
        for (const [assigneeId, assigneeTasks] of tasksByAssignee.entries()) {
          const member = projectMembers.find((m) => m.id === assigneeId)
          if (!member) continue

          const assigneeMetrics = calculateEvmMetrics({
            tasks: assigneeTasks,
            members: projectMembers,
            holidays: projectHolidays,
            snapshots: latestSnapshots,
            baseDate: input.baseDate,
          })

          let status: AssigneeEvmOutput['status']
          if (assigneeMetrics.spi === null) {
            status = 'na'
          } else if (assigneeMetrics.spi < 0.8) {
            status = 'critical'
          } else if (assigneeMetrics.spi < 0.9) {
            status = 'warning'
          } else {
            status = 'normal'
          }

          assignees.push({
            assigneeId,
            assigneeName: member.name,
            bac: assigneeMetrics.bac,
            ev:  assigneeMetrics.ev,
            pv:  assigneeMetrics.pv,
            ac:  assigneeMetrics.ac,
            spi: assigneeMetrics.spi,
            cpi: assigneeMetrics.cpi,
            status,
          })
        }

        // ── Task 2.3: アラート生成 ────────────────────────────────────────────────

        // タスク ID → タスク名マップ
        const taskNameMap = new Map(projectTasks.map((t) => [t.id, t.name]))
        // タスク ID → 担当者名マップ
        const taskAssigneeNameMap = new Map(
          projectTasks.map((t) => [
            t.id,
            t.assigneeId !== null
              ? (projectMembers.find((m) => m.id === t.assigneeId)?.name ?? '')
              : '',
          ]),
        )

        const alerts: AlertOutput[] = projectMetrics.taskMetrics
          .filter((tm) => tm.alertLevel === 'CRITICAL_DELAY' || tm.alertLevel === 'WARNING_DELAY')
          .map((tm): AlertOutput => ({
            taskId:       tm.taskId,
            taskName:     taskNameMap.get(tm.taskId) ?? '',
            assigneeName: taskAssigneeNameMap.get(tm.taskId) ?? '',
            spi:          tm.spi,
            level:        tm.alertLevel === 'CRITICAL_DELAY' ? 'critical' : 'warning',
          }))

        // ── Task 2.4: CCPM フィーバーチャートデータ ───────────────────────────────

        // バッファタスクを抽出
        const bufferTasks = projectTasks.filter((t) => t.isBuffer)

        let feverChart: FeverChartOutput | null = null
        if (bufferTasks.length > 0) {
          // バッファ総日数
          const bufferTotalDays = bufferTasks.reduce((sum, t) => sum + t.estimateDays, 0)

          // タスク依存関係を取得してクリティカルパスを求める
          const projectDeps = await db
            .select()
            .from(taskDependencies)
            .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
            .where(eq(tasks.projectId, input.projectId))
            .then((rows) => rows.map((r) => r.task_dependencies))

          const { criticalPath } = findCriticalPath({
            tasks: projectTasks,
            dependencies: projectDeps,
          })

          // クリティカルチェーンのタスク（バッファ除外）
          const criticalChainTaskIds = new Set(criticalPath)
          const chainTasks = projectTasks.filter(
            (t) => criticalChainTaskIds.has(t.id) && !t.isBuffer,
          )

          const bacOfChain = chainTasks.reduce((sum, t) => sum + t.estimateDays, 0)
          const completedEvOnChain = chainTasks.reduce((sum, t) => {
            const snap = latestSnapshots.find((s) => s.taskId === t.id)
            const progressPct = snap?.progressPct ?? 0
            return sum + t.estimateDays * (progressPct / 100)
          }, 0)

          const feverData = calculateFeverChart(
            0, // cumulativeDelayDays: 将来タスクで実装
            bufferTotalDays,
            completedEvOnChain,
            bacOfChain,
          )

          feverChart = {
            bufferConsumption:      feverData.bufferConsumption,
            criticalChainCompletion: feverData.criticalChainCompletion,
            zone:                   feverData.zone,
          }
        }

        // ── Task 2.5: SPI トレンドデータ ──────────────────────────────────────────

        // snapshot_date の一意リストを取得（昇順）
        const distinctDates = await db
          .selectDistinct({ snapshotDate: progressSnapshots.snapshotDate })
          .from(progressSnapshots)
          .innerJoin(tasks, eq(progressSnapshots.taskId, tasks.id))
          .where(eq(tasks.projectId, input.projectId))
          .orderBy(asc(progressSnapshots.snapshotDate))

        const spiTrend: SpiTrendPoint[] = []
        for (const { snapshotDate } of distinctDates) {
          // 各日付ごとにその日付時点のスナップショットを取得（その日付以前の最新）
          const snapshotsAtDate = await db
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
            .innerJoin(tasks, eq(progressSnapshots.taskId, tasks.id))
            .where(
              sql`${tasks.projectId} = ${input.projectId} AND ${progressSnapshots.snapshotDate} = (SELECT MAX(s2.snapshot_date) FROM progress_snapshots s2 WHERE s2.task_id = ${progressSnapshots.taskId} AND s2.snapshot_date <= ${snapshotDate})`,
            )

          const trendMetrics = calculateEvmMetrics({
            tasks: projectTasks,
            members: projectMembers,
            holidays: projectHolidays,
            snapshots: snapshotsAtDate,
            baseDate: snapshotDate,
          })

          spiTrend.push({
            snapshotDate,
            spi: trendMetrics.spi,
            cpi: trendMetrics.cpi,
          })
        }

        // ── Task 7.1: ガントチャート用タスクリスト ────────────────────────────────

        const gantt: GanttTaskOutput[] = projectTasks
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((task): GanttTaskOutput => {
            const latestSnap = latestSnapshots.find((s) => s.taskId === task.id)
            const taskMetric = projectMetrics.taskMetrics.find((m) => m.taskId === task.id)
            const assignee = projectMembers.find((m) => m.id === task.assigneeId)
            return {
              id:           task.id,
              name:         task.name,
              assigneeName: assignee?.name ?? null,
              plannedStart: task.plannedStart ?? '',
              plannedEnd:   task.plannedEnd ?? '',
              progressPct:  latestSnap?.progressPct ?? 0,
              spi:          taskMetric?.spi ?? null,
              level:        task.level,
              sortOrder:    task.sortOrder,
              isBuffer:     task.isBuffer,
              isLeaf:       task.isLeaf,
            }
          })

        return {
          summary,
          tasks:      projectMetrics.taskMetrics,
          assignees,
          alerts,
          feverChart,
          spiTrend,
          gantt,
        }
      }),
  })
}

// ── Convenience export for tests ──────────────────────────────────────────────

export { createEvmRouter as evmRouter }
