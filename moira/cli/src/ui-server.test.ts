import { get } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  debounceTrailing,
  injectFixture,
  serveUi,
  watchMoiraDir,
  type RunningUi,
  type UiFixture,
} from './ui-server.js';

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

  it('carries the R-T6 reference dates when present (issue #13)', () => {
    const out = injectFixture('<head></head>', {
      ...fixture,
      deadline: '2026-09-30',
      targetDate: '2026-09-15',
    });
    expect(out).toContain('"deadline":"2026-09-30"');
    expect(out).toContain('"targetDate":"2026-09-15"');
    // absent by default — optional fields are omitted, not undefined
    expect(injectFixture('<head></head>', fixture)).not.toContain('deadline');
  });

  it('carries the viewpoint actor `me` when present (issue #12)', () => {
    const out = injectFixture('<head></head>', { ...fixture, me: 'alice' });
    expect(out).toContain('"me":"alice"');
    // absent by default — the base fixture omits `me`
    expect(injectFixture('<head></head>', fixture)).not.toContain('"me"');
  });
});

// --- live server (issue #6) --------------------------------------------------

function tmpDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'moira-ui-'));
  writeFileSync(join(dir, 'index.html'), '<head></head><body></body>', 'utf8');
  return dir;
}

/** provider whose asOf embeds a call counter, so responses reveal freshness. */
function countingProvider(): { provider: () => UiFixture; calls: () => number } {
  let n = 0;
  return {
    provider: () => {
      n += 1;
      return { ...fixture, asOf: `call-${n}` };
    },
    calls: () => n,
  };
}

describe('serveUi (per-request rebuild + /api/fixture + SSE)', () => {
  let running: RunningUi | undefined;
  afterEach(async () => {
    await running?.close();
    running = undefined;
  });

  it('rebuilds `/` from a fresh provider read on every request (no-store)', async () => {
    const { provider } = countingProvider();
    running = await serveUi({ distDir: tmpDist(), port: 0, fixture: provider });
    const first = await fetch(`${running.url}/`);
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(await first.text()).toContain('"asOf":"call-1"');
    const second = await fetch(`${running.url}/`);
    expect(await second.text()).toContain('"asOf":"call-2"'); // NOT the boot-time bake
  });

  it('serves a fresh fixture JSON on /api/fixture', async () => {
    const { provider } = countingProvider();
    running = await serveUi({ distDir: tmpDist(), port: 0, fixture: provider });
    const resp = await fetch(`${running.url}/api/fixture`);
    expect(resp.headers.get('content-type')).toContain('application/json');
    expect(resp.headers.get('cache-control')).toBe('no-store');
    const body = (await resp.json()) as UiFixture;
    expect(body.asOf).toBe('call-1');
    const again = (await (await fetch(`${running.url}/api/fixture`)).json()) as UiFixture;
    expect(again.asOf).toBe('call-2');
  });

  it('serves the last-good fixture when the provider throws mid-flight', async () => {
    let broken = false;
    const provider = (): UiFixture => {
      if (broken) throw new Error('torn read');
      return fixture;
    };
    running = await serveUi({ distDir: tmpDist(), port: 0, fixture: provider });
    expect((await fetch(`${running.url}/api/fixture`)).status).toBe(200);
    broken = true; // simulate a torn .moira read
    const resp = await fetch(`${running.url}/api/fixture`);
    expect(resp.status).toBe(200);
    expect(((await resp.json()) as UiFixture).asOf).toBe('2026-06-29');
  });

  it('SSE: handshake preamble, then a change frame on notifyChange()', async () => {
    const { provider } = countingProvider();
    running = await serveUi({ distDir: tmpDist(), port: 0, fixture: provider });
    const url = running;

    const frames: string[] = [];
    const gotChange = new Promise<void>((resolve, reject) => {
      const req = get(`${url.url}/api/stream`, (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          frames.push(chunk);
          if (chunk.includes('event: change')) {
            req.destroy();
            resolve();
          }
        });
      });
      req.on('error', () => undefined); // destroyed on purpose
      setTimeout(() => reject(new Error('no change frame within 3s')), 3000).unref();
    });

    // Let the subscription land, then fire the (debounced) change signal
    // directly — fs.watch stays out of this test path entirely.
    await new Promise((r) => setTimeout(r, 50));
    url.notifyChange();
    await gotChange;

    const all = frames.join('');
    expect(all).toContain('retry: 1000');
    expect(all).toContain(':connected');
    expect(all).toContain('data: {"seq":1}');
  });

  it('close() is clean: notifyChange after close is a no-op, port is released', async () => {
    const { provider } = countingProvider();
    const r = await serveUi({ distDir: tmpDist(), port: 0, fixture: provider });
    await r.close();
    r.notifyChange(); // must not throw or keep the process alive
    await expect(fetch(`${r.url}/api/fixture`)).rejects.toThrow();
  });
});

describe('debounceTrailing', () => {
  it('collapses a burst into one trailing call', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const d = debounceTrailing(fn, 150);
      for (let i = 0; i < 5; i += 1) d.fire();
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(149);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancel() suppresses a pending call', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const d = debounceTrailing(fn, 150);
      d.fire();
      d.cancel();
      vi.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// The ONLY test touching real fs.watch — quarantined with a generous timeout and
// retries; every other live-path test drives notifyChange() directly.
describe('watchMoiraDir (real fs integration)', () => {
  it('fires on events.json writes', { timeout: 5000, retry: 2 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'moira-watch-'));
    writeFileSync(join(dir, 'events.json'), '[]\n', 'utf8');
    let fired = false;
    const watcher = watchMoiraDir(dir, () => {
      fired = true;
    });
    expect(watcher).not.toBeNull();
    try {
      await new Promise((r) => setTimeout(r, 100)); // let the watch settle
      writeFileSync(join(dir, 'events.json'), '[{"x":1}]\n', 'utf8');
      const deadline = Date.now() + 4000;
      while (!fired && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(fired).toBe(true);
    } finally {
      watcher?.close();
    }
  });
});
