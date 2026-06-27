// Shared visual primitives, ported in spirit from mockup/shared.jsx. warm-light
// tokens; double-encoded status (color + shape/label) per UI-DESIGN-BRIEF §1.

import type { CSSProperties, ReactNode } from 'react';
import { EVM } from './tokens';
import type { LifecycleState, EstimateState, Actor } from '../moira/engine';
import { actorLabel } from '../moira/labels';

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'crit' | 'na' | 'agent';

const toneColor: Record<Tone, { fg: string; bg: string; bd: string }> = {
  neutral: { fg: EVM.ink2, bg: EVM.paperWarm, bd: EVM.rule },
  brand: { fg: EVM.brandDeep, bg: EVM.brandSoft, bd: '#cfe0a0' },
  ok: { fg: '#3c6b22', bg: EVM.okSoft, bd: '#c4d8a8' },
  warn: { fg: '#8a6c1a', bg: EVM.warnSoft, bd: '#e6d29a' },
  crit: { fg: '#8f3a24', bg: EVM.critSoft, bd: '#e0b8a6' },
  na: { fg: EVM.na, bg: EVM.ruleSoft, bd: EVM.rule },
  agent: { fg: '#4f5a3e', bg: '#eaeede', bd: '#cfd6bd' },
};

export function Pill({
  children,
  tone = 'neutral',
  title,
  testid,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  testid?: string;
}) {
  const t = toneColor[tone];
  return (
    <span
      title={title}
      data-testid={testid}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10.5,
        fontWeight: 600,
        lineHeight: 1.4,
        padding: '1px 7px',
        borderRadius: 999,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'neutral' }: { tone?: Tone }) {
  const t = toneColor[tone];
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: t.fg,
        display: 'inline-block',
        flex: '0 0 auto',
      }}
    />
  );
}

const LIFECYCLE_TONE: Record<LifecycleState, Tone> = {
  pending: 'na',
  ready: 'neutral',
  implementing: 'warn',
  implemented: 'brand',
  accepted: 'ok',
  cancelled: 'crit',
};
const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  pending: 'pending',
  ready: 'ready',
  implementing: 'implementing',
  implemented: 'implemented',
  accepted: 'accepted',
  cancelled: 'cancelled',
};

export function LifecyclePill({ state }: { state: LifecycleState }) {
  return (
    <Pill tone={LIFECYCLE_TONE[state]} testid="lifecycle-badge">
      {LIFECYCLE_LABEL[state]}
    </Pill>
  );
}

export function EstimatePill({ state }: { state: EstimateState }) {
  return state === 'agreed' ? (
    <Pill tone="ok" testid="estimate-badge">agreed</Pill>
  ) : (
    <Pill tone="na" title="未合意（EV_abs寄与0・PV不算入）" testid="estimate-badge">proposed*</Pill>
  );
}

export function Avatar({ actor, size = 18 }: { actor: Actor; size?: number }) {
  const isAgent = actor.kind === 'agent';
  const label = actorLabel(actor);
  const initial = isAgent ? 'AI' : label.slice(0, 1);
  return (
    <span
      title={`${label}${isAgent ? '（エージェント）' : ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: isAgent ? 4 : '50%',
        background: isAgent ? '#eaeede' : EVM.brandSoft,
        color: isAgent ? EVM.agent : EVM.brandDeep,
        border: `1px solid ${isAgent ? '#cfd6bd' : '#cfe0a0'}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size <= 18 ? 9 : 11,
        fontWeight: 700,
        flex: '0 0 auto',
      }}
    >
      {initial}
    </span>
  );
}

/** Coverage / progress bar. `derate` adds the diagonal hatch (R-S4/R-S6). */
export function Bar({
  value,
  tone = 'brand',
  derate = false,
  height = 8,
}: {
  value: number; // 0..1
  tone?: Tone;
  derate?: boolean;
  height?: number;
}) {
  const t = toneColor[tone];
  return (
    <span
      style={{
        position: 'relative',
        display: 'block',
        height,
        borderRadius: 6,
        background: '#ece7d8',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: t.fg,
          backgroundImage: derate
            ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.5) 0 3px, transparent 3px 6px)'
            : undefined,
          opacity: derate ? 0.65 : 1,
        }}
      />
    </span>
  );
}

export function Card({
  children,
  style,
  pad = 14,
  testid,
}: {
  children: ReactNode;
  style?: CSSProperties;
  pad?: number;
  testid?: string;
}) {
  return (
    <div
      data-testid={testid}
      style={{
        background: EVM.card,
        border: `1px solid ${EVM.rule}`,
        borderRadius: 10,
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: EVM.ink }}>{children}</h3>
      {hint !== undefined && <span style={{ fontSize: 11, color: EVM.ink3 }}>{hint}</span>}
    </div>
  );
}

export function SummaryStat({
  label,
  value,
  sub,
  tone = 'neutral',
  big = false,
  testid,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  big?: boolean;
  testid?: string;
}) {
  const fg = tone === 'neutral' ? EVM.ink : toneColor[tone].fg;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 96 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: EVM.ink3,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        className="serif"
        data-testid={testid}
        style={{
          fontSize: big ? 32 : 24,
          lineHeight: 1.05,
          color: fg,
          fontVariantNumeric: 'tabular-nums slashed-zero',
        }}
      >
        {value}
      </div>
      {sub !== undefined && <div style={{ fontSize: 11, color: EVM.ink3 }}>{sub}</div>}
    </div>
  );
}
