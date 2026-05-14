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
  members,
  tasks,
  holidays,
  taskDependencies,
  progressSnapshots,
} from '../db/schema.js'
import * as schema from '../db/schema.js'

// ─── Parsed YAML interfaces ──────────────────────────────────────────────────

export interface ParsedTask {
  id: string
  title: string
  estimate_days: number
  planned_start: string
  planned_end: string
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

export interface ParsedScheduleYaml {
  meta: {
    schedule_start: string
    schedule_end: string
  }
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
    requireField(item, 'estimate_days', ctx)
    requireField(item, 'planned_start', ctx)
    requireField(item, 'planned_end', ctx)

    return {
      id: String(item['id']),
      title: String(item['title']),
      estimate_days: Number(item['estimate_days']),
      planned_start: String(item['planned_start']),
      planned_end: String(item['planned_end']),
      ...(item['parent_id'] !== undefined ? { parent_id: item['parent_id'] as string | null } : {}),
      ...(item['depends_on'] !== undefined ? { depends_on: item['depends_on'] as string[] } : {}),
      ...(item['assignee'] !== undefined ? { assignee: item['assignee'] as string | null } : {}),
      ...(item['actual_start'] !== undefined ? { actual_start: item['actual_start'] as string | null } : {}),
      ...(item['actual_end'] !== undefined ? { actual_end: item['actual_end'] as string | null } : {}),
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

  return {
    meta: {
      schedule_start: String(metaRaw['schedule_start']),
      schedule_end: String(metaRaw['schedule_end']),
    },
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
  plannedStart: string,
  plannedEnd: string,
  estimateDays: number,
  availabilityRate: number,
): number {
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

  // YAML パース（エラーはトランザクション外で throw — パースエラーは部分書き込みなし）
  const parsedTasks = parseTasksYaml(tasksYaml)
  const parsedStaffing = parseStaffingYaml(staffingYaml)
  parseScheduleYaml(scheduleYaml) // 構造バリデーションのみ

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

      const pvDays = calcPvDays(
        importDate,
        t.planned_start,
        t.planned_end,
        t.estimate_days,
        availabilityRate,
      )

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
