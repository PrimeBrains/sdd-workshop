import type { Holiday, Member, ProgressSnapshot, Task } from '../db/schema.js'
import { calculateTaskPv } from './evm-engine.js'

/**
 * 担当者別 EVM 集計（Requirements 3.1-3.10）。
 *
 * - メンバーごとに `assigneeId` が一致する非バッファタスクを集約し、
 *   `bac` / `ev` / `pv` / `ac` の合計と派生指標 `spi` / `cpi` / `status` を返す。
 * - `pv` は `calculateTaskPv` を再利用し、メンバーの `availabilityRate` を採用する。
 * - `ev` はタスク最新スナップショットの `progressPct` を用いて `estimateDays * pct / 100` を合計。
 * - `ac` はタスクごとに最新スナップショットの `acDays` を採用し、メンバー単位で合計する。
 * - `spi` / `cpi`: `pv > 0 && ac > 0` のときのみ算出。それ以外は `null`。
 * - `status`: SPI 閾値で `'critical' (<0.8)` / `'warning' (<0.9)` / `'normal' (>=0.9 または null)`。
 * - 担当タスクなしのメンバーも 1 件返す（全 0、`status='normal'`）。
 *
 * 純粋関数。DB I/O・グローバル変数・現在時刻参照を一切持たない。
 */

export interface AggregateAssigneesInput {
  baseDate: string
  members: ReadonlyArray<Member>
  tasks: ReadonlyArray<Task>
  snapshots: ReadonlyArray<ProgressSnapshot>
  holidays: ReadonlyArray<Holiday>
}

export interface AssigneeEvm {
  id: number
  name: string
  bac: number
  ev: number
  pv: number
  ac: number
  spi: number | null
  cpi: number | null
  status: 'normal' | 'warning' | 'critical'
}

/**
 * 同一タスクの複数スナップショットから最新（snapshotDate 昇順末尾）を返す。
 * 入力 `snapshots` は呼び出し側で `baseDate` 以前に絞り込まれている前提。
 */
function findLatestSnapshot(
  taskId: number,
  snapshots: ReadonlyArray<ProgressSnapshot>,
): ProgressSnapshot | undefined {
  let latest: ProgressSnapshot | undefined
  for (const s of snapshots) {
    if (s.taskId !== taskId) continue
    if (latest === undefined || s.snapshotDate > latest.snapshotDate) {
      latest = s
    }
  }
  return latest
}

/**
 * SPI 値から status（critical / warning / normal）を判定する。
 * - `spi === null` → `'normal'`
 * - `spi < 0.8`    → `'critical'`
 * - `spi < 0.9`    → `'warning'`
 * - それ以外        → `'normal'`
 */
function evaluateStatus(spi: number | null): AssigneeEvm['status'] {
  if (spi === null) return 'normal'
  if (spi < 0.8) return 'critical'
  if (spi < 0.9) return 'warning'
  return 'normal'
}

export function aggregateAssignees(
  input: AggregateAssigneesInput,
): ReadonlyArray<AssigneeEvm> {
  const { baseDate, members, tasks, snapshots, holidays } = input

  // バッファタスクはロールアップから除外する
  const nonBufferTasks = tasks.filter((t) => !t.isBuffer)
  const holidaysArr = holidays as Holiday[]

  return members.map<AssigneeEvm>((member) => {
    const memberTasks = nonBufferTasks.filter((t) => t.assigneeId === member.id)

    let bac = 0
    let ev = 0
    let pv = 0
    let ac = 0

    for (const task of memberTasks) {
      bac += task.estimateDays

      // PV: タスク単体 PV をメンバー availabilityRate で算出
      pv += calculateTaskPv(task, baseDate, member.availabilityRate, holidaysArr)

      // EV / AC: 最新スナップショット (baseDate 以前) を採用
      const snap = findLatestSnapshot(task.id, snapshots)
      const progressPct = snap?.progressPct ?? 0
      ev += task.estimateDays * (progressPct / 100)
      ac += snap?.acDays ?? 0
    }

    const spi: number | null = pv > 0 && ac > 0 ? ev / pv : null
    const cpi: number | null = pv > 0 && ac > 0 ? ev / ac : null
    const status = evaluateStatus(spi)

    return {
      id: member.id,
      name: member.name,
      bac,
      ev,
      pv,
      ac,
      spi,
      cpi,
      status,
    }
  })
}
