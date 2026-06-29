---
name: kiro-postmortem-review
description: Aggregate all entries in .kiro/postmortem/defects.md, produce a 4-axis frequency report (要因分類 × 検知工程 × 発生機能 × 根本要因分類) and clusters, extract Try candidates, and hand them off to /kiro-steering-custom for steering reflection. Invoke at /kiro-impl completion, new spec init, when same root-cause label crosses 2 unreviewed entries, or on user demand.
allowed-tools: Read, Edit, Glob, Grep, Bash
argument-hint: <scope filter, optional. e.g. "since:2026-05-01" or "feature:dashboard">
metadata:
  origin: "custom"
---

# kiro-postmortem-review Skill

## Role

`.kiro/postmortem/defects.md` ledger を読み込み、4 軸 (要因分類 × 検知工程 × 発生機能 × 根本要因分類) で集約分析し、Try 候補を抽出して `/kiro-steering-custom` 経由で `.kiro/steering/*.md` に反映する skill。Check-Act フェーズを担当。

## Core Mission

**Mission**: 蓄積された不具合 ledger から、横展開可能な学習 (Try) を抽出し steering 化する。

**Success Criteria**:
- 全有効 entry が読み込まれ、malformed entry は ID 報告のうえスキップ
- 4 軸頻度集計 + クラスタリング + 同件 cross-reference の構造化レポートを生成
- Try 候補にソース entry IDs が併記され、ユーザーが verification できる
- 承認された Try は `/kiro-steering-custom` 経由でのみ steering 反映
- 反映成功時、ledger の `## Steering 反映ログ` に back-reference が append され、該当 entries の `Status:` が `steered` に更新
- 反映失敗 / 却下時、ledger entries の Status は保持され、Try は次回再評価可能

## Execution Steps

### Step 1: Context Gather

- Read `.kiro/postmortem/defects.md` (ledger 全体)
- Read `.claude/skills/kiro-postmortem-add/rules/taxonomy-reference.md` (有効ラベル定義)
- Read `.claude/skills/kiro-postmortem-review/templates/review-report.md` (レポート出力テンプレ)
- Read `.claude/skills/kiro-postmortem-review/templates/steering-handoff.md` (ハンドオフテンプレ)
- 引数で `scope filter` が渡されていれば抽出条件として保持 (例: `since:2026-05-01` / `feature:dashboard`)

### Step 2: Parse Ledger

- ledger を section 単位でパース:
  - `## Entries` セクション内の各 entry を `### {ID}: {title}` の H3 で分離
  - 各 entry から `Status:` / `Entry ID:` / `Created:` / `Source:` メタ行 + 10 項目 (`#### 1.` ~ `#### 10.`) を抽出
- Malformed 判定:
  - メタ行のいずれかが欠落 → malformed
  - 必須 10 項目 (`#### 1.` ~ `#### 10.`) のいずれかが見つからない or 本文が空 → malformed
- Malformed entry の ID をリスト化、レポート Summary に記載してスキップ (有効 entry のみ後続処理に進む)
- Scope filter 適用 (該当する場合):
  - `since:DATE` → `Created` が DATE 以降のもののみ
  - `feature:LABEL` → `発生機能` が LABEL (サブスコープ含む先頭一致) のもののみ

### Step 3: Aggregate Frequency

4 軸の頻度を集計:

- **R3 要因分類**: 8 ラベル毎の count + percentage
- **R4 検知工程ギャップ**: `(検知すべき工程, 検知した工程)` のペア毎に count + 「すり抜けた検証層」解釈
- **R13 発生機能**: 10 ラベル毎 (サブスコープは無視して親ラベルで集計) の count + percentage
- **R14 根本要因分類**: 11 ラベル毎の count + percentage

Status 別 breakdown も併せて算出 (`recorded` / `reviewed` / `steered` の件数)。

### Step 4: Clustering

- **By 根本要因分類**: 同 R14 ラベルを共有する有効 entry の ID リスト
- **By 発生機能**: 同 R13 ラベル (親ラベル) を共有する有効 entry の ID リスト
- **Cross-reference**: `同件調査` フィールドで他 entry を参照しているもの (entry ID 同士のグラフ) を構築

### Step 5: Extract Try Candidates

Try 候補抽出ロジック:

1. 各 `根本要因分類` クラスタについて:
   - Cluster size >= 2 (同根本要因が 2 件以上)、または最新 entry が `recorded` status のもの
   - そのクラスタ内の各 entry の `次回からの対応策 (項目 10)` を読み、共通項を抽出してマージ
   - 1 つの Try に集約 (例: 3 件の `assumption-error` が異なる対応策を提案していても、メタ原則として「自明と判断したら検証手段を整備する」のような共通項を抽出)
2. 各 Try に以下を付与:
   - Source entry IDs (該当クラスタの全 entry)
   - Proposed steering target ファイル名 (命名規約は `templates/steering-handoff.md` の Filename Naming Convention 参照)
   - Try Content (steering ファイルに書き込まれる本文の draft)
   - Rationale (motivating evidence、各 entry の根本要因詳細と Try 抜粋)

### Step 6: Render Summary + Per-Bug Walkthrough

まず Summary (counts, status breakdown, malformed, 4 軸 frequency, clusters) を **簡潔に** 提示。次に **バグ 1 件ずつ** 以下のフォーマットで要因分析を説明し、各 Try に対する verdict をその場で求める:

```
# Bug #{ID}: {title}

## 何が起きた
(1-2 段落の本質的記述、技術詳細は ledger 参照)

## 要因分析の 4 軸読み
(発生機能 / 要因分類 / 検知工程ペア / 根本要因 を表形式で)

## 根本要因の本質
(なぜそのメカニズムが発動したか、1-2 段落)

## 抽出される Try
(Rule + 提案 steering ファイル名)

## 判定
(AskUserQuestion で approved / rejected / pending)
```

ユーザーが N 件のバグについて 1 件ずつ判定する。**この段階では ledger も steering も書き換えない** (Step 8 でまとめて反映)。

### Step 7: Verdict Collection (skip — Step 6 で同時収集)

Step 6 のバグ別 walkthrough の中で verdict が収集されるため、独立した Step 7 は不要。

### Step 8: Batch Hand-off (全 verdict 集約後に一括反映)

全バグの verdict が出揃ったら、以下を **まとめて 1 回で実施**:

1. **Approved Tries の hand-off (順次・大カテゴリへ集約)**:
   - **集約方針**: PDCA Try は **大カテゴリの 1 ファイル** に H2 セクションとして append する。新規ファイル作成は新しい大カテゴリが立つ時のみ
   - 主な大カテゴリ steering ファイル例:
     - `testing-conventions.md` ← assumption-error / verification-gap / preventing-false-pass / integration-test 等のテスト戦略系
     - `structure.md` ← Single Source of Truth / boundary 設計 / ファイル配置原則 等の構造系
     - `tooling-traps.md` (将来) ← ライブラリ / ツール固有の落とし穴
   - 各 Approved Try について:
     1. Try のカテゴリを判定 (既存大カテゴリ or 新規)
     2. 既存カテゴリなら該当ファイルに H2 セクション (`## {Try title}`) を **append**
     3. 新規カテゴリなら `/kiro-steering-custom` で新ファイル作成 (慎重に判断、横並びの細粒度ファイル乱立を避ける)
   - steering ファイルは **必要十分に簡潔** に保つ (Rule + Evidence 短文中心、各セクション 20-40 行目安)
   - `/kiro-steering-custom` の成功 / 失敗を記録

2. **Ledger 一括更新 (1 トランザクション相当)**:
   - Approved + steering 化成功: 該当 entry の `Status:` → `steered`、`## Steering 反映ログ` に back-reference を append
   - Approved + steering 化失敗: Status 変更せず (`recorded` 保持)、Try は次回再提示
   - Rejected: 該当 entry の `Status:` → `reviewed`
   - Pending: Status 変更せず (`recorded` 保持)

3. **`## Steering 反映ログ` の append フォーマット**:

```markdown
### {{TIMESTAMP_ISO_8601}}

- Source entries: {{SOURCE_ENTRY_IDS}}
- Target steering: {{TARGET_STEERING_PATH}}
- Try summary: {{TRY_SUMMARY}}
- Handoff result: success
```

複数 Try を同セッションで反映した場合、各 Try ごとに 1 ブロックずつ append (時系列順)。

### Step 9: Final Report

ユーザーに以下サマリーを 1 回で提示:

```
✅ Steered entries: #..., #... → .kiro/steering/{...}.md, ...
↩️ Reviewed (rejected) entries: #...
⏸ Pending entries: #...
❌ Failed handoff: #... (再評価可能)
```

## Critical Constraints

- **Read-mostly**: ledger entry 本体 (10 項目) は本 skill から変更しない (R6.5)
- **Status と `## Steering 反映ログ` のみ Edit**: ledger 内で書き換える対象はこの 2 種類だけ
- **Batch reflection**: バグごとに個別 verdict を集めるが、ledger / steering への書き込みは **全 verdict が出揃ってから 1 回でまとめて反映** する (途中で書き込まない)
- **Steering ファイルは必要十分に短く**: Rule + Evidence 短文を中心に 20-40 行目安。詳細記述は ledger entry に残し、steering 側で重複させない
- **`.kiro/steering/` への直接書き込み禁止**: 必ず `/kiro-steering-custom` 経由 (R6.6, R7.1)
- **Back-reference は append-only**: `## Steering 反映ログ` の既存エントリは編集しない (R7.4)
- **失敗 Try は ledger 保持**: 反映失敗 / 却下時に entry status は `recorded` のまま、Try は次回再提示可能 (R7.3)
- **既存 spec / skill / settings.json 不変** (R11)
- **UTF-8 保持** (R10.4)
- **Malformed entry handling**: ID を report に記載してスキップ、他 entry の処理は継続 (R10.1)
- **FS エラー時の write 中止**: ledger が読めない場合 write しない (R10.5)

## Output Description

最終出力:

```
Status: completed | cancelled | error
Ledger snapshot:
  Total entries: N
  Valid entries: M
  Malformed (skipped): [ID list]
  Status breakdown: recorded=R, reviewed=V, steered=S

Frequency report:
  (4 軸テーブル: 詳細は templates/review-report.md 展開結果)

Clusters:
  By 根本要因分類: ...
  By 発生機能: ...
  Cross-ref: ...

Try Candidates:
  Try 1: {{SUMMARY}} (sources: #..., verdict: approved/rejected/pending)
  Try 2: ...
  ...

Steering Reflections:
  - Source entries: ... → Target: ... (success/failed)
  - ...
```

## Safety & Fallback

- **Ledger 不在**: `.kiro/postmortem/defects.md` が存在しない場合、エラー表面化して終了 (skill としては「まず `/kiro-postmortem-add` を起動して ledger を初期化してください」とユーザーに指示)
- **全 entry が malformed**: 有効 entry 0 件で集計対象がない場合、Summary のみ出力して終了
- **Hand-off skill 不在 / 不可用**: `/kiro-steering-custom` がエラーで起動できない場合、Try 候補だけ生成してユーザーに後日の手動反映を提案
- **同時起動**: 本 skill は read-mostly なので同時実行による race condition は起こりにくいが、Step 9 の Status Edit 前に ledger の mtime を再確認し、変化があればユーザーに resolve を求める
- **Scope filter 無効値**: 不正な scope filter (`since:invalid` 等) が渡されたら無視して全件対象で続行 + 警告メッセージ

## Notes

- 本 skill は対話的に動作し、自動化を意図しない。Try 抽出後の steering 化は必ずユーザー確認を経る
- `templates/steering-handoff.md` で構造化された Try は、ユーザーが `/kiro-steering-custom` の対話入力としてそのまま貼り付けて利用できる形式
- ledger が小規模 (N < 10) なうちは Try 抽出が "ノイズ" になる可能性。最低 cluster size (現状 2) は内部閾値として固定だが、運用後に調整余地あり
- 本 skill 自身に起因する不具合は `defect-pdca` 発生機能ラベルで `/kiro-postmortem-add` に記録される (dogfooding)
