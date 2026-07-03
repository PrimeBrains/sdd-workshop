// `moira adapter install|status|uninstall` — copy the bundled templates into a
// target repo, merge hooks into .claude/settings.json non-destructively, and
// stamp a manifest so installs are idempotent, upgrades detectable, and
// uninstall surgical.
//
// Install decision matrix per managed file:
//   absent                          → write
//   present, content == template    → up-to-date (adopt silently)
//   present, hash == manifest hash  → managed & unmodified → overwrite (upgrade)
//   present, hash != manifest hash  → user-modified → skip + warn (--force: backup+overwrite)
//   present, NO manifest entry      → hand-copied (e.g. the playground) → backup+overwrite
// settings.json parse failure aborts the WHOLE install before any write.

import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { CliError } from '../errors.js';
import {
  contentHash,
  loadManifest,
  MANIFEST_REL,
  manifestPath,
  saveManifest,
  type AdapterManifest,
} from './manifest.js';
import { templatesDir } from './paths.js';
import { PROVIDER_CONFIG_REL, validateProviderConfig } from './provider-config.js';
import { ccSddProvider } from './providers/cc-sdd.js';
import {
  mergeSettings,
  removeSettings,
  SettingsParseError,
  type HookInjection,
} from './settings-merge.js';
import { adapterVersion } from './version.js';

const out = (s: string): void => void process.stdout.write(`${s}\n`);
const err = (s: string): void => void process.stderr.write(`${s}\n`);

// --- the install payload ------------------------------------------------------

interface ManagedFile {
  src: string; // templates-relative (POSIX)
  dest: string; // target-repo-relative (POSIX)
}

export const MANAGED_FILES: readonly ManagedFile[] = [
  { src: 'claude/skills/moira-track/SKILL.md', dest: '.claude/skills/moira-track/SKILL.md' },
  { src: 'claude/skills/moira-track/reference.md', dest: '.claude/skills/moira-track/reference.md' },
  { src: 'claude/hooks/moira-guard.mjs', dest: '.claude/hooks/moira-guard.mjs' },
  { src: 'claude/hooks/moira-fire.mjs', dest: '.claude/hooks/moira-fire.mjs' },
  // Declarative provider config (ADR-0003 Stage 2). Content is the bundled
  // cc-sdd default, or the file given via `install --provider <path>`.
  { src: 'claude/moira-provider.json', dest: PROVIDER_CONFIG_REL },
  { src: 'kiro/steering/moira-track.md', dest: '.kiro/steering/moira-track.md' },
];

const GUARD_CMD = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/moira-guard.mjs"';
const FIRE_CMD = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/moira-fire.mjs"';

export const HOOK_INJECTIONS: readonly HookInjection[] = [
  { event: 'PreToolUse', matcher: 'Bash', command: GUARD_CMD },
  { event: 'PostToolUse', matcher: 'Bash', command: GUARD_CMD },
  { event: 'PostToolUse', matcher: 'Edit|MultiEdit|Write|NotebookEdit', command: FIRE_CMD },
  { event: 'SessionStart', matcher: 'startup|resume|clear', command: FIRE_CMD },
];

const CLAUDE_MD_BEGIN = '<!-- moira-adapter:begin -->';
const CLAUDE_MD_END = '<!-- moira-adapter:end -->';
const CLAUDE_MD_BLOCK = `${CLAUDE_MD_BEGIN}
## Moira アダプタ

この repo には cc-sdd → Moira アダプタがインストールされている（\`moira adapter status\` で確認）。
発火規約は \`.kiro/steering/moira-track.md\`、emit の振り付けは \`.claude/skills/moira-track/\`。
cc-sdd の節目では \`/moira-track <phase>\`、取りこぼしの突き合わせは \`/moira-track sync\`。
${CLAUDE_MD_END}`;

const BACKUP_SUFFIX = '.moira-adapter.bak';

// --- helpers -------------------------------------------------------------------

const toPath = (cwd: string, rel: string): string => join(cwd, ...rel.split('/'));
const normalize = (s: string): string => s.replace(/\r\n/g, '\n');

function resolveDir(values: Record<string, unknown>): string {
  return resolve(typeof values.dir === 'string' ? values.dir : process.cwd());
}

function backup(path: string, force: boolean): string | null {
  const bak = `${path}${BACKUP_SUFFIX}`;
  if (existsSync(bak) && !force) return null;
  writeFileSync(bak, readFileSync(path));
  return bak;
}

// --- install --------------------------------------------------------------------

type FileAction = 'write' | 'up-to-date' | 'update' | 'adopt-backup' | 'overwrite-backup' | 'skip';

export function cmdInstall(rest: string[]): void {
  const { values } = parseArgs({
    args: rest,
    options: {
      dir: { type: 'string' },
      force: { type: 'boolean' },
      'claude-md': { type: 'boolean' },
      provider: { type: 'string' },
    },
    allowPositionals: false,
  });
  const cwd = resolveDir(values);
  const force = values.force === true;
  if (!existsSync(cwd)) throw new CliError(`target dir not found: ${cwd}`);

  // Custom declarative provider (ADR-0003 Stage 2): validated BEFORE any write.
  let providerOverride: string | null = null;
  if (typeof values.provider === 'string') {
    const p = resolve(values.provider);
    if (!existsSync(p)) throw new CliError(`provider config not found: ${p}`);
    providerOverride = readFileSync(p, 'utf8');
  }

  if (providerOverride === null && !ccSddProvider.detect(cwd)) {
    err('warning: .kiro/specs/ が見つからない — cc-sdd プロジェクトでは無さそう（インストールは続行）。');
  }
  if (!existsSync(join(cwd, '.moira'))) {
    err('warning: .moira/ が未初期化 — `moira init` するか、/moira-track discovery が初期化する。');
  }

  const previous = loadManifest(cwd);

  // 1) settings merge FIRST, in memory — parse failure aborts before any write.
  const settingsPath = toPath(cwd, '.claude/settings.json');
  const existingSettings = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : null;
  let merge;
  try {
    merge = mergeSettings(existingSettings, [...HOOK_INJECTIONS]);
  } catch (e) {
    if (e instanceof SettingsParseError) {
      throw new CliError(
        `.claude/settings.json が JSON として読めないため中断（何も書き込んでいない）: ${e.message}\n` +
          '手で直してから再実行する（JSONC コメント等は不可）。',
      );
    }
    throw e;
  }

  // 2) plan per-file actions.
  const plans: Array<{ file: ManagedFile; action: FileAction; template: string }> = [];
  for (const file of MANAGED_FILES) {
    const templatePath = toPath(templatesDir(), file.src);
    if (!existsSync(templatePath)) throw new CliError(`bundled template missing: ${file.src}（moira-cli の再ビルド/再 link が必要）`);
    let template = readFileSync(templatePath, 'utf8');
    if (file.dest === PROVIDER_CONFIG_REL) {
      if (providerOverride !== null) template = providerOverride;
      // Validate whatever will be installed (custom OR bundled) before writing.
      let parsed: unknown;
      try {
        parsed = JSON.parse(template);
      } catch (e) {
        throw new CliError(`provider config が JSON として読めない: ${e instanceof Error ? e.message : String(e)}`);
      }
      const { errors } = validateProviderConfig(parsed);
      if (errors.length > 0) {
        throw new CliError(`provider config がスキーマ不正（何も書き込んでいない）:\n  - ${errors.join('\n  - ')}`);
      }
    }
    const destPath = toPath(cwd, file.dest);
    let action: FileAction;
    if (!existsSync(destPath)) {
      action = 'write';
    } else {
      const disk = readFileSync(destPath, 'utf8');
      const managedHash = previous?.files[file.dest];
      if (normalize(disk) === normalize(template)) action = 'up-to-date';
      else if (managedHash !== undefined && managedHash === contentHash(disk)) action = 'update';
      else if (managedHash !== undefined) action = force ? 'overwrite-backup' : 'skip';
      else action = 'adopt-backup'; // hand-copied (no manifest entry) → migrate
    }
    plans.push({ file, action, template });
  }

  // 3) execute file writes.
  const files: Record<string, string> = {};
  for (const { file, action, template } of plans) {
    const destPath = toPath(cwd, file.dest);
    if (action === 'skip') {
      err(`skip (ユーザー改変を保持): ${file.dest} — 上書きするには --force`);
      files[file.dest] = previous?.files[file.dest] ?? contentHash(template);
      continue;
    }
    if (action === 'adopt-backup' || action === 'overwrite-backup') {
      const bak = backup(destPath, force);
      if (bak !== null) err(`backup: ${file.dest}${BACKUP_SUFFIX}`);
    }
    if (action !== 'up-to-date') {
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, template, 'utf8');
    }
    files[file.dest] = contentHash(template);
    out(`${actionLabel(action)}: ${file.dest}`);
  }

  // 4) settings write.
  if (merge.changed) {
    if (existingSettings !== null) {
      const bak = backup(settingsPath, force);
      if (bak !== null) err(`backup: .claude/settings.json${BACKUP_SUFFIX}`);
    } else {
      mkdirSync(dirname(settingsPath), { recursive: true });
    }
    writeFileSync(settingsPath, merge.text, 'utf8');
    out(`settings: hooks ${merge.added.length} 件追加（既存 ${merge.adopted.length} 件は採用）`);
  } else {
    out(`settings: 変更なし（${merge.adopted.length} 件は既存エントリを採用）`);
  }

  // 5) optional CLAUDE.md block.
  if (values['claude-md'] === true) {
    const claudeMdPath = join(cwd, 'CLAUDE.md');
    const text = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, 'utf8') : '';
    if (text.includes(CLAUDE_MD_BEGIN) && text.includes(CLAUDE_MD_END)) {
      const re = new RegExp(`${CLAUDE_MD_BEGIN}[\\s\\S]*?${CLAUDE_MD_END}`);
      writeFileSync(claudeMdPath, text.replace(re, CLAUDE_MD_BLOCK), 'utf8');
    } else {
      const sep = text === '' || text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
      writeFileSync(claudeMdPath, `${text}${sep}${CLAUDE_MD_BLOCK}\n`, 'utf8');
    }
    out('CLAUDE.md: moira-adapter ブロックを設置（マーカー区切り・冪等）');
  }

  // 6) manifest.
  const claudeMdPathNow = join(cwd, 'CLAUDE.md');
  const claudeMdBlock =
    existsSync(claudeMdPathNow) && readFileSync(claudeMdPathNow, 'utf8').includes(CLAUDE_MD_BEGIN);
  const manifest: AdapterManifest = {
    adapterVersion: adapterVersion(),
    installedAt: new Date().toISOString(),
    files,
    settingsInjected: [...HOOK_INJECTIONS],
    claudeMdBlock,
  };
  saveManifest(cwd, manifest);
  out(`installed: cc-sdd → Moira adapter v${manifest.adapterVersion}（manifest: ${MANIFEST_REL}）`);
}

function actionLabel(a: FileAction): string {
  switch (a) {
    case 'write':
      return '+ write';
    case 'up-to-date':
      return '= up-to-date';
    case 'update':
      return '↑ update';
    case 'adopt-backup':
      return '↷ adopt (backup)';
    case 'overwrite-backup':
      return '! overwrite (backup)';
    case 'skip':
      return 'skip';
  }
}

// --- status ---------------------------------------------------------------------

type FileStatus = 'intact' | 'modified' | 'missing';

export function cmdStatus(rest: string[]): void {
  const { values } = parseArgs({
    args: rest,
    options: { dir: { type: 'string' }, json: { type: 'boolean' } },
    allowPositionals: false,
  });
  const cwd = resolveDir(values);
  const manifest = loadManifest(cwd);
  const bundled = adapterVersion();

  if (manifest === null) {
    if (values.json === true) {
      out(JSON.stringify({ installed: false, bundledVersion: bundled }, null, 2));
    } else {
      out(`not installed（manifest 無し）。導入は: moira adapter install — bundled v${bundled}`);
    }
    return;
  }

  const fileStatuses: Record<string, FileStatus> = {};
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const path = toPath(cwd, rel);
    fileStatuses[rel] = !existsSync(path)
      ? 'missing'
      : contentHash(readFileSync(path, 'utf8')) === hash
        ? 'intact'
        : 'modified';
  }

  const settingsPath = toPath(cwd, '.claude/settings.json');
  let settingsPresent: Record<string, boolean> | 'unreadable' = 'unreadable';
  if (existsSync(settingsPath)) {
    try {
      const text = readFileSync(settingsPath, 'utf8');
      const probe: Record<string, boolean> = {};
      for (const inj of manifest.settingsInjected) {
        // re-merge probe: an injection that would be "adopted" is present.
        probe[`${inj.event}:${inj.command}`] = mergeSettings(text, [inj]).adopted.length === 1;
      }
      settingsPresent = probe;
    } catch {
      settingsPresent = 'unreadable';
    }
  }

  // Declarative provider id (Stage 2): read the installed config when present.
  let providerId: string | null = null;
  const providerPath = toPath(cwd, PROVIDER_CONFIG_REL);
  if (existsSync(providerPath)) {
    try {
      const parsed = JSON.parse(readFileSync(providerPath, 'utf8')) as { id?: unknown };
      if (typeof parsed.id === 'string') providerId = parsed.id;
    } catch {
      providerId = null;
    }
  }

  const result = {
    installed: true,
    installedVersion: manifest.adapterVersion,
    bundledVersion: bundled,
    upToDate: manifest.adapterVersion === bundled,
    installedAt: manifest.installedAt,
    provider: providerId,
    files: fileStatuses,
    settings: settingsPresent,
    claudeMdBlock: manifest.claudeMdBlock,
    environment: {
      kiroDetected: ccSddProvider.detect(cwd),
      moiraInitialized: existsSync(join(cwd, '.moira')),
    },
  };
  if (values.json === true) {
    out(JSON.stringify(result, null, 2));
    return;
  }
  out(`adapter v${manifest.adapterVersion}（bundled v${bundled}${result.upToDate ? '・up-to-date' : ' → 再 install で更新可'}） installed at ${manifest.installedAt}`);
  out(`  provider: ${providerId ?? '(config なし → cc-sdd 既定)'}`);
  for (const [rel, st] of Object.entries(fileStatuses)) {
    out(`  ${st === 'intact' ? '✓' : st === 'modified' ? '✎' : '✗'} ${st.padEnd(8)} ${rel}`);
  }
  if (settingsPresent === 'unreadable') {
    out('  ⚠ settings.json が読めない/存在しない');
  } else {
    const missing = Object.entries(settingsPresent).filter(([, ok]) => !ok);
    out(
      missing.length === 0
        ? `  ✓ settings hooks ${manifest.settingsInjected.length} 件反映済み`
        : `  ✗ settings hooks 欠落: ${missing.map(([k]) => k).join(' / ')}`,
    );
  }
  out(
    `  env: .kiro ${result.environment.kiroDetected ? '✓' : '✗'} / .moira ${result.environment.moiraInitialized ? '✓' : '✗'}`,
  );
}

// --- uninstall ------------------------------------------------------------------

export function cmdUninstall(rest: string[]): void {
  const { values } = parseArgs({
    args: rest,
    options: { dir: { type: 'string' } },
    allowPositionals: false,
  });
  const cwd = resolveDir(values);
  const manifest = loadManifest(cwd);
  if (manifest === null) throw new CliError('not installed（manifest 無し）— 何も除去しない');

  for (const [rel, hash] of Object.entries(manifest.files)) {
    const path = toPath(cwd, rel);
    if (!existsSync(path)) continue;
    if (contentHash(readFileSync(path, 'utf8')) === hash) {
      unlinkSync(path);
      out(`- removed: ${rel}`);
      try {
        rmdirSync(dirname(path)); // only succeeds when empty — best-effort cleanup
      } catch {
        /* dir not empty — keep */
      }
    } else {
      err(`keep (ユーザー改変あり): ${rel}`);
    }
  }

  const settingsPath = toPath(cwd, '.claude/settings.json');
  if (existsSync(settingsPath)) {
    try {
      const r = removeSettings(readFileSync(settingsPath, 'utf8'), manifest.settingsInjected);
      if (r.changed) {
        writeFileSync(settingsPath, r.text, 'utf8');
        out(`settings: 注入 hooks ${r.removed.length} 件を除去（ユーザーエントリは無傷）`);
      }
    } catch {
      err('warning: settings.json が読めないため hooks エントリは手動除去が必要');
    }
  }

  if (manifest.claudeMdBlock) {
    const claudeMdPath = join(cwd, 'CLAUDE.md');
    if (existsSync(claudeMdPath)) {
      const text = readFileSync(claudeMdPath, 'utf8');
      const re = new RegExp(`\\n?${CLAUDE_MD_BEGIN}[\\s\\S]*?${CLAUDE_MD_END}\\n?`);
      if (re.test(text)) {
        writeFileSync(claudeMdPath, text.replace(re, '\n'), 'utf8');
        out('CLAUDE.md: moira-adapter ブロックを除去');
      }
    }
  }

  unlinkSync(manifestPath(cwd));
  out('uninstalled（バックアップ *.moira-adapter.bak は残置 — 不要なら手で削除）');
}
