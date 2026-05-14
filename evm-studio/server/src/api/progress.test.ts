/**
 * Task 5.1: Progress tRPC router unit tests
 * Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 3.1, 3.2, 4.1
 *
 * Feature Flag: ENABLE_PROGRESS_ROUTER
 * RED phase: tests fail when flag is OFF (router returns stub)
 * GREEN phase: flag enabled, full implementation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { TRPCError } from '@trpc/server'
import * as schema from '../db/schema.js'
import { ENABLE_PROGRESS_ROUTER, createProgressRouter } from './progress.js'

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
  return createProgressRouter(db).createCaller({})
}

// ── Seed helpers ───────────────────────────────────────────────────────────────

async function seedProject(db: TestDb, overrides?: Partial<schema.NewProject>) {
  const rows = await db
    .insert(schema.projects)
    .values({
      name:      'Test Project',
      startDate: '2026-01-01',
      endDate:   '2026-12-31',
      ...overrides,
    })
    .returning()
  return rows[0]!
}

async function seedTask(
  db: TestDb,
  projectId: number,
  overrides?: Partial<schema.NewTask>,
) {
  const rows = await db
    .insert(schema.tasks)
    .values({
      projectId,
      name:         'Test Task',
      estimateDays: 10,
      plannedStart: '2026-01-01',
      plannedEnd:   '2026-01-15',
      ...overrides,
    })
    .returning()
  return rows[0]!
}

// ── Feature Flag sanity check ─────────────────────────────────────────────────

describe('Feature Flag: ENABLE_PROGRESS_ROUTER', () => {
  it('should be true (GREEN phase — implementation enabled)', () => {
    expect(ENABLE_PROGRESS_ROUTER).toBe(true)
  })
})

// ── Requirement 1.6: progress.record 正常系 ────────────────────────────────────

describe('progress.record — 正常系 新規スナップショット作成 (Req 1.1, 1.6)', () => {
  it('新規スナップショットを作成して ProgressSnapshot レコードを返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const result = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  50,
      acDays:       3.5,
    })

    expect(result.id).toBeTypeOf('number')
    expect(result.id).toBeGreaterThan(0)
    expect(result.taskId).toBe(task.id)
    expect(result.snapshotDate).toBe('2026-05-01')
    expect(result.progressPct).toBe(50)
    expect(result.acDays).toBe(3.5)
    // ev_days = estimateDays * progressPct / 100 = 10 * 0.5 = 5
    expect(result.evDays).toBeCloseTo(5)
  })
})

// ── Requirement 1.1, 1.7: upsert 検証 ────────────────────────────────────────

describe('progress.record — upsert 検証 (Req 1.1, 1.7)', () => {
  it('同一 (task_id, snapshotDate) で再記録しても行数は増えず値が更新される', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    // 1回目
    const first = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  30,
      acDays:       2.0,
    })

    // 2回目: 同一 (task_id, snapshotDate), 値を更新
    const second = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  60,
      acDays:       5.0,
    })

    // id は同じ行が上書きされているはず
    expect(second.id).toBe(first.id)
    expect(second.progressPct).toBe(60)
    expect(second.acDays).toBe(5.0)

    // DB 内のレコード数が 1 のまま
    const allSnapshots = await db.select().from(schema.progressSnapshots)
    expect(allSnapshots).toHaveLength(1)
  })

  it('別の日付スナップショットは削除・変更されない (Req 1.7)', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    // 5/01 を記録
    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  30,
      acDays:       2.0,
    })

    // 5/02 を記録
    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-02',
      progressPct:  50,
      acDays:       4.0,
    })

    // 5/01 を再度 upsert
    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  35,
      acDays:       2.5,
    })

    // 合計 2 件のまま
    const allSnapshots = await db.select().from(schema.progressSnapshots)
    expect(allSnapshots).toHaveLength(2)

    // 5/02 は変更されていない
    const snap0502 = allSnapshots.find((s) => s.snapshotDate === '2026-05-02')
    expect(snap0502).toBeDefined()
    expect(snap0502!.progressPct).toBe(50)
  })
})

// ── Requirement 1.2: バリデーションエラー ─────────────────────────────────────

describe('progress.record — バリデーションエラー progressPct=101 (Req 1.2)', () => {
  it('progressPct が 101 のとき BAD_REQUEST エラーを返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    await expect(
      caller.record({
        taskId:       task.id,
        snapshotDate: '2026-05-01',
        progressPct:  101,
        acDays:       0,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('progressPct が -1 のとき BAD_REQUEST エラーを返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    await expect(
      caller.record({
        taskId:       task.id,
        snapshotDate: '2026-05-01',
        progressPct:  -1,
        acDays:       0,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

// ── Requirement 1.5: タスク未存在 ─────────────────────────────────────────────

describe('progress.record — タスク未存在 (Req 1.5)', () => {
  it('存在しない task_id のとき SNAP_TASK_NOT_FOUND を含む NOT_FOUND エラーを返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    await expect(
      caller.record({
        taskId:       99999,
        snapshotDate: '2026-05-01',
        progressPct:  50,
        acDays:       0,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // cause に SNAP_TASK_NOT_FOUND が含まれること
    let caughtError: unknown
    try {
      await caller.record({
        taskId:       99999,
        snapshotDate: '2026-05-01',
        progressPct:  50,
        acDays:       0,
      })
    } catch (e) {
      caughtError = e
    }

    expect(caughtError).toBeInstanceOf(TRPCError)
    const trpcErr = caughtError as TRPCError
    expect(trpcErr.cause).toBeDefined()
    const cause = trpcErr.cause as { code?: string }
    expect(cause.code).toBe('SNAP_TASK_NOT_FOUND')
  })
})

// ── Requirement 3.1, 3.2: getLatest — 最新のみ返す ───────────────────────────

describe('progress.getLatest — 最新スナップショットのみ返す (Req 3.1, 3.2)', () => {
  it('同一タスクに2つの異なる日付スナップショットがある場合、最新の1件のみ返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    // 2つの異なる日付にスナップショットを記録
    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  30,
      acDays:       2.0,
    })
    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-10',
      progressPct:  70,
      acDays:       6.0,
    })

    const result = await caller.getLatest({ projectId: project.id })

    // このプロジェクトのタスクについて 1 件のみ返される
    expect(result).toHaveLength(1)
    // 最新の日付のスナップショット
    expect(result[0]!.snapshotDate).toBe('2026-05-10')
    expect(result[0]!.progressPct).toBe(70)
    expect(result[0]!.taskId).toBe(task.id)
  })

  it('複数タスクがある場合、各タスクの最新が1件ずつ返される', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const taskA   = await seedTask(db, project.id, { name: 'Task A' })
    const taskB   = await seedTask(db, project.id, { name: 'Task B' })

    // タスク A: 2件記録
    await caller.record({ taskId: taskA.id, snapshotDate: '2026-05-01', progressPct: 20, acDays: 1.0 })
    await caller.record({ taskId: taskA.id, snapshotDate: '2026-05-05', progressPct: 50, acDays: 3.0 })

    // タスク B: 1件記録
    await caller.record({ taskId: taskB.id, snapshotDate: '2026-05-03', progressPct: 40, acDays: 2.0 })

    const result = await caller.getLatest({ projectId: project.id })

    // タスク数 = 2
    expect(result).toHaveLength(2)

    const latestA = result.find((s) => s.taskId === taskA.id)
    const latestB = result.find((s) => s.taskId === taskB.id)

    expect(latestA).toBeDefined()
    expect(latestA!.snapshotDate).toBe('2026-05-05')

    expect(latestB).toBeDefined()
    expect(latestB!.snapshotDate).toBe('2026-05-03')
  })
})

// ── Requirement 4.1: getHistory — 時系列昇順 ──────────────────────────────────

describe('progress.getHistory — 時系列昇順 (Req 4.1)', () => {
  it('複数スナップショットが snapshot_date 昇順で返る', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    // 順不同で挿入
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-10', progressPct: 70, acDays: 6.0 })
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-01', progressPct: 20, acDays: 1.0 })
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-05', progressPct: 50, acDays: 3.5 })

    const result = await caller.getHistory({ taskId: task.id })

    expect(result).toHaveLength(3)
    expect(result[0]!.snapshotDate).toBe('2026-05-01')
    expect(result[1]!.snapshotDate).toBe('2026-05-05')
    expect(result[2]!.snapshotDate).toBe('2026-05-10')
  })

  it('スナップショットが存在しない task_id では空配列を返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const result = await caller.getHistory({ taskId: 99999 })
    expect(result).toEqual([])
  })
})
