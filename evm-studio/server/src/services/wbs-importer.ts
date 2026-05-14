/**
 * WBS YAML パーサーと構造バリデーション、アトミックインポート
 *
 * 要件 6.1–6.9: WBS YAML → DB アトミックインポート
 * 要件 6.7: 必須フィールド欠落 → AppError(IMPORT_MISSING_FIELD)
 * 要件 6.10: SAFE_LOAD パース失敗 → AppError(IMPORT_PARSE_ERROR)
 */
import yaml from 'js-yaml'
import { eq, and } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import {
  projects,
  members,
  tasks,
  holidays,
  taskDependencies,
  progressSnapshots,
} from '../db/schema.js'
import * as schema from '../db/schema.js'

// ─── Date helpers ────────────────────────────────────────────────────────────

/**
 * YAML パーサーが Date オブジェクトとして返した値を 'YYYY-MM-DD' 文字列に変換する。
 * js-yaml は YAML 1.1 の非クォート日付（例: 2026-04-06）を Date に変換するため。
 */
function toYMD(val: unknown): string | null {
  if (val == null) return null
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(val)
}

// ─── Parsed YAML interfaces ──────────────────────────────────────────────────

export interface ParsedTask {
  id: string
  title: string
  estimate_days: number       // null は 0 として扱う
  planned_start: string | null
  planned_end: string | null
  parent_id?: string | null
  depends_on?: string[]
  assignee?: string | null
  actual_start?: string | null
  actual_end?: string | null
  progress_pct?: number
  is_buffer?: boolean
}

export interface ParsedTasksYaml {
  tasks: ParsedTask[]
}

export interface ParsedMember {
  id: string
  name: string
  availability_rate: number
  assignment_start?: string
  assignment_end?: string
}

export interface ParsedStaffingYaml {
  members: ParsedMember[]
  meta?: {
    public_holidays?: string[]
  }
}

export interface ParsedScheduleAssignment {
  task_id: string
  planned_start: string
  planned_end: string
}

export interface ParsedScheduleYaml {
  meta: {
    schedule_start: string
    schedule_end: string
  }
  assignments?: ParsedScheduleAssignment[]
}

// ─── Helper: safe YAML load ───────────────────────────────────────────────────

/**
 * js-yaml 4 の DEFAULT_SCHEMA は safe 相当（任意コード実行不可）。
 * 明示的に schema を指定して安全性を担保する（要件 6.10）。
 */
function safeParse(yamlString: string): unknown {
  try {
    return yaml.load(yamlString, { schema: yaml.DEFAULT_SCHEMA })
  } catch {
    throw new AppError(
      ErrorCode.IMPORT_PARSE_ERROR,
      'YAML のパースに失敗しました。構文を確認してください。'
    )
  }
}

// ─── Helper: field presence checks ──────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireField(obj: Record<string, unknown>, field: string, context: string): void {
  if (obj[field] === undefined || obj[field] === null) {
    throw new AppError(
      ErrorCode.IMPORT_MISSING_FIELD,
      `必須フィールド "${field}" が ${context} に存在しません。`
    )
  }
}

// ─── parseTasksYaml ──────────────────────────────────────────────────────────

/**
 * tasks.yaml をパースし構造バリデーションを行う。
 *
 * 必須フィールド: tasks[].(id, title, estimate_days, planned_start, planned_end)
 */
export function parseTasksYaml(yamlString: string): ParsedTasksYaml {
  const raw = safeParse(yamlString)

  if (!isRecord(raw)) {
    throw new AppError(
      ErrorCode.IMPORT_MISSING_FIELD,
      'tasks.yaml のトップレベルはオブジェクトである必要があります。'
    )
  }

  if (!Array.isArray(raw['tasks'])) {
    throw new AppError(
      ErrorCode.IMPORT_MISSING_FIELD,
      'tasks.yaml に必須フィールド "tasks" （配列）が存在しません。'
    )
  }

  const tasksRaw = raw['tasks'] as unknown[]
  const tasks: ParsedTask[] = tasksRaw.map((item, index) => {
    if (!isRecord(item)) {
      throw new AppError(
        ErrorCode.IMPORT_MISSING_FIELD,
        `tasks[${index}] はオブジェクトである必要があります。`
      )
    }

    const ctx = `tasks[${index}]`
    requireField(item, 'id', ctx)
    requireField(item, 'title', ctx)
    // estimate_days / planned_start / planned_end は null 許容
    // （summary タスクや schedule 分離型 YAML では未設定が多い）

    return {
      id: String(item['id']),
      title: String(item['title']),
      estimate_days: item['estimate_days'] != null ? Number(item['estimate_days']) : 0,
      planned_start: toYMD(item['planned_start']),
      planned_end: toYMD(item['planned_end']),
      ...(item['parent_id'] !== undefined ? { parent_id: item['parent_id'] as string | null } : {}),
      ...(item['depends_on'] !== undefined ? { depends_on: item['depends_on'] as string[] } : {}),
      ...(item['assignee'] !== undefined ? { assignee: item['assignee'] as string | null } : {}),
      ...(item['actual_start'] !== undefined ? { actual_start: toYMD(item['actual_start']) } : {}),
      ...(item['actual_end'] !== undefined ? { actual_end: toYMD(item['actual_end']) } : {}),
      ...(item['progress_pct'] !== undefined ? { progress_pct: Number(item['progress_pct']) } : {}),
      ...(item['is_buffer'] !== undefined ? { is_buffer: Boolean(item['is_buffer']) } : {}),
    }
  })

  return { tasks }
}

// ─── parseStaffingYaml ───────────────────────────────────────────────────────

/**
 * staffing.yaml をパースし構造バリデーションを行う。
 *
 * 必須フィールド: members[].(id, name, availability_rate)
 */
export function parseStaffingYaml(yamlString: string): ParsedStaffingYaml {
  const raw = safeParse(yamlString)

  if (!isRecord(raw)) {
    throw new AppError(
      ErrorCode.IMPORT_MISSING_FIELD,
      'staffing.yaml のトップレベルはオブジェクトである必要があります。'
    )
  }

  if (!Array.isArray(raw['members'])) {
    throw new AppError(
      ErrorCode.IMPORT_MISSING_FIELD,
      'staffing.yaml に必須フィールド "members" （配列）が存在しません。'
    )
  }

  const membersRaw = raw['members'] as unknown[]
  const members: ParsedMember[] = membersRaw.map((item, index) => {
    if (!isRecord(item)) {
      throw new AppError(
        ErrorCode.IMPORT_MISSING_FIELD,
        `members[${index}] はオブジェクトである必要があります。`
      )
    }

    const ctx = `members[${index}]`
    requireField(item, 'id', ctx)
    requireField(item, 'name', ctx)
    requireField(item, 'availability_rate', ctx)

    return {
      id: String(item['id']),
      name: String(item['name']),
      availability_rate: Number(item['availability_rate']),
      ...(item['assignment_start'] !== undefined ? { assignment_start: String(item['assignment_start']) } : {}),
      ...(item['assignment_end'] !== undefined ? { assignment_end: String(item['assignment_end']) } : {}),
    }
  })

  // meta は optional
  let meta: ParsedStaffingYaml['meta'] | undefined
  if (raw['meta'] !== undefined) {
    const metaRaw = raw['meta']
    if (isRecord(metaRaw)) {
      meta = {
        ...(Array.isArray(metaRaw['public_holidays'])
          ? { public_holidays: (metaRaw['public_holidays'] as unknown[]).map(String) }
          : {}),
      }
    }
  }

  return { members, ...(meta !== undefined ? { meta } : {}) }
}

// ─── parseScheduleYaml ───────────────────────────────────────────────────────

/**
 * schedule.yaml をパースし構造バリデーションを行う。
 *
 * 必須フィールド: meta.schedule_start, meta.schedule_end
 */
export function parseScheduleYaml(yamlString: string): ParsedScheduleYaml {
  const raw = safeParse(yamlString)

  if (!isRecord(raw)) {
    throw new AppError(
      ErrorCode.IMPORT_MISSING_FIELD,
      'schedule.yaml のトップレベルはオブジェクトである必要があります。'
    )
  }

  if (!isRecord(raw['meta'])) {
    throw new AppError(
      ErrorCode.IMPORT_MISSING_FIELD,
      'schedule.yaml に必須フィールド "meta" が存在しません。'
    )
  }

  const metaRaw = raw['meta']
  requireField(metaRaw, 'schedule_start', 'schedule.yaml meta')
  requireField(metaRaw, 'schedule_end', 'schedule.yaml meta')

  let assignments: ParsedScheduleAssignment[] | undefined
  if (Array.isArray(raw['assignments'])) {
    assignments = (raw['assignments'] as unknown[]).map((item, index) => {
      if (!isRecord(item)) {
        throw new AppError(
          ErrorCode.IMPORT_MISSING_FIELD,
          `schedule.yaml assignments[${index}] はオブジェクトである必要があります。`
        )
      }
      requireField(item, 'task_id', `schedule.yaml assignments[${index}]`)
      requireField(item, 'planned_start', `schedule.yaml assignments[${index}]`)
      requireField(item, 'planned_end', `schedule.yaml assignments[${index}]`)
      return {
        task_id: String(item['task_id']),
        planned_start: toYMD(item['planned_start']) ?? '',
        planned_end: toYMD(item['planned_end']) ?? '',
      }
    })
  }

  return {
    meta: {
      schedule_start: toYMD(metaRaw['schedule_start']) ?? '',
      schedule_end: toYMD(metaRaw['schedule_end']) ?? '',
    },
    ...(assignments !== undefined ? { assignments } : {}),
  }
}

// ─── importWbsYaml ────────────────────────────────────────────────────────────

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

export interface WbsImportInput {
  db: DrizzleDb
  projectId: number
  tasksYaml: string
  staffingYaml: string
  scheduleYaml: string
}

export interface ImportSummary {
  projects: number
  tasks: number
  members: number
  holidays: number
  dependencies: number
  snapshots: number
}

/**
 * PV days 計算: インポート日と planned_start/end の関係から算出
 *
 * - インポート日 < planned_start → 0
 * - インポート日 > planned_end   → estimate_days
 * - 期間内                        → min(経過割合 × estimate_days × availability_rate, estimate_days)
 */
function calcPvDays(
  importDate: string,
  plannedStart: string | null,
  plannedEnd: string | null,
  estimateDays: number,
  availabilityRate: number,
): number {
  if (!plannedStart || !plannedEnd) return 0
  if (importDate <= plannedStart) return 0
  if (importDate >= plannedEnd) return estimateDays

  // 期間内: カレンダー日数比率による近似
  const startMs = new Date(plannedStart).getTime()
  const endMs = new Date(plannedEnd).getTime()
  const importMs = new Date(importDate).getTime()

  const totalDays = (endMs - startMs) / 86400000
  if (totalDays <= 0) return 0

  const elapsedDays = (importMs - startMs) / 86400000
  const ratio = elapsedDays / totalDays

  return Math.min(ratio * estimateDays * availabilityRate, estimateDays)
}

/**
 * WBS YAML 3 ファイルをアトミックに DB にインポートする。
 *
 * 要件 6.1–6.9 を実装する。
 * - better-sqlite3 の同期トランザクションを使用してアトミック性を保証 (Req 6.7)
 * - external_id をキーとして upsert し、再インポート時の重複を防止 (Req 6.8)
 * - parent_id / assignee_id の external_id → DB id 解決 (Req 6.2, 6.4)
 * - task_dependencies の挿入 (Req 6.3)
 * - 初回 ProgressSnapshot の作成 (Req 6.5)
 * - public_holidays の upsert (Req 6.6)
 */
export function importWbsYaml(input: WbsImportInput): ImportSummary {
  const { db: dbInstance, projectId, tasksYaml, staffingYaml, scheduleYaml } = input

  // 事前条件: projectId が DB に存在すること (design.md WbsImporter 事前条件)
  const projectExists = dbInstance
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()
  if (!projectExists) {
    throw new AppError(ErrorCode.PROJ_NOT_FOUND, `プロジェクト id=${projectId} が見つかりません。`)
  }

  // YAML パース（エラーはトランザクション外で throw — パースエラーは部分書き込みなし）
  const parsedTasks = parseTasksYaml(tasksYaml)
  const parsedStaffing = parseStaffingYaml(staffingYaml)
  const parsedSchedule = parseScheduleYaml(scheduleYaml)

  // インポート日時（snapshot_date に使用）
  const importDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // better-sqlite3 の生インスタンスを取得してトランザクションを実行
  // drizzle-orm/better-sqlite3 は $client プロパティで raw sqlite にアクセス可能
  const rawSqlite = (dbInstance as unknown as { $client: import('better-sqlite3').Database }).$client

  const summary: ImportSummary = {
    projects: 0,
    tasks: 0,
    members: 0,
    holidays: 0,
    dependencies: 0,
    snapshots: 0,
  }

  const importFn = rawSqlite.transaction(() => {
    // ── 1. members upsert (external_id キー) ─────────────────────────────
    // external_id が一致する既存レコードを更新、なければ挿入
    const memberIdMap = new Map<string, number>() // externalId → DB id

    for (const m of parsedStaffing.members) {
      const existing = dbInstance
        .select()
        .from(members)
        .where(and(eq(members.projectId, projectId), eq(members.externalId, m.id)))
        .get()

      if (existing) {
        dbInstance
          .update(members)
          .set({
            name: m.name,
            availabilityRate: m.availability_rate,
            assignmentStart: m.assignment_start ?? null,
            assignmentEnd: m.assignment_end ?? null,
            updatedAt: new Date(),
          })
          .where(eq(members.id, existing.id))
          .run()
        memberIdMap.set(m.id, existing.id)
      } else {
        const inserted = dbInstance
          .insert(members)
          .values({
            projectId,
            externalId: m.id,
            name: m.name,
            availabilityRate: m.availability_rate,
            assignmentStart: m.assignment_start ?? null,
            assignmentEnd: m.assignment_end ?? null,
          })
          .returning()
          .get()
        if (inserted) {
          memberIdMap.set(m.id, inserted.id)
          summary.members++
        }
      }
    }

    // ── 2. tasks upsert（第1パス: 基本フィールドのみ、parent_id は後で解決）─
    const taskIdMap = new Map<string, number>() // externalId → DB id
    // planned 日付を追跡（assignments で上書きされる可能性がある）
    const resolvedPlannedDates = new Map<string, { start: string | null; end: string | null }>()

    for (let i = 0; i < parsedTasks.tasks.length; i++) {
      const t = parsedTasks.tasks[i]!
      const assigneeDbId = t.assignee ? (memberIdMap.get(t.assignee) ?? null) : null

      const existing = dbInstance
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.externalId, t.id)))
        .get()

      if (existing) {
        dbInstance
          .update(tasks)
          .set({
            name: t.title,
            estimateDays: t.estimate_days,
            plannedStart: t.planned_start,
            plannedEnd: t.planned_end,
            actualStart: t.actual_start ?? null,
            actualEnd: t.actual_end ?? null,
            assigneeId: assigneeDbId,
            sortOrder: i,
            isBuffer: t.is_buffer ?? false,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, existing.id))
          .run()
        taskIdMap.set(t.id, existing.id)
        resolvedPlannedDates.set(t.id, { start: t.planned_start, end: t.planned_end })
      } else {
        const inserted = dbInstance
          .insert(tasks)
          .values({
            projectId,
            externalId: t.id,
            name: t.title,
            estimateDays: t.estimate_days,
            plannedStart: t.planned_start,
            plannedEnd: t.planned_end,
            actualStart: t.actual_start ?? null,
            actualEnd: t.actual_end ?? null,
            assigneeId: assigneeDbId,
            sortOrder: i,
            isBuffer: t.is_buffer ?? false,
            isLeaf: true,
          })
          .returning()
          .get()
        if (inserted) {
          taskIdMap.set(t.id, inserted.id)
          resolvedPlannedDates.set(t.id, { start: t.planned_start, end: t.planned_end })
          summary.tasks++
        }
      }
    }

    // ── 3. tasks: parent_id 解決（第2パス）───────────────────────────────
    for (const t of parsedTasks.tasks) {
      if (t.parent_id) {
        const dbId = taskIdMap.get(t.id)
        const parentDbId = taskIdMap.get(t.parent_id)
        if (dbId && parentDbId) {
          dbInstance
            .update(tasks)
            .set({ parentId: parentDbId })
            .where(eq(tasks.id, dbId))
            .run()
        }
      }
    }

    // ── 3.5. schedule assignments → tasks planned_start/end 上書き（第3パス）─
    // schedule.yaml の assignments[] を使ってタスクの planned 日付を更新する (Req 6.12)
    if (parsedSchedule.assignments) {
      for (const assignment of parsedSchedule.assignments) {
        const taskDbId = taskIdMap.get(assignment.task_id)
        if (!taskDbId) continue // 対応タスクが存在しない場合は無視 (Req 6.12)

        dbInstance
          .update(tasks)
          .set({
            plannedStart: assignment.planned_start,
            plannedEnd: assignment.planned_end,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskDbId))
          .run()

        resolvedPlannedDates.set(assignment.task_id, {
          start: assignment.planned_start,
          end: assignment.planned_end,
        })
      }
    }

    // ── 4. task_dependencies の挿入（再インポート時は既存を削除して再挿入）─
    for (const t of parsedTasks.tasks) {
      if (!t.depends_on || t.depends_on.length === 0) continue

      const taskDbId = taskIdMap.get(t.id)
      if (!taskDbId) continue

      // 既存の依存関係を削除（upsert 相当）
      dbInstance
        .delete(taskDependencies)
        .where(eq(taskDependencies.taskId, taskDbId))
        .run()

      for (const depExternalId of t.depends_on) {
        const depDbId = taskIdMap.get(depExternalId)
        if (!depDbId) continue

        dbInstance
          .insert(taskDependencies)
          .values({ taskId: taskDbId, dependsOnTaskId: depDbId })
          .run()
        summary.dependencies++
      }
    }

    // ── 5. holidays upsert ────────────────────────────────────────────────
    const publicHolidays = parsedStaffing.meta?.public_holidays ?? []
    for (const dateStr of publicHolidays) {
      const existing = dbInstance
        .select()
        .from(holidays)
        .where(and(eq(holidays.projectId, projectId), eq(holidays.date, dateStr)))
        .get()

      if (!existing) {
        dbInstance
          .insert(holidays)
          .values({ projectId, date: dateStr })
          .run()
        summary.holidays++
      }
    }

    // ── 6. ProgressSnapshot 作成（progress_pct 指定のタスクのみ）────────────
    for (const t of parsedTasks.tasks) {
      if (t.progress_pct === undefined) continue

      const taskDbId = taskIdMap.get(t.id)
      if (!taskDbId) continue

      // ev_days = estimate_days × (progress_pct / 100)
      const evDays = t.estimate_days * (t.progress_pct / 100)

      // assignee の availability_rate を取得（未指定時は 1.0）
      let availabilityRate = 1.0
      if (t.assignee) {
        const memberId = memberIdMap.get(t.assignee)
        if (memberId) {
          const memberRow = dbInstance
            .select()
            .from(members)
            .where(eq(members.id, memberId))
            .get()
          if (memberRow) availabilityRate = memberRow.availabilityRate
        }
      }

      // assignments で上書きされた可能性があるため resolvedPlannedDates を使用 (Req 6.12, 6.13)
      const resolved = resolvedPlannedDates.get(t.id)
      const plannedStart = resolved?.start ?? null
      const plannedEnd = resolved?.end ?? null
      const pvDays = (plannedStart && plannedEnd)
        ? calcPvDays(importDate, plannedStart, plannedEnd, t.estimate_days, availabilityRate)
        : 0

      // 同一 task_id + snapshot_date の既存スナップショットを確認（unique index）
      const existingSnap = dbInstance
        .select()
        .from(progressSnapshots)
        .where(
          and(
            eq(progressSnapshots.taskId, taskDbId),
            eq(progressSnapshots.snapshotDate, importDate),
          ),
        )
        .get()

      if (!existingSnap) {
        dbInstance
          .insert(progressSnapshots)
          .values({
            taskId: taskDbId,
            snapshotDate: importDate,
            progressPct: t.progress_pct,
            evDays,
            pvDays,
            acDays: 0,
          })
          .run()
        summary.snapshots++
      }
    }

    return summary
  })

  return importFn()
}
