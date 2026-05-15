import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export type FilterChipTone = 'default' | 'warn'

export interface FilterChipProps {
  children?: React.ReactNode
  active?: boolean
  onClick?: () => void
  tone?: FilterChipTone
}

export const FilterChip = React.memo(function FilterChip({
  children,
  active = false,
  onClick,
  tone = 'default',
}: FilterChipProps) {
  const isWarn = tone === 'warn' && !active
  return (
    <button
      onClick={onClick}
      className={'evm-chip' + (active ? ' active' : '')}
      style={{
        padding: '5px 10px',
        borderRadius: 4,
        background: isWarn ? EVM.warnSoft : EVM.paperWarm,
        border: `1px solid ${isWarn ? '#e6d29a' : EVM.rule}`,
        color: isWarn ? '#8a6c1a' : EVM.ink2,
        fontFamily: 'inherit',
        fontSize: 11.5,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
})
