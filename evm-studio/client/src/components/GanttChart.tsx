import type { GanttTaskOutput } from '../../../server/src/api/evm'

interface GanttChartProps {
  tasks: GanttTaskOutput[]
  baseDate: string
  onProgressUpdate?: (taskId: number, progressPct: number) => void
  onTaskReschedule?: (taskId: number, start: string, end: string) => void
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function spiBarColor(task: GanttTaskOutput): string {
  if (task.isBuffer) return 'bg-gray-300'
  if (task.spi === null) return 'bg-blue-300'
  if (task.spi < 0.8) return 'bg-red-500'
  if (task.spi < 0.9) return 'bg-yellow-400'
  return 'bg-blue-500'
}

export default function GanttChart({ tasks, baseDate, onProgressUpdate, onTaskReschedule }: GanttChartProps) {
  // onProgressUpdate / onTaskReschedule が undefined のとき編集無効 (REQ 10.8)
  const _isReadOnly = !onProgressUpdate && !onTaskReschedule

  if (tasks.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">タスクデータがありません</p>
  }

  const dates = tasks.flatMap(t => [t.plannedStart, t.plannedEnd]).filter(Boolean)
  const minDate = dates.reduce((a, b) => (a < b ? a : b))
  const maxDate = dates.reduce((a, b) => (a > b ? a : b))
  const totalDays = Math.max(daysBetween(minDate, maxDate), 1)

  const toPercent = (date: string) =>
    Math.max(0, Math.min(100, (daysBetween(minDate, date) / totalDays) * 100))

  const baseDatePct = (daysBetween(minDate, baseDate) / totalDays) * 100
  // タイムライン範囲内の場合のみ稲妻線を表示 (REQ 10.3)
  const showThunderLine = baseDatePct >= 0 && baseDatePct <= 100

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="flex text-xs text-gray-500 mb-1">
          <div className="w-48 shrink-0 font-semibold">タスク名</div>
          <div className="flex-1 relative h-4">
            <span className="absolute left-0">{minDate}</span>
            <span className="absolute right-0">{maxDate}</span>
          </div>
        </div>

        {/* Task rows */}
        {tasks.map(task => {
          const leftPct = toPercent(task.plannedStart)
          const widthPct = Math.max(0.5, toPercent(task.plannedEnd) - leftPct)
          const barColor = spiBarColor(task)
          // isBuffer → ストライプスタイル (REQ 10.7)
          const bufferStripeStyle = task.isBuffer
            ? {
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)',
              }
            : {}

          return (
            <div
              key={task.id}
              className="flex items-center h-8 border-b border-gray-100 hover:bg-gray-50"
            >
              {/* 左ラベル列: タスク名・担当者名、level に応じたインデント (REQ 10.5, 10.6) */}
              <div
                className="w-48 shrink-0 pr-2 overflow-hidden"
                style={{ paddingLeft: `${(task.level - 1) * 12 + 4}px` }}
              >
                <div className="text-xs font-medium truncate text-gray-800">{task.name}</div>
                {task.assigneeName && (
                  <div className="text-xs text-gray-400 truncate leading-none">
                    {task.assigneeName}
                  </div>
                )}
              </div>

              {/* タイムラインバー領域 (REQ 10.1) */}
              <div className="flex-1 relative h-5">
                {/* 稲妻線 (REQ 10.3) */}
                {showThunderLine && (
                  <div
                    className="absolute top-0 h-full w-px bg-orange-500 z-10"
                    style={{ left: `${baseDatePct}%` }}
                  />
                )}

                {/* バックグラウンドバー（計画スパン全体）*/}
                <div
                  className={`absolute top-1 h-3 rounded opacity-30 ${barColor}`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    ...bufferStripeStyle,
                  }}
                />

                {/* 進捗フィル: barWidth * (progressPct / 100) (REQ 10.2) */}
                <div
                  className={`absolute top-1 h-3 rounded ${barColor}`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct * (task.progressPct / 100)}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
