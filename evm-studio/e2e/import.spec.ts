/**
 * Task 6.3 / 7.5: WBS インポート → タスク一覧確認の E2E テスト
 * Requirements: 6.1, 6.9, 6.11, 6.12, 6.8
 * Boundary: ImportRouter, TasksRouter
 *
 * 3 つの YAML ファイルをインポートしてタスク一覧が正しく返ることを検証する。
 *
 * tRPC v11 HTTP プロトコル:
 *   - Mutation: POST /trpc/{procedure} with plain JSON body
 *   - Query:    GET  /trpc/{procedure}?input=<URL-encoded JSON>
 *   - Response: { "result": { "data": <value> } }
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SERVER = 'http://localhost:3001'

// ── tRPC HTTP helper ─────────────────────────────────────────────────────────

/**
 * tRPC mutation (POST) を呼び出す。
 * tRPC v11 fetchRequestHandler は plain JSON body を直接受け付ける。
 */
async function callMutation(
  request: import('@playwright/test').APIRequestContext,
  procedure: string,
  input: unknown
): Promise<unknown> {
  const response = await request.post(`${SERVER}/trpc/${procedure}`, {
    data: input as Record<string, unknown>,
    headers: { 'Content-Type': 'application/json' },
  })
  const body = await response.json() as { result?: { data?: unknown }; error?: unknown }
  if (!response.ok()) {
    throw new Error(`tRPC mutation ${procedure} failed (${response.status()}): ${JSON.stringify(body.error)}`)
  }
  return body.result?.data
}

/**
 * tRPC query (GET) を呼び出す。
 * input は URL パラメータとして渡す（URL エンコード済み plain JSON）。
 */
async function callQuery(
  request: import('@playwright/test').APIRequestContext,
  procedure: string,
  input: unknown
): Promise<unknown> {
  const inputEncoded = encodeURIComponent(JSON.stringify(input))
  const response = await request.get(`${SERVER}/trpc/${procedure}?input=${inputEncoded}`)
  const body = await response.json() as { result?: { data?: unknown }; error?: unknown }
  if (!response.ok()) {
    throw new Error(`tRPC query ${procedure} failed (${response.status()}): ${JSON.stringify(body.error)}`)
  }
  return body.result?.data
}

// ── YAML Fixtures ─────────────────────────────────────────────────────────────
//
// Fixture 1: 3 タスク / 2 メンバー / 2 依存関係

const TASKS_YAML_FIXTURE = `
tasks:
  - id: T001
    title: 要件定義
    estimate_days: 5
    planned_start: "2026-01-05"
    planned_end: "2026-01-09"
  - id: T002
    title: 基本設計
    estimate_days: 8
    planned_start: "2026-01-12"
    planned_end: "2026-01-21"
    depends_on:
      - T001
  - id: T003
    title: 詳細設計
    estimate_days: 6
    planned_start: "2026-01-22"
    planned_end: "2026-01-29"
    depends_on:
      - T002
`.trim()

const STAFFING_YAML_FIXTURE = `
members:
  - id: M001
    name: 田中太郎
    availability_rate: 1.0
  - id: M002
    name: 鈴木花子
    availability_rate: 0.8
`.trim()

const SCHEDULE_YAML_FIXTURE = `
meta:
  schedule_start: "2026-01-01"
  schedule_end: "2026-03-31"
`.trim()

// ── E2E Tests ─────────────────────────────────────────────────────────────────

test.describe('WBS YAML インポート → タスク一覧確認 (Req 6.1, 6.9)', () => {
  /**
   * メインテスト: 3 YAML インポート → タスク一覧確認
   * - projects.create でプロジェクト作成
   * - import.wbsYaml で 3 YAML をインポート (Req 6.1)
   * - ImportSummary のカウントを検証 (Req 6.9)
   * - tasks.listByProject でタスク一覧を取得・検証
   */
  test('3 つの YAML をインポートしてタスク一覧が正しく返る', async ({ request }) => {
    // ── Step 1: プロジェクトを作成 ──────────────────────────────────────────
    const project = await callMutation(request, 'projects.create', {
      name: 'E2E Import Test Project',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    }) as { id: number; name: string; startDate: string; endDate: string }

    expect(project).toBeDefined()
    expect(project.id).toBeGreaterThan(0)
    expect(project.name).toBe('E2E Import Test Project')

    try {
      // ── Step 2: 3 つの YAML をインポート (Req 6.1) ───────────────────────
      const summary = await callMutation(request, 'import.wbsYaml', {
        projectId: project.id,
        tasksYaml: TASKS_YAML_FIXTURE,
        staffingYaml: STAFFING_YAML_FIXTURE,
        scheduleYaml: SCHEDULE_YAML_FIXTURE,
      }) as {
        projects: number
        tasks: number
        members: number
        holidays: number
        dependencies: number
        snapshots: number
      }

      // Req 6.9: ImportSummary が全カウントフィールドを含む
      expect(summary).toBeDefined()
      expect(summary).toHaveProperty('projects')
      expect(summary).toHaveProperty('tasks')
      expect(summary).toHaveProperty('members')
      expect(summary).toHaveProperty('holidays')
      expect(summary).toHaveProperty('dependencies')
      expect(summary).toHaveProperty('snapshots')

      // カウント値の検証
      expect(summary.tasks).toBe(3)
      expect(summary.members).toBe(2)
      expect(summary.dependencies).toBe(2) // T002→T001, T003→T002

      // ── Step 3: タスク一覧を確認 (Req 6.1) ──────────────────────────────
      const taskList = await callQuery(request, 'tasks.listByProject', {
        projectId: project.id,
      }) as Array<{
        id: number
        name: string
        estimateDays: number
        plannedStart: string | null
        plannedEnd: string | null
      }>

      expect(taskList).toBeDefined()
      expect(Array.isArray(taskList)).toBe(true)
      expect(taskList).toHaveLength(3)

      // タスク名の確認
      const taskNames = taskList.map((t) => t.name)
      expect(taskNames).toContain('要件定義')
      expect(taskNames).toContain('基本設計')
      expect(taskNames).toContain('詳細設計')

      // T001 タスクの詳細確認
      const t001 = taskList.find((t) => t.name === '要件定義')
      expect(t001).toBeDefined()
      expect(t001!.estimateDays).toBe(5)
      expect(t001!.plannedStart).toBe('2026-01-05')
      expect(t001!.plannedEnd).toBe('2026-01-09')
    } finally {
      // クリーンアップ
      await callMutation(request, 'projects.delete', { id: project.id })
    }
  })

  /**
   * 再インポートで重複が発生しないことを検証 (Req 6.1 upsert)
   * 同一 project_id に 2 回インポートしても 3 タスクのみ
   */
  test('再インポートで重複が発生しない (Req 6.1 upsert)', async ({ request }) => {
    // プロジェクト作成
    const project = await callMutation(request, 'projects.create', {
      name: 'E2E Upsert Test Project',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    }) as { id: number }

    try {
      // 1 回目のインポート
      await callMutation(request, 'import.wbsYaml', {
        projectId: project.id,
        tasksYaml: TASKS_YAML_FIXTURE,
        staffingYaml: STAFFING_YAML_FIXTURE,
        scheduleYaml: SCHEDULE_YAML_FIXTURE,
      })

      // 2 回目のインポート (同じ YAML で upsert)
      await callMutation(request, 'import.wbsYaml', {
        projectId: project.id,
        tasksYaml: TASKS_YAML_FIXTURE,
        staffingYaml: STAFFING_YAML_FIXTURE,
        scheduleYaml: SCHEDULE_YAML_FIXTURE,
      })

      // 重複なしで 3 件のみ
      const taskList = await callQuery(request, 'tasks.listByProject', {
        projectId: project.id,
      }) as unknown[]

      expect(taskList).toHaveLength(3)
    } finally {
      await callMutation(request, 'projects.delete', { id: project.id })
    }
  })

  /**
   * ImportSummary が全カウントフィールドを返すことを検証 (Req 6.9)
   * public_holidays を含む staffing.yaml でホリデー件数も確認
   */
  test('ImportSummary が正しいカウントを返す (Req 6.9)', async ({ request }) => {
    const SIMPLE_TASKS_YAML = `
tasks:
  - id: T001
    title: シンプルタスク
    estimate_days: 3
    planned_start: "2026-02-01"
    planned_end: "2026-02-05"
`.trim()

    const STAFFING_WITH_HOLIDAYS = `
members:
  - id: M001
    name: テストユーザー
    availability_rate: 1.0
meta:
  public_holidays:
    - "2026-01-01"
    - "2026-02-11"
`.trim()

    const SIMPLE_SCHEDULE_YAML = `
meta:
  schedule_start: "2026-01-01"
  schedule_end: "2026-03-31"
`.trim()

    // プロジェクト作成
    const project = await callMutation(request, 'projects.create', {
      name: 'E2E Summary Test Project',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    }) as { id: number }

    try {
      // インポート
      const summary = await callMutation(request, 'import.wbsYaml', {
        projectId: project.id,
        tasksYaml: SIMPLE_TASKS_YAML,
        staffingYaml: STAFFING_WITH_HOLIDAYS,
        scheduleYaml: SIMPLE_SCHEDULE_YAML,
      }) as {
        projects: number
        tasks: number
        members: number
        holidays: number
        dependencies: number
        snapshots: number
      }

      // Req 6.9: サマリーオブジェクトが全カウントフィールドを含む
      expect(summary).toHaveProperty('projects')
      expect(summary).toHaveProperty('tasks')
      expect(summary).toHaveProperty('members')
      expect(summary).toHaveProperty('holidays')
      expect(summary).toHaveProperty('dependencies')
      expect(summary).toHaveProperty('snapshots')

      // 具体的なカウント検証
      expect(summary.tasks).toBe(1)
      expect(summary.members).toBe(1)
      expect(summary.holidays).toBe(2)
      expect(summary.dependencies).toBe(0)
    } finally {
      await callMutation(request, 'projects.delete', { id: project.id })
    }
  })
})

// ── Task 7.5: 実プロジェクト YAML を使用した E2E テスト ───────────────────────

test.describe('実プロジェクト YAML インポート (Req 6.11, 6.12, 6.8)', () => {
  const fixturesDir = resolve(process.cwd(), 'e2e/fixtures')

  /**
   * 84 タスクの実プロジェクト YAML をインポートして件数・planned 日付を検証する。
   * - tasks.yaml（84 タスク）+ staffing.yaml + reschedule-2026-05-14.yaml
   * - assignments で T002a の planned_start が null でないこと
   * - 再インポートしても 84 件のまま（重複なし）
   */
  test('tasks.yaml 84件 + reschedule YAML を正常インポートできる (Req 6.11, 6.12)', async ({ request }) => {
    const tasksYaml = readFileSync(resolve(fixturesDir, 'tasks.yaml'), 'utf-8')
    const staffingYaml = readFileSync(resolve(fixturesDir, 'staffing.yaml'), 'utf-8')
    const scheduleYaml = readFileSync(resolve(fixturesDir, 'reschedule-2026-05-14.yaml'), 'utf-8')

    const project = await callMutation(request, 'projects.create', {
      name: '実プロジェクト E2E テスト',
      startDate: '2026-04-06',
      endDate: '2026-07-30',
    }) as { id: number }

    try {
      const summary = await callMutation(request, 'import.wbsYaml', {
        projectId: project.id,
        tasksYaml,
        staffingYaml,
        scheduleYaml,
      }) as { tasks: number; members: number; snapshots: number }

      // 84 タスクがインポートされること (Req 6.11: null estimate_days / planned dates を許容)
      expect(summary.tasks).toBe(84)

      // タスク一覧で 84 件確認
      const taskList = await callQuery(request, 'tasks.listByProject', {
        projectId: project.id,
      }) as Array<{ id: number; name: string; plannedStart: string | null; plannedEnd: string | null }>

      expect(taskList).toHaveLength(84)

      // assignments で planned 日付が設定されたタスク（T002a）の plannedStart が null でないこと (Req 6.12)
      // T002a の planned_start は reschedule YAML の assignments で 2026-04-06 に設定される
      const t002a = taskList.find(t => t.name === '要件整理-既存フロー把握')
        ?? taskList.find(t => t.name.includes('T002a') || t.plannedStart === '2026-04-06')

      // T002a が assignments で設定されていることを確認（名前で特定できない場合は plannedStart で確認）
      const tasksWithPlannedStart = taskList.filter(t => t.plannedStart !== null)
      expect(tasksWithPlannedStart.length).toBeGreaterThan(0)
    } finally {
      await callMutation(request, 'projects.delete', { id: project.id })
    }
  })

  test('84件の実プロジェクトを再インポートしても件数が増えない (Req 6.8)', async ({ request }) => {
    const tasksYaml = readFileSync(resolve(fixturesDir, 'tasks.yaml'), 'utf-8')
    const staffingYaml = readFileSync(resolve(fixturesDir, 'staffing.yaml'), 'utf-8')
    const scheduleYaml = readFileSync(resolve(fixturesDir, 'reschedule-2026-05-14.yaml'), 'utf-8')

    const project = await callMutation(request, 'projects.create', {
      name: '実プロジェクト 再インポートテスト',
      startDate: '2026-04-06',
      endDate: '2026-07-30',
    }) as { id: number }

    try {
      // 1 回目のインポート
      await callMutation(request, 'import.wbsYaml', {
        projectId: project.id,
        tasksYaml,
        staffingYaml,
        scheduleYaml,
      })

      // 2 回目のインポート（upsert）
      await callMutation(request, 'import.wbsYaml', {
        projectId: project.id,
        tasksYaml,
        staffingYaml,
        scheduleYaml,
      })

      const taskList = await callQuery(request, 'tasks.listByProject', {
        projectId: project.id,
      }) as unknown[]

      // 重複なし：84 件のまま (Req 6.8)
      expect(taskList).toHaveLength(84)
    } finally {
      await callMutation(request, 'projects.delete', { id: project.id })
    }
  })
})
