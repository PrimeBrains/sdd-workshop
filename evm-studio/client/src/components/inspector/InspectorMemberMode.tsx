/**
 * Task 2.7: InspectorMemberMode
 *
 * モックアップ `variation-a.jsx` 行 740-834 (Member ブロック) を 1:1 で TSX 移植。
 * - メンバーヘッダー (Avatar + 名前 + ロール)
 * - メンバー集計メトリクス (SPI / CPI / EV / BAC)
 * - メンバー SPI sparkline
 * - 担当タスク一覧
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'
import { Avatar } from '@/components/atoms/Avatar'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { SummaryStat } from '@/components/summary/SummaryStat'
import { Sparkline } from '@/components/charts/Sparkline'
import {
  deltaTone,
  fmtDeltaIdx,
  fmtDeltaMD,
  fmtMD,
  initialsOf,
  spiTone,
  statusColor,
} from '@/lib/formatters'
import type {
  AssigneeEvm,
  MemberInfo,
  TaskEvm,
  WorkbenchPrevDay,
} from '@/types/workbench'

export interface InspectorMemberModeProps {
  memberData: AssigneeEvm | null
  memberInfo: MemberInfo | null
  /** プロジェクトのタスク一覧（担当タスクフィルタ用） */
  tasks: ReadonlyArray<TaskEvm>
  compareMode: boolean
  prevDay: WorkbenchPrevDay
}

export const InspectorMemberMode = React.memo(function InspectorMemberMode({
  memberData,
  memberInfo,
  tasks,
  compareMode,
  prevDay,
}: InspectorMemberModeProps) {
  if (!memberData) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 10,
          color: EVM.ink3,
          padding: 40,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          左レールまたはタスクの担当者カードから
          <br />
          メンバーを選択してください
        </div>
      </div>
    )
  }

  const prevMember =
    compareMode && prevDay
      ? prevDay.assignees.find((a) => a.id === memberData.id) ?? null
      : null
  const dMemSPI =
    prevMember && memberData.spi != null && prevMember.spi != null
      ? memberData.spi - prevMember.spi
      : 0
  const dMemCPI =
    prevMember && memberData.cpi != null && prevMember.cpi != null
      ? memberData.cpi - prevMember.cpi
      : 0
  const dMemEV = prevMember ? memberData.ev - prevMember.ev : 0
  const dMemPV = prevMember ? memberData.pv - prevMember.pv : 0
  const dMemAC = prevMember ? memberData.ac - prevMember.ac : 0

  const memberTasks = tasks.filter((t) => t.assignee === memberData.name)
  const memSpi = memberData.spi ?? 1.0

  return (
    <>
      {/* Member header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${EVM.rule}` }}>
        <Eyebrow style={{ marginBottom: 10 }}>Inspector · Member</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar initials={initialsOf(memberData.name)} size={38} tone="brand" />
          <div>
            <div
              style={{
                fontFamily: EVM.fontSerif,
                fontSize: 20,
                color: EVM.ink,
                lineHeight: 1.2,
              }}
            >
              {memberData.name}
            </div>
            <div style={{ fontSize: 11, color: EVM.ink3, marginTop: 3 }}>
              {memberInfo?.role ?? ''}
            </div>
          </div>
        </div>
      </div>

      {/* Member aggregate metrics */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${EVM.rule}`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        {compareMode && prevMember ? (
          <>
            <SummaryStat
              label="SPI"
              value={fmtDeltaIdx(dMemSPI)}
              tone={deltaTone(dMemSPI)}
              sub={memberData.spi != null ? `現在 ${memberData.spi.toFixed(2)}` : undefined}
            />
            <SummaryStat
              label="CPI"
              value={fmtDeltaIdx(dMemCPI)}
              tone={deltaTone(dMemCPI)}
              sub={memberData.cpi != null ? `現在 ${memberData.cpi.toFixed(2)}` : undefined}
            />
            <SummaryStat
              label="EV"
              value={fmtDeltaMD(dMemEV)}
              tone={deltaTone(dMemEV)}
              sub={`PV ${fmtDeltaMD(dMemPV)}`}
            />
            <SummaryStat
              label="AC"
              value={fmtDeltaMD(dMemAC)}
              tone="na"
              sub={`現在 ${fmtMD(memberData.ac)}`}
            />
          </>
        ) : (
          <>
            <SummaryStat
              label="SPI"
              value={memberData.spi != null ? memberData.spi.toFixed(2) : 'N/A'}
              tone={spiTone(memberData.spi)}
            />
            <SummaryStat
              label="CPI"
              value={memberData.cpi != null ? memberData.cpi.toFixed(2) : 'N/A'}
              tone={
                memberData.cpi == null
                  ? 'na'
                  : memberData.cpi >= 1
                    ? 'normal'
                    : memberData.cpi >= 0.9
                      ? 'warning'
                      : 'critical'
              }
            />
            <SummaryStat
              label="EV"
              value={fmtMD(memberData.ev)}
              sub={`PV ${fmtMD(memberData.pv)}`}
            />
            <SummaryStat
              label="BAC"
              value={fmtMD(memberData.bac)}
              sub={`AC ${fmtMD(memberData.ac)}`}
            />
          </>
        )}
      </div>

      {/* Member SPI sparkline */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${EVM.rule}` }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 6,
          }}
        >
          <Eyebrow>SPI Trend</Eyebrow>
          <span style={{ fontSize: 10, color: EVM.ink3 }}>
            {`${(memSpi - 0.06).toFixed(2)} → ${memSpi.toFixed(2)}`}
          </span>
        </div>
        <Sparkline
          data={[
            memSpi - 0.06,
            memSpi - 0.05,
            memSpi - 0.03,
            memSpi - 0.02,
            memSpi - 0.01,
            memSpi,
          ]}
          w={340}
          h={48}
          color={statusColor(spiTone(memberData.spi))}
        />
      </div>

      {/* Member task list */}
      <div
        style={{
          padding: '14px 20px',
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Eyebrow>担当タスク</Eyebrow>
          <span style={{ fontSize: 10, color: EVM.ink3 }}>{memberTasks.length} 件</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {memberTasks.map((t) => {
            const tone = spiTone(t.spi)
            return (
              <div
                key={t.id}
                style={{
                  padding: '9px 12px',
                  borderRadius: 5,
                  border: `1px solid ${EVM.rule}`,
                  background: EVM.paperWarm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontFamily: EVM.fontMono, fontSize: 10, color: EVM.ink3 }}>
                      {t.code}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: EVM.ink,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.name}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: EVM.rule,
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${t.progress}%`,
                        height: '100%',
                        background: t.progress === 100 ? EVM.ok : EVM.brandDeep,
                      }}
                    />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: EVM.fontMono,
                      fontSize: 12,
                      fontWeight: 700,
                      color: t.spi == null ? EVM.ink4 : statusColor(tone),
                    }}
                  >
                    {t.spi == null ? 'N/A' : t.spi.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 9, color: EVM.ink3 }}>{t.progress}%</div>
                </div>
              </div>
            )
          })}
          {memberTasks.length === 0 && (
            <div style={{ color: EVM.ink3, fontSize: 12, fontStyle: 'italic' }}>
              担当タスクなし
            </div>
          )}
        </div>
      </div>
    </>
  )
})
