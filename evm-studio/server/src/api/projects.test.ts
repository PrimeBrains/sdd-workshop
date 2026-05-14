/**
 * Task 3.1: Project CRUD tRPC router tests
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 *
 * Feature Flag: ENABLE_PROJECT_ROUTER
 * RED phase: tests fail when flag is OFF (router returns stub)
 * GREEN phase: flag enabled, full implementation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { ENABLE_PROJECT_ROUTER, createProjectsRouter } from './projects.js'

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
  return createProjectsRouter(db).createCaller({})
}

// ── Feature Flag sanity check ─────────────────────────────────────────────────

describe('Feature Flag: ENABLE_PROJECT_ROUTER', () => {
  it('should be true (GREEN phase — implementation enabled)', () => {
    expect(ENABLE_PROJECT_ROUTER).toBe(true)
  })
})

// ── Requirement 2.1: create project → returns with generated id ───────────────

describe('projects.create (Req 2.1)', () => {
  it('creates a project with valid input and returns it with a generated id', async () => {
    const caller = makeCaller(createTestDb())

    const result = await caller.create({
      name: 'Test Project',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })

    expect(result.id).toBeTypeOf('number')
    expect(result.id).toBeGreaterThan(0)
    expect(result.name).toBe('Test Project')
    expect(result.startDate).toBe('2026-01-01')
    expect(result.endDate).toBe('2026-12-31')
  })
})

// ── Requirement 2.7: Zod validation → BAD_REQUEST for invalid input ───────────

describe('projects.create — Zod validation (Req 2.7)', () => {
  it('returns BAD_REQUEST when name is empty', async () => {
    const caller = makeCaller(createTestDb())

    await expect(
      caller.create({ name: '', startDate: '2026-01-01', endDate: '2026-12-31' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when startDate has invalid format', async () => {
    const caller = makeCaller(createTestDb())

    await expect(
      caller.create({ name: 'Test', startDate: '2026/01/01', endDate: '2026-12-31' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when endDate has invalid format', async () => {
    const caller = makeCaller(createTestDb())

    await expect(
      caller.create({ name: 'Test', startDate: '2026-01-01', endDate: '2026_12_31' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

// ── Requirement 2.2: list → returns all projects ─────────────────────────────

describe('projects.list (Req 2.2)', () => {
  it('returns an empty array when no projects exist', async () => {
    const caller = makeCaller(createTestDb())
    const result = await caller.list()
    expect(result).toEqual([])
  })

  it('returns all projects after creation', async () => {
    const caller = makeCaller(createTestDb())
    await caller.create({ name: 'Project A', startDate: '2026-01-01', endDate: '2026-06-30' })
    await caller.create({ name: 'Project B', startDate: '2026-07-01', endDate: '2026-12-31' })

    const result = await caller.list()
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.name)).toContain('Project A')
    expect(result.map((p) => p.name)).toContain('Project B')
  })
})

// ── Requirement 2.3: getById with valid id → returns project ─────────────────

describe('projects.getById — valid id (Req 2.3)', () => {
  it('returns the matching project for a valid id', async () => {
    const caller = makeCaller(createTestDb())
    const created = await caller.create({ name: 'Alpha', startDate: '2026-01-01', endDate: '2026-12-31' })
    const found = await caller.getById({ id: created.id })

    expect(found.id).toBe(created.id)
    expect(found.name).toBe('Alpha')
  })
})

// ── Requirement 2.4: getById with non-existent id → NOT_FOUND (PROJ_NOT_FOUND) ─

describe('projects.getById — non-existent id (Req 2.4)', () => {
  it('throws TRPCError with code NOT_FOUND for a non-existent id', async () => {
    const caller = makeCaller(createTestDb())

    await expect(caller.getById({ id: 99999 })).rejects.toThrow(TRPCError)
    await expect(caller.getById({ id: 99999 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('preserves AppError(PROJ_NOT_FOUND) as the cause', async () => {
    const caller = makeCaller(createTestDb())
    let caughtError: unknown
    try {
      await caller.getById({ id: 99999 })
    } catch (e) {
      caughtError = e
    }

    expect(caughtError).toBeInstanceOf(TRPCError)
    const trpcErr = caughtError as TRPCError
    expect(trpcErr.cause).toBeDefined()
    const cause = trpcErr.cause as { code?: string }
    expect(cause.code).toBe('PROJ_NOT_FOUND')
  })
})

// ── Requirement 2.5: update with valid fields → returns updated project ───────

describe('projects.update (Req 2.5)', () => {
  it('persists the change and returns the updated project', async () => {
    const caller = makeCaller(createTestDb())
    const created = await caller.create({ name: 'Old Name', startDate: '2026-01-01', endDate: '2026-12-31' })
    const updated = await caller.update({ id: created.id, name: 'New Name' })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('New Name')
    expect(updated.startDate).toBe('2026-01-01')
  })

  it('throws NOT_FOUND when updating a non-existent project', async () => {
    const caller = makeCaller(createTestDb())
    await expect(caller.update({ id: 99999, name: 'Ghost' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

// ── Requirement 2.6: delete cascades tasks, members, holidays ────────────────

describe('projects.delete — cascade (Req 2.6)', () => {
  it('deletes the project and returns { success: true }', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)

    const project = await caller.create({ name: 'Cascade Test', startDate: '2026-01-01', endDate: '2026-12-31' })
    const result = await caller.delete({ id: project.id })
    expect(result).toEqual({ success: true })

    // Verify project is gone
    await expect(caller.getById({ id: project.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('cascades deletion of associated tasks, members, and holidays', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)

    // Create project
    const project = await caller.create({ name: 'Parent Project', startDate: '2026-01-01', endDate: '2026-12-31' })

    const { tasks, members, holidays } = schema

    // Insert member, task, holiday directly via drizzle
    await db.insert(members).values({
      projectId: project.id,
      name: 'Alice',
      availabilityRate: 1.0,
    })

    await db.insert(tasks).values({
      projectId: project.id,
      name: 'Task 1',
      estimateDays: 5,
    })

    await db.insert(holidays).values({
      projectId: project.id,
      date: '2026-01-01',
    })

    // Delete the project
    await caller.delete({ id: project.id })

    // Verify cascade: tasks, members, holidays should be gone
    const remainingTasks = await db.select().from(tasks).where(eq(tasks.projectId, project.id))
    expect(remainingTasks).toHaveLength(0)

    const remainingMembers = await db.select().from(members).where(eq(members.projectId, project.id))
    expect(remainingMembers).toHaveLength(0)

    const remainingHolidays = await db.select().from(holidays).where(eq(holidays.projectId, project.id))
    expect(remainingHolidays).toHaveLength(0)
  })

  it('throws NOT_FOUND when deleting a non-existent project', async () => {
    const caller = makeCaller(createTestDb())
    await expect(caller.delete({ id: 99999 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
