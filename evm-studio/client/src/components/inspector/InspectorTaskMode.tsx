/**
 * Task 2.7: InspectorTaskMode
 *
 * モックアップ `variation-a.jsx` 行 626-737 (Task ブロック) を 1:1 で TSX 移植。
 * - タスクヘッダー (code / name / tone Pill)
 * - 進捗バー + 計画日付
 * - メトリクスグリッド (SPI / CPI / EV / PV / AC / BAC)
 * - タスク SPI Sparkline
 * - 担当者カード (クリックで Member モードへ遷移)
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'
import { Avatar } from '@/components/atoms/Avatar'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Pill } from '@/components/atoms/Pill'
import { SummaryStat } from '@/components/summary/SummaryStat'
import { Sparkline } from '@/components/charts/Sparkline'
import {
  type Tone,
  deltaTone,
  fmtDeltaIdx,
  fmtDeltaMD,
  fmtDeltaPct,
  fmtMD,
  initialsOf,
  spiTone,
  statusColor,
} from '@/lib/formatters'
import type {
  AssigneeEvm,
  DerivedTaskMetrics,
  TaskEvm,
  WorkbenchProject,
  WorkbenchPrevDay,
} from '@/types/workbench'

export interface InspectorTaskModeProps {
  task: TaskEvm
  taskMetrics: DerivedTaskMetrics
  taskTone: Tone
  project: WorkbenchProject
  /** プロジェクトのタスク一覧 (`X / Y` 表示と祖先計算用) */
  tasks: ReadonlyArray<TaskEvm>
  /** プロジェクト担当者一覧 (担当者カード用) */
  assignees: ReadonlyArray<AssigneeEvm>
  compareMode: boolean
  prevDay: WorkbenchPrevDay
  /** Compare mode で前日値から derive した taskMetrics (任意。null なら現在値のみ表示) */
  prevTaskMetrics?: DerivedTaskMetrics | null
  onSwitchMember: (assignee: AssigneeEvm) => void
}

function dateFromOffset(startISO: string, offset: number): string {
  const s = new Date(startISO)
  const d = new Date(s.getTime() + offset * 86400000)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const InspectorTaskMode = React.memo(function InspectorTaskMode({
  task,
  taskMetrics,
  taskTone,
  project,
  tasks,
  assignees,
  compareMode,
  prevDay,
  prevTaskMetrics = null,
  onSwitchMember,
}: InspectorTaskModeProps) {
  const assignee = task.assignee ? assignees.find((a) => a.name === task.assignee) ?? null : null

  // 前日比 derivation
  const prevTaskEntry = compareMode && prevDay ? prevDay.tasks.find((t) => t.id === task.id) ?? null : null
  const dProgress = prevTaskEntry ? task.progress - prevTaskEntry.progress : 0
  const dTaskSPI =
    prevTaskEntry && task.spi != null && prevTaskEntry.spi != null
      ? task.spi - prevTaskEntry.spi
      : null
  const dTaskEV = prevTaskMetrics ? taskMetrics.ev - prevTaskMetrics.ev : 0
  const dTaskPV = prevTaskMetrics ? taskMetrics.pv - prevTaskMetrics.pv : 0
  const dTaskAC = prevTaskMetrics ? taskMetrics.ac - prevTaskMetrics.ac : 0
  const dTaskCpi =
    prevTaskMetrics && taskMetrics.cpi != null && prevTaskMetrics.cpi != null
      ? taskMetrics.cpi - prevTaskMetrics.cpi
      : 0

  const taskIndex = tasks.findIndex((t) => t.id === task.id)
  const sparklineData: number[] =
    task.spi == null
      ? [1, 1, 1, 1, 1, 1]
      : [
          task.spi - 0.08,
          task.spi - 0.06,
          task.spi - 0.04,
          task.spi - 0.02,
          task.spi - 0.01,
          task.spi,
        ]
  const sparklineColor = task.spi == null ? EVM.ink4 : statusColor(taskTone)

  return (
    <>
      <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${EVM.rule}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>Inspector · Task</Eyebrow>
          <span style={{ fontSize: 10, color: EVM.ink4 }}>
            {taskIndex + 1} / {tasks.length}
          </span>
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: EVM.fontMono, fontSize: 11, color: EVM.ink3 }}>{task.code}</span>
          <span
            style={{
              fontFamily: EVM.fontSerif,
              fontSize: 19,
              color: EVM.ink,
              lineHeight: 1.2,
            }}
          >
            {task.name}
          </span>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pill tone={taskTone}>
            {task.spi == null
              ? 'N/A'
              : taskTone === 'normal'
                ? 'On Track'
                : taskTone === 'warning'
                  ? 'Watch'
                  : 'Delayed'}
          </Pill>
          {task.buffer && <Pill>CCPM バッファ</Pill>}
          {!task.leaf && !task.buffer && <Pill>サマリ</Pill>}
          {task.leaf && !task.buffer && <Pill>Leaf</Pill>}
        </div>
      </div>

      {/* Progress */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <Eyebrow>Progress</Eyebrow>
          <span
            style={{
              fontFamily: EVM.fontSerif,
              fontSize: 26,
              color: EVM.ink,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {task.progress}
            <span style={{ fontSize: 14, color: EVM.ink3 }}>%</span>
            {compareMode && prevTaskEntry && (
              <span
                style={{
                  fontSize: 12,
                  marginLeft: 8,
                  color:
                    dProgress > 0 ? EVM.ok : dProgress < 0 ? EVM.crit : EVM.ink4,
                }}
              >
                {fmtDeltaPct(dProgress)}
              </span>
            )}
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: EVM.paperWarm,
            borderRadius: 4,
            overflow: 'hidden',
            border: `1px solid ${EVM.rule}`,
          }}
        >
          <div
            style={{
              width: `${task.progress}%`,
              height: '100%',
              background: EVM.brandDeep,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontSize: 11,
            color: EVM.ink3,
          }}
        >
          <span>{dateFromOffset(project.startDate, task.start)} 開始</span>
          <span>{dateFromOffset(project.startDate, task.end)} 計画終了</span>
        </div>
      </div>

      {/* Metrics */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${EVM.rule}`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        {compareMode && prevTaskMetrics ? (
          <>
            <SummaryStat
              label="SPI"
              value={dTaskSPI != null ? fmtDeltaIdx(dTaskSPI) : 'N/A'}
              tone={dTaskSPI != null ? deltaTone(dTaskSPI) : 'na'}
              sub={task.spi != null ? `現在 ${task.spi.toFixed(2)}` : undefined}
            />
            <SummaryStat
              label="CPI"
              value={fmtDeltaIdx(dTaskCpi)}
              tone="na"
              sub={taskMetrics.cpi != null ? `現在 ${taskMetrics.cpi.toFixed(2)}` : undefined}
            />
            <SummaryStat
              label="EV"
              value={fmtDeltaMD(dTaskEV)}
              tone={deltaTone(dTaskEV)}
              sub={`現在 ${fmtMD(taskMetrics.ev)}`}
            />
            <SummaryStat
              label="PV"
              value={fmtDeltaMD(dTaskPV)}
              tone="na"
              sub={`現在 ${fmtMD(taskMetrics.pv)}`}
            />
            <SummaryStat
              label="AC"
              value={fmtDeltaMD(dTaskAC)}
              tone="na"
              sub={`現在 ${fmtMD(taskMetrics.ac)}`}
            />
            <SummaryStat
              label="BAC"
              value="±0.0 MD"
              tone="na"
              sub={`現在 ${fmtMD(taskMetrics.bac)}`}
            />
          </>
        ) : (
          <>
            <SummaryStat
              label="SPI"
              value={task.spi == null ? 'N/A' : task.spi.toFixed(2)}
              tone={taskTone}
            />
            <SummaryStat
              label="CPI"
              value={taskMetrics.cpi == null ? 'N/A' : taskMetrics.cpi.toFixed(2)}
              tone={taskMetrics.cpi == null ? 'na' : 'normal'}
            />
            <SummaryStat label="EV" value={fmtMD(taskMetrics.ev)} />
            <SummaryStat label="PV" value={fmtMD(taskMetrics.pv)} />
            <SummaryStat label="AC" value={fmtMD(taskMetrics.ac)} />
            <SummaryStat label="BAC" value={fmtMD(taskMetrics.bac)} />
          </>
        )}
      </div>

      {/* Task SPI trend */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}` }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 6,
          }}
        >
          <Eyebrow>Task SPI Trend</Eyebrow>
          <span style={{ fontSize: 10, color: EVM.ink3 }}>
            {task.spi == null
              ? '— → —'
              : `${(task.spi - 0.08).toFixed(2)} → ${task.spi.toFixed(2)}`}
          </span>
        </div>
        <Sparkline data={sparklineData} w={340} h={50} color={sparklineColor} />
      </div>

      {/* Assignee card */}
      <div style={{ padding: '14px 20px', flex: '1 1 auto' }}>
        <Eyebrow style={{ marginBottom: 10 }}>Assignee</Eyebrow>
        {assignee ? (
          <button
            type="button"
            onClick={() => onSwitchMember(assignee)}
            className="evm-assignee-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${EVM.rule}`,
              background: EVM.paperWarm,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'inherit',
              textAlign: 'left',
            }}
          >
            <Avatar initials={initialsOf(assignee.name)} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: EVM.ink, fontWeight: 600 }}>
                {assignee.name}
              </div>
              <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 2 }}>
                EV {fmtMD(assignee.ev)} · BAC {fmtMD(assignee.bac)}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div
                style={{
                  fontFamily: EVM.fontMono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: statusColor(spiTone(assignee.spi)),
                }}
              >
                {assignee.spi != null ? assignee.spi.toFixed(2) : 'N/A'}
              </div>
              <div style={{ fontSize: 9.5, color: EVM.ink3 }}>SPI</div>
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{ flexShrink: 0, color: EVM.ink4 }}
            >
              <path
                d="M4 2 L8 6 L4 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: EVM.ink3,
              fontStyle: 'italic',
              padding: '8px 0',
            }}
          >
            担当者未割当
          </div>
        )}
      </div>
    </>
  )
})
