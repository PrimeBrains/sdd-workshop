// Minimal static server for `moira ui`. Serves the prebuilt frontend dist/ and
// injects the user's event log as window.__MOIRA_FIXTURE__ into index.html BEFORE
// the app module loads (an inline classic <script> runs before the deferred module
// script — see frontend/src/main.tsx). Zero extra deps (node:http + node:fs).
//
// Freshness (issue #6) is two-layered so the acceptance floor never depends on
// fs.watch working:
//   (a) `/` re-reads the .moira snapshot on EVERY request (no-store) — a browser
//       reload always shows the latest log, even with no watcher at all.
//   (b) fs.watch on the .moira DIRECTORY → debounced SSE "change" ping on
//       `/api/stream` → the open tab refetches `/api/fixture` and re-derives.
// SSE carries only a ping (never the fixture body): no multi-line SSE framing of
// large JSON, no second serialization path, and N rapid pings collapse into one
// client refetch of the latest snapshot.

import { createServer, type Server, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync, watch } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import type { CapacityEntry, Event, IsoDate } from 'moira-backend';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

export interface UiFixture {
  events: readonly Event[];
  capacity: readonly CapacityEntry[];
  asOf: IsoDate;
  nodeLabels: Record<string, string>;
  actorLabels: Record<string, string>;
  /** R-T6 reference dates, latest-wins-resolved from .moira/dates.json (issue #13). */
  deadline?: IsoDate;
  targetDate?: IsoDate;
  /** viewpoint actor id (.moira/config.json `me`) — enables the「自分」inbox filter (issue #12). */
  me?: string;
  /** true only when served by `moira ui` — tells the app to open the SSE bridge. */
  live?: boolean;
}

export interface UiServerOptions {
  distDir: string;
  /** 0 = let the OS pick (tests); the resolved port is reflected in `url`. */
  port: number;
  /** Called per request — must build a FRESH fixture from disk every time. */
  fixture: () => UiFixture;
  /** The .moira directory to watch. Omit to disable the watcher (layer (a) only). */
  watchDir?: string;
}

export interface RunningUi {
  url: string;
  server: Server;
  /** Debounced change signal (what the fs watcher fires) — test seam. */
  notifyChange: () => void;
  close: () => Promise<void>;
}

/** Inject the fixture as an inline classic <script> before the deferred app module. Pure. */
export function injectFixture(indexHtml: string, fixture: UiFixture): string {
  // JSON with <,>,& escaped so it can never break out of the <script> element.
  const json = JSON.stringify(fixture)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  const inject = `<script>window.__MOIRA_FIXTURE__=${json};</script>`;
  if (indexHtml.includes('<head>')) {
    return indexHtml.replace('<head>', `<head>\n    ${inject}`);
  }
  // Fallback: prepend (still before the deferred module script).
  return `${inject}\n${indexHtml}`;
}

export function buildInjectedIndex(distDir: string, fixture: UiFixture): string {
  return injectFixture(readFileSync(join(distDir, 'index.html'), 'utf8'), fixture);
}

// --- SSE hub (fs-free, unit-testable) --------------------------------------

export interface SseHub {
  add: (res: ServerResponse) => void;
  broadcast: (event: string, data: string) => void;
  heartbeat: () => void;
  closeAll: () => void;
  size: () => number;
}

export function createSseHub(): SseHub {
  const clients = new Set<ServerResponse>();
  // res.write return values are ignored throughout: frames are tens-of-bytes
  // pings on localhost — dead clients are dropped via their 'close' event.
  return {
    add(res: ServerResponse): void {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      res.write('retry: 1000\n\n:connected\n\n');
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
    broadcast(event: string, data: string): void {
      for (const res of clients) res.write(`event: ${event}\ndata: ${data}\n\n`);
    },
    heartbeat(): void {
      for (const res of clients) res.write(':hb\n\n');
    },
    closeAll(): void {
      for (const res of clients) res.end();
      clients.clear();
    },
    size: (): number => clients.size,
  };
}

// --- trailing-edge debounce (timer-only, unit-testable with fake timers) ----

export function debounceTrailing(
  fn: () => void,
  ms: number,
): { fire: () => void; cancel: () => void } {
  let timer: NodeJS.Timeout | null = null;
  return {
    fire(): void {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
      timer.unref?.();
    },
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

// --- .moira directory watcher ----------------------------------------------

const WATCHED_FILES = new Set(['events.json', 'capacity.json', 'dates.json', 'labels.json', 'config.json']);

/**
 * Watch the .moira DIRECTORY (not individual files — an atomic replace/rename
 * kills a file watcher; a directory watcher survives and covers all four files).
 * Returns null when fs.watch is unavailable (e.g. network drives) — the caller
 * degrades to reload-only mode (layer (a)).
 */
export function watchMoiraDir(dir: string, onChange: () => void): { close: () => void } | null {
  try {
    const watcher = watch(dir, { persistent: false }, (_eventType, filename) => {
      // filename can be null/undefined on some platforms — treat as "changed".
      if (filename == null || WATCHED_FILES.has(filename.toString())) onChange();
    });
    return { close: (): void => watcher.close() };
  } catch (e) {
    process.stderr.write(
      `moira ui: fs.watch unavailable (${e instanceof Error ? e.message : String(e)}) — ` +
        'live push disabled; reload the browser to see new events.\n',
    );
    return null;
  }
}

// --- server -----------------------------------------------------------------

export function serveUi(options: UiServerOptions): Promise<RunningUi> {
  const { distDir, port, fixture, watchDir } = options;

  // Last-good guard: the CLI writes .moira files non-atomically, so a read can
  // race a write and fail to parse — keep serving the previous snapshot.
  let lastGood: UiFixture | null = null;
  const readFixture = (): UiFixture => {
    try {
      lastGood = fixture();
      return lastGood;
    } catch (e) {
      if (lastGood !== null) {
        process.stderr.write(
          `moira ui: fixture reload failed (${e instanceof Error ? e.message : String(e)}) — ` +
            'serving last good snapshot.\n',
        );
        return lastGood;
      }
      throw e;
    }
  };

  const hub = createSseHub();
  let seq = 0;
  const debounced = debounceTrailing(() => {
    seq += 1;
    hub.broadcast('change', JSON.stringify({ seq }));
  }, 150);

  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    if (urlPath === '/' || urlPath === '/index.html') {
      let html: string;
      try {
        html = buildInjectedIndex(distDir, readFixture());
      } catch {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('fixture unavailable');
        return;
      }
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(html);
      return;
    }
    if (urlPath === '/api/fixture') {
      try {
        const body = JSON.stringify(readFixture());
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(body);
      } catch {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('fixture unavailable');
      }
      return;
    }
    if (urlPath === '/api/stream') {
      hub.add(res);
      return;
    }
    const filePath = normalize(join(distDir, urlPath));
    if (!filePath.startsWith(distDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });

  const watcher = watchDir !== undefined ? watchMoiraDir(watchDir, debounced.fire) : null;
  const heartbeat = setInterval(() => hub.heartbeat(), 25_000);
  heartbeat.unref?.();

  return new Promise((resolve) => {
    server.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr !== null ? addr.port : port;
      resolve({
        url: `http://localhost:${actualPort}`,
        server,
        notifyChange: debounced.fire,
        close: () =>
          new Promise<void>((r) => {
            // Order matters: live SSE responses keep server.close() from
            // resolving, so end them BEFORE closing the server.
            watcher?.close();
            debounced.cancel();
            clearInterval(heartbeat);
            hub.closeAll();
            server.close(() => r());
          }),
      });
    });
  });
}
