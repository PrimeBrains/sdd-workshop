/**
 * Task 2.5: GanttChart
 *
 * モックアップ `mockup/shared.jsx` 行 487-747 の `Gantt` 関数を TSX 化。
 * - 基準日縦線・雷線 (進捗ライン) ・SPI トーン色分けバー・WBS インデント
 * - props: tasks / gantt(range) / selectedTaskId / onTaskClick / onFullscreen / width / labelW / rowH / showInfoCols
 * - `tasks.length === 0` の場合「タスクがありません」を表示
 * - 「全画面で見る」ボタンは props で渡された場合のみ親のヘッダ側で表示する想定（このコンポーネントはチャート本体のみ）
 */

import React, { useRef } from 'react'
import { EVM } from '@/tokens/evm-tokens'
import { spiTone } from '@/lib/formatters'
import type { TaskEvm, GanttMeta } from '@/types/workbench'

export interface GanttChartProps {
  tasks: ReadonlyArray<TaskEvm>
  gantt: GanttMeta
  /** チャートの幅 (px)。デフォルト 1100 */
  width?: number
  /** WBS ラベル列の幅 (px)。デフォルト 290 */
  labelW?: number
  /** 行高 (px)。デフォルト 26 */
  rowH?: number
  /** 工数 / 期間 / 進捗の補助カラムを表示するか。デフォルト false */
  showInfoCols?: boolean
  /** 担当者名の表示を抑制する compact モード。デフォルト false */
  compact?: boolean
  selectedTaskId?: number | null
  onTaskClick?: (task: TaskEvm) => void
  /** 「全画面で見る」相当のオプショナルアクション。親側で配置する場合は省略可能 */
  onFullscreen?: () => void
}

// 補助カラム定義 (showInfoCols=true のとき表示)
const INFO_COLS = [
  { key: 'days', label: '工数(MD)', w: 44 },
  { key: 'planned', label: '予定期間', w: 84 },
  { key: 'actual', label: '実績期間', w: 84 },
  { key: 'pct', label: '進捗', w: 44 },
] as const

const INFO_W = INFO_COLS.reduce((s, c) => s + c.w, 0)

// 一意 ID 生成カウンタ (clipPath の id 用)
let _ganttIdCounter = 0

function fmtDay(startISO: string, offset: number | null): string {
  if (offset == null) return '—'
  const parts = startISO.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const dt = new Date(y, m - 1, d + offset)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

export const GanttChart = React.memo(function GanttChart({
  tasks,
  gantt,
  width = 1100,
  labelW = 290,
  rowH = 26,
  showInfoCols = false,
  compact = false,
  selectedTaskId = null,
  onTaskClick,
}: GanttChartProps) {
  const gidRef = useRef<string>('')
  if (gidRef.current === '') {
    gidRef.current = `g${++_ganttIdCounter}`
  }
  const gid = gidRef.current

  if (tasks.length === 0) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: 'center',
          color: EVM.ink3,
          fontStyle: 'italic',
          fontFamily: EVM.fontSerif,
        }}
      >
        タスクがありません
      </div>
    )
  }

  const infoW = showInfoCols ? INFO_W : 0
  const innerW = width - labelW - infoW
  const totalDays = gantt.totalDays
  const dayW = totalDays > 0 ? innerW / totalDays : 0
  const months = gantt.months
  const baseDay = gantt.baseDay
  const startISO = gantt.startISO

  // 雷線: 葉タスク (バッファ・完了除外) の実績進捗 X 座標を収集
  const baseDayX = labelW + infoW + baseDay * dayW
  const thunderPts: Array<{ x: number; y: number; ahead: boolean }> = []
  tasks.forEach((t, i) => {
    if (!t.leaf || t.buffer || t.progress >= 100) return
    const px =
      labelW + infoW + (t.start + (t.end - t.start) * (t.progress / 100)) * dayW
    const py = i * rowH + rowH / 2
    thunderPts.push({ x: px, y: py, ahead: px >= baseDayX })
  })

  // ジグザグパス: 最初の未完了タスク行から開始し、各タスクへ伸び戻る
  let thunderPath = ''
  if (thunderPts.length > 0) {
    const first = thunderPts[0]!
    thunderPath = `M ${baseDayX.toFixed(1)} ${first.y.toFixed(1)}`
    thunderPath += ` H ${first.x.toFixed(1)} H ${baseDayX.toFixed(1)}`
    for (let j = 1; j < thunderPts.length; j++) {
      const pt = thunderPts[j]!
      thunderPath += ` V ${pt.y.toFixed(1)} H ${pt.x.toFixed(1)} H ${baseDayX.toFixed(1)}`
    }
  }
  const totalRowsH = tasks.length * rowH

  return (
    <div
      style={{
        fontFamily: EVM.font,
        fontSize: 12,
        color: EVM.ink2,
        position: 'relative',
      }}
    >
      {/* timeline header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: 28,
          borderBottom: `1px solid ${EVM.rule}`,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: labelW,
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: EVM.ink3,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            WBS
          </span>
        </div>
        {showInfoCols && (
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'flex-end',
              borderLeft: `1px solid ${EVM.rule}`,
            }}
          >
            {INFO_COLS.map((col) => (
              <div
                key={col.key}
                style={{
                  width: col.w,
                  textAlign: 'right',
                  paddingRight: 6,
                  paddingBottom: 4,
                  fontSize: 9,
                  color: EVM.ink3,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderRight: `1px solid ${EVM.rule}`,
                }}
              >
                {col.label}
              </div>
            ))}
          </div>
        )}
        <div style={{ position: 'relative', flex: '1 1 auto', height: '100%' }}>
          {months.map((m, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: m.d * dayW,
                top: 0,
                bottom: 0,
                paddingLeft: 6,
                borderLeft: `1px solid ${EVM.rule}`,
                display: 'flex',
                alignItems: 'flex-end',
                paddingBottom: 4,
                fontSize: 10,
                color: EVM.ink3,
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              {m.l}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div style={{ position: 'relative' }}>
        {/* 基準日 vertical line */}
        <div
          style={{
            position: 'absolute',
            left: baseDayX,
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: `1px dashed rgba(91,142,193,0.45)`,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -1,
              left: -28,
              fontSize: 9,
              color: EVM.brandDeep,
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: EVM.brandSoft,
              padding: '1px 6px',
              borderRadius: 3,
              border: `1px solid ${EVM.brand}`,
            }}
          >
            基準日
          </div>
        </div>

        {/* 雷線 (progress line) SVG overlay */}
        {thunderPath && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
              zIndex: 3,
              overflow: 'visible',
            }}
            width={width}
            height={totalRowsH}
          >
            <defs>
              <clipPath id={`${gid}-clip-behind`}>
                <rect x={0} y={0} width={baseDayX} height={totalRowsH + rowH} />
              </clipPath>
              <clipPath id={`${gid}-clip-ahead`}>
                <rect
                  x={baseDayX}
                  y={0}
                  width={width}
                  height={totalRowsH + rowH}
                />
              </clipPath>
            </defs>
            {/* 遅延部分 (基準日より左): オレンジ */}
            <path
              d={thunderPath}
              fill="none"
              stroke="#d97706"
              strokeWidth="2.5"
              strokeLinejoin="miter"
              strokeLinecap="square"
              clipPath={`url(#${gid}-clip-behind)`}
              opacity="0.9"
            />
            {/* 先行部分 (基準日より右): グリーン */}
            <path
              d={thunderPath}
              fill="none"
              stroke="#2d8a4e"
              strokeWidth="2.5"
              strokeLinejoin="miter"
              strokeLinecap="square"
              clipPath={`url(#${gid}-clip-ahead)`}
              opacity="0.9"
            />
            {/* 各タスクの進捗点に丸 */}
            {thunderPts.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={p.ahead ? '#2d8a4e' : '#d97706'}
                opacity="0.9"
                stroke={EVM.card}
                strokeWidth="1"
              />
            ))}
          </svg>
        )}

        {tasks.map((t, i) => {
          const tone = spiTone(t.spi)
          const barColor = t.buffer
            ? EVM.ink4
            : tone === 'critical'
              ? EVM.crit
              : tone === 'warning'
                ? EVM.warn
                : tone === 'normal'
                  ? '#5b8ec1'
                  : EVM.ink4
          const fillColor = t.buffer
            ? 'transparent'
            : tone === 'critical'
              ? EVM.crit
              : tone === 'warning'
                ? EVM.warn
                : tone === 'normal'
                  ? '#3d6f9f'
                  : EVM.ink4
          const wpx = (t.end - t.start) * dayW
          const fillW = wpx * (t.progress / 100)
          const selected = selectedTaskId === t.id
          const clickable = !!onTaskClick

          return (
            <div
              key={t.id}
              onClick={clickable ? () => onTaskClick!(t) : undefined}
              className={clickable ? 'evm-gantt-row' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: rowH,
                borderBottom: `1px solid ${EVM.ruleSoft}`,
                background: selected
                  ? EVM.brandWash
                  : i % 2 === 0
                    ? EVM.card
                    : EVM.paperWarm,
                cursor: clickable ? 'pointer' : 'default',
                position: 'relative',
                outline: selected ? `1.5px solid ${EVM.brandDeep}` : 'none',
                outlineOffset: '-1.5px',
                transition: 'background 0.12s',
              }}
            >
              {selected && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: EVM.brandDeep,
                  }}
                />
              )}
              <div
                style={{
                  width: labelW,
                  flex: '0 0 auto',
                  paddingLeft: 4 + (t.level - 1) * 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: EVM.fontMono,
                    fontSize: 10,
                    color: EVM.ink3,
                    width: 28,
                    flex: '0 0 auto',
                  }}
                >
                  {t.code}
                </span>
                <span
                  style={{
                    fontWeight: t.leaf ? 400 : 600,
                    color: t.leaf ? EVM.ink2 : EVM.ink,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: '1 1 auto',
                  }}
                >
                  {t.name}
                </span>
                {!compact && t.assignee && (
                  <span
                    style={{
                      fontSize: 10,
                      color: EVM.ink3,
                      flex: '0 0 auto',
                    }}
                  >
                    {t.assignee}
                  </span>
                )}
              </div>
              {showInfoCols && (() => {
                const tone2 = spiTone(t.spi)
                const pctColor = t.buffer
                  ? EVM.ink4
                  : t.progress >= 100
                    ? EVM.ok
                    : tone2 === 'critical'
                      ? EVM.crit
                      : tone2 === 'warning'
                        ? '#8a6c1a'
                        : EVM.ink2
                const actualStartDay = t.progress > 0 ? t.start : null
                const actualEndDay = t.progress >= 100 ? t.end : null
                const plannedStr = `${fmtDay(startISO, t.start)}-${fmtDay(startISO, t.end)}`
                const actualStr =
                  actualStartDay == null
                    ? '—'
                    : `${fmtDay(startISO, actualStartDay)}-${actualEndDay != null ? fmtDay(startISO, actualEndDay) : '…'}`
                return (
                  <div
                    style={{
                      flex: '0 0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      borderLeft: `1px solid ${EVM.ruleSoft}`,
                    }}
                  >
                    {/* 工数 */}
                    <div
                      style={{
                        width: 44,
                        textAlign: 'right',
                        paddingRight: 6,
                        fontFamily: EVM.fontMono,
                        fontSize: 10,
                        color: EVM.ink3,
                        borderRight: `1px solid ${EVM.ruleSoft}`,
                      }}
                    >
                      {t.buffer ? '' : `${t.end - t.start}`}
                    </div>
                    {/* 予定期間 */}
                    <div
                      style={{
                        width: 84,
                        textAlign: 'right',
                        paddingRight: 6,
                        fontFamily: EVM.fontMono,
                        fontSize: 10,
                        color: EVM.ink3,
                        borderRight: `1px solid ${EVM.ruleSoft}`,
                      }}
                    >
                      {t.buffer ? '' : plannedStr}
                    </div>
                    {/* 実績期間 */}
                    <div
                      style={{
                        width: 84,
                        textAlign: 'right',
                        paddingRight: 6,
                        fontFamily: EVM.fontMono,
                        fontSize: 10,
                        color: EVM.ink3,
                        borderRight: `1px solid ${EVM.ruleSoft}`,
                      }}
                    >
                      {t.buffer ? '' : actualStr}
                    </div>
                    {/* 進捗 */}
                    <div
                      style={{
                        width: 44,
                        textAlign: 'right',
                        paddingRight: 6,
                        fontFamily: EVM.fontMono,
                        fontSize: 10,
                        fontWeight: 600,
                        color: pctColor,
                      }}
                    >
                      {t.buffer ? '' : `${t.progress}%`}
                    </div>
                  </div>
                )
              })()}
              <div
                style={{
                  position: 'relative',
                  flex: '1 1 auto',
                  height: '100%',
                }}
              >
                {t.leaf || t.buffer ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: t.start * dayW,
                      top: (rowH - 14) / 2,
                      width: wpx,
                      height: 14,
                      borderRadius: 3,
                      border: `1px solid ${barColor}`,
                      background: t.buffer
                        ? `repeating-linear-gradient(135deg, ${EVM.ink4} 0 4px, ${EVM.paperWarm} 4px 8px)`
                        : EVM.card,
                      overflow: 'hidden',
                    }}
                  >
                    {!t.buffer && (
                      <div
                        style={{
                          width: fillW,
                          height: '100%',
                          background: fillColor,
                        }}
                      />
                    )}
                  </div>
                ) : (
                  // parent: thin span line
                  <div
                    style={{
                      position: 'absolute',
                      left: t.start * dayW,
                      top: rowH / 2 - 2,
                      width: wpx,
                      height: 4,
                      background: `linear-gradient(90deg, ${EVM.ink2}, ${EVM.ink2})`,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: -1,
                        top: -3,
                        width: 0,
                        height: 0,
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderTop: `5px solid ${EVM.ink2}`,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        right: -1,
                        top: -3,
                        width: 0,
                        height: 0,
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderTop: `5px solid ${EVM.ink2}`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
