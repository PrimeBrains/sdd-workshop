// `moira adapter drift` — the only fs-touching layer of the drift engine.
// Read-only over both sides: .kiro via the provider, .moira via MoiraRepo+fold.
// It NEVER emits events (ADR-0001: the CLI write verbs stay the emit primitive;
// catch-up emission is choreographed by the moira-track skill's `sync` phase).

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fold } from 'moira-backend';
import { CliError } from '../../errors.js';
import { getGlobalDir, resolveMoiraHome } from '../../home.js';
import { MoiraRepo } from '../../store.js';
import { PROVIDER_CONFIG_REL, validateProviderConfig } from '../provider-config.js';
import { ccSddProvider } from '../providers/cc-sdd.js';
import type { MethodologyProvider } from '../providers/provider.js';
import { resolveProvider } from '../providers/registry.js';
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

function loadAdapterConfig(homeRoot: string): AdapterRepoConfig {
  const path = join(homeRoot, '.moira', 'adapter.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as AdapterRepoConfig;
  } catch (e) {
    throw new CliError(`.moira/adapter.json を解析できない: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The work repo's declarative provider (Stage 2, ADR-0003): read
 *  .claude/moira-provider.json when present, else the cc-sdd code provider
 *  (backward compat — pre-Stage-2 installs have no config file). */
function loadWorkRepoProvider(workDir: string): MethodologyProvider {
  const path = join(workDir, ...PROVIDER_CONFIG_REL.split('/'));
  if (!existsSync(path)) return ccSddProvider;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new CliError(
      `${PROVIDER_CONFIG_REL} を解析できない: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const { config, errors } = validateProviderConfig(raw);
  if (config === null) {
    throw new CliError(`${PROVIDER_CONFIG_REL} がスキーマ不正:\n  - ${errors.join('\n  - ')}`);
  }
  return resolveProvider(config);
}

/**
 * Two directories since ADR-0003 (multi-repo): `workDir` is the .kiro side (the
 * work repo, from adapter --dir), `homeRoot` is the .moira side (the log home,
 * resolved via --dir global / MOIRA_DIR / pointer / walk-up from the work repo).
 * Single-repo keeps workDir === homeRoot — byte-identical behavior.
 */
export function computeDriftReport(workDir: string, homeRoot: string, feature?: string): DriftReport {
  const repo = new MoiraRepo(homeRoot);
  if (!repo.exists()) {
    throw new CliError(
      'no .moira/ found — run `moira init` first (drift は .moira ログと .kiro を突き合わせる。' +
        'ログ home は --dir/MOIRA_DIR/.moira ポインタ/上位探索で解決)',
    );
  }
  const provider = loadWorkRepoProvider(workDir);
  if (!provider.detect(workDir)) {
    throw new CliError(
      `provider "${provider.id}" の成果物が見つからない（突き合わせる相手が無い — cc-sdd なら .kiro/specs/）`,
    );
  }
  const cfg = repo.loadConfig();
  const adapterCfg = loadAdapterConfig(homeRoot);
  const expected = provider.loadExpected(workDir, cfg.projectRoot);
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
  const workDir = resolve(typeof values.dir === 'string' ? values.dir : process.cwd());
  const flagDir = getGlobalDir();
  const home = resolveMoiraHome({
    ...(flagDir !== undefined ? { flagDir } : {}),
    env: process.env,
    startDir: workDir,
  });
  const report = computeDriftReport(workDir, home.root, typeof values.feature === 'string' ? values.feature : undefined);
  out(values.json === true ? renderJson(report) : renderText(report));
  // --check fails on needs-human too: an un-agreed/un-assigned lag is still a
  // firing miss (the estimate phase never fired) — same trigger set as the
  // SessionStart injection. Advisory-only never fails.
  if (values.check === true && report.summary.hard + report.summary.needsHuman > 0) {
    process.exitCode = 1;
  }
}
