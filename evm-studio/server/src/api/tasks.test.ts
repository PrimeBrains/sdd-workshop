/**
 * Task 3.2: Tasks CRUD tRPC router tests
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 *
 * Feature Flag: ENABLE_TASKS_ROUTER
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
import { ENABLE_TASKS_ROUTER, createTasksRouter } from './tasks.js'

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
  return createTasksRouter(db).createCaller({})
}

async function createProject(db: TestDb): Promise<number> {
  const rows = await db
    .insert(schema.projects)
    .values({ name: 'Test Project', startDate: '2026-01-01', endDate: '2026-12-31' })
    .returning()
  return rows[0]!.id
}

// ── Feature Flag sanity check ─────────────────────────────────────────────────

describe('Feature Flag: ENABLE_TASKS_ROUTER', () => {
  it('should be true (GREEN phase — implementation enabled)', () => {
    expect(ENABLE_TASKS_ROUTER).toBe(true)
  })
})

// ── Requirement 3.1: create → returns task with generated id ──────────────────

describe('tasks.create (Req 3.1)', () => {
  it('creates a task with valid input and returns it with a generated id', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({
      projectId,
      name: 'Task Alpha',
      estimateDays: 5,
      plannedStart: '2026-01-10',
      plannedEnd: '2026-01-15',
    })

    expect(result.id).toBeTypeOf('number')
    expect(result.id).toBeGreaterThan(0)
    expect(result.name).toBe('Task Alpha')
    expect(result.projectId).toBe(projectId)
    expect(result.estimateDays).toBe(5)
    expect(result.plannedStart).toBe('2026-01-10')
    expect(result.plannedEnd).toBe('2026-01-15')
  })

  it('applies default values for level, sortOrder, isBuffer, isLeaf', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({
      projectId,
      name: 'Defaults Task',
      estimateDays: 3,
    })

    expect(result.level).toBe(1)
    expect(result.sortOrder).toBe(0)
    expect(result.isBuffer).toBe(false)
    expect(result.isLeaf).toBe(true)
  })
})

// ── Requirement 3.7: Zod validation → BAD_REQUEST for invalid input ───────────

describe('tasks.create — Zod validation (Req 3.7)', () => {
  it('returns BAD_REQUEST when name is empty', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, name: '', estimateDays: 5 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when estimateDays is negative', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, name: 'Bad Task', estimateDays: -1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when plannedStart has invalid format', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, name: 'Bad Task', estimateDays: 5, plannedStart: '2026/01/10' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when plannedEnd has invalid format', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, name: 'Bad Task', estimateDays: 5, plannedEnd: '20260115' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

// ── Requirement 3.2: listByProject → returns all tasks sorted by sort_order ───

describe('tasks.listByProject (Req 3.2)', () => {
  it('returns an empty array when no tasks exist for the project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.listByProject({ projectId })
    expect(result).toEqual([])
  })

  it('returns all tasks belonging to the project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await caller.create({ projectId, name: 'Task A', estimateDays: 2 })
    await caller.create({ projectId, name: 'Task B', estimateDays: 3 })

    const result = await caller.listByProject({ projectId })
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.name)).toContain('Task A')
    expect(result.map((t) => t.name)).toContain('Task B')
  })

  it('returns tasks ordered by sort_order ascending', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    // Insert in reverse sort_order
    await caller.create({ projectId, name: 'Task Z', estimateDays: 1, sortOrder: 30 })
    await caller.create({ projectId, name: 'Task A', estimateDays: 1, sortOrder: 10 })
    await caller.create({ projectId, name: 'Task M', estimateDays: 1, sortOrder: 20 })

    const result = await caller.listByProject({ projectId })
    expect(result[0]!.name).toBe('Task A')
    expect(result[1]!.name).toBe('Task M')
    expect(result[2]!.name).toBe('Task Z')
  })

  it('does not return tasks from another project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId1 = await createProject(db)
    const projectId2 = await createProject(db)

    await caller.create({ projectId: projectId1, name: 'P1 Task', estimateDays: 1 })
    await caller.create({ projectId: projectId2, name: 'P2 Task', estimateDays: 1 })

    const result = await caller.listByProject({ projectId: projectId1 })
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('P1 Task')
  })
})

// ── Requirement 3.3: getById with valid id → returns task ────────────────────

describe('tasks.getById — valid id (Req 3.3)', () => {
  it('returns the matching task for a valid id', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const created = await caller.create({ projectId, name: 'FindMe', estimateDays: 7 })
    const found = await caller.getById({ id: created.id })

    expect(found.id).toBe(created.id)
    expect(found.name).toBe('FindMe')
    expect(found.estimateDays).toBe(7)
  })
})

// ── Requirement 3.4: getById with non-existent id → NOT_FOUND (TASK_NOT_FOUND) ─

describe('tasks.getById — non-existent id (Req 3.4)', () => {
  it('throws TRPCError with code NOT_FOUND for a non-existent id', async () => {
    const caller = makeCaller(createTestDb())

    await expect(caller.getById({ id: 99999 })).rejects.toThrow(TRPCError)
    await expect(caller.getById({ id: 99999 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('preserves AppError(TASK_NOT_FOUND) as the cause', async () => {
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
    expect(cause.code).toBe('TASK_NOT_FOUND')
  })
})

// ── Requirement 3.5: update → returns updated task ────────────────────────────

describe('tasks.update (Req 3.5)', () => {
  it('persists the change and returns the updated task', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const created = await caller.create({ projectId, name: 'Old Name', estimateDays: 5 })
    const updated = await caller.update({ id: created.id, name: 'New Name', estimateDays: 10 })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('New Name')
    expect(updated.estimateDays).toBe(10)
    expect(updated.projectId).toBe(projectId)
  })

  it('throws NOT_FOUND when updating a non-existent task', async () => {
    const caller = makeCaller(createTestDb())
    await expect(caller.update({ id: 99999, name: 'Ghost' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

// ── Requirement 3.6: delete cascades task_dependencies and progress_snapshots ─

describe('tasks.delete (Req 3.6)', () => {
  it('deletes the task and returns { success: true }', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const task = await caller.create({ projectId, name: 'To Delete', estimateDays: 3 })
    const result = await caller.delete({ id: task.id })
    expect(result).toEqual({ success: true })

    // Verify task is gone
    await expect(caller.getById({ id: task.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws NOT_FOUND when deleting a non-existent task', async () => {
    const caller = makeCaller(createTestDb())
    await expect(caller.delete({ id: 99999 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('cascades deletion of associated task_dependencies', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const task1 = await caller.create({ projectId, name: 'Task 1', estimateDays: 2 })
    const task2 = await caller.create({ projectId, name: 'Task 2', estimateDays: 3 })

    // Insert a task_dependency: task2 depends on task1
    await db.insert(schema.taskDependencies).values({
      taskId: task2.id,
      dependsOnTaskId: task1.id,
    })

    // Verify dependency exists
    const deps = await db
      .select()
      .from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.taskId, task2.id))
    expect(deps).toHaveLength(1)

    // Delete task1 — should cascade to task_dependencies where depends_on_task_id = task1.id
    await caller.delete({ id: task1.id })

    const remainingDeps = await db
      .select()
      .from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.taskId, task2.id))
    expect(remainingDeps).toHaveLength(0)
  })

  it('cascades deletion of associated progress_snapshots', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const task = await caller.create({ projectId, name: 'Snapshot Task', estimateDays: 5 })

    // Insert a progress_snapshot
    await db.insert(schema.progressSnapshots).values({
      taskId: task.id,
      snapshotDate: '2026-01-10',
      progressPct: 50,
    })

    // Verify snapshot exists
    const snapshots = await db
      .select()
      .from(schema.progressSnapshots)
      .where(eq(schema.progressSnapshots.taskId, task.id))
    expect(snapshots).toHaveLength(1)

    // Delete the task — should cascade to progress_snapshots
    await caller.delete({ id: task.id })

    const remainingSnapshots = await db
      .select()
      .from(schema.progressSnapshots)
      .where(eq(schema.progressSnapshots.taskId, task.id))
    expect(remainingSnapshots).toHaveLength(0)
  })
})

// ── Requirement 3.8: optional is_buffer flag ──────────────────────────────────

describe('tasks.create — isBuffer flag (Req 3.8)', () => {
  it('creates a CCPM buffer task when isBuffer is true', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({
      projectId,
      name: 'Buffer Task',
      estimateDays: 2,
      isBuffer: true,
    })

    expect(result.isBuffer).toBe(true)
  })

  it('updates isBuffer flag via tasks.update', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const created = await caller.create({ projectId, name: 'Task', estimateDays: 3 })
    expect(created.isBuffer).toBe(false)

    const updated = await caller.update({ id: created.id, isBuffer: true })
    expect(updated.isBuffer).toBe(true)
  })
})

// ── Requirement 3.9: optional is_leaf flag ────────────────────────────────────

describe('tasks.create — isLeaf flag (Req 3.9)', () => {
  it('creates a non-leaf task when isLeaf is false', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({
      projectId,
      name: 'Parent Task',
      estimateDays: 0,
      isLeaf: false,
    })

    expect(result.isLeaf).toBe(false)
  })

  it('updates isLeaf flag via tasks.update', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const created = await caller.create({ projectId, name: 'Task', estimateDays: 3 })
    expect(created.isLeaf).toBe(true)

    const updated = await caller.update({ id: created.id, isLeaf: false })
    expect(updated.isLeaf).toBe(false)
  })
})
