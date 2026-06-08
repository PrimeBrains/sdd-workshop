# Playwright チートシート（レビュー時に開く 1 枚もの）

## CLI（このリポ前提）

```bash
cd evm-studio
npm run test:e2e                                      # 全テスト
npx playwright test --config e2e/playwright.config.ts --ui                 # UI モード（一番便利）
npx playwright test --config e2e/playwright.config.ts --headed             # ブラウザ目視
npx playwright test --config e2e/playwright.config.ts --debug              # Inspector でステップ実行
npx playwright test --config e2e/playwright.config.ts -g "シナリオ 5"      # 名前 grep
npx playwright test --config e2e/playwright.config.ts --trace on -g "..."  # Trace 取得
npx playwright show-trace test-results/<dir>/trace.zip                     # Trace Viewer 起動
```

## Locator 優先順位

```
getByRole > getByLabel / getByPlaceholder > getByText > getByTestId > page.locator()
        ↑ user-facing （壊れにくい・読める）              ↑ 最終手段（CSS / XPath）
```

## Locator 早見表

| やりたいこと | API |
|--------------|-----|
| ボタン | `page.getByRole('button', { name: '保存' })` |
| リンク | `page.getByRole('link', { name: 'About' })` |
| 見出し | `page.getByRole('heading', { name: /タスク/ })` |
| input + label | `page.getByLabel('メールアドレス')` |
| placeholder | `page.getByPlaceholder('検索…')` |
| 表示テキスト | `page.getByText('Inspector · Task')` |
| testid | `page.getByTestId('summary-strip')` |
| 階層スコープ | `parent.locator('input[type="number"]').first()` |
| フィルタ | `locator.filter({ hasText: '...' })` |
| n 番目 | `locator.first()` / `.nth(2)` / `.last()` |

## アサーション早見表

### Web-first（retry される、async / await 必須）

```ts
await expect(locator).toBeVisible()
await expect(locator).toBeHidden()
await expect(locator).toBeEnabled()
await expect(locator).toBeDisabled()
await expect(locator).toBeChecked()
await expect(locator).toHaveText('OK')
await expect(locator).toHaveText(/^\d+ MD$/)
await expect(locator).toContainText('部分一致')
await expect(locator).toHaveValue('input value')
await expect(locator).toHaveCount(3)
await expect(locator).toHaveAttribute('href', /\/dashboard$/)
await expect(page).toHaveURL(/\/dashboard$/)
await expect(page).toHaveTitle(/EVM Studio/)
```

### 値ベース（retry されない、その瞬間の値）

```ts
expect(value).toBe('OK')
expect(value).toEqual({ a: 1 })
expect(arr).toHaveLength(3)
expect(arr).toContain('item')
expect(value).toMatch(/pattern/)
expect(obj).toHaveProperty('id')
```

### 任意条件の retry

```ts
await expect.poll(async () => await someFn(), { timeout: 10_000 }).toBe(true)
```

## アクション早見表

```ts
await page.goto('/')
await locator.click()                              // 普通のクリック
await locator.click({ force: true })               // 可視性無視（緊急用）
await page.mouse.click(5, 5)                       // 座標指定
await locator.fill('text')                         // input に値
await locator.type('text', { delay: 50 })          // 1 文字ずつ
await locator.press('Enter')                       // 単一キー
await page.keyboard.press('Escape')                // ページレベル
await locator.check() / .uncheck()                 // チェックボックス
await locator.selectOption('value')                // <select>
await locator.hover()
await locator.dragTo(target)
```

## 待機 API（使い分け）

| 待ちたいもの | API |
|--------------|-----|
| 要素 visible | `await expect(locator).toBeVisible({ timeout })` |
| URL 遷移 | `await page.waitForURL('**/dashboard')` |
| 応答 | `await page.waitForResponse(resp => resp.url().includes('/api/foo'))` |
| 任意関数 | `await page.waitForFunction(() => window.MyApp.ready)` |
| カスタム条件 | `await expect.poll(async () => ..., { timeout }).toBe(true)` |
| **❌ 固定時間** | `await page.waitForTimeout(2000)` — **使うな** |

## アンチパターン → 推奨パターン

| ❌ NG | ✅ OK |
|-------|------|
| `page.locator('div.foo > div:nth-child(2)')` | `page.getByRole('button', { name: '保存' })` |
| `page.locator('.btn-primary')` | `page.getByTestId('save-button')` |
| `page.getByText('保存')` | `page.getByRole('button', { name: '保存' })` |
| `await page.waitForTimeout(2000)` | `await expect(locator).toBeVisible({ timeout: 5_000 })` |
| `const t = await loc.textContent(); expect(t).toBe('OK')` | `await expect(loc).toHaveText('OK')` |
| `if (await loc.isVisible()) { ... }` | `await expect(loc).toBeVisible()` |
| `test.only(...)` を残す | デバッグ後削除（CI で他テストがスキップされる） |
| `page.locator('div').filter().first()` | `page.getByTestId(...).filter()` でスコープを切る |

## レビューチェックリスト超圧縮版

```
Locator:
  [ ] L1 class/階層に依存していない？
  [ ] L2 汎用テキスト + getByText になっていない？ → getByRole
  [ ] L3 同 testid 複数箇所ならスコープを切っている？
  [ ] L4 .first()/.nth() の使用に根拠ある？
  [ ] L5 testid 命名は予測可能・grep 可能？

Wait/Assert:
  [ ] W1 waitForTimeout はゼロ？
  [ ] W2 textContent→toBe は直前で安定化している？
  [ ] W3 OR/カスタム条件は expect.poll？
  [ ] W4 web-first matcher が中心？
  [ ] W5 timeout 値に根拠？

Structure:
  [ ] S1 beforeEach は前提整備に集中？
  [ ] S2 DB 書き換え test に try/finally / afterEach のクリーンアップ？
  [ ] S3 test 名は What を表す？
  [ ] S4 only/serial/skip に正当な理由？（only は事故）
  [ ] S5 ヘルパー過多？POM 検討時期？

Coverage:
  [ ] C1 境界・エラーケースが含まれている？
  [ ] C2 実装と二重保守になっていない？
```

## 触れていない発展トピック（深掘り用キーワードのみ）

- **Visual regression**: `await expect(page).toHaveScreenshot()` — UI 差分の自動検出
- **Component testing**: `@playwright/experimental-ct-react` 等で React component を Playwright で
- **Accessibility testing**: `@axe-core/playwright` で a11y 違反を検出
- **API mocking**: `page.route()` で fetch 差し替え
- **Authentication state reuse**: `storageState` で複数 test 間でログイン状態を共有
- **Sharding & 並列化**: CI で `--shard=1/3` 等
- **Custom fixtures**: `test.extend()` で依存注入

これらは PR レビュー時に「使われていれば軽く確認、未使用なら深掘りしない」で OK。

---

[← Chapter 5](./05-review-checklist.md) ｜ [README に戻る](./README.md)
