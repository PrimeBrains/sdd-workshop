import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq, and } from 'drizzle-orm'
import { parseTasksYaml, parseStaffingYaml, parseScheduleYaml, importWbsYaml } from './wbs-importer.js'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import * as schema from '../db/schema.js'

// ─── Test DB setup ─────────────────────────────────────────────────────────────

type TestDb = ReturnType<typeof drizzle<typeof schema>>

function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './src/db/migrations' })
  return db
}

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

  it('estimate_days が欠落/null の場合は 0 として取り込む（親タスク等の summary 行に対応）', () => {
    const yaml = `
tasks:
  - id: "T001"
    title: "親タスク"
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
`
    const result = parseTasksYaml(yaml)
    expect(result.tasks[0]!.estimate_days).toBe(0)
  })

  it('planned_start が欠落/null の場合は null として取り込む（schedule 分離型 YAML に対応）', () => {
    const yaml = `
tasks:
  - id: "T001"
    title: "タスク"
    estimate_days: 5
    planned_end: "2026-01-09"
`
    const result = parseTasksYaml(yaml)
    expect(result.tasks[0]!.planned_start).toBeNull()
  })

  it('planned_end が欠落/null の場合は null として取り込む（schedule 分離型 YAML に対応）', () => {
    const yaml = `
tasks:
  - id: "T001"
    title: "タスク"
    estimate_days: 5
    planned_start: "2026-01-05"
`
    const result = parseTasksYaml(yaml)
    expect(result.tasks[0]!.planned_end).toBeNull()
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

  const scheduleYamlWithAssignments = `
meta:
  schedule_start: "2026-01-05"
  schedule_end: "2026-03-31"
assignments:
  - task_id: "T001"
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
  - task_id: "T002"
    assignee_id: "M001"
    planned_start: "2026-01-12"
    planned_end: "2026-01-16"
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

  // ── Req 6.12: assignments[] のパース ─────────────────────────────────────
  it('assignments[] を含む YAML をパースし assignments 配列を返す (Req 6.12)', () => {
    const result = parseScheduleYaml(scheduleYamlWithAssignments)
    expect(result.assignments).toBeDefined()
    expect(result.assignments).toHaveLength(2)

    const first = result.assignments![0]!
    expect(first.task_id).toBe('T001')
    expect(first.planned_start).toBe('2026-01-05')
    expect(first.planned_end).toBe('2026-01-09')

    const second = result.assignments![1]!
    expect(second.task_id).toBe('T002')
    expect(second.planned_start).toBe('2026-01-12')
    expect(second.planned_end).toBe('2026-01-16')
  })

  it('assignments[] がない YAML でも正常にパースされ assignments は undefined (Req 6.12 後方互換)', () => {
    const result = parseScheduleYaml(validScheduleYaml)
    expect(result.assignments).toBeUndefined()
  })
})

// ─── importWbsYaml ────────────────────────────────────────────────────────────

// ── テスト用 YAML フィクスチャ ─────────────────────────────────────────────────

const TASKS_YAML_BASIC = `
tasks:
  - id: "T001"
    title: "親タスク"
    estimate_days: 10
    planned_start: "2026-01-05"
    planned_end: "2026-01-16"
    is_buffer: false
  - id: "T002"
    title: "子タスク"
    estimate_days: 5
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
    parent_id: "T001"
    assignee: "M001"
    depends_on:
      - "T001"
    progress_pct: 50
`

const STAFFING_YAML_BASIC = `
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

const SCHEDULE_YAML_BASIC = `
meta:
  schedule_start: "2026-01-05"
  schedule_end: "2026-03-31"
`

describe('importWbsYaml (Req 6.1–6.9)', () => {
  let db: TestDb
  let projectId: number

  beforeEach(async () => {
    db = createTestDb()
    // プロジェクトを事前に作成
    const [project] = await db
      .insert(schema.projects)
      .values({ name: 'テストプロジェクト', startDate: '2026-01-05', endDate: '2026-03-31' })
      .returning()
    if (!project) throw new Error('project creation failed')
    projectId = project.id
  })

  // ── Req 6.1: 正常インポート → ImportSummary のカウントが正しい ─────────────
  it('正常インポートが完了し ImportSummary のカウントを返す (Req 6.1, 6.9)', () => {
    const summary = importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    expect(summary.projects).toBe(0)
    expect(summary.tasks).toBe(2)
    expect(summary.members).toBe(1)
    expect(summary.holidays).toBe(2)
    expect(summary.dependencies).toBe(1)
    expect(summary.snapshots).toBe(1) // T002 のみ progress_pct あり
  })

  // ── Req 6.2: parent_id の external_id → DB id 解決 ────────────────────────
  it('tasks.parent_id の external_id が DB の internal id に解決される (Req 6.2)', async () => {
    importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const [parent] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T001'))
    const [child] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T002'))

    expect(parent).toBeDefined()
    expect(child).toBeDefined()
    if (!parent || !child) throw new Error('tasks not found')

    expect(child.parentId).toBe(parent.id)
  })

  // ── Req 6.3: depends_on → task_dependencies に挿入 ────────────────────────
  it('tasks.depends_on が task_dependencies テーブルに挿入される (Req 6.3)', async () => {
    importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const [t001] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T001'))
    const [t002] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T002'))

    expect(t001).toBeDefined()
    expect(t002).toBeDefined()
    if (!t001 || !t002) throw new Error('tasks not found')

    const deps = await db
      .select()
      .from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.taskId, t002.id))

    expect(deps).toHaveLength(1)
    expect(deps[0]?.dependsOnTaskId).toBe(t001.id)
  })

  // ── Req 6.4: assignee の external_id → DB id 解決 ────────────────────────
  it('tasks.assignee の external_id が Task.assignee_id に解決される (Req 6.4)', async () => {
    importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const [member] = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.externalId, 'M001'))
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T002'))

    expect(member).toBeDefined()
    expect(task).toBeDefined()
    if (!member || !task) throw new Error('member or task not found')

    expect(task.assigneeId).toBe(member.id)
  })

  // ── Req 6.5: progress_pct → ProgressSnapshot 作成 ─────────────────────────
  it('tasks.progress_pct が指定されたタスクに ProgressSnapshot が作成される (Req 6.5)', async () => {
    importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T002'))

    expect(task).toBeDefined()
    if (!task) throw new Error('task not found')

    const snapshots = await db
      .select()
      .from(schema.progressSnapshots)
      .where(eq(schema.progressSnapshots.taskId, task.id))

    expect(snapshots).toHaveLength(1)
    const snap = snapshots[0]
    expect(snap).toBeDefined()
    if (!snap) throw new Error('snapshot not found')

    expect(snap.progressPct).toBe(50)
    // ev_days = estimate_days × (progress_pct / 100) = 5 × 0.5 = 2.5
    expect(snap.evDays).toBeCloseTo(2.5, 5)
    // pv_days は 0 以上 estimate_days 以下
    expect(snap.pvDays).toBeGreaterThanOrEqual(0)
    expect(snap.pvDays).toBeLessThanOrEqual(5)
  })

  // ── Req 6.6: staffing.meta.public_holidays → holidays upsert ─────────────
  it('staffing.meta.public_holidays が holidays テーブルに upsert される (Req 6.6)', async () => {
    importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const holidayRows = await db
      .select()
      .from(schema.holidays)
      .where(eq(schema.holidays.projectId, projectId))

    expect(holidayRows).toHaveLength(2)
    const dates = holidayRows.map((h) => h.date).sort()
    expect(dates).toEqual(['2026-01-01', '2026-01-02'])
  })

  // ── Req 6.7: 不正 YAML → アトミックロールバック ────────────────────────────
  it('不正 YAML の場合は AppError を throw し、部分書き込みが発生しない (Req 6.7)', async () => {
    const invalidTasksYaml = `
tasks:
  - id: "T001"
    title: "タスク1"
    estimate_days: 5
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
  - title: "IDなしタスク"
    estimate_days: 3
    planned_start: "2026-01-10"
    planned_end: "2026-01-12"
`
    expect(() =>
      importWbsYaml({
        db,
        projectId,
        tasksYaml: invalidTasksYaml,
        staffingYaml: STAFFING_YAML_BASIC,
        scheduleYaml: SCHEDULE_YAML_BASIC,
      })
    ).toThrow(AppError)

    // アトミック性の確認: タスクが 1 件も存在しないこと
    const taskRows = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, projectId))
    expect(taskRows).toHaveLength(0)
  })

  // ── Req 6.11: estimate_days null → DB に 0 で保存 ─────────────────────────
  it('estimate_days が null のタスクは estimateDays=0 で DB に保存される (Req 6.11)', async () => {
    const tasksWithNullEstimate = `
tasks:
  - id: "T001"
    title: "サマリータスク"
`
    importWbsYaml({
      db,
      projectId,
      tasksYaml: tasksWithNullEstimate,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T001'))
    expect(task).toBeDefined()
    expect(task!.estimateDays).toBe(0)
  })

  // ── Req 6.11: planned_start/end null → DB に null で保存 ──────────────────
  it('planned_start/planned_end が null のタスクは DB に null で保存される (Req 6.11)', async () => {
    const tasksWithNullDates = `
tasks:
  - id: "T001"
    title: "スケジュール未設定タスク"
    estimate_days: 5
`
    importWbsYaml({
      db,
      projectId,
      tasksYaml: tasksWithNullDates,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T001'))
    expect(task).toBeDefined()
    expect(task!.plannedStart).toBeNull()
    expect(task!.plannedEnd).toBeNull()
  })

  // ── Req 6.12: schedule assignments → タスクの planned_start/end が更新される ─
  it('schedule.assignments が設定されたタスクの planned_start/end が DB に反映される (Req 6.12)', async () => {
    const tasksWithNullDates = `
tasks:
  - id: "T001"
    title: "スケジュール未設定タスク"
    estimate_days: 5
`
    const scheduleWithAssignments = `
meta:
  schedule_start: "2026-01-05"
  schedule_end: "2026-03-31"
assignments:
  - task_id: "T001"
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
`
    importWbsYaml({
      db,
      projectId,
      tasksYaml: tasksWithNullDates,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: scheduleWithAssignments,
    })

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T001'))
    expect(task).toBeDefined()
    expect(task!.plannedStart).toBe('2026-01-05')
    expect(task!.plannedEnd).toBe('2026-01-09')
  })

  // ── Req 6.12: assignments に存在しない task_id は無視される ─────────────────
  it('assignments の task_id がインポートされたタスクに存在しない場合は無視される (Req 6.12)', async () => {
    const scheduleWithUnknownTask = `
meta:
  schedule_start: "2026-01-05"
  schedule_end: "2026-03-31"
assignments:
  - task_id: "T999"
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
`
    expect(() =>
      importWbsYaml({
        db,
        projectId,
        tasksYaml: TASKS_YAML_BASIC,
        staffingYaml: STAFFING_YAML_BASIC,
        scheduleYaml: scheduleWithUnknownTask,
      })
    ).not.toThrow()
  })

  // ── Req 6.13: planned 日付 null のタスクのスナップショットは pvDays=0 ─────────
  it('planned_start/end が null のタスクの ProgressSnapshot は pvDays=0 になる (Req 6.13)', async () => {
    const tasksWithProgress = `
tasks:
  - id: "T001"
    title: "進捗ありスケジュール未設定タスク"
    estimate_days: 10
    progress_pct: 50
`
    importWbsYaml({
      db,
      projectId,
      tasksYaml: tasksWithProgress,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T001'))
    expect(task).toBeDefined()

    const snaps = await db
      .select()
      .from(schema.progressSnapshots)
      .where(eq(schema.progressSnapshots.taskId, task!.id))
    expect(snaps).toHaveLength(1)
    expect(snaps[0]!.pvDays).toBe(0)
    // ev_days = 10 * 0.5 = 5
    expect(snaps[0]!.evDays).toBeCloseTo(5, 5)
  })

  // ── Req 6.12 + 6.13: assignments で planned 日付設定後のスナップショット pvDays ─
  it('assignments で planned 日付が設定されたタスクのスナップショットで pvDays が計算される', async () => {
    const tasksWithProgress = `
tasks:
  - id: "T001"
    title: "進捗ありタスク"
    estimate_days: 10
    progress_pct: 50
`
    const scheduleInFuture = `
meta:
  schedule_start: "2030-01-05"
  schedule_end: "2030-03-31"
assignments:
  - task_id: "T001"
    planned_start: "2030-01-05"
    planned_end: "2030-01-16"
`
    importWbsYaml({
      db,
      projectId,
      tasksYaml: tasksWithProgress,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: scheduleInFuture,
    })

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.externalId, 'T001'))
    expect(task).toBeDefined()
    // planned 日付が assignments で設定されていること
    expect(task!.plannedStart).toBe('2030-01-05')
    expect(task!.plannedEnd).toBe('2030-01-16')

    const snaps = await db
      .select()
      .from(schema.progressSnapshots)
      .where(eq(schema.progressSnapshots.taskId, task!.id))
    expect(snaps).toHaveLength(1)
    // インポート日が planned_start (2030-01-05) より前なので pvDays = 0
    expect(snaps[0]!.pvDays).toBe(0)
  })

  // ── Req 6.8: 再インポート → upsert で重複なし ─────────────────────────────
  it('同一 project_id に再インポートしても重複が生じない (Req 6.8)', async () => {
    // 1回目のインポート
    importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    // 2回目のインポート（同じデータ）
    importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    const taskRows = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, projectId))
    expect(taskRows).toHaveLength(2) // 重複なし

    const memberRows = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.projectId, projectId))
    expect(memberRows).toHaveLength(1) // 重複なし

    const holidayRows = await db
      .select()
      .from(schema.holidays)
      .where(eq(schema.holidays.projectId, projectId))
    expect(holidayRows).toHaveLength(2) // 重複なし
  })
})

// ─── importWbsYaml: 新フィールド (status / code / role / initials) (Req 4.1–4.7, 8.3) ──

describe('importWbsYaml: 新フィールド対応 (Req 4.1–4.7, 8.3)', () => {
  let db: TestDb
  let projectId: number

  beforeEach(async () => {
    db = createTestDb()
    const [project] = await db
      .insert(schema.projects)
      .values({ name: 'テストプロジェクト', startDate: '2026-01-05', endDate: '2026-03-31' })
      .returning()
    if (!project) throw new Error('project creation failed')
    projectId = project.id
  })

  // ── Req 4.1, 4.2, 4.3, 4.4: 新フィールドあり YAML → DB に反映 ─────────────
  it('新フィールド付き YAML をインポートすると projects.status / code, members.role / initials が DB に反映される (Req 4.1–4.4)', async () => {
    const scheduleYamlWithNewFields = `
meta:
  schedule_start: "2026-01-05"
  schedule_end: "2026-03-31"
  project_status: "paused"
  project_code: "NXP-002"
`
    const staffingYamlWithNewFields = `
members:
  - id: "M001"
    name: "田中 美咲"
    availability_rate: 0.8
    assignment_start: "2026-01-01"
    assignment_end: "2026-03-31"
    role: "PM"
    initials: "田美"
meta:
  public_holidays:
    - "2026-01-01"
`
    importWbsYaml({
      db,
      projectId,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: staffingYamlWithNewFields,
      scheduleYaml: scheduleYamlWithNewFields,
    })

    // projects.status / projects.code
    const [proj] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
    expect(proj).toBeDefined()
    if (!proj) throw new Error('project not found')
    expect(proj.status).toBe('paused')
    expect(proj.code).toBe('NXP-002')

    // members.role / members.initials
    const [member] = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.externalId, 'M001'))
    expect(member).toBeDefined()
    if (!member) throw new Error('member not found')
    expect(member.role).toBe('PM')
    expect(member.initials).toBe('田美')
  })

  // ── Req 4.5, 4.7: 新フィールドなし YAML → 後方互換（既定値・自動生成） ────
  it('新フィールドを持たない YAML をインポートしても後方互換で既定値が適用される (Req 4.5, 4.7)', async () => {
    // 新規プロジェクトを作成し直して projects.status のデフォルト ('active') を確認する
    const [freshProject] = await db
      .insert(schema.projects)
      .values({ name: '後方互換プロジェクト', startDate: '2026-01-05', endDate: '2026-03-31' })
      .returning()
    if (!freshProject) throw new Error('project creation failed')

    // TASKS_YAML_BASIC / STAFFING_YAML_BASIC / SCHEDULE_YAML_BASIC は
    // project_status / project_code / role / initials を一切含まない既存形式
    importWbsYaml({
      db,
      projectId: freshProject.id,
      tasksYaml: TASKS_YAML_BASIC,
      staffingYaml: STAFFING_YAML_BASIC,
      scheduleYaml: SCHEDULE_YAML_BASIC,
    })

    // projects.status は DB の既定値 'active' のまま、code は NULL のまま
    const [proj] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, freshProject.id))
    expect(proj).toBeDefined()
    if (!proj) throw new Error('project not found')
    expect(proj.status).toBe('active')
    expect(proj.code).toBeNull()

    // members.role は NULL、initials は generateInitials('田中太郎') により自動生成（'田太'）
    const [member] = await db
      .select()
      .from(schema.members)
      .where(
        and(
          eq(schema.members.projectId, freshProject.id),
          eq(schema.members.externalId, 'M001'),
        ),
      )
    expect(member).toBeDefined()
    if (!member) throw new Error('member not found')
    expect(member.role).toBeNull()
    // 'M001' = '田中太郎' は空白なしのため、先頭 2 文字 '田中' が initials になる
    expect(member.initials).toBe('田中')
  })

  // ── Req 4.6: 無効 project_status → AppError(IMPORT_INVALID_PROJECT_STATUS) ─
  it('schedule.meta.project_status が enum 範囲外なら AppError(IMPORT_INVALID_PROJECT_STATUS) を throw する (Req 4.6)', () => {
    const scheduleYamlInvalidStatus = `
meta:
  schedule_start: "2026-01-05"
  schedule_end: "2026-03-31"
  project_status: "unknown"
`
    expect(() =>
      importWbsYaml({
        db,
        projectId,
        tasksYaml: TASKS_YAML_BASIC,
        staffingYaml: STAFFING_YAML_BASIC,
        scheduleYaml: scheduleYamlInvalidStatus,
      })
    ).toThrow(AppError)

    expect(() =>
      importWbsYaml({
        db,
        projectId,
        tasksYaml: TASKS_YAML_BASIC,
        staffingYaml: STAFFING_YAML_BASIC,
        scheduleYaml: scheduleYamlInvalidStatus,
      })
    ).toThrow(
      expect.objectContaining({ code: ErrorCode.IMPORT_INVALID_PROJECT_STATUS })
    )
  })
})
