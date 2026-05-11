export const ErrorCode = {
  // Project
  PROJ_NOT_FOUND: 'PROJ_NOT_FOUND',
  // Task
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  // Member
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  // EVM
  EVM_INVALID_BASE_DATE: 'EVM_INVALID_BASE_DATE',
  EVM_PV_ZERO: 'EVM_PV_ZERO',
  // Import
  IMPORT_INVALID_YAML: 'IMPORT_INVALID_YAML',
  IMPORT_MISSING_FIELD: 'IMPORT_MISSING_FIELD',
} as const

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
