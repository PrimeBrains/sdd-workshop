/**
 * Task 2.1: TopBar
 *
 * 横並びヘッダー: ブランド + プロジェクトピッカー + 基準日ピッカー + 通知 + アバター。
 * モックアップ `variation-a.jsx` 行 83-227 を 1:1 で TSX 移植。
 */

import React, { useEffect } from 'react'
import { EVM } from '@/tokens/evm-tokens'
import { Avatar } from '@/components/atoms/Avatar'
import { BrandMark } from '@/components/atoms/BrandMark'
import { Chevron } from '@/components/atoms/Chevron'
import { Dot, type DotTone } from '@/components/atoms/Dot'
import { Eyebrow } from '@/components/atoms/Eyebrow'
import { Pill } from '@/components/atoms/Pill'
import { spiTone } from '@/lib/formatters'
import type { WorkbenchProject } from '@/types/workbench'

export interface TopBarProjectLite {
  id: number
  name: string
  code: string
  status: string
  /** プロジェクトピッカー内に表示する SPI (タスク件数とともに表示) */
  spi?: number | null
  /** プロジェクトピッカー内のサブテキスト用 (任意) */
  taskCount?: number
}

export interface TopBarProps {
  projects: ReadonlyArray<TopBarProjectLite>
  activeProjectId: number | null
  activeProject: WorkbenchProject | null
  baseDate: string
  projectMenuOpen: boolean
  datePickerOpen: boolean
  /** ユーザーアバター用イニシャル (任意・デフォルト '田美') */
  userInitials?: string
  onProjectChange: (id: number) => void
  onBaseDateChange: (iso: string) => void
  onToggleProjectMenu: () => void
  onToggleDatePicker: () => void
  /** Esc キー押下時に呼ばれる (両 popover の close は親が行う) */
  onDismissPopovers?: () => void
}

function statusToDotTone(status: string): DotTone {
  return status === 'active' ? 'normal' : status === 'paused' ? 'warning' : 'na'
}

export const TopBar = React.memo(function TopBar({
  projects,
  activeProjectId,
  activeProject,
  baseDate,
  projectMenuOpen,
  datePickerOpen,
  userInitials = '田美',
  onProjectChange,
  onBaseDateChange,
  onToggleProjectMenu,
  onToggleDatePicker,
  onDismissPopovers,
}: TopBarProps) {
  // Esc キーで開いている popover を閉じる
  useEffect(() => {
    if (!projectMenuOpen && !datePickerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismissPopovers?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [projectMenuOpen, datePickerOpen, onDismissPopovers])

  const projDotTone: DotTone = activeProject ? statusToDotTone(activeProject.status) : 'na'

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px',
        borderBottom: `1px solid ${EVM.rule}`,
        background: EVM.card,
        flex: '0 0 auto',
      }}
    >
      <BrandMark size={26} />
      <div style={{ width: 1, height: 22, background: EVM.rule }} />
      <div
        style={{
          fontFamily: EVM.fontBrand,
          fontSize: 13,
          letterSpacing: '0.18em',
          color: EVM.ink2,
        }}
      >
        EVM STUDIO
      </div>

      <nav style={{ display: 'flex', gap: 4, marginLeft: 18 }}>
        <span
          style={{
            padding: '6px 12px',
            borderRadius: 4,
            background: EVM.brandWash,
            color: EVM.brandDeep,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          ダッシュボード
        </span>
      </nav>

      <div style={{ flex: 1 }} />

      {/* Project picker */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={onToggleProjectMenu}
          className="evm-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 12px',
            background: EVM.paperWarm,
            border: `1px solid ${EVM.rule}`,
            borderRadius: 4,
            fontFamily: 'inherit',
            fontSize: 13,
            color: EVM.ink,
            cursor: 'pointer',
          }}
        >
          <Dot tone={projDotTone} size={6} />
          <span style={{ fontWeight: 500 }}>{activeProject?.name ?? '—'}</span>
          <span style={{ color: EVM.ink3, fontSize: 11, fontFamily: EVM.fontMono }}>
            {activeProject?.code ?? ''}
          </span>
          <Chevron open={projectMenuOpen} />
        </button>

        {projectMenuOpen && (
          <div
            className="evm-popover"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: 360,
              background: EVM.card,
              borderRadius: 6,
              border: `1px solid ${EVM.rule}`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)',
              zIndex: 20,
              padding: 6,
            }}
          >
            <div style={{ padding: '8px 10px 6px' }}>
              <Eyebrow>プロジェクト切替</Eyebrow>
            </div>
            {projects.map((p) => {
              const active = p.id === activeProjectId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onProjectChange(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '10px 12px',
                    border: 0,
                    background: active ? EVM.brandWash : 'transparent',
                    cursor: 'pointer',
                    borderRadius: 4,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <Dot tone={statusToDotTone(p.status)} size={7} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: EVM.ink,
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: EVM.ink3,
                        fontFamily: EVM.fontMono,
                      }}
                    >
                      {p.code}
                      {p.spi != null && ` · SPI ${p.spi.toFixed(2)}`}
                      {p.taskCount != null && ` · ${p.taskCount}件`}
                    </div>
                  </div>
                  {p.spi != null && (
                    <Pill tone={spiTone(p.spi)}>{p.spi.toFixed(2)}</Pill>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Base date */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={onToggleDatePicker}
          className="evm-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: EVM.paperWarm,
            border: `1px solid ${EVM.rule}`,
            borderRadius: 4,
            fontFamily: 'inherit',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: EVM.ink3,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            基準日
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: EVM.ink }}>
            {baseDate}
          </span>
          <Chevron open={datePickerOpen} />
        </button>

        {datePickerOpen && (
          <div
            className="evm-popover"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              background: EVM.card,
              borderRadius: 6,
              border: `1px solid ${EVM.rule}`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)',
              zIndex: 20,
              padding: 14,
              minWidth: 280,
            }}
          >
            <Eyebrow style={{ marginBottom: 10 }}>基準日を選択</Eyebrow>
            <input
              type="date"
              value={baseDate}
              onChange={(e) => onBaseDateChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: `1px solid ${EVM.rule}`,
                borderRadius: 4,
                fontFamily: EVM.fontMono,
                fontSize: 13,
                color: EVM.ink,
                background: EVM.paperWarm,
              }}
            />
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              {(
                [
                  { l: '今日', v: new Date().toISOString().slice(0, 10) },
                  {
                    l: '1週前',
                    v: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
                  },
                  {
                    l: '月初',
                    v: (() => {
                      const d = new Date()
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
                    })(),
                  },
                ] as ReadonlyArray<{ l: string; v: string }>
              ).map((p) => (
                <button
                  key={p.l}
                  type="button"
                  onClick={() => onBaseDateChange(p.v)}
                  className="evm-chip"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: EVM.paperWarm,
                    border: `1px solid ${EVM.rule}`,
                    fontFamily: 'inherit',
                    fontSize: 11.5,
                    color: EVM.ink2,
                    cursor: 'pointer',
                  }}
                >
                  {p.l}
                </button>
              ))}
            </div>
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: `1px solid ${EVM.rule}`,
                fontSize: 11,
                color: EVM.ink3,
              }}
            >
              ※ 基準日変更で EVM が再計算されます
            </div>
          </div>
        )}
      </div>

      <div
        className="evm-icon-btn"
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: EVM.paperWarm,
          border: `1px solid ${EVM.rule}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        aria-label="通知"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2 C5.5 2 4 4 4 6.5 V10 L3 12 H13 L12 10 V6.5 C12 4 10.5 2 8 2 Z M6.5 13 C6.5 13.8 7.2 14.5 8 14.5 C8.8 14.5 9.5 13.8 9.5 13"
            stroke={EVM.ink2}
            strokeWidth="1.3"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <Avatar initials={userInitials} tone="brand" size={30} />
    </header>
  )
})
