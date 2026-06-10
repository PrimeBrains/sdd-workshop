export interface SpecSummary {
  feature: string
  app: string | null
  phase: string
  approvals: Record<'requirements' | 'design' | 'tasks', { generated: boolean; approved: boolean }> | null
  readyForImplementation: boolean
  updatedAt: string | null
  artifacts: Record<'brief' | 'requirements' | 'design' | 'tasks' | 'research', boolean>
  taskStats: { total: number; done: number }
}

export interface AcceptanceCriterion { id: string; en: string; ja: string | null }
export interface Requirement { id: string; title: string; objective: string | null; criteria: AcceptanceCriterion[] }
export interface TraceRow { refs: string[]; legacyRanges: string[]; summary: string; components: string; rawRef: string }
export interface TaskItem {
  id: string; title: string; done: boolean; major: boolean; parallel: boolean
  requirements: string[]; legacyRanges: string[]; boundary: string | null; depends: string[]
}
export interface TraceMatrix {
  acIds: string[]
  coverage: Record<string, { design: number[]; tasks: string[] }>
  uncoveredByDesign: string[]
  uncoveredByTasks: string[]
  brokenRefs: { source: string; ref: string }[]
}
export interface SpecDetail {
  feature: string
  specJson: Record<string, unknown> | null
  requirements: Requirement[]
  design: { headings: { depth: number; text: string }[]; traceRows: TraceRow[] }
  tasks: TaskItem[]
  matrix: TraceMatrix
  raw: Record<'brief' | 'requirements' | 'design' | 'tasks' | 'research', string | null>
}
export interface SteeringFile { name: string; content: string | null }
export interface SkillDoc { name: string; origin: string | null; en: string | null; ja: string | null }
export interface AdrDoc { file: string; meta: Record<string, unknown>; body: string }

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return (await res.json()) as T
}
