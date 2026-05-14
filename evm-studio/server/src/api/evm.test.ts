/**
 * Task 6.1: evm.calculate tRPC router unit tests (Vitest)
 * Requirements: dashboard feature
 *
 * Test cases:
 * 1. 正常系（全フィールド返却）
 * 2. プロジェクト未存在 → NOT_FOUND
 * 3. baseDate フォーマット不正 → BAD_REQUEST
 * 4. バッファなし → feverChart null
 * 5. SPI < 0.8 → critical アラートが生成される
 * 6. 0.8 ≤ SPI < 0.9 → warning アラートが生成される
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { TRPCError } from '@trpc/server'
import * as schema from '../db/schema.js'
import { createEvmRouter } from './evm.js'

// ── Test DB setup ──────────────────────────────────────────────────────────────

type TestDb = ReturnType<typeof drizzle<typeof schema>>

function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './src/db/migrations' })
  return db
}

function makeCaller(db: TestDb) {
  return createEvmRouter(db).createCaller({})
}

// ── Seed helpers ───────────────────────────────────────────────────────────────

async function seedProject(db: TestDb, overrides?: Partial<schema.NewProject>) {
  const rows = await db
    .insert(schema.projects)
    .values({
      name:      'Test Project',
      startDate: '2020-01-01',
      endDate:   '2020-12-31',
      ...overrides,
    })
    .returning()
  return rows[0]!
}

async function seedMember(db: TestDb, projectId: number, overrides?: Partial<schema.NewMember>) {
  const rows = await db
    .insert(schema.members)
    .values({
      projectId,
      name:             'Test Member',
      availabilityRate: 1.0,
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
      plannedStart: '2020-01-01',
      plannedEnd:   '2020-12-31',
      isLeaf:       true,
      isBuffer:     false,
      ...overrides,
    })
    .returning()
  return rows[0]!
}

async function seedSnapshot(
  db: TestDb,
  taskId: number,
  snapshotDate: string,
  progressPct: number,
  acDays = 0,
) {
  const rows = await db
    .insert(schema.progressSnapshots)
    .values({
      taskId,
      snapshotDate,
      progressPct,
      acDays,
      pvDays: 0,
      evDays: 0,
    })
    .returning()
  return rows[0]!
}

// ── Test 1: 正常系（全フィールド返却） ─────────────────────────────────────────

describe('evm.calculate — 正常系（全フィールド返却）', () => {
  it('必要なフィールドがすべて返却される', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const member  = await seedMember(db, project.id)
    await seedTask(db, project.id, { assigneeId: member.id })

    const result = await caller.calculate({
      projectId: project.id,
      baseDate:  '2020-06-01',
    })

    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('assignees')
    expect(result).toHaveProperty('alerts')
    expect(result).toHaveProperty('feverChart')
    expect(result).toHaveProperty('spiTrend')
    expect(result).toHaveProperty('gantt')

    // summary にも必要なフィールドが存在する
    expect(result.summary).toHaveProperty('bac')
    expect(result.summary).toHaveProperty('pv')
    expect(result.summary).toHaveProperty('ev')
    expect(result.summary).toHaveProperty('ac')
    expect(result.summary).toHaveProperty('spi')
    expect(result.summary).toHaveProperty('cpi')
  })
})

// ── Test 2: プロジェクト未存在 → NOT_FOUND ─────────────────────────────────────

describe('evm.calculate — プロジェクト未存在', () => {
  it('存在しない projectId で NOT_FOUND エラーを返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    await expect(
      caller.calculate({
        projectId: 99999,
        baseDate:  '2020-06-01',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // TRPCError インスタンスであることを確認
    let caughtError: unknown
    try {
      await caller.calculate({
        projectId: 99999,
        baseDate:  '2020-06-01',
      })
    } catch (e) {
      caughtError = e
    }
    expect(caughtError).toBeInstanceOf(TRPCError)
    const trpcErr = caughtError as TRPCError
    expect(trpcErr.code).toBe('NOT_FOUND')
  })
})

// ── Test 3: baseDate フォーマット不正 → BAD_REQUEST ────────────────────────────

describe('evm.calculate — baseDate フォーマット不正', () => {
  it('YYYY-MM-DD 形式でない baseDate で BAD_REQUEST エラーを返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)

    await expect(
      caller.calculate({
        projectId: project.id,
        baseDate:  '2020/06/01',  // スラッシュ区切り: 不正フォーマット
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('不完全な日付文字列でも BAD_REQUEST エラーを返す', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)

    await expect(
      caller.calculate({
        projectId: project.id,
        baseDate:  '20200601',  // ハイフンなし: 不正フォーマット
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

// ── Test 4: バッファなし → feverChart null ─────────────────────────────────────

describe('evm.calculate — バッファなし → feverChart null', () => {
  it('is_buffer=true のタスクが存在しないとき feverChart が null になる', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db)
    const member  = await seedMember(db, project.id)
    // バッファなし（isBuffer: false のみ）
    await seedTask(db, project.id, {
      assigneeId: member.id,
      isBuffer:   false,
    })

    const result = await caller.calculate({
      projectId: project.id,
      baseDate:  '2020-06-01',
    })

    expect(result.feverChart).toBeNull()
  })
})

// ── Test 5: SPI < 0.8 → critical アラートが生成される ─────────────────────────

describe('evm.calculate — SPI < 0.8 → critical アラート', () => {
  it('SPI が 0.8 未満のタスクで critical アラートが生成される', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    // プロジェクト: 2020年全体
    const project = await seedProject(db, {
      startDate: '2020-01-01',
      endDate:   '2020-12-31',
    })
    const member = await seedMember(db, project.id, { availabilityRate: 1.0 })

    // タスク: 2020-01-01 〜 2020-12-31、10日分 (非バッファ・リーフ)
    const task = await seedTask(db, project.id, {
      assigneeId:   member.id,
      estimateDays: 10,
      plannedStart: '2020-01-01',
      plannedEnd:   '2020-12-31',
      isBuffer:     false,
      isLeaf:       true,
    })

    // baseDate=2020-06-01 時点での PV = min(working_days * 1.0, 10)
    // 2020-01-01〜2020-06-01 は 100日以上稼働日があるため PV=10 (estimateDays に上限)
    // progressPct=10 → EV = 10 * 10/100 = 1.0
    // SPI = EV/PV = 1.0/10 = 0.1 < 0.8 → CRITICAL_DELAY → critical アラート
    await seedSnapshot(db, task.id, '2020-06-01', 10, 0)

    const result = await caller.calculate({
      projectId: project.id,
      baseDate:  '2020-06-01',
    })

    // summary の SPI が 0.8 未満であること
    expect(result.summary.spi).not.toBeNull()
    expect(result.summary.spi!).toBeLessThan(0.8)

    // alerts に少なくとも1件の critical アラートが含まれる
    const criticalAlerts = result.alerts.filter((a) => a.level === 'critical')
    expect(criticalAlerts.length).toBeGreaterThan(0)
    expect(criticalAlerts[0]!.taskId).toBe(task.id)
  })
})

// ── Test 6: 0.8 ≤ SPI < 0.9 → warning アラートが生成される ───────────────────

describe('evm.calculate — 0.8 ≤ SPI < 0.9 → warning アラート', () => {
  it('SPI が 0.8 以上 0.9 未満のタスクで warning アラートが生成される', async () => {
    const db     = createTestDb()
    const caller = makeCaller(db)

    const project = await seedProject(db, {
      startDate: '2020-01-01',
      endDate:   '2020-12-31',
    })
    const member = await seedMember(db, project.id, { availabilityRate: 1.0 })

    // タスク: estimateDays=100 で PV を大きくする
    // 2020-01-01〜2020-12-31 の計画、baseDate=2020-06-01 時点
    // PV = min(working_days * 1.0, 100) → working_days が 100 を超えるので PV=100
    // progressPct=85 → EV = 100 * 85/100 = 85
    // SPI = 85/100 = 0.85 → 0.8 ≤ SPI < 0.9 → WARNING_DELAY → warning アラート
    const task = await seedTask(db, project.id, {
      assigneeId:   member.id,
      estimateDays: 100,
      plannedStart: '2020-01-01',
      plannedEnd:   '2020-12-31',
      isBuffer:     false,
      isLeaf:       true,
    })

    await seedSnapshot(db, task.id, '2020-06-01', 85, 0)

    const result = await caller.calculate({
      projectId: project.id,
      baseDate:  '2020-06-01',
    })

    // summary の SPI が 0.8 以上 0.9 未満であること
    expect(result.summary.spi).not.toBeNull()
    expect(result.summary.spi!).toBeGreaterThanOrEqual(0.8)
    expect(result.summary.spi!).toBeLessThan(0.9)

    // alerts に少なくとも1件の warning アラートが含まれる
    const warningAlerts = result.alerts.filter((a) => a.level === 'warning')
    expect(warningAlerts.length).toBeGreaterThan(0)
    expect(warningAlerts[0]!.taskId).toBe(task.id)
  })
})
