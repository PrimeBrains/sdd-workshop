/**
 * Task 2.2: ProjectRail
 *
 * 左レール 232px 固定: Projects セクション + Members セクション。
 * モックアップ `variation-a.jsx` 行 233-316 を 1:1 で TSX 移植。
 */

import React from 'react'
import { EVM } from '@/tokens/evm-tokens'
import { Avatar } from '@/components/atoms/Avatar'
import { Dot, type DotTone } from '@/components/atoms/Dot'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { spiTone, statusColor } from '@/lib/formatters'
import type { AssigneeEvm, MemberInfo } from '@/types/workbench'

export interface ProjectRailProjectItem {
  id: number
  name: string
  code: string
  status: string
  spi: number | null
  taskCount: number
  alertCount: number
}

export interface ProjectRailProps {
  projects: ReadonlyArray<ProjectRailProjectItem>
  activeProjectId: number | null
  members: ReadonlyArray<MemberInfo>
  assignees: ReadonlyArray<AssigneeEvm>
  /** 担当者名 → アラート件数 (任意。表示用途) */
  alertCountByProject?: Readonly<Record<number, number>>
  inspectorMode: 'task' | 'member' | 'team'
  inspectorMemberId: number | null
  onProjectChange: (id: number) => void
  onMemberSelect: (assignee: AssigneeEvm) => void
}

function statusToDotTone(status: string): DotTone {
  return status === 'active' ? 'normal' : status === 'paused' ? 'warning' : 'na'
}

export const ProjectRail = React.memo(function ProjectRail({
  projects,
  activeProjectId,
  members,
  assignees,
  inspectorMode,
  inspectorMemberId,
  onProjectChange,
  onMemberSelect,
}: ProjectRailProps) {
  return (
    <aside
      style={{
        width: 232,
        flex: '0 0 auto',
        background: EVM.card,
        borderRight: `1px solid ${EVM.rule}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 16px 6px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Eyebrow>Projects · {projects.length}</Eyebrow>
        <button
          type="button"
          className="evm-icon-btn"
          style={{
            fontSize: 14,
            color: EVM.ink3,
            background: 'transparent',
            border: 0,
            padding: 2,
            borderRadius: 3,
            cursor: 'pointer',
          }}
          aria-label="プロジェクト追加"
        >
          +
        </button>
      </div>
      <div
        style={{
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'auto',
        }}
      >
        {projects.map((p) => {
          const active = p.id === activeProjectId
          const tone = spiTone(p.spi)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onProjectChange(p.id)}
              className="evm-project-btn"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 10px',
                borderRadius: 4,
                border: 0,
                background: active ? EVM.brandWash : 'transparent',
                borderLeft: `3px solid ${active ? EVM.brandDeep : 'transparent'}`,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: 'inherit',
              }}
            >
              <Dot tone={statusToDotTone(p.status)} size={6} />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    color: EVM.ink,
                    lineHeight: 1.3,
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: EVM.ink3,
                    fontFamily: EVM.fontMono,
                    letterSpacing: '0.02em',
                  }}
                >
                  {p.code} · {p.taskCount}件
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: EVM.fontMono,
                      color: statusColor(tone),
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    SPI {p.spi != null ? p.spi.toFixed(2) : '—'}
                  </span>
                  {p.alertCount > 0 && (
                    <span
                      style={{
                        fontSize: 9.5,
                        color: '#8a6c1a',
                        background: EVM.warnSoft,
                        padding: '0 5px',
                        borderRadius: 999,
                        fontWeight: 700,
                        border: '1px solid #e6d29a',
                      }}
                    >
                      !{p.alertCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: '14px 16px 8px',
          borderTop: `1px solid ${EVM.rule}`,
        }}
      >
        <Eyebrow>Members · {members.length}</Eyebrow>
      </div>
      <div
        style={{
          padding: '4px 12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {members.map((m) => {
          const a = assignees.find((x) => x.name === m.name)
          const active =
            inspectorMode === 'member' && a != null && inspectorMemberId === a.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (a) onMemberSelect(a)
              }}
              className="evm-assignee-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 6px',
                border: 0,
                borderRadius: 4,
                textAlign: 'left',
                fontFamily: 'inherit',
                background: active ? EVM.brandWash : 'transparent',
                borderLeft: `3px solid ${active ? EVM.brandDeep : 'transparent'}`,
                cursor: a ? 'pointer' : 'default',
                color: 'inherit',
              }}
            >
              <Avatar initials={m.initials} size={22} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11.5, color: EVM.ink, fontWeight: 500 }}>
                  {m.name}
                </div>
                <div style={{ fontSize: 9.5, color: EVM.ink3 }}>{m.role}</div>
              </div>
              {a && a.spi != null && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: EVM.fontMono,
                    color: statusColor(spiTone(a.spi)),
                    fontWeight: 600,
                  }}
                >
                  {a.spi.toFixed(2)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </aside>
  )
})
