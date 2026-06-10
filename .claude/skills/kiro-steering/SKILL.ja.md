---
name: kiro-steering
description: Maintain .kiro/steering/ as persistent project memory (bootstrap/sync). Use when initializing or updating steering documents.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
metadata:
  shared-rules: "steering-principles.md"
---

# kiro-steering Skill

## 役割
`.kiro/steering/` を永続的なプロジェクトメモリとして維持するための専門 skill。

## コアミッション
**役割**: `.kiro/steering/` を永続的なプロジェクトメモリとして維持する。

**ミッション**:
- Bootstrap: コードベースからコアステアリングを生成（初回）
- Sync: ステアリングとコードベースの整合を維持（メンテナンス）
- Preserve: ユーザーのカスタマイズは不可侵、更新は追記的に行う

**成功基準**:
- ステアリングが網羅的なリストではなくパターンと原則を捉えている
- コードドリフトが検出・報告される
- すべての `.kiro/steering/*.md` を等しく扱う（コア + カスタム）

## 実行ステップ

### Step 1: コンテキスト収集

ステアリングのコンテキストが会話からすでに得られている場合、重複するファイル読み込みはスキップ。

- Bootstrap モードの場合: `.kiro/settings/templates/steering/` からテンプレートを Read
- Sync モードの場合: 既存の `.kiro/steering/*.md` をすべて Read
- ステアリング原則として、本 skill ディレクトリ内の `rules/steering-principles.md` を Read

## シナリオ判定

`.kiro/steering/` の状態を確認:

**Bootstrap モード**: 空、またはコアファイル（product.md, tech.md, structure.md）が欠落
**Sync モード**: コアファイルがすべて存在

---

## Bootstrap フロー

1. `.kiro/settings/templates/steering/` からテンプレートをロード
2. コードベースを分析（JIT）:

#### 並列リサーチ

以下のリサーチ領域は独立しており、並列実行可能:
1. **プロダクト分析**: README、package.json、ドキュメントファイルから目的・価値・コア機能を把握
2. **技術分析**: 設定ファイル、依存関係、フレームワークから技術パターンと意思決定を把握
3. **構造分析**: ディレクトリツリー、命名規約、import パターンから組織化方針を把握

すべての並列リサーチ完了後、ステアリングファイル向けにパターンを統合する。

3. パターンを抽出（リストではなく）:
   - プロダクト: 目的、価値、コア機能
   - 技術: フレームワーク、意思決定、規約
   - 構造: 組織化、命名、import
4. ステアリングファイルを生成（テンプレートに従う）
5. 本 skill ディレクトリ内の `rules/steering-principles.md` から原則をロード
6. レビュー用にサマリーを提示

**フォーカス**: 意思決定を導くパターンであり、ファイル / 依存関係のカタログではない。

---

## Sync フロー

1. 既存のステアリングをすべてロード（`.kiro/steering/*.md`）
2. コードベースの変更を分析（JIT）
3. ドリフトを検出:
   - **Steering → Code**: 欠落要素 → 警告
   - **Code → Steering**: 新パターン → 更新候補
   - **カスタムファイル**: 妥当性を確認
4. 更新を提案（追記的、ユーザーコンテンツは保持）
5. 報告: 更新、警告、推奨事項

**更新の哲学**: 置き換えではなく追加。ユーザーセクションは保持する。

---

## 粒度の原則

`rules/steering-principles.md`（本 skill ディレクトリ内）より:

> 「新しいコードが既存パターンに従うなら、ステアリングの更新は不要であるべき」

網羅的なリストではなく、パターンと原則を文書化する。

**悪い例**: ディレクトリツリーの全ファイルを列挙
**良い例**: 組織化パターンを例とともに記述

## ツールガイダンス

- `Glob`: ソース / 設定ファイルの探索
- `Read`: ステアリング、ドキュメント、設定の読み込み
- `Grep`: パターン検索
- `Bash` の `ls`: 構造分析

**JIT 戦略**: 事前一括ではなく、必要時に取得。

## 出力の説明

チャットサマリーのみ（ファイルは直接更新）。

### Bootstrap:
```
Steering Created

## Generated:
- product.md: [Brief description]
- tech.md: [Key stack]
- structure.md: [Organization]

Review and approve as Source of Truth.
```

### Sync:
```
Steering Updated

## Changes:
- tech.md: React 18 → 19
- structure.md: Added API pattern

## Code Drift:
- Components not following import conventions

## Recommendations:
- Consider api-standards.md
```

## 例

### Bootstrap
**入力**: 空のステアリング、React TypeScript プロジェクト
**出力**: パターンを記した 3 ファイル - 「Feature-first」「TypeScript strict」「React 19」

### Sync
**入力**: 既存ステアリング、新規 `/api` ディレクトリ
**出力**: structure.md を更新、非準拠ファイルをフラグ付け、api-standards.md を提案

## 安全性とフォールバック

- **セキュリティ**: キー、パスワード、シークレットは決して含めない（原則を参照）
- **不確実な場合**: 両方の状態を報告し、ユーザーに確認
- **保持**: 迷ったら置き換えではなく追加

## 注記

- すべての `.kiro/steering/*.md` がプロジェクトメモリとしてロードされる
- テンプレートと原則はカスタマイズ可能なよう外部化されている
- カタログではなくパターンに集中する
- 「黄金律」: パターンに従う新しいコードはステアリング更新を要求すべきでない
- `.kiro/settings/` の内容はステアリングファイルに文書化しない（settings はメタデータであり、プロジェクト知識ではない）
