// Methodology provider seam. A provider is the ONLY place that understands a
// methodology's on-disk artifacts (cc-sdd's spec.json / tasks.md, a future
// Scrum board, …) and normalizes them into the drift engine's Moira-only
// vocabulary (ExpectedFeature). Adding a methodology = adding a provider file;
// the drift core never changes.

import type { ExpectedFeature } from '../drift/types.js';

export interface MethodologyProvider {
  readonly id: string;
  /** Does this methodology's artifact layout exist at cwd? */
  detect(cwd: string): boolean;
  /** Normalize on-disk state into expected Moira node states (read-only). */
  loadExpected(cwd: string, projectRoot: string): ExpectedFeature[];
}
