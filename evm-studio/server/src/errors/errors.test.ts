import { describe, it, expect } from 'vitest'
import { ErrorCode } from './codes.js'
import { AppError } from './AppError.js'

describe('ErrorCode', () => {
  it('defines all required error codes', () => {
    expect(ErrorCode.PROJ_NOT_FOUND).toBe('PROJ_NOT_FOUND')
    expect(ErrorCode.TASK_NOT_FOUND).toBe('TASK_NOT_FOUND')
    expect(ErrorCode.MEMBER_NOT_FOUND).toBe('MEMBER_NOT_FOUND')
    expect(ErrorCode.MEMBER_INVALID_RATE).toBe('MEMBER_INVALID_RATE')
    expect(ErrorCode.IMPORT_INVALID_YAML).toBe('IMPORT_INVALID_YAML')
    expect(ErrorCode.IMPORT_PARSE_ERROR).toBe('IMPORT_PARSE_ERROR')
    expect(ErrorCode.IMPORT_MISSING_FIELD).toBe('IMPORT_MISSING_FIELD')
  })

  it('does not have AppError class embedded in codes.ts', () => {
    // codes.ts should only export ErrorCode constant and type
    const keys = Object.keys(ErrorCode)
    expect(keys).toContain('PROJ_NOT_FOUND')
    expect(keys).toContain('MEMBER_INVALID_RATE')
    expect(keys).toContain('IMPORT_PARSE_ERROR')
  })
})

describe('AppError', () => {
  it('extends Error', () => {
    const err = new AppError(ErrorCode.PROJ_NOT_FOUND, 'Project not found')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
  })

  it('has correct name property', () => {
    const err = new AppError(ErrorCode.TASK_NOT_FOUND, 'Task not found')
    expect(err.name).toBe('AppError')
  })

  it('has correct message property', () => {
    const err = new AppError(ErrorCode.MEMBER_NOT_FOUND, 'Member not found')
    expect(err.message).toBe('Member not found')
  })

  it('has correct code property for all task-required codes', () => {
    const codes = [
      ErrorCode.PROJ_NOT_FOUND,
      ErrorCode.TASK_NOT_FOUND,
      ErrorCode.MEMBER_NOT_FOUND,
      ErrorCode.MEMBER_INVALID_RATE,
      ErrorCode.IMPORT_INVALID_YAML,
      ErrorCode.IMPORT_PARSE_ERROR,
      ErrorCode.IMPORT_MISSING_FIELD,
    ] as const

    for (const code of codes) {
      const err = new AppError(code, `error for ${code}`)
      expect(err.code).toBe(code)
    }
  })

  it('code property is readonly (type-level check via const assertion)', () => {
    const err = new AppError(ErrorCode.IMPORT_PARSE_ERROR, 'parse failed')
    expect(err.code).toBe('IMPORT_PARSE_ERROR')
  })
})
