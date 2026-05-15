/**
 * タスク別 EVM データのロールアップ（Requirements 7.1-7.7）。
 *
 * `rollupTasks` は以下を生成する純粋関数:
 *   - 各タスクの `code`（WBS 階層番号: `1`, `1.1`, `1.2`, ...）
 *   - `start` / `end`（`Project.startDate` からの相対日数, 整数）
 *   - 葉タスク（`isLeaf === true`）: 最新スナップショットの `progress` と
 *     `pv > 0` のとき `spi = ev / pv`、それ以外 `null`
 *   - 親タスク: 子葉タスクの BAC 加重平均で `progress`、
 *     子葉タスクの `ev` 合計 / `pv` 合計で `spi`（`pv` 合計 0 のとき `null`）
 *   - `assignee`: `Task.assigneeId` → `Member.name`（バッファや未割当は `null`）
 *   - WBS code の階層辞書順（`1` < `1.1` < `1.2` < `2`）で安定ソート
 *
 * バッファタスク扱い:
 *   - `buffer: true` を立て、`bac = estimateDays` で出力に保持する（ガント描画用）。
 *   - 親タスクのロールアップ計算では非バッファの葉タスクのみを対象とする。
 *
 * 純粋関数。DB I/O・現在時刻・乱数を一切持たない。
 */

import type { Holiday, Member, ProgressSnapshot, Project, Task } from '../db/schema.js'
import { calculateTaskPv } from './evm-engine.js'

// ─── 出力型 ─────────────────────────────────────────────────────────────

export interface TaskEvm {
  id: number
  code: string
  name: string
  level: number
  /** Project.startDate からの相対日数（整数）。plannedStart 未設定時は 0 */
  start: number
  /** Project.startDate からの相対日数（整数）。plannedEnd 未設定時は start と同値 */
  end: number
  progress: number
  spi: number | null
  assignee: string | null
  leaf: boolean
  buffer?: boolean
  /** タスクの BAC = estimateDays */
  bac: number
}

// ─── 入力型 ─────────────────────────────────────────────────────────────

export interface RollupTasksInput {
  project: Pick<Project, 'startDate'>
  tasks: ReadonlyArray<Task>
  members: ReadonlyArray<Member>
  snapshots: ReadonlyArray<ProgressSnapshot>
  holidays: ReadonlyArray<Holiday>
  baseDate: string
}

// ─── ユーティリティ ─────────────────────────────────────────────────────

/** 'YYYY-MM-DD' を UTC ベースの Date に変換 */
function parseUTCDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  return new Date(Date.UTC(year, month - 1, day))
}

/** 暦日差（整数）。`to - from`（同日 = 0） */
function diffDaysInt(from: string, to: string): number {
  const a = parseUTCDate(from)
  const b = parseUTCDate(to)
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

/**
 * 同一タスクの複数スナップショットから `baseDate` 以前の最新を返す。
 * 呼び出し側で `baseDate` 以前に絞り込んでいなくても安全になるよう内部でフィルタする。
 */
function findLatestSnapshot(
  taskId: number,
  snapshots: ReadonlyArray<ProgressSnapshot>,
  baseDate: string,
): ProgressSnapshot | undefined {
  let latest: ProgressSnapshot | undefined
  for (const s of snapshots) {
    if (s.taskId !== taskId) continue
    if (s.snapshotDate > baseDate) continue
    if (latest === undefined || s.snapshotDate > latest.snapshotDate) {
      latest = s
    }
  }
  return latest
}

/**
 * WBS code を階層的に組み立てる。
 *
 * - 同一 parentId を持つ非バッファ兄弟タスクを `sortOrder` 昇順で並べ、1 から番号付与。
 * - 親が null（ルート）の場合はそのまま `'1'`, `'2'`, ...。
 * - 親がある場合は親 code に `.<n>` を付与（例: `'1.1'`）。
 * - バッファタスクはルート: `'B'`, `'B1'`, ...（複数バッファ時）。子バッファは親 code + `.B`。
 *
 * sortOrder が同値の場合は `id` 昇順で安定化する。
 */
function buildCodeMap(tasks: ReadonlyArray<Task>): Map<number, string> {
  const codeMap = new Map<number, string>()

  // parentId → children のグルーピング
  const childrenByParent = new Map<number | null, Task[]>()
  for (const t of tasks) {
    const key = t.parentId
    const bucket = childrenByParent.get(key) ?? []
    bucket.push(t)
    childrenByParent.set(key, bucket)
  }

  // 各 parent ごとに非バッファ → バッファの順、それぞれ sortOrder, id で安定ソート
  const sortSiblings = (arr: Task[]): Task[] =>
    [...arr].sort((a, b) => {
      // 非バッファを先に
      if (a.isBuffer !== b.isBuffer) return a.isBuffer ? 1 : -1
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.id - b.id
    })

  // 幅優先で code を割り当てる
  const queue: Array<{ parentId: number | null; parentCode: string | null }> = [
    { parentId: null, parentCode: null },
  ]
  while (queue.length > 0) {
    const { parentId, parentCode } = queue.shift()!
    const siblings = sortSiblings(childrenByParent.get(parentId) ?? [])

    let nonBufferIdx = 0
    let bufferIdx = 0
    for (const sib of siblings) {
      let code: string
      if (sib.isBuffer) {
        bufferIdx++
        const bufferLabel = bufferIdx === 1 ? 'B' : `B${bufferIdx}`
        code = parentCode === null ? bufferLabel : `${parentCode}.${bufferLabel}`
      } else {
        nonBufferIdx++
        code = parentCode === null ? `${nonBufferIdx}` : `${parentCode}.${nonBufferIdx}`
      }
      codeMap.set(sib.id, code)
      queue.push({ parentId: sib.id, parentCode: code })
    }
  }

  return codeMap
}

/**
 * code の階層辞書順比較。
 * `1` < `1.1` < `1.2` < `1.10` < `2` < `B` を実現するため、
 * ドット区切りパートを数値優先（数値同士は数値比較、文字列は文字列比較）で比較する。
 */
function compareCode(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const sa = pa[i]
    const sb = pb[i]
    if (sa === undefined) return -1
    if (sb === undefined) return 1
    const na = Number(sa)
    const nb = Number(sb)
    const aIsNum = !Number.isNaN(na) && /^\d+$/.test(sa)
    const bIsNum = !Number.isNaN(nb) && /^\d+$/.test(sb)
    if (aIsNum && bIsNum) {
      if (na !== nb) return na - nb
    } else if (aIsNum && !bIsNum) {
      // 数値パートは文字列パート（"B" 等）より前
      return -1
    } else if (!aIsNum && bIsNum) {
      return 1
    } else {
      if (sa !== sb) return sa < sb ? -1 : 1
    }
  }
  return 0
}

// ─── 公開関数 ───────────────────────────────────────────────────────────

/**
 * タスク別 EVM データを生成する（Requirements 7.1-7.7）。
 *
 * 第一引数の `tasks` は不変として扱い、出力配列は code 階層辞書順でソートされる。
 */
export function rollupTasks(input: RollupTasksInput): ReadonlyArray<TaskEvm> {
  const { project, tasks, members, snapshots, holidays, baseDate } = input
  const projectStart = project.startDate
  const holidaysArr = holidays as Holiday[]

  // 1) code 生成
  const codeMap = buildCodeMap(tasks)

  // 2) member id → name lookup
  const memberNameById = new Map<number, string>()
  for (const m of members) {
    memberNameById.set(m.id, m.name)
  }

  // 3) availabilityRate lookup（pv 計算で使用）
  const availabilityById = new Map<number, number>()
  for (const m of members) {
    availabilityById.set(m.id, m.availabilityRate)
  }

  // 4) 葉タスク → { ev, pv } を先に算出（親ロールアップで参照）
  type LeafMetrics = {
    progress: number
    pv: number
    ev: number
    spi: number | null
  }
  const leafMetricsById = new Map<number, LeafMetrics>()

  for (const t of tasks) {
    if (!t.isLeaf) continue
    if (t.isBuffer) {
      // バッファはロールアップ対象外。pv/ev はゼロ扱いで保持しない。
      continue
    }
    const snap = findLatestSnapshot(t.id, snapshots, baseDate)
    const progressPct = snap?.progressPct ?? 0
    const availability =
      t.assigneeId !== null ? availabilityById.get(t.assigneeId) ?? 1.0 : 1.0
    const pv = calculateTaskPv(t, baseDate, availability, holidaysArr)
    const ev = t.estimateDays * (progressPct / 100)
    const spi: number | null = pv > 0 ? ev / pv : null
    leafMetricsById.set(t.id, { progress: progressPct, pv, ev, spi })
  }

  // 5) 親 → 子孫葉タスク id のマップを作る（深い階層に対応）
  const childrenByParent = new Map<number | null, Task[]>()
  for (const t of tasks) {
    const bucket = childrenByParent.get(t.parentId) ?? []
    bucket.push(t)
    childrenByParent.set(t.parentId, bucket)
  }

  function collectDescendantLeafIds(taskId: number): number[] {
    const out: number[] = []
    const stack: number[] = [taskId]
    while (stack.length > 0) {
      const cur = stack.pop()!
      const children = childrenByParent.get(cur) ?? []
      for (const c of children) {
        if (c.isLeaf) {
          if (!c.isBuffer) out.push(c.id)
        } else {
          stack.push(c.id)
        }
      }
    }
    return out
  }

  // 6) 各タスクの TaskEvm を生成
  const result: TaskEvm[] = tasks.map((t) => {
    const code = codeMap.get(t.id) ?? `${t.id}`
    const start = t.plannedStart !== null ? diffDaysInt(projectStart, t.plannedStart) : 0
    const end =
      t.plannedEnd !== null ? diffDaysInt(projectStart, t.plannedEnd) : start

    const assignee =
      !t.isBuffer && t.assigneeId !== null
        ? memberNameById.get(t.assigneeId) ?? null
        : null

    if (t.isBuffer) {
      // バッファ: ロールアップ対象外。progress=0, spi=null で保持。
      return {
        id: t.id,
        code,
        name: t.name,
        level: t.level,
        start,
        end,
        progress: 0,
        spi: null,
        assignee: null,
        leaf: t.isLeaf,
        buffer: true,
        bac: t.estimateDays,
      }
    }

    if (t.isLeaf) {
      const m = leafMetricsById.get(t.id)
      const progress = m?.progress ?? 0
      const spi = m?.spi ?? null
      return {
        id: t.id,
        code,
        name: t.name,
        level: t.level,
        start,
        end,
        progress,
        spi,
        assignee,
        leaf: true,
        bac: t.estimateDays,
      }
    }

    // 親タスク: 子孫葉タスク（非バッファ）の BAC 加重平均
    const leafIds = collectDescendantLeafIds(t.id)
    let bacSum = 0
    let progressWeighted = 0
    let evSum = 0
    let pvSum = 0
    for (const lid of leafIds) {
      const lm = leafMetricsById.get(lid)
      if (!lm) continue
      const leafTask = tasks.find((x) => x.id === lid)
      const leafBac = leafTask?.estimateDays ?? 0
      bacSum += leafBac
      progressWeighted += leafBac * lm.progress
      evSum += lm.ev
      pvSum += lm.pv
    }
    const progress = bacSum > 0 ? progressWeighted / bacSum : 0
    const spi: number | null = pvSum > 0 ? evSum / pvSum : null

    return {
      id: t.id,
      code,
      name: t.name,
      level: t.level,
      start,
      end,
      progress,
      spi,
      assignee: null,
      leaf: false,
      bac: t.estimateDays,
    }
  })

  // 7) code の階層辞書順で安定ソート
  // Array.prototype.sort は不安定なため、元 index をタイブレーカに使う
  const indexed = result.map((r, i) => ({ r, i }))
  indexed.sort((a, b) => {
    const c = compareCode(a.r.code, b.r.code)
    return c !== 0 ? c : a.i - b.i
  })
  return indexed.map((x) => x.r)
}

// ─── 前日比 (Requirement 2.5) ─────────────────────────────────────────────

/**
 * 前日比タスク差分の最小エントリ。`prevDay.tasks` 用に
 * 進捗とSPI のみを返す（要件 2.5）。
 */
export interface TaskPrevDiff {
  id: number
  progress: number
  spi: number | null
}

export interface RollupTasksPrevDiffInput {
  project: Pick<Project, 'startDate'>
  tasks: ReadonlyArray<Task>
  members: ReadonlyArray<Member>
  snapshots: ReadonlyArray<ProgressSnapshot>
  holidays: ReadonlyArray<Holiday>
  prevDate: string
}

/**
 * `prevDate` 時点のスナップショットを反映したタスク進捗差分を返す（要件 2.5）。
 *
 * - 内部で `rollupTasks` を `baseDate = prevDate` で実行する
 * - 葉タスクのうち `prevDate` 以前にスナップショットが存在するもののみを残す
 * - 返却は `{ id, progress, spi }` の最小エントリで、`rollupTasks` の安定ソート順を保つ
 */
export function rollupTasksPrevDiff(
  input: RollupTasksPrevDiffInput,
): ReadonlyArray<TaskPrevDiff> {
  const { project, tasks, members, snapshots, holidays, prevDate } = input

  const rolled = rollupTasks({
    project,
    tasks,
    members,
    snapshots,
    holidays,
    baseDate: prevDate,
  })

  // prevDate 以前にスナップショットが存在する taskId 集合
  const taskIdsWithSnapshot = new Set<number>()
  for (const s of snapshots) {
    if (s.snapshotDate <= prevDate) {
      taskIdsWithSnapshot.add(s.taskId)
    }
  }

  const out: TaskPrevDiff[] = []
  for (const r of rolled) {
    if (!r.leaf) continue
    if (!taskIdsWithSnapshot.has(r.id)) continue
    out.push({ id: r.id, progress: r.progress, spi: r.spi })
  }
  return out
}

// ─── アラート判定 (Requirements 4.1-4.6, 13.4) ────────────────────────────

/**
 * アラート 1 件分。葉タスクの `spi` 閾値判定で生成される（要件 4.1-4.6）。
 *
 * - `< 0.8` → `'critical'`
 * - `[0.8, 0.9)` → `'warning'`
 * - `>= 0.9` または `null` は対象外（要件 4.4）
 */
export interface AlertEntry {
  taskId: number
  taskName: string
  assigneeName: string | null
  spi: number
  level: 'warning' | 'critical'
}

/**
 * タスクリストから SPI 閾値ベースのアラートを抽出する（要件 4.1-4.6, 13.4）。
 *
 * - 入力は `rollupTasks` の出力を想定する
 * - 葉タスク（`leaf === true`）かつ `spi !== null` のもののみが対象
 * - `spi` 昇順（重大度高い順）で安定ソートして返す
 * - 該当が 0 件のとき空配列 `[]` を返す
 */
export function filterAlerts(
  tasks: ReadonlyArray<TaskEvm>,
): ReadonlyArray<AlertEntry> {
  const entries: AlertEntry[] = []
  for (const t of tasks) {
    if (!t.leaf) continue
    if (t.spi === null) continue
    if (t.spi >= 0.9) continue
    const level: 'warning' | 'critical' = t.spi < 0.8 ? 'critical' : 'warning'
    entries.push({
      taskId: t.id,
      taskName: t.name,
      assigneeName: t.assignee,
      spi: t.spi,
      level,
    })
  }

  // spi 昇順で安定ソート（同値は入力順を保つ）
  const indexed = entries.map((e, i) => ({ e, i }))
  indexed.sort((a, b) => {
    if (a.e.spi !== b.e.spi) return a.e.spi - b.e.spi
    return a.i - b.i
  })
  return indexed.map((x) => x.e)
}
