import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export type AvatarTone = 'brand' | 'neutral'

export interface AvatarProps {
  initials: string
  size?: number
  tone?: AvatarTone
}

export const Avatar = React.memo(function Avatar({ initials, size = 28, tone }: AvatarProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: tone === 'brand' ? EVM.brandSoft : EVM.paperWarm,
        color: tone === 'brand' ? EVM.brandDeep : EVM.ink2,
        border: `1px solid ${tone === 'brand' ? '#cee08a' : EVM.rule}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 600,
        letterSpacing: '0.02em',
        fontFamily: EVM.font,
        flex: '0 0 auto',
      }}
    >
      {initials}
    </span>
  )
})
