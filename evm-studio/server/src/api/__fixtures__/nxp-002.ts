/**
 * Task 9.1: NXP-002 統合テスト用フィクスチャ
 *
 * `mockup/projects-data.jsx` の `PROJECT_DATA[0]` (NXP-002) 相当の
 * プロジェクト・メンバー・タスク・スナップショット・休日を テスト DB に投入する。
 *
 * 設計上の決定:
 * - `seeds/mockup-projects.ts` の NXP-002 定義と同一の estimateDays / planned 日付を
 *   使用する（突き合わせ性の確保）。
 * - スナップショットは baseDate=2026-05-13 と前営業日 (2026-05-12) の 2 日分に加え、
 *   spiTrend を意味のある時系列で評価できるよう 2026-04-01 から 2026-05-13 まで
 *   週次の地点で生成する。
 * - 進捗値はモックアップ `tasks[*].progress` を採用する。これにより
 *   `summary.spi` / `cpi` がモックアップ期待値の近傍に収まる。
 * - acDays は estimateDays * (progressPct / 100) * (1 / cpi期待値≒1.04) で
 *   割り戻して採用する。プロジェクト全体の cpi を ~1.04 に揃えるため、
 *   葉タスクごとに `evDays / 1.04` を acDays として割り当てる。
 * - 前日 (2026-05-12) の進捗はモックアップ `prevDay.tasks` を反映する。
 *   prevDay に列挙されていないタスクは前日も同じ進捗を持つものとする
 *   （= baseDate 時点と同じ snapshot を 2026-05-12 にも記録する）。
 *
 * 公開関数:
 * - `insertNxp002Fixture(db)`: フィクスチャを投入し、project.id を返す。
 * - `NXP_002_BASE_DATE` / `NXP_002_PREV_DATE` / `NXP_002_EXPECTED`: テスト本体から
 *   参照する定数（モックアップ期待値）。
 */

import type { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema.js'

// ── 公開定数 ────────────────────────────────────────────────────────────

export const NXP_002_START_DATE = '2026-03-15'
export const NXP_002_END_DATE   = '2026-06-26'

/** モックアップ baseDay = 59 に相当する日付（startISO + 59 日） */
export const NXP_002_BASE_DATE = '2026-05-13'
/** モックアップ prevDay 想定。2026-05-13 の前営業日（祝日なしのため 2026-05-12） */
export const NXP_002_PREV_DATE = '2026-05-12'

/**
 * モックアップ `PROJECT_DATA[0].summary` の期待値（円建ては比率に効かないので
 * SPI / CPI / SPI delta の数値のみを採用）。
 */
export const NXP_002_EXPECTED = {
  summary: {
    spi:      0.96,
    cpi:      1.04,
    spiDelta: 0.02,
  },
} as const

// ── 型 ──────────────────────────────────────────────────────────────────

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

// ── 内部ユーティリティ ─────────────────────────────────────────────────

/** 'YYYY-MM-DD' を UTC ベースで `offsetDays` 日進めて 'YYYY-MM-DD' を返す */
function addDays(startISO: string, offsetDays: number): string {
  const [yearStr, monthStr, dayStr] = startISO.split('-')
  const year  = Number(yearStr)
  const month = Number(monthStr)
  const day   = Number(dayStr)
  const base  = Date.UTC(year, month - 1, day)
  const next  = new Date(base + offsetDays * 24 * 60 * 60 * 1000)
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── タスク定義（startOffset / endOffset は startISO 基準の日数） ──────

/**
 * モックアップ `tasks[]` の転記。`code` は外部 ID として保持し、parent 解決と
 * leaf/buffer フラグ・assignee 解決に使う。
 *
 * 進捗 (`progress` / `prevProgress`) は SPI / CPI を評価可能にするためのもので、
 * モックアップの `tasks[].progress` / `prevDay.tasks[].progress` を採用する。
 */
type FixtureTask = {
  code:           string  // モックアップ code（"1", "1.1", ..., "B"）
  name:           string
  level:          number
  estimateDays:   number
  startOffset:    number
  endOffset:      number
  parentCode:     string | null
  assigneeExtId:  string | null  // モックアップ member.id を "M{n}" 形式に変換
  isBuffer:       boolean
  isLeaf:         boolean
  sortOrder:      number
  /** baseDate=2026-05-13 時点の進捗 (%) */
  progress:       number
  /** prevDate=2026-05-12 時点の進捗 (%)。葉タスクのみ意味を持つ */
  prevProgress:   number
}

const TASKS: FixtureTask[] = [
  // 1. 要件定義（完了）
  { code:'1',   name:'要件定義',                level:1, estimateDays:14, startOffset:  0, endOffset: 14, parentCode:null, assigneeExtId:null,  isBuffer:false, isLeaf:false, sortOrder: 0, progress:100, prevProgress:100 },
  { code:'1.1', name:'ユースケース整理',         level:2, estimateDays: 9, startOffset:  0, endOffset:  9, parentCode:'1',  assigneeExtId:'M1', isBuffer:false, isLeaf:true,  sortOrder: 1, progress:100, prevProgress:100 },
  { code:'1.2', name:'ステークホルダーレビュー', level:2, estimateDays: 6, startOffset:  8, endOffset: 14, parentCode:'1',  assigneeExtId:'M1', isBuffer:false, isLeaf:true,  sortOrder: 2, progress:100, prevProgress:100 },

  // 2. 設計
  { code:'2',   name:'設計',                    level:1, estimateDays:26, startOffset: 12, endOffset: 38, parentCode:null, assigneeExtId:null,  isBuffer:false, isLeaf:false, sortOrder: 3, progress: 92, prevProgress: 92 },
  { code:'2.1', name:'アーキテクチャ設計',       level:2, estimateDays:12, startOffset: 12, endOffset: 24, parentCode:'2',  assigneeExtId:'M2', isBuffer:false, isLeaf:true,  sortOrder: 4, progress:100, prevProgress:100 },
  { code:'2.2', name:'データモデル設計',         level:2, estimateDays:14, startOffset: 18, endOffset: 32, parentCode:'2',  assigneeExtId:'M3', isBuffer:false, isLeaf:true,  sortOrder: 5, progress: 95, prevProgress: 91 },
  { code:'2.3', name:'UIデザインシステム整備',   level:2, estimateDays:18, startOffset: 20, endOffset: 38, parentCode:'2',  assigneeExtId:'M4', isBuffer:false, isLeaf:true,  sortOrder: 6, progress: 88, prevProgress: 83 },

  // 3. 実装
  { code:'3',   name:'実装',                    level:1, estimateDays:48, startOffset: 30, endOffset: 78, parentCode:null, assigneeExtId:null,  isBuffer:false, isLeaf:false, sortOrder: 7, progress: 46, prevProgress: 46 },
  { code:'3.1', name:'API実装',                 level:2, estimateDays:32, startOffset: 30, endOffset: 62, parentCode:'3',  assigneeExtId:'M2', isBuffer:false, isLeaf:true,  sortOrder: 8, progress: 72, prevProgress: 68 },
  { code:'3.2', name:'フロント実装',             level:2, estimateDays:36, startOffset: 36, endOffset: 72, parentCode:'3',  assigneeExtId:'M3', isBuffer:false, isLeaf:true,  sortOrder: 9, progress: 58, prevProgress: 54 },
  { code:'3.3', name:'デザイン適用',             level:2, estimateDays:34, startOffset: 44, endOffset: 78, parentCode:'3',  assigneeExtId:'M4', isBuffer:false, isLeaf:true,  sortOrder:10, progress: 40, prevProgress: 36 },

  // 4. 検証
  { code:'4',   name:'検証',                    level:1, estimateDays:35, startOffset: 60, endOffset: 95, parentCode:null, assigneeExtId:null,  isBuffer:false, isLeaf:false, sortOrder:11, progress:  8, prevProgress:  5 },
  { code:'4.1', name:'結合テスト計画書レビュー', level:2, estimateDays:10, startOffset: 60, endOffset: 70, parentCode:'4',  assigneeExtId:'M5', isBuffer:false, isLeaf:true,  sortOrder:12, progress: 18, prevProgress: 12 },
  { code:'4.2', name:'受入テスト',               level:2, estimateDays:17, startOffset: 78, endOffset: 95, parentCode:'4',  assigneeExtId:'M6', isBuffer:false, isLeaf:true,  sortOrder:13, progress:  0, prevProgress:  0 },

  // バッファ
  { code:'B',   name:'プロジェクトバッファ',     level:1, estimateDays: 8, startOffset: 95, endOffset:103, parentCode:null, assigneeExtId:null,  isBuffer:true,  isLeaf:true,  sortOrder:14, progress:  0, prevProgress:  0 },
]

// ── メンバー定義 ───────────────────────────────────────────────────────

const MEMBERS = [
  { externalId: 'M1', name: '田中 美咲',   role: 'PM',       initials: '田美' },
  { externalId: 'M2', name: '佐藤 拓海',   role: 'Lead Eng', initials: '佐拓' },
  { externalId: 'M3', name: '鈴木 蒼一郎', role: 'Engineer', initials: '鈴蒼' },
  { externalId: 'M4', name: '山本 楓',     role: 'Designer', initials: '山楓' },
  { externalId: 'M5', name: '中村 葵',     role: 'QA',       initials: '中葵' },
  { externalId: 'M6', name: '高橋 直樹',   role: 'Engineer', initials: '高直' },
] as const

// ── 公開関数 ────────────────────────────────────────────────────────────

/**
 * NXP-002 フィクスチャを test DB に投入する。
 *
 * @returns 投入された project.id（テストから `caller.calculate({ projectId })` で利用する）
 */
export async function insertNxp002Fixture(db: DrizzleDb): Promise<{
  projectId: number
  memberIdByExternalId: Map<string, number>
  taskIdByCode: Map<string, number>
}> {
  // 1) project
  const projectRow = (
    await db
      .insert(schema.projects)
      .values({
        name:      '次世代UI基盤刷新 — Phase 2',
        status:    'active',
        code:      'NXP-002',
        startDate: NXP_002_START_DATE,
        endDate:   NXP_002_END_DATE,
      })
      .returning()
  )[0]!
  const projectId = projectRow.id

  // 2) members
  const memberIdByExternalId = new Map<string, number>()
  for (const m of MEMBERS) {
    const row = (
      await db
        .insert(schema.members)
        .values({
          projectId,
          externalId:       m.externalId,
          name:             m.name,
          role:             m.role,
          initials:         m.initials,
          availabilityRate: 1.0,
          assignmentStart:  NXP_002_START_DATE,
          assignmentEnd:    NXP_002_END_DATE,
        })
        .returning()
    )[0]!
    memberIdByExternalId.set(m.externalId, row.id)
  }

  // 3) tasks (sortOrder 順 ⇒ 親が先に出現する)
  const taskIdByCode = new Map<string, number>()
  const sortedTasks = [...TASKS].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const t of sortedTasks) {
    const parentId = t.parentCode !== null ? taskIdByCode.get(t.parentCode) ?? null : null
    const assigneeId =
      t.assigneeExtId !== null ? memberIdByExternalId.get(t.assigneeExtId) ?? null : null

    const row = (
      await db
        .insert(schema.tasks)
        .values({
          projectId,
          externalId:   t.code,
          name:         t.name,
          estimateDays: t.estimateDays,
          plannedStart: addDays(NXP_002_START_DATE, t.startOffset),
          plannedEnd:   addDays(NXP_002_START_DATE, t.endOffset),
          parentId,
          assigneeId,
          level:        t.level,
          sortOrder:    t.sortOrder,
          isBuffer:     t.isBuffer,
          isLeaf:       t.isLeaf,
        })
        .returning()
    )[0]!
    taskIdByCode.set(t.code, row.id)
  }

  // 4) progress snapshots
  //    SPI/CPI を評価可能にするため、葉タスクごとに以下を記録する:
  //      - baseDate (2026-05-13): progressPct = task.progress, acDays = ev / 1.04
  //      - prevDate (2026-05-12): progressPct = task.prevProgress, acDays = prevEv / 1.04
  //      - spiTrend 用に 2026-04-01 / 04-08 / 04-15 / 04-22 / 04-29 / 05-04 / 05-08 の
  //        週次地点でも進捗をスケール反映する（baseDate 値を線形補間したもの）
  //
  //    cpi = ev / ac を ~1.04 に揃えるため、acDays = evDays / 1.04 を採用する。
  const CPI_TARGET = 1.04

  // spiTrend 用の補助日付（2026-05-13 baseDate に向けて progress を線形補間する）
  const TREND_DATES: string[] = [
    '2026-04-01',
    '2026-04-08',
    '2026-04-15',
    '2026-04-22',
    '2026-04-29',
    '2026-05-04',
    '2026-05-08',
  ]
  // 各 trend 日付の progress スケーリング係数（baseDate=1.00 になる）
  // モックアップの spiTrend 推移 (0.84 → 0.96) と整合させ、baseDate 寄りほど大きい値を取る。
  const TREND_FACTOR_BY_DATE: ReadonlyMap<string, number> = new Map([
    ['2026-04-01', 0.55],
    ['2026-04-08', 0.65],
    ['2026-04-15', 0.72],
    ['2026-04-22', 0.80],
    ['2026-04-29', 0.86],
    ['2026-05-04', 0.91],
    ['2026-05-08', 0.95],
  ])

  for (const t of TASKS) {
    if (t.isBuffer) continue
    if (!t.isLeaf) continue
    const taskId = taskIdByCode.get(t.code)!

    // baseDate 時点 (2026-05-13)
    const evBase = t.estimateDays * (t.progress / 100)
    const acBase = evBase > 0 ? evBase / CPI_TARGET : 0
    await db.insert(schema.progressSnapshots).values({
      taskId,
      snapshotDate: NXP_002_BASE_DATE,
      progressPct:  t.progress,
      pvDays:       0,
      evDays:       0,
      acDays:       acBase,
    })

    // prevDate 時点 (2026-05-12)
    const evPrev = t.estimateDays * (t.prevProgress / 100)
    const acPrev = evPrev > 0 ? evPrev / CPI_TARGET : 0
    if (t.prevProgress !== t.progress) {
      // baseDate と進捗が異なる場合は別 snapshot として記録する
      await db.insert(schema.progressSnapshots).values({
        taskId,
        snapshotDate: NXP_002_PREV_DATE,
        progressPct:  t.prevProgress,
        pvDays:       0,
        evDays:       0,
        acDays:       acPrev,
      })
    } else if (t.prevProgress > 0) {
      // 進捗が baseDate と同じでも、prevDate 用のサマリーが計算できるように
      // 同値の snapshot を別日付で記録する（unique index は (taskId, snapshotDate)）。
      await db.insert(schema.progressSnapshots).values({
        taskId,
        snapshotDate: NXP_002_PREV_DATE,
        progressPct:  t.prevProgress,
        pvDays:       0,
        evDays:       0,
        acDays:       acPrev,
      })
    }

    // spiTrend 用の週次地点 (2026-04-01 〜 2026-05-08)
    //   baseDate 進捗を factor で割り戻したものを記録する。
    //   plannedStart より前の日付では progress=0 のため snapshot を作らない。
    const taskStart = addDays(NXP_002_START_DATE, t.startOffset)
    for (const d of TREND_DATES) {
      if (d < taskStart) continue
      const factor = TREND_FACTOR_BY_DATE.get(d) ?? 0
      const trendProgress = Math.min(t.progress * factor, 100)
      if (trendProgress <= 0) continue
      const evTrend = t.estimateDays * (trendProgress / 100)
      const acTrend = evTrend > 0 ? evTrend / CPI_TARGET : 0
      await db.insert(schema.progressSnapshots).values({
        taskId,
        snapshotDate: d,
        progressPct:  trendProgress,
        pvDays:       0,
        evDays:       0,
        acDays:       acTrend,
      })
    }
  }

  return { projectId, memberIdByExternalId, taskIdByCode }
}

/**
 * NXP-002 のうち、スナップショットを一切作らないバリエーション。
 * `prevDay === null` のケースを検証するために使用する。
 *
 * baseDate を `project.startDate` と同じにすることで、`calculatePrevDate` の戻り値
 * (= 前営業日) が必ず `project.startDate` より前になり、`hasPrevSnapshots === false`
 * を確実に満たす。
 */
export async function insertNxp002FixtureWithoutSnapshots(db: DrizzleDb): Promise<{
  projectId: number
}> {
  const projectRow = (
    await db
      .insert(schema.projects)
      .values({
        name:      '次世代UI基盤刷新 — Phase 2',
        status:    'active',
        code:      'NXP-002',
        startDate: NXP_002_START_DATE,
        endDate:   NXP_002_END_DATE,
      })
      .returning()
  )[0]!
  const projectId = projectRow.id

  const memberIdByExternalId = new Map<string, number>()
  for (const m of MEMBERS) {
    const row = (
      await db
        .insert(schema.members)
        .values({
          projectId,
          externalId:       m.externalId,
          name:             m.name,
          role:             m.role,
          initials:         m.initials,
          availabilityRate: 1.0,
          assignmentStart:  NXP_002_START_DATE,
          assignmentEnd:    NXP_002_END_DATE,
        })
        .returning()
    )[0]!
    memberIdByExternalId.set(m.externalId, row.id)
  }

  const taskIdByCode = new Map<string, number>()
  const sortedTasks = [...TASKS].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const t of sortedTasks) {
    const parentId = t.parentCode !== null ? taskIdByCode.get(t.parentCode) ?? null : null
    const assigneeId =
      t.assigneeExtId !== null ? memberIdByExternalId.get(t.assigneeExtId) ?? null : null
    const row = (
      await db
        .insert(schema.tasks)
        .values({
          projectId,
          externalId:   t.code,
          name:         t.name,
          estimateDays: t.estimateDays,
          plannedStart: addDays(NXP_002_START_DATE, t.startOffset),
          plannedEnd:   addDays(NXP_002_START_DATE, t.endOffset),
          parentId,
          assigneeId,
          level:        t.level,
          sortOrder:    t.sortOrder,
          isBuffer:     t.isBuffer,
          isLeaf:       t.isLeaf,
        })
        .returning()
    )[0]!
    taskIdByCode.set(t.code, row.id)
  }

  return { projectId }
}
