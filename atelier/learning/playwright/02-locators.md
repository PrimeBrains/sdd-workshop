# Chapter 2: ロケーターの哲学

**所要 60-90 分**

## 狙い

- なぜ Playwright は「user-facing locator」を推奨するのか、その理由を自分の言葉で説明できる
- このリポの `workbench.spec.ts` の selector を分類できる
- 脆い locator を一目で見抜き、修正案を示せる

## 1. Locator 優先順位の公式見解

Playwright 公式の推奨順序：

```
1. getByRole         ← 第一選択
2. getByLabel        ← フォーム要素ならこれ
3. getByPlaceholder  ← Label がない入力欄
4. getByText         ← 表示テキストで特定
5. getByAltText      ← 画像
6. getByTitle        ← title 属性
7. getByTestId       ← 上記が無理ならこれ
8. page.locator()    ← CSS / XPath。最終手段
```

**なぜこの順序か** — 3 つの観点で並んでいる：

| 観点 | 上位の locator が優れる理由 |
|------|--------------------------|
| 意図の明示 | `getByRole('button', { name: '保存' })` は「保存ボタン」と読める。`div.btn-primary-2` は読めない |
| アクセシビリティ | role / label を使うテストは、a11y が壊れたときに同時に壊れる（=デグレ検知になる） |
| 壊れにくさ | 実装の class 名やツリー構造が変わってもユーザー体験が同じなら壊れない |

`getByTestId` は「user-facing で特定できないとき**だけ**」使う逃げ道。

## 2. このリポの selector を分類してみる

`workbench.spec.ts` から実例を抽出してカテゴリ別に並べる。

### (a) `getByRole`：理想形

```ts
// workbench.spec.ts:80-81
return page.getByRole('button', { name: new RegExp(`${PROJECT_NXP_NAME}|${PROJECT_OHX_NAME}|—`) }).first()

// workbench.spec.ts:106
await page.getByRole('button', { name: /基準日/ }).click()

// workbench.spec.ts:112-113
return page.getByRole('button', { name: '前日比トグル' })

// workbench.spec.ts:298
await page.getByRole('button', { name: '保存' }).click()
```

**良い点**：a11y name でボタンを特定。「保存」ボタンの色や class 名が変わっても壊れない。`name` に RegExp を渡せるので表示テキストが動的でも対応できる。

### (b) `getByTestId`：必要悪としての使用

```ts
// workbench.spec.ts:62-66
const valueEl = page
  .getByTestId('summary-strip')
  .getByTestId(`summary-stat-${label}-value`)
```

EVM 指標の数値表示パネル群は、構造的に「label と value が分離した小さな要素が並ぶ」UI で、`getByRole('text')` 等では一意に特定しづらい。
`data-testid="summary-stat-SPI-value"` のように **意味のある testid 命名**を付けた上で、`getByTestId('summary-strip')` でスコープを限定して衝突を避ける、というのが現実解。

> testid 命名はそれ自体が API。`summary-stat-${label}-value` のように予測可能であれば、テスト側のループが書きやすく、レビュー時にも grep で双方向に追える。

### (c) `getByText`：注意して使う

```ts
// workbench.spec.ts:218
await expect(page.getByText('Inspector · Task').first()).toBeVisible({ timeout: 5_000 })

// workbench.spec.ts:232
await expect(page.getByText('Tasks · WBS · Fullscreen').first()).toBeVisible({ timeout: 5_000 })
```

「Inspector · Task」のような **画面に固有の文字列**ならアリ。逆に「保存」のような汎用語でやると衝突しやすい（→ 上の `getByRole('button', { name: '保存' })` のほうが「役割が button である保存」と意図が締まる）。

### (d) `page.locator('...')`：CSS / 属性セレクター — 必要なときのみ

```ts
// workbench.spec.ts:117-118
const root = 'locator' in scope ? scope : scope.locator('body')
return root.locator('[data-testid="gantt-row"]').filter({ hasText: text }).first()

// workbench.spec.ts:107
return page.locator('input[type="date"]').first()

// workbench.spec.ts:281-285
const progressNumber = page
  .locator('aside')
  .filter({ hasText: '記録日 (スナップショット)' })
  .locator('input[type="number"]')
  .first()
```

`input[type="date"]` のような **type 属性**は class 名と違って実装変更で動かない／意味的に安定なので使ってよい。`aside` も「サイドパネル」というセマンティクスを持つタグ。

一方で **悪い CSS locator** の典型は次のような形：

```ts
// 仮の悪い例（リポには存在しない、説明用）
page.locator('div > div.container > div:nth-child(2) > button')   // ツリー依存
page.locator('.btn-primary-xl-2')                                  // class 命名依存
page.locator('#root > main > section > div > div > button')        // 構造全依存
```

これらは UI 構造のちょっとした変更で全滅する。

## 3. 過去の commit を追体験：`bde3bcb`

このリポでは `data-testid="gantt-row"` と `data-testid="chart-fullscreen"` を **後から**追加して脆弱なテストを救った経緯がある。

```bash
git show bde3bcb --stat
```

> 根本原因: Playwright の `text=` セレクターと `div first()` の組み合わせが、Phase 9 修正で UI 全体が正常描画されるようになった結果、テキスト多重出現で意図しない要素にヒットするようになっていた (修正前は server エラーで描画されずたまたま pass していた)。

**ここから学ぶ教訓**：

1. **「テキストで特定」は二重表示の罠**：BrandMark の `<span aria-label="EVM Studio">` と wordmark の `<div>EVM STUDIO</div>` が同居しているような実装パターンは UI ではよくある（`smoke.spec.ts:11-15` のコメント参照）
2. **`div.filter({ hasText: ... }).first()` は最後の手段**：first() は「複数マッチしているけど 1 件目で OK」と諦めた合図。本当に意図した 1 件か確証はない
3. **data-testid の追加は実装側 PR と一緒に**：レビュー時に「テスト側だけ selector を変えて場当たり対応していないか」を見る

差分の核心（コミットメッセージから読み取れる）：

```ts
// 修正前: ヒット箇所が複数あって意図しない要素を取っていた
ganttRowByText = page.locator('div').filter({ hasText: name }).first()

// 修正後: スコープを data-testid="gantt-row" に限定
ganttRowByText = page.locator('[data-testid="gantt-row"]').filter({ hasText: name }).first()
```

差分を実物で見るには：

```bash
git show bde3bcb -- evm-studio/e2e/workbench.spec.ts
```

## 4. 演習：意図的に壊して観察する

`workbench.spec.ts` のシナリオ 5 を手元で書き換えて壊す。

### Step 1: 現状を確認

```ts
// workbench.spec.ts:229
await ganttFullscreenButton(page).click()
```

`ganttFullscreenButton` は `page.getByTestId('gantt-fullscreen-button')`（84-86 行）。これを **意図的に脆い CSS** に置き換える：

```ts
// 一時的に書き換える（commit しない）
async function ganttFullscreenButton(page: Page): Locator {
  return page.locator('button').nth(3)   // ← 4 番目のボタン、と決め打ち
}
```

### Step 2: 走らせる

```bash
cd evm-studio
npm run test:e2e -- -g "シナリオ 5"
```

おそらくテストは通るか通らないかは UI のボタン配置に依存し、運次第になる。これが「**動いているように見えるが、UI に手を入れた瞬間に壊れる**」状態。

### Step 3: Trace Viewer で確認

`--trace on` 付きで再実行し、`show-trace` で開いて「クリック対象の要素」が意図通りか確認する。
おそらく「ガント全画面ボタン」ではない、何か別のボタンをクリックしている。

### Step 4: `git restore` で戻す

```bash
git restore evm-studio/e2e/workbench.spec.ts
```

## 5. アンチパターン早見表

| アンチパターン | なぜ NG | 推奨 |
|----------------|---------|------|
| `div:nth-child(2)` | ツリー構造変更で死ぬ | `getByRole` / `getByTestId` |
| `.btn-primary` 等の見た目 class | デザイン変更で死ぬ | `getByRole('button', { name })` |
| `.foo > .bar > .baz` | ネスト変更で死ぬ | スコープ内で `getByX` |
| `getByText('保存')`（汎用語） | 複数マッチで非決定的 | `getByRole('button', { name: '保存' })` |
| `page.locator('div').filter({ hasText }).first()` | 二重表示の罠 | `getByTestId` でスコープを切る |
| `xpath=//div[@class='foo']/...` | ほぼ最悪。読めない・壊れる | 同上 |

## 振り返り（自己診断 3 問）

<details>
<summary>Q1: PR で <code>page.locator('.summary-card > .value')</code> を見つけたら、どんなコメントをする？</summary>

「class 名依存の CSS locator で、CSS 変更や class 名リファクタで壊れます。**該当要素に `data-testid` を付ける**か、`getByRole` で特定できないか検討してください。例：`summary-card-value-${label}` のように meaningful な testid を提案します」

ここで「修正案」を出せるかどうかが Senior レビュアーとの分岐点。
</details>

<details>
<summary>Q2: <code>getByText('保存')</code> と <code>getByRole('button', { name: '保存' })</code>、本リポではどちらが好ましい？</summary>

後者。Workbench には他にも「保存」テキストが現れうる（説明文、ツールチップ等）。**role を絞ることでクリックすべき対象を意味的に固定**できる。コードを読む人にも「これはボタン」と即座に伝わる。
</details>

<details>
<summary>Q3: <code>page.getByTestId('summary-strip').getByTestId('summary-stat-SPI-value')</code> のような「スコープを切る」書き方、なぜわざわざ二段にする？</summary>

`summary-stat-SPI-value` は SummaryStrip 内だけでなく、Inspector の Task モード（`workbench.spec.ts:380-386`）でも同じ命名で使われている。**同一 testid が複数箇所に出る場合は、外側のスコープで限定しないと strict mode 違反になる**。これは「testid を予測可能に命名」した代償だが、スコープ二段で安全に解消できる。
</details>

## 参考リンク

- [Playwright Docs: Locators (Best Practices)](https://playwright.dev/docs/locators)
- [Playwright Docs: Other locators](https://playwright.dev/docs/other-locators) — CSS / XPath を使ってよい場合

---

次へ → [Chapter 3: 待機とアサーション（flakiness 退治）](./03-waiting-assertions.md)
