---
name: kiro-postmortem-add
description: Append a defect entry to .kiro/postmortem/defects.md with 10 mandatory fields (発生機能 / 発生した不具合 / 検知した工程 / 検知すべき工程 / 検知できなかった理由 / 要因分類 / 根本要因分類 / 根本要因詳細 / 同件調査 / 次回からの対応策). Use when a defect is identified and its root cause is clarified, either proactively by the AI or on user demand.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: <one-line defect summary, optional>
---

# kiro-postmortem-add Skill

## 役割

不具合 1 件分を `.kiro/postmortem/defects.md` ledger に **10 項目埋めた構造化エントリ** として追記する skill。Plan-Do フェーズを担当。AI が不具合発生時に能動的に提案、またはユーザーが任意で起動。

## コアミッション

**ミッション**: 不具合 1 件を漏れなく構造化記録し、後段の `/kiro-postmortem-review` が集約分析できる入力として ledger に蓄積する。

**成功基準**:
- 全 10 項目が確実に埋まった entry が ledger 末尾に append される
- 既存 ledger 内容が byte-for-byte 保持される (append-only)
- タクソノミー外ラベル入力時は同一操作の中で taxonomy reference + ledger ヘッダを同時拡張
- 完了後、R9.5 のトリガー条件を判定し、該当時は `/kiro-postmortem-review` 起動を 1 行で提案

## 実行ステップ

### Step 1: コンテキスト収集

- `.kiro/postmortem/defects.md` を Read (既存 ledger があれば)
  - 存在しない場合は Step 2 で初期化
- `.claude/skills/kiro-postmortem-add/rules/taxonomy-reference.md` を Read (4 タクソノミー定義)
- `.claude/skills/kiro-postmortem-add/rules/trigger-detection.md` を Read (review トリガー判定ロジック)
- 会話文脈と直近の `git diff --stat` / `git diff --name-only` から変更ファイルパスを把握

### Step 2: 初期 Ledger 作成 (ledger 不在時のみ)

- `.claude/skills/kiro-postmortem-add/templates/ledger-header.md` を Read してテンプレ展開
- `.claude/skills/kiro-postmortem-add/templates/seed-entries.md` を Read して 3 件 seed body を取得
- 両者を結合して `.kiro/postmortem/defects.md` を Write 新規作成
  - 構造: `# 不具合要因分析 Ledger` (header テンプレ展開) → `## Entries` (seed 3 件) → `## Steering 反映ログ` (空)
- この時点で seed #0001-#0003 がすべて `Status: recorded` で含まれる

### Step 3: 10 フィールドのドラフト作成

会話文脈・git diff・変更ファイルパスから 10 項目のドラフト値を推論する:

| Field | 推論方法 |
|---|---|
| 発生機能 | 変更ファイルパスを発生機能タクソノミーと照合 (例: `evm-studio/client/src/lib/formatters.ts` → `dashboard / formatters`) |
| 発生した不具合 | 直近の不具合報告会話を要約 |
| 検知した工程 | 「誰がいつ気付いたか」を会話文脈から: ユーザー報告 → `user-report`、テスト実行で → `unit-test` / `integration-test` / `e2e` |
| 検知すべき工程 | V モデルに従い、要因分類が `impl-error` なら `unit-test`、`design-error` なら `integration-test`、`requirements-error` なら `e2e`、を初期提案 |
| 検知できなかった理由 | 検知工程の差分から推論 (例: 該当テストが存在しなかった、レビュー観点が不足、etc) |
| 要因分類 | 不具合の出所成果物 (要件 / 設計 / コード / 環境 / 状態 / ツール / 外部) から推論 |
| 根本要因分類 | 失敗メカニズム (Why 軸) を推論。(What × Why) Quick Reference Map を参照 |
| 根本要因詳細 | 「なぜそのメカニズムが発動したか」の具体的文章を生成 |
| 同件調査 | 既存 ledger entries を grep し、同じ根本要因 or 要因分類のラベルを持つ過去 entry の ID を列挙 |
| 次回からの対応策 | Try 候補となる対策を 1-3 項目で起こす |

### Step 4: ユーザー確認ループ

- 各フィールドのドラフト値をユーザーに提示
- ユーザーが確認 / 修正 / 拒否を選べる対話
- タクソノミー外ラベルを入力した場合:
  - 既存タクソノミーから類似候補を 3 つ提示
  - ユーザーが既存選択 or「同一操作の中で taxonomy 拡張」を選ぶ
  - 拡張を選んだ場合: 本 skill が ledger ヘッダの該当タクソノミー定義表 + `rules/taxonomy-reference.md` の同セクションに新ラベル行を Edit で追加 (新ラベル名 + 定義 + 該当例)
  - ユーザーに「`.kiro/specs/defect-pdca/requirements.md` の該当 Requirement の AC.1 も後で更新してください」と通知 (3 ファイル同期の最後 1 ファイルは spec 文書側なので skill では触らない)

### Step 5: 検証と Append

- 必須 10 項目すべて非空であることを検証
- 1 つでも空なら append を拒否し、欠落フィールドを明示してユーザーに戻す (Step 4 ループに戻る)
- 検証通過したら:
  - 既存 ledger から最大 Entry ID を抽出 (例: `0003`) → 次 ID を算出 (`0004`)
  - `templates/entry-template.md` をテンプレ展開 (10 フィールド + メタを埋める)
  - `Status: recorded`, `Source: organic` を設定
  - `Created:` に現在の ISO 8601 UTC タイムスタンプを設定
  - `.kiro/postmortem/defects.md` の `## Entries` セクション末尾に Write append (`Edit` ツールで末尾位置を特定し、既存内容を保持)
- Append 前に ledger ファイルの mtime を Read で再確認し、Step 1 の Read から変化していたら concurrent write 疑いとしてユーザーに通知 (R10.2)

### Step 6: Append 後のトリガー判定

`rules/trigger-detection.md` のロジックに従い、`/kiro-postmortem-review` 起動を提案すべきかを判定:

1. 直近の会話文脈で `/kiro-impl <feature>` が直前に完了した? → trigger (a) `spec-completion`
2. ledger を再 Read して `recorded` status のエントリで同じ `根本要因分類` または `要因分類` が 2 件以上ある? → trigger (b) `cluster-threshold`
3. 次に `/kiro-spec-init` 起動が予告されている? → trigger (c) `new-spec-init`

該当時は 1 行で提案:

```
/kiro-postmortem-review を起動しますか？ 未レビュー X 件・該当トリガー: {triggers}
```

未該当 or `(d) user-explicit` のみは提案不要。

### Step 7: 出力

ユーザーに以下を報告:
- `appended` / `cancelled` / `error` の status
- Entry ID
- ledger path (`.kiro/postmortem/defects.md`)
- (該当時) review トリガー提案

## 重要な制約

- **Append-only**: 既存 ledger 内容を byte-for-byte 保持 (R1.3, R5.4)
- **All-or-nothing**: 必須 10 項目すべて埋まるまで append しない (R2.5, R5.5)
- **Partial-write 禁止**: ユーザーが mid-flow で却下したら何も書き込まない (R5.5)
- **Steering へ直接書き込み禁止**: 本 skill は `.kiro/steering/` を一切変更しない (steering 書き込みは `/kiro-postmortem-review` 経由 + `/kiro-steering-custom`)
- **既存 spec / skill / settings.json 不変**: `.kiro/specs/{core-data-model,evm-engine,progress-tracking,dashboard}/` と `.claude/skills/kiro-*/` (本 skill 自身以外) と `.claude/settings.json` を変更しない (R11)
- **UTF-8 保持**: 日本語テキストを正規化せずに保持 (R10.4)
- **FS エラー時の write 中止**: ledger が読めない場合 write しない (R10.5)
- **In-progress draft 復帰**: 前回中断ドラフトの取扱いをユーザーに確認 (R5.6)

## 出力の説明

```
Status: appended | cancelled | error
Entry ID: 0004
Ledger: .kiro/postmortem/defects.md
(以下、該当時のみ)
Review Trigger Proposal: /kiro-postmortem-review を起動しますか？ 未レビュー 3 件・該当トリガー: cluster-threshold (assumption-error が 2 件)
```

## 安全性とフォールバック

- **Concurrent write 検知**: `Step 5` の append 直前に ledger mtime を再 Read で確認、Step 1 から変化していればユーザーに resolve を求める
- **FS エラー**: `.kiro/postmortem/defects.md` が読めない (権限 / 不存在以外で読み取り不可) 場合、エラー表面化して write 中止
- **Malformed ledger 検知**: ヘッダ構造 (`## Entries` セクション) が見つからない場合、append 位置を特定できないため write 中止して報告
- **Hand-edit 後の整合性**: ユーザーが手動で ledger を編集していて Entry ID が単調増加でない場合、最大 ID + 1 を採用 (ID の決定論性は維持)
- **タクソノミー外ラベルでのキャンセル**: ユーザーが既存ラベル選択も拡張も拒否したら、append しないで cancelled で終了

## 注記

- 本 skill は対話的に動作し、自動化は意図しない (ユーザー確認なしで append しない)
- `rules/taxonomy-reference.md` と本 skill の振る舞いは厳密にカップリングしている。タクソノミー変更時は taxonomy-reference.md / ledger ヘッダ / requirements.md の 3 ファイルを同時更新する
- 初期 seed 3 件は今回の dogfooding 由来。組織的運用が始まれば `source: organic` のエントリが大半を占めるべき
