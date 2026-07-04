// Row filter controls for the spec-value surface (issue #8). Display-only:
// edits a RowFilter, hands it back via onChange (state lives in the surface).
// Owns assignee / completion(strict) / estimate. Deliberately a SEPARATE copy
// from GanttFilterBar (depcruise surfaces-no-cross-surface forbids sharing a
// component across surfaces; only gantt-geometry.ts types/pure-fns are shared).

import { EVM } from '../../theme/tokens';
import { actorLabel } from '../../moira/labels';
import { ESTIMATE_JA } from '../../moira/glossary';
import type { Actor } from '../../moira/engine';
import type { AssigneeFilter, RowFilter } from '../schedule/gantt-geometry';

interface Props {
  filter: RowFilter;
  onChange: (f: RowFilter) => void;
  options: Actor[];
}

const btn = (active: boolean): React.CSSProperties => ({
  fontSize: 11.5,
  border: `1px solid ${active ? EVM.brandDeep : EVM.rule}`,
  background: active ? EVM.brandSoft : EVM.paperWarm,
  color: active ? EVM.brandDeep : EVM.ink2,
  borderRadius: 999,
  padding: '3px 11px',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
});

const assigneeValue = (a: AssigneeFilter): string => (a === 'all' || a === 'unassigned' ? a : a.id);

const ESTIMATE_LABEL: Record<RowFilter['estimate'], string> = {
  all: 'すべて',
  unestimated: '未見積',
  proposed: ESTIMATE_JA.proposed, // 見積提案中
  agreed: ESTIMATE_JA.agreed, // 見積合意済
};

export function SpecFilterBar({ filter, onChange, options }: Props) {
  const set = (patch: Partial<RowFilter>) => onChange({ ...filter, ...patch });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {/* assignee */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: EVM.ink3 }}>
        担当
        <select
          data-testid="row-filter:assignee"
          value={assigneeValue(filter.assignee)}
          onChange={(e) => {
            const v = e.target.value;
            set({ assignee: v === 'all' || v === 'unassigned' ? v : { id: v } });
          }}
          style={{ fontSize: 11.5, border: `1px solid ${EVM.rule}`, background: EVM.paperWarm, color: EVM.ink2, borderRadius: 6, padding: '3px 8px' }}
        >
          <option value="all">全員</option>
          <option value="unassigned">未割当</option>
          {options.map((a) => (
            <option key={`${a.kind}:${a.id}`} value={a.id}>
              {actorLabel(a)}
            </option>
          ))}
        </select>
      </label>

      {/* completion (strict: completed ∧ agreed) */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: EVM.ink3 }}>完了</span>
        {(['all', 'incomplete', 'complete'] as const).map((c) => (
          <button
            key={c}
            data-testid={`row-filter:completion:${c}`}
            onClick={() => set({ completion: c })}
            style={btn(filter.completion === c)}
          >
            {c === 'all' ? 'すべて' : c === 'incomplete' ? '未完了' : '完了'}
          </button>
        ))}
      </div>

      {/* estimate state */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: EVM.ink3 }}>見積</span>
        {(['all', 'unestimated', 'proposed', 'agreed'] as const).map((e) => (
          <button
            key={e}
            data-testid={`row-filter:estimate:${e}`}
            onClick={() => set({ estimate: e })}
            style={btn(filter.estimate === e)}
          >
            {ESTIMATE_LABEL[e]}
          </button>
        ))}
      </div>
    </div>
  );
}
