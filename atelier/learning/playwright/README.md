# Playwright 速習コース — PR レビューができるようになるまで

## このコースのゴール

Playwright で書かれた e2e テストの **PR レビューができる状態**になる。具体的には次の 4 つが自力でできるレベル。

1. テストファイルを上から下まで読んで、何を検証しているか説明できる
2. ロケーター / アサーション / 待機の選び方が適切か判断できる
3. flaky / brittle な書き方を指摘し、修正案を提示できる
4. テスト失敗時に Trace Viewer で原因を追える

新規テストをゼロから書く力は本コースのスコープ外（Chapter 4 で構造化の判断はできるようになる）。

## 想定読者と前提

- フロントエンド経験あり（React / TypeScript の前提知識は省略）
- このリポジトリの `evm-studio/` を手元で動かせる
- Playwright は今回が初めて、または公式 Getting Started を眺めた程度

## 教材方針

- **このリポの実コードを読む**。Playwright 公式チュートリアルの toy example ではなく `evm-studio/e2e/` の 905 行を教材にする
- **手を動かす**。各章に「読む → 改造して壊す → 直す」の演習がある
- **コード抜粋は最小限**。本文中は `workbench.spec.ts:140-156` のように行番号で誘導し、IDE で開いて読む

## 章構成（合計 4-6 時間目安）

| 章 | テーマ | 所要 | 主に読むファイル |
|----|--------|------|------------------|
| [01](./01-setup-and-run.md) | セットアップを読み解き、テストを走らせる | 60-90 分 | `playwright.config.ts`, `smoke.spec.ts` |
| [02](./02-locators.md) | ロケーターの哲学 | 60-90 分 | `workbench.spec.ts` |
| [03](./03-waiting-assertions.md) | 待機とアサーション（flakiness 退治） | 60-90 分 | `workbench.spec.ts`, `import.spec.ts` |
| [04](./04-structure-fixtures.md) | テスト構造・フィクスチャ・ヘルパー | 60-90 分 | `workbench.spec.ts`, `import.spec.ts` |
| [05](./05-review-checklist.md) | PR レビュー実演 | 45-60 分 | 過去 commit + 卒業課題 |
| 付録 | [チートシート](./cheatsheet.md) | — | レビュー時に開く |

## 進め方

1. 順番にやる。Chapter 2-4 は独立に見えるが、演習が前章の理解を前提にしている
2. 各章末の「自己診断 3 問」に答えてから次へ進む
3. 演習で書き換えたコードは **commit しない**。`git restore` で戻すか、stash しておく
4. 詰まったら章末の公式ドキュメントリンクへ

## 環境準備

```bash
cd evm-studio
npm install
npm --prefix client install
npm --prefix server install
npx playwright install chromium    # 初回のみ
```

動作確認：

```bash
cd evm-studio
npm run seed          # シードデータ投入（バックエンド DB）
npm start             # クライアント(5173) + サーバ(3001) を同時起動
# 別ターミナルで
npm run test:e2e      # 38 テスト全 GREEN になれば準備 OK
```

`npm start` をしなくても `webServer` 設定で自動起動するが、初回はサーバが先に立ち上がっているほうがトラブル切り分けが楽。

## 用語のごく短い整理

- **spec**：1 つのテストファイル。本リポでは `*.spec.ts`
- **test**：`test(name, fn)` で囲んだ 1 ケース
- **locator**：「この要素」を指す参照。`page.getByRole('button')` 等
- **assertion**：期待状態の検証。`expect(...).toBeVisible()` 等
- **fixture**：テストに注入される依存（本リポは標準の `page` / `request` を使用）

それ以外の用語はその章で説明する。

---

準備ができたら → [Chapter 1: セットアップを読み解き、テストを走らせる](./01-setup-and-run.md)
