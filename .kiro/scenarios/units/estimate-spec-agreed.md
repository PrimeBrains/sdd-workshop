---
id: units/estimate-spec-agreed
title: 見積案をレビューして承認し「合意済み」にする
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, activity(新規)]
precondition: 要件定義・設計・タスクに未承認の見積案が付き、実装は見積なしのまま（承認・確定は未実施）
postcondition: 要件定義・設計・タスクの見積が合意済みとなり凍結値が確定し、担当はまだ付いておらず実装は見積なしのまま
touches_specs:
  - moira-core
  - moira-surface-spec-value
touches_requirements:
  - "moira-core: 3.1, 4.1, 4.2, 7.1, 7.2"
  - "moira-surface-spec-value: 1.1, 4.1, 4.3, 7.1"
---

# 見積案をレビューして承認し「合意済み」にする

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

提案中の見積案を開発者がレビューして承認すると、見積が「合意済み」になり凍結値が確定し、見積カバレッジが上がること。

## 2. 前提（Given）

新規 spec `F` のフェーズノードに見積案が「提案中（未承認）」として付いている。実装は見積なしのまま。

| ノード | 見積状態 | 見積値 | lifecycle |
|---|---|---|---|
| F（フィーチャー） | — | — | pending |
| └ 要件定義 | proposed（未承認） | 3人日 | pending |
| └ 設計 | proposed（未承認） | 5人日 | pending |
| └ タスク | proposed（未承認） | 2人日 | pending |

見積カバレッジ（P2・合意済みベース）：**0%**（合意済みノード 0 / 既知の有効ノード 4。分母は親 F を含むノード基底＝§7）

## 3. ふるまい（When / Then）

```
When  開発者が提案中の見積案をレビューし、問題ないと判断して承認する
Then  要件定義・設計・タスクの見積が「承認済み（合意済み）」に変わる
And   spec-value 画面で「提案中（未承認）」の印が「承認済み」に変わる
And   見積カバレッジが 0% から上がる（3ノードが合意済みに変わる）
And   履歴画面に「見積を承認」の行が増える
And   見積値がこの時点で確定（凍結）される
And   実装は見積なしのまま（このユニットの対象外）
```

<small>注：「承認」は `estimate-agreement` 状態機械の `proposed→agreed` 遷移（MODEL §2.2）。合意権限は人間のみ（MODEL I6）。「凍結」は MODEL §3 のベースライン予算凍結（`frozenBudget` 属性）に対応。承認（合意）の write は `moira-estimate-agree`（⚠未実装）が担い、見積案を提示する `moira-estimate-propose`（仮称・⚠未実装）とは別スキル。spec-value 画面は合意アクションを自ら実行せず、合意 write の文脈への深リンクのみを提供する（moira-surface-spec-value Req7）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value 中心**（ガントのタイムライン進捗表示は採らない＝前段ユニット §7 決定）。

### spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before — 提案中）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ <b>0%</b>（合意済みベース・0/4）<br><span style="color:#b45309">見積案 3 葉に提示済み（合意は未）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 3人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 5人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 2人日 ／ EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After — 承認済み）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ <b>75%</b>（3/4）<br><span style="color:#16a34a">葉は全て合意済み（親 F はロールアップ）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 3人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 5人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 2人日 ／ EV寄与 0</td>
  </tr>
</table>

### 履歴画面（新規）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🕓 履歴画面（新規）（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">たった今</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">開発者が <b>要件定義・設計・タスクの見積案を承認</b>（要件定義 3人日 / 設計 5人日 / タスク 2人日・<span style="color:#16a34a">承認済み</span>）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>要件定義・設計・タスクの見積案</b> を提示（要件定義 3人日 / 設計 5人日 / タスク 2人日・<span style="color:#b45309">未承認</span>）</td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 凍結値（frozenBudget） | P2 への算入 |
|---|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | — | 分母に算入・未合意（I1 ロールアップ＝独立合意なし） |
| └ 要件定義 | pending | agreed（承認済み） | 3人日 | 3 | ✅ 分子・分母とも算入（合意済み） |
| └ 設計 | pending | agreed（承認済み） | 5人日 | 5 | ✅ 分子・分母とも算入（合意済み） |
| └ タスク | pending | agreed（承認済み） | 2人日 | 2 | ✅ 分子・分母とも算入（合意済み） |

見積カバレッジ（P2・合意済みベース）：**75%**（合意済みノード 3 / 既知の有効ノード 4。分母に親 F を含むノード基底＝§7）<br>
凍結済み合計：**10人日**（3 + 5 + 2）

<small>注：`frozenBudget` は合意時に確定する per-node 属性（上表は素の値）。spec-value のノード木はこれを独立列として表示せず、EV寄与（完了かつ合意済みのとき `frozenBudget` が乗り、未完了の本ユニットでは 0）として現す（参照実装 `moira/frontend/src/surfaces/spec/SpecValueSurface.tsx`、moira-surface-spec-value Req6）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | transition イベントが **3 件**追記される（下記 JSON） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-estimate-agreed.md`） | 人間のレビュー・承認判断・凍結値の記録 |
| **履歴画面（新規）** | 「見積を承認」の 1 行（§4） |

```json
[
  {
    "id": "e020", "ts": 20,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/req",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 3
  },
  {
    "id": "e021", "ts": 21,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/design",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 5
  },
  {
    "id": "e022", "ts": 22,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 2
  }
]
```

<small>注：ノード ID・ts 値はいずれも例示であり、実装が決める。`machine: "estimate-agreement"` は lifecycle とは独立した見積合意の状態機械（定義は MODEL §2.2、全 transition への状態機械明示義務は R-D6）。`actor.kind` が `"human"` であること（MODEL I6、R-U4）および `frozenBudget` の記録（MODEL §3、R-U7）は不変条件。承認操作は spec-value 画面そのものでなく、深リンク先の `moira-estimate-agree`（⚠未実装）write 文脈で人間が行う（継ぎ目 ⟿）。event 型は `moira/backend/src/types.ts` の `TransitionEvent` に一致する。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が見積案を承認したとき、**システムは** 見積を「合意済み」として記録**しなければならない**。
- **WHEN** 見積が合意されたとき、**システムは** その時点の見積値を凍結値として確定**しなければならない**。
- **WHEN** 見積が合意されたとき、**システムは** 画面上の印を「提案中（未承認）」から「承認済み」に変え**なければならない**。
- **WHEN** 見積が合意されたとき、**システムは** 見積もり済みの割合の表示を、合意済みになったノードを反映して更新**しなければならない**。
- **WHEN** 見積が合意されたとき、**システムは** 履歴画面に「見積を承認」の行を追加**しなければならない**。
- **WHILE** 人間が承認していない間、**システムは** 見積を「合意済み」に変更**してはならない**。
- **WHEN** 見積が合意されたとき、**システムは** 担当の割当を変更**してはならない**（本ユニットは割当を扱わない）。
- **WHEN** 見積が合意されたとき、**システムは** 実装の見積状態を変更**してはならない**。

## 7. 決定事項

- **スコープ＝happy path（一括承認）に限定:** 本ユニットは「開発者が3ノードの見積案を問題ないと判断して一括承認する」経路のみを扱う。**承認拒否（差し戻し → 再見積 R-E3）** と **部分承認（ノード単位合意・MODEL §2.2）** は、それぞれ将来の別ユニットとして切り出す（ユーザー裁定 FORK）。§3 は不可侵の人間意図であり、これらの否定系・部分系をここに混入させない。
- **承認 write の所有は `moira-estimate-agree`（⚠未実装）:** 合意（`proposed→agreed`）は spec-value 画面が自ら実行せず、独立 write skill `moira-estimate-agree` が所有する人間のコミット判断である。spec-value は当該 write 文脈への**深リンクのみ**を提供する（出所＝moira-surface-spec-value Req7 AC3、UI-ARCHITECTURE §4.2/§5）。見積案を提示する `moira-estimate-propose`（仮称）とは別スキル。
- **凍結は予算次元のみ（スロットは対象外）:** 合意時に確定するのはベースライン**予算**（`frozenBudget`）であり、**計画スロット**（`frozenSlot`）は初回スケジュール載り時に確定する（MODEL §3 の二次元ベースライン）。本ユニットの postcondition「担当はまだ付いておらず」はスロット未凍結と整合し、スロット凍結は後段（割当・スケジュール）の責務。
- **P2 分母はノード基底（親 F を含む。3葉合意で 75%）:** MODEL P2「Σ(合意済み見積ノード) / Σ(既知ツリーの全ノード)」の分母は**既知の有効ノード全体**であり、中間ノード（フィーチャー F）も分母に含む。F の見積は I1 ロールアップ（親 = Σ合意済み子）で**独立した合意 transition を受けない**ため、F は分母に居続けながら分子（独立合意ノード）に入らない。ゆえに3葉すべてを合意しても P2 = 3/4 = **75%** であり 100% には達しない（出所＝参照実装 `moira/backend/src/derivations/coverage.ts`〔分母 `effectiveNodes.size`・親はロールアップで独立合意なし〕とゴールデンテスト `coverage.test.ts`〔`F + a 合意 → 1/2`〕）。§3 の「0% から上がる」はこの 0%→75% で充足する。**葉基底との別概念:** scheduleCoverage(R-S6)・executionCoverage(R-S8) は葉基底（`effectiveLeaves`）だが、estimateCoverage(P2) はノード基底である点が canon の設計（coverage.ts の `effectiveNodes` vs `effectiveLeaves`）。前段ユニット [estimate-spec-proposed](./estimate-spec-proposed.md) の「有効葉 3」表記は基底ラベルとして不正確だが、その値 0% は基底不変（0/3 = 0/4 = 0）ゆえ前段の確定値とは矛盾しない（前段ラベルの訂正は別タスク）。
- **画面表現は参照実装に接地（`frozenBudget` 独立列を描かない）:** spec-value のノード木は `frozenBudget` を独立列として表示せず、各葉に lifecycle・estimate 印・「見積／EV寄与」を示す（EV寄与 = 完了かつ合意済みのとき `frozenBudget`、未完了の本ユニットでは 0）。出所＝参照実装 `moira/frontend/src/surfaces/spec/SpecValueSurface.tsx`、moira-surface-spec-value Req6 AC3。`frozenBudget` は §4 データ表に per-node 属性（素の値）として保持する。
- **見積カバレッジは「読むだけ・再計算しない」:** spec-value は導出（`moira-evm` 所有の P2）を読んで表示するのみで、自前で再計算しない（出所＝moira-surface-spec-value Req9 AC2）。§6 はこの規律に合わせ「カバレッジ表示の更新」と表現し、「再計算」とは書かない。
- **履歴画面は新規サーフェス（前段で起票決定済み）:** §4/§5 の「履歴画面（新規）」は前段ユニット [estimate-spec-proposed](./estimate-spec-proposed.md) §7 で新規要件化を決定済みのアクティビティ画面。本ユニットはこれを継承し `(新規)` と明示する。
