import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

// --- projects ---
export const projects = sqliteTable('projects', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate:   text('end_date').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})
export type Project    = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

// --- members (defined before tasks so tasks can reference it) ---
export const members = sqliteTable('members', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  projectId:        integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  externalId:       text('external_id'),
  name:             text('name').notNull(),
  availabilityRate: real('availability_rate').notNull().default(1.0),
  assignmentStart:  text('assignment_start'),
  assignmentEnd:    text('assignment_end'),
  createdAt:        integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt:        integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})
export type Member    = typeof members.$inferSelect
export type NewMember = typeof members.$inferInsert

// --- tasks ---
export const tasks = sqliteTable('tasks', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  projectId:    integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  externalId:   text('external_id'),                // wbs-YAML の "T001" 形式
  name:         text('name').notNull(),
  estimateDays: real('estimate_days').notNull().default(0),
  plannedStart: text('planned_start'),
  plannedEnd:   text('planned_end'),
  actualStart:  text('actual_start'),
  actualEnd:    text('actual_end'),
  parentId:     integer('parent_id').references((): AnySQLiteColumn => tasks.id),
  assigneeId:   integer('assignee_id').references(() => members.id, { onDelete: 'set null' }),
  level:        integer('level').notNull().default(1),
  sortOrder:    integer('sort_order').notNull().default(0),
  isBuffer:     integer('is_buffer', { mode: 'boolean' }).notNull().default(false),
  isLeaf:       integer('is_leaf',   { mode: 'boolean' }).notNull().default(true),
  remarks:      text('remarks'),
  createdAt:    integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})
export type Task    = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert

// --- holidays ---
export const holidays = sqliteTable('holidays', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  date:      text('date').notNull(),
})
export type Holiday    = typeof holidays.$inferSelect
export type NewHoliday = typeof holidays.$inferInsert

// --- task_dependencies ---
export const taskDependencies = sqliteTable('task_dependencies', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  taskId:          integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependsOnTaskId: integer('depends_on_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
})
export type TaskDependency    = typeof taskDependencies.$inferSelect
export type NewTaskDependency = typeof taskDependencies.$inferInsert

// --- progress_snapshots ---
export const progressSnapshots = sqliteTable('progress_snapshots', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  taskId:       integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  snapshotDate: text('snapshot_date').notNull(),
  progressPct:  real('progress_pct').notNull().default(0),
  pvDays:       real('pv_days').notNull().default(0),   // リスケ保全用: 記録時点の PV を保存
  evDays:       real('ev_days').notNull().default(0),   // 再見積保全用: 記録時点の EV を保存
  acDays:       real('ac_days').notNull().default(0),
  createdAt:    integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  taskDateUniq: uniqueIndex('idx_progress_snapshots_task_date').on(table.taskId, table.snapshotDate),
}))
export type ProgressSnapshot    = typeof progressSnapshots.$inferSelect
export type NewProgressSnapshot = typeof progressSnapshots.$inferInsert
