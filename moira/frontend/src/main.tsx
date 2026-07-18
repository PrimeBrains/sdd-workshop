import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { MoiraProvider } from './moira/store';
import { LiveFixtureBridge } from './moira/live';
import { PortfolioProvider } from './moira/portfolio-store';
import { PortfolioLiveBridge } from './moira/portfolio-live';
import { PortfolioShell } from './app/PortfolioShell';
import { demoEvents, demoCapacity, DEMO_AS_OF } from './moira/demo-data';
import { setUserLabels, setLabelsFixtureMode } from './moira/labels';
import { setRoster, type RosterMember } from './moira/roster';
import type { CapacityEntry, Event, IsoDate } from './moira/engine';
import type { PortfolioProjectFixture } from './moira/portfolio-context';

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
  /** org calendar (weekends + JP holidays) as the c(i,d) fallback (issue #32),
   *  from `.moira/config.json` `orgCalendar.enabled`. Absent → enabled
   *  (default-on), same `!== false` discipline as the CLI. */
  orgCalendarEnabled?: boolean;
  /** set only by the `moira ui` CLI server — mounts the SSE live bridge. */
  live?: boolean;
  /** portfolio mode (issue #23, `moira ui --portfolio`): N homes juxtaposed
   *  read-only. When present the single-project fields above are unused. */
  portfolio?: readonly PortfolioProjectFixture[];
  /** portfolio display name (portfolio.json `label`). */
  label?: string;
}
const fixture = (globalThis as { __MOIRA_FIXTURE__?: MoiraFixture }).__MOIRA_FIXTURE__;

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('#root not found');

if (fixture?.portfolio !== undefined) {
  // Portfolio boot (issue #23): labels/roster differ PER PROJECT, so the global
  // registries are NOT loaded here — the drill-down installs the selected
  // project's labels/roster before mounting the single-project shell. Flipping
  // fixtureMode still matters: demo names must never leak into a real portfolio.
  setLabelsFixtureMode(true);
  setRoster([], undefined);
  createRoot(rootEl).render(
    <StrictMode>
      <PortfolioProvider
        initialFixture={{
          portfolio: fixture.portfolio,
          asOf: fixture.asOf,
          ...(fixture.label !== undefined ? { label: fixture.label } : {}),
          ...(fixture.live !== undefined ? { live: fixture.live } : {}),
        }}
      >
        {fixture.live === true && <PortfolioLiveBridge initialAsOf={fixture.asOf} />}
        <PortfolioShell />
      </PortfolioProvider>
    </StrictMode>,
  );
} else {
  const initialEvents = fixture?.events ?? demoEvents;
  const initialCapacity = fixture?.capacity ?? demoCapacity;
  const initialAsOf = fixture?.asOf ?? DEMO_AS_OF;
  const initialDeadline = fixture?.deadline ?? null;
  const initialTargetDate = fixture?.targetDate ?? null;
  const initialMe = fixture?.me ?? null;
  const initialOrgCalendarEnabled = fixture?.orgCalendarEnabled;

  // When ANY fixture is present a real project (or a scenario) is connected: install
  // its labels + roster and flip fixtureMode so the demo roster/labels are bypassed.
  // Absent → demo mode, untouched.
  if (fixture !== undefined) {
    setUserLabels(fixture.nodeLabels, fixture.actorLabels);
    setLabelsFixtureMode(true);
    setRoster(fixture.members, fixture.me);
  }

  createRoot(rootEl).render(
    <StrictMode>
      <MoiraProvider
        initialEvents={initialEvents}
        initialCapacity={initialCapacity}
        initialAsOf={initialAsOf}
        initialDeadline={initialDeadline}
        initialTargetDate={initialTargetDate}
        initialMe={initialMe}
        initialOrgCalendarEnabled={initialOrgCalendarEnabled}
      >
        {fixture?.live === true && <LiveFixtureBridge initialAsOf={initialAsOf} />}
        <App />
      </MoiraProvider>
    </StrictMode>,
  );
}
