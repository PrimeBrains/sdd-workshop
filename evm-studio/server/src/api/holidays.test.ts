/**
 * Task 3.4: Holiday CRUD tRPC router tests
 * Requirements: 5.1, 5.2, 5.3, 5.4
 *
 * Feature Flag: ENABLE_HOLIDAYS_ROUTER
 * RED phase: tests fail when flag is OFF (router returns stub)
 * GREEN phase: flag enabled, full implementation
 */

import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { ENABLE_HOLIDAYS_ROUTER, createHolidaysRouter, setEnableHolidaysRouter } from './holidays.js'

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
  return createHolidaysRouter(db).createCaller({})
}

async function createProject(db: TestDb): Promise<number> {
  const rows = await db
    .insert(schema.projects)
    .values({ name: 'Test Project', startDate: '2026-01-01', endDate: '2026-12-31' })
    .returning()
  return rows[0]!.id
}

// ── Feature Flag sanity check ─────────────────────────────────────────────────

describe('Feature Flag: ENABLE_HOLIDAYS_ROUTER', () => {
  afterEach(() => {
    // Always restore the flag so subsequent tests run with full implementation
    setEnableHolidaysRouter(true)
  })

  it('should be true by default (GREEN phase — implementation enabled)', () => {
    expect(ENABLE_HOLIDAYS_ROUTER).toBe(true)
  })

  it('RED phase: procedures throw when flag is false', async () => {
    // Set flag to false to simulate feature-disabled / RED phase
    setEnableHolidaysRouter(false)

    const db = createTestDb()
    const caller = createHolidaysRouter(db).createCaller({})

    await expect(
      caller.listByProject({ projectId: 1 }),
    ).rejects.toThrow('holidays router disabled')

    await expect(
      caller.create({ projectId: 1, date: '2026-01-01' }),
    ).rejects.toThrow('holidays router disabled')

    await expect(
      caller.delete({ id: 1 }),
    ).rejects.toThrow('holidays router disabled')
  })
})

// ── Requirement 5.1: create → returns holiday with generated id ───────────────

describe('holidays.create (Req 5.1)', () => {
  it('creates a holiday with valid YYYY-MM-DD date and returns it with a generated id', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.create({
      projectId,
      date: '2026-01-01',
    })

    expect(result.id).toBeTypeOf('number')
    expect(result.id).toBeGreaterThan(0)
    expect(result.projectId).toBe(projectId)
    expect(result.date).toBe('2026-01-01')
  })

  it('creates multiple holidays for the same project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const h1 = await caller.create({ projectId, date: '2026-01-01' })
    const h2 = await caller.create({ projectId, date: '2026-12-25' })

    expect(h1.id).not.toBe(h2.id)
    expect(h1.date).toBe('2026-01-01')
    expect(h2.date).toBe('2026-12-25')
  })
})

// ── Requirement 5.4: invalid date format → BAD_REQUEST ───────────────────────

describe('holidays.create — invalid date format (Req 5.4)', () => {
  it('returns BAD_REQUEST when date is not YYYY-MM-DD (plain text)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, date: 'not-a-date' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when date uses slash separator (MM/DD/YYYY)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, date: '01/01/2026' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when date is missing day component (YYYY-MM)', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, date: '2026-01' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when date has extra characters', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, date: '2026-01-01T00:00:00' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns BAD_REQUEST when date is empty string', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await expect(
      caller.create({ projectId, date: '' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

// ── Requirement 5.2: listByProject → returns all holidays in date ascending order

describe('holidays.listByProject (Req 5.2)', () => {
  it('returns an empty array when no holidays exist for the project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const result = await caller.listByProject({ projectId })
    expect(result).toEqual([])
  })

  it('returns all holidays for the project in ascending date order', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    // Insert in non-ascending order
    await caller.create({ projectId, date: '2026-12-25' })
    await caller.create({ projectId, date: '2026-01-01' })
    await caller.create({ projectId, date: '2026-05-03' })

    const result = await caller.listByProject({ projectId })

    expect(result).toHaveLength(3)
    expect(result[0]!.date).toBe('2026-01-01')
    expect(result[1]!.date).toBe('2026-05-03')
    expect(result[2]!.date).toBe('2026-12-25')
  })

  it('does not return holidays from another project', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId1 = await createProject(db)
    const projectId2 = await createProject(db)

    await caller.create({ projectId: projectId1, date: '2026-01-01' })
    await caller.create({ projectId: projectId2, date: '2026-07-04' })

    const result = await caller.listByProject({ projectId: projectId1 })
    expect(result).toHaveLength(1)
    expect(result[0]!.date).toBe('2026-01-01')
  })

  it('returns holidays with all years in ascending order', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    await caller.create({ projectId, date: '2027-01-01' })
    await caller.create({ projectId, date: '2025-12-25' })
    await caller.create({ projectId, date: '2026-06-15' })

    const result = await caller.listByProject({ projectId })

    expect(result).toHaveLength(3)
    expect(result[0]!.date).toBe('2025-12-25')
    expect(result[1]!.date).toBe('2026-06-15')
    expect(result[2]!.date).toBe('2027-01-01')
  })
})

// ── Requirement 5.3: delete → removes holiday record ─────────────────────────

describe('holidays.delete (Req 5.3)', () => {
  it('deletes the holiday and returns { success: true }', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const holiday = await caller.create({ projectId, date: '2026-01-01' })
    const result = await caller.delete({ id: holiday.id })

    expect(result).toEqual({ success: true })

    // Verify holiday is gone
    const remaining = await db
      .select()
      .from(schema.holidays)
      .where(eq(schema.holidays.id, holiday.id))
    expect(remaining).toHaveLength(0)
  })

  it('returns { success: true } even when deleting a non-existent id (idempotent)', async () => {
    const caller = makeCaller(createTestDb())
    const result = await caller.delete({ id: 99999 })
    expect(result).toEqual({ success: true })
  })

  it('only deletes the specified holiday, leaving others intact', async () => {
    const db = createTestDb()
    const caller = makeCaller(db)
    const projectId = await createProject(db)

    const h1 = await caller.create({ projectId, date: '2026-01-01' })
    const h2 = await caller.create({ projectId, date: '2026-12-25' })

    await caller.delete({ id: h1.id })

    const remaining = await caller.listByProject({ projectId })
    expect(remaining).toHaveLength(1)
    expect(remaining[0]!.id).toBe(h2.id)
  })
})
