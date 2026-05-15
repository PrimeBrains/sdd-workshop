/**
 * Task 2.6: FeverChart
 *
 * モックアップ `mockup/shared.jsx` 行 339-452 を TSX 化。
 * - CCPM フィーバーチャート (バッファ消費 vs クリティカルチェーン完了率)
 * - `data === null` のとき「バッファタスク未定義」を表示
 * - 履歴 trail のホバーで過去スナップショットのツールチップ表示
 */

import React, { useState } from 'react'
import { EVM } from '@/tokens/evm-tokens'
import type { FeverChart as FeverChartData } from '@/types/workbench'

export interface FeverChartProps {
  data: FeverChartData | null
  w?: number
  h?: number
  padTop?: number
  padBottom?: number
  padL?: number
  padR?: number
}

type Hovered = null | 'current' | number

export const FeverChart = React.memo(function FeverChart({
  data,
  w = 380,
  h = 280,
  padTop = 18,
  padBottom = 30,
  padL = 40,
  padR = 14,
}: FeverChartProps) {
  const [hovered, setHovered] = useState<Hovered>(null)

  if (data === null) {
    return (
      <div
        style={{
          color: EVM.ink3,
          fontStyle: 'italic',
          fontFamily: EVM.fontSerif,
          padding: 40,
          textAlign: 'center',
        }}
      >
        バッファタスク未定義
        <br />
        <span style={{ fontSize: 11, fontStyle: 'normal' }}>
          CCPM プロジェクトのみ表示
        </span>
      </div>
    )
  }

  const innerW = w - padL - padR
  const innerH = h - padTop - padBottom
  const x = (v: number) => padL + v * innerW
  const y = (v: number) => padTop + (1 - v) * innerH
  const green = `${x(0)},${y(0)} ${x(1)},${y(0.67)} ${x(1)},${y(0)}`
  const yellow = `${x(0)},${y(0)} ${x(1)},${y(1)} ${x(1)},${y(0.67)}`
  const red = `${x(0)},${y(0)} ${x(0)},${y(1)} ${x(1)},${y(1)}`

  const dot = {
    x: data.criticalChainCompletion,
    y: data.bufferConsumption,
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1.0]
  const trail = data.trail ?? []

  const makeTooltip = (
    px: number,
    py: number,
    isCurrent: boolean,
  ): {
    rx: number
    ry: number
    tw: number
    th: number
    px: number
    py: number
    isCurrent: boolean
  } => {
    const tw = 148
    const th = isCurrent ? 74 : 60
    const flipX = x(px) > w - tw - 20
    const flipY = y(py) < padTop + th + 10
    const rx = flipX ? x(px) - tw - 14 : x(px) + 14
    const ry = flipY ? y(py) + 14 : y(py) - th - 14
    return { rx, ry, tw, th, px, py, isCurrent }
  }

  const tooltip =
    hovered === 'current'
      ? makeTooltip(dot.x, dot.y, true)
      : typeof hovered === 'number'
        ? (() => {
            const tp = trail[hovered]
            return tp ? makeTooltip(tp.x, tp.y, false) : null
          })()
        : null

  // current dot を除いた trail 点群 (末尾は current として描画)
  const trailPoints = trail.length > 0 ? trail.slice(0, -1) : []

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {/* Zones */}
      <polygon points={red} fill={EVM.critSoft} opacity="0.7" />
      <polygon points={yellow} fill={EVM.warnSoft} opacity="0.7" />
      <polygon points={green} fill={EVM.brandSoft} opacity="0.7" />
      {/* axes ticks */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={y(0)}
            y2={y(0) + 4}
            stroke={EVM.ink3}
            strokeWidth="1"
          />
          <text
            x={x(t)}
            y={y(0) + 16}
            textAnchor="middle"
            style={{
              fontFamily: EVM.font,
              fontSize: 10,
              fill: EVM.ink3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {(t * 100).toFixed(0)}%
          </text>
          <line
            x1={x(0) - 4}
            x2={x(0)}
            y1={y(t)}
            y2={y(t)}
            stroke={EVM.ink3}
            strokeWidth="1"
          />
          <text
            x={x(0) - 8}
            y={y(t) + 3}
            textAnchor="end"
            style={{
              fontFamily: EVM.font,
              fontSize: 10,
              fill: EVM.ink3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {(t * 100).toFixed(0)}%
          </text>
        </g>
      ))}
      {/* axis lines */}
      <line x1={x(0)} x2={x(1)} y1={y(0)} y2={y(0)} stroke={EVM.ink2} strokeWidth="1" />
      <line x1={x(0)} x2={x(0)} y1={y(0)} y2={y(1)} stroke={EVM.ink2} strokeWidth="1" />
      {/* trail */}
      {trail.length > 1 && (
        <path
          d={trail.map((p, i) => `${i ? 'L' : 'M'} ${x(p.x)} ${y(p.y)}`).join(' ')}
          fill="none"
          stroke={EVM.brandDeep}
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.55"
        />
      )}
      {trailPoints.map((p, i) => (
        <circle
          key={i}
          cx={x(p.x)}
          cy={y(p.y)}
          r={hovered === i ? 5 : 2}
          fill={EVM.brandDeep}
          opacity={0.35 + i * 0.1}
        />
      ))}
      {/* current dot */}
      <circle cx={x(dot.x)} cy={y(dot.y)} r={11} fill={EVM.brand} opacity="0.18" />
      <circle
        cx={x(dot.x)}
        cy={y(dot.y)}
        r={hovered === 'current' ? 8 : 6.5}
        fill={EVM.brandDeep}
        stroke={EVM.card}
        strokeWidth="2.5"
      />
      {/* labels */}
      <text
        x={x(0.5)}
        y={h - 4}
        textAnchor="middle"
        style={{
          fontFamily: EVM.font,
          fontSize: 10,
          fill: EVM.ink3,
          letterSpacing: '0.06em',
        }}
      >
        クリティカルチェーン完了率
      </text>
      <text
        x={10}
        y={h / 2}
        textAnchor="middle"
        transform={`rotate(-90 10 ${h / 2})`}
        style={{
          fontFamily: EVM.font,
          fontSize: 10,
          fill: EVM.ink3,
          letterSpacing: '0.06em',
        }}
      >
        バッファ消費率
      </text>
      {/* zone label (hide when current dot is hovered) */}
      {hovered !== 'current' && (
        <g transform={`translate(${x(dot.x) + 14}, ${y(dot.y) - 14})`}>
          <rect
            x={-2}
            y={-12}
            width="68"
            height="20"
            rx="3"
            fill={EVM.card}
            stroke={EVM.brand}
            strokeWidth="1"
          />
          <text
            x="32"
            y="2"
            textAnchor="middle"
            style={{
              fontFamily: EVM.font,
              fontSize: 10,
              fontWeight: 600,
              fill: EVM.brandDeep,
              letterSpacing: '0.04em',
            }}
          >
            {data.zone}
          </text>
        </g>
      )}
      {/* Invisible hit areas — trail points */}
      {trailPoints.map((p, i) => (
        <circle
          key={'hit-t' + i}
          cx={x(p.x)}
          cy={y(p.y)}
          r={12}
          fill="transparent"
          style={{ cursor: 'crosshair' }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        />
      ))}
      {/* Invisible hit area — current dot */}
      <circle
        cx={x(dot.x)}
        cy={y(dot.y)}
        r={16}
        fill="transparent"
        style={{ cursor: 'crosshair' }}
        onMouseEnter={() => setHovered('current')}
        onMouseLeave={() => setHovered(null)}
      />
      {/* Tooltip */}
      {tooltip && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={tooltip.rx}
            y={tooltip.ry}
            width={tooltip.tw}
            height={tooltip.th}
            rx={5}
            fill={EVM.card}
            stroke={EVM.rule}
            strokeWidth="1"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.10))' }}
          />
          {tooltip.isCurrent && (
            <text
              x={tooltip.rx + 10}
              y={tooltip.ry + 15}
              style={{
                fontFamily: EVM.font,
                fontSize: 10,
                fontWeight: 700,
                fill: EVM.brandDeep,
                letterSpacing: '0.08em',
              }}
            >
              現在 · {data.zone}
            </text>
          )}
          {!tooltip.isCurrent && (
            <text
              x={tooltip.rx + 10}
              y={tooltip.ry + 15}
              style={{ fontFamily: EVM.font, fontSize: 10, fill: EVM.ink3 }}
            >
              過去スナップショット
            </text>
          )}
          <text
            x={tooltip.rx + 10}
            y={tooltip.ry + (tooltip.isCurrent ? 35 : 32)}
            style={{ fontFamily: EVM.fontMono, fontSize: 11, fill: EVM.ink2 }}
          >
            CC完了
            <tspan fontWeight="700" fill={EVM.ink}>
              {(tooltip.px * 100).toFixed(0)}%
            </tspan>
          </text>
          <text
            x={tooltip.rx + 10}
            y={tooltip.ry + (tooltip.isCurrent ? 55 : 50)}
            style={{ fontFamily: EVM.fontMono, fontSize: 11, fill: EVM.ink2 }}
          >
            BF消費
            <tspan fontWeight="700" fill={EVM.ink}>
              {(tooltip.py * 100).toFixed(0)}%
            </tspan>
          </text>
        </g>
      )}
    </svg>
  )
})
