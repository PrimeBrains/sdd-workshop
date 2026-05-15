import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export interface CardProps {
  children?: React.ReactNode
  style?: React.CSSProperties
  pad?: number
}

export const Card = React.memo(function Card({ children, style, pad = 20 }: CardProps) {
  return (
    <div
      style={{
        background: EVM.card,
        border: `1px solid ${EVM.rule}`,
        borderRadius: 6,
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  )
})
