/**
 * Task 2.4: AlertStrip
 *
 * 最高重大度に応じて background / heading を切替。各チップクリックで onJump を呼ぶ。
 * モックアップ `variation-a.jsx` 行 531-570 を 1:1 で TSX 移植。
 *
 * `alerts.length === 0` の HEALTHY 表示は親 (WorkbenchPage) が担当する。
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'
import type { AlertEntry } from '@/types/workbench'

export interface AlertStripProps {
  alerts: ReadonlyArray<AlertEntry>
  onJump: (alert: AlertEntry) => void
}

export const AlertStrip = React.memo(function AlertStrip({
  alerts,
  onJump,
}: AlertStripProps) {
  if (alerts.length === 0) return null

  const hasCritical = alerts.some((a) => a.level === 'critical')
  const bg = hasCritical ? EVM.critSoft : EVM.warnSoft
  const border = hasCritical ? '#e0b8a6' : '#e6d29a'
  const dotBg = hasCritical ? EVM.crit : EVM.warn
  const fg = hasCritical ? EVM.crit : '#8a6c1a'

  return (
    <div
      style={{
        background: bg,
        borderBottom: `1px solid ${border}`,
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontSize: 12,
        color: fg,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: dotBg,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 11,
        }}
      >
        !
      </div>
      <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
        {hasCritical ? 'CRITICAL' : 'WARNING'}
      </span>
      <span>
        {hasCritical ? '即時対応が必要なタスク' : '遅延の兆候'}: {alerts.length}件
      </span>
      <div style={{ flex: 1 }} />
      {alerts.map((a, i) => (
        <button
          key={`${a.taskId}-${i}`}
          type="button"
          onClick={() => onJump(a)}
          className="evm-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 10px',
            border: `1px solid ${border}`,
            borderRadius: 4,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'inherit',
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 600 }}>{a.taskName}</span>
          <span>{a.assigneeName ?? '—'}</span>
          <span
            style={{
              fontFamily: EVM.fontMono,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            SPI {a.spi.toFixed(2)}
          </span>
          <span style={{ fontSize: 11 }}>→</span>
        </button>
      ))}
    </div>
  )
})
