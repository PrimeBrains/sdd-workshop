/**
 * Task 5.1: import tRPC router tests
 * Requirements: 6.1, 6.7, 6.9, 6.10, 7.2
 *
 * Feature Flag: ENABLE_IMPORT_ROUTER
 * RED phase: tests fail when flag is OFF (router returns stub)
 * GREEN phase: flag enabled, full implementation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { TRPCError } from '@trpc/server'
import * as schema from '../db/schema.js'
import { ENABLE_IMPORT_ROUTER, createImportRouter } from './import.js'

// ── Test DB setup ──────────────────────────────────────────────────────────────

type TestDb = ReturnType<typeof drizzle<typeof schema>>

function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './src/db/migrations' })
  return db
}

// ── Shorthand for creating caller ─────────────────────────────────────────────

function makeCaller(db: TestDb) {
  return createImportRouter(db).createCaller({})
}

// ── Feature Flag sanity check ─────────────────────────────────────────────────

describe('Feature Flag: ENABLE_IMPORT_ROUTER', () => {
  it('should be true (GREEN phase — implementation enabled)', () => {
    expect(ENABLE_IMPORT_ROUTER).toBe(true)
  })
})

// ── Minimal valid YAML fixtures ───────────────────────────────────────────────

const VALID_TASKS_YAML = `
tasks:
  - id: T001
    title: タスク1
    estimate_days: 5
    planned_start: "2026-01-01"
    planned_end: "2026-01-10"
  - id: T002
    title: タスク2
    estimate_days: 3
    planned_start: "2026-01-11"
    planned_end: "2026-01-15"
`.trim()

const VALID_STAFFING_YAML = `
members:
  - id: M001
    name: Alice
    availability_rate: 1.0
`.trim()

const VALID_SCHEDULE_YAML = `
meta:
  schedule_start: "2026-01-01"
  schedule_end: "2026-03-31"
`.trim()

// ── Helper: create a project in the test DB ───────────────────────────────────

async function createProject(db: TestDb): Promise<number> {
  const rows = await db
    .insert(schema.projects)
    .values({
      name: 'Test Project',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    })
    .returning()
  const project = rows[0]
  if (!project) throw new Error('Failed to create test project')
  return project.id
}

// ── Requirement 6.1, 6.9: valid 3 YAMLs → ImportSummary ─────────────────────

describe('import.wbsYaml — valid input (Req 6.1, 6.9)', () => {
  it('returns ImportSummary with counts when valid 3 YAMLs are provided', async () => {
    const db = createTestDb()
    const projectId = await createProject(db)
    const caller = makeCaller(db)

    const result = await caller.wbsYaml({
      projectId,
      tasksYaml: VALID_TASKS_YAML,
      staffingYaml: VALID_STAFFING_YAML,
      scheduleYaml: VALID_SCHEDULE_YAML,
    })

    // ImportSummary must have all required count fields (Req 6.9)
    expect(result).toHaveProperty('projects')
    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('members')
    expect(result).toHaveProperty('holidays')
    expect(result).toHaveProperty('dependencies')
    expect(result).toHaveProperty('snapshots')

    expect(result.tasks).toBeGreaterThanOrEqual(2)
    expect(result.members).toBeGreaterThanOrEqual(1)
  })
})

// ── Requirement 6.10: YAML parse error → BAD_REQUEST (IMPORT_PARSE_ERROR) ─────

describe('import.wbsYaml — YAML parse error (Req 6.10, 7.2)', () => {
  it('throws TRPCError BAD_REQUEST for invalid YAML syntax in tasksYaml', async () => {
    const db = createTestDb()
    const projectId = await createProject(db)
    const caller = makeCaller(db)

    const invalidYaml = 'tasks:\n  - id: [unclosed bracket'

    await expect(
      caller.wbsYaml({
        projectId,
        tasksYaml: invalidYaml,
        staffingYaml: VALID_STAFFING_YAML,
        scheduleYaml: VALID_SCHEDULE_YAML,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('preserves AppError(IMPORT_PARSE_ERROR) as the cause (Req 7.2)', async () => {
    const db = createTestDb()
    const projectId = await createProject(db)
    const caller = makeCaller(db)

    const invalidYaml = 'tasks:\n  - id: [unclosed bracket'

    let caughtError: unknown
    try {
      await caller.wbsYaml({
        projectId,
        tasksYaml: invalidYaml,
        staffingYaml: VALID_STAFFING_YAML,
        scheduleYaml: VALID_SCHEDULE_YAML,
      })
    } catch (e) {
      caughtError = e
    }

    expect(caughtError).toBeInstanceOf(TRPCError)
    const trpcErr = caughtError as TRPCError
    expect(trpcErr.cause).toBeDefined()
    const cause = trpcErr.cause as { code?: string }
    expect(cause.code).toBe('IMPORT_PARSE_ERROR')
  })
})

// ── Requirement 6.7: missing required field → BAD_REQUEST (IMPORT_MISSING_FIELD) ─

describe('import.wbsYaml — missing required field (Req 6.7, 7.2)', () => {
  it('throws TRPCError BAD_REQUEST when tasksYaml is missing "title" field', async () => {
    const db = createTestDb()
    const projectId = await createProject(db)
    const caller = makeCaller(db)

    // tasks.yaml with "title" missing (required field)
    const missingFieldYaml = `
tasks:
  - id: T001
    estimate_days: 5
    planned_start: "2026-01-01"
    planned_end: "2026-01-10"
`.trim()

    await expect(
      caller.wbsYaml({
        projectId,
        tasksYaml: missingFieldYaml,
        staffingYaml: VALID_STAFFING_YAML,
        scheduleYaml: VALID_SCHEDULE_YAML,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('preserves AppError(IMPORT_MISSING_FIELD) as the cause (Req 7.2)', async () => {
    const db = createTestDb()
    const projectId = await createProject(db)
    const caller = makeCaller(db)

    const missingFieldYaml = `
tasks:
  - id: T001
    estimate_days: 5
    planned_start: "2026-01-01"
    planned_end: "2026-01-10"
`.trim()

    let caughtError: unknown
    try {
      await caller.wbsYaml({
        projectId,
        tasksYaml: missingFieldYaml,
        staffingYaml: VALID_STAFFING_YAML,
        scheduleYaml: VALID_SCHEDULE_YAML,
      })
    } catch (e) {
      caughtError = e
    }

    expect(caughtError).toBeInstanceOf(TRPCError)
    const trpcErr = caughtError as TRPCError
    expect(trpcErr.cause).toBeDefined()
    const cause = trpcErr.cause as { code?: string }
    expect(cause.code).toBe('IMPORT_MISSING_FIELD')
  })
})

// ── Zod validation: empty YAML strings → BAD_REQUEST ─────────────────────────

describe('import.wbsYaml — Zod input validation (Req 7.2)', () => {
  it('returns BAD_REQUEST when tasksYaml is empty string', async () => {
    const db = createTestDb()
    const projectId = await createProject(db)
    const caller = makeCaller(db)

    await expect(
      caller.wbsYaml({
        projectId,
        tasksYaml: '',
        staffingYaml: VALID_STAFFING_YAML,
        scheduleYaml: VALID_SCHEDULE_YAML,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when projectId is not positive', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)

    await expect(
      caller.wbsYaml({
        projectId: 0,
        tasksYaml: VALID_TASKS_YAML,
        staffingYaml: VALID_STAFFING_YAML,
        scheduleYaml: VALID_SCHEDULE_YAML,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
