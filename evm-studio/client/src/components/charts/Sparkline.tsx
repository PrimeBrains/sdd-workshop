/**
 * Task 2.6: Sparkline
 *
 * モックアップ `mockup/shared.jsx` 行 455-467 を TSX 化。
 * コンパクトな SPI ミニライン (Inspector 内のタスク / メンバー SPI トレンド表示用)。
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export interface SparklineProps {
  data: ReadonlyArray<number>
  w?: number
  h?: number
  color?: string
}

export const Sparkline = React.memo(function Sparkline({
  data,
  w = 100,
  h = 28,
  color = EVM.brandDeep,
}: SparklineProps) {
  if (!data.length) return null

  const yMin = Math.min(...data, 0.8)
  const yMax = Math.max(...data, 1.0)
  const range = yMax - yMin || 1
  const y = (v: number) => 4 + (1 - (v - yMin) / range) * (h - 8)
  const x = (i: number) =>
    data.length === 1 ? w / 2 : (i / (data.length - 1)) * w
  const d = data
    .map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ')
  const lastIdx = data.length - 1
  const lastVal = data[lastIdx] ?? 0

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx={x(lastIdx)} cy={y(lastVal)} r="2.5" fill={color} />
    </svg>
  )
})
