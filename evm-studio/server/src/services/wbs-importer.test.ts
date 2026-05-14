import { describe, it, expect } from 'vitest'
import { parseTasksYaml, parseStaffingYaml, parseScheduleYaml } from './wbs-importer.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'

// ─── parseTasksYaml ──────────────────────────────────────────────────────────

describe('parseTasksYaml', () => {
  const validTasksYaml = `
tasks:
  - id: "T001"
    title: "タスク名"
    estimate_days: 5
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
    parent_id: null
    depends_on: []
    assignee: "M001"
    actual_start: null
    actual_end: null
    progress_pct: 0
    is_buffer: false
`

  it('正常な YAML が渡されたとき、tasks 配列を含む構造化オブジェクトを返す', () => {
    const result = parseTasksYaml(validTasksYaml)
    expect(result.tasks).toHaveLength(1)
    const task = result.tasks[0]
    expect(task).toBeDefined()
    if (!task) throw new Error('task is undefined')
    expect(task.id).toBe('T001')
    expect(task.title).toBe('タスク名')
    expect(task.estimate_days).toBe(5)
    expect(task.planned_start).toBe('2026-01-05')
    expect(task.planned_end).toBe('2026-01-09')
    expect(task.assignee).toBe('M001')
    expect(task.is_buffer).toBe(false)
    expect(task.progress_pct).toBe(0)
  })

  it('オプションフィールドが省略されていても正常にパースされる', () => {
    const minimalYaml = `
tasks:
  - id: "T002"
    title: "最小タスク"
    estimate_days: 3
    planned_start: "2026-02-01"
    planned_end: "2026-02-03"
`
    const result = parseTasksYaml(minimalYaml)
    expect(result.tasks).toHaveLength(1)
    const task = result.tasks[0]
    expect(task).toBeDefined()
    if (!task) throw new Error('task is undefined')
    expect(task.id).toBe('T002')
  })

  it('tasks フィールドが欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
meta:
  something: value
`
    expect(() => parseTasksYaml(yaml)).toThrow(AppError)
    expect(() => parseTasksYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('tasks が配列でない場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
tasks: "not-an-array"
`
    expect(() => parseTasksYaml(yaml)).toThrow(AppError)
    expect(() => parseTasksYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('タスクに id が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
tasks:
  - title: "IDなしタスク"
    estimate_days: 5
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
`
    expect(() => parseTasksYaml(yaml)).toThrow(AppError)
    expect(() => parseTasksYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('タスクに title が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
tasks:
  - id: "T001"
    estimate_days: 5
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
`
    expect(() => parseTasksYaml(yaml)).toThrow(AppError)
    expect(() => parseTasksYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('タスクに estimate_days が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
tasks:
  - id: "T001"
    title: "タスク"
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
`
    expect(() => parseTasksYaml(yaml)).toThrow(AppError)
    expect(() => parseTasksYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('タスクに planned_start が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
tasks:
  - id: "T001"
    title: "タスク"
    estimate_days: 5
    planned_end: "2026-01-09"
`
    expect(() => parseTasksYaml(yaml)).toThrow(AppError)
    expect(() => parseTasksYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('タスクに planned_end が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
tasks:
  - id: "T001"
    title: "タスク"
    estimate_days: 5
    planned_start: "2026-01-05"
`
    expect(() => parseTasksYaml(yaml)).toThrow(AppError)
    expect(() => parseTasksYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('YAML 構文エラーの場合は AppError(IMPORT_PARSE_ERROR) を throw する', () => {
    const invalidYaml = `
tasks:
  - id: "T001"
    title: [broken yaml
`
    expect(() => parseTasksYaml(invalidYaml)).toThrow(AppError)
    expect(() => parseTasksYaml(invalidYaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_PARSE_ERROR })
    )
  })

  it('空文字列の場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    expect(() => parseTasksYaml('')).toThrow(AppError)
  })
})

// ─── parseStaffingYaml ───────────────────────────────────────────────────────

describe('parseStaffingYaml', () => {
  const validStaffingYaml = `
members:
  - id: "M001"
    name: "田中太郎"
    availability_rate: 0.8
    assignment_start: "2026-01-01"
    assignment_end: "2026-03-31"
meta:
  public_holidays:
    - "2026-01-01"
    - "2026-01-02"
`

  it('正常な YAML が渡されたとき、members 配列と meta を含む構造化オブジェクトを返す', () => {
    const result = parseStaffingYaml(validStaffingYaml)
    expect(result.members).toHaveLength(1)
    const member = result.members[0]
    expect(member).toBeDefined()
    if (!member) throw new Error('member is undefined')
    expect(member.id).toBe('M001')
    expect(member.name).toBe('田中太郎')
    expect(member.availability_rate).toBe(0.8)
    expect(member.assignment_start).toBe('2026-01-01')
    expect(member.assignment_end).toBe('2026-03-31')
    expect(result.meta?.public_holidays).toEqual(['2026-01-01', '2026-01-02'])
  })

  it('meta が省略されていても正常にパースされる', () => {
    const yaml = `
members:
  - id: "M001"
    name: "田中太郎"
    availability_rate: 0.8
`
    const result = parseStaffingYaml(yaml)
    expect(result.members).toHaveLength(1)
    expect(result.meta).toBeUndefined()
  })

  it('members フィールドが欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
meta:
  public_holidays: []
`
    expect(() => parseStaffingYaml(yaml)).toThrow(AppError)
    expect(() => parseStaffingYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('メンバーに id が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
members:
  - name: "田中太郎"
    availability_rate: 0.8
`
    expect(() => parseStaffingYaml(yaml)).toThrow(AppError)
    expect(() => parseStaffingYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('メンバーに name が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
members:
  - id: "M001"
    availability_rate: 0.8
`
    expect(() => parseStaffingYaml(yaml)).toThrow(AppError)
    expect(() => parseStaffingYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('メンバーに availability_rate が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
members:
  - id: "M001"
    name: "田中太郎"
`
    expect(() => parseStaffingYaml(yaml)).toThrow(AppError)
    expect(() => parseStaffingYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('YAML 構文エラーの場合は AppError(IMPORT_PARSE_ERROR) を throw する', () => {
    const invalidYaml = `
members:
  - id: [broken
`
    expect(() => parseStaffingYaml(invalidYaml)).toThrow(AppError)
    expect(() => parseStaffingYaml(invalidYaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_PARSE_ERROR })
    )
  })
})

// ─── parseScheduleYaml ───────────────────────────────────────────────────────

describe('parseScheduleYaml', () => {
  const validScheduleYaml = `
meta:
  schedule_start: "2026-01-05"
  schedule_end: "2026-03-31"
`

  it('正常な YAML が渡されたとき、meta.schedule_start と meta.schedule_end を持つオブジェクトを返す', () => {
    const result = parseScheduleYaml(validScheduleYaml)
    expect(result.meta.schedule_start).toBe('2026-01-05')
    expect(result.meta.schedule_end).toBe('2026-03-31')
  })

  it('meta フィールドが欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
schedule_start: "2026-01-05"
`
    expect(() => parseScheduleYaml(yaml)).toThrow(AppError)
    expect(() => parseScheduleYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('meta.schedule_start が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
meta:
  schedule_end: "2026-03-31"
`
    expect(() => parseScheduleYaml(yaml)).toThrow(AppError)
    expect(() => parseScheduleYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('meta.schedule_end が欠落している場合は AppError(IMPORT_MISSING_FIELD) を throw する', () => {
    const yaml = `
meta:
  schedule_start: "2026-01-05"
`
    expect(() => parseScheduleYaml(yaml)).toThrow(AppError)
    expect(() => parseScheduleYaml(yaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_MISSING_FIELD })
    )
  })

  it('YAML 構文エラーの場合は AppError(IMPORT_PARSE_ERROR) を throw する', () => {
    const invalidYaml = `
meta:
  schedule_start: [broken
`
    expect(() => parseScheduleYaml(invalidYaml)).toThrow(AppError)
    expect(() => parseScheduleYaml(invalidYaml)).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_PARSE_ERROR })
    )
  })
})
