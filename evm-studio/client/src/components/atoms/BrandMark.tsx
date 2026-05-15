import React from 'react'
import { EVM } from '@/tokens/evm-tokens'

export interface BrandMarkProps {
  size?: number
}

/**
 * Prime Brains ブランドマーク。ロゴ画像が未配置のため、現状はテキストで暫定表示する。
 * 実画像が追加されたら <img src="..."/> 形式へ差し替える。
 */
export const BrandMark = React.memo(function BrandMark({ size = 28 }: BrandMarkProps) {
  return (
    <span
      aria-label="Prime Brains"
      style={{
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: EVM.fontBrand,
        fontSize: size * 0.52,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: EVM.ink,
        opacity: 0.92,
        lineHeight: 1,
      }}
    >
      EVM STUDIO
    </span>
  )
})
