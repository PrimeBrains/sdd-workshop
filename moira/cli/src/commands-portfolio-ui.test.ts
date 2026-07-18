// Issue #32 portfolio wiring: `moira ui --portfolio` must carry EACH home's own
// .moira/config.json `orgCalendar.enabled` into its PortfolioUiProject — a
// portfolio-wide setting is never synthesized, and a home whose config omits
// `orgCalendar` defaults to enabled (same `!== false` discipline as the
// single-project `moira ui` fixture; see commands.ts buildPortfolioFixture /
// cmdUi's single-project `provider()`).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPortfolioFixture } from './commands.js';
import type { PortfolioUiProject } from './ui-server.js';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'moira-portfolio-ui-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** A real log home at <tmp>/<name>, config.json carrying an explicit/omitted orgCalendar. */
function makeHome(name: string, orgCalendar?: { enabled: boolean }): string {
  const root = join(tmp, name);
  mkdirSync(join(root, '.moira'), { recursive: true });
  const config = {
    projectRoot: 'p',
    me: 'me',
    ...(orgCalendar !== undefined ? { orgCalendar } : {}),
  };
  writeFileSync(join(root, '.moira', 'config.json'), JSON.stringify(config));
  writeFileSync(join(root, '.moira', 'events.json'), '[]\n');
  return root;
}

function writePortfolio(name: string, homes: Array<{ path: string; label?: string }>): string {
  const p = join(tmp, name);
  writeFileSync(p, JSON.stringify({ schemaVersion: 1, homes }));
  return p;
}

function findProject(fx: { portfolio: readonly PortfolioUiProject[] }, label: string): PortfolioUiProject {
  const p = fx.portfolio.find((x) => x.label === label);
  if (p === undefined) throw new Error(`project not found: ${label}`);
  return p;
}

describe('buildPortfolioFixture — per-home orgCalendarEnabled propagation (issue #32)', () => {
  it('each home carries its OWN orgCalendar setting, independent of its siblings', () => {
    makeHome('on-explicit', { enabled: true });
    makeHome('off-explicit', { enabled: false });
    makeHome('unset');
    const p = writePortfolio('portfolio.json', [
      { path: 'on-explicit', label: 'ON' },
      { path: 'off-explicit', label: 'OFF' },
      { path: 'unset', label: 'UNSET' },
    ]);

    const fx = buildPortfolioFixture(p);

    expect(findProject(fx, 'ON').orgCalendarEnabled).toBe(true);
    expect(findProject(fx, 'OFF').orgCalendarEnabled).toBe(false);
    // UNSET → default-on (`!== false`), same discipline as the single-project fixture.
    expect(findProject(fx, 'UNSET').orgCalendarEnabled).toBe(true);
  });

  it('a loadError row carries no orgCalendarEnabled (data fields are placeholders)', () => {
    makeHome('ok-home');
    const p = writePortfolio('portfolio.json', [
      { path: 'does-not-exist', label: 'GONE' },
      { path: 'ok-home', label: 'OK' },
    ]);
    const fx = buildPortfolioFixture(p);
    const row = findProject(fx, 'GONE');
    expect(row.loadError).toBeDefined();
    expect(row.orgCalendarEnabled).toBeUndefined();
    expect(findProject(fx, 'OK').orgCalendarEnabled).toBe(true);
  });
});
