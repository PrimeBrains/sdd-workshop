/**
 * Task 4.2 / 4.3: GanttFullscreen
 * Requirements: 7.1-7.11, 8.1-8.7, 17.1, 17.4
 *
 * モックアップ `mockup/variation-a.jsx` 行 903-1363 を TSX 化。
 * - ReactDOM.createPortal で document.body 直下にマウント
 * - ヘッダー: ブランド + 基準日 + 担当者 select + 検索 + フィルターチップ + 閉じる
 * - 担当者フィルター + 検索 + ステータスフィルターを displayTasks 計算ロジックで適用
 * - 葉タスク行クリックで progressTask セット → 右側 440px に ProgressInputPanel をホスト
 * - Esc キー: progressTask があれば閉じるだけ、なければ onClose()
 * - body スクロールロック + アンマウント時復元
 */

import { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'
import { trpc } from '@/lib/trpc'
import { EVM } from '@/tokens/evm-tokens'
import { BrandMark } from '@/components/atoms/BrandMark'
import { FilterChip } from '@/components/atoms/FilterChip'
import { GanttChart } from '@/components/gantt/GanttChart'
import ProgressInputPanel from '@/components/gantt/ProgressInputPanel'
import type {
  ProgressInputTask,
  ProgressSnapshot,
} from '@/components/gantt/progress-input-panel-types'
import { dateOffsetToISO } from '@/lib/formatters'
import { deriveAncestors } from '@/lib/task-tree'
import type {
  AssigneeEvm,
  GanttMeta,
  TaskEvm,
  WorkbenchProject,
} from '@/types/workbench'

export type GanttFullscreenFilter =
  | 'all'
  | 'delayed'
  | 'notdone'
  | 'todo'
  | 'inprogress'
  | 'done'

export interface GanttFullscreenProps {
  project: WorkbenchProject
  tasks: ReadonlyArray<TaskEvm>
  assignees: ReadonlyArray<AssigneeEvm>
  gantt: GanttMeta
  selectedTaskId: number | null
  filter: GanttFullscreenFilter
  baseDate: string
  onSelectTask: (taskId: number) => void
  onFilterChange: (next: GanttFullscreenFilter) => void
  onClose: () => void
}

/** ステータスフィルターを適用 */
function applyStatusFilter(
  tasks: ReadonlyArray<TaskEvm>,
  filter: GanttFullscreenFilter,
): ReadonlyArray<TaskEvm> {
  return tasks.filter((t) => {
    if (filter === 'all') return true
    if (filter === 'delayed') return t.spi !== null && t.spi < 0.9
    if (filter === 'notdone') return (t.leaf || t.buffer) && t.progress < 100
    if (filter === 'inprogress')
      return (t.leaf || t.buffer) && t.progress > 0 && t.progress < 100
    if (filter === 'todo') return (t.leaf || t.buffer) && t.progress === 0
    if (filter === 'done') return (t.leaf || t.buffer) && t.progress === 100
    return true
  })
}

/** 与えられた `code` 配列について、すべての親プレフィックスコード集合を返す */
function collectParentCodes(codes: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const code of codes) {
    const parts = code.split('.')
    for (let i = 1; i < parts.length; i++) {
      out.add(parts.slice(0, i).join('.'))
    }
  }
  return out
}

export function GanttFullscreen({
  project,
  tasks,
  assignees,
  gantt,
  selectedTaskId,
  filter,
  baseDate,
  onSelectTask,
  onFilterChange,
  onClose,
}: GanttFullscreenProps) {
  const [ganttW, setGanttW] = useState<number>(() =>
    Math.max(typeof window !== 'undefined' ? window.innerWidth - 200 : 1600, 1400),
  )
  const [progressTask, setProgressTask] = useState<TaskEvm | null>(null)
  const [snapshotDate, setSnapshotDate] = useState<string>(baseDate)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)

  const utils = trpc.useUtils()

  // ── 副作用: Esc / リサイズ / body スクロールロック ─────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (progressTask) setProgressTask(null)
        else onClose()
      }
    }
    const onResize = () => setGanttW(Math.max(window.innerWidth - 200, 1400))
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.body.style.overflow = prev
    }
  }, [onClose, progressTask])

  // 担当者ごとの未完了タスク数
  const incompleteByAssignee = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of tasks) {
      if (t.leaf && !t.buffer && t.progress < 100 && t.assignee) {
        map[t.assignee] = (map[t.assignee] || 0) + 1
      }
    }
    return map
  }, [tasks])

  // 担当者フィルター適用後の基底タスク集合（カウント計算用）
  const baseTasks = useMemo<ReadonlyArray<TaskEvm>>(() => {
    return assigneeFilter ? tasks.filter((t) => t.assignee === assigneeFilter) : tasks
  }, [tasks, assigneeFilter])

  // ステータスフィルター + 担当者フィルター（マッチした葉タスクの親階層も含める）
  const filtered = useMemo<ReadonlyArray<TaskEvm>>(() => {
    const statusFiltered = applyStatusFilter(baseTasks, filter)
    if (!assigneeFilter) return statusFiltered
    const includedCodes = new Set(statusFiltered.map((t) => t.code))
    const parentCodes = collectParentCodes(includedCodes)
    return tasks.filter((t) => includedCodes.has(t.code) || parentCodes.has(t.code))
  }, [tasks, baseTasks, filter, assigneeFilter])

  // 検索クエリ適用 (コード or 名前一致 + 親階層含む)
  const displayTasks = useMemo<ReadonlyArray<TaskEvm>>(() => {
    const q = searchQuery.trim()
    if (!q) return filtered
    const matched = filtered.filter((t) => t.code.startsWith(q) || t.name.includes(q))
    const matchedCodes = new Set(matched.map((t) => t.code))
    const parentCodes = collectParentCodes(matchedCodes)
    return filtered.filter((t) => matchedCodes.has(t.code) || parentCodes.has(t.code))
  }, [filtered, searchQuery])

  // 各フィルターチップのカウント
  const counts = useMemo(() => {
    return {
      all: baseTasks.length,
      delayed: baseTasks.filter((t) => t.spi !== null && t.spi < 0.9).length,
      notdone: baseTasks.filter((t) => (t.leaf || t.buffer) && t.progress < 100).length,
      todo: baseTasks.filter((t) => (t.leaf || t.buffer) && t.progress === 0).length,
      inprogress: baseTasks.filter(
        (t) => (t.leaf || t.buffer) && t.progress > 0 && t.progress < 100,
      ).length,
      done: baseTasks.filter((t) => (t.leaf || t.buffer) && t.progress === 100).length,
    }
  }, [baseTasks])

  // ── ハンドラ ───────────────────────────────────────────────────────────────
  const handleTaskClick = (t: TaskEvm) => {
    onSelectTask(t.id)
    if (t.leaf && !t.buffer) {
      setProgressTask(t)
    }
  }

  const handleAssigneeFilterChange = (next: string | null) => {
    setAssigneeFilter(next)
    setProgressTask(null) // 担当者フィルター変更時はパネルを閉じる (要件 4.3)
  }

  const handleSaved = (_snapshot: ProgressSnapshot) => {
    // 保存成功時に EVM キャッシュを無効化 → 親 useEvm が refetch
    void utils.evm.calculate.invalidate()
  }

  // ── 進捗パネル: ProgressInputTask シェイプに変換 ──────────────────────────
  const ancestors = useMemo(() => {
    if (!progressTask) return [] as Array<{ id: number; name: string }>
    return deriveAncestors(progressTask, tasks)
  }, [progressTask, tasks])

  const progressInputTask: ProgressInputTask | null = useMemo(() => {
    if (!progressTask) return null
    return {
      id: progressTask.id,
      code: progressTask.code,
      name: progressTask.name,
      assigneeName: progressTask.assignee,
      plannedStart: dateOffsetToISO(project.startDate, progressTask.start),
      plannedEnd: dateOffsetToISO(project.startDate, progressTask.end),
      bac: progressTask.bac,
      spi: progressTask.spi,
      ancestors,
    }
  }, [progressTask, project.startDate, ancestors])

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(20, 18, 14, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 32,
        animation: 'evmFadeIn 0.18s ease-out',
      }}
    >
      <style>{`
        @keyframes evmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes evmSlideUp { from { opacity: 0; transform: translateY(8px) scale(0.99) } to { opacity: 1; transform: none } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 2100,
          background: EVM.card,
          borderRadius: 8,
          boxShadow: '0 24px 80px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'evmSlideUp 0.22s cubic-bezier(.2,.7,.3,1)',
          fontFamily: EVM.font,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: `1px solid ${EVM.rule}`,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            background: EVM.card,
            flex: '0 0 auto',
          }}
        >
          <BrandMark size={22} />
          <div style={{ width: 1, height: 22, background: EVM.rule }} />
          <div>
            <div
              style={{
                fontSize: 10,
                color: EVM.ink3,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Tasks · WBS · Fullscreen
            </div>
            <div
              style={{
                fontFamily: EVM.fontSerif,
                fontSize: 18,
                color: EVM.ink,
                marginTop: 2,
                lineHeight: 1.1,
              }}
            >
              {project.name}
            </div>
          </div>
          <div style={{ width: 1, height: 30, background: EVM.rule }} />
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              fontSize: 11.5,
              color: EVM.ink2,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: EVM.ink3,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              基準日
            </span>
            <span
              style={{
                fontFamily: EVM.fontMono,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {baseDate}
            </span>
          </div>
          <div style={{ width: 1, height: 22, background: EVM.rule }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span
              style={{
                fontSize: 10,
                color: EVM.ink3,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              担当者
            </span>
            <select
              value={assigneeFilter || ''}
              onChange={(e) => handleAssigneeFilterChange(e.target.value || null)}
              style={{
                padding: '4px 10px',
                border: `1px solid ${assigneeFilter ? EVM.brand : EVM.rule}`,
                borderRadius: 4,
                background: assigneeFilter ? EVM.brandSoft : EVM.paperWarm,
                fontFamily: EVM.font,
                fontSize: 12,
                color: assigneeFilter ? EVM.brandDeep : EVM.ink,
                fontWeight: assigneeFilter ? 600 : 400,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">全員</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}　未完 {incompleteByAssignee[a.name] || 0}件
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }} />

          {/* タスク検索 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              style={{ color: EVM.ink3, flexShrink: 0 }}
            >
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M9.5 9.5L12.5 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="コード / タスク名"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: 160,
                padding: '4px 8px',
                border: `1px solid ${searchQuery ? EVM.brand : EVM.rule}`,
                borderRadius: 4,
                background: searchQuery ? EVM.brandSoft : EVM.paperWarm,
                fontFamily: EVM.fontMono,
                fontSize: 12,
                color: searchQuery ? EVM.brandDeep : EVM.ink,
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: EVM.ink3,
                  padding: '0 2px',
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ width: 1, height: 22, background: EVM.rule }} />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <FilterChip active={filter === 'all'} onClick={() => onFilterChange('all')}>
              すべて · {counts.all}
            </FilterChip>
            <FilterChip
              active={filter === 'delayed'}
              onClick={() => onFilterChange('delayed')}
              tone={counts.delayed > 0 ? 'warn' : 'default'}
            >
              遅延 {counts.delayed}
            </FilterChip>
            <FilterChip
              active={filter === 'notdone'}
              onClick={() => onFilterChange('notdone')}
            >
              完了以外 {counts.notdone}
            </FilterChip>
            <FilterChip active={filter === 'todo'} onClick={() => onFilterChange('todo')}>
              未着手 {counts.todo}
            </FilterChip>
            <FilterChip
              active={filter === 'inprogress'}
              onClick={() => onFilterChange('inprogress')}
            >
              進行中 {counts.inprogress}
            </FilterChip>
            <FilterChip active={filter === 'done'} onClick={() => onFilterChange('done')}>
              完了 {counts.done}
            </FilterChip>
          </div>

          <div style={{ width: 1, height: 22, background: EVM.rule }} />

          <button
            type="button"
            onClick={onClose}
            title="閉じる (Esc)"
            className="evm-icon-btn"
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              marginLeft: 4,
              background: EVM.paperWarm,
              border: `1px solid ${EVM.rule}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: EVM.ink2,
              fontFamily: 'inherit',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3 L11 11 M11 3 L3 11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: '1 1 auto',
            display: 'flex',
            overflow: 'hidden',
            background: EVM.paperWarm,
          }}
        >
          {/* Gantt area */}
          <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '20px 28px' }}>
            <div
              style={{
                background: EVM.card,
                border: `1px solid ${EVM.rule}`,
                borderRadius: 6,
                padding: '8px 16px 16px',
              }}
            >
              {displayTasks.length === 0 ? (
                <div
                  style={{
                    padding: 60,
                    textAlign: 'center',
                    color: EVM.ink3,
                    fontStyle: 'italic',
                    fontFamily: EVM.fontSerif,
                  }}
                >
                  該当するタスクはありません
                </div>
              ) : (
                <GanttChart
                  tasks={displayTasks}
                  gantt={gantt}
                  width={ganttW}
                  labelW={460}
                  rowH={34}
                  showInfoCols={true}
                  selectedTaskId={selectedTaskId}
                  onTaskClick={handleTaskClick}
                />
              )}
            </div>
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
                color: EVM.ink3,
              }}
            >
              <span style={{ fontStyle: 'italic', fontFamily: EVM.fontSerif }}>
                {progressTask
                  ? `「${progressTask.name}」の進捗を入力中`
                  : assigneeFilter
                    ? `${assigneeFilter} · ${filtered.length}件表示 — 行をクリックして進捗を入力`
                    : '行をクリックして進捗を入力'}
              </span>
              <span>
                <kbd
                  style={{
                    background: EVM.card,
                    border: `1px solid ${EVM.rule}`,
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontFamily: EVM.fontMono,
                    fontSize: 10,
                    color: EVM.ink2,
                  }}
                >
                  Esc
                </kbd>
                {progressTask ? ' でパネルを閉じる' : ' でモーダルを閉じる'}
              </span>
            </div>
          </div>

          {/* Progress input panel */}
          {progressTask && progressInputTask && (
            <aside
              style={{
                width: 440,
                flex: '0 0 auto',
                background: EVM.card,
                borderLeft: `1px solid ${EVM.rule}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <ProgressInputPanel
                task={progressInputTask}
                projectStartISO={project.startDate}
                baseDate={baseDate}
                snapshotDate={snapshotDate}
                onSnapshotDateChange={setSnapshotDate}
                onClose={() => setProgressTask(null)}
                onSaved={handleSaved}
              />
            </aside>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
