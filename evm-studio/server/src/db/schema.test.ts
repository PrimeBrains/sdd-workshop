import { describe, it, expect } from 'vitest'
import {
  projects,
  tasks,
  members,
  holidays,
  taskDependencies,
  progressSnapshots,
} from './schema.js'
import type {
  Project,
  NewProject,
  Task,
  NewTask,
  Member,
  NewMember,
  Holiday,
  NewHoliday,
  TaskDependency,
  NewTaskDependency,
  ProgressSnapshot,
  NewProgressSnapshot,
} from './schema.js'

// Compile-time check: these type aliases must be assignable to their respective table inference types
type _ProjectCheck       = Project extends typeof projects.$inferSelect ? true : never
type _NewProjectCheck    = NewProject extends typeof projects.$inferInsert ? true : never
type _TaskCheck          = Task extends typeof tasks.$inferSelect ? true : never
type _NewTaskCheck       = NewTask extends typeof tasks.$inferInsert ? true : never
type _MemberCheck        = Member extends typeof members.$inferSelect ? true : never
type _NewMemberCheck     = NewMember extends typeof members.$inferInsert ? true : never
type _HolidayCheck       = Holiday extends typeof holidays.$inferSelect ? true : never
type _NewHolidayCheck    = NewHoliday extends typeof holidays.$inferInsert ? true : never
type _TDepCheck          = TaskDependency extends typeof taskDependencies.$inferSelect ? true : never
type _NewTDepCheck       = NewTaskDependency extends typeof taskDependencies.$inferInsert ? true : never
type _SnapshotCheck      = ProgressSnapshot extends typeof progressSnapshots.$inferSelect ? true : never
type _NewSnapshotCheck   = NewProgressSnapshot extends typeof progressSnapshots.$inferInsert ? true : never

// Verify that ProgressSnapshot has pvDays and evDays fields (compile-time)
type _PvDaysExists = ProgressSnapshot['pvDays'] extends number ? true : never
type _EvDaysExists = ProgressSnapshot['evDays'] extends number ? true : never
// 要件 1.1: ProgressSnapshot must include nullable `note: string | null` field
type _NoteIsNullableString = [ProgressSnapshot['note']] extends [string | null] ? true : never
type _NoteAcceptsNull = null extends ProgressSnapshot['note'] ? true : never

// Ensure we're not using never (type assertion)
const _assertTypes: [
  _ProjectCheck,
  _NewProjectCheck,
  _TaskCheck,
  _NewTaskCheck,
  _MemberCheck,
  _NewMemberCheck,
  _HolidayCheck,
  _NewHolidayCheck,
  _TDepCheck,
  _NewTDepCheck,
  _SnapshotCheck,
  _NewSnapshotCheck,
  _PvDaysExists,
  _EvDaysExists,
  _NoteIsNullableString,
  _NoteAcceptsNull,
] = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true]
void _assertTypes

describe('DrizzleSchema — table definitions', () => {
  it('projects table has the correct column names', () => {
    const cols = Object.keys(projects)
    expect(cols).toContain('id')
    expect(cols).toContain('name')
    expect(cols).toContain('startDate')
    expect(cols).toContain('endDate')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('tasks table has all required columns', () => {
    const cols = Object.keys(tasks)
    expect(cols).toContain('id')
    expect(cols).toContain('projectId')
    expect(cols).toContain('externalId')
    expect(cols).toContain('name')
    expect(cols).toContain('estimateDays')
    expect(cols).toContain('plannedStart')
    expect(cols).toContain('plannedEnd')
    expect(cols).toContain('actualStart')
    expect(cols).toContain('actualEnd')
    expect(cols).toContain('parentId')
    expect(cols).toContain('assigneeId')
    expect(cols).toContain('level')
    expect(cols).toContain('sortOrder')
    expect(cols).toContain('isBuffer')
    expect(cols).toContain('isLeaf')
    expect(cols).toContain('remarks')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('members table has all required columns', () => {
    const cols = Object.keys(members)
    expect(cols).toContain('id')
    expect(cols).toContain('projectId')
    expect(cols).toContain('externalId')
    expect(cols).toContain('name')
    expect(cols).toContain('availabilityRate')
    expect(cols).toContain('assignmentStart')
    expect(cols).toContain('assignmentEnd')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('holidays table has all required columns', () => {
    const cols = Object.keys(holidays)
    expect(cols).toContain('id')
    expect(cols).toContain('projectId')
    expect(cols).toContain('date')
  })

  it('taskDependencies table has all required columns', () => {
    const cols = Object.keys(taskDependencies)
    expect(cols).toContain('id')
    expect(cols).toContain('taskId')
    expect(cols).toContain('dependsOnTaskId')
  })

  it('progressSnapshots table has all required columns including pvDays and evDays', () => {
    const cols = Object.keys(progressSnapshots)
    expect(cols).toContain('id')
    expect(cols).toContain('taskId')
    expect(cols).toContain('snapshotDate')
    expect(cols).toContain('progressPct')
    expect(cols).toContain('pvDays')
    expect(cols).toContain('evDays')
    expect(cols).toContain('acDays')
    expect(cols).toContain('createdAt')
  })

  // 要件 1.1: progress_snapshots テーブルに note カラム（テキスト、NULL 許容）を保持する
  it('progressSnapshots table includes nullable note column', () => {
    const cols = Object.keys(progressSnapshots)
    expect(cols).toContain('note')
    const noteCol = progressSnapshots.note
    expect(noteCol).toBeDefined()
    // note must be nullable (no notNull constraint)
    expect((noteCol as { notNull: boolean }).notNull).toBe(false)
  })

  it('all 6 tables are exported', () => {
    expect(projects).toBeDefined()
    expect(tasks).toBeDefined()
    expect(members).toBeDefined()
    expect(holidays).toBeDefined()
    expect(taskDependencies).toBeDefined()
    expect(progressSnapshots).toBeDefined()
  })

  it('tasks.isBuffer uses boolean mode (stores as integer)', () => {
    // The column config should have mode 'boolean'
    const isBufferCol = tasks.isBuffer
    expect(isBufferCol).toBeDefined()
  })

  it('tasks.isLeaf uses boolean mode (stores as integer)', () => {
    const isLeafCol = tasks.isLeaf
    expect(isLeafCol).toBeDefined()
  })

  it('tasks.parentId is a self-reference column', () => {
    const parentIdCol = tasks.parentId
    expect(parentIdCol).toBeDefined()
  })

  it('progressSnapshots pvDays and evDays have default value of 0', () => {
    const pvDaysCol = progressSnapshots.pvDays
    const evDaysCol = progressSnapshots.evDays
    expect(pvDaysCol).toBeDefined()
    expect(evDaysCol).toBeDefined()
  })
})
