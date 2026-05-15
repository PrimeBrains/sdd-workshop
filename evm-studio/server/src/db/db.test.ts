import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as schema from './schema.js'

// Helper: create an in-memory DB instance with foreign_keys enabled, mirroring db/index.ts logic
function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { sqlite, db }
}

// Helper: execute a single migration SQL file by splitting on the drizzle statement-breakpoint marker
function applyMigrationFile(sqlite: Database.Database, fileName: string): void {
  const sqlPath = resolve('./src/db/migrations', fileName)
  const sql = readFileSync(sqlPath, 'utf8')
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const stmt of statements) {
    sqlite.exec(stmt)
  }
}

// Requirement 1.8: PRAGMA foreign_keys = ON is enforced
describe('DBClient — PRAGMA foreign_keys = ON (Req 1.8)', () => {
  it('enables foreign key enforcement on the connection', () => {
    const { sqlite } = createTestDb()
    const result = sqlite.pragma('foreign_keys') as Array<{ foreign_keys: number }>
    expect(result[0]?.foreign_keys).toBe(1)
  })
})

// Requirement 1.7: runMigrations applies schema without error
describe('DBClient — runMigrations (Req 1.7)', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    db = testDb.db
  })

  it('applies migrations to an empty in-memory database without error', () => {
    expect(() => {
      migrate(db, { migrationsFolder: './src/db/migrations' })
    }).not.toThrow()
  })

  it('creates all 6 tables after migration', () => {
    migrate(db, { migrationsFolder: './src/db/migrations' })

    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>

    const tableNames = tables.map((t) => t.name)
    expect(tableNames).toContain('projects')
    expect(tableNames).toContain('tasks')
    expect(tableNames).toContain('members')
    expect(tableNames).toContain('holidays')
    expect(tableNames).toContain('task_dependencies')
    expect(tableNames).toContain('progress_snapshots')
  })

  it('is idempotent: running migrations twice does not throw', () => {
    expect(() => {
      migrate(db, { migrationsFolder: './src/db/migrations' })
      migrate(db, { migrationsFolder: './src/db/migrations' })
    }).not.toThrow()
  })
})

// Requirement 3.1 / 3.2 / 3.3: migration 0001 preserves existing data and adds
// new columns via ALTER TABLE ADD COLUMN, with status defaulting to 'active'
// and code / role / initials defaulting to NULL.
describe('DBClient — backward compatibility across migration 0001 (Req 3.1-3.3)', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite

    // Apply only the initial schema (migration 0000), simulating a legacy DB.
    applyMigrationFile(sqlite, '0000_real_gorilla_man.sql')

    // Insert legacy rows that exercise every table covered by Req 3.3.
    sqlite
      .prepare(
        `INSERT INTO projects (id, name, start_date, end_date) VALUES (?, ?, ?, ?)`,
      )
      .run(1, 'Legacy Project', '2025-01-01', '2025-12-31')

    sqlite
      .prepare(
        `INSERT INTO members (id, project_id, external_id, name, availability_rate)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(1, 1, 'M001', '田中 美咲', 1.0)

    sqlite
      .prepare(
        `INSERT INTO tasks (id, project_id, external_id, name, estimate_days, level, sort_order, is_buffer, is_leaf)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1, 1, 'T001', 'Legacy Task', 5.0, 1, 0, 0, 1)

    sqlite
      .prepare(
        `INSERT INTO tasks (id, project_id, external_id, name, estimate_days, level, sort_order, is_buffer, is_leaf)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(2, 1, 'T002', 'Legacy Task 2', 3.0, 1, 1, 0, 1)

    sqlite
      .prepare(
        `INSERT INTO task_dependencies (id, task_id, depends_on_task_id) VALUES (?, ?, ?)`,
      )
      .run(1, 2, 1)

    sqlite
      .prepare(
        `INSERT INTO progress_snapshots (id, task_id, snapshot_date, progress_pct, pv_days, ev_days, ac_days)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1, 1, '2025-06-01', 50.0, 2.5, 1.5, 2.0)

    sqlite
      .prepare(`INSERT INTO holidays (id, project_id, date) VALUES (?, ?, ?)`)
      .run(1, 1, '2025-05-05')
  })

  it('preserves all existing rows in every table after migration 0001', () => {
    applyMigrationFile(sqlite, '0001_add_status_code_role_initials.sql')

    const projectsCount = (sqlite.prepare('SELECT COUNT(*) AS c FROM projects').get() as { c: number }).c
    const membersCount = (sqlite.prepare('SELECT COUNT(*) AS c FROM members').get() as { c: number }).c
    const tasksCount = (sqlite.prepare('SELECT COUNT(*) AS c FROM tasks').get() as { c: number }).c
    const depsCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM task_dependencies').get() as { c: number }
    ).c
    const snapshotsCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM progress_snapshots').get() as { c: number }
    ).c
    const holidaysCount = (sqlite.prepare('SELECT COUNT(*) AS c FROM holidays').get() as { c: number }).c

    expect(projectsCount).toBe(1)
    expect(membersCount).toBe(1)
    expect(tasksCount).toBe(2)
    expect(depsCount).toBe(1)
    expect(snapshotsCount).toBe(1)
    expect(holidaysCount).toBe(1)
  })

  it("backfills projects.status='active' and projects.code=NULL on existing rows", () => {
    applyMigrationFile(sqlite, '0001_add_status_code_role_initials.sql')

    const row = sqlite
      .prepare('SELECT status, code FROM projects WHERE id = ?')
      .get(1) as { status: string; code: string | null }

    expect(row.status).toBe('active')
    expect(row.code).toBeNull()
  })

  it('leaves members.role and members.initials as NULL on existing rows', () => {
    applyMigrationFile(sqlite, '0001_add_status_code_role_initials.sql')

    const row = sqlite
      .prepare('SELECT role, initials FROM members WHERE id = ?')
      .get(1) as { role: string | null; initials: string | null }

    expect(row.role).toBeNull()
    expect(row.initials).toBeNull()
  })

  it('exposes the four new columns via PRAGMA table_info after migration 0001', () => {
    applyMigrationFile(sqlite, '0001_add_status_code_role_initials.sql')

    const projectCols = (
      sqlite.prepare("PRAGMA table_info('projects')").all() as Array<{ name: string }>
    ).map((c) => c.name)
    const memberCols = (
      sqlite.prepare("PRAGMA table_info('members')").all() as Array<{ name: string }>
    ).map((c) => c.name)

    expect(projectCols).toContain('status')
    expect(projectCols).toContain('code')
    expect(memberCols).toContain('role')
    expect(memberCols).toContain('initials')
  })
})

// Requirement 3.4: if a SQL statement inside a transaction fails, the migration
// runner shall roll back so the pre-transaction state is preserved.
describe('DBClient — transactional rollback on error (Req 3.4)', () => {
  it('rolls back all changes when an invalid SQL statement is executed in a transaction', () => {
    const { sqlite, db } = createTestDb()
    migrate(db, { migrationsFolder: './src/db/migrations' })

    // Seed one legitimate row so we have a known baseline to verify against.
    sqlite
      .prepare(
        `INSERT INTO projects (id, name, start_date, end_date) VALUES (?, ?, ?, ?)`,
      )
      .run(1, 'Baseline Project', '2025-01-01', '2025-12-31')

    const baselineCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM projects').get() as { c: number }
    ).c
    expect(baselineCount).toBe(1)

    // better-sqlite3 transactions automatically roll back when the callback throws.
    const trx = sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT INTO projects (id, name, start_date, end_date) VALUES (?, ?, ?, ?)`,
        )
        .run(2, 'Doomed Project', '2025-02-01', '2025-12-31')

      // Inject an intentionally invalid SQL statement to trigger rollback.
      sqlite.exec('THIS IS NOT VALID SQL;')
    })

    expect(() => trx()).toThrow()

    // Post-failure state must equal baseline: the second insert is rolled back.
    const afterCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM projects').get() as { c: number }
    ).c
    expect(afterCount).toBe(1)

    const remaining = sqlite
      .prepare('SELECT id, name FROM projects')
      .all() as Array<{ id: number; name: string }>
    expect(remaining).toEqual([{ id: 1, name: 'Baseline Project' }])
  })
})
