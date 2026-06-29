---
id: units/estimate-impl-agreed
title: タスク分解の後で（誕生済みの）実装ノードを見積もり、実装レビュー工数をノード化するか確認し、合意して kiro-impl に進める
status: draft
language: ja
actor: 開発者
precondition: 作業分解（タスク分解）のレビューが完了（タスク分解ノードが accepted）。その §2.6 帰結として実装ノードが未見積で誕生済み。要件定義・設計・タスク＋各レビュー作業の6葉はすべて完了（accepted）・見積合意済み。見積もり済みの割合は tasks 完了時に既に 100%→75% へ低下。実装レビューノードはまだ立っていない
postcondition: 誕生済みの実装ノード（と、ノード化を選んだ場合は実装レビューの作業ノード）の見積が合意済み（agreed）。見積もり済みの割合は 100% に回復し、達成率は実装の確約ぶん正直に低下する。この状態から kiro-impl（実装フェーズ）に進める
surfaces: [spec-value, activity(新規)]
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
touches_requirements:
  - "moira-core: 3.1, 3.2, 3.3, 4.1, 4.2, 7.1, 7.2, 11.1, 11.2"
  - "moira-evm: 1.1, 1.2, 3.1, 3.3, 3.4"
  - "moira-surface-spec-value: 1.1, 3.1, 4.1, 4.3, 6.2, 7.3"
---

# タスク分解の後で（誕生済みの）実装ノードを見積もり、実装レビュー工数をノード化するか確認し、合意して kiro-impl に進める

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。
> 注（draft）：本ユニットは検証ループ中の稿です。残る draft 論点は §7 末尾に開いています。

## 1. このユニットで確かめること

作業分解（タスク分解）のレビューが終わった spec では、**tasks 完了の帰結として実装ノードが未見積で生まれており**（見積もり済みの割合は既に 100%→75% に低下＝tasks 完了時の発見信号）、開発者が実装の見積もりを依頼すると、その実装ノードに見積案が「提案中（未承認）」として現れること。そのとき：

- 実装ノードは「実装の一行」単位ではなく、**作業分解の成果物のトップレベル作業項目**を単位として（tasks 完了時に）生まれていること。配下のサブ項目は各ノードに巻き上げ。
- 成果物が**特定の方法論やファイルに依存しない**こと——AI はまず「それに類する作業分解があるか」を確認し、無ければ分解を提案する（深さの確定は人間。その分解作業自体は別ユニットの主題）。
- **実装レビューの工数を見積ノードとして立てるか（軽微なら畳んで実費計上に留めるか）を AI がユーザーに確認**すること。ここで決めるのは「レビュー工数をノードとして見積もるか」であって、**レビュー（完成物の品質確認）の要否ではない**——品質確認そのものは常に行われる。
- 見積のやりとり（議論・調整）を経て合意に至ると、見積が「合意済み」になること。
- **見積もり済みの割合が回復**し、**達成率は実装を確約したぶん正直に下がる**こと。
- 合意済みになった時点で **kiro-impl（実装フェーズ）に進める**こと（着手そのものは割当を要し別ユニット）。

## 2. 前提（Given）

spec `F` の作業分解（タスク分解）レビューが完了（tasks accepted）。その **§2.6 帰結として実装ノード（実装-1・実装-2）が未見積で誕生済み**（tasks 完了時の発見）。フェーズ6葉（要件定義・設計・タスク＋各レビュー作業）はすべて完了（accepted）・見積合意済み。実装レビューノードはまだ立っていない。

| ノード | 見積状態 | 見積値 | lifecycle | 出来高(EV_abs)寄与 |
|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | 12.5（合意済み子の合計） |
| └ 要件定義 | agreed | 3人日 | accepted（完了） | 3 |
| └ レビュー作業（要件定義） | agreed | 1人日 | accepted（完了） | 1 |
| └ 設計 | agreed | 5人日 | accepted（完了） | 5 |
| └ レビュー作業（設計） | agreed | 1人日 | accepted（完了） | 1 |
| └ タスク | agreed | 2人日 | accepted（完了） | 2 |
| └ レビュー作業（タスク） | agreed | 0.5人日 | accepted（完了） | 0.5 |
| └ 実装-1 | **見積なし** | — | pending | 0（未見積） |
| └ 実装-2 | **見積なし** | — | pending | 0（未見積） |

見積もり済みの割合（P2・葉基底＝MODEL v18）：**75%**（合意済み有効葉 6 / 既知の有効葉 8）<br>
達成率 EV%：**100%**（EV_abs 12.5 / 合意済み最新見積の総和 12.5）<br>
<small>※ 実装ノードは tasks 完了の §2.6 帰結として**未見積で誕生済み**で、これにより見積もり済みの割合は tasks 完了時に既に 100%→75% へ低下している（発見信号は前段＝tasks 完了の断面に属す）。達成率は 100%（未見積の実装は達成率の分母に未算入＝R-U8）——**達成率 100% でも見積もり済み 75%** で、未合意の実装作業がカバレッジに正直に現れている（達成率は必ずカバレッジと対で読む＝MODEL P2）。F は中間ノードゆえ独立合意を受けず分母に入らない（葉基底）。</small>

## 3. ふるまい（When / Then）

```
When  作業分解（タスク分解）のレビューが完了し
      （実装ノードはその帰結として未見積で生まれている）、
      開発者が実装の見積もりを依頼する
Then  AI はまず、実装の単位を決める根拠となる「作業分解の成果物」があるかを確認する
        （特定の方法論やファイル名に依存せず、それに類するものを探す。
         無ければ AI が分解を提案する＝深さの確定は人間・本ユニットの対象外）
And   既に生まれている各実装ノードに、見積案が根拠つきで「提案中（未承認）」として提示される
And   AI が「実装レビューの工数を見積ノードとして立てるか
      （軽微なら畳んで実費計上に留めるか）」をユーザーに確認する
        ※ レビュー（完成物の品質確認）そのものは必ず行う。ここで決めるのは
          “レビュー工数をノードとして見積もるか”であって、レビューの要否ではない。
And   ノードとして立てるなら、実装レビューの作業ノードが作られ、
      レビュー工数の見積案も「提案中（未承認）」として提示される
        （軽微で畳むなら、レビュー工数は実費として計上され見積ノードは作られない）
And   見積のやりとり（議論・調整）を経て問題なければ、
      実装＋実装レビューの見積が「合意済み」になり、見積もり済みの割合が回復する
And   合意済みになった時点で、kiro-impl（実装フェーズ）に進むことができる
```

<small>注：本文の平易語と内部表現の対応は §7／§5 注に集約する。実装ノードは tasks 完了（accepted）の **§2.6 帰結として未見積で誕生**する（だから本ユニットの前提では既に生まれている）——「作業分解の成果物」は cc-sdd では `tasks.md`（トップレベル番号タスク＝実装ノードの単位）の一例で、本ユニットは特定方法論に依存しない（MODEL A1）。「実装レビュー工数をノード化するか／畳むか」は MODEL R-E2b の判断（重ければノード化し EV を持たせ、軽微なら cost 計上）。</small>

## 4. 画面の変化（Before → During → After）

採用表現は **spec-value 中心**（前段ユニット §7 決定を継承）。実装レビューは「ノードとして立てる」を選んだ場合を描く（畳む場合は実装レビュー行が現れず、工数は実費に計上される＝§7）。

### spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before — 実装は誕生済み・未見積）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積もり済み <b>75%</b>（6/8）<span style="color:#dc2626">⚠ 実装が未見積</span><br>達成率 <b>100%</b>（未見積の実装は未算入）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ （フェーズ6葉）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">accepted（完了）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">凍結合計 12.5人日・EV寄与 計 12.5</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fff7ed">└ 実装-1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fff7ed"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fff7ed"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fff7ed">EV寄与 0（未見積で誕生）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fff7ed">└ 実装-2</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fff7ed"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fff7ed"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fff7ed">EV寄与 0（未見積で誕生）</td>
  </tr>
</table>

<small>※ 見積もり済みの割合の「100%→75%」低下は、tasks 完了で実装2葉が未見積で誕生した瞬間に既に起きている（前段＝tasks 完了の発見信号）。本ユニットはこの 75% を起点に、実装の見積→合意で 100% に戻すまでを描く。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（During — 実装の見積提示＋実装レビューをノード化・提案中）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積もり済み <b>67%</b>（6/9）<span style="color:#dc2626">⚠ レビューノードを追加発見</span><br>達成率 <b>100%</b>（提案は未算入）・<span style="color:#b45309">提案あり 3 葉</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ （フェーズ6葉）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">accepted</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">凍結合計 12.5人日</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 実装-1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">見積 8人日（例示）／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 実装-2</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">見積 6人日（例示）／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 実装レビュー（実装全体で1件）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">見積 2人日（例示）／ EV寄与 0</td>
  </tr>
</table>

<small>※ 実装2葉に見積案（提案中）が乗っても見積もり済みの割合は動かない（提案は未合意ゆえ分子に入らない＝75% のまま）。実装レビューを1葉ノード化した時点で既知の葉が 8→9 に増え 75%→67% へ下がる（新規作業の発見）。提案（未承認）は達成率の分母に入らないため、達成率はこの時点でまだ 100%。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After — 実装＋実装レビューの見積を合意）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積もり済み <b>100%</b>（9/9）<span style="color:#16a34a">回復</span><br>達成率 <b>44%</b>（12.5 / 28.5）<span style="color:#dc2626">↓ 正直に低下（実装を確約）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装-1 ／ 実装-2</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 8／6人日・凍結確定・EV寄与 0（未着手）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装レビュー（実装全体で1件）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 2人日・凍結確定・EV寄与 0</td>
  </tr>
</table>

### 履歴画面（activity・新規サーフェス）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🕓 履歴画面（activity・新規）（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">たった今</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">太郎が <b>実装＋実装レビューの見積案を承認</b>（実装-1 8 / 実装-2 6 / 実装レビュー 2 人日・<span style="color:#16a34a">承認済み</span>）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>実装レビューの作業ノードと見積案</b> を提示（「工数をノード化する」との確認を受けて）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>誕生済みの実装ノードに見積案</b> を提示（作業分解の成果物に接地・<span style="color:#b45309">未承認</span>）</td>
  </tr>
</table>

**データ（During — 提案中・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 凍結値 | P2 への算入 |
|---|---|---|---|---|---|
| └ （フェーズ6葉） | accepted | agreed | 計 12.5 | 12.5 | ✅ 分子・分母とも算入 |
| └ 実装-1 | pending | proposed | 8人日 | — | ❌ 分母のみ（未合意） |
| └ 実装-2 | pending | proposed | 6人日 | — | ❌ 分母のみ（未合意） |
| └ 実装レビュー | pending | proposed | 2人日 | — | ❌ 分母のみ（未合意） |

見積もり済みの割合（P2・葉基底）：**67%**（合意済み有効葉 6 / 既知の有効葉 9）／達成率：**100%**（提案は達成率の分母に未算入）

**データ（After — 合意済み・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 凍結値 | P2 への算入 |
|---|---|---|---|---|---|
| └ （フェーズ6葉） | accepted | agreed | 計 12.5 | 12.5 | ✅ |
| └ 実装-1 | pending | agreed | 8人日 | 8 | ✅ |
| └ 実装-2 | pending | agreed | 6人日 | 6 | ✅ |
| └ 実装レビュー | pending | agreed | 2人日 | 2 | ✅ |

見積もり済みの割合（P2・葉基底）：**100%**（合意済み有効葉 9 / 既知の有効葉 9）<br>
凍結済み合計：**28.5人日**（12.5 + 8 + 6 + 2）／達成率 EV%：**44%**（EV_abs 12.5 / 合意済み最新見積総和 28.5）<br>
<small>※ 達成率が 100%→44% に下がるのは「異常」ではなく正直な信号（MODEL P5(c) 新規合意見積の算入）。実装という本体作業を確約したぶん、達成率の分母が増えた。Before で「達成率100%・見積もり済み75%」と乖離していたのは、未合意の実装作業をカバレッジが正直に示していたためで、合意でその乖離が解消し達成率が現実化する。**この合意以降、実装フェーズ（kiro-impl）に進める**（実際の着手 pending→implementing は割当を要し別ユニット）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ＜起点＞decompose（実装ノード誕生・未見積＝tasks 完了の帰結）／＜本ユニット＞decompose（実装の見積提示）+ decompose（実装レビューノード誕生・見積提示）+ relate（依存辺）+ transition（見積合意）を追記 |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-estimate-impl-agreed.md`） | 提示した案・「実装レビュー工数をノード化するか」の確認とその回答・議論・合意判断の記録 |
| **履歴画面（新規）** | 「実装ノードに見積案提示」「実装レビューノード提示」「見積を承認」の各行（§4） |

### ＜起点・前提を生む＞イベント：実装ノードの誕生（未見積・AI・tasks 完了の §2.6 帰結）

```json
{
  "id": "e050", "ts": 50,
  "actor": { "kind": "agent", "id": "claude" },
  "kind": "decompose",
  "parent": "F",
  "reason": "タスク分解の accepted 到達を契機に、作業分解の成果物のトップレベル項目から実装ノードを未見積で誕生（§2.6/§2.3・R-E1b）",
  "children": [
    { "node": "F/impl-1" },
    { "node": "F/impl-2" }
  ]
}
```

<small>注：**e050 は本ユニットの前提を生む起点イベント**（tasks 完了の §2.6 帰結であり、本ユニットの precondition＝「実装は誕生済み・未見積」を成立させる）。本ユニットが扱うのは以降（e051〜）。e050 により既知の葉が 6→8 に増え、見積もり済みの割合が 100%→75% に下がる（未見積子は I1 総和から除外＝moira-core Req11.2）。</small>

### 本ユニットのイベント：実装の見積提示（AI）

```json
{
  "id": "e051", "ts": 51,
  "actor": { "kind": "agent", "id": "claude" },
  "kind": "decompose",
  "parent": "F",
  "reason": "作業分解の成果物を入力に、誕生済み実装ノードの規模を見積もり提案（est(impl)・未承認）",
  "children": [
    { "node": "F/impl-1", "estimate": 8 },
    { "node": "F/impl-2", "estimate": 6 }
  ]
}
```

### イベント：実装レビュー作業ノードの誕生と見積提示（AI・「ノード化する」と確認後）

```json
{
  "id": "e052", "ts": 52,
  "actor": { "kind": "agent", "id": "claude" },
  "kind": "decompose",
  "parent": "F",
  "reason": "実装レビュー工数をノード化するとの確認を受け、実装全体のレビュー作業ノードを追加し見積を提案（未承認）",
  "children": [
    { "node": "F/review-impl", "estimate": 2 }
  ]
}
```

### イベント：依存辺（AI）

```json
[
  { "id": "e053", "ts": 53, "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate", "op": "add", "from": "F/design", "to": "F/impl-1", "edgeKind": "dependency", "policy": "implemented" },
  { "id": "e054", "ts": 54, "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate", "op": "add", "from": "F/design", "to": "F/impl-2", "edgeKind": "dependency", "policy": "implemented" },
  { "id": "e055", "ts": 55, "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate", "op": "add", "from": "F/impl-1", "to": "F/review-impl", "edgeKind": "dependency", "policy": "implemented" },
  { "id": "e056", "ts": 56, "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate", "op": "add", "from": "F/impl-2", "to": "F/review-impl", "edgeKind": "dependency", "policy": "implemented" }
]
```

### イベント：見積の合意（人間）

```json
[
  { "id": "e057", "ts": 57, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/impl-1", "machine": "estimate-agreement", "to": "agreed", "frozenBudget": 8 },
  { "id": "e058", "ts": 58, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/impl-2", "machine": "estimate-agreement", "to": "agreed", "frozenBudget": 6 },
  { "id": "e059", "ts": 59, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/review-impl", "machine": "estimate-agreement", "to": "agreed", "frozenBudget": 2 }
]
```

<small>注：ノード ID・ts 値・見積値はいずれも例示で実装が決める。**e050（起点）**：実装ノードを**未見積**で誕生（tasks 完了の §2.6 帰結。R-E1b：実装は未見積で生まれ別段で見積もる。未見積子は I1 総和から除外＝moira-core Req11.2）。本ユニットの precondition を成立させるイベントで、本ユニットが扱うのは e051 以降。**e051**：est(impl) が成果物を入力に proposed 見積を載せる（tasks ノードの decompose に内包しない＝R-E1b）。**e052**：実装レビューは A1 の通常作業ノード（§2.4/§7#18(b)）で、実装全体に対し1件（§7 の粒度決定）。「ノード化するか畳むか」は R-E2b の判断。**e053–e056**：design→各実装、各実装→実装レビューの依存辺（`policy=implemented`＝先行が作成完了で後続が着手可。MODEL R-D2 実装辺の既定・`review-work-estimated` と同型・golden fixture `tiny-project.ts` の design→impl=implemented に一致）。実装レビューは両実装の完了に依存するため辺2本が入る。**e057–e059**：人間（太郎）が `proposed→agreed` に合意（`machine: "estimate-agreement"`・`actor.kind="human"`＝MODEL I6・R-U4、`frozenBudget` 記録＝R-U7）。承認 write は `moira-estimate-agree`（⚠未実装）。event 型は `moira/backend/src/types.ts` の `DecomposeEvent`（children の estimate は任意）/`RelateEvent`/`TransitionEvent` に一致。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 作業分解（タスク分解）が完了（accepted）したとき、**システムは** 作業分解の成果物のトップレベル作業項目を単位として実装ノード群を**見積なしで作成**し、見積もり済みの割合が下がることを表示に反映**しなければならない**（tasks 完了に伴う実装作業の発見＝本ユニットの前提を生む）。
- **WHEN** 開発者が実装の見積もりを依頼したとき、**システムは** 既に生まれている各実装ノードの見積案を、作業分解の成果物に基づく根拠とともに「提案中（未承認）」として示さ**なければならない**。
- **WHEN** 実装ノードが存在するとき、**システムは** 実装レビューの工数を見積ノードとして立てるか（軽微なら実費計上に留めるか）を開発者に確認**しなければならない**。
- **WHEN** 開発者が実装レビューをノードとして立てると選んだとき、**システムは** 実装レビューの作業ノードを作成し、その工数の見積案を「提案中（未承認）」として示し、各実装ノードからレビュー作業ノードへの依存（実装が完成するとレビューに着手できる）を記録**しなければならない**。
- **WHEN** 開発者が実装レビューを軽微として畳むと選んだとき、**システムは** 実装レビュー専用の見積ノードを作成**してはならず**、その工数は実費として計上**しなければならない**。
- **WHEN** 開発者が実装・実装レビューの見積案を承認したとき、**システムは** 見積を「承認済み」として記録し、その値を凍結し、見積もり済みの割合の表示を回復**しなければならない**。
- **WHEN** 実装の見積が承認され見積もり済みの全体量が増えたとき、**システムは** 達成率の表示をその新しい全体量に基づいて更新**しなければならない**（実装の確約により達成率は下がる）。
- **WHILE** 実装・実装レビューの見積が未承認である間、**システムは** その見積値を確定（固定）**してはならない**。
- **WHEN** 実装・実装レビューの見積が承認されたとき、**システムは** 既存の要件定義・設計・タスク（と各レビュー作業）の見積・凍結値・完了状態を変更**してはならない**。

## 7. 決定事項

- **実装ノードは tasks 完了の §2.6 帰結として誕生（本ユニットは誕生後を扱う）＝Reading A（ユーザー裁定）:** MODEL §2.6「tasks ノードの accepted 到達を**契機**に feature 主語の decompose が実装ノードを生む」・§2.3 L104「tasks 完了 → 実装ノードを未見積で誕生 → est(impl)」・moira-core Req11.2「tasks 完了で生まれた直後の実装ノード（未見積で I1 総和から除外）」に従い、**実装ノードは tasks 完了（precondition）の帰結として未見積で既に誕生している**。本ユニットの precondition はその誕生後であり、見積もり済みの割合は tasks 完了時に既に 100%→75% へ低下している（発見＝birth は前段＝tasks 完了の断面に属す）。本ユニットは「誕生済み実装の見積（est(impl)）→ 実装レビューのノード化要否 → 合意 → 見積もり済み割合 100% 回復」を扱う。**当初案の「見積依頼が実装ノードを生む／Before 100%」は誕生契機の MODEL 接地誤りとして敵対者ループで2度覆り、Reading A（誕生は tasks 完了の帰結・Before は 75%）へ是正した。MODEL 編集は不要。** 出所＝MODEL §2.6/§2.3・moira-core Req11.2・ユーザー裁定 Reading A。
- **達成率(EV%)とカバレッジの乖離はモデルの正しい振る舞い:** Before では「達成率 100%・見積もり済み 75%」と乖離する——未見積の実装は達成率の分母に未算入（R-U8）だが、既知の葉としてカバレッジ分母には入る（Req11.2）。これは「達成率は必ずカバレッジと対で読む」（MODEL P2）の好例で、カバレッジが未合意の実装作業を正直に示している。合意で達成率は 100%→44% に下がり（P5(c)）、乖離が解消して達成率が現実化する。提示側はこの低下を補正・隠蔽しない（出所＝MODEL P2/P5・moira-evm Req1/Req3）。
- **方法論非依存（cc-sdd 固有ファイルに依存しない）:** 実装ノードの単位は「作業分解の成果物のトップレベル作業項目」であり、特定方法論やファイル名（cc-sdd の `tasks.md`）に依存しない（出所＝MODEL A1・ユーザー確認）。cc-sdd では成果物＝`tasks.md`・実装ノード単位＝トップレベル番号タスクが一例。
- **成果物が無い場合は AI が分解を提案する（確定は人間・本ユニットの対象外）:** AI はまず類する作業分解があるかを確認し、無ければ**分解案を提案**する。**分解の深さの確定は人間のコミット判断（MODEL §2.1#4／P0）であり AI は提案に留まる。** 分解そのものを作る作業はタスク分解フェーズの仕事で別ユニット。出所＝ユーザー確認・MODEL §2.3。
- **実装ノードの粒度は人間のコミット判断:** トップレベル項目を単位にするのは典型で、分解の深さは人間のコミット判断（MODEL §2.1#4）。配下チェック項目は AI が積み上げ、ノード合意で一括確定（§2.2・R-U5）。EV 消化はチェック項目別（P1）だが状態遷移・合意はノード単位＝「粒度の非対称」。
- **実装は未見積で誕生→別段で見積（R-E1b）:** 実装ノードは未見積の葉として誕生し（I1 総和から除外＝Req11.2）、見積は tasks ノードの decompose に内包せず別段（est(impl)）で成果物を入力に行う。ゆえに見積もり済みの割合が低下（tasks 完了時）してから回復（合意時）する（出所＝MODEL R-E1b・§2.3）。
- **実装レビューの扱い＝R-E2b の「ノード化するか畳むか」（FORK 解決・ユーザー裁定）:** AI が確認するのは「実装レビュー**工数をノードとして見積もるか**（軽微なら畳んで cost 計上に留めるか）」であって、レビュー（完成物の品質確認＝lifecycle の `implemented→accepted`）の要否ではない。レビューそのものは常に行われる lifecycle ステップであり、任意なのは**レビュー作業をノード化して EV を持たせるか**（重ければノード化・軽微なら cost）。これにより「AI がユーザーに確認する」という人間の意図を保ちつつ MODEL（§2.5 レビュー必須・R-E2b ノード化判断）に整合し、フェーズレビューが前倒しで立つこと（`review-work-estimated`）との不整合も解消する。出所＝MODEL R-E2b/§2.5/§7#18(b)・ユーザー裁定。
- **実装レビューの粒度＝実装全体で1件（FORK 解決・ユーザー裁定）:** 実装レビューの作業ノードは個々の実装ノードごとではなく**実装全体に対し1件**立てる。各実装ノード→実装レビューノードの依存辺を張り（両実装の完成でレビュー着手可）、kiro-validate-impl が feature-level の最終検証であることに整合する。出所＝ユーザー裁定（FORK②）。
- **依存辺は `policy=implemented`（spec フェーズ辺の既定 `accepted` から意図的逸脱）:** design→各実装、各実装→実装レビューの依存辺は `policy=implemented`（先行が作成完了＝implemented に達した時点で後続が着手可）。spec フェーズ間辺の既定 `accepted`（MODEL R-D2）とは異なる設計判断で、`review-work-estimated`・golden fixture（design→impl=implemented）と同型。出所＝MODEL R-D2・§2.6。
- **見積の差し戻り（やりとり）は別ユニット不要:** 見積案は合意まで proposed のまま据え置かれ、やりとりでは状態遷移が起きない。合意して初めて transition が起きる。よって差し戻り経路を別ユニットに切り出さない（出所＝ユーザー確認）。
- **kiro-impl への前進は見積合意が前提（着手は別）:** 実装・実装レビューの見積が合意済みになった状態が、実装フェーズ（kiro-impl）に**進める**前提。実際の**着手**（pending→implementing）は割当（§2.1#2）と依存充足を要し、出来高獲得とともに本ユニットの対象外（別ユニット）。
- **承認 write の所有は `moira-estimate-agree`（⚠未実装）・提示 write は `moira-estimate-propose`（仮称・⚠未実装）:** 見積案の提示（proposed 記録）と合意（`proposed→agreed`）はいずれも独立 write skill が所有し、spec-value 画面は合意を自ら実行せず合意 write 文脈への深リンクのみを提供する（出所＝moira-surface-spec-value Req7 AC3）。
- **【draft 論点／検証ループ結果】** (a) トレース ID は是正済み（reviewer 6.4/6.6 除去・I1 除外 11.1/11.2 追加・surface 7.1→7.3／3.1・6.2 追加）——doc-fact-checker で全 ID 実在・適合を CONFIRMED。(b) 例示見積値（8/6/2）は golden fixture と例示に倣った仮値（実装/運用が決める）。(c)「成果物が無ければ AI が分解を提案する」分解作業を扱う別ユニットの要否・slug は未起票（将来ユニット）。(d)「実装ノード誕生（100%→75%）」を独立ユニット（tasks 完了の断面）として切り出すかは未決——本ユニットは誕生後（75% 起点）を扱い、誕生イベント e050 は起点として注記するに留める。
