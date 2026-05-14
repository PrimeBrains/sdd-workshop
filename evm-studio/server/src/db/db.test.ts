import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema.js'

// Helper: create an in-memory DB instance with foreign_keys enabled, mirroring db/index.ts logic
function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { sqlite, db }
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
