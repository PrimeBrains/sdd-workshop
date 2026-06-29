---
name: kiro-spec-quick
description: Quick spec generation with interactive or automatic mode
allowed-tools: Read, Skill, Bash, Write, Glob, Agent
argument-hint: <project-description> [--auto]
metadata:
  origin: "cc-sdd"
---

# クイックスペックジェネレーター

<instructions>
## CRITICAL: 自動モードの実行ルール

**`$ARGUMENTS` に `--auto` フラグが含まれる場合、AUTOMATIC MODE で動作する。**

自動モードでは:
- 停止せずに全 4 フェーズを連続ループで実行する
- 各フェーズ後に進捗を表示する（例: "Phase 1/4 complete: spec initialized"）
- Phase 2〜4 からの "Next Step" メッセージは無視する（単体利用向けのため）
- Phase 4 の後、終了前に最終サニティレビューを実行する
- 停止するのはサニティレビュー完了後、またはエラー発生時のみ

---

## コアタスク
4 つのスペックフェーズを順番に実行する。自動モードでは停止せずに全フェーズを実行する。インタラクティブモードではフェーズ間でユーザーに承認を求める。

クイック生成の完了を宣言する前に、生成された requirements・design・tasks に対して軽量なサニティレビューを 1 回実行する。ホストが新規サブエージェントをサポートする場合はそれを使う。そうでなければサニティレビューをインラインで実行する。

## 実行ステップ

### Step 1: 引数のパースと初期化

`$ARGUMENTS` をパースする:
- `--auto` を含む場合: **自動モード**（全 4 フェーズを実行）
- それ以外: **インタラクティブモード**（各フェーズで確認）
- 説明文を抽出する（`--auto` フラグがあれば除去）

例:
```
"User profile with avatar upload --auto" → mode=automatic, description="User profile with avatar upload"
"User profile feature" → mode=interactive, description="User profile feature"
```

モードバナーを表示して Step 2 へ進む。

### Step 2: フェーズループの実行

以下の 4 フェーズを順番に実行する。

---

#### Phase 1: スペックの初期化（直接実装）

**コアロジック**:

1. **Brief の確認**:
   - `.kiro/specs/{feature-name}/brief.md`（`/kiro-discovery` で作成）が存在する場合、ディスカバリーのコンテキスト（問題、アプローチ、スコープ、制約）として読む
   - `$ARGUMENTS` の代わりに brief の内容をプロジェクト説明として使う

2. **フィーチャー名の生成**:
   - 説明文を kebab-case に変換する
   - 例: "User profile with avatar upload" → "user-profile-avatar-upload"
   - 名前は簡潔に保つ（理想は 2〜4 語）

3. **一意性の確認**:
   - Glob で `.kiro/specs/*/` を確認する
   - `brief.md` のみ（`spec.json` なし）のディレクトリが存在する場合、そのディレクトリを使う（ディスカバリーが作成したもの）
   - それ以外でフィーチャー名が既存の場合、`-2`、`-3` 等を付加する

4. **ディレクトリの作成**:
   - Bash を使う: `mkdir -p .kiro/specs/{feature-name}`（ディスカバリーで作成済みならスキップ）

5. **テンプレートからファイルを初期化**:

   a. テンプレートを読む:
   ```
   - .kiro/settings/templates/specs/init.json
   - .kiro/settings/templates/specs/requirements-init.md
   ```

   b. プレースホルダーを置換する:
   ```
   {{FEATURE_NAME}} → feature-name
   {{TIMESTAMP}} → current ISO 8601 timestamp (use `date -u +"%Y-%m-%dT%H:%M:%SZ"`)
   {{PROJECT_DESCRIPTION}} → description
   ja → language code (detect from user's input language, default to `en`)
   ```

   c. Write ツールでファイルを書き込む:
   ```
   - .kiro/specs/{feature-name}/spec.json
   - .kiro/specs/{feature-name}/requirements.md
   ```

6. **進捗の出力**: "Phase 1/4 complete: Spec initialized at .kiro/specs/{feature-name}/"

**自動モード**: 即座に Phase 2 へ進む。

**インタラクティブモード**: "Continue to requirements generation? (yes/no)" と確認する
- "no" の場合: 停止し、現在の状態を表示する
- "yes" の場合: Phase 2 へ進む

---

#### Phase 2: 要件の生成

Skill ツール経由で `/kiro-spec-requirements {feature-name}` を呼び出す。

完了を待つ。"Next Step" メッセージは無視する（単体利用向けのため）。

**進捗の出力**: "Phase 2/4 complete: Requirements generated"

**自動モード**: 即座に Phase 3 へ進む。

**インタラクティブモード**: "Continue to design generation? (yes/no)" と確認する
- "no" の場合: 停止し、現在の状態を表示する
- "yes" の場合: Phase 3 へ進む

---

#### Phase 3: 設計の生成

Skill ツール経由で `/kiro-spec-design {feature-name} -y` を呼び出す。`-y` フラグは要件を自動承認する。

完了を待つ。"Next Step" メッセージは無視する。

**進捗の出力**: "Phase 3/4 complete: Design generated"

**自動モード**: 即座に Phase 4 へ進む。

**インタラクティブモード**: "Continue to tasks generation? (yes/no)" と確認する
- "no" の場合: 停止し、現在の状態を表示する
- "yes" の場合: Phase 4 へ進む

---

#### Phase 4: タスクの生成

Skill ツール経由で `/kiro-spec-tasks {feature-name} -y` を呼び出す。

注: `-y` フラグは要件・設計・タスクを自動承認する。

完了を待つ。

**進捗の出力**: "Phase 4/4 complete: Tasks generated"

#### 最終サニティレビュー

Phase 4 の後、完了を宣言する前に軽量なサニティレビューを実行する。

- `requirements.md`、`design.md`、`tasks.md` をディスクから直接レビューする。`brief.md` が存在する場合は補助的なコンテキストとしてのみ使う。
- ホストがサポートする場合は新規のレビューサブエージェントを優先する。ファイルパスとレビュー目的のみを渡し、レビュアー自身が生成ファイルを読むこと。
- レビューの焦点:
  - requirements、design、tasks は一貫したストーリーを語っているか？
  - 明白な矛盾、前提条件の欠落、設計上必要な作業に対するタスクカバレッジの欠落はないか？
  - `_Depends:_`、`_Boundary:_`、`(P)` マーカーは実装上妥当か？
- レビューで見つかった問題がタスク計画ローカルのみの場合、生成された `tasks.md` を 1 回修正・更新し、サニティレビューを再実行する。
- レビューで本物の要件 / 設計のギャップや矛盾が見つかった場合、クイックスペックが実装可能であると宣言する代わりに、停止してフォローアップを報告する。

**全 4 フェーズとサニティレビュー完了。**

最終完了サマリー（Output Description セクション参照）を出力して終了する。

---

## 重要な制約

### エラーハンドリング
- いずれかのフェーズの失敗でワークフローを停止する
- エラーと現在の状態を表示する
- 手動でのリカバリーコマンドを提案する

</instructions>

## 出力の説明

### モードバナー

**インタラクティブモード**:
```
Quick Spec Generation (Interactive Mode)

You will be prompted at each phase.
Note: Skips gap analysis and design validation.
```

**自動モード**:
```
Quick Spec Generation (Automatic Mode)

All phases execute automatically without prompts.
Note: Skips optional validations (gap analysis, design review) and user approval prompts. Internal review gates still run.
Final sanity review still runs.
```

### 中間出力

各フェーズの後、簡潔な進捗を表示する:
```
Spec initialized at .kiro/specs/{feature}/
Requirements generated → Continuing to design...
Design generated → Continuing to tasks...
```

### 最終完了サマリー

`spec.json` で指定された言語で出力する:

```
Quick Spec Generation Complete!

Generated Files:
- specs/{feature}/spec.json
- specs/{feature}/requirements.md ({X} requirements)
- specs/{feature}/design.md ({Y} components, {Z} endpoints)
- specs/{feature}/tasks.md ({N} tasks)

Skipped: /kiro-validate-gap, /kiro-validate-design

Sanity review: PASSED | FOLLOW-UP REQUIRED

Next Steps:
1. Review generated specs (especially design.md)
2. Optional: `/kiro-validate-gap {feature}`, `/kiro-validate-design {feature}`
3. Start implementation: `/kiro-impl {feature}`
```

## 安全策とフォールバック

### エラーシナリオ

**テンプレート欠落**:
- `.kiro/settings/templates/specs/` の存在を確認する
- 欠落している具体的なファイルを報告する
- エラーで終了する

**ディレクトリ作成失敗**:
- パーミッションを確認する
- パスとともにエラーを報告する
- エラーで終了する

**フェーズ実行失敗**（Phase 2〜4）:
- ワークフローを停止する
- 現在の状態と完了済みフェーズを表示する
- 提案: "Continue manually from `/kiro-spec-{next-phase} {feature}`"

**サニティレビュー失敗**:
- ワークフローを停止する
- 矛盾・前提条件の欠落・タスク計画の問題を正確に報告する
- 発見内容に応じて `/kiro-spec-design {feature}`、`/kiro-spec-tasks {feature}`、または手動編集による的を絞ったフォローアップを提案する

**ユーザーによるキャンセル**（インタラクティブモード）:
- 安全に停止する
- 完了済みフェーズを表示する
- 手動での継続を提案する
