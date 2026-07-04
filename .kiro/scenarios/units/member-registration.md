---
id: units/member-registration
title: Excel で要員・個人休・祝日を登録すると、画面に自分のチームだけが出る
status: draft
language: ja
actor: 開発者
surfaces: [capacity, schedule(Inspector)]
precondition: 実プロジェクトを moira に接続しているが、まだ要員名簿を登録していない（画面はデモ名簿や観測データに頼っている）
postcondition: 記入した要員・個人休・祝日が名簿とカレンダーに反映され、どの画面にもユーザーが与えた氏名しか出ない
touches_specs:
  - moira-core
  - moira-surface-capacity
touches_requirements:
  - "moira-core: 3.x（c(i,d) 第2層・D-16/D-30）"
  - "moira-surface-capacity: ヒートマップ人軸・reason 分類"
---

# Excel で要員・個人休・祝日を登録すると、画面に自分のチームだけが出る

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。
>
> ⚠ **本ユニットは draft です。** issue #11 の指示により、検証ループ（独立敵対者）とレビューは後日実施します。§3 のふるまい（When/Then）は issue 本文の逐語転記であり、人間による批准（draft→agreed）は未了です。

## 1. このユニットで確かめること

開発者が **要員の氏名とキャパシティ・個人の休み・全体の祝日を Excel に記入してアダプタに渡す**と、それらが名簿として登録され、capacity ヒートマップ・Inspector（担当付替）などの各画面に **ユーザーが与えた氏名だけ**が現れること。デモ名簿（田中／佐藤／鈴木／AIエージェント）や、ユーザーが与えていない名前が **どこにも出ない**こと。個人の休み・祝日はキャパシティ 0 として効くこと。

## 2. 前提（Given）

実プロジェクト `F` を `moira ui` で接続している。まだ `.moira/members.json` は空で、要員を登録していない。開発者は `moira template members` で生成した雛形に次を記入した：

**要員シート**

| ID | 氏名 | 既定稼働率 |
|---|---|---|
| nakao | 中尾 | 1 |
| sato | 佐藤田 | 1 |

**個人カレンダーシート**

| 要員ID | 日付 | 稼働率 | 理由 |
|---|---|---|---|
| nakao | 2026-07-10 | 0 | 私用 |

**祝日シート**

| 日付 | 名称 |
|---|---|
| 2026-07-20 | 海の日 |
| 2026-08-11 | 山の日 |

<small>注：氏名「佐藤田」はデモ名簿の「佐藤」と**別物**（デモ名の混入検知を空虚にしないため意図的に別綴り）。</small>

## 3. ふるまい（When / Then）— issue #11 本文の逐語転記（draft）

```
When  開発者が要員の氏名とキャパシティを Excel に記入してアダプタに渡す（moira import members）
Then  記入した要員が名簿に登録される（氏名が表示名になる）
And   「この人はこの日休み」（個人カレンダーの稼働率 0）がその人・その日の稼働 0 として登録される
And   グローバルな祝日は別入力（祝日シート）で、名簿の全員がその日 稼働 0 になる
And   各画面（capacity ヒートマップ・担当付替 など）に、登録した要員の氏名しか出ない
And   ユーザーが与えていない名前（デモの田中／佐藤／鈴木／AIエージェント 等）はどの画面にも出ない
```

<small>注：「アダプタに渡す」の実体は `moira import members <file.xlsx>`（本 issue で実装）。全件検証に通れば、名簿 upsert・表示名一括登録・稼働率エントリ生成を **1 回**で行う。</small>

## 4. 画面の変化（Before → After）

### capacity ヒートマップ（人 × 日）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#7f1d1d;color:#fff"><td colspan="2" style="padding:6px 10px">🗓 capacity（Before — 名簿未登録：デモ名簿/観測データ頼み）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">人軸</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">田中 / 佐藤 / 鈴木</span>（ユーザーが与えていないデモ名）</td></tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#14532d;color:#fff"><td colspan="2" style="padding:6px 10px">🗓 capacity（After — import 後）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">人軸</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>中尾 / 佐藤田</b> のみ（記入した氏名だけ）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">中尾 × 7/10</td><td style="padding:6px 10px;border:1px solid #cbd5e1">c=0（休暇：私用）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">7/20・8/11 の列</td><td style="padding:6px 10px;border:1px solid #cbd5e1">中尾・佐藤田 <b>とも c=0</b>（祝日：海の日 / 山の日）</td></tr>
</table>

### Inspector（担当付替）

- Before：付替候補が田中／佐藤／鈴木／AIエージェント（デモ）。
- After：付替候補が **中尾／佐藤田** のみ。合意（人間のみ）の actor も `me`（config の viewpoint）由来。

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| `.moira/members.json` | 名簿を upsert（下記 JSON） |
| `.moira/labels.json` | actorLabels に id→氏名を一括登録 |
| `.moira/capacity.json`（c(i,d) 第2層 R-U14） | 稼働率エントリを **1 回**で追記（個人休 1 ＋ 祝日 2×2＝5 件） |

```json
// members.json
[
  { "id": "nakao", "kind": "human", "label": "中尾" },
  { "id": "sato",  "kind": "human", "label": "佐藤田" }
]
```

```json
// labels.json（抜粋）
{ "actorLabels": { "nakao": "中尾", "sato": "佐藤田" } }
```

```json
// capacity.json（抜粋・ts は例示）
[
  { "humanId": "nakao", "date": "2026-07-20", "capacity": 0, "reason": "holiday: 海の日", "ts": 1 },
  { "humanId": "sato",  "date": "2026-07-20", "capacity": 0, "reason": "holiday: 海の日", "ts": 2 },
  { "humanId": "nakao", "date": "2026-08-11", "capacity": 0, "reason": "holiday: 山の日", "ts": 3 },
  { "humanId": "sato",  "date": "2026-08-11", "capacity": 0, "reason": "holiday: 山の日", "ts": 4 },
  { "humanId": "nakao", "date": "2026-07-10", "capacity": 0, "reason": "leave: 私用",     "ts": 5 }
]
```

<small>注：`reason` の接頭辞（`holiday:` / `leave:` / `temporary-reduction:`）は capacity ヒートマップの色分類が読む規約。祝日は「import 時点の名簿の human 全員」に展開される（名簿スナップショット）。エンジンは c(i,d) しか見ない（D-16）——新しいカレンダー概念は導入しない。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が要員 Excel を import したとき、**システムは** 記入した要員を名簿（members.json）と表示名（labels.json）に登録**しなければならない**。
- **WHEN** 個人カレンダーに稼働率 0 の行があるとき、**システムは** その要員・その日の c を 0 として記録**しなければならない**。
- **WHEN** 祝日行があるとき、**システムは** import 時点の名簿の human 全員について、その日の c を 0 として記録**しなければならない**。
- **WHEN** import が完了したとき、**システムは** capacity・Inspector・Gantt・activity のいずれの画面にも、登録要員以外の名前（デモ名を含む）を表示**してはならない**。
- **WHEN** 検証エラーが 1 件でもあるとき、**システムは** 何も書き込まず、エラーを全件まとめて提示**しなければならない**。
- **WHEN** 同じ要員・同じ日を再 import したとき、**システムは** 新しい稼働率で上書き（latest-wins）**しなければならない**。

## 7. 決定事項（draft）

- **担当者・要員 ID＝actor ID**：名簿の ID は Actor.id 空間（`agent:claude` のような spec 形は bare id に正規化）。表示名は labels.json 経由で解決し、名簿とラベルは常に同時に書く。
- **祝日は名簿スナップショット展開**：祝日は「import 時点の名簿の human」にのみ c=0 として実体化する。後から要員を足したら祝日を効かせるには **再 import が必要**（正直な限界①・説明シートに明記）。自動追随はしない（エンジンにカレンダー概念を入れない D-16 を守るため）。
- **既定稼働率は v1 では非実体化**：`既定稼働率 < 1.0` は名簿に保持するが c エントリには落とさない（エンジン既定 1.0 のまま）。実レートは個人カレンダー行か `moira capacity` で入れる（正直な限界②）。
- **デモ名の排除は fixtureMode で担保**：実プロジェクト接続時は labels/roster が fixtureMode に入り、デモ名簿・デモラベルのフォールバックを**バイパス**する。名簿が空でも観測データ（担当・稼働率エントリ・me）から導出し、ユーザー由来の名前しか出さない。
- **（要・人間批准）** 本 §3 は issue 本文の逐語転記。draft→agreed への昇格、および §4 の採用表現は後日レビューで確定する。
```
