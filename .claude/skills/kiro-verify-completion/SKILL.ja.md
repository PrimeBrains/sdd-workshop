---
name: kiro-verify-completion
description: Verify completion and success claims with fresh evidence. Use before claiming a task is complete, a fix works, tests pass, or a feature is ready for GO.
allowed-tools: Read, Bash, Grep, Glob
argument-hint: <claim-type> <claim>
---

# kiro-verify-completion

## 概要

このスキルは虚偽の完了報告を防止する。タスク、修正、フィーチャーは、主張のスコープに見合った新鮮なエビデンスに裏付けられて初めて完了となる。

## 使用タイミング

- タスクが完了したと言う前
- バグが修正されたと言う前
- テストが通ったと言う前
- 自律実行で次のタスクに移る前
- フィーチャーレベルのバリデーションで `GO` を報告する前
- 他のサブエージェントの成功報告を信用する前

初期の計画段階や推測ベースのステータス更新には使用しない。

## 入力

以下を提供する:
- 検証対象の正確な主張
- 主張タイプ:
  - `TASK`
  - `FIX`
  - `TEST_OR_BUILD`
  - `FEATURE_GO`
- コントローラが特定したバリデーションコマンド
- 新鮮なコマンド出力と終了コード
- 該当する場合は関連するタスク ID、要件 ID、設計参照
- フィーチャーレベルの主張の場合:
  - 要件カバレッジの状況
  - 設計整合の状況
  - 統合の状況
  - ブロック中タスクの状況

## 出力

以下のいずれかを返す:
- `VERIFIED`
- `NOT_VERIFIED`
- `MANUAL_VERIFY_REQUIRED`

あわせて以下も返す:
- レビューした主張
- 使用したエビデンス
- スコープとエビデンスの不一致（あれば）

`spec.json` で指定された言語を使用する。

## ゲート機能

1. 正確な主張を特定する。
2. その主張を証明する正確なコマンドまたはチェックリストを特定する。
3. 現在のコード状態からの新鮮なエビデンスを要求する。
4. 終了コード、失敗数、スキップされたスコープ、欠けているカバレッジをチェックする。
5. エビデンスより広い主張は却下する。
6. 必須バリデーションを完了できない場合は `MANUAL_VERIFY_REQUIRED` を返す。
7. そのうえで初めて主張を認める。

## 主張タイプ別ルール

### TASK
要求事項:
- タスクローカルな検証エビデンス
- レビューで未解決のブロッキング所見がないこと
- タスク境界に整合したエビデンス

### FIX
要求事項:
- 元の症状が解消されたエビデンス
- 関連する検証スコープで広範なリグレッションがないこと

### TEST_OR_BUILD
要求事項:
- 実際のコマンド出力
- 終了コード
- 無関係なチェックからの推論をしないこと

### FEATURE_GO
要求事項:
- フルテストスイートの結果
- ビルド成果物が最初の利用可能な状態に到達することを示すランタイムスモークブートの結果
- 要件カバレッジの評価
- タスク横断統合の評価
- 設計のエンドツーエンド整合の評価
- ブロック中タスクの評価

テストスイートが通っただけでは `FEATURE_GO` には不十分。

## 停止 / エスカレーション

以下の場合は `MANUAL_VERIFY_REQUIRED` を返す:
- 正規のバリデーションコマンドが不明
- 必要な環境が利用不可
- 必須の手動検証ステップを実行できない

以下の場合は `NOT_VERIFIED` を返す:
- コマンドが失敗した
- エビデンスが古い
- エビデンスが部分的
- 主張がエビデンスを超えている
- フィーチャーに未解決のブロック中タスクや未カバーの要件が残っている

## よくある正当化

| 正当化 | 現実 |
|---|---|
| 「サブエージェントが成功したと言った」 | 報告された成功は検証エビデンスではない。 |
| 「以前テストが通った」 | 新鮮なエビデンスのみ。 |
| 「lint が通ったのでビルドも大丈夫なはず」 | lint はビルド成功を証明しない。 |
| 「テストもビルドも通ったので動くはず」 | 型消去、モジュールロード、ネイティブ ABI、起動時設定の問題はランタイムでなお失敗しうる。 |
| 「全タスクにチェックが付いたのでフィーチャーは完成」 | `FEATURE_GO` にはカバレッジ、統合、設計整合も必要。 |

## 出力フォーマット

```md
## Verification Result
- STATUS: VERIFIED | NOT_VERIFIED | MANUAL_VERIFY_REQUIRED
- CLAIM_TYPE: TASK | FIX | TEST_OR_BUILD | FEATURE_GO
- CLAIM: <exact claim>
- EVIDENCE: <command/checklist and result>
- GAPS: <scope/evidence mismatch or missing validation>
- NOTES: <next action if not verified>
```
