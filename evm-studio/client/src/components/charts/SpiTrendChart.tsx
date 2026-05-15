/**
 * Task 2.6: SpiTrendChart
 *
 * モックアップ `mockup/shared.jsx` 行 233-336 を TSX 化。
 * SVG 折れ線チャート (SPI / CPI 推移) + ホバー時のツールチップ。
 */

import React, { useState } from 'react'
import { EVM } from '@/tokens/evm-tokens'
import type { SpiTrendPoint } from '@/types/workbench'

export interface SpiTrendChartProps {
  data: ReadonlyArray<SpiTrendPoint>
  w?: number
  h?: number
  padTop?: number
  padBottom?: number
  padL?: number
  padR?: number
}

export const SpiTrendChart = React.memo(function SpiTrendChart({
  data,
  w = 480,
  h = 220,
  padTop = 14,
  padBottom = 28,
  padL = 38,
  padR = 14,
}: SpiTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div
        style={{
          color: EVM.ink3,
          fontStyle: 'italic',
          fontFamily: EVM.fontSerif,
          padding: 40,
        }}
      >
        トレンドデータがありません
      </div>
    )
  }

  const innerW = w - padL - padR
  const innerH = h - padTop - padBottom
  const yMin = 0.7
  const yMax = 1.15
  const y = (v: number) => padTop + (1 - (v - yMin) / (yMax - yMin)) * innerH
  const x = (i: number) =>
    padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const yTicks = [0.8, 0.9, 1.0, 1.1]

  const pathFor = (key: 'spi' | 'cpi') =>
    data
      .map((d, i) => {
        const v = d[key]
        const yVal = v == null ? y(1.0) : y(v)
        return `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yVal.toFixed(1)}`
      })
      .join(' ')

  const tooltip = (() => {
    if (hovered === null) return null
    const d = data[hovered]
    if (!d) return null
    const tx = x(hovered)
    const tw = 138
    const th = 66
    const flip = tx > w - tw - 20
    const rx = flip ? tx - tw - 14 : tx + 14
    const dSpiY = d.spi == null ? y(1.0) : y(d.spi)
    const ry = Math.max(padTop + 4, Math.min(dSpiY - th / 2, h - padBottom - th - 4))
    return { d, tx, tw, th, rx, ry }
  })()

  const lastIdx = data.length - 1
  const last = data[lastIdx]

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {/* horizontal grid */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={w - padR}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 1.0 ? EVM.ink3 : EVM.ruleSoft}
            strokeWidth={1}
            strokeDasharray={t === 1.0 ? '3 3' : ''}
          />
          <text
            x={padL - 6}
            y={y(t) + 3}
            textAnchor="end"
            style={{
              fontFamily: EVM.font,
              fontSize: 10,
              fill: EVM.ink3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {/* x labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={x(i)}
          y={h - padBottom + 14}
          textAnchor="middle"
          style={{
            fontFamily: EVM.font,
            fontSize: 10,
            fill: hovered === i ? EVM.ink : EVM.ink3,
          }}
        >
          {d.d}
        </text>
      ))}
      {/* CPI line */}
      <path
        d={pathFor('cpi')}
        fill="none"
        stroke={EVM.ink2}
        strokeWidth="1.4"
        strokeDasharray="4 3"
      />
      {data.map((d, i) =>
        d.cpi == null ? null : (
          <circle
            key={'c' + i}
            cx={x(i)}
            cy={y(d.cpi)}
            r={2.4}
            fill={EVM.card}
            stroke={EVM.ink2}
            strokeWidth="1.4"
          />
        ),
      )}
      {/* SPI line */}
      <path d={pathFor('spi')} fill="none" stroke={EVM.brandDeep} strokeWidth="2" />
      {data.map((d, i) =>
        d.spi == null ? null : (
          <circle
            key={'s' + i}
            cx={x(i)}
            cy={y(d.spi)}
            r={hovered === i ? 5 : 3}
            fill={EVM.brandDeep}
            style={{ transition: 'r 0.1s' }}
          />
        ),
      )}
      {/* latest annotation */}
      {last && last.spi != null && hovered !== lastIdx && (
        <g>
          <circle
            cx={x(lastIdx)}
            cy={y(last.spi)}
            r={6}
            fill="none"
            stroke={EVM.brandDeep}
            strokeWidth="1.2"
            opacity="0.35"
          />
          <text
            x={x(lastIdx) + 9}
            y={y(last.spi) - 6}
            style={{
              fontFamily: EVM.font,
              fontSize: 11,
              fontWeight: 600,
              fill: EVM.brandDeep,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            SPI {last.spi.toFixed(2)}
          </text>
        </g>
      )}
      {/* Legend */}
      <g transform={`translate(${padL}, ${padTop - 6})`}>
        <line x1="0" x2="14" y1="0" y2="0" stroke={EVM.brandDeep} strokeWidth="2" />
        <text
          x="18"
          y="3"
          style={{
            fontFamily: EVM.font,
            fontSize: 10,
            fill: EVM.ink2,
            fontWeight: 600,
          }}
        >
          SPI
        </text>
        <line
          x1="50"
          x2="64"
          y1="0"
          y2="0"
          stroke={EVM.ink2}
          strokeWidth="1.4"
          strokeDasharray="4 3"
        />
        <text
          x="68"
          y="3"
          style={{
            fontFamily: EVM.font,
            fontSize: 10,
            fill: EVM.ink2,
            fontWeight: 600,
          }}
        >
          CPI
        </text>
      </g>
      {/* Invisible hit areas */}
      {data.map((_, i) => {
        const cx = x(i)
        const colW =
          i === 0 || i === data.length - 1
            ? innerW / Math.max(1, data.length - 1) / 2
            : innerW / Math.max(1, data.length - 1)
        const rx = i === 0 ? cx : cx - colW / 2
        return (
          <rect
            key={'hit' + i}
            x={rx}
            y={padTop}
            width={colW}
            height={innerH}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        )
      })}
      {/* Tooltip */}
      {tooltip && (
        <g style={{ pointerEvents: 'none' }}>
          <line
            x1={tooltip.tx}
            x2={tooltip.tx}
            y1={padTop}
            y2={h - padBottom}
            stroke={EVM.brandDeep}
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.35"
          />
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
          <text
            x={tooltip.rx + 10}
            y={tooltip.ry + 15}
            style={{ fontFamily: EVM.fontMono, fontSize: 10, fill: EVM.ink3 }}
          >
            {tooltip.d.d}
          </text>
          <rect
            x={tooltip.rx + 10}
            y={tooltip.ry + 24}
            width={10}
            height={3}
            rx={1}
            fill={EVM.brandDeep}
          />
          <text
            x={tooltip.rx + 24}
            y={tooltip.ry + 30}
            style={{
              fontFamily: EVM.fontMono,
              fontSize: 12,
              fill: EVM.brandDeep,
              fontWeight: 700,
            }}
          >
            SPI {tooltip.d.spi != null ? tooltip.d.spi.toFixed(2) : 'N/A'}
          </text>
          <line
            x1={tooltip.rx + 10}
            x2={tooltip.rx + 20}
            y1={tooltip.ry + 48}
            y2={tooltip.ry + 48}
            stroke={EVM.ink2}
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <text
            x={tooltip.rx + 24}
            y={tooltip.ry + 52}
            style={{ fontFamily: EVM.fontMono, fontSize: 12, fill: EVM.ink2 }}
          >
            CPI {tooltip.d.cpi != null ? tooltip.d.cpi.toFixed(2) : 'N/A'}
          </text>
        </g>
      )}
    </svg>
  )
})
