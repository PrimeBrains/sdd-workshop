import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { MoiraProvider } from './moira/store';
import { LiveFixtureBridge } from './moira/live';
import { demoEvents, demoCapacity, DEMO_AS_OF } from './moira/demo-data';
import { setUserLabels, setLabelsFixtureMode } from './moira/labels';
import { setRoster, type RosterMember } from './moira/roster';
import type { CapacityEntry, Event, IsoDate } from './moira/engine';

// Fixture seam (state-injection). Set via addInitScript (Playwright E2E) or an
// inline <script> (the `moira ui` CLI server) BEFORE this module evaluates, so a
// real project's `.moira/events.json` — or a scenario's transcribed log — boots
// the app deterministically. In normal use the global is absent and the app boots
// from demo data — zero production impact. This is the browser equivalent of
// MoiraProvider's existing initial* props. `nodeLabels`/`actorLabels` are
// presentation-only (from `.moira/labels.json`); absent → demo labels → raw id.
// `members`/`me` seed the roster (issue #11) so a real project shows only the
// names the user actually supplied — never the demo roster.
interface MoiraFixture {
  events: readonly Event[];
  capacity?: readonly CapacityEntry[];
  asOf: IsoDate;
  nodeLabels?: Record<string, string>;
  actorLabels?: Record<string, string>;
  /** roster (.moira/members.json). Optional so E2E fixtures need no change. */
  members?: readonly RosterMember[];
  /** viewpoint actor id (.moira/config.json `me`) — the roster's "self" (#11) and
   *  the「自分」decision-inbox filter (#12). */
  me?: string;
  /** R-T6 reference dates (issue #13) — latest-wins-resolved by the CLI. */
  deadline?: IsoDate;
  targetDate?: IsoDate;
  /** set only by the `moira ui` CLI server — mounts the SSE live bridge. */
  live?: boolean;
}
const fixture = (globalThis as { __MOIRA_FIXTURE__?: MoiraFixture }).__MOIRA_FIXTURE__;
const initialEvents = fixture?.events ?? demoEvents;
const initialCapacity = fixture?.capacity ?? demoCapacity;
const initialAsOf = fixture?.asOf ?? DEMO_AS_OF;
const initialDeadline = fixture?.deadline ?? null;
const initialTargetDate = fixture?.targetDate ?? null;
const initialMe = fixture?.me ?? null;

// When ANY fixture is present a real project (or a scenario) is connected: install
// its labels + roster and flip fixtureMode so the demo roster/labels are bypassed.
// Absent → demo mode, untouched.
if (fixture !== undefined) {
  setUserLabels(fixture.nodeLabels, fixture.actorLabels);
  setLabelsFixtureMode(true);
  setRoster(fixture.members, fixture.me);
}

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <MoiraProvider
      initialEvents={initialEvents}
      initialCapacity={initialCapacity}
      initialAsOf={initialAsOf}
      initialDeadline={initialDeadline}
      initialTargetDate={initialTargetDate}
      initialMe={initialMe}
    >
      {fixture?.live === true && <LiveFixtureBridge initialAsOf={initialAsOf} />}
      <App />
    </MoiraProvider>
  </StrictMode>,
);
