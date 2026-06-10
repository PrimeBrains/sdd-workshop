---
name: kiro-validate-impl
description: Validate feature-level integration after all tasks are implemented. Checks cross-task consistency, full test suite, and overall spec coverage.
allowed-tools: Read, Write, Bash, Grep, Glob, Agent
argument-hint: <feature-name> [task-numbers]
---

# kiro-validate-impl スキル

## 役割
個々のタスクは実装中にタスク単位のレビュアーによってレビュー済み。このスキルの仕事は、すべてのタスクを横断して見たときに初めて顕在化する問題を捕捉すること。

境界に関する用語の連続性:
- discovery は `Boundary Candidates` を特定する
- design は `Boundary Commitments` を確定する
- tasks は `_Boundary:_` で実行を制約する
- フィーチャーバリデーションはタスク横断の `Boundary Violations` をチェックする

## コアミッション
- **成功基準**:
  - tasks.md ですべてのタスクが `[x]` になっている
  - フルテストスイートが通る（タスク単位のテストだけでなく）
  - タスク横断の統合が機能する（コンポーネント間のデータフロー、インターフェースの整合）
  - すべてのタスクを通して要件カバレッジが完全である（タスク間に抜けがない）
  - 設計構造がエンドツーエンドで反映されている（コンポーネント単位だけでなく）
  - 孤立コード、競合する実装、統合の継ぎ目、境界の越境がない

## このスキルがやらないこと
タスク単位のチェックは `/kiro-impl` 中のレビュアーの責務。このスキルは以下を再チェック**しない**:
- 個別タスクの受け入れ基準
- ファイル単位のリアリティチェック（モック/スタブ検出）
- 単一タスクのスペック整合

このスキルの主たる問いは: 完了したタスクを総体として見たとき、設計で定めた境界の継ぎ目と依存方向を依然として守れているか？

## 実行ステップ

### Step 1: バリデーション対象の検出

**引数なしの場合**:
- 会話履歴から `/kiro-impl` コマンドをパースし、最近実装されたフィーチャーとタスクを検出する
- `.kiro/specs/` をスキャンし、完了タスク `[x]` を持つフィーチャーを探す
- 検出した実装を報告する（例: "user-auth: 1.1, 1.2, 1.3"）

**フィーチャーのみ指定の場合**（feature 指定、tasks 空）:
- 指定されたフィーチャーを使用する
- `.kiro/specs/{feature}/tasks.md` 内の完了タスク `[x]` をすべて検出する

**フィーチャーとタスク両方指定の場合**（明示モード）:
- 指定されたフィーチャーとタスクのみをバリデーションする（例: `user-auth 1.1,1.2`）

### Step 2: コンテキストの収集

ステアリング/スペックのコンテキストが会話から既に得られている場合、重複するファイル読み込みはスキップする。
そうでなければ、検出した各フィーチャーについて:
- `.kiro/specs/<feature>/spec.json` を読み、メタデータを取得
- `.kiro/specs/<feature>/requirements.md` を読み、要件を取得
- `.kiro/specs/<feature>/design.md` を読み、設計構造を取得
- `.kiro/specs/<feature>/tasks.md` を読み、タスク一覧と Implementation Notes を取得
- コアステアリングコンテキスト: `product.md`、`tech.md`、`structure.md`
- 追加のステアリングファイルは、バリデーション対象の境界、ランタイム前提条件、統合、ドメインルール、セキュリティ/パフォーマンス制約、GO/NO-GO 判定に影響するチーム規約に直接関連する場合のみ

**正規のバリデーションコマンドを特定する**:
- リポジトリ内の一次情報源を次の順で確認する: プロジェクトスクリプト/マニフェスト（`package.json`、`pyproject.toml`、`go.mod`、`Cargo.toml`、アプリマニフェスト）、タスクランナー（`Makefile`、`justfile`）、CI/ワークフローファイル、既存の e2e/統合テスト設定、最後に `README*`
- このリポジトリのフィーチャーレベルのバリデーションセットを導出する: `TEST_COMMANDS`、`BUILD_COMMANDS`、`SMOKE_COMMANDS`
- その場しのぎのシェルパイプラインより、リポジトリの自動化で既に使われているコマンドを優先する
- `SMOKE_COMMANDS` には、アプリの形態に応じた、信頼でき最も軽量なランタイム起動チェックを選ぶ（例: ルート URL のロード、Electron の起動、CLI の `--help`、サービスのヘルスエンドポイント、既存のモバイルシミュレータ/e2e ハーネス）
- 候補が複数ある場合は、実際にビルドされた成果物を動かしつつセットアップコストが最小のコマンドを優先する

### Step 3: 統合バリデーションの実行

#### サブエージェントディスパッチ（並列）

以下のバリデーション次元は独立しており、Agent ツールで**サブエージェント**としてディスパッチできる。フィーチャーのスコープに応じてエージェントが最適な分割を判断すること — 適宜サブエージェントを分割・統合・省略してよい。各サブエージェントは GO/NO-GO の統合判断のためにメインコンテキストを汚さないよう、**構造化された所見サマリー**を返す。

**典型的なバリデーション次元**（適宜調整）:
- **テスト実行**: 完全なテストスイートを実行し、合否を詳細とともに報告する
- **要件カバレッジ**: 要件 → 実装のマトリクスを構築し、抜けを報告する
- **設計整合**: アーキテクチャが design.md に一致するか検証し、乖離と依存違反を報告する
- **タスク横断統合**: データフロー、API コントラクト、共有状態の整合性を検証する

シンプルなフィーチャー（タスク数が少なくスコープが小さい）の場合は、サブエージェントを使わずメインコンテキストでチェックを実行する。

#### 機械的チェック（コマンドを実行し、結果を使う）

これらのチェックはフィーチャーレベルに適用する。コマンド出力を一次シグナルとして使用する。

**A. フルテストスイート**
- 特定した正規のフルテストコマンドを実行する。終了コードを使う。
- テストが失敗 → NO-GO。判断の余地なし。
- 正規のテストコマンドを特定できない場合 → `MANUAL_VERIFY_REQUIRED`

**B. 残存する TBD/TODO/FIXME**
- 実行: `grep -rn "TBD\|TODO\|FIXME\|HACK\|XXX" <files-in-feature-boundary>`
- このフィーチャーで持ち込まれたマッチがあれば → Warning としてフラグ

**C. 残存するハードコードされたシークレット**
- 実行: `grep -rn "password\s*=\|api_key\s*=\|secret\s*=\|token\s*=" <files-in-feature-boundary>`（大文字小文字を区別しない）
- 環境変数参照でないマッチがあれば → Critical としてフラグ

**D. ランタイム起動確認（スモークブート）**
- 特定した正規のスモークコマンドを実行し、ビルド成果物が実際に起動して最初の利用可能な状態に到達することを証明する。
- 該当する例: ヘッドレスブラウザでルート URL を開き起動時のコンソールエラーがゼロであることを要求する、Electron を起動してメインプロセスの ready シグナルと最初のレンダラーロードを待つ、CLI を `--help` で実行する、サービスを起動してヘルスエンドポイントを叩く。
- 起動時にランタイムクラッシュ、未処理例外、モジュールロード失敗、ネイティブ ABI 不一致、必須の env/config 欠如が発生 → NO-GO。
- 信頼できるスモークコマンドを特定できない、または必要なランタイム環境が利用不可の場合 → `MANUAL_VERIFY_REQUIRED`

#### 判断を要するチェック（コードを読み、スペックと比較する）

**E. タスク横断統合**
- タスク間でインターフェース、データモデル、API コントラクトを共有している箇所を特定する
- タスク A の出力フォーマットがタスク B の期待する入力に一致するか検証する
- タスク間で前提が矛盾していないかチェックする（命名規約、エラーコード、データ形状）
- 共有状態（データベーススキーマ、設定、環境）がタスク間で一貫しているか検証する
- 統合作業が、ある境界の振る舞いを別の境界へ漏らす形ではなく、意図された継ぎ目で行われているか検証する

**F. 要件カバレッジの抜け**
- すべての要件セクションを少なくとも 1 つの完了タスクにマッピングする
- どの単一タスクも完全にはカバーしていない要件（横断的要件）を特定する
- 複数タスクで部分的にカバーされているがどのタスクも完全にはカバーしていない要件を特定する
- `requirements.md` の元のセクション番号を使うこと。`REQ-*` のような別名を発明してはならない

**G. 設計のエンドツーエンド整合**
- 全体のコンポーネントグラフが design.md に一致するか検証する
- 統合パターン（イベントフロー、API 境界、依存性注入）が設計どおりに機能するかチェックする
- 依存方向が design.md のアーキテクチャに従っているか検証する（上方向の import がない）
- File Structure Plan が実際のファイルレイアウトに一致するか検証する
- 元の設計からのアーキテクチャ乖離を特定する
- `design.md` の元のセクション番号を使うこと

**G.5 境界監査**
- 完了した作業を設計の `Boundary Commitments`、`Out of Boundary`、`Allowed Dependencies`、`Revalidation Triggers` と比較する
- ある領域が別の境界の責務をひそかに引き受けてしまったタスク横断の越境を特定する
- 「統合を容易にするため」に上流へ埋め込まれた下流固有のワークアラウンドを特定する
- 設計で宣言されていない新たな隠れ依存や共有所有を特定する
- 再バリデーショントリガーが発火していた場合、影響を受ける隣接スペックや統合ポイントが実際に再チェックされたか検証する

**H. ブロック中のタスクと Implementation Notes**
- まだ `_Blocked:_` のままのタスクがないかチェックする — 理由を報告し、フィーチャー完全性への影響を評価する
- tasks.md の `## Implementation Notes` をレビューし、対応が必要な横断的知見を確認する

### Step 4: レポートの生成

`GO` を返す前に、フィーチャーレベルの主張に `kiro-verify-completion` プロトコルを適用する。テストだけでは不十分: フルスイート、ランタイム起動確認、カバレッジ、統合、設計整合、ブロック中タスクの状況をエビデンスに含めること。

是正策を書く前に、具体的な失敗を所有権で分類する:
- `LOCAL` — 欠陥がバリデーション対象のフィーチャーに属する場合
- `UPSTREAM` — 根本原因が依存先、基盤、共有プラットフォーム、または先行スペックに属する場合
- `UNCLEAR` — 利用可能なエビデンスから所有権を確定できない場合

所有権が `UPSTREAM` の場合、その問題をこのフィーチャーのローカルな是正に押し込めてはならない。所有元の上流スペックを名指しし、その上流の修正が反映された後にどの依存スペックを再バリデーションすべきかを説明する。

spec.json で指定された言語でサマリーを提供する:

```
## Validation Report
- DECISION: GO | NO-GO | MANUAL_VERIFY_REQUIRED
- MECHANICAL_RESULTS:
  - Tests: PASS | FAIL (command and exit code)
  - TBD/TODO grep: CLEAN | <count> matches
  - Secrets grep: CLEAN | <count> matches
  - Smoke boot: PASS | FAIL | MANUAL_REQUIRED
- INTEGRATION:
  - Cross-task contracts: <status>
  - Shared state consistency: <status>
  - Boundary audit: <status>
- COVERAGE:
  - Requirements mapped: <X/Y sections covered>
  - Coverage gaps: <list of uncovered requirement sections>
- DESIGN:
  - Architecture drift: <findings>
  - Dependency direction: <violations if any>
  - File Structure Plan vs actual: <match/mismatch>
- OWNERSHIP: LOCAL | UPSTREAM | UNCLEAR
- UPSTREAM_SPEC: <feature-name | N/A>
- BLOCKED_TASKS: <list and impact assessment>
- REMEDIATION: <if NO-GO: specific, actionable steps to fix each issue>
```

NO-GO の場合、REMEDIATION は必須 — 問題そのものと何を変えるべきかを正確に特定すること。曖昧なフィードバックは許容されない。

### Step 5: バリデーションレポートの永続化

Validation Report 全文を `.kiro/specs/{feature}/validation-impl.md` に書き込む（存在する場合は上書き。過去の実行結果は git 履歴に残る）。このファイルは GUI ツール（SDD Dashboard）が読み取るため、frontmatter のキーは以下のとおり厳密に維持すること:

```markdown
---
type: impl
feature: {feature}
date: YYYY-MM-DD
decision: GO | NO-GO | MANUAL_VERIFY_REQUIRED
---

# Implementation Validation: {feature}

[the complete Validation Report block from Step 4, unchanged]
```

本文には spec.json で指定された言語を使用する。NO-GO や MANUAL_VERIFY_REQUIRED を含むすべての判定でファイルを書き込むこと。

## 重要な制約
- **厳格な最終ゲート**: すべての統合チェックが通過した場合のみ `GO` を返す。具体的な失敗には `NO-GO` を、必須バリデーションを完了できなかった場合には `MANUAL_VERIFY_REQUIRED` を返す
- **利便性より境界の完全性**: テストが通っていても、境界をまたいで責務を塗り広げることでしか動かないフィーチャーに `GO` を返してはならない

## 安全性とフォールバック

### エラーシナリオ
- **実装が見つからない**: `[x]` のタスクが見つからない場合、"No implementations detected" と報告する
- **テストコマンド不明**: `MANUAL_VERIFY_REQUIRED` を返し、どのバリデーションコマンドが欠けているか説明する。`GO` を返してはならない
- **スペックファイルの欠落**: spec.json/requirements.md/design.md が欠けている場合はエラーで停止する

### 次のステップのガイダンス

**GO 判定の場合**:
- フィーチャーはエンドツーエンドで検証済みであり、デプロイまたは次のフィーチャーへ進める

**NO-GO 判定の場合**:
- REMEDIATION に列挙された問題に対処する
- 対象を絞った修正のために `/kiro-impl {feature} [tasks]` を再実行する
- `/kiro-validate-impl {feature}` で再バリデーションする

**MANUAL_VERIFY_REQUIRED の場合**:
- フィーチャーを完了扱いにしてはならない
- 欠けているバリデーションステップまたは環境の前提条件を正確に提示する
