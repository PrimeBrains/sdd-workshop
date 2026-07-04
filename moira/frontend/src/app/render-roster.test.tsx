// Issue #11 acceptance (the reason the whole feature exists): with a real project
// connected (fixtureMode + a supplied roster + supplied labels — exactly what the
// CLI writes to members.json + labels.json), the surfaces show ONLY the names the
// user supplied. A demo name (田中) must appear NOWHERE in the DOM.

import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoiraProvider } from '../moira/store';
import { CapacitySurface } from '../surfaces/capacity/CapacitySurface';
import { Inspector } from '../surfaces/schedule/Inspector';
import { setLabelsFixtureMode, setUserLabels, resetLabelsForTests } from '../moira/labels';
import { setRoster, resetRosterForTests } from '../moira/roster';
import type { Event } from '../moira/engine';

// A one-node real project assigned to a user-supplied member.
const events: Event[] = [
  {
    kind: 'decompose', id: 'e1', ts: 1, actor: { kind: 'human', id: 'nakao' },
    parent: 'root', reason: 'r', children: [{ node: 'A', estimate: 1 }],
  },
  { kind: 'transition', id: 'e2', ts: 2, actor: { kind: 'human', id: 'nakao' }, node: 'A', machine: 'estimate-agreement', to: 'agreed', frozenBudget: 1 },
  {
    kind: 'transition', id: 'e3', ts: 3, actor: { kind: 'human', id: 'nakao' },
    node: 'A', machine: 'lifecycle', to: 'ready', assignee: { kind: 'human', id: 'nakao' }, frozenSlot: '2026-07-02',
  },
];

function wrap(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <MoiraProvider initialEvents={events} initialCapacity={[]} initialAsOf="2026-07-02">
      {node}
    </MoiraProvider>,
  );
}

// Reproduce the CLI: `moira member add nakao --label 中尾` writes BOTH files.
function connectRealProject(): void {
  setLabelsFixtureMode(true);
  setUserLabels({ A: '認証' }, { nakao: '中尾' });
  setRoster([{ id: 'nakao', kind: 'human', label: '中尾' }], 'nakao');
}

afterEach(() => {
  resetRosterForTests();
  resetLabelsForTests();
});

describe('real project → only user-supplied names (no demo leak)', () => {
  it('CapacitySurface shows 中尾 and never 田中/佐藤/鈴木', () => {
    connectRealProject();
    const html = wrap(<CapacitySurface />);
    expect(html).toContain('中尾');
    expect(html).not.toContain('田中');
    expect(html).not.toContain('佐藤');
    expect(html).not.toContain('鈴木');
  });

  it('Inspector shows 中尾 (reassign candidate + assignee) and never 田中', () => {
    connectRealProject();
    const html = wrap(<Inspector node="A" />);
    expect(html).toContain('中尾');
    expect(html).not.toContain('田中');
  });
});
