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

// ── Feature Flag ──────────────────────────────────────────────────────────────
export const ENABLE_MEMBERS_ROUTER = true

// ── Zod Schemas ───────────────────────────────────────────────────────────────

export const createMemberSchema = z.object({
  projectId:        z.number().int().positive(),
  name:             z.string().min(1).max(200),
  availabilityRate: z.number().min(0).max(1),
  assignmentStart:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignmentEnd:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  externalId:       z.string().optional(),
})

export const updateMemberSchema = z.object({
  id:               z.number().int().positive(),
  name:             z.string().min(1).max(200).optional(),
  availabilityRate: z.number().min(0).max(1).optional(),
  assignmentStart:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignmentEnd:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  externalId:       z.string().optional(),
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

    // ── members.create (Req 4.1, 4.5, 4.6) ──────────────────────────────────
    create: t.procedure
      .input(createMemberSchema)
      .mutation(async ({ input }): Promise<Member> => {
        const rows = await db
          .insert(members)
          .values({
            projectId:        input.projectId,
            name:             input.name,
            availabilityRate: input.availabilityRate,
            assignmentStart:  input.assignmentStart,
            assignmentEnd:    input.assignmentEnd,
            externalId:       input.externalId,
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

        const updateData: Partial<{
          name: string
          availabilityRate: number
          assignmentStart: string
          assignmentEnd: string
          externalId: string
          updatedAt: Date
        }> = {
          updatedAt: new Date(),
        }

        if (input.name !== undefined)             updateData.name             = input.name
        if (input.availabilityRate !== undefined) updateData.availabilityRate = input.availabilityRate
        if (input.assignmentStart !== undefined)  updateData.assignmentStart  = input.assignmentStart
        if (input.assignmentEnd !== undefined)    updateData.assignmentEnd    = input.assignmentEnd
        if (input.externalId !== undefined)       updateData.externalId       = input.externalId

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
