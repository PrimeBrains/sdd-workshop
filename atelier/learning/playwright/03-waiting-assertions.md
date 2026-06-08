# Chapter 3: 待機とアサーション（flakiness 退治）

**所要 60-90 分**

## 狙い

- Playwright の **auto-wait** が何を待ち、何を待たないかを把握する
- Web-first assertion がなぜ retry されるかを理解し、値ベース assert との使い分けができる
- `waitForTimeout`（固定 sleep）がなぜ NG か、代替パターンを使いこなす
- `expect.poll` の使いどころを知る（このリポの実例 3 箇所）

## 1. Auto-wait の挙動

Playwright のロケーター系アクション（`click`, `fill`, `check` 等）は **デフォルトで以下を待つ**：

| 待つもの | デフォルトタイムアウト |
|----------|------------------------|
| 要素が DOM にアタッチされる | 30 秒 |
| 要素が **visible** になる | 同上 |
| 要素が **stable**（アニメーション停止） | 同上 |
| 要素が **enabled** | 同上 |
| 要素が **editable**（fill のみ） | 同上 |

つまり「ボタンが描画されてクリック可能になるまで」は **明示的な wait なしで Playwright が勝手に待つ**。これが Playwright の最大の魅力。

**待たないもの**：
- ネットワークリクエストの完了（必要なら `waitForResponse` を使う）
- 任意の JS 状態（React の state など）
- 自分が決めた「ビジネスロジック上の完了条件」（→ `expect.poll` で書く）

## 2. Web-first assertion vs 値ベース assertion

### Web-first（retry される）

```ts
// workbench.spec.ts:130
await expect(
  page.locator('div').filter({ hasText: PROJECT_NXP_NAME }).first(),
).toBeVisible({ timeout: 15_000 })
```

`expect(locator).toXxx()` の形は **retry される**。条件を満たすか timeout まで何度も再評価する。EVM 計算完了を 15 秒待っているこのケースは、画面が描画されるまで自動でリトライしている。

代表的な web-first matcher：

| matcher | 意味 |
|---------|------|
| `toBeVisible()` / `toBeHidden()` | 表示状態 |
| `toBeEnabled()` / `toBeDisabled()` | 有効状態 |
| `toBeChecked()` | チェック状態 |
| `toHaveText('...')` | innerText が一致（部分一致は `toContainText`） |
| `toHaveValue('...')` | input の value |
| `toHaveCount(n)` | マッチ件数 |
| `toHaveAttribute('href', /...$/)` | 属性値 |
| `toHaveURL(/.*\/dashboard$/)` | ページ URL |

### 値ベース（retry されない）

```ts
// workbench.spec.ts:188
expect(spiNormal).not.toMatch(/[▲▼]|±0/)

// workbench.spec.ts:441-445
expect(await readSummaryStat(page, 'BAC')).toBe(expectedBacStrip)
expect(await readSummaryStat(page, 'EV')).toBe(expectedEvStrip)
```

`expect(value).toXxx()` は **その瞬間の値**を検証する。リトライしない。

#### 罠：値を「取り出してから」検証すると retry されない

```ts
// 悪い例（リポにはない、説明用）
const text = await page.getByTestId('foo').textContent()
expect(text).toBe('OK')   // ← この瞬間に値が確定。retry されない
```

```ts
// 良い例
await expect(page.getByTestId('foo')).toHaveText('OK')
// ← 'OK' になるまで timeout 内でリトライ
```

**レビュー観点**：「`await locator.textContent()` してから `expect(text).toBe(...)` していないか」をチェックする。本リポでも `readSummaryStat` を経由した値の `toBe` がいくつかある（`workbench.spec.ts:441-445`）。**これらは API レスポンスを基準にした厳密一致が目的**で、その時点で確定している前提なので OK。直前に `expect.poll` で値が安定したことを確認している。

## 3. `expect.poll` の使いどころ

Web-first assertion でも対応できない、**任意の async 関数が条件を満たすまで待ちたい**ときに使う。

このリポの実例 3 つを読む：

### (a) 基準日変更で SPI/CPI が変動するまで待つ

```ts
// workbench.spec.ts:171-180
await expect
  .poll(
    async () => {
      const spi = await readSummaryStat(page, 'SPI')
      const cpi = await readSummaryStat(page, 'CPI')
      return spi !== spiBefore || cpi !== cpiBefore
    },
    { timeout: 10_000 },
  )
  .toBe(true)
```

「変わったらいい。なにに変わるかは分からない」という条件。web-first ではこれは表現できない。

### (b) 前日比トグルで delta 表示になるまで待つ

```ts
// workbench.spec.ts:194-204
await expect
  .poll(
    async () => {
      const spi = await readSummaryStat(page, 'SPI')
      const cpi = await readSummaryStat(page, 'CPI')
      const ev = await readSummaryStat(page, 'EV')
      return [spi, cpi, ev].some((v) => /[▲▼]|±0/.test(v))
    },
    { timeout: 5_000 },
  )
  .toBe(true)
```

「3 つの値のうち**どれか**が delta フォーマットになる」という「いずれか」条件。

### (c) BAC が確定した正規表現に合致するまで待つ

```ts
// workbench.spec.ts:425-433
await expect
  .poll(
    async () => {
      const bac = await readSummaryStat(page, 'BAC')
      return /^\d+\.\d MD$/.test(bac)
    },
    { timeout: 15_000 },
  )
  .toBe(true)
```

EVM 計算がまだ走っていて「N/A」状態の可能性があるので、**フォーマットが安定してから**厳密一致テストへ進む、という前段の安定化。
直後に `expect(...).toBe(expectedBacStrip)` で厳密一致しているので、ここで poll で待たないと flaky になる。

## 4. `waitForTimeout` が NG な理由

```ts
// 絶対に書きたくない例
await page.waitForTimeout(2000)   // 2 秒待つ
```

**問題点**：

1. **遅すぎるか、足りないかのどちらか**：環境差で 1.5 秒で終わることも、3 秒かかることもある。テスト数だけ累積する
2. **意図が読めない**：「何を待っているのか」がコードに現れない
3. **Trace Viewer で見ても無意味**：何が起きるべきだったのかが分からない

**代替手段**：

| 待ちたいもの | 使う API |
|--------------|----------|
| 要素が visible | `await expect(locator).toBeVisible()` |
| 要素が enabled | `await expect(locator).toBeEnabled()` |
| URL が変わる | `await page.waitForURL('**/dashboard')` |
| ネットワーク応答 | `await page.waitForResponse(/api\/foo/)` |
| 値が条件を満たす | `await expect.poll(async () => ...).toBe(...)` |
| 任意条件 | `await page.waitForFunction(() => window.MyApp.ready)` |

PR レビューで `waitForTimeout` を見たら **ほぼ自動でレッドフラグ**。例外はアニメーション完了待ち等のごく稀なケース。

> 本リポでは `waitForTimeout` の使用は **0 件**（grep で確認可）。これは健全さの目安になる。

## 5. UI + API 混在のテストを読む：`workbench.spec.ts:407-497`

シナリオ 9 は教材として完璧。**API を直接叩いて期待値を作り、UI 表示と一致するかを検証**する構造。

ポイントだけ拾うと：

```ts
// 1) API を呼ぶ
const apiResp = (await callTrpcQuery(request, 'evm.calculate', { ... })) as EvmCalculateResp

// 2) UI 描画が安定するまで poll で待つ（フォーマット確認）
await expect.poll(...).toBe(true)

// 3) API 値を期待値に変換して厳密一致
expect(await readSummaryStat(page, 'BAC')).toBe(`${apiResp.summary.bac.toFixed(1)} MD`)

// 4) クライアント側派生ロジックを TypeScript で再実装し、Inspector 値と比較
const derived = deriveTaskMetricsForTest(selectedTask, baseDay)
expect(await readInspectorTaskStat(page, 'BAC')).toBe(`${derived.bac.toFixed(1)} MD`)
```

**レビュー観点**：
- API 値と UI 値を直接比較しているか（=ハードコード値で誤魔化していないか）
- `deriveTaskMetricsForTest` のように **クライアントロジックを再実装している箇所**は、本物のクライアントコードと乖離するリスクがある（コメントで明示されている：392 行目）。レビュー時に「実装と test の二重保守」になっていないか考える

`import.spec.ts` は **UI ゼロで API だけ**を叩くテスト群。`{ request }` フィクスチャだけ受け取って `page` を使っていない（`import.spec.ts:113`, `192`, `232`）。これも Playwright で書ける（むしろ統合テストの良い置き場）。

## 6. 演習：flaky なテストを書いて直す

### Step 1: 故意に壊れやすいテストを書く

`workbench.spec.ts` の末尾あたりに、こんなテストを **一時的に追加**する：

```ts
test('わざと flaky にする例', async ({ page }) => {
  await page.goto('/')

  // ❌ 固定 sleep
  await page.waitForTimeout(500)

  // ❌ 値を取り出してから厳密一致 — その瞬間に「N/A」の可能性
  const bac = await page
    .getByTestId('summary-strip')
    .getByTestId('summary-stat-BAC-value')
    .textContent()
  expect(bac).toMatch(/^\d+\.\d MD$/)
})
```

### Step 2: 動作不安定を確認

```bash
cd evm-studio
# 10 回連続実行して flakiness を炙り出す
for i in 1 2 3 4 5 6 7 8 9 10; do
  npx playwright test --config e2e/playwright.config.ts -g "わざと flaky" --reporter=line
done
```

環境によっては毎回通るかもしれないが、`sleep` を `100` に短縮すれば落ちる頻度が上がる。

### Step 3: Playwright 流に書き直す

```ts
test('flaky を解消した版', async ({ page }) => {
  await page.goto('/')

  // ✅ web-first assertion で安定するまで待つ
  await expect(
    page.getByTestId('summary-strip').getByTestId('summary-stat-BAC-value'),
  ).toHaveText(/^\d+\.\d MD$/, { timeout: 15_000 })
})
```

`toHaveText` に正規表現を渡すと「value が正規表現にマッチするまで」リトライする。

### Step 4: 元に戻す

```bash
git restore evm-studio/e2e/workbench.spec.ts
```

## 振り返り（自己診断 3 問）

<details>
<summary>Q1: <code>await locator.textContent()</code> の結果を <code>expect(...).toBe(...)</code> で検証するパターンは常に NG？</summary>

常にではない。**直前で値が確定していることが保証されていれば OK**。本リポでも `workbench.spec.ts:441-445` でこのパターンを使っているが、直前の `expect.poll` で BAC のフォーマットが安定したことを確認している。
NG なのは「**安定化なしにいきなり値を取って厳密一致**」する書き方。レビューでは「直前で安定化しているか」を必ず確認する。
</details>

<details>
<summary>Q2: <code>await page.waitForTimeout(2000)</code> を PR で見つけたら、レビューコメントには何を書く？</summary>

「環境差で flaky / slow になります。**何を待っているのか**を明示する API に置き換えてください。
- 要素出現待ち → `await expect(locator).toBeVisible()`
- 値の安定待ち → `await expect.poll(async () => ..., { timeout })`
- ネットワーク完了 → `await page.waitForResponse(/...$/)`

例外として、CSS アニメーションの完了待ちなど Playwright が auto-wait しない真の `sleep` が必要なケースのみ残してよいですが、その場合もコメントで理由を明記してください」
</details>

<details>
<summary>Q3: <code>expect.poll</code> と <code>expect(locator).toHaveText(/regex/)</code>、どちらを選ぶ？</summary>

- **locator 1 つの状態が条件を満たす**まで待つ → `toHaveText` / `toBeVisible` 等の web-first assertion
- **複数の locator や任意の async 関数の戻り値**が条件を満たすまで待つ → `expect.poll`

本リポ `workbench.spec.ts:171-180` の「SPI **または** CPI が変わる」は複数値の OR 条件なので poll。「BAC がフォーマット A になる」だけなら `toHaveText(/regex/)` で書ける。
</details>

## 参考リンク

- [Playwright Docs: Auto-waiting](https://playwright.dev/docs/actionability)
- [Playwright Docs: Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Docs: expect.poll](https://playwright.dev/docs/test-assertions#expectpoll)

---

次へ → [Chapter 4: テスト構造・フィクスチャ・ヘルパー](./04-structure-fixtures.md)
