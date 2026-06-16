#!/usr/bin/env node
// @ts-check
/**
 * sdd-dashboard ランチャー (task 6.2)
 *
 * `node skill/launcher.mjs start|stop|status --project <絶対パス>` の薄い起動レイヤー。
 * 依存ゼロ(node 標準モジュールのみ)。ビルド不要でそのまま動く(スキル配布物)。
 *
 * 責務(要件 2.1, 2.2, 2.3, 2.5 / design「配布/起動レイヤー > launcher」「起動・停止フロー」):
 *   - start: サーバ(server/dist/index.js)を空きポート(--port 0)で detached spawn(+unref)。
 *            stdout の `listening http://127.0.0.1:<port>` からポートを取得し、
 *            インスタンスファイル(instances/<hash>.json: {pid, port, projectPath, startedAt})を
 *            書き、既定ブラウザを開き、1 行 JSON {status:"started", url, port, ...} を出力する。
 *            既に起動中(ファイルあり+pid 生存+ポート応答)なら二重起動せず {status:"running"}。
 *            stale pid(ファイルあり+プロセス不在)は掃除して新規起動。
 *   - stop:  pid 検証(生存+可能ならコマンド名確認)のうえ kill、ファイル削除、{status:"stopped"}。
 *            未起動なら {status:"stopped", message:"not running"}。
 *   - status: {status:"running"|"stopped", url?, port?}。
 *
 * キャッシュ管理 (task 6.3 / design「配布/起動レイヤー > launcher」キャッシュ管理 / 要件 1.2):
 *   - モード切り替え: launcher.mjs の隣にアプリ実体(../server/dist/index.js)がある
 *     「リポジトリ内モード」(開発・ドッグフーディング)では従来どおりローカル解決。
 *     隣にアプリが無い「配布スキル単体」ではキャッシュ領域(~/.sdd-dashboard/app)を解決する。
 *   - setup: キャッシュが無ければリモートを `git clone --depth 1` し、`npm ci` + `npm run build`。
 *            ビルド成功マーカー(app/.build-ok に コミット SHA)を書く。マーカーが無い/壊れていれば
 *            再セットアップ。リモート最新 SHA(git ls-remote)とマーカー SHA を比較し、差分があれば
 *            updateAvailable: true + message を出力(自動更新はしない)。{status:"ready", sha, ...}。
 *   - update: 明示更新。fetch + reset(origin/HEAD)→ npm ci → npm run build → マーカー更新。
 *            {status:"updated", sha, message}(message に sync-skills 実行ヒントを添える)。
 *            fetch が失敗し origin が SSH 形式なら導出 HTTPS で再試行し、成功時は origin を
 *            HTTPS へ恒久修正する(明示 SDD_DASHBOARD_REPO_URL 時は救済しない)。
 *   - start(キャッシュモード): まず setup を済ませてから通常の起動に進む。
 *
 * スキル同期 (Issue #45 / sync-skills):
 *   - sync-skills: アプリのスキル正本(`<appRoot>/skill/`。キャッシュモード=~/.sdd-dashboard/app/skill、
 *            リポジトリ内モード=リポの skill/)から、対象プロジェクトの `.claude/skills/` へ
 *            最新スキルをコピーする。sdd-dashboard/(SKILL.md+launcher.mjs)と
 *            spec-model/(SKILL.md+spec-model-cache.mjs)が対象。書込先は `.claude/skills/` 配下のみで、
 *            `.kiro/` には一切触れない。{status:"skills-synced", synced:[...]} を出力。
 *            update/setup の updateAvailable 時は message に本コマンドの実行を促すヒントを添える
 *            (自動同期はしない=明示コマンド)。
 *
 * 隔離用 env:
 *   - SDD_DASHBOARD_HOME : インスタンス dir のルート(既定 ~/.sdd-dashboard)。テスト用に上書き可。
 *   - SDD_DASHBOARD_NO_OPEN=1 : ブラウザ open を抑止(テスト・CI 用)。
 *   - SDD_DASHBOARD_REPO_URL : アプリ実体の取得元(既定 git@github.com:PrimeBrains/sdd-dashboard.git。
 *     既定 URL では SSH 失敗時に HTTPS へ自動フォールバック。明示指定時はその URL のみ使用)。
 *   - SDD_DASHBOARD_APP_DIR : キャッシュ先(既定 ~/.sdd-dashboard/app)。テスト用に上書き可。
 */

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { request as httpRequest } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOSTNAME = '127.0.0.1';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * リポジトリ内モードのアプリ実体ルート(launcher.mjs の隣 = `..`)。
 */
function repoModeRoot() {
  return resolve(here, '..');
}

/**
 * リポジトリ内モードか判定する(task 6.3)。
 *
 * launcher.mjs の隣にビルド成果物(../server/dist/index.js)があれば「リポジトリ内」
 * (開発・ドッグフーディング)。無ければ「配布スキル単体」でキャッシュ解決に進む。
 *
 * @returns {boolean}
 */
function isRepoMode() {
  return existsSync(resolve(repoModeRoot(), 'server', 'dist', 'index.js'));
}

/**
 * キャッシュ先(SDD_DASHBOARD_APP_DIR、既定 <home>/app)を返す。
 */
function appDir() {
  return process.env.SDD_DASHBOARD_APP_DIR || join(homeDir(), 'app');
}

/** アプリ取得元の既定リポジトリ URL(SSH)。HTTPS 候補はここから機械的に導出する。 */
const DEFAULT_REPO_URL = 'git@github.com:PrimeBrains/sdd-dashboard.git';

/**
 * アプリ実体(サーバ entry / 静的 root)の場所を解決する。
 *
 * - リポジトリ内モード: launcher.mjs の位置基準に `../server/dist/index.js` と `../web/dist`。
 * - 配布スキル単体: キャッシュ領域(SDD_DASHBOARD_APP_DIR, 既定 ~/.sdd-dashboard/app)を基準。
 *
 * 6.1 申し送り: サーバ構築後の chdir 禁止。spawn の cwd はアプリルートに固定し、
 * --static-root を絶対パスで明示渡しする。
 *
 * @returns {{ serverEntry: string, staticRoot: string, cwd: string }}
 */
export function resolveAppPaths() {
  const root = isRepoMode() ? repoModeRoot() : appDir();
  return {
    serverEntry: resolve(root, 'server', 'dist', 'index.js'),
    staticRoot: resolve(root, 'web', 'dist'),
    cwd: root,
  };
}

/**
 * アプリ実体のルート(スキル正本 `skill/` を含む)を解決する。
 * - リポジトリ内モード: launcher.mjs の隣(`..`)。
 * - 配布スキル単体: キャッシュ領域(SDD_DASHBOARD_APP_DIR, 既定 ~/.sdd-dashboard/app)。
 *
 * `resolveAppPaths` と同じモード判定を流用する。スキル正本は `<root>/skill/` にある。
 */
function appRoot() {
  return isRepoMode() ? repoModeRoot() : appDir();
}

/** ~/.sdd-dashboard(SDD_DASHBOARD_HOME で上書き可)。 */
function homeDir() {
  return process.env.SDD_DASHBOARD_HOME || join(homedir(), '.sdd-dashboard');
}

/** instances ディレクトリ。 */
function instancesDir() {
  return join(homeDir(), 'instances');
}

/** ログディレクトリ(spawn の stdio 出力先)。 */
function logsDir() {
  return join(homeDir(), 'logs');
}

/** プロジェクト絶対パスの sha256 短縮(16 桁)をキーにしたインスタンスファイルパス。 */
export function instanceFileFor(projectPath) {
  const abs = resolve(projectPath);
  const hash = createHash('sha256').update(abs).digest('hex').slice(0, 16);
  return join(instancesDir(), `${hash}.json`);
}

/** インスタンスファイルを読む(無効・不在なら null)。 */
function readInstance(file) {
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof data.pid === 'number' && typeof data.port === 'number') return data;
    return null;
  } catch {
    return null;
  }
}

/** pid が生存しているか(signal 0)。 */
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM は別ユーザー所有で生存はしている。存在しなければ ESRCH。
    return /** @type {NodeJS.ErrnoException} */ (err).code === 'EPERM';
  }
}

/**
 * pid のコマンド名が node 由来か(誤 kill 防止の保険)。
 * 取得に失敗したら true(過剰に kill を抑止しない: 既に pidAlive で同一性は概ね担保)。
 */
function pidLooksLikeNode(pid) {
  try {
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
      timeout: 3_000,
    });
    return /node/i.test(out);
  } catch {
    return true;
  }
}

/** url に HTTP GET して応答(任意ステータス)が返るか。 */
function portResponds(port, timeoutMs = 1_000) {
  return new Promise((resolveP) => {
    const req = httpRequest(
      { hostname: HOSTNAME, port, path: '/api/project', method: 'GET', timeout: timeoutMs },
      (res) => {
        res.resume();
        resolveP(true);
      },
    );
    req.on('error', () => resolveP(false));
    req.on('timeout', () => {
      req.destroy();
      resolveP(false);
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** url 文字列を組み立てる。 */
function urlFor(port) {
  return `http://${HOSTNAME}:${port}`;
}

/** 既定ブラウザを開く(macOS `open`)。SDD_DASHBOARD_NO_OPEN=1 なら抑止。失敗しても続行。 */
function openBrowser(url) {
  if (process.env.SDD_DASHBOARD_NO_OPEN === '1') return;
  try {
    const child = spawn('open', [url], { detached: true, stdio: 'ignore' });
    child.on('error', () => {
      /* open が無い環境でも URL 提示で続行 */
    });
    child.unref();
  } catch {
    /* 失敗しても続行 */
  }
}

/** 1 行 JSON を stdout に出力する。 */
function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/** エラーを 1 行 JSON で出力し exit 1。 */
function fail(message) {
  emit({ status: 'error', message });
  process.exit(1);
}

/**
 * サーバを detached spawn し、stdout の `listening http://127.0.0.1:<port>` から
 * 実ポートを取得する。タイムアウトまでにポートが見つからなければ reject。
 *
 * @returns {Promise<{ pid: number, port: number }>}
 */
function spawnServer(serverEntry, staticRoot, projectPath, cwd) {
  return new Promise((resolveP, rejectP) => {
    mkdirSync(logsDir(), { recursive: true });
    const hash = createHash('sha256').update(resolve(projectPath)).digest('hex').slice(0, 16);
    const logPath = join(logsDir(), `${hash}.log`);
    const logFd = openSync(logPath, 'a');

    // listening 行を読むため、stdout はパイプで受けつつログにも書く。
    const child = spawn(
      process.execPath,
      [
        serverEntry,
        '--project',
        resolve(projectPath),
        '--port',
        '0',
        '--static-root',
        staticRoot,
      ],
      {
        cwd,
        detached: true,
        stdio: ['ignore', 'pipe', logFd],
        env: process.env,
      },
    );

    let settled = false;
    let buffer = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGTERM');
      } catch {
        /* noop */
      }
      rejectP(new Error('サーバの起動待ちがタイムアウトしました(listening 行を取得できず)'));
    }, 20_000);

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectP(err);
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      buffer += text;
      try {
        writeFileSync(logPath, text, { flag: 'a' });
      } catch {
        /* ログ書き込み失敗は致命ではない */
      }
      const match = buffer.match(/listening http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        const port = Number.parseInt(match[1], 10);
        // 親と切り離して常駐させる。stdout パイプが親の event loop を参照し続けないよう
        // 破棄してから unref する。
        child.stdout.removeAllListeners('data');
        child.stdout.destroy();
        child.unref();
        resolveP({ pid: /** @type {number} */ (child.pid), port });
      }
    });
  });
}

/** インスタンスファイルを削除する(存在しなくてもよい)。 */
function removeInstance(file) {
  try {
    rmSync(file, { force: true });
  } catch {
    /* noop */
  }
}

/**
 * 既存インスタンスが「実際に稼働中」か判定する。
 * - ファイルあり + pid 生存 + ポート応答 → running
 * - ファイルあり + pid 不在(stale) → 掃除して null
 */
async function liveInstance(file) {
  const inst = readInstance(file);
  if (!inst) return null;
  if (!pidAlive(inst.pid)) {
    removeInstance(file);
    return null;
  }
  const ok = await portResponds(inst.port);
  if (!ok) {
    // pid は生きているがポート応答が無い(起動失敗の残骸など)。掃除して新規起動に委ねる。
    return null;
  }
  return inst;
}

// ───────────────────────────── キャッシュ管理 (task 6.3) ─────────────────────────────

/** ビルド成功マーカー(キャッシュ完全性の証跡。中身はビルド時のコミット SHA)。 */
function markerPath() {
  return join(appDir(), '.build-ok');
}

/** 進行ログを stderr に出す(stdout の 1 行 JSON 契約を汚さない)。 */
function progress(message) {
  process.stderr.write(`${message}\n`);
}

/**
 * git をキャプチャ実行する(同期)。失敗は例外。
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string} trim 済み stdout
 */
function runGit(cwd, args) {
  const out = execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.trim();
}

/**
 * npm スクリプトをキャッシュディレクトリで実行する(同期)。失敗は例外。
 * 出力はそのまま継承(stderr へ。stdout は契約上汚せないので無視)。
 * @param {string[]} args
 */
function runNpm(args) {
  execFileSync('npm', args, {
    cwd: appDir(),
    timeout: 600_000,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

// ─────────────── 取得元 URL の候補決定と順次試行 (launcher-https-fallback) ───────────────

/**
 * scp 形式の SSH URL(git@host:owner/repo.git)を HTTPS URL へ機械的に導出する(要件 1.4)。
 * scp 形式のみ対象。導出不能(既に https / file / ssh:// など)は null = フォールバック候補なし。
 * @param {string} url
 * @returns {string | null} 例: 'git@github.com:O/R.git' -> 'https://github.com/O/R.git'
 */
function deriveHttpsUrl(url) {
  const m = /^git@([^:/]+):(.+)$/.exec(url);
  if (!m) return null;
  return `https://${m[1]}/${m[2]}`;
}

/**
 * 取得元 URL の候補列(長さ 1..2)を返す。
 * - SDD_DASHBOARD_REPO_URL 明示時: その 1 候補のみ(自動フォールバックなし・要件 3.1)。
 * - 既定時: SSH 既定 URL → 導出 HTTPS URL の 2 候補(要件 1.1, 1.4)。
 * @returns {string[]}
 */
function candidateUrls() {
  const explicit = process.env.SDD_DASHBOARD_REPO_URL;
  if (explicit) return [explicit];
  const https = deriveHttpsUrl(DEFAULT_REPO_URL);
  return https ? [DEFAULT_REPO_URL, https] : [DEFAULT_REPO_URL];
}

/**
 * 失敗した git 実行(execFileSync の例外)から stderr の要約(先頭の非空行)を取り出す。
 * @param {unknown} err
 * @returns {string}
 */
function gitErrorSummary(err) {
  const e = /** @type {{ stderr?: unknown, message?: string }} */ (err);
  const stderr = typeof e.stderr === 'string' ? e.stderr : '';
  const line = stderr
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line || (e.message ?? '');
}

/**
 * 全候補 URL が失敗したときの Error を組み立てる(要件 4.1, 4.2)。
 * 試行した URL の列挙と回避手段 2 つ(credential helper の準備 /
 * SDD_DASHBOARD_REPO_URL 上書き)、最後の git stderr 要約を含める。
 * @param {string} opLabel 操作の表示名(例: 'アプリ実体の取得')
 * @param {string[]} urls 試行した URL(試行順)
 * @param {unknown} lastErr 最後に失敗した git 実行の例外
 * @returns {Error}
 */
function allUrlsFailedError(opLabel, urls, lastErr) {
  const detail = gitErrorSummary(lastErr);
  return new Error(
    `${opLabel}に失敗しました(試行: ${urls.join(', ')})。` +
      'SSH 鍵または credential helper(例: gh auth login)を準備するか、' +
      'SDD_DASHBOARD_REPO_URL で取得元を上書きしてください。' +
      (detail ? `最後のエラー: ${detail}` : ''),
  );
}

/**
 * 候補 URL を順に試す(候補順 = 試行順)。失敗したら次候補の前にフォールバックの進捗を
 * stderr へ 1 行出して再試行する(要件 1.1, 1.3)。全候補が失敗したら、試行した URL と
 * 回避手段 2 つ(credential helper の準備 / SDD_DASHBOARD_REPO_URL 上書き)を含む Error を
 * 投げる(要件 4.1, 4.2。トップレベルで {status:"error"} 1 行 JSON に収束する・要件 4.3)。
 * @template T
 * @param {string} opLabel 操作の表示名(例: 'アプリ実体の取得')
 * @param {string[]} urls 候補 URL(長さ >= 1)
 * @param {(url: string) => T} fn URL を受け取って git 操作を行う関数(失敗 = 例外)
 * @returns {T} 最初に成功した候補の戻り値
 */
function tryWithUrls(opLabel, urls, fn) {
  let lastErr;
  for (let i = 0; i < urls.length; i += 1) {
    try {
      return fn(urls[i]);
    } catch (err) {
      lastErr = err;
      if (i + 1 < urls.length) {
        progress(`SSH での${opLabel}に失敗しました。HTTPS で再試行します: ${urls[i + 1]}`);
      }
    }
  }
  throw allUrlsFailedError(opLabel, urls, lastErr);
}

/** リモート default ブランチの最新コミット SHA を取得する(git ls-remote)。 */
function remoteHeadSha() {
  // HEAD は default ブランチを指す。出力先頭フィールドが SHA。
  // 取得元は候補列を順次試行する(SSH 失敗 → HTTPS・要件 2.1)。
  const out = tryWithUrls('更新確認', candidateUrls(), (url) =>
    runGit(process.cwd(), ['ls-remote', url, 'HEAD']),
  );
  const sha = out.split(/\s+/)[0];
  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    throw new Error(`リモートの SHA を取得できませんでした: ${out}`);
  }
  return sha;
}

/** キャッシュのマーカー SHA を読む(無効・不在なら null)。 */
function cachedSha() {
  const m = markerPath();
  if (!existsSync(m)) return null;
  try {
    const sha = readFileSync(m, 'utf8').trim();
    return /^[0-9a-f]{7,40}$/i.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

/** キャッシュが「健全」か(clone 済み + マーカーが有効な SHA)。 */
function cacheHealthy() {
  return existsSync(join(appDir(), 'package.json')) && cachedSha() !== null;
}

/**
 * クリーンに clone してビルドし、マーカーを書く(初回セットアップ / 破損時の再構築)。
 * 既存キャッシュは丸ごと破棄してから clone する。
 * @returns {string} ビルドした SHA
 */
function cloneAndBuild() {
  const dir = appDir();
  progress('初回セットアップ中... アプリを取得しています(git clone)');
  // 破損キャッシュを掃除してクリーン clone。
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* noop */
  }
  mkdirSync(dirname(dir), { recursive: true });
  // 取得元は候補列を順次試行する(SSH 失敗 → 導出 HTTPS・要件 1.1)。
  tryWithUrls('アプリ実体の取得', candidateUrls(), (url) => {
    // 失敗した clone の残骸が次候補の clone を妨げないよう、毎回クリーンにする。
    rmSync(dir, { recursive: true, force: true });
    runGit(process.cwd(), ['clone', '--depth', '1', url, dir]);
  });

  const sha = runGit(dir, ['rev-parse', 'HEAD']);
  progress('初回セットアップ中... 依存をインストールしています(npm ci)');
  runNpm(['ci']);
  progress('初回セットアップ中... ビルドしています(npm run build)');
  runNpm(['run', 'build']);

  // ビルド成功後にだけマーカーを書く(失敗時はマーカーを残さず次回再ビルド)。
  writeFileSync(markerPath(), `${sha}\n`, 'utf8');
  progress('セットアップが完了しました');
  return sha;
}

/**
 * 既存キャッシュで `fetch origin HEAD` を実行し、失敗時は origin が SSH 形式で HTTPS を
 * 導出できる場合に限り、導出 URL で fetch を再試行する(過去に SSH で取得したキャッシュの
 * 救済・要件 2.2)。再試行が成功したら origin を導出 HTTPS へ恒久修正する(以後の更新が
 * フォールバック不要になる)。`fetch <url> HEAD` でも FETCH_HEAD は設定されるため、
 * 後続の `reset --hard FETCH_HEAD` はそのまま機能する。
 *
 * SDD_DASHBOARD_REPO_URL 明示時は別 URL を発明せず、元の失敗をそのまま伝播して
 * 失敗として報告する(candidateUrls と同方針・要件 3.1, 3.2)。
 *
 * 両経路(origin SSH → 導出 HTTPS)とも失敗した場合は、tryWithUrls の全滅時と同じく
 * 試行 URL の列挙と回避手段 2 つを含む Error を投げる(要件 4.1, 4.2)。
 * @param {string} dir キャッシュディレクトリ
 */
function fetchOriginWithFallback(dir) {
  try {
    runGit(dir, ['fetch', '--depth', '1', 'origin', 'HEAD']);
    return;
  } catch (err) {
    // 明示指定時は自動フォールバックしない(要件 3.1)。
    if (process.env.SDD_DASHBOARD_REPO_URL) throw err;
    /** @type {string | null} */
    let origin = null;
    /** @type {string | null} */
    let https = null;
    try {
      origin = runGit(dir, ['remote', 'get-url', 'origin']);
      https = deriveHttpsUrl(origin);
    } catch {
      https = null; // origin URL すら取れない場合は元の失敗を報告する。
    }
    if (!https) throw err; // SSH 形式でない(導出不能)origin は救済対象外。
    progress(`SSH での更新の取得に失敗しました。HTTPS で再試行します: ${https}`);
    try {
      runGit(dir, ['fetch', '--depth', '1', https, 'HEAD']);
    } catch (retryErr) {
      // 両経路とも失敗: 試行 URL と回避手段 2 つを含めて報告する(要件 4.1, 4.2)。
      throw allUrlsFailedError('更新の取得', [/** @type {string} */ (origin), https], retryErr);
    }
    // 再試行成功後にだけ origin を恒久修正する(要件 2.2)。
    runGit(dir, ['remote', 'set-url', 'origin', https]);
  }
}

/**
 * 既存キャッシュを更新する(明示 update)。fetch + reset でリモート default に揃え、
 * npm ci + build + マーカー更新を行う。fetch は SSH origin 失敗時に導出 HTTPS で
 * 救済される(要件 2.2)。
 * @returns {string} 更新後の SHA
 */
function pullAndBuild() {
  const dir = appDir();
  if (!existsSync(join(dir, '.git'))) {
    // クローンされていなければ素直に新規セットアップ。
    return cloneAndBuild();
  }
  progress('更新を取得しています(git fetch)');
  fetchOriginWithFallback(dir);
  runGit(dir, ['reset', '--hard', 'FETCH_HEAD']);
  const sha = runGit(dir, ['rev-parse', 'HEAD']);

  progress('依存をインストールしています(npm ci)');
  runNpm(['ci']);
  progress('ビルドしています(npm run build)');
  runNpm(['run', 'build']);

  writeFileSync(markerPath(), `${sha}\n`, 'utf8');
  progress('更新が完了しました');
  return sha;
}

/**
 * キャッシュを必要に応じてセットアップし、更新提案情報を添えて結果を返す。
 * - キャッシュが健全でなければ clone + build(再セットアップ)。
 * - 健全なら何もしない。
 * - 健全/再構築いずれの場合も、リモート最新 SHA と比較して updateAvailable を判定する。
 *
 * @returns {{ sha: string, updateAvailable: boolean, message?: string }}
 */
function ensureCache() {
  let sha;
  if (cacheHealthy()) {
    sha = /** @type {string} */ (cachedSha());
  } else {
    sha = cloneAndBuild();
  }

  // リモート SHA と比較して更新提案(取得失敗は致命ではない: オフラインでも起動できる)。
  let updateAvailable = false;
  let message;
  try {
    const remote = remoteHeadSha();
    if (remote && remote !== sha) {
      updateAvailable = true;
      message =
        '新しいバージョンが利用可能です。`update` コマンドで更新できます(自動更新はしません)。' +
        '更新後は対象プロジェクトのスキルを最新化するため `sync-skills --project <path>` も実行してください。';
    }
  } catch {
    /* オフライン等。更新提案は省略して続行 */
  }

  return { sha, updateAvailable, message };
}

/**
 * `setup` コマンド: キャッシュを用意し、更新提案つきの結果を 1 行 JSON で出力する。
 */
function cmdSetup() {
  const { sha, updateAvailable, message } = ensureCache();
  const out = { status: 'ready', sha, updateAvailable };
  if (message) out.message = message;
  emit(out);
}

/**
 * `update` コマンド: 明示更新(pull + ci + build + マーカー更新)。
 * 起動中インスタンスがあるかは個別 stop に委ね、ここではキャッシュの更新に専念する。
 */
function cmdUpdate() {
  const sha = pullAndBuild();
  emit({
    status: 'updated',
    sha,
    message:
      '対象プロジェクトのスキルを最新化するには `sync-skills --project <path>` を実行してください(自動同期はしません)。',
  });
}

/**
 * 対象プロジェクトへ同梱するスキル正本のコピー計画。
 * 書込先は常に `<project>/.claude/skills/` 配下のみ(`.kiro/` には絶対に触れない)。
 * 正本は `<appRoot>/skill/`(リポジトリ内モード=リポの skill/、キャッシュモード=app/skill/)。
 */
const SYNC_SKILL_PLAN = [
  { from: ['skill', 'SKILL.md'], to: ['sdd-dashboard', 'SKILL.md'] },
  { from: ['skill', 'launcher.mjs'], to: ['sdd-dashboard', 'launcher.mjs'] },
  { from: ['skill', 'spec-model', 'SKILL.md'], to: ['spec-model', 'SKILL.md'] },
  {
    from: ['skill', 'spec-model', 'spec-model-cache.mjs'],
    to: ['spec-model', 'spec-model-cache.mjs'],
  },
];

/**
 * `sync-skills` コマンド: アプリのスキル正本(`<appRoot>/skill/` 配下)を、対象プロジェクトの
 * `.claude/skills/` へ最新コピーする。`launcher update` がアプリ実体しか更新せず、
 * 対象プロジェクトの SKILL.md コピーが古いまま producer(spec-model)が走らない問題への対処。
 *
 * - sdd-dashboard/: SKILL.md + launcher.mjs
 * - spec-model/: SKILL.md + spec-model-cache.mjs
 * - 書込先は `<project>/.claude/skills/` 配下のみ。`.kiro/` は読み取り専用で触れない。
 *
 * @param {string} projectPath 対象プロジェクトの絶対パス
 */
function cmdSyncSkills(projectPath) {
  const abs = resolve(projectPath);
  if (!existsSync(abs)) {
    fail(`--project が存在しません: ${abs}`);
    return;
  }

  const srcRoot = appRoot();
  const skillsDir = join(abs, '.claude', 'skills');

  /** @type {string[]} */
  const synced = [];
  for (const { from, to } of SYNC_SKILL_PLAN) {
    const src = join(srcRoot, ...from);
    if (!existsSync(src)) {
      fail(`スキル正本が見つかりません(アプリのセットアップを確認してください): ${src}`);
      return;
    }
    const dest = join(skillsDir, ...to);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    synced.push(join('.claude', 'skills', ...to));
  }

  emit({ status: 'skills-synced', synced });
}

async function cmdStart(projectPath) {
  const abs = resolve(projectPath);
  if (!existsSync(abs)) {
    fail(`--project が存在しません: ${abs}`);
    return;
  }

  const file = instanceFileFor(abs);

  // 冪等性: 既に稼働中ならそのまま返す。
  const existing = await liveInstance(file);
  if (existing) {
    emit({ status: 'running', url: urlFor(existing.port), port: existing.port, pid: existing.pid });
    return;
  }

  // 配布スキル単体(キャッシュモード)では、起動前にアプリ実体のキャッシュを用意する。
  // リポジトリ内モードでは何もしない(従来どおりローカル成果物を使う)。
  let updateInfo;
  if (!isRepoMode()) {
    updateInfo = ensureCache();
  }

  const { serverEntry, staticRoot, cwd } = resolveAppPaths();
  if (!existsSync(serverEntry)) {
    fail(`サーバ成果物が見つかりません(npm run build 済みか確認してください): ${serverEntry}`);
    return;
  }

  let started;
  try {
    started = await spawnServer(serverEntry, staticRoot, abs, cwd);
  } catch (err) {
    fail(`サーバの起動に失敗しました: ${/** @type {Error} */ (err).message}`);
    return;
  }

  // ポートが応答するまで軽くポーリング(serve のコールバック直後はまだ受理前のことがある)。
  for (let i = 0; i < 50; i += 1) {
    if (await portResponds(started.port)) break;
    await sleep(100);
  }

  const instance = {
    pid: started.pid,
    port: started.port,
    projectPath: abs,
    startedAt: new Date().toISOString(),
  };
  mkdirSync(instancesDir(), { recursive: true });
  writeFileSync(file, `${JSON.stringify(instance, null, 2)}\n`, 'utf8');

  const url = urlFor(started.port);
  openBrowser(url);

  /** @type {Record<string, unknown>} */
  const result = { status: 'started', url, port: started.port, pid: started.pid };
  if (updateInfo && updateInfo.updateAvailable) {
    result.updateAvailable = true;
    if (updateInfo.message) result.message = updateInfo.message;
  }
  emit(result);
}

async function cmdStop(projectPath) {
  const abs = resolve(projectPath);
  const file = instanceFileFor(abs);
  const inst = readInstance(file);

  if (!inst) {
    // ファイルが無い or 壊れている → 未起動扱い。残骸ファイルがあれば掃除。
    removeInstance(file);
    emit({ status: 'stopped', message: 'not running' });
    return;
  }

  if (pidAlive(inst.pid) && pidLooksLikeNode(inst.pid)) {
    try {
      process.kill(inst.pid, 'SIGTERM');
    } catch {
      /* 既に死んでいる等は無視 */
    }
    // 終了を少し待ち、残っていれば SIGKILL。
    for (let i = 0; i < 30; i += 1) {
      if (!pidAlive(inst.pid)) break;
      await sleep(100);
    }
    if (pidAlive(inst.pid)) {
      try {
        process.kill(inst.pid, 'SIGKILL');
      } catch {
        /* noop */
      }
    }
  }

  removeInstance(file);
  emit({ status: 'stopped' });
}

async function cmdStatus(projectPath) {
  const abs = resolve(projectPath);
  const file = instanceFileFor(abs);
  const inst = await liveInstance(file);
  if (inst) {
    emit({ status: 'running', url: urlFor(inst.port), port: inst.port });
  } else {
    emit({ status: 'stopped' });
  }
}

/** `--project <path>`(`--project=path` 形式も可)を取り出す。 */
function parseProject(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--project') return argv[i + 1];
    if (t.startsWith('--project=')) return t.slice('--project='.length);
  }
  return undefined;
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  const project = parseProject(argv);

  if (
    !command ||
    !['start', 'stop', 'status', 'setup', 'update', 'sync-skills'].includes(command)
  ) {
    fail(
      'usage: node launcher.mjs start|stop|status|setup|update|sync-skills [--project <絶対パス>]',
    );
    return;
  }

  // setup / update はキャッシュ操作で --project を必要としない。
  if (command === 'setup' || command === 'update') {
    try {
      if (command === 'setup') cmdSetup();
      else cmdUpdate();
    } catch (err) {
      fail(`キャッシュ操作に失敗しました: ${/** @type {Error} */ (err).message}`);
      return;
    }
    process.exit(0);
    return;
  }

  if (!project) {
    fail('--project <絶対パス> は必須です');
    return;
  }

  try {
    if (command === 'start') await cmdStart(project);
    else if (command === 'stop') await cmdStop(project);
    else if (command === 'sync-skills') cmdSyncSkills(project);
    else await cmdStatus(project);
  } catch (err) {
    fail(/** @type {Error} */ (err).message);
    return;
  }
  // detached child の stdout パイプなどが event loop を参照し続けて親が終了しない
  // ことがあるため、コマンド完了後は明示的に終了する。
  process.exit(0);
}

// 直接実行された場合のみ動かす(import 時は副作用なし)。
// symlink 経由(例: /var/folders → /private/var/folders)でも一致するよう realpath で比較する。
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  const self = fileURLToPath(import.meta.url);
  const norm = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return resolve(p);
    }
  };
  return norm(entry) === norm(self);
}

if (isMainModule()) {
  main();
}
