// Provider registry — resolves a declarative provider config to a runnable
// MethodologyProvider (issue #14 Stage 2 / ADR-0003). Three drift modes:
//   builtin     → delegate to a CODE provider (cc-sdd: its normalization
//                 semantics are too rich for the v1 DSL — golden stays intact)
//   presence    → the generic declarative minimum (existence-only expectations)
//   unsupported → drift is a LOUD error ("drift は捏造しない": a provider that
//                 cannot map artifacts to node states says so instead of guessing)

import { CliError } from '../../errors.js';
import type { ProviderConfig } from '../provider-config.js';
import { ccSddProvider } from './cc-sdd.js';
import { presenceProvider } from './presence.js';
import type { MethodologyProvider } from './provider.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BUILTINS: Record<string, MethodologyProvider> = {
  'cc-sdd': ccSddProvider,
};

export function resolveProvider(cfg: ProviderConfig): MethodologyProvider {
  switch (cfg.drift.mode) {
    case 'builtin': {
      const p = BUILTINS[cfg.drift.builtin];
      if (p === undefined) throw new CliError(`未登録の builtin provider: ${cfg.drift.builtin}`);
      return p;
    }
    case 'presence':
      return presenceProvider(cfg);
    case 'unsupported':
      return {
        id: cfg.id,
        detect(cwd: string): boolean {
          return cfg.detect.some((p) => existsSync(join(cwd, ...p.split('/'))));
        },
        loadExpected(): never {
          throw new CliError(
            `provider "${cfg.id}" は drift 非対応（drift.mode: unsupported）。` +
              '成果物→ノード状態の対応を宣言できないため、突き合わせは捏造せず提供しない。',
          );
        },
      };
  }
}
