/**
 * WBS YAML パーサーと構造バリデーション
 *
 * 要件 6.7: 必須フィールド欠落 → AppError(IMPORT_MISSING_FIELD)
 * 要件 6.10: SAFE_LOAD パース失敗 → AppError(IMPORT_PARSE_ERROR)
 */
import yaml from 'js-yaml'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'

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
