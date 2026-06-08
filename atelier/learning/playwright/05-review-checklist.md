# Chapter 5: PR レビュー実演

**所要 45-60 分**

## 狙い

- Chapter 1-4 の知識をチェックリスト化し、**自分でレビューする手順**を確立する
- 過去 commit を題材に「自分ならどうレビューするか」を口頭で説明できる
- 卒業課題：現状の `workbench.spec.ts` / `import.spec.ts` に対し改善ポイントを 5 件以上指摘

## 1. PR レビューの 3 ステップ

### Step 1: 全体像を 30 秒で掴む

- どの spec ファイルが変わった？
- 追加 / 削除 / 修正の比率は？
- 実装側の変更も同じ PR に含まれる？

### Step 2: 各テストを 5 段階で読む

各 test ごとに、次の順で読む：

1. **目的**：test 名と冒頭コメントから「何を保証したいか」を 1 文で言語化
2. **準備**：`beforeEach` + テスト先頭の goto / fixtures 投入
3. **操作**：ユーザー操作 / API 呼び出し
4. **検証**：assertion が「目的」と一致しているか
5. **後始末**：DB 書き換え系なら `finally` / `afterEach` でクリーンアップ

### Step 3: チェックリストを当てる

下のチェックリストを上から順に当てて、引っかかった項目をコメントする。

## 2. レビューチェックリスト（17 項目）

### Locator（→ Chapter 2）

- [ ] **L1** : CSS の class 名 / nth-child / 階層に依存していないか
- [ ] **L2** : `getByText` で**汎用語**（保存、OK、キャンセル等）を使っていないか。`getByRole('button', { name: '保存' })` の形に
- [ ] **L3** : 同じ testid が複数箇所にある場合、スコープを切っているか
- [ ] **L4** : `.first()` / `.nth(n)` が安易に使われていないか（**「複数マッチで諦めた」のサイン**）
- [ ] **L5** : 実装側に `data-testid` を追加するなら、命名は予測可能・grep 可能か（`summary-stat-${label}-value` 形式が良い例）

### Wait & Assertion（→ Chapter 3）

- [ ] **W1** : `page.waitForTimeout()` を使っていないか（**ほぼ常に NG**）
- [ ] **W2** : `await locator.textContent()` してから `expect(text).toBe(...)` していないか（直前で安定化していない限り flaky）
- [ ] **W3** : 「変動を待つ」ような OR / カスタム条件の待ちが `expect.poll` で書かれているか
- [ ] **W4** : `expect(locator).toBeVisible()` 等の **web-first matcher** が中心になっているか
- [ ] **W5** : timeout 値が**意図的に**設定されているか（15s / 10s / 5s の使い分けに根拠があるか）

### Structure（→ Chapter 4）

- [ ] **S1** : `beforeEach` が「**そのテストが前提とする状態**」を作っているか / 過剰に重くないか
- [ ] **S2** : DB を書き換える test に `try/finally` または `afterEach` でクリーンアップがあるか
- [ ] **S3** : テスト名が **What を検証するか** を表現しているか（実装詳細でなく）
- [ ] **S4** : `test.skip` / `test.serial` / `test.only` の使用に妥当な理由があるか（`only` が PR に残っているのは事故）
- [ ] **S5** : ヘルパー関数の命名・配置が読み手にとって妥当か（多すぎるヘルパーは POM 移行のサイン）

### Coverage（→ 横断）

- [ ] **C1** : ハッピーパスだけでなく、**境界**・エラーケースが含まれているか（特に新機能 PR）
- [ ] **C2** : テストが「**実装と二重保守**」になっていないか（クライアントの算出ロジックを test 側で再実装している場合は要注意 — `deriveTaskMetricsForTest` のように意図的なら OK だがコメント必須）

## 3. 過去 commit でレビュー実演

### 課題 A: `bde3bcb` を自分でレビューしてみる

```bash
git show bde3bcb
```

このコミットは「e2e workbench.spec.ts を 9/9 GREEN 化 — data-testid 追加でセレクター脆弱性を解消」。

**自分なりに以下を考える**：

1. このコミットメッセージは Conventional Commits の `test(dashboard): ...` を使っている。よい点 / 改善点は？
2. `data-testid="gantt-row"` を新規追加している。命名は適切？
3. テスト側の `ganttRowByText` の修正方針は他にも選択肢があったか？（例：`getByRole('row')` を使う等）
4. 「修正前は server エラーで描画されずたまたま pass していた」と書かれている。**これを再発防止するために**何ができる？（ヒント：smoke test の活用、`baseURL` 設定の見直し）

回答例（一例。正解は 1 つではない）：

<details>
<summary>例：このコミットへの自分のレビューコメント案</summary>

```
全体として PR 構成は良いと思います。data-testid 追加と test 側の selector
変更が同じ PR に入っていて、変更の対応関係が一目で分かるのが良いです。

[改善提案]
1. テキストベースの selector に戻れないか
   `getByText('SPI / CPI 推移')` が衝突した点は理解しましたが、
   `chart-fullscreen` testid 追加と並行して、portal 内のタイトルを
   `<h2 aria-label="SPI Trend Fullscreen">` のように構造化して
   `getByRole('heading', { name: ... })` で取れるようにする選択肢も
   検討してください。テスト用 testid を増やすほど、UI 構造の意味づけが
   testid 命名規約に押し出されていく副作用があります。

2. 再発防止の仕組み
   「server エラーで描画されず偽 pass していた」のは、
   smoke.spec.ts のヘルスチェックが API 層のみ、UI 描画は確認していない
   ことが温床と思います。最低限、TopBar が render されたことを
   確認する 1 行を smoke に足すと、後続の workbench.spec.ts が
   偽 pass する確率を下げられます。

3. tasks.md の Implementation Notes 更新が良いです
   レビュー側もここから経緯を追えるので助かりました。
```
</details>

### 課題 B: `8ee5f73` を読んでチェックリスト適用

```bash
git show 8ee5f73 --stat
git show 8ee5f73 -- evm-studio/e2e/workbench.spec.ts | head -100
```

このコミットは「e2e の最終フェイル 2 件を解消し全 16 件 GREEN 化」。
**チェックリストを 1 つずつ当てて、3 件以上のコメントを書いてみる**（メモ書きで OK）。

## 4. 卒業課題：現状の `workbench.spec.ts` を自分でレビュー

`HEAD` 時点の `workbench.spec.ts` 全体（497 行）に対し、**改善ポイントを 5 件以上**書き出す。

### ヒント（あえて答えを書かない）

- L4 を強く意識して `.first()` の使われ方を検索 → `git grep '\.first()' evm-studio/e2e/workbench.spec.ts`
- S2 を意識してシナリオ 7（進捗保存）の冪等性確保の限界を考える
- W5 を意識して timeout 値（5s / 10s / 15s）の使い分けに根拠があるか確認
- C2 を意識して `deriveTaskMetricsForTest`（392-405 行）が**実装と乖離するリスク**をどう抑えるか考える

レビューコメントの形式は「**[項目番号] 観点 + 提案**」の 3 行：

```
[L4] シナリオ 5 の `await ganttFullscreenButton(page).click()` 自体は問題ないが、
モーダル内行クリックで `.first()` を多用している。複数の葉タスク行が表示される
状況で、想定外の行を選んでしまっていないかを Trace Viewer で確認することを推奨。
あるいはタスク ID 属性 (data-task-id) で特定する方針に切り替える案も。
```

### 完了条件

- 5 件以上書けた
- 各項目にチェックリスト番号（L4 等）が紐づいている
- 「指摘だけでなく**修正案 / 代替案**」が含まれている

## 5. レビューコメントの書き方

良いレビューコメントの 3 要素：

1. **何が問題か**（事実）
2. **なぜ問題か**（理由 — Chapter 1-4 で学んだ原則）
3. **どう直すか**（提案 — コードスニペット付きが理想）

**NG 例**：
> これおかしくないですか？

**OK 例**：
> [W1] `await page.waitForTimeout(2000)` は環境差で flaky になります。EVM 計算完了を待つのが目的なら、`workbench.spec.ts:128-130` と同じく `await expect(page.locator('div').filter({ hasText: PROJECT_NAME }).first()).toBeVisible({ timeout: 15_000 })` のように web-first assertion で書き換えませんか。

## 振り返り（自己診断 3 問）

<details>
<summary>Q1: PR レビューで「テストが新規追加されたが、ハッピーパスのみで境界が無い」場合のコメントは？</summary>

「[C1] 現状のテストはハッピーパスのみです。次のケースが入っていないようでした：
- `progress = 0` の場合
- `progress = 100`（完了）の場合
- `tasks` 配列が空のプロジェクトの場合

これらは EVM 計算の境界として外せないと思います。`workbench.spec.ts:289-292` で進捗値を変化させる工夫があるように、固定 seed では網羅できない境界は **テスト内でデータを作る**設計を検討してください」
</details>

<details>
<summary>Q2: 「<code>test.only</code> が PR に残っている」を見つけた時の対応は？</summary>

最優先のレッドフラグ。`test.only` は「**それ以外のテストを全部スキップ**」する。マージされると CI が無自覚に劣化する。

```
[S4] test.only が残っています。デバッグ用の取り残しと思います。削除をお願いします。
CI で他のテストが全スキップされてしまい、リグレッション検知が機能しません。
将来 lint で防げるよう eslint-plugin-playwright の `no-focused-test` rule
導入も検討してください。
```
</details>

<details>
<summary>Q3: チェックリストにない問題を見つけた時、どうする？</summary>

それはチェックリストを更新する機会。**プロジェクト固有のアンチパターンが見つかった**ということなので、本ファイルや `cheatsheet.md` を更新して**未来のレビューに引き継ぐ**。

例：「このリポでは `seed` プロジェクトの projectId=1 を assumption してテストを書くと、seed の構成変更で死ぬ」というのは、本リポ固有の落とし穴。
こういうのを蓄積するのがチームレビュー力。
</details>

## このコース全体の振り返り

ここまで到達したら、次の問いに答えられるはず：

1. **このリポの e2e は健全か？** — Yes（waitForTimeout 0 件、testid 命名規約、try/finally 揃い）
2. **どこが改善余地か？** — シナリオ 7 の DB 汚染、`.first()` 多用、smoke の UI カバレッジ不足
3. **新しい test を 1 件追加するなら、どう書くか？** — `workbench.spec.ts` のシナリオを模倣すれば書ける
4. **PR で何を必ず見るか？** — チェックリスト 17 項目を 5-10 分で当てて、明確な提案コメントを書く

ここまで来れば、Playwright PR レビューは「**慣れの問題**」のフェーズ。
あとは実 PR をいくつかレビューして、自分のチェックリストを育てるだけ。

---

[← README に戻る](./README.md) ｜ [付録: チートシート](./cheatsheet.md)
