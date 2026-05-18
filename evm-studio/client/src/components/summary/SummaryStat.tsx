/**
 * Task 2.3: SummaryStat
 *
 * Summary 行に並ぶ各メトリクスの単体表示 (label / value / sub / tone)。
 * モックアップ `shared.jsx` 行 750-772 を 1:1 で TSX 移植。
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export type SummaryStatTone = 'neutral' | 'normal' | 'warning' | 'critical' | 'brand' | 'na'

export interface SummaryStatProps {
  label: string
  value: string
  sub?: string
  tone?: SummaryStatTone
  big?: boolean
}

const TONE_FG: Record<SummaryStatTone, string> = {
  neutral: EVM.ink,
  normal: EVM.ok,
  warning: '#8a6c1a',
  critical: EVM.crit,
  brand: EVM.brandDeep,
  na: EVM.ink3,
}

export const SummaryStat = React.memo(function SummaryStat({
  label,
  value,
  sub,
  tone = 'neutral',
  big = false,
}: SummaryStatProps) {
  const fg = TONE_FG[tone]
  const testId = `summary-stat-${label}`
  return (
    <div
      data-testid={testId}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}
    >
      <div
        style={{
          fontFamily: EVM.font,
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: EVM.ink3,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        data-testid={`${testId}-value`}
        style={{
          fontFamily: EVM.fontSerif,
          fontWeight: 400,
          color: fg,
          fontSize: big ? 34 : 26,
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums slashed-zero',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          data-testid={`${testId}-sub`}
          style={{ fontFamily: EVM.font, fontSize: 11, color: EVM.ink3 }}
        >
          {sub}
        </div>
      )}
    </div>
  )
})
