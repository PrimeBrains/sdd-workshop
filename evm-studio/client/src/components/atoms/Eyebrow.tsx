import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export interface EyebrowProps {
  children?: React.ReactNode
  style?: React.CSSProperties
}

export const Eyebrow = React.memo(function Eyebrow({ children, style }: EyebrowProps) {
  return (
    <div
      style={{
        fontFamily: EVM.font,
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: EVM.ink3,
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </div>
  )
})
