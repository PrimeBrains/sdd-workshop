---
name: kiro-spec-tasks
description: Generate implementation tasks from requirements and design. Use when creating actionable task lists.
allowed-tools: Read, Write, Edit, Glob, Grep, Agent
argument-hint: <feature-name> [-y] [--sequential]
metadata:
  origin: "cc-sdd"
  shared-rules: "tasks-generation.md, tasks-parallel-analysis.md"
---

# kiro-spec-tasks スキル

## コアミッション
- **成功基準**:
  - すべての要件が具体的なタスクにマッピングされている
  - タスクが適切なサイズになっている（各 1-3 時間）
  - 適切な階層を持つ明確なタスク進行
  - ケイパビリティにフォーカスした自然言語の記述
  - `tasks.md` を書き込む前に、軽量なタスク計画サニティレビューでタスクグラフが実行可能であることを確認

## 実行ステップ

### ステップ 1: コンテキストの収集

ステアリング/スペックのコンテキストが会話から既に得られている場合、重複するファイル読み込みはスキップする。
そうでなければ、必要なコンテキストをすべて読み込む:
- `.kiro/specs/{feature}/spec.json`、`requirements.md`、`design.md`
- `.kiro/specs/{feature}/tasks.md`（存在する場合、マージモード用）
- コアステアリングコンテキスト: `product.md`、`tech.md`、`structure.md`
- 追加のステアリングファイルは、要件カバレッジ、設計バウンダリ、ランタイム前提、タスクの実行可能性に影響するチーム規約に直接関連する場合のみ読み込む

- 実行モードの決定:
  - `sequential = (sequential flag is true)`

**承認の検証**:
- 自動承認フラグ（`-y`）が true の場合: spec.json で要件と設計を自動承認。タスクの承認もステップ 4 で自動的に処理される
- それ以外: 両方が承認済みであることを検証（未承認なら停止。「安全策とフォールバック」参照）

### ステップ 2: 実装タスクの生成

- このスキルのディレクトリにある `rules/tasks-generation.md` を読み、原則を取得
- このスキルのディレクトリにある `rules/tasks-parallel-analysis.md` を読み、並列判定の基準を取得
- `.kiro/settings/templates/specs/tasks.md` を読み、フォーマットを取得（`(P)` マーカーをサポート）

#### 並列リサーチ

以下のリサーチ領域は独立しており、並列に実行できる:
1. **コンテキスト読み込み**: スペックドキュメント（requirements.md、design.md）、ステアリングファイル
2. **ルール読み込み**: tasks-generation.md、tasks-parallel-analysis.md、tasks テンプレート

すべての並列リサーチ完了後、タスク生成の前に調査結果を統合する。

**すべてのルールに従ってタスクリストを生成**:
- spec.json で指定された言語を使用
- すべての要件をタスクへマッピングし、数値要件 ID のみを（カンマ区切りで）列挙する。説明的なサフィックス、括弧、翻訳、自由記述のラベルは付けない。`.kiro/steering/trace-notation.md` の参照リスト文法に従う: カバーする ID を個別に全列挙する（例: `1.1, 1.3, 1.4, 1.5`）。`1.3-1.5` のような範囲表記と `15.*` のようなワイルドカードは禁止
- すべての設計コンポーネントが含まれていることを確認
- タスク進行が論理的かつ漸進的であることを検証
- 実行可能な各サブタスクに、「完了」が観測可能な形でどう見えるかを述べる詳細箇条書きを少なくとも 1 つ含める
- 通常の実装タスクは単一の責務境界内に収める。作業が境界をまたぐ場合は明示的な統合タスクにする
- `!sequential` の場合、並列基準を満たすタスクに `(P)` マーカーを適用
- 並列に見えるが安全でないタスクには、`(P)` を妨げる依存関係を明示的に記す
- sequential モードが true の場合、`(P)` を完全に省略する
- 既存の tasks.md が見つかった場合、新しい内容とマージする

### ステップ 3: タスク計画のレビュー

- ドラフトのタスク計画は作業メモリに保持する。この時点で `tasks.md` を書き込まない
- `rules/tasks-generation.md` の `Task Plan Review Gate` を実行
- カバレッジのレビュー:
  - すべての要件 ID が少なくとも 1 つのタスクに登場する
  - すべての設計コンポーネント、契約、統合ポイント、ランタイム前提、検証上の関心事が表現されている
- 実行可能性のレビュー:
  - 各サブタスクが実行可能な 1-3 時間の作業単位である
  - 各サブタスクが検証可能な成果物を持つ
  - 実行可能な各サブタスクが観測可能な完了の箇条書きを含む
  - 暗黙の前提条件が隠れたまま残っていない
  - `_Depends:_`、`_Boundary:_`、`(P)` マーカーが依存グラフとアーキテクチャ境界に依然として一致している
- 問題がタスク計画内に閉じている場合、ドラフトを修復し、書き込む前にレビューゲートを再実行
- レビューは最大 2 回の修復パスまでに制限する
- レビューが本物の要件/設計のギャップや矛盾を露呈した場合、埋め草タスクを発明せずに停止し、ユーザーを要件/設計へ差し戻す

### ステップ 3.5: タスクグラフ・サニティレビューの実行

`tasks.md` を書き込む前に、タスクグラフの軽量な独立サニティレビューを 1 回実行する。

- フレッシュなサブエージェント派遣が可能なら、このステップ用にレビュー専用サブエージェントを 1 つ起動する。不可能なら現在のコンテキストで同じレビューを行う
- 提供するのはファイルパス、ドラフトのタスク計画、既存の `tasks.md` を更新する場合のマージコンテキストのみ。レビュアーは親が統合したカバレッジサマリーに頼らず、`requirements.md`、`design.md`、タスク生成ルールを直接読むこと
- チェック対象は以下のみ:
  - 隠れた前提条件、または欠落しているセットアップタスク
  - 依存関係や順序の誤り
  - タスク間のバウンダリの重複や所有の曖昧さ
  - 大きすぎる、曖昧すぎる、明示的な統合タスクでないのに境界をまたぐ、検証可能な成果物を欠くタスク
  - 要件・設計・タスクグラフの間に持ち込まれた矛盾
- 次のいずれか 1 つの verdict を返す:
  - `PASS`
  - `NEEDS_FIXES`
  - `RETURN_TO_DESIGN`
- `NEEDS_FIXES` の場合、ドラフトを 1 回修復し、サニティレビューを 1 回だけ再実行する
- `RETURN_TO_DESIGN` の場合、`tasks.md` を書かずに停止し、要件/設計の正確なギャップを指し示す
- このレビューは限定的に保つ。2 度目のフル計画サイクルにしない

### ステップ 4: 確定

**tasks.md の書き込み**:
- `.kiro/specs/{feature}/tasks.md` を作成/更新
- spec.json のメタデータを更新:
  - `phase: "tasks-generated"` を設定
  - `approvals.tasks.generated: true, approved: false` を設定
  - `approvals.requirements.approved: true` を設定
  - `approvals.design.approved: true` を設定
  - `updated_at` タイムスタンプを更新

**承認**:
- 自動承認フラグ（`-y`）が true の場合:
  - spec.json で `approvals.tasks.approved: true` を設定
  - タスクサマリーを表示（タスク数、主要グループ、並列マーカー）
  - 応答: "Tasks generated and auto-approved. Start implementation with `/kiro-impl {feature}`"
- それ以外（インタラクティブ）:
  - 生成したタスクのサマリーを表示（タスク数、主要グループ、並列マーカー）
  - ユーザーに質問: "Tasks generated. Approve and proceed to implementation?"
  - ユーザーが承認した場合:
    - spec.json で `approvals.tasks.approved: true` を設定
    - 応答: "Tasks approved. Start implementation with `/kiro-impl {feature}`"
  - ユーザーが変更を望む場合:
    - `approvals.tasks.approved: false` のまま保持
    - 調整すべき点と再実行の案内を返す

## クリティカルな制約
- **タスクの統合**: すべてのタスクはシステムに接続されなければならない（孤立した作業の禁止）
- **バウンダリ注記**: `(P)` タスクには必須、すべてのタスクに推奨（`_Boundary: ComponentName_`）
- **明示的な依存関係**: 境界をまたぐ自明でない依存は `_Depends: X.X_` で宣言
- **実行可能な成果物の粒度**: 各タスクは検証可能な成果物（ファイル、エンドポイント、UI コンポーネント、設定）を生み出さなければならない。インフラタスク（プロジェクトのスキャフォールディング、マニフェスト、ホスト統合、ビルド設定）は明示的でなければならない — 存在を前提にしない
- **観測可能な完了状態**: 実行可能な各サブタスクは、新たな管理用フィールドを追加せずに完了状態を可視化する詳細箇条書きを少なくとも 1 つ含めなければならない
- **暗黙の前提条件の禁止**: タスクがランタイム、SDK、フレームワークのセットアップ、設定ファイルを必要とする場合、そのセットアップは独立した先行タスクでなければならない

## 出力の説明

spec.json で指定された言語で簡潔なサマリーを提供する:

1. **ステータス**: `.kiro/specs/{feature}/tasks.md` にタスクを生成したことを確認
2. **タスクサマリー**:
   - 合計: 主要タスク X 件、サブタスク Y 件
   - 全 Z 件の要件をカバー
   - 平均タスクサイズ: サブタスクあたり 1-3 時間
3. **品質検証**:
   - すべての要件がタスクへマッピング済み
   - 設計カバレッジとランタイム前提をレビュー済み
   - タスク依存関係を検証済み
   - タスク計画レビューゲートを通過
   - 独立したタスクグラフ・サニティレビューを通過
   - テストタスクを含む
4. **次のアクション**: タスクをレビューし、準備ができたら次へ進む

**フォーマット**: 簡潔（200 語以内）

## 安全策とフォールバック

### エラーシナリオ

**要件または設計が未承認**:
- **実行停止**: 承認済みの要件と設計なしには進められない
- **ユーザーメッセージ**: "Requirements and design must be approved before task generation"
- **推奨アクション**: "Run `/kiro-spec-tasks {feature} -y` to auto-approve all (requirements, design, and tasks) and proceed"

**要件または設計の欠落**:
- **実行停止**: 両方のドキュメントが存在しなければならない
- **ユーザーメッセージ**: "Missing requirements.md or design.md at `.kiro/specs/{feature}/`"
- **推奨アクション**: "Complete requirements and design phases first"

**要件カバレッジの不足**:
- **警告**: "Not all requirements mapped to tasks. Review coverage."
- **要ユーザーアクション**: 意図的なギャップであることを確認するか、タスクを再生成

**タスクレビュー中にスペックギャップを発見**:
- **実行停止**: 取り繕った `tasks.md` を書き込まない
- **ユーザーメッセージ**: "Requirements/design do not provide enough clear coverage to generate an executable task plan"
- **推奨アクション**: "Refine requirements.md or design.md, then re-run `/kiro-spec-tasks {feature}`"

**テンプレート/ルールの欠落**:
- **ユーザーメッセージ**: "Template or rules files missing in `.kiro/settings/`"
- **フォールバック**: 警告を出してインラインの基本構造を使用
- **推奨アクション**: "Check repository setup or restore template files"
- **数値要件 ID の欠落**:
  - **実行停止**: requirements.md のすべての要件は数値 ID を持たなければならない。数値 ID を欠く要件がある場合、停止し、タスク生成の前に requirements.md の修正を要求する

### 次のフェーズ: 実装

タスクはステップ 4 のユーザー確認により承認される。承認後:
- 自律的な実装: `/kiro-impl {feature}`
- 特定のタスクのみ: `/kiro-impl {feature} 1.1,1.2`
