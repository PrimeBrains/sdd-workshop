// Render smoke for the schedule-time UX additions (issues #26–#29). Mounts the
// real components over demo data with renderToStaticMarkup — no browser — to pin
// that the new controls/markup exist and don't throw. Interaction (drag-resize,
// toggling, sticky follow) is covered by manual/E2E verification; here we only
// assert the presence of the observable hooks and the opt-in rendering paths.

import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoiraProvider } from '../../moira/store';
import { App } from '../../App';
import { ScheduleGantt } from './ScheduleGantt';
import { Inspector } from './Inspector';
import { buildGanttModel, DEFAULT_ROW_FILTER, depSegments } from './gantt-geometry';
import { derive, fold } from '../../moira/engine';
import { labelOf, resetLabelsForTests } from '../../moira/labels';
import { demoEvents, demoCapacity, DEMO_AS_OF } from '../../moira/demo-data';

const wrap = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <MoiraProvider initialEvents={demoEvents} initialCapacity={demoCapacity} initialAsOf={DEMO_AS_OF}>
      {node}
    </MoiraProvider>,
  );

beforeEach(() => resetLabelsForTests()); // demo-label fallback active (module state leaks)

describe('schedule-time UX additions', () => {
  it('#26/#28: the default surface mounts the column resizer and the axis/dep toggles', () => {
    const html = wrap(<App />);
    expect(html).toContain('data-testid="gantt-col-resizer"'); // resizable task-name column
    expect(html).toContain('data-testid="grid-weeks"');
    expect(html).toContain('data-testid="grid-days"');
    expect(html).toContain('data-testid="dep-toggle"');
    expect(html).toContain('aria-pressed="true"'); // week gridlines default ON
  });

  it('#27: the task-detail (Inspector) column is sticky so it follows vertical scroll', () => {
    const html = wrap(<App />);
    // the Inspector wrapper is the only sticky element offset from the top (the
    // header sticks at top:0); top:16px is its signature.
    expect(html).toContain('position:sticky');
    expect(html).toContain('top:16px');
  });

  it('#28: week gridlines are drawn by default (dashed asOf plus solid gridlines)', () => {
    const html = wrap(<App />);
    // buildAxisTicks feeds <line> gridlines into the SVG overlay; the asOf line is
    // dashed, gridlines are solid with a fractional opacity.
    expect(html).toMatch(/opacity="0\.1[28]"/); // month 0.18 / week 0.12 gridline
  });

  it('#29: predecessors are listed in the Inspector for a node with a dependency', () => {
    const projected = fold(demoEvents);
    const edge = projected.dependencyEdges.find(
      (e) => projected.nodes.has(e.from) && projected.nodes.has(e.to),
    );
    expect(edge).toBeDefined();
    const html = wrap(<Inspector node={edge!.to} onSelect={() => {}} />);
    expect(html).toContain('data-testid="field:predecessors"');
    expect(html).toContain('先行タスク');
    expect(html).toContain(labelOf(edge!.from)); // the predecessor's label is shown
  });

  it('#29: dependency connectors render only when showDeps is on', () => {
    const projected = fold(demoEvents);
    const derived = derive(demoEvents, { asOf: DEMO_AS_OF });
    const model = buildGanttModel(projected, derived, DEFAULT_ROW_FILTER);

    const off = wrap(
      <ScheduleGantt model={model} asOf={DEMO_AS_OF} selected={null} onSelect={() => {}} edges={projected.dependencyEdges} />,
    );
    expect(off).not.toContain('依存（先行→後続・破線）'); // legend hidden when off

    const on = wrap(
      <ScheduleGantt
        model={model}
        asOf={DEMO_AS_OF}
        selected={null}
        onSelect={() => {}}
        edges={projected.dependencyEdges}
        showDeps
      />,
    );
    // demo has leaf→leaf dependencies (at minimum the critical-path chain)
    const segs = depSegments(model.rows, projected.dependencyEdges, model.start, 18);
    expect(segs.length).toBeGreaterThan(0);
    expect(on).toContain('依存（先行→後続・破線）'); // legend appears
    expect(on).toContain('stroke-dasharray="4 3"'); // a finish→start connector is drawn
  });
});
