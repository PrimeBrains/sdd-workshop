import { defineConfig, devices } from '@playwright/test';

// E2E harness for the Moira frontend — the realization of 計器③ (E2E・シナリオ回帰;
// see .kiro/steering/moira-verification.md). The SUT is the REAL Vite dev app on
// :5180. Each `agreed` scenario unit (.kiro/scenarios/units/*.md) is injected as a
// deterministic event-log fixture via `window.__MOIRA_FIXTURE__` (src/main.tsx seam
// + e2e/fixtures/load.ts), then the rendered DOM is asserted against the scenario's
// full target. Specified-but-unimplemented observables ride as `test.fail()`
// expected-failure tripwires (the browser analog of the it.fails PR-DONE-LOCK★).
//
// Only *.spec.ts under e2e/specs are Playwright tests. Fixture derive-goldens
// (e2e/fixtures/*.test.ts) run under vitest instead (they need @backend resolution
// from vite.config), so they are deliberately OUT of testDir/testMatch here.
const PORT = 5180;

export default defineConfig({
  testDir: './e2e/specs',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // deterministic fixtures — retries would only mask real flake
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // channel: 'chromium' runs the FULL chromium build in --headless=new instead of the
  // separate chrome-headless-shell binary — one fewer download to keep in sync. CI
  // installs it via `playwright install chromium`. Override with PW_CHANNEL (e.g.
  // PW_CHANNEL=msedge) to run against a system Chromium browser when the bundled
  // build isn't downloaded locally.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL ?? 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
