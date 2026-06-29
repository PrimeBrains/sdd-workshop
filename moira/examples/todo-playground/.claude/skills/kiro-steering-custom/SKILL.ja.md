---
name: kiro-steering-custom
description: Create custom steering documents for specialized project contexts. Use when creating domain-specific steering files.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
metadata:
  origin: "cc-sdd"
  shared-rules: "steering-principles.md"
---

# kiro-steering-custom Skill

## 役割
コアファイル（product, tech, structure）以外のカスタムステアリングドキュメントを作成するための専門 skill。

## コアミッション
**役割**: コアファイル（product, tech, structure）の枠を超えた専門ステアリングドキュメントを作成する。

**ミッション**: 専門領域向けのドメイン固有プロジェクトメモリの作成を支援する。

**成功基準**:
- カスタムステアリングが専門的なパターンを捉えている
- コアステアリングと同じ粒度の原則に従っている
- 特定ドメインに対して明確な価値を提供している

## 実行ステップ

### Step 1: コンテキスト収集

ステアリングのコンテキストが会話からすでに得られている場合、重複するファイル読み込みはスキップ。
そうでない場合:
- `.kiro/settings/templates/steering-custom/` で利用可能なテンプレートを確認
- ステアリング原則として、本 skill ディレクトリ内の `rules/steering-principles.md` を Read

## ワークフロー

1. **ユーザーに確認**: カスタムステアリングのニーズを聞く:
   - ドメイン / トピック（例: 「API standards」「testing approach」）
   - 文書化すべき具体的な要件やパターン

2. **テンプレート有無の確認**:
   - 利用可能なら `.kiro/settings/templates/steering-custom/{name}.md` からロード
   - 出発点として使い、プロジェクトに合わせてカスタマイズ

3. **コードベース分析**（JIT）: 関連パターンを把握する:

#### 並列リサーチ

以下のリサーチ領域は独立しており、並列実行可能:
1. **テンプレートと原則**: 一致するテンプレートと steering-principles.md をロード
2. **ドメインパターン**: Glob/Grep/Read を使ってコードベースのドメイン固有パターンを分析

すべての並列リサーチ完了後、ステアリングドキュメント向けに知見を統合する。

4. **カスタムステアリングの生成**:
   - テンプレートがあればその構造に従う
   - 本 skill ディレクトリ内の `rules/steering-principles.md` の原則を適用
   - 網羅的なリストではなくパターンに集中
   - 100-200 行に収める（2-3 分で読める分量）

5. **ファイル作成**: `.kiro/steering/{name}.md` に作成

## 利用可能なテンプレート

`.kiro/settings/templates/steering-custom/` で利用可能なテンプレート:

1. **api-standards.md** - REST/GraphQL 規約、エラーハンドリング
2. **testing.md** - テスト構成、モック、カバレッジ
3. **security.md** - 認証パターン、入力検証、シークレット管理
4. **database.md** - スキーマ設計、マイグレーション、クエリパターン
5. **error-handling.md** - エラー型、ロギング、リトライ戦略
6. **authentication.md** - 認証フロー、権限、セッション管理
7. **deployment.md** - CI/CD、環境、ロールバック手順

必要なときにテンプレートをロードし、プロジェクトに合わせてカスタマイズする。

## ステアリング原則

`rules/steering-principles.md`（本 skill ディレクトリ内）より:

- **リストよりパターン**: 全ファイル / コンポーネントではなくパターンを文書化
- **単一ドメイン**: 1 ファイル 1 トピック
- **具体例**: コードでパターンを示す
- **保守可能なサイズ**: 100-200 行が標準
- **セキュリティ最優先**: シークレットや機密データは決して含めない

## ツールガイダンス

- **Read**: テンプレートのロード、既存コードの分析
- **Glob**: パターン分析のための関連ファイル探索
- **Grep**: 特定パターンの検索
- **Bash** の `ls`: 関連構造の把握

**JIT 戦略**: そのタイプのステアリングを作成するときにのみテンプレートをロード。

## 出力の説明

ファイル位置を含むチャットサマリー（ファイルは直接作成）。

```
Custom Steering Created

## Created:
- .kiro/steering/api-standards.md

## Based On:
- Template: api-standards.md
- Analyzed: src/api/ directory patterns
- Extracted: REST conventions, error format

## Content:
- Endpoint naming patterns
- Request/response format
- Error handling conventions
- Authentication approach

Review and customize as needed.
```

## 例

### 成功例: API Standards
**入力**: 「Create API standards steering」
**アクション**: テンプレートをロードし、src/api/ を分析、パターンを抽出
**出力**: プロジェクト固有の REST 規約を記した api-standards.md

### 成功例: テスト戦略
**入力**: 「Document our testing approach」
**アクション**: テンプレートをロードし、テストファイルを分析、パターンを抽出
**出力**: テスト構成とモック戦略を記した testing.md

## 安全性とフォールバック

- **テンプレート不在**: ドメイン知識に基づきゼロから生成
- **セキュリティ**: シークレットは決して含めない（原則をロード）
- **検証**: コアステアリングの内容と重複しないことを確認

## 注記

- テンプレートは出発点であり、プロジェクトに合わせてカスタマイズする
- コアステアリングと同じ粒度の原則に従う
- すべてのステアリングファイルがプロジェクトメモリとしてロードされる
- カスタムファイルはコアファイルと同等に重要
- エージェント固有のツーリングディレクトリ（例: `.cursor/`, `.gemini/`, `.claude/`）は文書化しない
- `.kiro/specs/` と `.kiro/steering/` への軽い参照は許容、それ以外の `.kiro/` ディレクトリへの参照は避ける
