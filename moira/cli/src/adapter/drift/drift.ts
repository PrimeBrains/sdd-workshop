// `moira adapter drift` — the only fs-touching layer of the drift engine.
// Read-only over both sides: .kiro via the provider, .moira via MoiraRepo+fold.
// It NEVER emits events (ADR-0001: the CLI write verbs stay the emit primitive;
// catch-up emission is choreographed by the moira-track skill's `sync` phase).

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fold } from 'moira-backend';
import { CliError } from '../../errors.js';
import { MoiraRepo } from '../../store.js';
import { ccSddProvider } from '../providers/cc-sdd.js';
import { adapterVersion } from '../version.js';
import { computeDrift, filterReport } from './core.js';
import { renderJson, renderText } from './report.js';
import type { DriftReport } from './types.js';

const out = (s: string): void => void process.stdout.write(`${s}\n`);

/** Adapter-owned per-repo config (.moira/adapter.json) — escape valve for
 * node-ID-convention deviations. Kept separate from CLI-owned config.json. */
interface AdapterRepoConfig {
  ignoreFeatures?: string[];
  ignoreNodes?: string[];
}

function loadAdapterConfig(cwd: string): AdapterRepoConfig {
  const path = join(cwd, '.moira', 'adapter.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as AdapterRepoConfig;
  } catch (e) {
    throw new CliError(`.moira/adapter.json を解析できない: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function computeDriftReport(cwd: string, feature?: string): DriftReport {
  const repo = new MoiraRepo(cwd);
  if (!repo.exists()) {
    throw new CliError('no .moira/ here — run `moira init` first (drift は .moira と .kiro を突き合わせる)');
  }
  const provider = ccSddProvider;
  if (!provider.detect(cwd)) {
    throw new CliError('no .kiro/specs/ here — cc-sdd artifacts が見つからない（突き合わせる相手が無い）');
  }
  const cfg = repo.loadConfig();
  const adapterCfg = loadAdapterConfig(cwd);
  const expected = provider.loadExpected(cwd, cfg.projectRoot);
  const projected = fold(repo.loadEvents());
  const options: Parameters<typeof computeDrift>[2] = {
    projectRoot: cfg.projectRoot,
    provider: provider.id,
  };
  if (adapterCfg.ignoreFeatures !== undefined) options.ignoreFeatures = adapterCfg.ignoreFeatures;
  if (adapterCfg.ignoreNodes !== undefined) options.ignoreNodes = adapterCfg.ignoreNodes;
  let body = computeDrift(expected, projected, options);
  if (feature !== undefined) {
    if (!body.features.some((f) => f.feature === feature)) {
      throw new CliError(
        `feature "${feature}" が .kiro/specs に見つからない（候補: ${body.features.map((f) => f.feature).join(', ') || 'なし'}）`,
      );
    }
    body = filterReport(body, feature);
  }
  return { ...body, adapterVersion: adapterVersion(), generatedAt: new Date().toISOString() };
}

export function cmdDrift(rest: string[]): void {
  const { values } = parseArgs({
    args: rest,
    options: {
      json: { type: 'boolean' },
      check: { type: 'boolean' },
      feature: { type: 'string' },
      dir: { type: 'string' },
    },
    allowPositionals: false,
  });
  const cwd = resolve(typeof values.dir === 'string' ? values.dir : process.cwd());
  const report = computeDriftReport(cwd, typeof values.feature === 'string' ? values.feature : undefined);
  out(values.json === true ? renderJson(report) : renderText(report));
  // --check fails on needs-human too: an un-agreed/un-assigned lag is still a
  // firing miss (the estimate phase never fired) — same trigger set as the
  // SessionStart injection. Advisory-only never fails.
  if (values.check === true && report.summary.hard + report.summary.needsHuman > 0) {
    process.exitCode = 1;
  }
}
