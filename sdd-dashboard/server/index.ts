/**
 * SDD Dashboard walking skeleton server.
 * .kiro/ を直接読み、簡易パースした構造化 JSON を返す。
 * 本実装(sdd-core)では remark/mdast + chokidar + SSE になる部分を
 * regex ベースの読み捨てパースで代替している。
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(process.env.SDD_REPO_ROOT ?? join(import.meta.dirname, '..', '..'))
const KIRO = join(REPO_ROOT, '.kiro')
const SKILLS_DIR = join(REPO_ROOT, '.claude', 'skills')

const read = (p: string): string | null => (existsSync(p) ? readFileSync(p, 'utf-8') : null)
const listDirs = (p: string): string[] =>
  existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []

// ---------- 参照リストのパース（trace-notation 準拠 + 旧範囲表記の後方互換展開） ----------
export function parseRefList(raw: string): { ids: string[]; legacyRanges: string[] } {
  const ids: string[] = []
  const legacyRanges: string[] = []
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\.(\d+)-(\d+)\.(\d+)$/)
    if (range) {
      legacyRanges.push(part)
      const [, M1, m1, M2, m2] = range
      if (M1 === M2) {
        for (let i = Number(m1); i <= Number(m2); i++) ids.push(`${M1}.${i}`)
      }
      continue
    }
    if (/^\d+(\.\d+)?$/.test(part)) ids.push(part)
  }
  return { ids, legacyRanges }
}

// ---------- requirements.md ----------
interface AcceptanceCriterion { id: string; en: string; ja: string | null }
interface Requirement { id: string; title: string; objective: string | null; criteria: AcceptanceCriterion[] }

function parseRequirements(md: string): Requirement[] {
  const requirements: Requirement[] = []
  const sections = md.split(/^### /m).slice(1)
  for (const sec of sections) {
    const header = sec.match(/^Requirement (\d+)[:：]?\s*(.*)/)
    if (!header) continue
    const [, num, title] = header
    const objective = sec.match(/\*\*Objective\*\*[:：]?\s*(.*)/)?.[1] ?? null
    const criteria: AcceptanceCriterion[] = []
    const acBlock = sec.split(/#### Acceptance Criteria/)[1] ?? ''
    const lines = acBlock.split('\n')
    let current: AcceptanceCriterion | null = null
    for (const line of lines) {
      const item = line.match(/^(\d+)\.\s+(.*)/)
      if (item) {
        current = { id: `${num}.${item[1]}`, en: item[2].trim(), ja: null }
        criteria.push(current)
        continue
      }
      const ja = line.match(/^\s+-\s*和訳[:：]\s*(.*)/)
      if (ja && current) { current.ja = ja[1].trim(); continue }
      // EARS 文の折り返し行（先頭がリスト記号でないインデント行）を英文へ連結
      if (current && /^\s{2,}\S/.test(line) && !/^\s+-/.test(line)) current.en += ' ' + line.trim()
    }
    requirements.push({ id: num, title: title.trim(), objective, criteria })
  }
  return requirements
}

// ---------- design.md ----------
interface TraceRow { refs: string[]; legacyRanges: string[]; summary: string; components: string; rawRef: string }
interface DesignDoc { headings: { depth: number; text: string }[]; traceRows: TraceRow[] }

function parseDesign(md: string): DesignDoc {
  const headings = [...md.matchAll(/^(#{2,4}) (.+)$/gm)].map((m) => ({ depth: m[1].length, text: m[2].trim() }))
  const traceRows: TraceRow[] = []
  const section = md.split(/^## Requirements Traceability/m)[1]?.split(/^## /m)[0]
  if (section) {
    for (const line of section.split('\n')) {
      const cells = line.split('|').map((c) => c.trim())
      // | ref | summary | components | ... |
      if (cells.length < 4 || !/\d/.test(cells[1]) || /^[-: ]+$/.test(cells[1])) continue
      const { ids, legacyRanges } = parseRefList(cells[1])
      if (ids.length === 0) continue
      traceRows.push({ refs: ids, legacyRanges, summary: cells[2] ?? '', components: cells[3] ?? '', rawRef: cells[1] })
    }
  }
  return { headings, traceRows }
}

// ---------- tasks.md ----------
interface TaskItem {
  id: string; title: string; done: boolean; major: boolean; parallel: boolean
  requirements: string[]; legacyRanges: string[]; boundary: string | null; depends: string[]
}

function parseTasks(md: string): TaskItem[] {
  const items: TaskItem[] = []
  let current: TaskItem | null = null
  for (const line of md.split('\n')) {
    const m = line.match(/^- \[([ x])\]\*? (\d+(?:\.\d+)?)\.?\s+(.*)/)
    if (m) {
      current = {
        id: m[2], title: m[3].replace(/\s*\(P\)\s*$/, '').trim(), done: m[1] === 'x',
        major: !m[2].includes('.'), parallel: /\(P\)\s*$/.test(m[3]),
        requirements: [], legacyRanges: [], boundary: null, depends: [],
      }
      items.push(current)
      continue
    }
    if (!current) continue
    const req = line.match(/_Requirements[:：]\s*([^_]+)_/)
    if (req) {
      const { ids, legacyRanges } = parseRefList(req[1])
      current.requirements = ids
      current.legacyRanges = legacyRanges
    }
    const boundary = line.match(/_Boundary[:：]\s*([^_]+)_/)
    if (boundary) current.boundary = boundary[1].trim()
    const dep = line.match(/_Depends[:：]\s*([^_]+)_/)
    if (dep) current.depends = dep[1].split(',').map((s) => s.trim())
  }
  return items
}

// ---------- トレーサビリティマトリクス ----------
interface TraceMatrix {
  acIds: string[]
  coverage: Record<string, { design: number[]; tasks: string[] }>
  uncoveredByDesign: string[]
  uncoveredByTasks: string[]
  brokenRefs: { source: string; ref: string }[]
}

function buildMatrix(reqs: Requirement[], design: DesignDoc, tasks: TaskItem[]): TraceMatrix {
  const acIds = reqs.flatMap((r) => r.criteria.map((c) => c.id))
  const acSet = new Set(acIds)
  const coverage: TraceMatrix['coverage'] = Object.fromEntries(acIds.map((id) => [id, { design: [], tasks: [] }]))
  const brokenRefs: TraceMatrix['brokenRefs'] = []
  const expandToAc = (ref: string): string[] =>
    ref.includes('.') ? [ref] : acIds.filter((id) => id.startsWith(`${ref}.`)) // メジャー番号参照は配下 AC へ展開
  design.traceRows.forEach((row, i) =>
    row.refs.forEach((ref) => {
      const targets = expandToAc(ref).filter((id) => acSet.has(id))
      if (targets.length === 0) brokenRefs.push({ source: `design traceability row ${i + 1} (${row.rawRef})`, ref })
      targets.forEach((id) => coverage[id].design.push(i))
    }),
  )
  tasks.forEach((t) =>
    t.requirements.forEach((ref) => {
      const targets = expandToAc(ref).filter((id) => acSet.has(id))
      if (targets.length === 0) brokenRefs.push({ source: `task ${t.id}`, ref })
      targets.forEach((id) => coverage[id].tasks.push(t.id))
    }),
  )
  return {
    acIds,
    coverage,
    uncoveredByDesign: acIds.filter((id) => coverage[id].design.length === 0),
    uncoveredByTasks: acIds.filter((id) => coverage[id].tasks.length === 0),
    brokenRefs,
  }
}

// ---------- ADR frontmatter（簡易 YAML） ----------
function parseAdr(md: string): { meta: Record<string, unknown>; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: md }
  const meta: Record<string, unknown> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (!kv) continue
    const [, key, valueRaw] = kv
    const value = valueRaw.trim()
    if (value.startsWith('[')) meta[key] = value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean)
    else if (value === 'null' || value === '') meta[key] = null
    else meta[key] = value
  }
  return { meta, body: m[2] }
}

// ---------- API ----------
const app = new Hono()
app.use('*', cors({ origin: (o) => (o?.startsWith('http://localhost') ? o : 'http://localhost') }))

app.get('/api/repo', (c) => c.json({ root: REPO_ROOT, name: REPO_ROOT.split('/').pop() }))

app.get('/api/specs', (c) => {
  const specs = listDirs(join(KIRO, 'specs')).map((feature) => {
    const dir = join(KIRO, 'specs', feature)
    const specJsonRaw = read(join(dir, 'spec.json'))
    const specJson = specJsonRaw ? JSON.parse(specJsonRaw) : null
    const tasksMd = read(join(dir, 'tasks.md'))
    const tasks = tasksMd ? parseTasks(tasksMd) : []
    const subs = tasks.filter((t) => !t.major)
    return {
      feature,
      app: specJson?.app ?? null,
      phase: specJson?.phase ?? 'discovery',
      approvals: specJson?.approvals ?? null,
      readyForImplementation: specJson?.ready_for_implementation ?? false,
      updatedAt: specJson?.updated_at ?? null,
      artifacts: {
        brief: existsSync(join(dir, 'brief.md')),
        requirements: existsSync(join(dir, 'requirements.md')),
        design: existsSync(join(dir, 'design.md')),
        tasks: existsSync(join(dir, 'tasks.md')),
        research: existsSync(join(dir, 'research.md')),
      },
      taskStats: { total: subs.length, done: subs.filter((t) => t.done).length },
    }
  })
  return c.json(specs)
})

app.get('/api/specs/:feature', (c) => {
  const feature = c.req.param('feature')
  if (!/^[\w-]+$/.test(feature)) return c.json({ error: { code: 'INVALID_FEATURE' } }, 422)
  const dir = join(KIRO, 'specs', feature)
  if (!existsSync(dir)) return c.json({ error: { code: 'SPEC_NOT_FOUND' } }, 404)
  const raw = {
    brief: read(join(dir, 'brief.md')),
    requirements: read(join(dir, 'requirements.md')),
    design: read(join(dir, 'design.md')),
    tasks: read(join(dir, 'tasks.md')),
    research: read(join(dir, 'research.md')),
  }
  const specJsonRaw = read(join(dir, 'spec.json'))
  const requirements = raw.requirements ? parseRequirements(raw.requirements) : []
  const design = raw.design ? parseDesign(raw.design) : { headings: [], traceRows: [] }
  const tasks = raw.tasks ? parseTasks(raw.tasks) : []
  return c.json({
    feature,
    specJson: specJsonRaw ? JSON.parse(specJsonRaw) : null,
    requirements,
    design,
    tasks,
    matrix: buildMatrix(requirements, design, tasks),
    raw,
  })
})

app.get('/api/steering', (c) => {
  const dir = join(KIRO, 'steering')
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []
  return c.json(files.map((name) => ({ name, content: read(join(dir, name)) })))
})

app.get('/api/skills', (c) => {
  const skills = listDirs(SKILLS_DIR).map((name) => {
    const en = read(join(SKILLS_DIR, name, 'SKILL.md'))
    const frontmatter = en?.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
    const origin = frontmatter.match(/^\s*origin:\s*"?([\w-]+)"?\s*$/m)?.[1] ?? null
    return { name, origin, en, ja: read(join(SKILLS_DIR, name, 'SKILL.ja.md')) }
  })
  return c.json(skills)
})

app.get('/api/adr', (c) => {
  const dir = join(KIRO, 'adr')
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => /^\d{4}-.*\.md$/.test(f)).sort()
    : []
  return c.json(files.map((file) => ({ file, ...parseAdr(read(join(dir, file)) ?? '') })))
})

const port = 7411
serve({ fetch: app.fetch, port })
console.log(`[sdd-dashboard] skeleton server on http://localhost:${port} (repo: ${REPO_ROOT})`)
