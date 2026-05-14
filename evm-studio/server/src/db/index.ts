import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema.js'

const DB_PATH = process.env['DB_PATH'] ?? './evm-studio.db'
const sqlite = new Database(DB_PATH)
sqlite.pragma('foreign_keys = ON')
export const db = drizzle(sqlite, { schema })

export function runMigrations(): void {
  migrate(db, { migrationsFolder: './src/db/migrations' })
}
