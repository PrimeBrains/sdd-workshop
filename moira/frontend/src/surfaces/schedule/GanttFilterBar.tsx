// Row filter controls for the schedule-time Gantt (issue #8). Display-only:
// it edits a RowFilter and hands it back via onChange — no state/store here
// (filter state lives in the surface's useState). The KIND (queue) filter stays
// in the surface itself; this bar owns assignee / completion / divergence.
// NOTE: FilterBars are intentionally NOT shared across surfaces (depcruise
// surfaces-no-cross-surface); the spec surface has its own copy.

import { EVM } from '../../theme/tokens';
import { actorLabel } from '../../moira/labels';
import type { Actor } from '../../moira/engine';
import type { AssigneeFilter, RowFilter } from './gantt-geometry';

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

export function GanttFilterBar({ filter, onChange, options }: Props) {
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

      {/* completion */}
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

      {/* divergence */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: EVM.ink3 }}>進捗</span>
        {(['all', 'behind', 'on-track'] as const).map((d) => (
          <button
            key={d}
            data-testid={`row-filter:divergence:${d}`}
            onClick={() => set({ divergence: d })}
            style={btn(filter.divergence === d)}
          >
            {d === 'all' ? 'すべて' : d === 'behind' ? '遅延中' : '順調'}
          </button>
        ))}
      </div>
    </div>
  );
}
