import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export type PillTone = 'neutral' | 'brand' | 'normal' | 'warning' | 'critical' | 'na'

export interface PillProps {
  tone?: PillTone
  children?: React.ReactNode
  style?: React.CSSProperties
}

const PALETTE: Record<PillTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: EVM.paperWarm, fg: EVM.ink2, border: EVM.rule },
  brand: { bg: EVM.brandSoft, fg: EVM.brandDeep, border: '#cee08a' },
  normal: { bg: EVM.okSoft, fg: EVM.ok, border: '#cfdcb4' },
  warning: { bg: EVM.warnSoft, fg: '#8a6c1a', border: '#e6d29a' },
  critical: { bg: EVM.critSoft, fg: EVM.crit, border: '#e0b8a6' },
  na: { bg: EVM.paperWarm, fg: EVM.ink3, border: EVM.rule },
}

export const Pill = React.memo(function Pill({ tone = 'neutral', children, style }: PillProps) {
  const p = PALETTE[tone] ?? PALETTE.neutral
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        fontFamily: EVM.font,
        letterSpacing: '0.02em',
        ...style,
      }}
    >
      {children}
    </span>
  )
})
