/**
 * Task 2.8: Inspector shell
 *
 * 上部に TabBar をレンダリングし、`mode` に応じて 3 つのモードのいずれかを表示する。
 * モックアップ `variation-a.jsx` 行 572-624 (Inspector の TabBar / 共通枠) を 1:1 で移植。
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'
import { InspectorMemberMode } from '@/components/inspector/InspectorMemberMode'
import { InspectorTaskMode } from '@/components/inspector/InspectorTaskMode'
import { InspectorTeamMode } from '@/components/inspector/InspectorTeamMode'
import { type Tone } from '@/lib/formatters'
import type {
  AssigneeEvm,
  DerivedTaskMetrics,
  MemberInfo,
  TaskEvm,
  WorkbenchPrevDay,
  WorkbenchProject,
} from '@/types/workbench'

export type InspectorMode = 'task' | 'member' | 'team'

export interface InspectorProps {
  mode: InspectorMode
  task: TaskEvm
  taskMetrics: DerivedTaskMetrics
  taskTone: Tone
  project: WorkbenchProject
  /** プロジェクト全タスク (Task / Member 両モードで利用) */
  tasks: ReadonlyArray<TaskEvm>
  /** プロジェクト担当者一覧 */
  assignees: ReadonlyArray<AssigneeEvm>
  /** プロジェクトメンバー (役職等の補助情報用) */
  members: ReadonlyArray<MemberInfo>
  /** Member モードで参照するメンバー ID */
  memberId: number | null
  compareMode: boolean
  prevDay: WorkbenchPrevDay
  /** Compare mode 用に前日値から derive した taskMetrics (Task モードで参照、任意) */
  prevTaskMetrics?: DerivedTaskMetrics | null
  onSwitchTask: () => void
  onSwitchMember: (assignee: AssigneeEvm | null) => void
  onSwitchTeam: () => void
}

interface TabBarProps {
  mode: InspectorMode
  memberData: AssigneeEvm | null
  onSwitchTask: () => void
  onSwitchMember: (assignee: AssigneeEvm | null) => void
  onSwitchTeam: () => void
}

const TabBar = React.memo(function TabBar({
  mode,
  memberData,
  onSwitchTask,
  onSwitchMember,
  onSwitchTeam,
}: TabBarProps) {
  const tabs: ReadonlyArray<[InspectorMode, string]> = [
    ['task', 'Task'],
    ['member', 'Member'],
    ['team', 'Team'],
  ]
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: `1px solid ${EVM.rule}`,
        flex: '0 0 auto',
      }}
    >
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`evm-tab${mode === key ? ' active' : ''}`}
          onClick={() => {
            if (key === 'task') onSwitchTask()
            else if (key === 'team') onSwitchTeam()
            else onSwitchMember(memberData)
          }}
          style={{
            flex: 1,
            padding: '10px 0',
            border: 0,
            borderBottom: `2px solid ${mode === key ? EVM.brandDeep : 'transparent'}`,
            background: 'transparent',
            color: mode === key ? EVM.brandDeep : EVM.ink3,
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: mode === key ? 700 : 500,
            cursor: 'pointer',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
})

export const Inspector = React.memo(function Inspector({
  mode,
  task,
  taskMetrics,
  taskTone,
  project,
  tasks,
  assignees,
  members,
  memberId,
  compareMode,
  prevDay,
  prevTaskMetrics = null,
  onSwitchTask,
  onSwitchMember,
  onSwitchTeam,
}: InspectorProps) {
  const memberData = memberId != null ? assignees.find((a) => a.id === memberId) ?? null : null
  const memberInfo = memberData
    ? members.find((m) => m.name === memberData.name) ?? null
    : null

  return (
    <aside
      data-testid={`inspector-${mode}`}
      style={{
        width: 380,
        flex: '0 0 auto',
        background: EVM.card,
        borderLeft: `1px solid ${EVM.rule}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TabBar
        mode={mode}
        memberData={memberData}
        onSwitchTask={onSwitchTask}
        onSwitchMember={onSwitchMember}
        onSwitchTeam={onSwitchTeam}
      />

      {mode === 'task' && (
        <InspectorTaskMode
          task={task}
          taskMetrics={taskMetrics}
          taskTone={taskTone}
          project={project}
          tasks={tasks}
          assignees={assignees}
          compareMode={compareMode}
          prevDay={prevDay}
          prevTaskMetrics={prevTaskMetrics}
          onSwitchMember={(a) => onSwitchMember(a)}
        />
      )}

      {mode === 'member' && (
        <InspectorMemberMode
          memberData={memberData}
          memberInfo={memberInfo}
          tasks={tasks}
          compareMode={compareMode}
          prevDay={prevDay}
        />
      )}

      {mode === 'team' && (
        <InspectorTeamMode
          assignees={assignees}
          members={members}
          compareMode={compareMode}
          prevDay={prevDay}
          onSwitchMember={(a) => onSwitchMember(a)}
        />
      )}
    </aside>
  )
})
