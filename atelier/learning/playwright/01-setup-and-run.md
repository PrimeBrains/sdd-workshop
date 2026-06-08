# Chapter 1: セットアップを読み解き、テストを走らせる

**所要 60-90 分**

## 狙い

- Playwright が「Web アプリをブラウザで実際に動かして検証するツール」だと体に染み込ませる
- このリポの `playwright.config.ts` を 1 行ずつ説明できるようになる
- `--ui` / `--headed` / `--debug` / Trace Viewer の使い分けを身につける（PR レビュー時の調査力に直結）

## 1. 5 行で Playwright の立ち位置

| ツール | 動かすブラウザ | 言語 | 特徴 |
|--------|----------------|------|------|
| Playwright | Chromium / WebKit / Firefox（本物） | TS/JS/Py/.NET/Java | auto-wait・Trace Viewer・並列実行が標準 |
| Cypress | Chromium 系（iframe 内で動作） | TS/JS | DX に振ったが、複数オリジン・タブ・並列に弱い |
| Selenium | 全部 | 多言語 | 歴史長い、auto-wait なし、生 wait と戦う |

ざっくり「**Cypress の書き味の良さ + Selenium の幅広さ + 自前の auto-wait と Trace Viewer**」が Playwright。最近の Web e2e のデファクト。

## 2. このリポの `playwright.config.ts` を読む

ファイル：`evm-studio/e2e/playwright.config.ts`（48 行）

**読みどころ**：

```ts
// evm-studio/e2e/playwright.config.ts:15-24
const clientIsRunning = isPortListening(5173)

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  use: {
    ...(clientIsRunning ? { baseURL: 'http://localhost:5173' } : {}),
  },
```

ここのトリックは「**クライアントが listen していなければ `baseURL` を外す**」設計。
こうしておくと、UI を持たない CI でも API テスト（`smoke.spec.ts` の health チェック等）は走らせられる。UI テスト側は `skipIfClientNotRunning` ヘルパーで自分から skip する（→ Chapter 4 で詳述）。

```ts
// evm-studio/e2e/playwright.config.ts:31-47
webServer: [
  { command: 'npm --prefix ../server run dev', port: 3001, reuseExistingServer: true },
  ...(clientIsRunning
    ? [{ command: 'npm --prefix ../client run dev', port: 5173, reuseExistingServer: true }]
    : []),
],
```

`webServer` は「テスト実行前にこのコマンドを起動して、指定ポートが繋がるまで待つ」設定。`reuseExistingServer: true` のおかげで、開発中に `npm start` で立ち上げっぱなしでも衝突しない。

### 1 行ずつ自問してみる（口頭で答えられれば OK）

- `testDir: '.'` と `testMatch: '**/*.spec.ts'` の組み合わせで何が起きる？
- `projects: [{ name: 'chromium', ... }]` を増やすと何ができる？（ヒント：複数ブラウザ）
- `webServer` の `reuseExistingServer` を `false` にしたら何が困る？

## 3. 4 つの実行モードを試す

```bash
cd evm-studio
```

### (a) 普通に走らせる（headless / 高速）

```bash
npm run test:e2e
```

`playwright test --config e2e/playwright.config.ts` のショートカット。CI と同じ実行モード。

### (b) UI モード（ブラウザ GUI で対話的に）

```bash
npx playwright test --config e2e/playwright.config.ts --ui
```

これが**学習中もレビュー中も一番便利**。左ペインでテストを選び、Time Travel スライダーで各ステップの DOM スナップショットを見られる。

### (c) Headed（実ブラウザを目視）

```bash
npx playwright test --config e2e/playwright.config.ts --headed
```

実際にブラウザウィンドウが開いてテストが走る様子が見える。「クリックは届いたのに反応しない」系のデバッグに有効。

### (d) デバッグ（Playwright Inspector を開いてステップ実行）

```bash
npx playwright test --config e2e/playwright.config.ts --debug
```

ブレークポイントを置きたいときや、特定の 1 テストをステップ実行したいときに。
特定の 1 件だけ走らせるには：

```bash
npx playwright test --config e2e/playwright.config.ts -g "シナリオ 5"
```

`-g` は test 名の正規表現マッチ。

## 4. Trace Viewer の使い方（最重要）

PR レビュー中に「このテストはなぜ失敗したのか」を **自分で調べられる**ようになるのが目的。

### Trace を取る

```ts
// playwright.config.ts に追加するなら（このリポは未設定だが、CI ではよくこうする）
use: {
  trace: 'on-first-retry',  // または 'retain-on-failure'
}
```

このリポでは標準では trace は記録されないので、手元で 1 度だけ意図的に取ってみる：

```bash
npx playwright test --config e2e/playwright.config.ts --trace on -g "シナリオ 1"
```

実行後、`test-results/` 配下に `trace.zip` ができる。

### Trace を開く

```bash
npx playwright show-trace test-results/<テスト名>/trace.zip
```

ブラウザベースの Trace Viewer が開く。注目するパネル：

| パネル | 何が見えるか |
|--------|--------------|
| **Action タイムライン**（上部） | 各 step（クリック、locator 解決、assert）の所要時間 |
| **Before / After スナップショット** | step 直前 / 直後の DOM。実 DOM を inspect できる |
| **Source タブ** | そのテストのソースコード行が、step に対応してハイライト |
| **Network タブ** | 期間中の HTTP/WebSocket リクエスト一覧 |
| **Console タブ** | ブラウザ console.log / error |

> 演習でも、レビューでも、まず Trace Viewer を開く癖をつけると桁違いに調査が速くなる。

## 5. ハンズオン：`smoke.spec.ts` を 1 行ずつ説明できるか

ファイル：`evm-studio/e2e/smoke.spec.ts`（16 行）

```ts
// evm-studio/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'

test('サーバーヘルスチェック', async ({ request }) => {
  const response = await request.get('http://localhost:3001/health')
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.status).toBe('ok')
})

test('トップページが表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('EVM Studio').first()).toBeVisible()
})
```

### 自問チェック

1. 1 つ目のテストの引数 `{ request }` と 2 つ目の `{ page }` は何が違う？それぞれ何ができる？
2. `expect(response.ok()).toBeTruthy()` と `expect(response.status()).toBe(200)` の違いは？どちらが好み？
3. `page.goto('/')` の `/` が `http://localhost:5173/` に展開される理由は config のどこ？
4. `.first()` を付けている理由は？外したら何が起きる？（コメントにヒントあり）

答えられないものがあれば該当箇所のドキュメントを開く：[Playwright API: test](https://playwright.dev/docs/api/class-test) / [Locator: first](https://playwright.dev/docs/api/class-locator#locator-first)

## 6. 演習：意図的に壊して挙動を観察する

`smoke.spec.ts:15` の `.first()` を外して走らせる：

```ts
await expect(page.getByText('EVM Studio')).toBeVisible()
```

実行：

```bash
npx playwright test --config e2e/playwright.config.ts -g "トップページ"
```

**観察ポイント**：
- エラーメッセージに `strict mode violation` が出るはず
- 「複数の要素にマッチした」ことを Playwright がどう報告するか
- Trace Viewer でその step を開いたとき、マッチした要素がどう可視化されるか

確認できたら `git restore` で戻す。

## 振り返り（自己診断 3 問）

<details>
<summary>Q1: <code>webServer</code> を設定しているのに <code>npm start</code> を手動で起動しておくと、何が便利？</summary>

`reuseExistingServer: true` なので衝突はしないが、**起動失敗時のログが分離して見える** / **テスト実行が早く始まる**（webServer の port 待ちをスキップ）。レビュー時は「webServer の挙動を疑うなら手で先に立てて切り分ける」のが定石。
</details>

<details>
<summary>Q2: <code>npx playwright test --ui</code> と <code>--debug</code> の使い分け基準は？</summary>

- `--ui`：複数テストを横断的に試したい / Trace Viewer 相当の振り返りをしながら触りたい
- `--debug`：特定 1 テストをブレークポイント＋ステップ実行したい（Playwright Inspector が起動）

普段は `--ui` 一択でよい。Inspector はピンポイントのデバッグ専用。
</details>

<details>
<summary>Q3: PR レビュー中に「このテストが落ちる理由がわからない」と感じたら、まず何をする？</summary>

1. ローカルで対象テストだけ `--trace on -g "テスト名"` で実行
2. `npx playwright show-trace` で Trace Viewer を開く
3. 失敗 step の Before/After スナップショットを見比べる → 「期待した要素が存在しない」のか「存在するが見えない」のかを切り分ける

これができれば、レビューコメントが推測ではなく事実ベースになる。
</details>

## 参考リンク

- [Playwright Docs: Running and debugging tests](https://playwright.dev/docs/running-tests)
- [Playwright Docs: Trace Viewer](https://playwright.dev/docs/trace-viewer)

---

次へ → [Chapter 2: ロケーターの哲学](./02-locators.md)
