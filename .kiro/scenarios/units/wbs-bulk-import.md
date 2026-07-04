---
id: units/wbs-bulk-import
title: Excel 簡易 WBS の一括流し込み
status: draft
language: ja
actor: 開発者
surfaces: [schedule-time, spec-value]
precondition: moira init 済み・`moira template wbs` で得た雛形に既存 WBS を記入済み
postcondition: 記入した全行が、ノード（decompose）・合意見積（agree）・担当割当（assign）・完了予定（frozenSlot）としてログに 1 回の追記で反映される
touches_specs:
  - moira-core
  - moira-schedule
  - moira-surface-schedule
---

# Excel 簡易 WBS の一括流し込み

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現（イベント列）の正しさは §5〜§7 と moira 専門家エージェントが確認します。
>
> ※ 本ユニットは **draft**。独立敵対者による falsifiable 検証ループ（kiro-scenario）は後日 opus で実施し、そこで agreed に昇格させる。ここでの記述は実装（issue #9）に接地した下書きである。

## 1. このユニットで確かめること

既に手元に WBS（作業分解構成）を持っているプロジェクトを、1 ノード 1 コマンドで積み上げるのではなく、Excel に埋めて **一気に** Moira のログへ流し込めること。流し込んだ直後に、各行がノード・合意見積・担当・完了予定として揃い、スケジュール（ガント）と価値（PV）に載って「計画が立った」状態になること。そして、検証で 1 件でも不備があれば **何も書き込まれない**（全か無か）こと。

## 2. 前提（Given）

`moira init`（projectRoot=`todo-app`、me=`alice`）済み。`moira template wbs` が生成した雛形の `WBS` シートに、開発者が次の 5 行を記入した（`説明` シートの記入例は WBS シートには書かない）。

| ID | 親ID | タスク名 | 担当者 | 見積MD | 予定開始日 | 予定終了日 | 先行ID |
|---|---|---|---|---|---|---|---|
| F1 |  | 認証基盤 | alice | 3 | 2026-07-06 |  |  |
| F2 |  | ログイン画面 | alice | 2 |  |  | F1 |
| F3 | F2 | 入力バリデーション | agent:claude | 1 |  |  |  |
| F4 |  | パスワードリセット | bob | 2 |  |  | F1 |
| F5 |  | 統合テスト | alice | 1 |  |  | F2,F4 |

- 担当者セルは **actor ID**（表示名ではない）。`agent:claude` はエージェント担当。
- 日付列は空欄が多い＝ビンパッキングに委ねる。`F1` だけ開始日を指定。
- `先行ID` は同ファイル内の ID（カンマ区切り可＝`F5` は F2・F4 の後）。
- 容量は既定 1.0人日/日・全日稼働。開始基準日 = 2026-07-06。

## 3. ふるまい（When / Then）

```
When  既存の WBS を Excel（テンプレ）に埋めて、moira import wbs で一気にログへ流し込む。
Then  記入した全行がノードとしてログに入り、見積は合意（human commit）され、担当が割り当てられる。
And   開始日・終了日が空欄の行は、先行関係を見て順にビンパッキングされ、完了予定が決まる。
And   先行が無い行は、上の行から順に詰められる。
And   ビンパッキングした完了予定はベースライン（frozenSlot）として凍結され、ガントと PV に載る。
And   もし検証エラーが 1 件でもあれば、1 件も書き込まず、全エラーをまとめて表示して失敗する。
And   --dry-run のときは、行×イベント種別×完了予定の計画だけを表示し、何も書き込まない。
```

<small>注：担当者が人間（alice/bob）の行は日次容量 c(i,d) を消費して完了予定を導く。エージェント（agent:claude）の行は平準化せず `ceil(見積)` 暦日をリードタイムとする（MODEL R-T2／leveler 同一規約）。完了予定（frozenSlot）だけがログに載る——ビンパッキングの内部量である開始日はモデルに存在しない（D-30）。見積合意の actor は必ず me（human）：人間が数字を書いた Excel なので human commit が正当（agent 発の agree は fold R-U4 で棄却）。</small>

## 4. 画面の変化（Before → After）

### schedule-time ガント（Before — import 前）

空。ノードが無く、ガントに行が無い。未割当バックログも空。

### schedule-time ガント（After — import 後）

`alice`／`bob`／`agent:claude` の予定が時間軸に並ぶ。同一担当（alice: F1→F2→F5）は同日に重ならず逐次化。先行（F1→F2、F1→F4、{F2,F4}→F5）はチェーン順に後ろへ。各行に **凍結PMB帯＝生きた予測バー**（初回スケジュールゆえ一致・乖離なし）。

| ノード | 担当 | 完了予定（frozenSlot） |
|---|---|---|
| F1 認証基盤 | alice | 2026-07-08（07-06〜07-08、3人日） |
| F2 ログイン画面 | alice | 2026-07-10（F1 後・07-09〜07-10） |
| F3 入力バリデーション | agent:claude | 2026-07-06（1 暦日・リードタイム） |
| F4 パスワードリセット | bob | 2026-07-10（F1 後・07-09〜07-10） |
| F5 統合テスト | alice | 2026-07-11（F2・F4 後・alice の空き 07-11） |

### spec-value（After）

PV が積み上がる（合意見積の総和＝3+2+1+2+1=9人日が計画価値に載る）。estimate coverage / schedule coverage = 100%。

## 5. ログに入るイベント（events.json 抜粋）

種別ごとにまとめて生成する（decompose → relate → agree → assign）。単一の stamper を通し、(ts,id) 順を保存する。各種別 1 件ずつの実例：

```json
{ "kind": "decompose", "id": "…", "ts": 1, "actor": { "kind": "human", "id": "alice" },
  "parent": "todo-app", "reason": "import wbs: 認証基盤",
  "children": [{ "node": "F1", "estimate": 3 }] }
```
```json
{ "kind": "relate", "id": "…", "ts": 6, "actor": { "kind": "human", "id": "alice" },
  "op": "add", "from": "F1", "to": "F2", "edgeKind": "dependency" }
```
```json
{ "kind": "transition", "id": "…", "ts": 8, "actor": { "kind": "human", "id": "alice" },
  "node": "F1", "machine": "estimate-agreement", "to": "agreed", "frozenBudget": 3 }
```
```json
{ "kind": "transition", "id": "…", "ts": 13, "actor": { "kind": "human", "id": "alice" },
  "node": "F1", "machine": "lifecycle", "to": "ready",
  "assignee": { "kind": "human", "id": "alice" }, "frozenSlot": "2026-07-08" }
```

（`F3` は `assignee.kind = "agent"`。`親ID` 記入行 `F3` の decompose は `parent: "F2"`、空欄行は `parent: "todo-app"`＝projectRoot。）

## 6. 受け入れ基準（EARS）

- **WHEN** `moira import wbs <file>` を実行し、**かつ** 検証エラーが 1 件以上あるとき、**THEN** システムは events.json / labels.json / capacity.json を 1 バイトも変更せず、全エラーをまとめて表示し非 0 で終了しなければならない（MUST）。
- **WHEN** 全行が妥当なとき、**THEN** システムは decompose・relate・agree・assign を **1 回の追記**でログへ書き込まなければならない（MUST）。追記後も (ts,id) 順が保たれなければならない。
- **WHEN** 行の予定開始日・予定終了日が空欄のとき、**THEN** システムは先行関係順（先行が無い行は記入行の上から順）にビンパッキングし、完了予定を frozenSlot として凍結しなければならない（MUST）。
- **WHEN** `--dry-run` を付けたとき、**THEN** システムは行×イベント種別×完了予定の計画だけを表示し、いかなるファイルも変更してはならない（MUST NOT write）。
- **WHEN** 同一ファイルを 2 回目に import したとき、**THEN** システムは「既存ノード」検証エラーで何も書き込んではならない（再インポート非対応・MUST）。

## 7. 決定事項

1. **担当者セル = actor ID**（表示名ではない）。actorLabels 未登録なら stderr 警告のうえ id→id で登録する（表示名の登録は members import＝#11 の役目）。
2. **記入例は `説明` シートに置く**。WBS シートには例行を置かない——そのまま import される事故を構造で防ぐ。
3. **再インポート非対応**。既存ログに同じ ID があれば検証エラー（差分マージや upsert はしない）。
4. **見積合意の actor は cfg.me（human）**。import に `agent:` の actor を生やさない（fold R-U4 の棄却前に事前に塞ぐ）。
5. **完了予定（frozenSlot）だけがログに載る**。ビンパッキングの開始日はモデル外の内部量（D-30）。土日・祝日は c=0 の登録が無い限り稼働日扱い（エンジン既定 1.0 と同一・#11 で members import）。
