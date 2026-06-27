import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { MoiraProvider } from './moira/store';
import { demoEvents, demoCapacity, DEMO_AS_OF } from './moira/demo-data';
import type { CapacityEntry, Event, IsoDate } from './moira/engine';

// Test-only fixture seam (E2E state-injection). Playwright sets
// `window.__MOIRA_FIXTURE__` via addInitScript BEFORE this module evaluates, so a
// scenario's transcribed event log boots the app deterministically. In normal use
// the global is absent and the app boots from demo data — zero production impact.
// This is the browser equivalent of MoiraProvider's existing initial* props.
interface MoiraFixture {
  events: readonly Event[];
  capacity?: readonly CapacityEntry[];
  asOf: IsoDate;
}
const fixture = (globalThis as { __MOIRA_FIXTURE__?: MoiraFixture }).__MOIRA_FIXTURE__;
const initialEvents = fixture?.events ?? demoEvents;
const initialCapacity = fixture?.capacity ?? demoCapacity;
const initialAsOf = fixture?.asOf ?? DEMO_AS_OF;

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <MoiraProvider initialEvents={initialEvents} initialCapacity={initialCapacity} initialAsOf={initialAsOf}>
      <App />
    </MoiraProvider>
  </StrictMode>,
);
