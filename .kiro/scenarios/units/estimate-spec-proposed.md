---
id: units/estimate-spec-proposed
title: 要件定義・設計・タスクの見積案が「未承認の提案」として現れる
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, activity(新規)]
precondition: 新規 spec の要件定義・設計・タスクのフェーズノードが、見積なしで存在する
postcondition: 要件定義・設計・タスクに未承認の見積案が付き、実装は見積なしのまま（承認・確定は未実施）
touches_specs:
  - moira-core
  - moira-surface-spec-value
touches_requirements:
  - "moira-core: 3.2, 4.1"
  - "moira-surface-spec-value: 1.1, 4.1, 4.3, 7.1"
---

# 要件定義・設計・タスクの見積案が「未承認の提案」として現れる

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

新規 spec のフェーズノードに対し開発者が見積を依頼すると、**要件定義・設計・タスクの見積「案」が、まだ自分が承認していない状態として**現れ、「案は出たが承認はこれから」と一目で区別できること。

## 2. 前提（Given）

新規 spec `F` が取り込まれ、要件定義・設計・タスクのフェーズノードが**まだ見積なし**で並んでいる。

| ノード | 見積状態 | 見積値 | lifecycle |
|---|---|---|---|
| F（フィーチャー） | — | — | pending |
| └ 要件定義 | なし | — | pending |
| └ 設計 | なし | — | pending |
| └ タスク | なし | — | pending |

見積カバレッジ（P2）：**0%**

## 3. ふるまい（When / Then）

```
When  開発者が見積を依頼する（見積skill を打鍵する）
Then  Claude が要件定義・設計・タスクの見積案を、根拠つきでまとめて提示する
        例: 要件定義 = 3人日 / 設計 = 5人日 / タスク = 2人日
And   その見積案が「未承認の提案」として、プロジェクトの記録に 1 件書き込まれる
And   spec-value 画面で、要件定義・設計・タスクに「提案中（未承認）」の印が付く
And   見積もり済みの割合が 0% から大きく上がる（要件定義・設計・タスクの3つが見積もられる）
And   履歴画面に「見積案を提示」の行が 1 件増える
And   まだ承認も確定もしていない（この時点で数値は固定されない）
And   実装は見積なしのまま（タスク分解の完了後に別途見積もる＝このユニットの対象外）
```

<small>注：「見積skill」の実体は `moira-estimate-propose`（仮称・⚠未実装）。「履歴画面」は §7 で新規要件化を決定済み。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value 中心**（ガントのタイムライン進捗表示は採らない＝§7 決定）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before — 見積なし）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ <b>0%</b> <span style="color:#dc2626">⚠ 低</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After — 提案中）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ <b>0%</b>（合意済みベース）<br><span style="color:#b45309">提案あり 3/3 ノード</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">3人日</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">5人日</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">2人日</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🕓 履歴画面（新規）（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">たった今</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>要件定義・設計・タスクの見積案</b> を提示（要件定義 3人日 / 設計 5人日 / タスク 2人日・<span style="color:#b45309">未承認</span>）</td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | P2 カバレッジへの寄与 |
|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | （中間ノード） |
| └ 要件定義 | pending | proposed（未承認） | 3人日 | ❌ 未合意 |
| └ 設計 | pending | proposed（未承認） | 5人日 | ❌ 未合意 |
| └ タスク | pending | proposed（未承認） | 2人日 | ❌ 未合意 |

見積カバレッジ（P2・合意済みベース・葉基底＝MODEL v18）：**0%**（合意済み有効葉 0 / 既知の有効葉 3）<br>
提案済みノード数：**3/3**／確定（凍結）した数値：**なし**

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | decompose イベントが **1 件**追記される（下記 JSON） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-estimate-proposed.md`） | 提示した案・根拠・「承認は未」 |
| **履歴画面（新規）** | 「見積案を提示」の 1 行（§4） |

```json
{
  "id": "e010", "ts": 10,
  "actor": { "kind": "agent", "id": "claude" },
  "kind": "decompose",
  "parent": "F",
  "reason": "要件定義・設計・タスクの規模から初期見積を提案（未承認）",
  "children": [
    { "node": "F/req", "estimate": 3 },
    { "node": "F/design", "estimate": 5 },
    { "node": "F/tasks", "estimate": 2 }
  ]
}
```

<small>注：ノード ID・ts 値はいずれも例示であり、実装が決める。見積の値と `proposed`/`agreed` 状態は被見積ノード（フェーズノード）に乗る（MODEL R-E1）。decompose は既存子ノードの見積値を設定/改訂する。値は proposed 状態で記録され、人間の合意 transition で agreed に変わる。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が見積を依頼したとき、**システムは** 要件定義・設計・タスクの見積案を「未承認の提案」として提示**しなければならない**。
- **WHEN** 見積案が提示されたとき、**システムは** spec-value 上の要件定義・設計・タスクに「未承認」を示す印を付け**なければならない**。
- **WHEN** 見積案が提示されたとき、**システムは** プロジェクトの記録に提案を 1 件追記し、かつ履歴画面に対応する 1 行を表示**しなければならない**。
- **WHILE** 見積案が未承認である間、**システムは** その見積値を確定（固定）**してはならない**。
- **WHEN** 見積案が提示されたとき、**システムは** 実装の見積状態を変更**してはならない**。

## 7. 決定事項

- 見積の「気づき」は **spec-value 中心**に出す。ガントのタイムラインへ進捗バーで出す案は**採らない**。
- 「見積ログが画面で見える」ために、**履歴（アクティビティ）画面を新規要件として起票する**（moira に履歴 UI が無いため）。
- **見積カバレッジ（P2）と §3 の乖離:** §3 の種は「見積もり済みの割合が 0% から大きく上がる」と記述しているが、MODEL P2 は**合意済み（agreed）見積のみ**を算入する。提案（proposed）段階では P2 は **0% のまま**であり、P2 が上昇するのは人間が合意した後である。§4 はこの現実を反映して P2=0% と表示し、補足として「提案あり 3/3 ノード」を並記する。§3 の「大きく上がる」は、3/3 ノードに**提案中バッジが出現する視覚的変化**を指すと解釈する。提案済みノードの割合を正式な指標として追加すべきかは**設計または MODEL 拡張で検討する**（P2 の修正ではなく、提示の自由の範囲で別途表示する判断が妥当）。
- **decompose による既存子ノードの見積設定/改訂は正典でカバー済み（ESCALATE 不要）:** §5 の decompose は既存子（要件定義・設計・タスク）に `estimate` を載せて見積を記録するが、これは MODEL §2.8（`decompose` ＝「ノードの子と**見積を設定/改訂**（提案・再ベースライン、理由必須）」）および §2.3（「est が見積を産み **decompose で記録**」）が明示的に規定する正典の記録形である。新規子の分解と既存子の見積改訂は同一イベント種別 decompose で扱う——正典どおり。
- **【解決済 / MODEL v17】3フェーズ同時見積と §2.3 入力連鎖:** §3 は要件定義・設計・タスクの見積案を brief から一括提示するが、これは MODEL v17 で**正典化された**——§2.3/R-E1 が「入力連鎖は最大情報の**理想形でありハード前提ではない**」と明記し、下流成果物の存在前に brief から前倒し一括見積してよい（通常の `proposed`、信頼度属性なし）。前倒しは AI 提案であって新たなコミット判断を増やさず、上流入力の成熟に応じ未完了ノードを R-E3 で再見積する。本ユニットの束見積はこの正典に整合。（裁定: `moira-model-update` v16→v17、独立採点者 PASS。）
