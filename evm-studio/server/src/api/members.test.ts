/**
 * Task 3.3: Members CRUD tRPC router tests
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 *
 * Feature Flag: ENABLE_MEMBERS_ROUTER
 * RED phase: tests fail when flag is OFF (router returns stub)
 * GREEN phase: flag enabled, full implementation
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { ENABLE_MEMBERS_ROUTER, createMembersRouter } from './members.js'

// ── Test DB setup ──────────────────────────────────────────────────────────────

type TestDb = ReturnType<typeof drizzle<typeof schema>>

function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './src/db/migrations' })
  return db
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCaller(db: TestDb) {
  return createMembersRouter(db).createCaller({})
}

async function createProject(db: TestDb): Promise<number> {
  const rows = await db
    .insert(schema.projects)
    .values({ name: 'Test Project', startDate: '2026-01-01', endDate: '2026-12-31' })
    .returning()
  return rows[0]!.id
}

// ── Feature Flag sanity check ─────────────────────────────────────────────────

describe('Feature Flag: ENABLE_MEMBERS_ROUTER', () => {
  it('should be true (GREEN phase — implementation enabled)', () => {
    expect(ENABLE_MEMBERS_ROUTER).toBe(true)
  })
})

// ── Requirement 4.1: create → returns member with generated id ────────────────

describe('members.create (Req 4.1)', () => {
  it('creates a member with valid input and returns it with a generated id', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({
      projectId,
      name: 'Alice',
      availabilityRate: 1.0,
    })

    expect(result.id).toBeTypeOf('number')
    expect(result.id).toBeGreaterThan(0)
    expect(result.name).toBe('Alice')
    expect(result.projectId).toBe(projectId)
    expect(result.availabilityRate).toBe(1.0)
  })

  it('creates a member with optional fields (assignmentStart, assignmentEnd, externalId)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({
      projectId,
      name: 'Bob',
      availabilityRate: 0.5,
      assignmentStart: '2026-01-01',
      assignmentEnd: '2026-06-30',
      externalId: 'M001',
    })

    expect(result.name).toBe('Bob')
    expect(result.availabilityRate).toBe(0.5)
    expect(result.assignmentStart).toBe('2026-01-01')
    expect(result.assignmentEnd).toBe('2026-06-30')
    expect(result.externalId).toBe('M001')
  })
})

// ── Requirement 4.6 / 4.5: Zod validation → BAD_REQUEST ──────────────────────

describe('members.create — Zod validation (Req 4.6)', () => {
  it('returns BAD_REQUEST when name is empty', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, name: '', availabilityRate: 1.0 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when availabilityRate is above 1 (Req 4.5)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, name: 'Charlie', availabilityRate: 1.1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when availabilityRate is below 0 (Req 4.5)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, name: 'Charlie', availabilityRate: -0.1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('accepts availabilityRate at boundary value 0 (Req 4.5)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({ projectId, name: 'Zero Rate', availabilityRate: 0 })
    expect(result.availabilityRate).toBe(0)
  })

  it('accepts availabilityRate at boundary value 1 (Req 4.5)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({ projectId, name: 'Full Rate', availabilityRate: 1 })
    expect(result.availabilityRate).toBe(1)
  })
})

// ── Requirement 4.2: listByProject → returns all members of project ───────────

describe('members.listByProject (Req 4.2)', () => {
  it('returns an empty array when no members exist for the project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.listByProject({ projectId })
    expect(result).toEqual([])
  })

  it('returns all members belonging to the project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await caller.create({ projectId, name: 'Alice', availabilityRate: 1.0 })
    await caller.create({ projectId, name: 'Bob', availabilityRate: 0.8 })

    const result = await caller.listByProject({ projectId })
    expect(result).toHaveLength(2)
    expect(result.map((m) => m.name)).toContain('Alice')
    expect(result.map((m) => m.name)).toContain('Bob')
  })

  it('does not return members from another project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId1 = await createProject(db)
    const projectId2 = await createProject(db)

    await caller.create({ projectId: projectId1, name: 'P1 Member', availabilityRate: 1.0 })
    await caller.create({ projectId: projectId2, name: 'P2 Member', availabilityRate: 1.0 })

    const result = await caller.listByProject({ projectId: projectId1 })
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('P1 Member')
  })
})

// ── Requirement 4.3: update → returns updated member ─────────────────────────

describe('members.update (Req 4.3)', () => {
  it('persists the change and returns the updated member', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const created = await caller.create({ projectId, name: 'Old Name', availabilityRate: 1.0 })
    const updated = await caller.update({ id: created.id, name: 'New Name', availabilityRate: 0.5 })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('New Name')
    expect(updated.availabilityRate).toBe(0.5)
    expect(updated.projectId).toBe(projectId)
  })

  it('throws NOT_FOUND (MEMBER_NOT_FOUND) when updating a non-existent member', async () => {
    const caller = makeCaller(createTestDb())
    await expect(caller.update({ id: 99999, name: 'Ghost' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('preserves AppError(MEMBER_NOT_FOUND) as the cause', async () => {
    const caller = makeCaller(createTestDb())
    let caughtError: unknown
    try {
      await caller.update({ id: 99999, name: 'Ghost' })
    } catch (e) {
      caughtError = e
    }

    expect(caughtError).toBeInstanceOf(TRPCError)
    const trpcErr = caughtError as TRPCError
    expect(trpcErr.cause).toBeDefined()
    const cause = trpcErr.cause as { code?: string }
    expect(cause.code).toBe('MEMBER_NOT_FOUND')
  })

  it('returns BAD_REQUEST when availabilityRate is outside [0,1] on update (Req 4.5)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const created = await caller.create({ projectId, name: 'Member', availabilityRate: 1.0 })

    await expect(
      caller.update({ id: created.id, availabilityRate: 1.5 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    await expect(
      caller.update({ id: created.id, availabilityRate: -0.5 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

// ── Requirement 4.4: delete → tasks.assigneeId becomes NULL ──────────────────

describe('members.delete (Req 4.4)', () => {
  it('deletes the member and returns { success: true }', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const member = await caller.create({ projectId, name: 'To Delete', availabilityRate: 1.0 })
    const result = await caller.delete({ id: member.id })
    expect(result).toEqual({ success: true })

    // Verify member is gone
    const remaining = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, member.id))
    expect(remaining).toHaveLength(0)
  })

  it('throws NOT_FOUND (MEMBER_NOT_FOUND) when deleting a non-existent member', async () => {
    const caller = makeCaller(createTestDb())
    await expect(caller.delete({ id: 99999 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('sets tasks.assigneeId to NULL for tasks referencing the deleted member (Req 4.4)', async () => {
    // This test verifies that the FK ON DELETE SET NULL constraint works correctly
    // when PRAGMA foreign_keys = ON is enabled.
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    // Create member
    const member = await caller.create({ projectId, name: 'Assignee', availabilityRate: 1.0 })

    // Create task assigned to member
    const taskRows = await db
      .insert(schema.tasks)
      .values({
        projectId,
        name: 'Assigned Task',
        estimateDays: 3,
        assigneeId: member.id,
      })
      .returning()
    const task = taskRows[0]!

    // Verify assignment
    expect(task.assigneeId).toBe(member.id)

    // Delete member
    await caller.delete({ id: member.id })

    // Verify task's assigneeId is now NULL
    const updatedTask = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
    expect(updatedTask[0]!.assigneeId).toBeNull()
  })

  it('sets assigneeId to NULL for multiple tasks referencing the deleted member', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const member = await caller.create({ projectId, name: 'Shared Assignee', availabilityRate: 0.8 })

    // Create multiple tasks assigned to the same member
    const task1Rows = await db
      .insert(schema.tasks)
      .values({ projectId, name: 'Task 1', estimateDays: 2, assigneeId: member.id })
      .returning()
    const task2Rows = await db
      .insert(schema.tasks)
      .values({ projectId, name: 'Task 2', estimateDays: 4, assigneeId: member.id })
      .returning()
    const task1 = task1Rows[0]!
    const task2 = task2Rows[0]!

    // Delete member
    await caller.delete({ id: member.id })

    // Both tasks should have NULL assigneeId
    const updatedTask1 = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task1.id))
    const updatedTask2 = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task2.id))

    expect(updatedTask1[0]!.assigneeId).toBeNull()
    expect(updatedTask2[0]!.assigneeId).toBeNull()
  })
})
