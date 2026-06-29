import { describe, expect, it } from 'vitest';
import { injectFixture, type UiFixture } from './ui-server.js';

const fixture: UiFixture = {
  events: [],
  capacity: [],
  asOf: '2026-06-29',
  nodeLabels: { F: '<b>feature</b>' },
  actorLabels: {},
};

describe('injectFixture', () => {
  it('places the fixture script inside <head> before the module script', () => {
    const html = '<head>\n    <script type="module" src="/assets/app.js"></script>\n  </head>';
    const out = injectFixture(html, fixture);
    const fixtureIdx = out.indexOf('window.__MOIRA_FIXTURE__');
    const moduleIdx = out.indexOf('type="module"');
    expect(fixtureIdx).toBeGreaterThan(-1);
    expect(fixtureIdx).toBeLessThan(moduleIdx); // runs before the deferred module
  });

  it('escapes <,>,& so labels cannot break out of the script element', () => {
    const out = injectFixture('<head></head>', fixture);
    expect(out).not.toContain('<b>feature</b>');
    expect(out).toContain('\\u003cb\\u003e');
    expect(out).toContain('"asOf":"2026-06-29"');
  });
});
