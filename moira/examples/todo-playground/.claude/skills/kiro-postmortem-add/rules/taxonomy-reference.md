# Taxonomy Reference

> **Source of truth for 4 axes**.
> `kiro-postmortem-add` skill reads this file for label suggestion during entry creation.
> `kiro-postmortem-review` skill references this file (via path) for valid-label validation.
>
> **Important**: When any taxonomy label is added, removed, or renamed, the following 3 files MUST be updated in the same operation:
> - `.claude/skills/kiro-postmortem-add/rules/taxonomy-reference.md` (this file)
> - `.kiro/postmortem/defects.md` header (taxonomy definition tables in the ledger)
> - `.kiro/specs/defect-pdca/requirements.md` (R3 / R4 / R13 / R14)
>
> 4 軸合計 36 ラベル + (What × Why) Quick Reference Map を以下に定義する。

---

## R3: 要因分類タクソノミー (成果物軸 / What)

「欠陥が宿る成果物」を分類する。検証層 (review / test) のすり抜けはここでは扱わず、R4 で表現する。

| Label | 定義 (判定基準) | 該当例 |
|---|---|---|
| `requirements-error` | 要件文書 (`requirements.md`) 自体に誤り・抜け・矛盾・実装詳細の混入があり、その質に起因する。仕様の表現を直さない限り再発する。 | 旧 dashboard Req 4.7 が `(n / 1_000_000)` を仕様レベルで埋め込んでいた |
| `design-error` | 設計判断 (`design.md`) が誤っていた / 抜けていた / 整合していない。要件は正しいが設計でブレた。 | コンポーネント境界が曖昧で複数 spec が同じ責務を持つ |
| `impl-error` | 要件・設計通りでなく、コード実装そのものが誤っている。仕様レビューでは捕まらず、コード本体の修正で解消する。 | `fmtMD` が仕様外に 1_000_000 で割算するコード / `±0.0 MD` ハードコード |
| `env-config` | 環境設定 / 構成 (DB パス / 環境変数 / ファイル配置 / Node バージョン) の不整合で発生。コードはどの環境でも妥当でも、構成のズレで壊れる。 | seed と server runtime で DB パスが分裂していた |
| `data-state-dep` | テスト間 / 環境間で状態 (DB レコード / キャッシュ / ファイル) が想定外に残存・変動して引き起こされる。 | 前テストの保存値が次テストで disabled ボタンを生む |
| `tooling-fragility` | ライブラリ / ツールの仕様や挙動 (Playwright `text=` の substring match、SQLite `AUTOINCREMENT` 等) に依存した脆さ。ツールの正常動作の中で発生する。 | `getByText('EV')` が "EVM STUDIO" にも合致してしまった |
| `external-dependency` | 外部サービス・パッケージの破壊的変更・バージョン非互換・障害に起因する。プロジェクト内のコードや構成は変えていないのに壊れる。 | better-sqlite3 が Node v21 で `util.styleText` 非互換 |
| `other` | 上記いずれにも明確に分類できない。レビュー段階で分類可能であれば原則 `other` は避ける。 | (該当時に記録) |

---

## R4: 検知工程タクソノミー (検証層 / Where)

「どの検証層で気付けたはず・気付いたか」を表現する。V モデルに従い、実装ミスは単体テスト・設計ミスは結合テスト・要件ミスは E2E (受入相当) で検知されるべきという原則を反映。要件作成・設計・実装の成果物作成工程は含めない。

| Label | 定義 (検証層の責務) | 主に検知すべき成果物の誤り | 該当例 |
|---|---|---|---|
| `code-review` | PR コードレビュー (人間による静的検証)。コード差分の妥当性・命名・定数値・分岐網羅・暗黙の前提・hard-coded constants の検知層。 | 自動テストで意図を表現しにくい意匠的事項 (命名・hardcoded constant・コメント) | `value="±0.0 MD"` のハードコードは code-review で指摘可能 |
| `unit-test` | 関数・モジュール単体テスト (Vitest 等)。純粋関数の入出力契約・境界例・例外パスを保証する層。 | **実装ミス** (`impl-error`) | `fmtMD(70) === '70.0 MD'` のアサートで単位スケール混入を検知 |
| `integration-test` | 複数モジュール統合テスト。単体では通るが結合で壊れる挙動・コンポーネント境界の契約検証・サーバ + DB / クライアント + tRPC の連携検証。 | **設計ミス** (`design-error`) / 環境境界の不整合 (`env-config` の一部) | seed → server runtime の DB パス整合は integration-test で検知可能 |
| `e2e` | ブラウザ / アプリ全体を通したエンドツーエンドテスト (Playwright 等)。ユーザー操作経路を再現して初めて出る欠陥・要件レベルの不変則 (受入テスト相当)。 | **要件ミス** (`requirements-error`) / 表示と API の整合性 | 全体 EVM が "0.0 MD" と表示される要件違反は e2e で検知すべき |
| `manual-verification` | リリース前の手動回帰確認・スモークテスト・QA 目視・ステークホルダーデモ。自動化されていないがリリースゲートとして実施する検証層。 | 視覚的・体感的・ドメイン感性的な検証 | レイアウト崩れ・タイポ・色味 |
| `production` | 本番運用中の検知 (デプロイ後・実利用中)。ユーザー報告含まず、運用監視・ログ・アラート・メトリクスから検知。 | 性能劣化・想定外データパス・低頻度エッジケース | エラーレート急上昇でアラート発火 |
| `user-report` | ユーザーから報告されて初めて発覚。すべての内製検証ゲートを通過してしまった最後の砦。 | (検知層としてはすべての層をすり抜けた状態) | "プロジェクト全体 EVM が 0 と表示される" の最初の指摘 |

### Verification Gap の解釈ルール (R4.5)

- `検知した工程` と `検知すべき工程` のギャップは「すり抜けた検証層」と解釈する
- 例: `検知した工程 = user-report` かつ `検知すべき工程 = code-review` は「コードレビュー層がすり抜けた」を意味する
- 例: `検知すべき工程 = unit-test` の場合はユニットテストの欠落または不十分なアサートを示す
- 要因分類タクソノミー (R3) には `review-miss` や `test-gap` のような検証層ラベルを置かない。これらの概念は本ギャップで表現する

---

## R13: 発生機能タクソノミー (Spec 軸)

「どの機能で発生した不具合か」を分類する。機能 spec 名と一致するラベルは spec の責務境界をそのまま継承する。横断レイヤ (`seed` / `e2e` / `formatters` / `tooling`) は単一 spec に閉じない共通基盤として独立ラベルを持つ。

| Label | 定義 (どこで発生したか) | 該当例 |
|---|---|---|
| `core-data-model` | `.kiro/specs/core-data-model/` 配下が責務。SQLite スキーマ・WBS YAML インポート・seed の対象範囲。 | seed.ts の DB パス分裂 |
| `evm-engine` | `.kiro/specs/evm-engine/` 配下。EVM 計算純粋関数・tRPC `evm.calculate` ルーター・前日比差分計算。 | (該当時に記録) |
| `progress-tracking` | `.kiro/specs/progress-tracking/` 配下。日次進捗スナップショット・`progress.*` API・`ProgressInputPanel`。 | (該当時に記録) |
| `dashboard` | `.kiro/specs/dashboard/` 配下。`WorkbenchPage` 単一ページ・shell / summary / gantt / charts / inspector / atoms コンポーネント群・モーダル系・トークン。 | `fmtMD` 単位スケール混入、Inspector の `±0.0 MD` ハードコード |
| `defect-pdca` | `.kiro/specs/defect-pdca/` 配下。本スペック自身に起因する不具合。 | (該当時に記録) |
| `sdd-core` | `.kiro/specs/sdd-core/` 配下 (sdd-dashboard アプリ)。読取/書込 API・Markdown/spec パーサー・トレースグラフ等のバックエンドと共通契約 (`server/src/types/`)。 | `parseDesign` が情報無欠落不変則を満たさず design 本文を破棄 |
| `sdd-review-ui` | `.kiro/specs/sdd-review-ui/` 配下 (sdd-dashboard アプリ)。spec 閲覧 UI (requirements/design/tasks ビューア・比較・トレーサビリティマトリクス・検証レポート)。 | DesignView が見出しのみ描画 / TasksView の amber 帯 |
| `sdd-workflow-ui` | `.kiro/specs/sdd-workflow-ui/` 配下 (sdd-dashboard アプリ)。board・承認/手戻りワークフロー UI。 | (該当時に記録) |
| `seed` | DB シード関連 (`server/seeds/`)。タクソノミーとして spec 縦割りでなく seed 自体を横断レイヤとして扱う。 | seed.ts の `sqlite_sequence` 累積 |
| `e2e` | エンドツーエンドテスト (`evm-studio/e2e/`)。Playwright のテストファイル・config・fixtures。 | Playwright `text=` セレクター脆弱性 |
| `formatters` | 表示フォーマッタ純関数 (`client/src/lib/formatters.ts` 等)。dashboard 内のサブモジュールだが、単位契約が独立に重要なので個別ラベル。 | `fmtMD` 単位スケール (細粒度) |
| `tooling` | 開発ツールチェーン (Vite / Vitest / Playwright / tsx / Node version / TypeScript config 等)。プロジェクトコード自体ではなくビルド・テスト基盤の不具合。 | Node v21 と Vitest 4.x の非互換 |
| `other` | 上記いずれにも該当しないか、未定義の新領域。 | (該当時に記録) |

### サブスコープ表記

各エントリの `発生機能` フィールドは、上記タクソノミーから 1 ラベルを参照し、任意で `/` 区切りの自由テキスト sub-scope を続けてよい:
- `dashboard / SummaryStrip`
- `core-data-model / seed`
- `e2e / workbench.spec.ts`

### 新 spec 追加時の拡張 (R13.5)

新機能 spec が `.kiro/specs/` に追加された場合、本タクソノミーに新 spec 名を含めるよう拡張する。本拡張は新 spec に関連する次回の `/kiro-postmortem-add` 起動時に観測されるものであり、強制的な自動更新ではない。

---

## R14: 根本要因分類タクソノミー (Why 軸 / Mechanism of Failure)

「なぜそのミスが起きたか」のメカニズムを分類する。要因分類 (What 軸 / R3) と組み合わせて記述する。両軸は直交し、(要因分類 × 根本要因分類) のいかなる組み合わせも有効。

| Label | 定義 (発生メカニズム) | 該当例 |
|---|---|---|
| `assumption-error` | 「自明」「不要」「変わらない」などの前提誤認・暗黙仮定が外れた結果。検証せず判断を省略した。 | `fmtMD` のテストを「自明な変換」として省略した |
| `knowledge-gap` | 仕様 / ライブラリ / フレームワーク / ドメインへの理解不足が直接の原因。学べば防げる。 | better-sqlite3 transaction 内の `sqlite_sequence` の DML が反映されないという仕様を知らなかった |
| `context-loss` | 周辺情報・過去の決定・関連箇所を見落とした (知ろうとすれば知れたが、視野に入れなかった)。 | seed.ts の DB パスと server runtime のパスが別ファイルを見ている事実を見落とした |
| `verification-gap` | そもそも検証手段 (テスト / 自動チェック / レビュー観点) を整備していなかった結果、ミスが通過した。 | UI 表示値が API 値と一致するかをアサートする e2e がなかった |
| `pattern-misapplication` | 別ドメイン / 別文脈で正しいパターンを、現文脈に誤って流用した。 | バイト→MB のような 1_000_000 スケール変換を Man-Day 単位に当てはめた |
| `spec-impl-mismatch` | 仕様文と実装意図がズレている (仕様も実装も独立には妥当だが、互いを参照したときに食い違う)。 | 要件文に実装詳細を埋め込んで仕様と実装が二重管理になった |
| `tooling-trap` | ツール / ライブラリの既知の落とし穴・直感に反する仕様にハマる。ドキュメントを読めば防げるが直感では避けにくい。 | Playwright `text=` セレクターが case-insensitive substring match である |
| `state-management-gap` | テスト間 / セッション間 / 環境間で状態が残存・変動するパターンを設計時に想定していなかった。 | e2e フルランで前テストの保存値が次テストの初期条件を変える |
| `boundary-violation` | spec / モジュール / レイヤの責務境界を越えた変更を行った結果、別領域に副作用が出る。 | (該当時に記録) |
| `process-skip` | 必要なレビュー / テスト / 検証 / 段階確認の工程を省略した判断 (時間制約 / 楽観バイアス)。 | 9.5 後の data-testid 変更で全 e2e を流さず PR を進めた |
| `other` | 上記いずれにも明確に分類できないメカニズム。 | (該当時に記録) |

---

## (What × Why) Quick Reference Map

要因分類 (R3) と根本要因分類 (R14) の **よく合わさる組み合わせ** + 検知すべき検証層 (R4) の早見表。本表は厳格な制約ではなく、`/kiro-postmortem-add` のドラフト提案時の補助。

| 要因分類 (What) | よく合わさる 根本要因分類 (Why) | 検知すべき検証層 (R4) |
|---|---|---|
| `impl-error` | `assumption-error` / `pattern-misapplication` / `process-skip` | `unit-test` (実装ミスは単体テストで) |
| `design-error` | `knowledge-gap` / `context-loss` / `boundary-violation` | `integration-test` (設計ミスは結合テストで) |
| `requirements-error` | `spec-impl-mismatch` / `assumption-error` | `e2e` (要件ミスは受入テスト / E2E で) |
| `env-config` | `context-loss` / `state-management-gap` | `integration-test` (環境境界の不整合) |
| `data-state-dep` | `state-management-gap` | `integration-test` / `e2e` |
| `tooling-fragility` | `tooling-trap` / `knowledge-gap` | `e2e` (ツールの落とし穴は実動作で) |
| `external-dependency` | `knowledge-gap` / `tooling-trap` | `integration-test` / `e2e` |

例: 今セッションの 3 件 seed は以下の組み合わせに該当:

| Entry | 要因分類 | 根本要因分類 | 検知すべき検証層 |
|---|---|---|---|
| #0001 fmtMD 単位混入 | `impl-error` | `assumption-error` | `unit-test` |
| #0002 seed DB パス分裂 | `env-config` | `context-loss` | `integration-test` |
| #0003 Playwright セレクター | `tooling-fragility` | `tooling-trap` | `e2e` |
