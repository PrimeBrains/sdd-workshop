/**
 * Task 2.7: InspectorTeamMode
 *
 * モックアップ `variation-a.jsx` 行 837-897 (Team ブロック) を 1:1 で TSX 移植。
 * - 全メンバーのカードリスト
 * - compareMode === true のとき前日比 (SPI / CPI / EV) を表示
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'
import { Avatar } from '@/components/atoms/Avatar'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import {
  deltaTone,
  fmtDeltaIdx,
  fmtDeltaMD,
  initialsOf,
  spiTone,
  statusColor,
} from '@/lib/formatters'
import type {
  AssigneeEvm,
  MemberInfo,
  WorkbenchPrevDay,
} from '@/types/workbench'

export interface InspectorTeamModeProps {
  assignees: ReadonlyArray<AssigneeEvm>
  members: ReadonlyArray<MemberInfo>
  compareMode: boolean
  prevDay: WorkbenchPrevDay
  onSwitchMember: (assignee: AssigneeEvm) => void
}

export const InspectorTeamMode = React.memo(function InspectorTeamMode({
  assignees,
  members,
  compareMode,
  prevDay,
  onSwitchMember,
}: InspectorTeamModeProps) {
  return (
    <>
      <div
        style={{
          padding: '14px 20px 10px',
          borderBottom: `1px solid ${EVM.rule}`,
          flexShrink: 0,
        }}
      >
        <Eyebrow>Inspector · Team</Eyebrow>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: compareMode ? EVM.brandDeep : EVM.ink3,
            fontWeight: compareMode ? 600 : 400,
          }}
        >
          {compareMode ? '前日比 — 全メンバー' : `全 ${assignees.length} 名`}
        </div>
      </div>
      <div style={{ overflow: 'auto', flex: '1 1 auto' }}>
        {assignees.map((a) => {
          const prev = prevDay?.assignees.find((p) => p.id === a.id) ?? null
          const dSPI =
            prev && a.spi != null && prev.spi != null ? a.spi - prev.spi : 0
          const dCPI =
            prev && a.cpi != null && prev.cpi != null ? a.cpi - prev.cpi : 0
          const dEV = prev ? a.ev - prev.ev : 0
          const mInfo = members.find((m) => m.name === a.name) ?? null
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSwitchMember(a)}
              className="evm-assignee-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '11px 20px',
                borderBottom: `1px solid ${EVM.rule}`,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: 'inherit',
                textAlign: 'left',
              }}
            >
              <Avatar
                initials={initialsOf(a.name)}
                size={28}
                tone={spiTone(a.spi) === 'normal' ? 'brand' : 'neutral'}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: EVM.ink }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 10, color: EVM.ink3, marginTop: 2 }}>
                  {mInfo?.role ?? ''}
                </div>
              </div>
              {compareMode && prev ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    alignItems: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontFamily: EVM.fontMono,
                        fontWeight: 700,
                        color: statusColor(deltaTone(dSPI)),
                      }}
                    >
                      SPI {fmtDeltaIdx(dSPI)}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontFamily: EVM.fontMono,
                        fontWeight: 700,
                        color: statusColor(deltaTone(dCPI)),
                      }}
                    >
                      CPI {fmtDeltaIdx(dCPI)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: EVM.fontMono,
                      color: statusColor(deltaTone(dEV)),
                    }}
                  >
                    EV {fmtDeltaMD(dEV)}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: EVM.fontMono,
                      fontSize: 13,
                      fontWeight: 700,
                      color: statusColor(spiTone(a.spi)),
                    }}
                  >
                    {a.spi != null ? a.spi.toFixed(2) : 'N/A'}
                  </span>
                  <span style={{ fontSize: 9.5, color: EVM.ink3 }}>SPI</span>
                </div>
              )}
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                style={{ flexShrink: 0, color: EVM.ink4 }}
              >
                <path
                  d="M4 2 L8 6 L4 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )
        })}
      </div>
    </>
  )
})
