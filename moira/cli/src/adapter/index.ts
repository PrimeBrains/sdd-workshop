// `moira adapter <sub>` dispatch — the cc-sdd → Moira adapter's CLI surface.
// install/status/uninstall manage the distributed artifacts (skill / hooks /
// steering / settings merge); drift is the read-only .kiro ↔ .moira reconciler.
// See .kiro/adr/0002-cc-sdd-moira-adapter.md for the architecture decision.

import { CliError } from '../errors.js';
import { cmdDrift } from './drift/drift.js';
import { cmdInstall, cmdStatus, cmdUninstall } from './install.js';
import { cmdValidateProvider } from './validate.js';

const out = (s: string): void => void process.stdout.write(`${s}\n`);

const ADAPTER_USAGE = `moira adapter — cc-sdd → Moira アダプタの設置と突き合わせ.

  moira adapter install   [--dir <path>] [--force] [--claude-md] [--provider <config.json>] [--home <log-home>]
      skill (moira-track) / hooks (moira-guard, moira-fire) / provider 設定
      (.claude/moira-provider.json — 省略時は cc-sdd 既定) / steering 発火表を
      対象リポジトリへ設置し、.claude/settings.json へ hooks を非破壊マージする。冪等。
      --home は multi-repo 用に .moira ポインタファイル（home: <path>）を書く（既存 .moira は保持）。
  moira adapter validate-provider <config.json>
      宣言的 provider 設定をスキーマ v1 で機械検証する（エラーは全件一括表示）。
  moira adapter status    [--dir <path>] [--json]
      インストール状態（バージョン・ファイル改変・settings 反映・環境）を報告する。
  moira adapter drift     [--dir <path>] [--json] [--feature <name>] [--check]
      .kiro (spec.json / tasks.md) と .moira ログを突き合わせ、欠落・先行を
      read-only で報告する（emit しない。追いつきは /moira-track sync が振り付け）。
      --check は hard drift ありで exit 1（CI/hook 用）。
  moira adapter uninstall [--dir <path>]
      manifest 記載の未改変ファイルと注入 hooks エントリだけを除去する。`;

export function runAdapter(argv: string[]): void {
  const [sub, ...rest] = argv;
  switch (sub) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      out(ADAPTER_USAGE);
      return;
    case 'install':
      return cmdInstall(rest);
    case 'status':
      return cmdStatus(rest);
    case 'drift':
      return cmdDrift(rest);
    case 'validate-provider':
      return cmdValidateProvider(rest);
    case 'uninstall':
      return cmdUninstall(rest);
    default:
      throw new CliError(`unknown adapter subcommand: ${sub}\n\n${ADAPTER_USAGE}`);
  }
}
