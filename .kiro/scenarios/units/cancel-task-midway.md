---
id: units/cancel-task-midway
title: 進行中タスクを「不要」としてキャンセルし、正直に締める（100%偽装をしない）
status: draft
language: ja
actor: 開発者
surfaces: [spec-value, schedule, activity(新規)]
precondition: feature 配下に「完了済みの葉」「進行中の葉」「未着手の葉」が混在し、進行中の葉には実コストが計上されている
postcondition: 進行中だった葉が終端キャンセルとなりアクティブな導出（有効集合・キュー・スケジュール）から外れる。費やした実コストは AC に残り、出来高(EV_abs)は増えず、履歴にキャンセルが理由付きで残る
touches_specs:
  - moira-core
  - moira-scope-deps
  - moira-evm
  - moira-schedule
  - moira-surface-spec-value
touches_requirements:
  - "moira-core: 1.5, 5.5, 10.1"
  - "moira-scope-deps: 1.4, 5.1, 5.6"
  - "moira-evm: 1.1, 2.1, 8.1, 8.3, 10.1"
  - "moira-schedule: 3.1, 4.1, 4.2"
  - "moira-surface-spec-value: 1.1, 1.5, 2.2, 3.1"
---

# 進行中タスクを「不要」としてキャンセルし、正直に締める（100%偽装をしない）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

進行中のタスクが「もう不要」になったとき、それを**キャンセル**すると、アクティブな一覧から消え、費やした分は実コストとして正直に残り、**出来高は増えない**こと。従来の「不要なものを100%にしてクローズ」という偽装をせずに締められること。

## 2. 前提（Given）

feature `F` に3つの実装タスクがある。A は完了済み、T は進行中（エージェントが着手し、人が一部手を入れて 3人日分のコストが計上済み）、B は未着手・未割当。

| ノード | 見積状態 | 見積値 | lifecycle | 担当 | 実コスト(AC) | 出来高(EV_abs) |
|---|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | 9（子の合計） | 6（子の合計） |
| └ 実装タスクA | agreed | 6人日 | accepted（完了） | 👤 太郎 | 6 | 6 |
| └ 実装タスクT | agreed | 6人日 | implementing（進行中） | 🤖 Claude | 3 | 0（未完了ゆえ0） |
| └ 実装タスクB | agreed | 8人日 | pending（未着手） | 未割当 | 0 | 0 |

- 達成率 EV%（現行進捗）：**30%**（EV_abs 6 ÷ 合意済み有効葉の見積合計 20）
- 見積カバレッジ（P2）：**75%**（合意済み 3 / 既知の有効ノード 4。分母に親 F を含む）
- 実行カバレッジ（R-S8）：**33%**（進行中の合意済み葉 1=T / 合意済み有効葉 3）
- T は「エージェント作業キュー」に居る。B は「未割当バックログ」に居る。

## 3. ふるまい（When / Then）

```
When  開発者が、進行中のタスク T を「もう不要」と判断し、理由を付けてキャンセルする
Then  T はアクティブな一覧（作業キュー・レビューキュー・未割当バックログ）から消える
And   T は「キャンセルされた（やらなくていい・理由付き）」と画面で明確に分かり、終端で、後からまた現れない
And   すでに費やした分（3人日）は『100%偽装』にされず、実コストとして正直に残る（出来高(EV)は増えない）
And   T は削除されず、誰がいつ何の理由でキャンセルしたかが履歴に残る
```

<small>注：「キャンセル」は lifecycle 状態機械の終端 `cancelled` への遷移（MODEL §2.5・R-C1）。これは EV を完了として偽装しない正直な締め方であり、完了 `accepted` とは別物。cancelled は現行有効集合から外れる（MODEL R-C2、effective-set 導出 = `moira-core`）。「実コストは残る」は「コストは事実」（MODEL A6/P6、AC は cancelled のコストも保持 = `moira-evm`）。キャンセルの発行（write）は `moira-cancel-scope`（⚠未実装）が担い、本ユニットはその結果の読み出しを確かめる。T に後続依存が無いため、キャンセル孤児（R-C3・`moira-scope-deps`）は検出されない（依存があれば別ユニット）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value 中心**（ノード木）＋ アクティブ一覧（キュー・バックログ）のデータ表。

### spec-value 画面（ノード木）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before — T は進行中）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV% <b>30%</b>（現行進捗）／見積カバレッジ 75%／実行カバレッジ 33%</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装タスクA 👤太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">accepted</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 6人日 ／ EV寄与 6 ／ AC 6</td>
  </tr>
  <tr style="background:#fffbeb">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装タスクT 🤖Claude</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">implementing</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 6人日 ／ EV寄与 0（未完了）／ AC 3</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装タスクB</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 8人日 ／ EV寄与 0 ／ 未割当</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After — T はキャンセル）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV% <b>43%</b>（6/14・スコープ縮小で上昇）／見積カバレッジ 67%／実行カバレッジ 0%</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装タスクA 👤太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">accepted</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 6人日 ／ EV寄与 6 ／ AC 6</td>
  </tr>
  <tr style="color:#94a3b8;text-decoration:line-through">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装タスクT 🤖Claude</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fecaca;color:#7f1d1d;border-radius:4px;padding:1px 6px;text-decoration:none">キャンセル（不要）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fecaca;color:#7f1d1d;border-radius:4px;padding:1px 6px;text-decoration:none">cancelled</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">現行有効集合から除外 ／ AC 3 は残る（サンク）／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装タスクB</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 8人日 ／ EV寄与 0 ／ 未割当（変化なし）</td>
  </tr>
</table>

### アクティブ一覧（キュー・バックログ）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td style="padding:6px 10px">一覧</td><td style="padding:6px 10px">Before</td><td style="padding:6px 10px">After</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td><td style="padding:6px 10px;border:1px solid #cbd5e1">[ T ]</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>[ ]</b>（T 消える）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビューキュー</td><td style="padding:6px 10px;border:1px solid #cbd5e1">[ ]</td><td style="padding:6px 10px;border:1px solid #cbd5e1">[ ]</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">未割当バックログ</td><td style="padding:6px 10px;border:1px solid #cbd5e1">[ B ]</td><td style="padding:6px 10px;border:1px solid #cbd5e1">[ B ]（変化なし）</td></tr>
</table>

**データ（After・素の値）**

| 指標 | Before | After | 変化の理由 |
|---|---|---|---|
| 出来高 EV_abs | 6 | **6** | キャンセルで増えない（偽の完了をしない）。R-U8/R-C2 |
| サンク EV_abs | 0 | **0** | T は1サブ単位も完了していない＝稼得ゼロ。3人日は出来高でなくコスト |
| 実コスト AC | 9 | **9** | T の 3 は事実として残る（サンク・コスト）。A6/P6・evm 8.3 |
| 達成率 EV% | 30% | **43%** | 分母から T の 6 が外れる（不要スコープの除外）。EV_abs は不変 |
| 見積カバレッジ | 75% | 67% | 有効ノードが 4→3（T 除外） |
| 実行カバレッジ | 33% | 0% | 進行中の葉が T のみ→キャンセルで 0 |
| エージェント作業キュー | [T] | [] | cancelled は有効集合外＝キューに出ない（queues.ts） |
| 未割当バックログ | [B] | [B] | T は元から割当済み・B は不変 |

<small>注：EV% が 30%→43% に上がるのは「不要と判断した 6人日を計画から外した（de-scope）」結果であり、**出来高(EV_abs)が増えたわけではない**（6 のまま）。これが「100%にしてクローズ」の偽装との違い：偽装なら EV_abs に T の 6 を不正に足して見かけの完了を作るが、キャンセルは EV_abs を一切動かさず、費やした 3 を AC に正直に残す。値はすべて参照実装 `moira/backend`（`derivations/effective-set.ts` の cancelled 除外、`ev.ts`、`ac.ts`〔cancelled のコスト保持〕、`queues.ts`）に接地。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | lifecycle `transition` が **1 件**追記される（下記 JSON）。削除はしない（append-only） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-cancel-task-midway.md`） | 「T はもう不要」という人間の判断・理由の記録 |
| **履歴画面（新規）** | 「タスクをキャンセル（理由付き）」の 1 行（§4） |

```json
[
  {
    "id": "e040", "ts": 40,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/T",
    "machine": "lifecycle",
    "to": "cancelled",
    "reason": "要件変更により不要"
  }
]
```

<small>注：ノード ID・ts 値は例示であり実装が決める。`machine: "lifecycle"` は全 transition への状態機械明示義務（MODEL I5/R-D6）。`to: "cancelled"` は終端遷移でいずれの非終端状態からも到達可能（MODEL §2.5、受理と fold は `moira-core` Req5.5）。`reason` を伴うのは理由付きキャンセル（説明責任）。event 型は `moira/backend/src/types.ts` の `TransitionEvent` に一致する。T の既存コスト（3人日）は別の `cost` イベント群として既に計上済みで、本キャンセルはそれらを削除しない（コストは事実）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が進行中タスクをキャンセルしたとき、**システムは** それを終端「キャンセル」として記録し、イベントを削除**してはならない**（append-only）。
- **WHEN** タスクがキャンセルされたとき、**システムは** 当該タスクを現行有効集合・エージェント作業キュー・人間レビューキュー・未割当バックログ・スケジュールから外**さなければならない**。
- **WHEN** タスクがキャンセルされたとき、**システムは** すでに計上された実コスト(AC)を保持（サンク）**しなければならない**（コストは事実）。
- **WHEN** タスクがキャンセルされたとき、**システムは** 出来高(EV_abs)を増や**してはならない**（完了として偽装しない）。
- **WHEN** タスクがキャンセルされたとき、**システムは** 画面上で「キャンセル（理由付き・やらない）」と分かるよう、完了とは区別して提示**しなければならない**。
- **WHEN** タスクがキャンセルされたとき、**システムは** 履歴に「誰が・いつ・なぜ」キャンセルしたかを残**さなければならない**。
- **WHILE** タスクがキャンセル（終端）である間、**システムは** それをアクティブな作業として再表示**してはならない**。
- **WHEN** タスクがキャンセルされたとき、**システムは** 後続や他タスクを自動的にキャンセル**してはならない**（判断は人間。R-C3/P0）。

## 7. 決定事項

（draft：確定事項は検証ループ通過後に記載する。現時点で **ユーザー確認待ちの線引き** は本文外で提示。）
