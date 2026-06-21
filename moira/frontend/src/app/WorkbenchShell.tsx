// WorkbenchShell — evm-app layout (top bar + left rail + main) hosting Moira's 5
// surfaces. Role (管理者/開発者) is NOT a separate app: it is an actor-kind
// preset/filter over the SAME single derivation (UI-DESIGN-BRIEF §1).

import { useState, type ReactNode } from 'react';
import { EVM } from '../theme/tokens';
import { useMoira } from '../moira/hooks';
import { ScheduleTimeSurface } from '../surfaces/schedule/ScheduleTimeSurface';
import { HealthSurface } from '../surfaces/health/HealthSurface';
import { CapacitySurface } from '../surfaces/capacity/CapacitySurface';
import { SpecValueSurface } from '../surfaces/spec/SpecValueSurface';
import { DecisionInboxSurface } from '../surfaces/inbox/DecisionInboxSurface';
import type { SurfaceId } from './types';

const NAV: Array<{ id: SurfaceId; label: string; axis: string }> = [
  { id: 'spec-value', label: 'spec-value', axis: '仕様・価値' },
  { id: 'schedule-time', label: 'schedule-time', axis: 'スケジュール・時間' },
  { id: 'health', label: 'health', axis: '健全性・EVM' },
  { id: 'decision-inbox', label: 'decision インボックス', axis: '横断・行為' },
  { id: 'capacity', label: 'capacity · calendar', axis: 'config・c(i,d)' },
];

export function WorkbenchShell() {
  const { asOf, setAsOf, derived, events } = useMoira();
  const [surface, setSurface] = useState<SurfaceId>('schedule-time');
  const [preset, setPreset] = useState<'mgr' | 'dev'>('mgr');

  let body: ReactNode;
  switch (surface) {
    case 'schedule-time':
      body = <ScheduleTimeSurface />;
      break;
    case 'health':
      body = <HealthSurface />;
      break;
    case 'spec-value':
      body = <SpecValueSurface />;
      break;
    case 'decision-inbox':
      body = <DecisionInboxSurface onNavigate={setSurface} />;
      break;
    case 'capacity':
      body = <CapacitySurface />;
      break;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 18px',
          background: EVM.card,
          borderBottom: `1px solid ${EVM.rule}`,
          flex: '0 0 auto',
        }}
      >
        <div className="serif" style={{ fontSize: 20, fontWeight: 600 }}>Moira</div>
        <div style={{ fontSize: 11, color: EVM.ink3 }}>Spec × Ticket × EVM ／ 単一 DerivedState 射影</div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: EVM.ink3 }}>役割＝同一導出へのフィルタ</span>
          <div style={{ display: 'flex', border: `1px solid ${EVM.rule}`, borderRadius: 999, overflow: 'hidden' }}>
            {(['mgr', 'dev'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                style={{
                  border: 'none',
                  background: preset === p ? EVM.brand : 'transparent',
                  color: preset === p ? '#1c2b08' : EVM.ink3,
                  fontWeight: preset === p ? 600 : 400,
                  fontSize: 11.5,
                  padding: '4px 12px',
                  cursor: 'pointer',
                }}
              >
                {p === 'mgr' ? '管理者' : '開発者'}
              </button>
            ))}
          </div>
          <label style={{ fontSize: 12, color: EVM.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
            基準日
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              style={{ fontFamily: EVM.fontMono, border: `1px solid ${EVM.rule}`, borderRadius: 6, padding: '4px 8px', background: EVM.paperWarm }}
            />
          </label>
        </div>
      </header>

      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
        {/* left rail */}
        <nav
          style={{
            width: 208,
            flex: '0 0 auto',
            background: EVM.card,
            borderRight: `1px solid ${EVM.rule}`,
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: EVM.ink4, padding: '2px 8px 6px' }}>
            層A read ダッシュボード
          </div>
          {NAV.map((item, i) => {
            const active = surface === item.id;
            if (i === 3) {
              return (
                <div key="sep">
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: EVM.ink4, padding: '10px 8px 6px' }}>
                    層B 非ダッシュボード
                  </div>
                  <NavBtn item={item} active={active} onClick={() => setSurface(item.id)} />
                </div>
              );
            }
            return <NavBtn key={item.id} item={item} active={active} onClick={() => setSurface(item.id)} />;
          })}

          <div style={{ marginTop: 'auto', fontSize: 10, color: EVM.ink4, padding: '8px', lineHeight: 1.5 }}>
            イベント {events.length} 件<br />
            構造エラー {derived.structuralErrors.length} 件<br />
            プリセット: {preset === 'mgr' ? '管理者' : '開発者'}
          </div>
        </nav>

        {/* main */}
        <main style={{ flex: '1 1 auto', minWidth: 0, overflow: 'auto', background: EVM.paper }}>{body}</main>
      </div>
    </div>
  );
}

function NavBtn({
  item,
  active,
  onClick,
}: {
  item: { label: string; axis: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: 'none',
        borderRadius: 7,
        padding: '7px 9px',
        cursor: 'pointer',
        background: active ? EVM.brandWash : 'transparent',
        borderLeft: active ? `2px solid ${EVM.brandDeep}` : '2px solid transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        width: '100%',
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? EVM.brandDeep : EVM.ink }}>
        {item.label}
      </span>
      <span style={{ fontSize: 10, color: EVM.ink3 }}>{item.axis}</span>
    </button>
  );
}
