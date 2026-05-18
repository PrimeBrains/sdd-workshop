/**
 * Task 2.3: SummaryStrip
 *
 * プロジェクトメタ + SPI/CPI/BAC/EV/AC/VAC + 前日比トグル。
 * モックアップ `variation-a.jsx` 行 322-370 を 1:1 で TSX 移植。
 *
 * `compareMode === true` のとき各メトリクスは前日比 (delta) 表示に切り替わる。
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import {
  deltaTone,
  fmtDeltaIdx,
  fmtDeltaMD,
  fmtMD,
  fmtSignedMD,
  statusJp,
} from '@/lib/formatters'
import { SummaryStat } from './SummaryStat'
import type {
  WorkbenchProject,
  WorkbenchSummary,
  WorkbenchPrevDay,
} from '@/types/workbench'

export interface SummaryStripProps {
  project: WorkbenchProject
  summary: WorkbenchSummary
  prevDay: WorkbenchPrevDay
  compareMode: boolean
  onCompareModeChange: (next: boolean) => void
  /** プロジェクト進捗率 (0-100) — モックアップ準拠の追加メタ表示。任意 */
  progress?: number
  /** 残日数 — モックアップ準拠の追加メタ表示。任意 */
  remainingDays?: number
}

export const SummaryStrip = React.memo(function SummaryStrip({
  project,
  summary,
  prevDay,
  compareMode,
  onCompareModeChange,
  progress,
  remainingDays,
}: SummaryStripProps) {
  const prevSum = prevDay?.summary ?? null

  const safeNum = (v: number | null | undefined): number => (v == null ? 0 : v)

  const dSPI = prevSum ? safeNum(summary.spi) - safeNum(prevSum.spi) : 0
  const dCPI = prevSum ? safeNum(summary.cpi) - safeNum(prevSum.cpi) : 0
  const dEV = prevSum ? summary.ev - prevSum.ev : 0
  const dPV = prevSum ? summary.pv - prevSum.pv : 0
  const dAC = prevSum ? summary.ac - prevSum.ac : 0
  const dVAC = prevSum ? safeNum(summary.vac) - safeNum(prevSum.vac) : 0

  return (
    <div
      data-testid="summary-strip"
      style={{
        background: EVM.card,
        borderBottom: `1px solid ${EVM.rule}`,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 28,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 220,
          maxWidth: 260,
        }}
      >
        <Eyebrow>Project · {statusJp(project.status)}</Eyebrow>
        <div
          style={{
            fontFamily: EVM.fontSerif,
            fontSize: 22,
            color: EVM.ink,
            lineHeight: 1.1,
          }}
        >
          {project.name}
        </div>
        <div style={{ fontSize: 11, color: EVM.ink3 }}>
          {project.startDate.slice(5)} → {project.endDate.slice(5)}
          {remainingDays != null && ` · 残 ${remainingDays}日`}
          {progress != null && ` · 進捗 ${progress}%`}
        </div>
      </div>
      <div style={{ width: 1, height: 56, background: EVM.rule }} />

      {compareMode ? (
        <>
          <SummaryStat
            label="SPI"
            value={fmtDeltaIdx(dSPI)}
            tone={deltaTone(dSPI)}
            sub={summary.spi != null ? `現在 ${summary.spi.toFixed(2)}` : undefined}
          />
          <SummaryStat
            label="CPI"
            value={fmtDeltaIdx(dCPI)}
            tone={deltaTone(dCPI)}
            sub={summary.cpi != null ? `現在 ${summary.cpi.toFixed(2)}` : undefined}
          />
          <div style={{ width: 1, height: 56, background: EVM.rule }} />
          <SummaryStat
            label="EV"
            value={fmtDeltaMD(dEV)}
            tone={deltaTone(dEV)}
            sub={`現在 ${fmtMD(summary.ev)}`}
          />
          <SummaryStat
            label="PV"
            value={fmtDeltaMD(dPV)}
            tone="na"
            sub={`現在 ${fmtMD(summary.pv)}`}
          />
          <SummaryStat
            label="AC"
            value={fmtDeltaMD(dAC)}
            tone="na"
            sub={`現在 ${fmtMD(summary.ac)}`}
          />
          <SummaryStat
            label="VAC"
            value={fmtDeltaMD(dVAC)}
            tone={deltaTone(dVAC)}
            sub={summary.vac != null ? `現在 ${fmtSignedMD(summary.vac)}` : undefined}
          />
        </>
      ) : (
        <>
          <SummaryStat
            label="SPI"
            value={summary.spi != null ? summary.spi.toFixed(2) : 'N/A'}
            tone="brand"
            sub={
              summary.spiDelta
                ? `vs先週 ${summary.spiDelta > 0 ? '+' : ''}${summary.spiDelta.toFixed(2)}`
                : '横ばい'
            }
          />
          <SummaryStat
            label="CPI"
            value={summary.cpi != null ? summary.cpi.toFixed(2) : 'N/A'}
            tone="brand"
            sub={
              summary.cpiDelta
                ? `vs先週 ${summary.cpiDelta > 0 ? '+' : ''}${summary.cpiDelta.toFixed(2)}`
                : '横ばい'
            }
          />
          <div style={{ width: 1, height: 56, background: EVM.rule }} />
          <SummaryStat label="BAC" value={fmtMD(summary.bac)} sub="計画総予算" />
          <SummaryStat
            label="EV"
            value={fmtMD(summary.ev)}
            sub={`PV ${fmtMD(summary.pv)}`}
          />
          <SummaryStat
            label="AC"
            value={fmtMD(summary.ac)}
            sub={summary.etc != null ? `残ETC ${fmtMD(summary.etc)}` : undefined}
          />
          <SummaryStat
            label="VAC"
            value={summary.vac != null ? fmtSignedMD(summary.vac) : 'N/A'}
            tone={summary.vac != null && summary.vac >= 0 ? 'normal' : 'critical'}
            sub={summary.eac != null ? `EAC ${fmtMD(summary.eac)}` : undefined}
          />
        </>
      )}

      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            letterSpacing: '0.06em',
            color: compareMode ? EVM.brandDeep : EVM.ink3,
            fontWeight: compareMode ? 600 : 400,
          }}
        >
          前日比
        </span>
        <button
          type="button"
          onClick={() => onCompareModeChange(!compareMode)}
          aria-label="前日比トグル"
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            background: compareMode ? EVM.brandDeep : EVM.rule,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: compareMode ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: 8,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              display: 'block',
            }}
          />
        </button>
      </div>
    </div>
  )
})
