import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { MoiraProvider } from './moira/store';
import { demoEvents, demoCapacity, DEMO_AS_OF } from './moira/demo-data';
import { setUserLabels } from './moira/labels';
import type { CapacityEntry, Event, IsoDate } from './moira/engine';

// Fixture seam (state-injection). Set via addInitScript (Playwright E2E) or an
// inline <script> (the `moira ui` CLI server) BEFORE this module evaluates, so a
// real project's `.moira/events.json` — or a scenario's transcribed log — boots
// the app deterministically. In normal use the global is absent and the app boots
// from demo data — zero production impact. This is the browser equivalent of
// MoiraProvider's existing initial* props. `nodeLabels`/`actorLabels` are
// presentation-only (from `.moira/labels.json`); absent → demo labels → raw id.
interface MoiraFixture {
  events: readonly Event[];
  capacity?: readonly CapacityEntry[];
  asOf: IsoDate;
  nodeLabels?: Record<string, string>;
  actorLabels?: Record<string, string>;
}
const fixture = (globalThis as { __MOIRA_FIXTURE__?: MoiraFixture }).__MOIRA_FIXTURE__;
const initialEvents = fixture?.events ?? demoEvents;
const initialCapacity = fixture?.capacity ?? demoCapacity;
const initialAsOf = fixture?.asOf ?? DEMO_AS_OF;

// Install user-supplied display labels before first render (no-op when absent).
if (fixture?.nodeLabels !== undefined || fixture?.actorLabels !== undefined) {
  setUserLabels(fixture.nodeLabels, fixture.actorLabels);
}

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <MoiraProvider initialEvents={initialEvents} initialCapacity={initialCapacity} initialAsOf={initialAsOf}>
      <App />
    </MoiraProvider>
  </StrictMode>,
);
