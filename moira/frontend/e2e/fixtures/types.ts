// The shape Playwright injects via window.__MOIRA_FIXTURE__ (read by src/main.tsx).
// Type-only imports from the frontend engine — erased at runtime, so importing this
// module from a Playwright spec never pulls the @backend bundle into the test loader.
import { type CapacityEntry, type Event, type IsoDate } from '../../src/moira/engine';

export interface MoiraFixture {
  events: readonly Event[];
  capacity?: readonly CapacityEntry[];
  asOf: IsoDate;
}
