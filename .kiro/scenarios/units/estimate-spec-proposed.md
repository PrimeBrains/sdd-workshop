---
id: units/estimate-spec-proposed
title: 要件定義・設計の見積案が「未承認の提案」として現れる
status: draft
language: ja
actor: 開発者
surfaces: [spec-value, activity(新規)]
precondition: 新規 spec の要件定義ノードと設計ノードが、見積なしで存在する
postcondition: 要件定義・設計に未承認の見積案が付き、見積もり済みの割合が上がる（承認・確定は未実施）
touches_specs:
  - moira-ingestion-adapter
  - moira-core
  - moira-surface-spec-value
touches_requirements:
  - "moira-core: 見積はノードの状態（提案→承認）"
  - "moira-core: 記録の追記には理由が必須"
  - "moira-core: 承認は人間のみ"
  - "moira-surface-spec-value: 見積もり済みの割合（見積カバレッジ）・未承認フィルタ"
---

# 見積案が「未承認の提案」として現れる

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

新規 spec を切ったあと、開発者が見積を依頼すると、**要件定義と設計の見積「案」が、まだ自分が承認していない状態として**現れ、「案は出たが承認はこれから」と一目で区別できること。

## 2. 前提（Given）

新規 spec `F` が取り込まれ、要件定義・設計・タスク・実装のノードが**まだ見積なし**で並んでいる。

| ノード | 見積もり | 状態 |
|---|---|---|
| F（機能） | — | これから |
| └ 要件定義 | なし | これから |
| └ 設計 | なし | これから |
| └ タスク / 実装 | なし | これから |

見積もり済みの割合：**0%**

## 3. ふるまい（When / Then）

```
When  開発者が見積を依頼する（見積skill を打鍵する）
Then  Claude が要件定義・設計の見積案を、根拠つきで提示する
        例: 要件定義 = 3人日 / 設計 = 5人日
And   その見積案が「未承認の提案」として、プロジェクトの記録に 1 件書き込まれる
And   spec-value 画面で、要件定義と設計に「提案中（未承認）」の印が付く
And   見積もり済みの割合が 0% → 50% に上がる
And   履歴画面に「見積案を提示」の行が 1 件増える
And   まだ承認も確定もしていない（この時点で数値は固定されない）
And   タスク・実装は見積なしのまま（このユニットの対象外）
```

<small>注：「見積skill」の実体は `moira-estimate-propose`（仮称・未実装）。「履歴画面」は §7 で新規要件化を決定済み。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value 中心**（ガントのタイムライン進捗表示は採らない＝§7 決定）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="3" style="padding:6px 10px">🌳 spec-value 画面（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">F（機能）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積もり済みの割合 <b>0% → 50%</b> ▲</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">3人日</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">5人日</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク / 実装</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積なし</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🕓 履歴画面（新規）（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">たった今</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">開発者 が <b>要件定義・設計の見積案</b> を提示（要件定義 3人日 / 設計 5人日・<span style="color:#b45309">未承認</span>）</td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | 見積状態 | 見積値 | 割合への寄与 |
|---|---|---|---|
| 要件定義 | 提案中（未承認） | 3人日 | ✅ |
| 設計 | 提案中（未承認） | 5人日 | ✅ |
| タスク / 実装 | 見積なし | — | ❌ |

見積もり済みの割合：**0% → 50%**／確定（凍結）した数値：**なし**

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | 見積提案が **1 件**追記される（下記 JSON） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-estimate-proposed.md`） | 提示した案・根拠・「承認は未」 |
| **履歴画面（新規）** | 「見積案を提示」の 1 行（§4） |

```json
{
  "id": "e042", "ts": 42, "actor": "dev:you",
  "kind": "decompose", "parent": "F",
  "reason": "requirements/design の規模から初期見積を提案（未承認）",
  "children": [
    { "node": "要件定義", "estimate": 3 },
    { "node": "設計",   "estimate": 5 }
  ]
}
```

<small>注：見積の内部的な持ち方（独立ノード／属性、要件定義と設計をまとめる／分ける）は本ユニットでは規定しない（§7）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が見積を依頼したとき、**システムは** 要件定義と設計の見積案を「未承認の提案」として提示**しなければならない**。
- **WHEN** 見積案が提示されたとき、**システムは** spec-value 上の要件定義と設計に「未承認」を示す印を付け**なければならない**。
- **WHEN** 見積案が提示されたとき、**システムは** 見積もり済みの割合を、見積案を持つノードを含めて再計算**しなければならない**。
- **WHEN** 見積案が提示されたとき、**システムは** プロジェクトの記録に提案を 1 件追記し、かつ履歴画面に対応する 1 行を表示**しなければならない**。
- **WHILE** 見積案が未承認である間、**システムは** その見積値を確定（固定）**してはならない**。
- **WHEN** 見積案が提示されたとき、**システムは** タスク・実装の見積状態を変更**してはならない**。

## 7. 決定事項

- 見積の「気づき」は **spec-value 中心**に出す。ガントのタイムラインへ進捗バーで出す案は**採らない**。
- 「見積ログが画面で見える」ために、**履歴（アクティビティ）画面を新規要件として起票する**（moira に履歴 UI が無いため）。
- 見積の内部表現は **moira 専門家ループ（moira-model-update）で裁定・確定済み（ハイブリッド）**：見積*値*＋`proposed`/`agreed` 状態は**被見積（フェーズ/作業）ノード**に乗り、見積*作業*の est ノードは**重いときのみノード化**される（軽微なら畳んで cost）。粒度はフェーズ別（要件定義・設計は別の見積）。→ 本ユニット §4/§5 の「要件定義・設計に提案バッジ＋値」は被見積ノードに値が乗るハイブリッドと整合。§5 の decompose JSON は「重い見積作業を別ノード化しない」軽微ケースの記録形。根拠: `moira/MODEL.md` R-E1/R-E1b/R-E2/§2.2/§2.3/§7#14・§6 来歴、`moira/DECISIONS.md`（v16 見積二面性）、会話ログ `.kiro/conversations/2026-06-24-estimate-representation-hybrid.md`。
