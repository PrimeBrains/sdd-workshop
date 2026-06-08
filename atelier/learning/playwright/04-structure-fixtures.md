# Chapter 4: テスト構造・フィクスチャ・ヘルパー

**所要 60-90 分**

## 狙い

- `test.describe` / `beforeEach` の役割と、本リポでの実例を読める
- ヘルパー関数 vs Page Object の使い分けが判断できる
- 並列実行・テスト隔離の概念を理解し、データ汚染リスクをレビューで指摘できる

## 1. test の階層と実行モデル

Playwright のテスト実行単位はざっくり：

```
spec ファイル (workbench.spec.ts)
└─ describe (省略可。論理的グルーピング)
   └─ test (1 ケース)
      └─ step (省略可。1 テスト内の見出し)
```

`workbench.spec.ts` は describe を使わず、`test()` をフラットに並べる構成。
`import.spec.ts` は describe を 2 つ使う構成（`import.spec.ts:105`, `303`）：

```ts
// import.spec.ts:105
test.describe('WBS YAML インポート → タスク一覧確認 (Req 6.1, 6.9)', () => {
  test('3 つの YAML をインポートしてタスク一覧が正しく返る', ...)
  test('再インポートで重複が発生しない (Req 6.1 upsert)', ...)
  test('ImportSummary が正しいカウントを返す (Req 6.9)', ...)
})

test.describe('実プロジェクト YAML インポート (Req 6.11, 6.12, 6.8)', () => {
  // 84 タスクの実プロジェクト系
})
```

**`describe` の効用**：
- レポートでのグルーピング表示
- describe スコープに `beforeEach` / `afterEach` を限定できる
- `describe.serial` / `describe.parallel` で実行モードを変えられる

## 2. `beforeEach` の使われ方

```ts
// workbench.spec.ts:123-136
test.beforeEach(async ({ page }) => {
  await skipIfClientNotRunning(page)
  await page.goto('/')
  await expect(
    page.locator('div').filter({ hasText: PROJECT_NXP_NAME }).first(),
  ).toBeVisible({ timeout: 15_000 })

  // 基準日を共通の評価日 (2026-05-13) に揃える
  const dateInput = await openBaseDatePicker(page)
  await dateInput.fill(BASE_DATE)
  await page.keyboard.press('Escape')
})
```

**ここで起きていること**：

1. クライアント未起動なら test.skip（実行可能性ガード）
2. ルートへ navigate
3. EVM 計算完了まで 15 秒待つ（**前提条件の整備**）
4. 基準日を固定値に揃える（**テスト間で結果が変わらないようにする**）

**レビュー観点**：
- `beforeEach` で「**そのテストが前提とする状態**」を作っているか
- 逆に「テスト本体で見れば分かる」内容まで `beforeEach` に押し込んで読みにくくなっていないか
- 1 テストで使う固有のセットアップは `beforeEach` ではなくテスト本体に書くべき

## 3. ヘルパー関数の使われ方

`workbench.spec.ts` のヘルパー（38-119 行）を読む：

```ts
// 短い locator ラッパー
function ganttFullscreenButton(page: Page): Locator {
  return page.getByTestId('gantt-fullscreen-button')
}

// アクション + 戻り値
async function openBaseDatePicker(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /基準日/ }).click()
  return page.locator('input[type="date"]').first()
}

// 値の取り出し（共通フォーマット）
async function readSummaryStat(page, label) { ... }
```

これらの何が良いか：

| 観点 | 効果 |
|------|------|
| **意図の表現** | `ganttFullscreenButton(page).click()` は読める。`page.getByTestId('gantt-fullscreen-button').click()` は冗長 |
| **DRY** | testid 命名規約 `summary-stat-${label}-value` を 1 箇所にまとめる |
| **変更耐性** | testid を変えるときに 1 箇所直すだけで済む |

**しかし限界もある**：

- ヘルパーが増えると「どこに何があるか」が分散する
- パラメータが増えると関数シグネチャが膨らむ
- 状態を持ちたくなった瞬間に Page Object Pattern のほうが綺麗

## 4. Page Object Pattern：いつ導入するか

このリポは Page Object（以下 POM）を **採用していない**。
POM はテスト対象画面を class でラップする手法：

```ts
// 仮の例（リポにはない、概念説明用）
class WorkbenchPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/')
    await expect(this.summaryStrip).toBeVisible()
  }

  get summaryStrip() {
    return this.page.getByTestId('summary-strip')
  }

  async readStat(label: 'SPI' | 'CPI' | 'EV' | 'PV' | 'AC' | 'VAC' | 'BAC') {
    return (await this.summaryStrip
      .getByTestId(`summary-stat-${label}-value`)
      .textContent())?.trim() ?? ''
  }

  async setBaseDate(date: string) {
    await this.page.getByRole('button', { name: /基準日/ }).click()
    await this.page.locator('input[type="date"]').first().fill(date)
    await this.page.keyboard.press('Escape')
  }
}

test('シナリオ 2', async ({ page }) => {
  const workbench = new WorkbenchPage(page)
  await workbench.goto()
  const spiBefore = await workbench.readStat('SPI')
  await workbench.setBaseDate('2026-04-10')
  // ...
})
```

**POM の判断基準**：

| 入れたほうがいい | ヘルパーで足りる |
|------------------|------------------|
| spec ファイルが 5+ 個に増える | 1-3 spec で完結する |
| 同じ画面を複数 spec で扱う | 1 spec の中で閉じる |
| getter だけでなく「画面遷移」「フォーム入力一式」も再利用したい | 短い locator ラッパーで十分 |
| TypeScript の型補完を最大限効かせたい | 関数で十分 |

本リポの 3 spec 規模なら、ヘルパー関数で十分。spec が増えるなら POM 移行を検討。

## 5. 並列実行とテスト隔離

### デフォルト動作

```bash
npx playwright test
```

Playwright はデフォルトで **複数 worker で並列実行**する。各 worker は独立した **ブラウザコンテキスト**（cookies / storage が分離）を持つ。

**つまり**：
- UI のテスト同士は基本的に独立
- ただし **バックエンドの DB** は共有

### 本リポの隔離戦略

`import.spec.ts` を見るとデータ汚染対策が分かる：

```ts
// import.spec.ts:113-186
test('3 つの YAML をインポートしてタスク一覧が正しく返る', async ({ request }) => {
  const project = await callMutation(request, 'projects.create', { ... }) as { id: number }
  try {
    // ... テスト本体
  } finally {
    await callMutation(request, 'projects.delete', { id: project.id })  // ← クリーンアップ
  }
})
```

**毎テスト固有のプロジェクトを作って、最後に必ず消す**。これで並列実行しても他テストと干渉しない。

```ts
// 同様のパターン: import.spec.ts:192, 232, 312, 354
const project = await callMutation(request, 'projects.create', { ... }) as { id: number }
try {
  // ...
} finally {
  await callMutation(request, 'projects.delete', { id: project.id })
}
```

**レビュー観点**：
- DB を書き換えるテストで `finally` のクリーンアップがあるか
- クリーンアップが**例外時にも走るか**（`try/finally` 必須、`afterEach` で書くなら try 不要）
- 並列実行を阻む `test.describe.serial` を不必要に使っていないか

### `workbench.spec.ts` の戦略は別物

UI 系の `workbench.spec.ts` は seed データ（`npm run seed`）に依存する読み取り中心のテスト。
ただしシナリオ 7（`workbench.spec.ts:267-304`）は **進捗を保存**するため DB を書き換える。

```ts
// workbench.spec.ts:289-292
const beforeStr = (await progressNumber.inputValue()) || '0'
const before = Number.parseInt(beforeStr, 10)
const target = before >= 90 ? String(before - 5) : String(before + 5)
await progressNumber.fill(target)
```

「**現在値に依らず必ず変化させる**」工夫が入っている（コメント参照）。これは「同じテストを連続実行しても保存ボタンが disabled にならない」ためで、**冪等性**を担保している。

ただ別観点ではこのテストは DB の進捗値を恒久的に書き換えており、長期的には別プロジェクトを作って実行する設計に変えたほうが綺麗。**こういう点を PR で指摘できると良い**。

## 6. 演習：ヘルパー → POM の比較

`workbench.spec.ts` のシナリオ 2 を題材に、**ローカルで** POM 風に書き換えて比較する。

### Step 1: POM 風クラスを書く（新しいファイル `e2e/pom.example.ts` を一時作成）

```ts
import type { Page, Locator } from '@playwright/test'

export class WorkbenchPage {
  constructor(private page: Page) {}

  get summaryStrip(): Locator {
    return this.page.getByTestId('summary-strip')
  }

  async goto() {
    await this.page.goto('/')
  }

  async readStat(label: 'SPI' | 'CPI'): Promise<string> {
    return (await this.summaryStrip
      .getByTestId(`summary-stat-${label}-value`)
      .textContent())?.trim() ?? ''
  }

  async setBaseDate(date: string) {
    await this.page.getByRole('button', { name: /基準日/ }).click()
    await this.page.locator('input[type="date"]').first().fill(date)
    await this.page.keyboard.press('Escape')
  }
}
```

### Step 2: 既存テストを POM で書き換え（`workbench.pom.spec.ts` を一時作成）

```ts
import { test, expect } from '@playwright/test'
import { WorkbenchPage } from './pom.example'

test('POM 版 シナリオ 2', async ({ page }) => {
  const wb = new WorkbenchPage(page)
  await wb.goto()
  await expect(wb.summaryStrip).toBeVisible({ timeout: 15_000 })

  const spiBefore = await wb.readStat('SPI')
  await wb.setBaseDate('2026-04-10')

  await expect.poll(async () => await wb.readStat('SPI') !== spiBefore, { timeout: 10_000 }).toBe(true)
})
```

### Step 3: 体感する

```bash
cd evm-studio
npm run test:e2e -- -g "POM 版"
```

### Step 4: 振り返り

- 1 spec しかないと **POM の御利益が薄い**ことを体感する
- spec を 3-5 個に増やしたつもりで考えると、`setBaseDate` のような複数手順をまとめた method の価値が見えてくる

### Step 5: クリーンアップ

```bash
rm evm-studio/e2e/pom.example.ts evm-studio/e2e/workbench.pom.spec.ts
```

## 7. フィクスチャ拡張（参考、本リポ未使用）

Playwright は自前フィクスチャを定義できる：

```ts
// 概念例（リポにはない）
import { test as base } from '@playwright/test'

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('secret')
    await page.getByRole('button', { name: 'Login' }).click()
    await use(page)
  },
})

// 使う側
test('ダッシュボードが見える', async ({ authedPage }) => {
  await authedPage.goto('/dashboard')
})
```

`beforeEach` よりも **依存注入で自然に書ける** + **使うテストだけ走る**（毎回ログインを書かなくていい）。
本リポは認証不要なので未使用。中規模以上のプロジェクトでは早めに導入する価値がある。

## 振り返り（自己診断 3 問）

<details>
<summary>Q1: <code>test.beforeEach</code> と <code>test.describe</code> 内の <code>beforeEach</code>、どう使い分ける？</summary>

- ファイル直下の `beforeEach` → そのファイル全 test に効く
- `describe(...)` 内の `beforeEach` → その describe 内の test だけに効く

`import.spec.ts` のように **2 つの describe で前提条件が異なる**ファイルでは、各 describe 内に書く（現状は両 describe 共に beforeEach なし、各 test が独立してプロジェクト作成）。
混在させる際は「全 test 共通」と「特定 describe だけ」を意識して分割する。
</details>

<details>
<summary>Q2: PR で「DB を書き換える test に <code>finally</code> でのクリーンアップがない」を見つけた。何を提案する？</summary>

「`projects.create` で作成したリソースを後始末しないと、テスト失敗時にゴミデータが残り、後続テストや CI で予期しない副作用が出ます。**`try/finally` で `projects.delete` を呼ぶ**か、または `test.afterEach` で削除してください。

例外時にも確実に走るよう finally を推奨。`import.spec.ts:182-185` の既存パターンと揃えてください」
</details>

<details>
<summary>Q3: ヘルパー関数 vs Page Object、本リポでもし spec が 10 個に増えるとしたらどうする？</summary>

POM 導入を検討。判断基準は「**同じ画面を複数 spec から触るか**」。

- 触る → POM。get / action / verify をクラスに集約することで重複を排除
- 触らない（spec ごとに完結） → ヘルパー関数のまま

部分的に POM 化（例：Workbench だけ POM、API テストは関数のまま）するハイブリッドも実務的にはアリ。
</details>

## 参考リンク

- [Playwright Docs: Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright Docs: Page Object Models](https://playwright.dev/docs/pom)
- [Playwright Docs: Parallelism](https://playwright.dev/docs/test-parallel)

---

次へ → [Chapter 5: PR レビュー実演](./05-review-checklist.md)
