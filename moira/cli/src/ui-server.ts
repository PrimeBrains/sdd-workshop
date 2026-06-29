// Minimal static server for `moira ui`. Serves the prebuilt frontend dist/ and
// injects the user's event log as window.__MOIRA_FIXTURE__ into index.html BEFORE
// the app module loads (an inline classic <script> runs before the deferred module
// script — see frontend/src/main.tsx). Zero extra deps (node:http + node:fs).

import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
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
}

export interface RunningUi {
  url: string;
  server: Server;
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

export function serveUi(distDir: string, fixture: UiFixture, port: number): Promise<RunningUi> {
  const injectedIndex = buildInjectedIndex(distDir, fixture);
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    if (urlPath === '/' || urlPath === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(injectedIndex);
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
  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        url: `http://localhost:${port}`,
        server,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}
