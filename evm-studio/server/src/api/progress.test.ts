/**
 * Task 4.1: Progress tRPC router unit tests
 * Requirements: 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10,
 *               3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5,
 *               4.5.1, 4.5.3, 4.5.4, 4.5.5, 4.5.6, 5.1, 5.2, 5.3
 *
 * Feature Flag: ENABLE_PROGRESS_ROUTER
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function offsetDaysISO(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
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

// ══════════════════════════════════════════════════════════════════════════════
// progress.record
// ══════════════════════════════════════════════════════════════════════════════

describe('progress.record — 正常系 (Req 2.1, 2.9)', () => {
  it('新規スナップショットを作成して保存値を返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const result = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  50,
      acDays:       3.5,
      note:         '順調に進行中',
    })

    expect(result.id).toBeTypeOf('number')
    expect(result.id).toBeGreaterThan(0)
    expect(result.taskId).toBe(task.id)
    expect(result.snapshotDate).toBe('2026-05-01')
    expect(result.progressPct).toBe(50)
    expect(result.acDays).toBe(3.5)
    expect(result.note).toBe('順調に進行中')
    expect(result.createdAt).toBeDefined()
  })
})

describe('progress.record — upsert (Req 2.1, 2.10)', () => {
  it('同一 (taskId, snapshotDate) で 2 回呼ぶと値が更新されレコード数は増えない', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const first = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  30,
      acDays:       2.0,
      note:         'まずは start',
    })

    const second = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  60,
      acDays:       5.0,
      note:         '更新したメモ',
    })

    expect(second.id).toBe(first.id)
    expect(second.progressPct).toBe(60)
    expect(second.acDays).toBe(5.0)
    expect(second.note).toBe('更新したメモ')

    const allSnapshots = await db.select().from(schema.progressSnapshots)
    expect(allSnapshots).toHaveLength(1)
  })

  it('別の (taskId, snapshotDate) は変更・削除されない (Req 2.10)', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  30,
      acDays:       2.0,
    })
    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-02',
      progressPct:  50,
      acDays:       4.0,
    })

    // 5/01 を再 upsert
    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  35,
      acDays:       2.5,
    })

    const all = await db.select().from(schema.progressSnapshots)
    expect(all).toHaveLength(2)

    const snap0502 = all.find((s) => s.snapshotDate === '2026-05-02')
    expect(snap0502).toBeDefined()
    expect(snap0502!.progressPct).toBe(50)
    expect(snap0502!.acDays).toBe(4.0)
  })
})

describe('progress.record — 過去日付許容 (Req 2.5)', () => {
  it('snapshotDate = today - 7 日 を受け入れて保存する', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const past = offsetDaysISO(-7)

    const result = await caller.record({
      taskId:       task.id,
      snapshotDate: past,
      progressPct:  40,
      acDays:       2.0,
    })

    expect(result.snapshotDate).toBe(past)
    expect(result.progressPct).toBe(40)
  })
})

describe('progress.record — 未来日付 reject (Req 2.6)', () => {
  it('snapshotDate = today + 1 日 で BAD_REQUEST + cause.code === SNAP_FUTURE_DATE', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const future = offsetDaysISO(1)

    await expect(
      caller.record({
        taskId:       task.id,
        snapshotDate: future,
        progressPct:  10,
        acDays:       0,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    let caught: unknown
    try {
      await caller.record({
        taskId:       task.id,
        snapshotDate: future,
        progressPct:  10,
        acDays:       0,
      })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(TRPCError)
    const trpcErr = caught as TRPCError
    expect(trpcErr.cause).toBeDefined()
    const cause = trpcErr.cause as { code?: string }
    expect(cause.code).toBe('SNAP_FUTURE_DATE')

    // DB に書き込まれていないこと
    const all = await db.select().from(schema.progressSnapshots)
    expect(all).toHaveLength(0)
  })
})

describe('progress.record — タスク未存在 (Req 2.8)', () => {
  it('存在しない taskId で NOT_FOUND + cause.code === SNAP_TASK_NOT_FOUND', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    await expect(
      caller.record({
        taskId:       99999,
        snapshotDate: todayISO(),
        progressPct:  50,
        acDays:       0,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    let caught: unknown
    try {
      await caller.record({
        taskId:       99999,
        snapshotDate: todayISO(),
        progressPct:  50,
        acDays:       0,
      })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(TRPCError)
    const trpcErr = caught as TRPCError
    expect(trpcErr.cause).toBeDefined()
    const cause = trpcErr.cause as { code?: string }
    expect(cause.code).toBe('SNAP_TASK_NOT_FOUND')
  })
})

describe('progress.record — note バリデーション (Req 1.4, 2.7)', () => {
  it('note 1001 文字で BAD_REQUEST（Zod max(1000)）', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const longNote = 'a'.repeat(1001)

    await expect(
      caller.record({
        taskId:       task.id,
        snapshotDate: '2026-05-01',
        progressPct:  50,
        acDays:       3.0,
        note:         longNote,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('note 1000 文字は受け入れる（境界値）', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const boundary = 'a'.repeat(1000)

    const result = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  50,
      acDays:       3.0,
      note:         boundary,
    })

    expect(result.note).toBe(boundary)
    expect(result.note!.length).toBe(1000)
  })
})

describe('progress.record — note 正規化 (Req 1.5, 1.6)', () => {
  it("note: '' は DB に NULL として保存される (Req 1.6)", async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const result = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  50,
      acDays:       3.0,
      note:         '',
    })

    expect(result.note).toBeNull()

    const rows = await db
      .select()
      .from(schema.progressSnapshots)
      .where(eq(schema.progressSnapshots.id, result.id))
    expect(rows[0]!.note).toBeNull()
  })

  it('note: null は DB に NULL として保存される (Req 1.5)', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const result = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  50,
      acDays:       3.0,
      note:         null,
    })

    expect(result.note).toBeNull()

    const rows = await db
      .select()
      .from(schema.progressSnapshots)
      .where(eq(schema.progressSnapshots.id, result.id))
    expect(rows[0]!.note).toBeNull()
  })

  it('note 未指定（undefined）は DB に NULL として保存される (Req 1.5)', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const result = await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  50,
      acDays:       3.0,
    })

    expect(result.note).toBeNull()
  })
})

describe('progress.record — Zod バリデーション (Req 2.2, 2.3)', () => {
  it('progressPct = 101 で BAD_REQUEST (Req 2.2)', async () => {
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

  it('progressPct = -1 で BAD_REQUEST (Req 2.2)', async () => {
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

  it('acDays = -1 で BAD_REQUEST (Req 2.3)', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    await expect(
      caller.record({
        taskId:       task.id,
        snapshotDate: '2026-05-01',
        progressPct:  50,
        acDays:       -1,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// progress.getLatest
// ══════════════════════════════════════════════════════════════════════════════

describe('progress.getLatest — 1 件返却 (Req 3.1, 3.4)', () => {
  it('同一タスクに 3 日分保存 → 最大 snapshotDate の 1 件を返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    await caller.record({ taskId: task.id, snapshotDate: '2026-05-01', progressPct: 20, acDays: 1.0 })
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-10', progressPct: 70, acDays: 6.0, note: 'latest' })
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-05', progressPct: 50, acDays: 3.5 })

    const result = await caller.getLatest({ taskId: task.id })

    expect(result).not.toBeNull()
    expect(result!.snapshotDate).toBe('2026-05-10')
    expect(result!.progressPct).toBe(70)
    expect(result!.acDays).toBe(6.0)
    expect(result!.note).toBe('latest')
    expect(result!.taskId).toBe(task.id)
    expect(result!.id).toBeTypeOf('number')
    expect(result!.createdAt).toBeDefined()
  })
})

describe('progress.getLatest — null (Req 3.2, 3.3)', () => {
  it('スナップショット未記録タスクで null を返す (Req 3.2)', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const result = await caller.getLatest({ taskId: task.id })
    expect(result).toBeNull()
  })

  it('未存在 taskId で null を返す (Req 3.3)', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const result = await caller.getLatest({ taskId: 99999 })
    expect(result).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// progress.getByDate
// ══════════════════════════════════════════════════════════════════════════════

describe('progress.getByDate — フィルタ + ソート (Req 4.1, 4.2, 4.4)', () => {
  it('指定日付のスナップショットのみを taskId 昇順で返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const taskA   = await seedTask(db, project.id, { name: 'Task A' })
    const taskB   = await seedTask(db, project.id, { name: 'Task B' })
    const taskC   = await seedTask(db, project.id, { name: 'Task C' })

    // taskC, taskA, taskB の順で 5/01 に記録（ソート検証）
    await caller.record({ taskId: taskC.id, snapshotDate: '2026-05-01', progressPct: 30, acDays: 2.0 })
    await caller.record({ taskId: taskA.id, snapshotDate: '2026-05-01', progressPct: 10, acDays: 1.0 })
    await caller.record({ taskId: taskB.id, snapshotDate: '2026-05-01', progressPct: 20, acDays: 1.5 })

    // 別日付（5/02）は結果に含めない
    await caller.record({ taskId: taskA.id, snapshotDate: '2026-05-02', progressPct: 15, acDays: 1.2 })

    const result = await caller.getByDate({
      projectId:    project.id,
      snapshotDate: '2026-05-01',
    })

    expect(result).toHaveLength(3)
    // taskId 昇順
    expect(result[0]!.taskId).toBe(taskA.id)
    expect(result[1]!.taskId).toBe(taskB.id)
    expect(result[2]!.taskId).toBe(taskC.id)
    // すべて指定日付
    expect(result.every((s) => s.snapshotDate === '2026-05-01')).toBe(true)
  })
})

describe('progress.getByDate — 未存在 projectId (Req 4.3)', () => {
  it('未存在 projectId で空配列を返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const result = await caller.getByDate({
      projectId:    99999,
      snapshotDate: '2026-05-01',
    })
    expect(result).toEqual([])
  })

  it('指定日付に記録がない場合も空配列を返す (Req 4.2)', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    await caller.record({ taskId: task.id, snapshotDate: '2026-05-01', progressPct: 30, acDays: 2.0 })

    const result = await caller.getByDate({
      projectId:    project.id,
      snapshotDate: '2026-05-02',
    })
    expect(result).toEqual([])
  })
})

describe('progress.getByDate — note を含む (Req 4.5)', () => {
  it('戻り値の各要素に note フィールドが含まれる', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const taskA   = await seedTask(db, project.id, { name: 'Task A' })
    const taskB   = await seedTask(db, project.id, { name: 'Task B' })

    await caller.record({
      taskId:       taskA.id,
      snapshotDate: '2026-05-01',
      progressPct:  30,
      acDays:       2.0,
      note:         'A のメモ',
    })
    await caller.record({
      taskId:       taskB.id,
      snapshotDate: '2026-05-01',
      progressPct:  40,
      acDays:       2.5,
      // note 未指定 → NULL
    })

    const result = await caller.getByDate({
      projectId:    project.id,
      snapshotDate: '2026-05-01',
    })

    expect(result).toHaveLength(2)
    const snapA = result.find((s) => s.taskId === taskA.id)
    const snapB = result.find((s) => s.taskId === taskB.id)
    expect(snapA).toBeDefined()
    expect(snapB).toBeDefined()
    expect(snapA!.note).toBe('A のメモ')
    expect(snapB!.note).toBeNull()
    // その他フィールドも含む（Req 4.5）
    expect(snapA!.id).toBeTypeOf('number')
    expect(snapA!.createdAt).toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// progress.getByDateRange
// ══════════════════════════════════════════════════════════════════════════════

describe('progress.getByDateRange — 期間フィルタ (Req 4.5.1)', () => {
  it('[startDate, endDate] 内（両端含む）のスナップショットのみを返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    // 範囲外 (前)
    await caller.record({ taskId: task.id, snapshotDate: '2026-04-30', progressPct: 10, acDays: 0.5 })
    // 範囲内（開始端）
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-01', progressPct: 20, acDays: 1.0 })
    // 範囲内
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-05', progressPct: 50, acDays: 3.0 })
    // 範囲内（終了端）
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-10', progressPct: 80, acDays: 6.0 })
    // 範囲外 (後)
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-11', progressPct: 85, acDays: 6.5 })

    const result = await caller.getByDateRange({
      projectId: project.id,
      startDate: '2026-05-01',
      endDate:   '2026-05-10',
    })

    expect(result).toHaveLength(3)
    const dates = result.map((s) => s.snapshotDate)
    expect(dates).toEqual(['2026-05-01', '2026-05-05', '2026-05-10'])
  })
})

describe('progress.getByDateRange — ソート (Req 4.5.4)', () => {
  it('snapshotDate ASC → taskId ASC でソートされる', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const taskA   = await seedTask(db, project.id, { name: 'Task A' })
    const taskB   = await seedTask(db, project.id, { name: 'Task B' })
    const taskC   = await seedTask(db, project.id, { name: 'Task C' })

    // ランダムな順で投入
    await caller.record({ taskId: taskC.id, snapshotDate: '2026-05-05', progressPct: 30, acDays: 2.0 })
    await caller.record({ taskId: taskA.id, snapshotDate: '2026-05-05', progressPct: 10, acDays: 1.0 })
    await caller.record({ taskId: taskB.id, snapshotDate: '2026-05-01', progressPct: 20, acDays: 1.5 })
    await caller.record({ taskId: taskA.id, snapshotDate: '2026-05-01', progressPct: 15, acDays: 1.2 })
    await caller.record({ taskId: taskB.id, snapshotDate: '2026-05-05', progressPct: 25, acDays: 1.8 })

    const result = await caller.getByDateRange({
      projectId: project.id,
      startDate: '2026-05-01',
      endDate:   '2026-05-10',
    })

    expect(result).toHaveLength(5)
    // snapshotDate ASC, taskId ASC
    expect(result[0]).toMatchObject({ snapshotDate: '2026-05-01', taskId: taskA.id })
    expect(result[1]).toMatchObject({ snapshotDate: '2026-05-01', taskId: taskB.id })
    expect(result[2]).toMatchObject({ snapshotDate: '2026-05-05', taskId: taskA.id })
    expect(result[3]).toMatchObject({ snapshotDate: '2026-05-05', taskId: taskB.id })
    expect(result[4]).toMatchObject({ snapshotDate: '2026-05-05', taskId: taskC.id })
  })
})

describe('progress.getByDateRange — 軽量ペイロード (Req 4.5.3)', () => {
  it('各要素が { taskId, snapshotDate, progressPct, acDays } の 4 フィールドのみ', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    await caller.record({
      taskId:       task.id,
      snapshotDate: '2026-05-01',
      progressPct:  50,
      acDays:       3.5,
      note:         '内部メモ（含まれてはいけない）',
    })

    const result = await caller.getByDateRange({
      projectId: project.id,
      startDate: '2026-05-01',
      endDate:   '2026-05-01',
    })

    expect(result).toHaveLength(1)
    const row = result[0]!

    // 4 フィールドのみ
    const keys = Object.keys(row).sort()
    expect(keys).toEqual(['acDays', 'progressPct', 'snapshotDate', 'taskId'])

    // 値検証
    expect(row.taskId).toBe(task.id)
    expect(row.snapshotDate).toBe('2026-05-01')
    expect(row.progressPct).toBe(50)
    expect(row.acDays).toBe(3.5)

    // note, id, createdAt は含まれない
    expect(row).not.toHaveProperty('note')
    expect(row).not.toHaveProperty('id')
    expect(row).not.toHaveProperty('createdAt')
    expect(row).not.toHaveProperty('updatedAt')
    expect(row).not.toHaveProperty('pvDays')
    expect(row).not.toHaveProperty('evDays')
  })
})

describe('progress.getByDateRange — 逆転日付 (Req 4.5.6)', () => {
  it('startDate > endDate で空配列を返す（エラーは投げない）', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    await caller.record({ taskId: task.id, snapshotDate: '2026-05-05', progressPct: 50, acDays: 3.0 })

    const result = await caller.getByDateRange({
      projectId: project.id,
      startDate: '2026-05-10',
      endDate:   '2026-05-01',
    })

    expect(result).toEqual([])
  })
})

describe('progress.getByDateRange — 未存在 projectId (Req 4.5.5)', () => {
  it('未存在 projectId で空配列を返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const result = await caller.getByDateRange({
      projectId: 99999,
      startDate: '2026-05-01',
      endDate:   '2026-05-10',
    })

    expect(result).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// progress.getHistory
// ══════════════════════════════════════════════════════════════════════════════

describe('progress.getHistory — 昇順 (Req 5.1, 5.3)', () => {
  it('複数スナップショットが snapshotDate 昇順で返り、フル ProgressSnapshot を含む', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    // 順不同で投入
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-10', progressPct: 70, acDays: 6.0, note: 'c' })
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-01', progressPct: 20, acDays: 1.0, note: 'a' })
    await caller.record({ taskId: task.id, snapshotDate: '2026-05-05', progressPct: 50, acDays: 3.5, note: 'b' })

    const result = await caller.getHistory({ taskId: task.id })

    expect(result).toHaveLength(3)
    expect(result[0]!.snapshotDate).toBe('2026-05-01')
    expect(result[1]!.snapshotDate).toBe('2026-05-05')
    expect(result[2]!.snapshotDate).toBe('2026-05-10')

    // フルフィールド (Req 5.3)
    expect(result[0]!.id).toBeTypeOf('number')
    expect(result[0]!.taskId).toBe(task.id)
    expect(result[0]!.progressPct).toBe(20)
    expect(result[0]!.acDays).toBe(1.0)
    expect(result[0]!.note).toBe('a')
    expect(result[0]!.createdAt).toBeDefined()
  })
})

describe('progress.getHistory — 空配列 (Req 5.2)', () => {
  it('未存在 taskId で空配列を返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const result = await caller.getHistory({ taskId: 99999 })
    expect(result).toEqual([])
  })

  it('スナップショット未記録の既存タスクでも空配列を返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const task    = await seedTask(db, project.id)

    const result = await caller.getHistory({ taskId: task.id })
    expect(result).toEqual([])
  })
})
