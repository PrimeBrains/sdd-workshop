/**
 * Task 3.3: Members CRUD tRPC router
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 *
 * Feature Flag: ENABLE_MEMBERS_ROUTER
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { AppError } from '../errors/AppError.js'
import { ErrorCode } from '../errors/codes.js'
import { members } from '../db/schema.js'
import type { Member } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { generateInitials } from '../services/members-service.js'

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_MEMBERS_ROUTER = true

// ── Zod Schemas ───────────────────────────────────────────────────────────────

// Task 4.2: role / initials を入力スキーマに追加 (Req 2.3, 2.4, 2.5, 6.2, 6.4)
// - role は NULL 許容のオプショナル文字列 (自由入力)
// - initials は NULL 許容のオプショナル文字列、長さ 1〜4
//   create 時に未指定 (undefined) の場合は name から自動生成する (Req 2.6, 2.7)
//   null が明示された場合は NULL として保存する
export const createMemberSchema = z.object({
  projectId:        z.number().int().positive(),
  name:             z.string().min(1).max(200),
  availabilityRate: z.number().min(0).max(1),
  assignmentStart:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignmentEnd:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  externalId:       z.string().optional(),
  role:             z.string().nullable().optional(),
  initials:         z.string().min(1).max(4).nullable().optional(),
})

export const updateMemberSchema = z.object({
  id:               z.number().int().positive(),
  name:             z.string().min(1).max(200).optional(),
  availabilityRate: z.number().min(0).max(1).optional(),
  assignmentStart:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignmentEnd:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  externalId:       z.string().optional(),
  role:             z.string().nullable().optional(),
  initials:         z.string().min(1).max(4).nullable().optional(),
})

// ── AppError → TRPCError conversion ───────────────────────────────────────────

function toTRPCError(e: AppError): TRPCError {
  const codeMap: Record<string, TRPCError['code']> = {
    PROJ_NOT_FOUND:       'NOT_FOUND',
    TASK_NOT_FOUND:       'NOT_FOUND',
    MEMBER_NOT_FOUND:     'NOT_FOUND',
    IMPORT_INVALID_YAML:  'BAD_REQUEST',
    IMPORT_PARSE_ERROR:   'BAD_REQUEST',
    IMPORT_MISSING_FIELD: 'BAD_REQUEST',
    MEMBER_INVALID_RATE:  'BAD_REQUEST',
  }
  return new TRPCError({
    code:    codeMap[e.code] ?? 'INTERNAL_SERVER_ERROR',
    message: e.message,
    cause:   e,
  })
}

// ── DB type ───────────────────────────────────────────────────────────────────

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

// ── Router factory ────────────────────────────────────────────────────────────

/**
 * Creates the members tRPC router bound to the given db instance.
 * Production code passes the singleton `db` from `db/index.ts`.
 * Tests pass an in-memory test db.
 */
export function createMembersRouter(db: DrizzleDb) {
  const t = initTRPC.create()

  return t.router({
    // ── members.listByProject (Req 4.2) ─────────────────────────────────────
    listByProject: t.procedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ input }): Promise<Member[]> => {
        return db
          .select()
          .from(members)
          .where(eq(members.projectId, input.projectId))
      }),

    // ── members.create (Req 4.1, 4.5, 4.6, 2.3-2.7, 6.2, 6.4) ───────────────
    // Task 4.2: role / initials のハンドリング
    // - initials === undefined かつ name 非空: generateInitials(name) で補完 (Req 2.6, 2.7)
    // - initials === null: NULL を保存
    // - initials が文字列: そのまま保存
    // - role は null / undefined / string をそのまま通す (undefined は NULL になる)
    create: t.procedure
      .input(createMemberSchema)
      .mutation(async ({ input }): Promise<Member> => {
        // initials 自動生成ロジック
        let initialsToSave: string | null
        if (input.initials === undefined) {
          // 未指定: name から自動生成 (name は createMemberSchema で min(1) を保証)
          initialsToSave = input.name.length > 0 ? generateInitials(input.name) : null
        } else {
          // null または文字列はそのまま保存
          initialsToSave = input.initials
        }

        // role: undefined → null として保存、null / 文字列はそのまま
        const roleToSave: string | null = input.role ?? null

        const rows = await db
          .insert(members)
          .values({
            projectId:        input.projectId,
            name:             input.name,
            availabilityRate: input.availabilityRate,
            assignmentStart:  input.assignmentStart,
            assignmentEnd:    input.assignmentEnd,
            externalId:       input.externalId,
            role:             roleToSave,
            initials:         initialsToSave,
          })
          .returning()
        const member = rows[0]
        if (!member) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create member' })
        }
        return member
      }),

    // ── members.update (Req 4.3, 4.5, 4.6) ──────────────────────────────────
    update: t.procedure
      .input(updateMemberSchema)
      .mutation(async ({ input }): Promise<Member> => {
        // Verify existence first
        const existing = await db.select().from(members).where(eq(members.id, input.id))
        if (!existing[0]) {
          throw toTRPCError(
            new AppError(ErrorCode.MEMBER_NOT_FOUND, `Member not found: id=${input.id}`),
          )
        }

        // Task 4.2: update でも role / initials を受け付ける
        // - undefined: 既存値を維持 (updateData にセットしない)
        // - null: NULL で上書き
        // - 文字列: そのまま上書き
        // create と異なり autogen は行わない (Req 2.3, 2.4, 2.5)
        const updateData: Partial<{
          name: string
          availabilityRate: number
          assignmentStart: string
          assignmentEnd: string
          externalId: string
          role: string | null
          initials: string | null
          updatedAt: Date
        }> = {
          updatedAt: new Date(),
        }

        if (input.name !== undefined)             updateData.name             = input.name
        if (input.availabilityRate !== undefined) updateData.availabilityRate = input.availabilityRate
        if (input.assignmentStart !== undefined)  updateData.assignmentStart  = input.assignmentStart
        if (input.assignmentEnd !== undefined)    updateData.assignmentEnd    = input.assignmentEnd
        if (input.externalId !== undefined)       updateData.externalId       = input.externalId
        if (input.role !== undefined)             updateData.role             = input.role
        if (input.initials !== undefined)         updateData.initials         = input.initials

        const rows = await db
          .update(members)
          .set(updateData)
          .where(eq(members.id, input.id))
          .returning()
        const member = rows[0]
        if (!member) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update member' })
        }
        return member
      }),

    // ── members.delete (Req 4.4) ─────────────────────────────────────────────
    delete: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }): Promise<{ success: true }> => {
        // Verify existence first
        const existing = await db.select().from(members).where(eq(members.id, input.id))
        if (!existing[0]) {
          throw toTRPCError(
            new AppError(ErrorCode.MEMBER_NOT_FOUND, `Member not found: id=${input.id}`),
          )
        }

        // Deleting the member causes tasks.assignee_id to be set to NULL via
        // FK constraint: tasks.assigneeId references members.id { onDelete: 'set null' }
        // This works because PRAGMA foreign_keys = ON is set on the DB connection.
        await db.delete(members).where(eq(members.id, input.id))
        return { success: true }
      }),
  })
}

// ── Convenience export for tests ──────────────────────────────────────────────

/**
 * Alias for use in tests: `membersRouter` is the factory function.
 * Usage in tests: `const router = createMembersRouter(testDb)`
 */
export { createMembersRouter as membersRouter }
