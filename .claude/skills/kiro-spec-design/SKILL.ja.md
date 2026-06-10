---
name: kiro-spec-design
description: Generate comprehensive technical design translating requirements (WHAT) into architecture (HOW) with discovery process. Use when creating architecture from requirements.
allowed-tools: Read, Write, Edit, Grep, Glob, WebSearch, WebFetch, Agent
argument-hint: <feature-name> [-y]
metadata:
  shared-rules: "design-principles.md, design-discovery-full.md, design-discovery-light.md, design-synthesis.md, design-review-gate.md"
---

# kiro-spec-design スキル

## コアミッション
- **成功基準**:
  - すべての要件が、明確なインターフェースを持つ技術コンポーネントへマッピングされている
  - タスク生成とレビューを導くのに十分なほど、設計が責務境界を明示している
  - 適切なアーキテクチャディスカバリーとリサーチが完了している
  - 設計がステアリングコンテキストと既存パターンに整合している
  - 複雑なアーキテクチャには視覚的な図が含まれている

## 実行ステップ

### ステップ 1: コンテキストの収集

ステアリング/スペックのコンテキストが会話から既に得られている場合、重複するファイル読み込みはスキップする。
そうでなければ、必要なコンテキストをすべて読み込む:
- `.kiro/specs/{feature}/spec.json`、`requirements.md`、`design.md`（存在する場合）
- `.kiro/specs/{feature}/research.md`（存在する場合。`/kiro-validate-gap` によるギャップ分析を含む）
- コアステアリングコンテキスト: `product.md`、`tech.md`、`structure.md`、`trace-notation.md`（トレーサビリティ注記のための参照リスト文法）
- 追加のステアリングファイルは、要件カバレッジ、アーキテクチャ境界、統合、ランタイム前提、セキュリティ/パフォーマンス制約、実装の準備性に影響するチーム規約に直接関連する場合のみ読み込む
- `.kiro/settings/templates/specs/design.md` を読み、ドキュメント構造を取得
- このスキルのディレクトリにある `rules/design-principles.md` を読み、設計原則を取得
- `.kiro/settings/templates/specs/research.md` を読み、ディスカバリーログの構造を取得

**要件承認の検証**:
- 自動承認フラグが true の場合: spec.json で要件を自動承認
- それ以外: 承認ステータスを検証（未承認なら停止。「安全策とフォールバック」参照）

### ステップ 2: ディスカバリーと分析

**重要: このフェーズは、設計が完全かつ正確な情報に基づくことを保証する。**

1. **フィーチャータイプの分類**:
   - **新規フィーチャー**（グリーンフィールド）→ フルディスカバリーが必要
   - **拡張**（既存システム）→ 統合にフォーカスしたディスカバリー
   - **シンプルな追加**（CRUD/UI）→ ディスカバリーは最小限または不要
   - **複雑な統合** → 包括的な分析が必要

2. **適切なディスカバリープロセスの実行**:

   **複雑/新規フィーチャーの場合**:
   - このスキルのディレクトリにある `rules/design-discovery-full.md` を読み、実行する
   - WebSearch/WebFetch を使って徹底的にリサーチ:
     - 最新のアーキテクチャパターンとベストプラクティス
     - 外部依存の検証（API、ライブラリ、バージョン、互換性）
     - 公式ドキュメント、移行ガイド、既知の問題
     - パフォーマンスベンチマークとセキュリティ考慮事項

   **拡張の場合**:
   - このスキルのディレクトリにある `rules/design-discovery-light.md` を読み、実行する
   - 統合ポイント、既存パターン、互換性にフォーカス
   - Grep を使って既存コードベースのパターンを分析

   **シンプルな追加の場合**:
   - 正式なディスカバリーはスキップし、簡易なパターン確認のみ

#### 並列リサーチ（サブエージェント派遣）

以下のリサーチ領域は独立しており、Agent ツールを介して**サブエージェント**として派遣できる。エージェントはフィーチャーの複雑さに基づいて最適な分割を判断する — 必要に応じてサブエージェントを分割・統合・追加・省略する。各サブエージェントは（生データではなく）**調査結果サマリー**を返し、統合のためのメインコンテキストをクリーンに保つ。

**典型的なリサーチ領域**（適宜調整）:
- **コードベース分析**: 既存のアーキテクチャパターン、統合ポイント、コード規約（Grep/Glob を使用）
- **外部リサーチ**: 依存関係、API、最新のベストプラクティス（WebSearch/WebFetch を使用）
- **コンテキスト読み込み**（通常はメインコンテキスト）: ステアリングファイル、設計原則、ディスカバリールール、テンプレート

シンプルな追加では、サブエージェント派遣を完全にスキップし、メインコンテキストで簡易なパターン確認を行う。

すべての調査結果が返ってきた後、先に進む前にメインコンテキストで統合する。

3. **ステップ 3 のためにディスカバリー結果を保持**:
   - 外部 API の契約と制約
   - 根拠を伴う技術選定
   - 従う、または拡張すべき既存パターン
   - 統合ポイントと依存関係
   - 特定したリスクと緩和策
   - バウンダリ候補、バウンダリ外の決定、再検証トリガーになりそうなもの

4. **調査結果をリサーチログに永続化**:
   - 共有テンプレートを使って `.kiro/specs/{feature}/research.md` を作成または更新
   - ディスカバリーの範囲と主要な発見を要約
   - 出典と含意を添えて調査内容を記録
   - アーキテクチャパターンの評価、設計判断、リスクを文書化
   - `research.md` の作成・更新時は spec.json で指定された言語を使用

### ステップ 3: 統合（シンセシス）

**書き始める前に、ディスカバリー結果へ設計シンセシスを適用する。**

- このスキルのディレクトリにある `rules/design-synthesis.md` を読み、適用する
- このステップにはディスカバリー結果の全体像が必要 — サブエージェントではなくメインコンテキストで実行する
- シンセシスの成果（見つけた一般化、build-vs-adopt の判断、簡素化）を `research.md` に記録する

### ステップ 4: 設計ドラフトの生成

1. **設計ドラフトの生成**:
   - **specs/design.md テンプレートの構造と生成指示に厳密に従う**
   - **バウンダリ・ファーストの要件**: 補助セクションを展開する前に、バウンダリを明示する。このスペックが何を所有し、何を所有しないか、どの依存が許可されるか、どんな変更が downstream の再検証を必要とするかを、ドラフトで明確に定義しなければならない
   - **すべてのディスカバリー結果とシンセシス成果を統合する**: 調査した情報（API、パターン、技術）とシンセシスの判断（一般化、build-vs-adopt、簡素化）を、コンポーネント定義、アーキテクチャ判断、統合ポイントの全体で活用する
   - **File Structure Plan**（必須）: File Structure Plan セクションに具体的なファイルパスと責務を記入する。コードベースを分析して、新規作成すべきファイルと変更すべきファイルを判別する。各ファイルは 1 つの明確な責務を持たなければならない。このセクションはタスクの `_Boundary:_` 注記と実装 Task Brief を直接駆動する — 曖昧なファイル構造は曖昧な実装を生む
   - **Testing Strategy**: テスト項目は汎用パターンではなく、要件の受け入れ基準から導出する。各テスト項目は本設計の特定のコンポーネントと振る舞いを参照すること。E2E パスは要件で特定したクリティカルなユーザーフローにマッピングすること。"test login works" のような曖昧な項目は避け、何を検証するのか、なぜ重要なのかを明記する
   - ステップ 1 で既存の design.md が見つかった場合、参照コンテキストとして使用（マージモード）
   - 設計ルールを適用: Type Safety、Visual Communication、Formal Tone
   - spec.json で指定された言語を使用
   - レビューゲートを通過するまではドラフトのままにする。この時点で `design.md` を書き込まない

### ステップ 5: 設計ドラフトのレビュー

- このスキルのディレクトリにある `rules/design-review-gate.md` を読み、適用する
- 設計を確定する前に、要件カバレッジ、アーキテクチャの準備性、実装の実行可能性を検証する
- 問題がドラフト内に閉じている場合、設計を修復して再レビュー
- レビューは最大 2 回の修復パスまでに制限する
- ドラフトが本物の要件/設計ギャップを露呈した場合、`design.md` で取り繕わずに停止し、要件の明確化へ戻る

### ステップ 6: 設計ドキュメントの確定

1. **最終設計の書き込み**:
   - 設計レビューゲートを通過した後にのみ `.kiro/specs/{feature}/design.md` を書き込む
   - ディスカバリー結果とシンセシス成果を含む research.md を書き込む（未作成の場合）

2. spec.json の**メタデータ更新**:

   - `phase: "design-generated"` を設定
   - `approvals.design.generated: true, approved: false` を設定
   - `approvals.requirements.approved: true` を設定
   - `updated_at` タイムスタンプを更新

## クリティカルな制約
 - **Type Safety**:
   - プロジェクトの技術スタックに合わせた強い型付けを徹底する
   - 静的型付け言語では、明示的な型/インターフェースを定義し、安全でないキャストを避ける
   - TypeScript では `any` を使用しない。正確な型とジェネリクスを優先する
   - 動的型付け言語では、利用可能な型ヒント/アノテーション（例: Python の型ヒント）を付与し、境界で入力を検証する
   - コンポーネント横断の型安全性を確保するため、公開インターフェースと契約を明確に文書化する
- **要件トレーサビリティ ID**: requirements.md で定義されたとおりの数値要件 ID のみを使用する（例: "1.1"、"1.2"、"3.1"、"3.3"）。新しい ID を発明したり英字ラベルを使用したりしない
- **参照リスト文法**（`.kiro/steering/trace-notation.md` 準拠）: 要件 ID を列挙するすべての箇所（Requirements Traceability テーブル、コンポーネントの `Requirements` フィールド、`Req Coverage` カラム）で、カバーする ID をカンマ区切りで個別に全列挙する（例: `1.1, 1.3, 1.4, 1.5`）。ID リスト内で範囲表記（`1.3-1.5`）、ワイルドカード（`15.*`）、括弧、自由記述の注記を使わない — 範囲表記は中間 ID の生テキスト grep を不可能にする。説明は Summary カラムまたは本文に書く。`## Requirements Traceability` セクションは必須で、すべての要件 ID をカバーしなければならない

## 出力の説明

**コマンド実行時の出力**（design.md の内容とは別物）:

spec.json で指定された言語で簡潔なサマリーを提供する:

1. **ステータス**: `.kiro/specs/{feature}/design.md` に設計ドキュメントを生成したことを確認
2. **ディスカバリータイプ**: 実行したディスカバリープロセス（full/light/minimal）
3. **主要な発見**: 設計を形づくったディスカバリーからの重要な洞察 2-3 点
4. **レビューゲート**: 設計レビューゲートの通過を確認
5. **次のアクション**: 承認ワークフローの案内（「安全策とフォールバック」参照）
6. **リサーチログ**: 最新の判断で `research.md` を更新したことを確認

**フォーマット**: 簡潔な Markdown（200 語以内）— これはコマンド出力であり、設計ドキュメント本体ではない

**注**: 実際の設計ドキュメントは `.kiro/settings/templates/specs/design.md` の構造に従う。

## 安全策とフォールバック

### エラーシナリオ

**要件が未承認**:
- **実行停止**: 承認済みの要件なしには進められない
- **ユーザーメッセージ**: "Requirements not yet approved. Approval required before design generation."
- **推奨アクション**: "Run `/kiro-spec-design {feature} -y` to auto-approve requirements and proceed"

**要件の欠落**:
- **実行停止**: 要件ドキュメントが存在しなければならない
- **ユーザーメッセージ**: "No requirements.md found at `.kiro/specs/{feature}/requirements.md`"
- **推奨アクション**: "Run `/kiro-spec-requirements {feature}` to generate requirements first"

**テンプレート欠落**:
- **ユーザーメッセージ**: "Template file missing at `.kiro/settings/templates/specs/design.md`"
- **推奨アクション**: "Check repository setup or restore template file"
- **フォールバック**: 警告を出してインラインの基本構造を使用

**ステアリングコンテキスト欠落**:
- **警告**: "Steering directory empty or missing - design may not align with project standards"
- **続行**: 生成は継続するが、出力でその制約に言及する

**不正な要件 ID**:
  - **実行停止**: requirements.md に数値 ID がない、または数値でない見出し（例: "Requirement A"）が使われている場合、停止して requirements.md の修正をユーザーに指示する

**設計レビュー中にスペックギャップを発見**:
- **実行停止**: 取り繕った `design.md` を書き込まない
- **ユーザーメッセージ**: "Design review found a real spec gap or ambiguity that must be resolved before design can be finalized."
- **推奨アクション**: `requirements.md` を明確化または修正し、`/kiro-spec-design {feature}` を再実行

### 次のフェーズ: タスク生成

**設計が承認された場合**:
- **任意**: `/kiro-validate-design {feature}` でインタラクティブな品質レビューを実行
- `/kiro-spec-tasks {feature}` を実行して実装タスクを生成
- または `/kiro-spec-tasks {feature} -y` で自動承認して直接進む

**修正が必要な場合**:
- フィードバックを提供し、`/kiro-spec-design {feature}` を再実行
- 既存の設計は参照として使用（マージモード）
