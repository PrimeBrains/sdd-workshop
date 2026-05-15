import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export type DotTone = 'normal' | 'warning' | 'critical' | 'na'

export interface DotProps {
  tone?: DotTone
  size?: number
}

export const Dot = React.memo(function Dot({ tone = 'normal', size = 8 }: DotProps) {
  const c =
    tone === 'critical' ? EVM.crit
    : tone === 'warning' ? EVM.warn
    : tone === 'normal' ? EVM.ok
    : EVM.na
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: c,
        flex: '0 0 auto',
      }}
    />
  )
})
