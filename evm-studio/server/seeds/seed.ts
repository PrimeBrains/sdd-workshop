/**
 * シードスクリプト (task 5.2)
 *
 * `evm-studio/server/seeds/mockup-projects.ts` の 5 プロジェクト定義を
 * SQLite データベースに投入する。
 *
 * 実行方法:
 *   cd evm-studio && npm run seed         # デフォルト初期化挙動
 *   cd evm-studio && npm run seed -- --reset  # 明示的に reset を指定
 *
 * 設計上の決定事項:
 *  - **DB パス**: `process.env.DB_PATH` を尊重しつつ、未指定時は
 *    `./evm-studio.db`（cwd 相対）を使う。`npm run seed` は
 *    `evm-studio/` ディレクトリで実行される想定のため、
 *    `evm-studio/evm-studio.db` に解決される。
 *  - **マイグレーション**: シード前に `drizzle-orm/better-sqlite3/migrator`
 *    の `migrate()` を直接呼ぶ。`runMigrations` 関数は cwd 相対の
 *    `./src/db/migrations` を参照するが、本スクリプトは `evm-studio/`
 *    から実行されるため、`server/src/db/migrations` を明示指定する。
 *  - **--reset / フラグなし**: task 5.2 の指示に従い、フラグの有無に
 *    関わらずデフォルトで既存テーブル全件を `DELETE FROM` してから
 *    投入する（外部キー参照順を意識して逆順で削除）。
 *  - **トランザクション**: 投入は `sqlite.transaction()` 内で実行し、
 *    例外発生時は better-sqlite3 が自動的にロールバックする。
 *    例外を最上位で catch して `process.exit(1)` する。
 *  - **assigneeId 解決**: シードエントリ内の members を先に挿入し、
 *    `externalId -> dbId` のマップを作る。タスクの `assigneeExternalId`
 *    を同マップで解決して `assigneeId` を決定する。
 *  - **parentId 解決**: タスクは sortOrder 順に挿入される
 *    （mockup-projects.ts の配列順序）。各タスクの `externalId -> dbId`
 *    を逐次マップに登録し、`parentExternalId` を逐次解決する。
 *    階層的に親が先に出現するため、自己参照キーの整合性が保たれる。
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as schema from '../src/db/schema.js'
import {
  projects,
  members,
  tasks,
  taskDependencies,
  holidays,
  progressSnapshots,
} from '../src/db/schema.js'
import { mockupProjects } from './mockup-projects.js'

// =============================================================================
// セットアップ: DB 接続とマイグレーション適用
// =============================================================================

// シードスクリプト自身の所在を起点に migrations フォルダと DB パスを解決する。
// これにより cwd に依存せず、`evm-studio/` 配下にあれば常に
// `evm-studio/evm-studio.db` を対象にできる。
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsFolder = path.resolve(__dirname, '../src/db/migrations')

// `evm-studio/server/seeds/seed.ts` から見て `../../evm-studio.db` が
// `evm-studio/evm-studio.db` に解決される。
const defaultDbPath = path.resolve(__dirname, '../../evm-studio.db')
const dbPath = process.env['DB_PATH'] ?? defaultDbPath
const sqlite = new Database(dbPath)
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite, { schema })

// マイグレーション適用（スキーマ最新化）
migrate(db, { migrationsFolder })

// =============================================================================
// 起動時アサーション: モックアップ件数の整合性
// =============================================================================

if (mockupProjects.length !== 5) {
  console.error(
    `[seed] mockupProjects.length must be 5, got ${mockupProjects.length}`,
  )
  process.exit(1)
}

// =============================================================================
// シード処理本体
// =============================================================================

type Counts = {
  projects:     number
  members:      number
  tasks:        number
  dependencies: number
  holidays:     number
}

const counts: Counts = {
  projects:     0,
  members:      0,
  tasks:        0,
  dependencies: 0,
  holidays:     0,
}

try {
  // better-sqlite3 のトランザクション API は同期関数を要求する。
  // drizzle-orm のメソッドは内部的に同期で動くため安全に組み合わせられる。
  const runSeed = sqlite.transaction(() => {
    // ── 0. 既存データを全件削除（外部キー参照を考慮して逆順）─────────────
    // CASCADE 設定もあるが、明示的に逆順で削除して意図を明確にする。
    db.delete(progressSnapshots).run()
    db.delete(taskDependencies).run()
    db.delete(holidays).run()
    db.delete(tasks).run()
    db.delete(members).run()
    db.delete(projects).run()

    // ── 1. プロジェクト → メンバー → タスク → 依存 → 休日 を順に投入 ─────
    for (const seed of mockupProjects) {
      // 1-1. project insert
      const projectRow = db
        .insert(projects)
        .values({
          name:      seed.project.name,
          status:    seed.project.status,
          code:      seed.project.code,
          startDate: seed.project.startDate,
          endDate:   seed.project.endDate,
        })
        .returning()
        .get()

      if (!projectRow) {
        throw new Error(`[seed] failed to insert project: ${seed.project.code}`)
      }
      const projectId = projectRow.id
      counts.projects++

      // 1-2. members insert (externalId -> dbId マップを構築)
      const memberIdMap = new Map<string, number>()
      for (const m of seed.members) {
        const memberRow = db
          .insert(members)
          .values({
            projectId,
            externalId:       m.externalId,
            name:             m.name,
            role:             m.role,
            initials:         m.initials,
            availabilityRate: m.availabilityRate,
            assignmentStart:  m.assignmentStart,
            assignmentEnd:    m.assignmentEnd,
          })
          .returning()
          .get()

        if (!memberRow) {
          throw new Error(
            `[seed] failed to insert member ${m.externalId} (${m.name}) in project ${seed.project.code}`,
          )
        }
        memberIdMap.set(m.externalId, memberRow.id)
        counts.members++
      }

      // 1-3. tasks insert (sortOrder 順、親が先に出現する前提)
      //      mockup-projects.ts は配列順で sortOrder=0..N を採番している。
      const taskIdMap = new Map<string, number>()
      const sortedTasks = [...seed.tasks].sort((a, b) => a.sortOrder - b.sortOrder)

      for (const t of sortedTasks) {
        const parentId =
          t.parentExternalId !== null
            ? taskIdMap.get(t.parentExternalId) ?? null
            : null

        if (t.parentExternalId !== null && parentId === null) {
          throw new Error(
            `[seed] parent task '${t.parentExternalId}' not found for task '${t.externalId}' in project ${seed.project.code} (insertion order broken?)`,
          )
        }

        const assigneeId =
          t.assigneeExternalId !== null
            ? memberIdMap.get(t.assigneeExternalId) ?? null
            : null

        if (t.assigneeExternalId !== null && assigneeId === null) {
          throw new Error(
            `[seed] assignee '${t.assigneeExternalId}' not found for task '${t.externalId}' in project ${seed.project.code}`,
          )
        }

        const taskRow = db
          .insert(tasks)
          .values({
            projectId,
            externalId:   t.externalId,
            name:         t.name,
            estimateDays: t.estimateDays,
            plannedStart: t.plannedStart,
            plannedEnd:   t.plannedEnd,
            parentId,
            assigneeId,
            level:        t.level,
            sortOrder:    t.sortOrder,
            isBuffer:     t.isBuffer,
            isLeaf:       t.isLeaf,
          })
          .returning()
          .get()

        if (!taskRow) {
          throw new Error(
            `[seed] failed to insert task ${t.externalId} (${t.name}) in project ${seed.project.code}`,
          )
        }
        taskIdMap.set(t.externalId, taskRow.id)
        counts.tasks++
      }

      // 1-4. task_dependencies insert
      for (const dep of seed.dependencies) {
        const taskId = taskIdMap.get(dep.taskExternalId)
        const dependsOnTaskId = taskIdMap.get(dep.dependsOnExternalId)
        if (taskId === undefined || dependsOnTaskId === undefined) {
          throw new Error(
            `[seed] dependency reference broken in project ${seed.project.code}: ` +
              `${dep.taskExternalId} -> ${dep.dependsOnExternalId}`,
          )
        }
        db
          .insert(taskDependencies)
          .values({ taskId, dependsOnTaskId })
          .run()
        counts.dependencies++
      }

      // 1-5. holidays insert
      for (const h of seed.holidays) {
        db
          .insert(holidays)
          .values({ projectId, date: h.date })
          .run()
        counts.holidays++
      }
    }
  })

  runSeed()

  console.log(
    `projects: ${counts.projects} / members: ${counts.members} / tasks: ${counts.tasks} / dependencies: ${counts.dependencies} / holidays: ${counts.holidays}`,
  )
  process.exit(0)
} catch (err) {
  // better-sqlite3 の transaction は例外発生時に自動でロールバックする。
  // 追加のロールバック呼び出しは不要だが、エラーログは明示的に出す。
  console.error('[seed] failed:', err instanceof Error ? err.message : err)
  if (err instanceof Error && err.stack) {
    console.error(err.stack)
  }
  process.exit(1)
}
