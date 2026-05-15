/**
 * Task 5.2 - 5.7: ProgressInputPanel コンポーネント
 * Requirements: 6.3 - 6.17
 *
 * GanttFullscreen 内にスライドインする進捗入力パネル。
 * - 進捗率 (slider + 数値) + 計画線マーカー + 差分色分け
 * - AC 入力 (MD/h トグル) + 前回累積 + 本日 + 累積合計 + EV/AC/CPI プレビュー
 * - 任意メモ (≤ 1000 文字)
 * - 保存/キャンセル + dirty 制御 + エラー表示
 *
 * 計画線比較は `calculatePlannedPct` 純関数、MD↔h 変換は `mdToHours` / `hoursToMd` を利用する。
 * 保存は `useRecordProgress` ミューテーション経由で tRPC `progress.record` を呼び出す。
 */

import { useEffect, useState } from 'react'
import { useProgressLatest, useRecordProgress } from '../../hooks/useProgress'
import { calculatePlannedPct } from '../../services/planned-comparison'
import type {
  ProgressInputPanelProps,
  ProgressSnapshot,
} from './progress-input-panel-types'

/** ratePerMd: AC をマネタリ換算するためのプレースホルダ単価 (要件 6.13) */
const RATE_PER_MD = 600_000

/** EV/AC/CPI プレビュー用の簡易マネタリフォーマッタ */
function formatMoney(value: number): string {
  return `${(value / 1_000_000).toFixed(2)}M`
}

/** YYYY-MM-DD の差分日数（snapshot は base 以下を想定） */
function diffInDays(base: string, snapshot: string): number {
  const ms = new Date(base).getTime() - new Date(snapshot).getTime()
  return Math.round(ms / 86_400_000)
}

/** SPI 値から表示トーンを判定（mockup の spiTone と同等の閾値） */
type SpiTone = 'normal' | 'warning' | 'critical' | 'na'
function spiTone(spi: number | null): SpiTone {
  if (spi === null) return 'na'
  if (spi < 0.8) return 'critical'
  if (spi < 0.9) return 'warning'
  return 'normal'
}
function spiLabel(spi: number | null, tone: SpiTone): string {
  if (tone === 'na') return 'N/A'
  if (tone === 'normal') return 'On Track'
  if (tone === 'warning') return 'Watch'
  return 'Delayed'
}
function spiPillClasses(tone: SpiTone): string {
  switch (tone) {
    case 'normal':
      return 'bg-emerald-50 text-emerald-700 border-emerald-300'
    case 'warning':
      return 'bg-amber-50 text-amber-700 border-amber-300'
    case 'critical':
      return 'bg-rose-50 text-rose-700 border-rose-300'
    case 'na':
    default:
      return 'bg-gray-50 text-gray-500 border-gray-300'
  }
}

/** 進捗バー塗り色を diffPct に応じて切り替える */
function progressFillClass(diffPct: number): string {
  if (diffPct >= 0) return 'bg-emerald-600'
  if (diffPct >= -10) return 'bg-amber-500'
  return 'bg-rose-600'
}

/** 差分テキストの文字色 */
function diffTextClass(diffPct: number): string {
  if (diffPct >= 0) return 'text-emerald-700'
  if (diffPct >= -10) return 'text-amber-700'
  return 'text-rose-700'
}

/** tRPC / 汎用エラーから表示用メッセージを抽出 */
function getErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message
    if (typeof msg === 'string' && msg.length > 0) return msg
  }
  return '保存に失敗しました'
}

export default function ProgressInputPanel(props: ProgressInputPanelProps) {
  const {
    task,
    projectStartISO,
    baseDate,
    snapshotDate,
    onSnapshotDateChange,
    onClose,
    onSaved,
  } = props

  // ── 最新スナップショット取得 ──
  const latestQuery = useProgressLatest(task.id)
  const latest: ProgressSnapshot | null | undefined = latestQuery.data

  const prevProgress = latest?.progressPct ?? 0
  const prevAcDays = latest?.acDays ?? 0
  const prevNote = latest?.note ?? ''

  // ── 内部編集ステート ──
  const [progress, setProgress] = useState<number>(prevProgress)
  const [acDaysToday, setAcDaysToday] = useState<number>(0)
  const [note, setNote] = useState<string>(prevNote)
  const [acUnit, setAcUnit] = useState<'MD' | 'h'>('MD')
  const [saveError, setSaveError] = useState<string | null>(null)

  // task.id または snapshotDate 変更時に最新値から再初期化（要件 6.3, 6.4）
  useEffect(() => {
    setProgress(prevProgress)
    setAcDaysToday(0)
    setNote(prevNote)
    setSaveError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, snapshotDate, latest?.id])

  // ── 派生値 ──
  const isPast = snapshotDate < baseDate
  const daysAgo = isPast ? diffInDays(baseDate, snapshotDate) : 0
  const plannedPct = calculatePlannedPct({
    projectStartISO,
    snapshotDate,
    taskPlannedStart: task.plannedStart,
    taskPlannedEnd: task.plannedEnd,
  })
  const diffPct = progress - plannedPct
  const dirty =
    progress !== prevProgress || acDaysToday > 0 || note !== prevNote

  const factor = acUnit === 'h' ? 8 : 1
  const totalAcDays = prevAcDays + acDaysToday
  const evMonetary = (task.bac * progress) / 100
  const acMonetary = totalAcDays * RATE_PER_MD
  const cpi = acMonetary > 0 ? evMonetary / acMonetary : 0

  const tone = spiTone(task.spi)

  // ── 保存 ──
  const recordMutation = useRecordProgress()

  const handleSave = async (): Promise<void> => {
    setSaveError(null)
    try {
      const saved = await recordMutation.mutateAsync({
        taskId: task.id,
        snapshotDate,
        progressPct: progress,
        acDays: prevAcDays + acDaysToday,
        note: note.trim() === '' ? null : note,
      })
      onSaved?.(saved)
      onClose()
    } catch (e) {
      setSaveError(getErrorMessage(e))
    }
  }

  // ── ロード中の skeleton ──
  if (latestQuery.isLoading) {
    return (
      <aside className="w-[440px] flex-none bg-white border-l border-gray-200 flex flex-col">
        <div className="p-5 text-sm text-gray-400">読み込み中…</div>
      </aside>
    )
  }

  // ── ヘッダー色（過去日 = 警告 / 当日 = ブランド） ──
  const headerBg = isPast ? 'bg-amber-50' : 'bg-emerald-50'
  const headerBorder = isPast ? 'border-amber-400' : 'border-emerald-500'
  const headerLabelColor = isPast ? 'text-amber-700' : 'text-emerald-700'

  return (
    <aside className="w-[440px] flex-none bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* ── パネルヘッダー ── (task 5.3) */}
      <div className="px-5 pt-3.5 pb-3 border-b border-gray-200 flex-none">
        <div className="flex items-start justify-between mb-2.5">
          <div
            className={`flex-1 px-3.5 py-2.5 rounded-md border-2 mr-2.5 ${headerBg} ${headerBorder}`}
          >
            <div
              className={`text-[9px] font-bold tracking-widest uppercase mb-1.5 ${headerLabelColor}`}
            >
              記録日 (スナップショット)
            </div>
            <div className="flex items-baseline gap-2">
              <input
                type="date"
                value={snapshotDate}
                max={baseDate}
                onChange={(e) => onSnapshotDateChange(e.target.value)}
                className={`px-1.5 py-0.5 border rounded font-mono text-base font-semibold bg-transparent outline-none ${
                  isPast
                    ? 'border-amber-400 text-amber-800'
                    : 'border-emerald-500 text-emerald-800'
                }`}
              />
              <span
                className={`text-[11px] font-medium ${
                  isPast ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {isPast ? `${daysAgo}日前` : '今日'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6.5 h-6.5 rounded border border-gray-200 bg-gray-50 cursor-pointer text-sm text-gray-500 flex-shrink-0 flex items-center justify-center"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {task.ancestors.length > 0 && (
          <div className="text-[11px] text-gray-500 mb-1 flex items-center gap-1 flex-wrap">
            {task.ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <span>{a.name}</span>
                <span className="text-gray-400">›</span>
              </span>
            ))}
            <span className="text-gray-800 font-semibold">{task.name}</span>
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-gray-500">{task.code}</span>
          {task.ancestors.length === 0 && (
            <span className="font-serif text-lg text-gray-800">{task.name}</span>
          )}
        </div>

        <div className="mt-1.5 flex gap-3 text-[11px] text-gray-500 items-center">
          <span>
            担当 <strong className="text-gray-700">{task.assigneeName ?? '—'}</strong>
          </span>
          <span>
            {task.plannedStart} → {task.plannedEnd}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${spiPillClasses(tone)}`}
          >
            {spiLabel(task.spi, tone)}
          </span>
        </div>
      </div>

      {/* ── スクロール可能フォーム ── */}
      <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3">
        {/* ── 進捗率カード ── (task 5.4) */}
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500">
              進捗率
            </div>
            {dirty && progress !== prevProgress && (
              <span className="text-[10px] text-emerald-700 font-bold">
                {prevProgress}% → {progress}%
              </span>
            )}
          </div>

          <div className="flex items-end gap-3.5">
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(+e.target.value)}
                className="w-full accent-emerald-700"
              />
            </div>
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={progress}
                onChange={(e) =>
                  setProgress(Math.max(0, Math.min(100, +e.target.value || 0)))
                }
                className="w-16 px-2 py-1.5 text-right border border-gray-200 rounded font-serif text-xl text-gray-800 bg-gray-50"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>

          {/* Progress bar with planned-line marker */}
          <div className="mt-2.5 relative">
            <div className="h-2.5 bg-gray-100 rounded border border-gray-200 relative overflow-visible">
              <div
                className={`h-full rounded transition-[width] duration-150 ${progressFillClass(diffPct)}`}
                style={{ width: `${progress}%` }}
              />
              {plannedPct > 0 && plannedPct <= 100 && (
                <div
                  className="absolute -top-1 -bottom-1 w-0.5 bg-gray-700 z-10"
                  style={{ left: `calc(${plannedPct}% - 1px)` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-0.5 text-[9px] text-gray-700 font-bold whitespace-nowrap font-mono bg-white px-1 rounded">
                    計画 {plannedPct}%
                  </div>
                </div>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2.5 text-[10.5px]">
              <span className="flex items-center gap-1 text-gray-500">
                <span className="inline-block w-0.5 h-2.5 bg-gray-700 rounded" />
                今日の計画:{' '}
                <strong className="font-mono text-gray-700">{plannedPct}%</strong>
              </span>
              <span className="text-gray-400">|</span>
              <span className={`font-semibold ${diffTextClass(diffPct)}`}>
                {diffPct === 0
                  ? '計画通り'
                  : diffPct > 0
                    ? `+${diffPct}% 先行`
                    : `${diffPct}% 遅延`}
              </span>
            </div>
          </div>
        </div>

        {/* ── AC 入力カード ── (task 5.5) */}
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500">
              本日のAC追加入力
            </div>
            <div className="flex border border-gray-200 rounded overflow-hidden">
              {(['MD', 'h'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    setAcUnit(u)
                    setAcDaysToday(0)
                  }}
                  className={`px-2.5 py-0.5 border-none cursor-pointer font-mono text-[11px] font-semibold ${
                    acUnit === u
                      ? 'bg-emerald-700 text-white'
                      : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div>
              <div className="text-[10px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">
                {snapshotDate}
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={acDaysToday * factor}
                  onChange={(e) =>
                    setAcDaysToday(
                      Math.max(0, (+e.target.value || 0) / factor),
                    )
                  }
                  className="w-20 px-2.5 py-1.5 text-right border border-gray-200 rounded font-serif text-xl text-gray-800 bg-gray-50"
                />
                <span className="text-[13px] text-gray-500">{acUnit}</span>
              </div>
            </div>
            <div className="pt-5 text-[11px] flex flex-col gap-1">
              <div className="text-gray-500">
                {(prevAcDays * factor).toFixed(1)}{' '}
                <span className="text-gray-400">前回累積</span>
              </div>
              <div className={acDaysToday > 0 ? 'text-emerald-700' : 'text-gray-400'}>
                +{(acDaysToday * factor).toFixed(1)} 本日
              </div>
              <div className="border-t border-gray-200 pt-1 text-gray-800 font-semibold">
                {(totalAcDays * factor).toFixed(1)} 累積合計
              </div>
            </div>
          </div>

          <div className="mt-2.5 p-2 bg-gray-50 rounded text-[11px] text-gray-700 flex gap-3.5">
            <span>
              EV <strong className="font-mono">{formatMoney(evMonetary)}</strong>
            </span>
            <span>
              AC <strong className="font-mono">{formatMoney(acMonetary)}</strong>
            </span>
            <span>
              CPI{' '}
              <strong className="font-mono text-emerald-700">
                {cpi.toFixed(2)}
              </strong>
            </span>
          </div>
        </div>

        {/* ── メモカード ── (task 5.6) */}
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-2">
            メモ · 任意
          </div>
          <textarea
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="進捗の状況・課題・次のアクションなど"
            className="w-full min-h-[72px] p-2 border border-gray-200 rounded bg-gray-50 text-[12.5px] text-gray-800 resize-y outline-none font-sans"
          />
          <div className="mt-1 text-right text-[10px] text-gray-400">
            {note.length} / 1000
          </div>
        </div>
      </div>

      {/* ── フッター ── (task 5.7) */}
      <div className="border-t border-gray-200 flex-none bg-white">
        {saveError !== null && (
          <div className="mx-5 mt-3 px-3 py-2 bg-rose-50 border border-rose-300 text-rose-700 text-[12px] rounded">
            {saveError}
          </div>
        )}
        <div className="px-5 py-3 flex gap-2 items-center">
          <span className="text-[11px] text-gray-500 flex-1">
            {snapshotDate}
            {isPast ? ' · 過去日付' : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded border border-gray-200 bg-transparent text-gray-700 text-[12px] cursor-pointer"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={!dirty || recordMutation.isPending}
            onClick={() => void handleSave()}
            className={`px-4 py-1.5 rounded text-[12px] font-semibold border ${
              dirty && !recordMutation.isPending
                ? 'bg-emerald-700 border-emerald-700 text-white cursor-pointer'
                : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {recordMutation.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </aside>
  )
}
