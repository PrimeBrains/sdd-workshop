/**
 * check-dist-no-external-urls — ビルド成果物（client/dist）に外部 URL「参照」が含まれないことを
 * 検査するスクリプト（tasks.md 10.2 / design.md「Security Considerations」ローカル完結:
 * "index.html / フォント / アイコンを含め外部 CDN 参照ゼロ"・Requirements 8.2）。
 *
 * 完了条件「ビルド成果物（dist）に外部 URL 参照が含まれないことを検査するスクリプトを
 * npm run build 後に実行する」を満たす。`client` を `npm run build` した後に
 *   `cd sdd-dashboard/e2e && npm run check:dist`
 * で実行する（npm run verify:local が build→scan を一括実行する）。
 *
 * 検査は 2 段構えで「実際に取得される参照」と「文字列定数」を分けて扱う:
 *
 *  1) 取得参照（ハードフェイル / 許容なし）:
 *     - index.html の `src=` / `href=` 属性が外部オリジンを指す。
 *     - CSS の `url(...)` / `@import` / `src:` が外部オリジンを指す（フォント・アイコン・画像）。
 *     これらはブラウザが実際にフェッチするため、1 件でも外部オリジンなら 8.2 違反。
 *
 *  2) 文字列定数（許可リスト方式）:
 *     - JS / CSS / HTML 中の任意の http(s):// 文字列。ミニファイされた依存（mermaid・
 *       react-markdown・chevrotain・langium 等）はエラードキュメント/変更履歴/名前空間 URI を
 *       文字列定数として埋め込むが、これらはネットワーク取得ではない（task 1.1 で既出）。
 *       明示した許可ホスト以外の外部オリジン文字列が現れたら違反として扱う。
 *
 * いずれかに違反があれば非ゼロ終了し、違反内容を列挙する（CI / verify:local で fail させる）。
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DASHBOARD_ROOT } from "./paths.js";

/** 検査対象: 実 client（skeleton ではない）のビルド出力。 */
const DIST_DIR = `${DASHBOARD_ROOT}client/dist`;

/**
 * 文字列定数として許可する外部ホスト（取得されない既知の埋め込み URL）。
 * - w3.org: SVG / XML 名前空間 URI（属性値の識別子。取得されない）。
 * - react.dev / reactrouter.com: React / React Router のエラードキュメントリンク文字列。
 * - github.com / chevrotain.io / langium.org / en.wikipedia.org:
 *   ミニファイ済み依存（mermaid・chevrotain・langium・react-markdown 系）が埋め込む
 *   issue / changelog / 解説ページへのリンク文字列。いずれもランタイムでフェッチしない。
 * ここに無い外部オリジンの文字列が現れたら違反として報告する。
 */
const ALLOWED_STRING_CONSTANT_HOSTS: readonly string[] = [
  "www.w3.org",
  "w3.org",
  "react.dev",
  "reactrouter.com",
  "github.com",
  "chevrotain.io",
  "langium.org",
  "en.wikipedia.org",
  // @xyflow/react: 非フェッチの attribution / error-doc / コメント URL 文字列（ランタイム取得なし）。
  // proOptions.hideAttribution=true で attribution アンカーは DOM に出さず、これらは error doc/
  // ドキュメントリンク文字列に過ぎない。`${e}flow.dev` はミニファイで `pro.`/`react` を動的合成する
  // テンプレートリテラルのホスト断片（スキャナがそのまま host として解釈する）。
  "reactflow.dev",
  "pro.reactflow.dev",
  "${e}flow.dev",
];

/** ローカルオリジンと見なすホスト（取得参照・文字列定数いずれでも外部扱いしない）。 */
const LOCAL_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];

/**
 * http(s):// で始まる URL を全文から抽出するパターン（区切り文字で打ち切る）。
 * 状態を持つ `/g` 正規表現を共有すると `lastIndex` が呼び出し間で持ち越され、
 * `matchAll` が先頭マッチを取りこぼす（各ファイルの先頭 URL が走査されない）。
 * これを避けるため、ソースだけを定数化し、使用箇所ごとに新しい `/g` 正規表現を生成する。
 */
const URL_PATTERN = "https?:\\/\\/[^\\s\"'`)\\\\<>]+";

/** 使用箇所ごとに状態を共有しない新しい `/g` 正規表現を生成する。 */
function freshUrlRegex(): RegExp {
  return new RegExp(URL_PATTERN, "g");
}

/** index.html の src= / href= 属性値（クォート有/無）を抽出する。 */
const HTML_ATTR_RE = /\b(?:src|href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** CSS の url(...) / @import / src: のターゲット URL を抽出する。 */
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1/gi;

interface Violation {
  readonly category: "fetched-reference" | "string-constant";
  readonly file: string;
  readonly url: string;
  readonly host: string;
}

/** URL のホスト名を取り出す（相対パス・不正 URL は null）。 */
function hostOf(raw: string): string | null {
  try {
    return new URL(raw).host.toLowerCase().replace(/:\d+$/, "");
  } catch {
    return null;
  }
}

function isExternalHost(host: string): boolean {
  return !LOCAL_HOSTS.includes(host);
}

/** dist 配下の全ファイル絶対パスを再帰的に列挙する。 */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** index.html の取得参照（src/href）から外部オリジンを抽出する。 */
function scanHtmlFetchedRefs(file: string, content: string): Violation[] {
  const violations: Violation[] = [];
  for (const match of content.matchAll(HTML_ATTR_RE)) {
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    const host = hostOf(value);
    if (host !== null && isExternalHost(host)) {
      violations.push({ category: "fetched-reference", file, url: value, host });
    }
  }
  return violations;
}

/** CSS の url() / @import の取得参照から外部オリジンを抽出する。 */
function scanCssFetchedRefs(file: string, content: string): Violation[] {
  const violations: Violation[] = [];
  for (const re of [CSS_URL_RE, CSS_IMPORT_RE]) {
    for (const match of content.matchAll(re)) {
      const value = re === CSS_URL_RE ? match[2] : match[2];
      const host = hostOf(value);
      if (host !== null && isExternalHost(host)) {
        violations.push({ category: "fetched-reference", file, url: value, host });
      }
    }
  }
  return violations;
}

/** 全文中の http(s) 文字列のうち、許可ホスト以外の外部オリジンを抽出する。 */
function scanStringConstants(file: string, content: string): Violation[] {
  const violations: Violation[] = [];
  for (const match of content.matchAll(freshUrlRegex())) {
    const host = hostOf(match[0]);
    if (host === null) continue;
    if (!isExternalHost(host)) continue;
    if (ALLOWED_STRING_CONSTANT_HOSTS.includes(host)) continue;
    violations.push({ category: "string-constant", file, url: match[0], host });
  }
  return violations;
}

async function main(): Promise<void> {
  let files: string[];
  try {
    files = await listFiles(DIST_DIR);
  } catch {
    console.error(
      `[check:dist] dist ディレクトリが見つかりません: ${DIST_DIR}\n` +
        `先に client をビルドしてください（cd ../client && npm run build）。`,
    );
    process.exit(2);
    return;
  }

  if (files.length === 0) {
    console.error(`[check:dist] dist が空です: ${DIST_DIR}`);
    process.exit(2);
    return;
  }

  const violations: Violation[] = [];
  let sawUrlLike = false;

  for (const file of files) {
    if (!/\.(html|css|js|mjs|map|json|svg)$/i.test(file)) continue;
    const content = await readFile(file, "utf8");
    const rel = file.slice(DIST_DIR.length + 1);

    if (freshUrlRegex().test(content)) sawUrlLike = true;

    if (/\.html$/i.test(file)) {
      violations.push(...scanHtmlFetchedRefs(rel, content));
    }
    if (/\.css$/i.test(file)) {
      violations.push(...scanCssFetchedRefs(rel, content));
    }
    violations.push(...scanStringConstants(rel, content));
  }

  // 偽 pass 防止: スキャン対象に URL らしき文字列が一つも無ければ走査が空振りしている疑い。
  // 実際の dist には依存由来の http 文字列定数が必ず含まれるため、皆無なら異常として落とす。
  if (!sawUrlLike) {
    console.error(
      "[check:dist] dist 内に http(s) 文字列が 1 件も見つかりませんでした。" +
        "スキャン経路が機能していない可能性があります（偽 pass 防止）。",
    );
    process.exit(2);
    return;
  }

  if (violations.length > 0) {
    console.error(`[check:dist] 外部 URL 参照を ${violations.length} 件検出しました（8.2 違反）:`);
    for (const v of violations) {
      console.error(`  - [${v.category}] ${v.file}: ${v.url} (host=${v.host})`);
    }
    process.exit(1);
    return;
  }

  console.log(
    "[check:dist] OK — 外部オリジンの取得参照は 0 件、未許可の外部 URL 文字列も 0 件です（8.2）。\n" +
      `  許可した文字列定数ホスト: ${ALLOWED_STRING_CONSTANT_HOSTS.join(", ")}`,
  );
}

/**
 * 自己テスト（回帰ガード）: 各ファイルの「先頭の」http(s) 文字列がスキャンから
 * 取りこぼされないことを検証する。`/g` 正規表現の `lastIndex` 共有バグでは、
 * 先頭の URL が `matchAll` で読み飛ばされ、未許可の外部 URL が見逃される。
 *
 * 合成コンテンツの先頭に未許可の悪性 URL を置き、main 本体と同じ順序
 * （先に sawUrlLike 用の `.test()`、続いて scanStringConstants）で走査して、
 * その先頭 URL が確実に違反として検出されることを確認する。検出できなければ
 * 非ゼロ終了する（バグがあれば fail する RED ガード）。
 */
function selfTest(): void {
  const evilUrl = "https://evil.example.com/x";
  // 悪性 URL を「先頭の」http(s) リテラルに置き、その後に許可ホストの URL を続ける。
  const content = `${evilUrl} then https://github.com/ok/changelog`;

  // main 本体と同じ前処理: sawUrlLike 判定で URL 正規表現を一度走らせる。
  // 状態共有バグがあると、ここで lastIndex が進み、続く走査が先頭を飛ばす。
  const sawUrlLike = freshUrlRegex().test(content);

  const violations = scanStringConstants("self-test-synthetic.js", content);
  const detectedUrls = violations.map((v) => v.url);

  const failures: string[] = [];
  if (!sawUrlLike) {
    failures.push("sawUrlLike が false: URL 検出の前処理が機能していません。");
  }
  if (!detectedUrls.includes(evilUrl)) {
    failures.push(
      `先頭の未許可 URL ${evilUrl} が検出されませんでした（lastIndex 共有による取りこぼし）。` +
        ` 実際の検出: [${detectedUrls.join(", ")}]`,
    );
  }
  // 許可ホスト（github.com）は違反に含まれないこと。
  if (detectedUrls.some((u) => u.includes("github.com"))) {
    failures.push("許可ホスト github.com が誤って違反として報告されました。");
  }

  if (failures.length > 0) {
    console.error("[check:dist --self-test] FAIL — 回帰ガードが失敗しました:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
    return;
  }

  console.log(
    "[check:dist --self-test] OK — 先頭の未許可 URL が確実に検出されました " +
      `（detected: ${evilUrl}）。lastIndex 共有による取りこぼしは発生していません。`,
  );
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  void main();
}
