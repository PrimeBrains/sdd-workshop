---
name: kiro-spec-init
description: Initialize a new specification with detailed project description
allowed-tools: Bash, Read, Write, Glob, AskUserQuestion
argument-hint: <project-description>
metadata:
  origin: "cc-sdd"
---

# スペック初期化

<instructions>
## コアタスク
プロジェクト記述（$ARGUMENTS）から一意なフィーチャー名を生成し、スペック構造を初期化する。

## 実行ステップ
1. **Brief の確認**: `.kiro/specs/{feature-name}/brief.md` が存在する場合（`/kiro-discovery` により作成）、それを読み込む。brief にはディスカバリーセッションで得られた問題・アプローチ・スコープ・制約が含まれる。これを使ってプロジェクト記述を事前入力し、brief が既に回答している明確化質問はスキップする。
2. **意図の明確化**: requirements.md の Project Description には次の 3 要素が必要: (a) 誰が問題を抱えているか、(b) 現在の状況、(c) 何を変えるべきか。brief.md が存在しこれらをカバーしている場合はステップ 3 へ進む。そうでなければ、先に進む前にユーザーへ明確化を求める。必要なだけ質問し、不足部分を自分の推測で埋めない。
3. **一意性の確認**: `.kiro/specs/` で命名の衝突を検証する。ディレクトリが既に存在し `brief.md` のみ（`spec.json` なし）の場合、そのディレクトリを使用する（ディスカバリーが作成したもの）。
4. **ディレクトリ作成**: `.kiro/specs/[feature-name]/`（ディスカバリーにより既に存在する場合はスキップ）
5. **テンプレートを使ったファイル初期化**:
   - `.kiro/settings/templates/specs/init.json` を読み込む
   - `.kiro/settings/templates/specs/requirements-init.md` を読み込む
   - プレースホルダーを置換:
     - `{{FEATURE_NAME}}` → 生成したフィーチャー名
     - `{{TIMESTAMP}}` → 現在の ISO 8601 タイムスタンプ
     - `{{PROJECT_DESCRIPTION}}` → brief.md があればその内容、なければ $ARGUMENTS
     - `ja` → 言語コード（ユーザー入力の言語から検出、デフォルトは `en`）
   - `spec.json` と `requirements.md` をスペックディレクトリに書き込む

## 重要な制約
- 要件・設計・タスクは生成しない。このスキルは spec.json と requirements.md の作成のみを行う。
</instructions>

## 出力の説明
`spec.json` で指定された言語で、以下の構成で出力する:

1. **生成したフィーチャー名**: `feature-name` 形式と 1-2 文の根拠
2. **プロジェクト概要**: 簡潔な要約（1 文）
3. **作成したファイル**: フルパス付きの箇条書きリスト
4. **次のステップ**: `/kiro-spec-requirements <feature-name>` を示すコマンドブロック

**フォーマット要件**:
- Markdown 見出し（##、###）を使用
- コマンドはコードブロックで囲む
- 出力全体を簡潔に保つ（250 語以内）
- `spec.json.language` に従い、明瞭でプロフェッショナルな言葉づかいを用いる

## 安全策とフォールバック
- **フィーチャー名が曖昧**: フィーチャー名の生成が不明瞭な場合、2-3 案を提示しユーザーに選択を求める
- **テンプレート欠落**: テンプレートファイルが `.kiro/settings/templates/specs/` に存在しない場合、欠落しているファイルパスを明示してエラーを報告し、リポジトリセットアップの確認を提案する
- **ディレクトリ衝突**: フィーチャー名が既に存在する場合、数値サフィックスを付与し（例: `feature-name-2`）、自動的に衝突を解決した旨をユーザーに通知する
- **書き込み失敗**: 具体的なパスを示してエラーを報告し、パーミッションまたはディスク容量の確認を提案する
