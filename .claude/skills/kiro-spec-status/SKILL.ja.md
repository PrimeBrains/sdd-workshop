---
name: kiro-spec-status
description: Show specification status and progress
allowed-tools: Read, Glob, Grep
argument-hint: <feature-name>
---

# kiro-spec-status スキル

## コアミッション
- **成功基準**:
  - 現在のフェーズと完了状況を表示する
  - 次のアクションとブロッカーを特定する
  - 進捗の明確な可視性を提供する
  - 利用可能な場合、バウンダリの準備状況、upstream/downstream のコンテキスト、再検証が必要になりそうな箇所を提示する

## 実行ステップ

### ステップ 1: スペックコンテキストの読み込み
- `.kiro/specs/$ARGUMENTS/spec.json` を読み、メタデータとフェーズステータスを取得
- `.kiro/specs/$ARGUMENTS/brief.md` が存在すれば読み込む
- 既存ファイルを読み込む: `requirements.md`、`design.md`、`tasks.md`（存在する場合）
- `.kiro/specs/$ARGUMENTS/` ディレクトリで利用可能なファイルを確認
- `.kiro/steering/roadmap.md` が存在し、このスペックが記載されていれば読み込む

### ステップ 2: ステータスの分析

**各フェーズの解析**:
- **Requirements**: 要件と受け入れ基準の数をカウント
- **Design**: アーキテクチャ、コンポーネント、図、バウンダリセクションの有無を確認
- **Tasks**: 完了タスクと全タスクの数をカウント（`- [x]` と `- [ ]` を解析）
- **Approvals**: spec.json の承認ステータスを確認
- **バウンダリコンテキスト**:
  - brief.md から: `Boundary Candidates`、`Upstream / Downstream`、`Existing Spec Touchpoints` があれば記録
  - design.md から: `Boundary Commitments`、`Out of Boundary`、`Allowed Dependencies`、`Revalidation Triggers` があれば記録
  - roadmap.md から: upstream 依存関係と、このスペックが `Existing Spec Updates` に隣接しているかを記録
- **再検証ウォッチリスト**:
  - このスペックが変更された場合に再検証が必要になりうる downstream のスペック、隣接する既存スペック更新、ロールアウトに敏感な設計上の注記を特定
  - 現在のスペックの形が広すぎて、局所的な修復よりロードマップ/設計の分割が望ましい場合はその旨を指摘

### ステップ 3: レポートの生成

spec.json で指定された言語で、以下を網羅するレポートを作成:
1. **現在のフェーズと進捗**: ワークフロー上でスペックがどこにあるか
2. **完了状況**: 各フェーズの完了率
3. **タスク内訳**: タスクが存在する場合、完了/残数を表示
4. **バウンダリコンテキスト**: 利用可能な場合、upstream/downstream、バウンダリ外、許可された依存関係の注記
5. **再検証ウォッチリスト**: このスペックの変更による影響を受けそうな downstream または隣接作業
6. **次のアクション**: 次に行うべきこと
7. **ブロッカー**: 進捗を妨げている問題

**フォーマット**: ステータスを絵文字で示す、明瞭でスキャンしやすい形式

## 安全策とフォールバック

### エラーシナリオ

**スペックが見つからない**:
- **メッセージ**: "No spec found for `$ARGUMENTS`. Check available specs in `.kiro/specs/`"
- **アクション**: 利用可能なスペックディレクトリを一覧表示

**スペックが不完全**:
- **警告**: 欠落しているファイルを特定
- **推奨アクション**: 次フェーズのコマンドを案内

### 全スペックの一覧

利用可能なスペックをすべて確認するには:
- 引数なしで実行するか、ワイルドカードを使用
- `.kiro/specs/` 内の全スペックをステータス付きで表示
