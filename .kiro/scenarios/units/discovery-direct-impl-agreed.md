---
id: units/discovery-direct-impl-agreed
title: ディスカバリーで spec 修正不要と判断し、タスク分解→レビュー→実装見積合意まで進む
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, activity(新規)]
precondition: 開発者が作業の情報を持っているが、まだフィーチャーノードが存在しない
postcondition: フィーチャーの下にタスクフェーズ（accepted）と実装ノード群（見積合意済み）が存在し、kiro-impl に進められる状態。要件定義・設計フェーズは省略されている
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
touches_requirements:
  - "moira-core: 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 7.1, 7.2, 11.2"
  - "moira-evm: 1.1, 1.2, 3.1, 3.3, 3.4"
  - "moira-surface-spec-value: 1.1, 3.1, 4.1, 4.2, 4.3"
---

# ディスカバリーで spec 修正不要と判断し、タスク分解→レビュー→実装見積合意まで進む

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

ディスカバリーの結果「**spec の修正が不要で、直接実装に進んでよい**」と判断された場合でも、**タスク分解は必ず行われてタスクファイルが出力**され、そのレビューを経て実装ノードが生成され、見積が合意に至り、**kiro-impl に進められる状態**が作られること。要件定義・設計フェーズは省略されるが、タスク分解→実装見積→合意の流れは正常に機能し、見積カバレッジと達成率が正直に動くこと。

## 2. 前提（Given）

開発者が作業の情報を持っているが、まだフィーチャーノードが存在しない。

| ノード | 見積もり | 状態 | 担当 |
|---|---|---|---|
| （まだない） | — | — | — |

見積もり済みの割合：**N/A**（ノードが存在しない）

## 3. ふるまい（When / Then）

```
When  開発者が kiro-discovery を実行し、その結果を踏まえて
      「spec の修正は不要で、直接実装に進んでよい」と開発者が判断する
Then  要件定義（requirements）や設計（design）の新規作成・修正はスキップされる
And   それでもタスク分解は必ず行われ、
      タスクファイル（作業分解の成果物）が出力される
And   そのタスクファイルをレビューして、問題なければ受け入れる
And   タスクの受け入れ後、実装ノード群がフィーチャーの子として生成される
And   開発者が見積スキルを打鍵すると、実装ノードの見積案が
      「提案中（未承認）」として提示される（proposed 状態になる）
And   見積を承認すると「合意済み（agreed）」になり、
      実装フェーズ（kiro-impl）に進むことができる
```

<small>注：「ディスカバリー」の実体は `kiro-discovery`（⟿ skill 継ぎ目）。「spec の修正が不要」の判断は開発者のコミット判断。「見積スキル」の実体は `moira-estimate-propose`（仮称・⟿ ⚠未実装）。承認の実体は `moira-estimate-agree`（⟿ ⚠未実装）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value 中心**（前段ユニット群の §7 決定を継承）。4 断面で「spec スキップ→タスクのみ展開→実装発見→見積合意」の流れを示す。

### spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before）</td></tr>
  <tr>
    <td colspan="4" style="padding:20px;border:1px solid #cbd5e1;color:#94a3b8;text-align:center">— フィーチャーがまだありません —</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After① — ディスカバリー完了・タスクのみ展開）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（新規フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ <b>0%</b> <span style="color:#dc2626">⚠ 低</span><br><span style="color:#64748b;font-size:11px">要件定義・設計は省略（spec 修正不要の判断）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
  </tr>
</table>

<small>※ 要件定義・設計のフェーズノードは生成されない。タスクのみが feature の唯一のフェーズ子ノードとして展開される。これは MODEL A1 の射程内——フェーズ展開の省略は人間のコミット判断。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After② — タスク完了・実装ノード誕生）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積もり済み <b>33%</b>（1/3）<span style="color:#dc2626">⚠ 低下（実装を発見）</span><br>達成率 <b>100%</b>（2人日 / 2人日・タスクのみの据え置き）<br><span style="color:#b45309;font-size:11px">⚑ カバレッジ 33% — 達成率を全体完了度と読まない（合意済み領域のみの達成度）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">accepted（完了）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 2人日・EV寄与 2</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 実装-1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">—</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 実装-2</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">—</td>
  </tr>
</table>

<small>※ タスクが accepted に達した契機で、§2.6 二段 decompose により実装ノードが未見積で誕生。見積カバレッジが 100%→33% に低下するのは「未見積の作業を発見した」正直な信号。達成率はタスクのみの合意済み基底で 100%（実装は未合意ゆえ分母に入らない）。カバレッジ 33% と対で de-rate して読む。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After②.5 — 実装見積を提案中）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積もり済み <b>33%</b>（1/3・合意済みベース）<span style="color:#b45309">／提案あり 2 ノード</span><br>達成率 <b>100%</b>（2人日 / 2人日・据え置き）<br><span style="color:#b45309;font-size:11px">⚑ 提案（proposed）はカバレッジを回復させない（回復は合意 agreed 後）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">accepted</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 2人日・EV寄与 2</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 実装-1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">8人日（未承認）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 実装-2</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">6人日（未承認）</td>
  </tr>
</table>

<small>※ 実装ノードに見積案が提示されたが、まだ未承認（proposed）。見積カバレッジは 33% のまま（proposed はカバレッジに算入されない＝回復は人間の合意 agreed 後）。達成率も 100% のまま据え置き。estimate-spec-proposed と同型の性質。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After③ — 実装見積を合意）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積もり済み <b>100%</b>（3/3）<span style="color:#16a34a">回復</span><br>達成率 <b>12.5%</b>（2 / 16）<span style="color:#dc2626">↓ 正直に低下（実装を確約）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">accepted</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">凍結 2人日・EV寄与 2</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装-1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 8人日・凍結確定・EV寄与 0（未着手）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装-2</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 6人日・凍結確定・EV寄与 0（未着手）</td>
  </tr>
</table>

<small>※ この合意以降、実装フェーズ（kiro-impl）に進める。達成率が 100%→12.5% に下がるのは異常ではなく、実装という本体作業を発見・確約したぶんの正直な信号（MODEL P5(c)）。実際の着手（pending→implementing）は割当を要し別ユニット。</small>

### 履歴画面（activity・新規サーフェス）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🕓 履歴画面（activity・新規）（After③）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">たった今</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">太郎が <b>実装の見積案を承認</b>（実装-1 8人日 / 実装-2 6人日・<span style="color:#16a34a">承認済み</span>）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>実装ノード群と見積案</b> を提示（タスクファイルに接地・<span style="color:#b45309">未承認</span>）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">太郎が <b>タスク分解のレビューを承認</b>（タスク作業を受け入れ）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>タスク分解を完了</b>（タスクファイルを出力）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">太郎が <b>タスクの見積案を承認</b>（タスク 2人日・<span style="color:#16a34a">承認済み</span>）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>ディスカバリーを完了</b>（spec 修正不要 → タスクのみ展開。要件定義・設計は省略）</td>
  </tr>
</table>

**データ（After② — タスク完了・実装誕生・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 凍結値 | P2 への算入 |
|---|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | — | （中間ノード） |
| └ タスク | accepted | agreed | 2人日 | 2 | ✅ 合意済み |
| └ 実装-1 | pending | なし | — | — | ❌ 未見積（分母のみ） |
| └ 実装-2 | pending | なし | — | — | ❌ 未見積（分母のみ） |

見積カバレッジ（P2・葉基底）：**33%**（合意済み有効葉 1 / 既知の有効葉 3）<br>
達成率 EV%：**100%**（EV_abs 2 / 合意済み最新見積 2）<br>
<small>※ 実装が未見積ゆえの見かけ上の 100%。カバレッジ 33% と対で de-rate して読む。</small>

**データ（After②.5 — 実装見積 proposed・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 凍結値 | P2 への算入 |
|---|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | — | （中間ノード） |
| └ タスク | accepted | agreed | 2人日 | 2 | ✅ 合意済み |
| └ 実装-1 | pending | proposed（未承認） | 8人日 | — | ❌ 未合意（分母のみ） |
| └ 実装-2 | pending | proposed（未承認） | 6人日 | — | ❌ 未合意（分母のみ） |

見積カバレッジ（P2・葉基底）：**33%**（合意済み有効葉 1 / 既知の有効葉 3・proposed はカバレッジに算入されない）<br>
達成率 EV%：**100%**（EV_abs 2人日 / 合意済み最新見積 2人日・据え置き）<br>
提案済みノード数：**2/2**（実装ノード）／確定（凍結）した数値：**なし（実装分）**

**データ（After③ — 実装合意済み・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 凍結値 | P2 への算入 |
|---|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | — | （中間ノード） |
| └ タスク | accepted | agreed | 2人日 | 2 | ✅ |
| └ 実装-1 | pending | agreed | 8人日 | 8 | ✅ |
| └ 実装-2 | pending | agreed | 6人日 | 6 | ✅ |

見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 3 / 既知の有効葉 3）<br>
凍結済み合計：**16人日**（2 + 8 + 6）<br>
達成率 EV%：**12.5%**（EV_abs 2 / 合意済み最新見積 16）<br>
<small>※ 達成率が 100%→12.5% に下がるのは正直な信号（MODEL P5(c)）。タスク分解は完了しているが、実装という本体作業を発見・確約したぶん分母が増えた。**この合意以降、実装フェーズ（kiro-impl）に進める**。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | decompose **3 件**（①フィーチャー誕生・②タスクのみ展開・③タスク見積提示）＋ transition **1 件**（④タスク見積合意）＋ transition **2 件**（⑤⑥タスク lifecycle）＋ decompose **2 件**（⑦実装ノード誕生・⑧実装見積提示）＋ transition **2 件**（⑨⑩実装見積合意）＝計 **10 件**（下記 JSON） |
| **会話ログ**（`.kiro/specs/F/brief.md` / `.kiro/specs/F/conversations/{日付}-discovery-direct-impl-agreed.md`） | ディスカバリー結果（spec 修正不要の判断根拠）・タスク分解の成果物・見積案と根拠・合意の記録 |
| **履歴画面（新規）** | ディスカバリー完了・タスク見積承認・タスク分解完了・タスクレビュー承認・実装見積提示・実装見積承認 の各行（§4） |

### イベント群

```json
[
  {
    "id": "e001", "ts": 1,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "root",
    "reason": "kiro-discovery: spec 修正不要と判断し新規フィーチャーを立ち上げ",
    "children": [{ "node": "F" }]
  },
  {
    "id": "e002", "ts": 2,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "spec 修正不要のため req/design を省略しタスクのみ展開（A1 射程：フェーズ展開の省略は人間のコミット判断）",
    "children": [{ "node": "F/tasks" }]
  },
  {
    "id": "e003", "ts": 3,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "brief からタスク分解の規模を初期見積として提案（未承認）",
    "children": [{ "node": "F/tasks", "estimate": 2 }]
  },
  {
    "id": "e004", "ts": 4,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 2
  },
  {
    "id": "e005", "ts": 5,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "lifecycle",
    "to": "implemented"
  },
  {
    "id": "e006", "ts": 6,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "lifecycle",
    "to": "accepted"
  },
  {
    "id": "e007", "ts": 7,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "タスク受け入れ後、タスクファイルのトップレベル項目から実装ノードを発見（未見積で誕生＝R-E1b）",
    "children": [
      { "node": "F/impl-1" },
      { "node": "F/impl-2" }
    ]
  },
  {
    "id": "e008", "ts": 8,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "タスクファイルを入力に実装の規模を見積もり提案（est(impl)・未承認）",
    "children": [
      { "node": "F/impl-1", "estimate": 8 },
      { "node": "F/impl-2", "estimate": 6 }
    ]
  },
  {
    "id": "e009", "ts": 9,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/impl-1",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 8
  },
  {
    "id": "e010", "ts": 10,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/impl-2",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 6
  }
]
```

<small>注：ノード ID（`F`, `F/tasks`, `F/impl-1` 等）・ts 値はいずれも例示で実装が決める。**e001–e004 は前段セットアップの詳細化**（e001–e002 は §3 When 句が語るディスカバリー判断の起点、e003–e004 はタスク見積——§3 の Then 句が言及しない暗黙の前提条件。姉妹ユニットが独立にカバーするメカニクス。MODEL 整合のためにイベント列に含む）。**e001**: F の誕生。**e002**: フェーズ展開——spec 修正不要の判断によりタスクのみ（req/design は子に含まない）。通常の discovery-spec-initialized（req/design/tasks の 3 子）とは異なり、A1 射程の省略パス。**e003**: brief からタスク見積を提案（§2.3 前倒し見積）。**e004**: 人間がタスク見積を合意。**e005 以降が §3 のふるまいの範囲。e005**: タスク分解作業の完了（タスクファイル出力）——実際には pending→ready→implementing→implemented の中間遷移を経由するが、図は主要遷移のみを示す（中間遷移は省略表記であり、実装は状態機械を遵守する）。**e006**: レビュー承認（implemented→accepted・⟿ 人間のレビュー判断）。**e007**: §2.6 二段 decompose——タスク受け入れを契機に実装ノードを未見積で誕生。**e008**: est(impl) がタスクファイルを入力に見積提案（⟿ `moira-estimate-propose`・⚠未実装）。**e009–e010**: 人間が実装見積を合意（⟿ `moira-estimate-agree`・⚠未実装）。event 型は `moira/backend/src/types.ts` の `DecomposeEvent`/`TransitionEvent` に一致。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者がディスカバリーの結果を踏まえ「spec の修正は不要」と判断したとき、**システムは** 要件定義・設計のフェーズノードを生成**してはならない**。
- **WHEN** 開発者がディスカバリーの結果を踏まえ「spec の修正は不要」と判断したとき、**システムは** タスク分解を行い、タスクファイル（作業分解の成果物）を出力**しなければならない**。
- **WHEN** タスクファイルが出力されたとき、**システムは** それをレビューに回し、レビューの結果を受け入れ判断として記録**しなければならない**。
- **WHEN** タスクノードが受け入れられたとき（lifecycle が accepted に遷移）、**システムは** 実装ノード群をフィーチャーの子として生成**しなければならない**。
- **WHEN** 実装ノードが生成されたとき、**システムは** それらを見積なしの状態で生成し、見積もり済みの割合が下がることを表示に反映**しなければならない**（まだ見積もられていない作業が増えたという正直な信号）。
- **WHEN** 開発者が見積スキルを打鍵したとき、**システムは** 実装ノードの見積案を「提案中（未承認）」として提示**しなければならない**。
- **WHEN** 開発者が見積案を承認したとき、**システムは** 見積を「合意済み」として記録し、その値を凍結**しなければならない**。
- **WHEN** 実装の見積が合意されたとき、**システムは** 実装フェーズ（kiro-impl）に進められる状態を表示**しなければならない**。
- **WHILE** 実装の見積が未承認である間、**システムは** その見積値を確定（固定）**してはならない**。
- **WHEN** 要件定義・設計フェーズが省略されたとき、**システムは** タスク・実装ノードの状態の進み方（pending→ready→implementing→…）を変更**してはならない**（フェーズ省略は木構造の有無であって、各ノードの状態遷移ルールの変更ではない）。

## 7. 決定事項

- **フェーズ展開の省略は MODEL A1 の射程内:** 要件定義・設計フェーズの省略は「分解の深さ＝人間のコミット判断（§2.1#4 / P0）」として正典が明示的に許容するパス。バグ修正や運用タスクも同様にフェーズを省略しうる。これは例外ではなくノードの形態の一つ。
- **タスク分解は省略されない（人間の意図）:** §3 により「タスク分解は必ず行われ、タスクファイルは必ず出力される」が人間の確定した意図。spec 修正が不要な場合でも、タスク分解はスキップしない。これは MODEL A1 に規定される構造的制約ではなく、本シナリオにおける人間のコミット判断。
- **タスクノードの見積は §3 のスコープ外（前提セットアップとして §5 に含む）:** §3 の When 句はディスカバリー（e001–e002 に相当する判断の起点）を語り、Then 句はタスク分解→レビュー→実装見積の流れを語る。一方、タスクノード自体の見積（e003/e004）はユーザーが §3 に含めなかった（タスク見積は指定外）。§5 イベント列に e003/e004 を含むのは MODEL 整合のためであり、§3 の When が語るディスカバリー判断の起点は忠実に保つが、タスク見積ステップは §3 の Then に言及がない＝暗黙の前提条件として扱う。**本ユニットの独自価値は「spec スキップ→タスク分解→レビュー→実装見積合意」というフェーズ省略パス全体にあるが、e001–e004 のイベントは前段セットアップの詳細化**であり、ディスカバリー・タスク見積のメカニクス自体は姉妹ユニット（discovery-spec-initialized / estimate-spec-proposed / estimate-spec-agreed）が独立にカバーする。タスク分解が軽微な場合は見積を畳んで cost 計上できる（R-E2b）。
- **二段 decompose はフェーズ省略時も適用:** §2.6 の二段 decompose（タスク accepted を契機に実装ノード誕生）は、req/design フェーズの有無に依存しない。契機は tasks ノードの accepted であり、前段フェーズの存在は条件でない。
- **実装ノードの依存辺:** 通常のフルフェーズ展開では `design → impl` の依存辺が張られるが（§2.6 DAG）、本シナリオでは design ノードが存在しないため、**実装ノードには明示的な依存辺がない**。実装ノードは生成された時点で pending（依存充足不要で ready に進める）。これは design を省略したことの構造的帰結であり、tasks accepted を契機に生まれた時点で work-ready であることを意味する。
- **タスク lifecycle での中間遷移の省略表記:** §5 では e005 を `to: "implemented"` として示しているが、実際には `pending→ready→implementing→implemented` の遷移が間に入る。図は主要イベントのみを示す省略表記であり、**実装は状態機械を遵守する**（省略は図の簡約であり、実装上の遷移スキップではない）。§6 EARS の「状態の進み方を変更してはならない」はこの規律を明示する。
- **既存ユニットとの境界:** `discovery-spec-initialized`（フルフェーズ展開）と本ユニット（タスクのみ展開）は、ディスカバリーの**判断結果が異なるだけ**で前提は同じ。`estimate-impl-agreed`（実装見積合意）は前提にフルフェーズの完了を含むが、本ユニットの実装見積合意パートと同型。
- **レビュー作業ノードは対象外:** タスク分解のレビュー作業のノード化は `review-work-estimated` の責務であり、本ユニットの対象外。レビュー工数をノード化するか畳むかは人間のコミット判断（P0）に属し、本ユニットはその判断を行わない。
- **見積案の拒否（差し戻し）・部分合意は対象外:** 本ユニットは happy path（全ノード一括合意）のみ。差し戻しは将来の別ユニット。
- **activity(新規) サーフェスの spec は未作成:** `moira-surface-activity` spec は未設計・未作成のため `touches_specs` に列挙できない。§4 の履歴画面モックアップは前段ユニット群（estimate-spec-proposed §7）で新規要件化が決定済みのサーフェスの描画であり、正式な要件定義は activity spec 新設時に行う。
- **touches_requirements のフォーマットは既存 agreed ユニット群の慣行に従う:** コロン区切りグルーピング形式（`"moira-core: 3.1, 3.2, ..."`）は全既存 agreed ユニット（discovery-spec-initialized, estimate-spec-proposed, estimate-spec-agreed, estimate-impl-agreed, enhancement-spec-discovered）と同一の慣行。`trace-notation.md` の `<feature-name>/<ID>` 記法との統一は全ユニット共通の課題であり、本ユニット個別の修正ではなく慣行レベルで解決する。
- **先行辺なしノードの ready 判定は MODEL の既知 nit:** 依存辺が 0 本のノードが自明に ready になるかは MODEL §2.5/R-D1 の未処理ケース。本ユニット固有ではなく、姉妹ユニット群にも共通する論点。本ユニットでは §7「実装ノードの依存辺」で「依存充足不要で ready に進める」と記述するが、これは design が存在しないことの構造的帰結として解釈しており、MODEL が明示的に規定するまで暫定とする。

検証：doc-adversary×3（R1・G1–G4＋SC1–SC7）→ 著者パッチ（10 件全解消）→ doc-fact-checker（R1＝8 主張中 7 CONFIRMED・1 件 §7「completed」→正典「accepted」訂正・トレース/JSON/算術/MODEL引用 現物照合・SOURCE_SET: OK）＋ doc-adversary×1（R2 再攻撃＝R1 パッチ 8 件全解消を再検証・新規 Important 5 件）→ 著者パッチ（After②.5 データ表追加・§3/§7 スコープ境界の整合・EARS「タスクノード」明確化・EV%「人日」単位明示・契機「accepted」統一）→ doc-gate-judge **PASS**（生存 Critical/Important = 0・SOURCE_SET_CONFIRMED・FORK ルーティング済み・停止性充足）。先行辺なしノードの ready 判定・touches_requirements 記法統一・activity spec 未作成は MODEL/慣行レベルの既知 nit（姉妹ユニットと同一）として開示のみ。
