/**
 * Task 4.1: ChartFullscreen
 * Requirements: 10.1-10.5, 17.2, 17.4
 *
 * モックアップ `mockup/variation-a.jsx` 行 1366-1468 を TSX 化。
 * - ReactDOM.createPortal で document.body 直下にマウント
 * - type に応じて SpiTrendChart または FeverChart を可変サイズで描画
 * - Esc キー / 閉じるボタン / 背景クリックで onClose()
 * - マウント時 body スクロールロック / アンマウント時に復元
 */

import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { EVM } from '@/tokens/evm-tokens'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Pill } from '@/components/atoms/Pill'
import { BrandMark } from '@/components/atoms/BrandMark'
import { SpiTrendChart } from '@/components/charts/SpiTrendChart'
import { FeverChart } from '@/components/charts/FeverChart'
import type {
  FeverChart as FeverChartData,
  SpiTrendPoint,
  WorkbenchProject,
} from '@/types/workbench'

export interface ChartFullscreenProps {
  type: 'trend' | 'fever'
  project: WorkbenchProject
  spiTrend: ReadonlyArray<SpiTrendPoint>
  fever: FeverChartData | null
  onClose: () => void
}

/**
 * モーダル本体。`type` に応じて SPI トレンド / フィーバーチャートを描画する。
 *
 * 表示領域は `window.innerWidth/innerHeight` から計算し、リサイズ追従する。
 * チャートサイズはモックアップ準拠の式で決定する:
 *  - trend: 横長 (width = availW, height = min(availH, availW * 0.38))
 *  - fever: 正方形 (size = max(min(availW * 0.72, availH), 320))
 */
export function ChartFullscreen({
  type,
  project,
  spiTrend,
  fever,
  onClose,
}: ChartFullscreenProps) {
  const [vw, setVw] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1400,
  )
  const [vh, setVh] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 900,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onResize = () => {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const isTrend = type === 'trend'
  const eyebrow = isTrend ? 'Trend · Snapshots × Time' : 'CCPM Fever'
  const title = isTrend ? 'SPI / CPI 推移' : 'バッファ消費 vs 完了率'

  // モックアップ準拠のサイズ計算
  const availW = vw - 64 - 96 // modal padding + card padding
  const availH = vh - 64 - 60 - 56 - 48 // modal pad + header + footer + card pad

  let chartW: number
  let chartH: number
  if (isTrend) {
    chartW = Math.max(availW, 480)
    chartH = Math.max(Math.min(availH, Math.round(availW * 0.38)), 260)
  } else {
    const sq = Math.max(Math.min(availW * 0.72, availH), 320)
    chartW = sq
    chartH = sq
  }

  return ReactDOM.createPortal(
    <div
      data-testid="chart-fullscreen"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(20, 18, 14, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        animation: 'evmFadeIn 0.18s ease-out',
      }}
    >
      <style>{`
        @keyframes evmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes evmSlideUp { from { opacity: 0; transform: translateY(8px) scale(0.99) } to { opacity: 1; transform: none } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: EVM.card,
          borderRadius: 8,
          boxShadow: '0 24px 80px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'evmSlideUp 0.22s cubic-bezier(.2,.7,.3,1)',
          fontFamily: EVM.font,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: `1px solid ${EVM.rule}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flex: '0 0 auto',
          }}
        >
          <BrandMark size={22} />
          <div style={{ width: 1, height: 22, background: EVM.rule }} />
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <div
              style={{
                fontFamily: EVM.fontSerif,
                fontSize: 18,
                color: EVM.ink,
                marginTop: 2,
              }}
            >
              {title}
            </div>
          </div>
          <div style={{ width: 1, height: 30, background: EVM.rule }} />
          <div style={{ fontFamily: EVM.fontSerif, fontSize: 14, color: EVM.ink2 }}>
            {project.name}
          </div>
          <div style={{ flex: 1 }} />
          {isTrend && (
            <span style={{ fontSize: 11, color: EVM.ink3 }}>
              過去 {spiTrend.length} スナップショット
            </span>
          )}
          {!isTrend && fever && (
            <Pill
              tone={
                fever.zone === 'GREEN'
                  ? 'brand'
                  : fever.zone === 'YELLOW'
                    ? 'warning'
                    : 'critical'
              }
            >
              {fever.zone}
            </Pill>
          )}
          <button
            type="button"
            onClick={onClose}
            title="閉じる (Esc)"
            className="evm-icon-btn"
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              marginLeft: 12,
              background: EVM.paperWarm,
              border: `1px solid ${EVM.rule}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: EVM.ink2,
              fontFamily: 'inherit',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3 L11 11 M11 3 L3 11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Chart */}
        <div
          style={{
            padding: '28px 40px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isTrend ? (
            <SpiTrendChart data={spiTrend} w={chartW} h={chartH} />
          ) : fever ? (
            <FeverChart data={fever} w={chartW} h={chartH} />
          ) : (
            <div
              style={{
                color: EVM.ink3,
                fontStyle: 'italic',
                fontFamily: EVM.fontSerif,
                padding: 60,
              }}
            >
              バッファタスク未定義
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 24px',
            borderTop: `1px solid ${EVM.rule}`,
            display: 'flex',
            justifyContent: 'flex-end',
            flex: '0 0 auto',
          }}
        >
          <span style={{ fontSize: 11, color: EVM.ink3 }}>
            <kbd
              style={{
                background: EVM.card,
                border: `1px solid ${EVM.rule}`,
                padding: '1px 6px',
                borderRadius: 3,
                fontFamily: EVM.fontMono,
                fontSize: 10,
                color: EVM.ink2,
              }}
            >
              Esc
            </kbd>{' '}
            で閉じる
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
