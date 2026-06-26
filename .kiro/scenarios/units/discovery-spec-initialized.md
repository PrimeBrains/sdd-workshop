---
id: units/discovery-spec-initialized
title: ディスカバリーで新規フィーチャーと未見積のフェーズノードが誕生する
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: 開発者が spec の元になる情報（説明文・チケット）を持っているが、プロジェクトにまだ対象のフィーチャーノードが存在しない
postcondition: 新しいフィーチャーと、その下の要件定義・設計・タスクのフェーズノードが、すべて未見積・未割当で存在する（見積カバレッジ 0%）
touches_specs:
  - moira-core
  - moira-surface-spec-value
  - moira-schedule
touches_requirements:
  - "moira-core: 3.2, 5.1"
  - "moira-surface-spec-value: 1.1, 4.1, 4.3"
  - "moira-schedule: 3.1"
---

# ディスカバリーで新規フィーチャーと未見積のフェーズノードが誕生する

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

開発者がディスカバリーを実行すると、**新しいフィーチャーとその下のフェーズノード（要件定義・設計・タスク）が、すべて未見積・未割当で誕生し**、開発者がそれを画面で一目で区別できること。実装の行はまだ生まれない。

## 2. 前提（Given）

開発者が新しい spec の元になる情報（説明文・外部チケットの情報）を持っているが、まだフィーチャーノードは存在しない。

| ノード | 見積もり | 状態 | 担当 |
|---|---|---|---|
| （まだない） | — | — | — |

見積もり済みの割合：**N/A**（ノードが存在しない）

## 3. ふるまい（When / Then）

```
When  開発者が、自分で書いた説明と、チケット（GitLab / Jira 等）から読み込んだ情報を渡して、
      新しい spec のディスカバリーを始める。
Then  ディスカバリーの結果が brief.md としてまとまり、それを基に新しいフィーチャーが 1 つ生まれる。
And   そのフィーチャーの子として「要件定義」「設計」「タスク」の行が、すべて見積なしで一緒に並ぶ。
And   実装の行はまだ生まれない（このユニットの対象外）。
And   見積もり済みの割合（カバレッジ）が 0% として表示される。
And   生まれた直後はどの行も誰にも割り当てられておらず、未割当のバックログに並ぶ（スケジュールにはまだ載らない）。
And   担当者を決めるのはこのユニットの対象外（見積のパスでまとめて決める＝別ユニット）。
And   開発者は画面を見て、「新しいフィーチャーと、その下の要件定義・設計・タスクが、まだ見積もられて
      いない状態で並んでいる」「まだ誰にも割り当てられていない」と一目で分かる。
```

<small>注：「ディスカバリー」の実体は `kiro-discovery`。担当者決めは別ユニット `assign-spec-provisional`（見積のパスで実行）。</small>

## 4. 画面の変化（Before → After）

### spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before）</td></tr>
  <tr>
    <td colspan="4" style="padding:20px;border:1px solid #cbd5e1;color:#94a3b8;text-align:center">— フィーチャーがまだありません —</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（新規フィーチャー）</b></td>
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

<small>※ レビュー作業ノード（各フェーズのレビュー）はこの時点ではまだ木に無い——後続の計画ユニット `review-work-estimated` で feature の子として追加・見積される。本ユニットはその前段ゆえ要件定義・設計・タスクの 3 葉のみを描く。</small>

### schedule-time 画面 — 未割当バックログ

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 未割当バックログ（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 担当 |
|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | なし |
| └ 要件定義 | pending | なし | — | なし |
| └ 設計 | pending | なし | — | なし |
| └ タスク | pending | なし | — | なし |

見積カバレッジ（P2・合意済みベース）：**0%**（有効葉 3、合意済み見積 0）<br>
未割当バックログ：**3 件**（下記 §7 注参照）

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | decompose イベントが **2 件**追記される（下記 JSON） |
| **会話ログ**（`.kiro/specs/F/brief.md`） | ディスカバリーの結果（説明文・チケット情報・分析・フィーチャー定義） |
| **spec-value 画面** | フィーチャー F とフェーズ子ノードがツリーに出現（§4） |

```json
[
  {
    "id": "e001", "ts": 1,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "root",
    "reason": "kiro-discovery で新規 spec を立ち上げ",
    "children": [
      { "node": "F" }
    ]
  },
  {
    "id": "e002", "ts": 2,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "§2.6 ①: フィーチャー初期化でフェーズ子ノードを展開",
    "children": [
      { "node": "F/req" },
      { "node": "F/design" },
      { "node": "F/tasks" }
    ]
  }
]
```

<small>注：ノード ID（`F`, `F/req` 等）・ts 値・親ノード名（`root`）はいずれも例示であり、実装が決める。e001 はフィーチャー自体の誕生、e002 は §2.6 ① の二段 decompose 第一段（フェーズ子ノード展開）。いずれも見積なし（`estimate` フィールドを省略）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者がディスカバリーを完了したとき、**システムは** 新しいフィーチャーと、その下に要件定義・設計・タスクの 3 つの行を生成**しなければならない**。
- **WHEN** 行が生まれたとき、**システムは** すべての行にライフサイクル状態管理（`pending` → `ready` → `implementing` → `implemented` → `accepted`、および `cancelled`）を適用**しなければならない**。
- **WHEN** すべての行が未見積のとき、**システムは** 見積もり済みの割合を 0% と表示**しなければならない**。
- **WHEN** すべての行が未割当のとき、**システムは** それらを未割当の一覧に表示**しなければならない**。
- **WHEN** ディスカバリーが完了したとき、**システムは** 実装の行を生成**してはならない**。
- **WHEN** ディスカバリーが完了したとき、**システムは** 担当者を自動で割り当て**てはならない**。

## 7. 決定事項

- 実装ノードは**二段 decompose**（MODEL §2.6）により、タスクが受け入れられてから生まれる。ディスカバリー時点では存在しない。見積カバレッジの分母にも含めない。
- フェーズ子ノードは**要件定義・設計・タスクの 3 つ**。有効葉は 3 ノード。
- 担当者決めはこのユニットの対象外。別ユニット `assign-spec-provisional` で扱う。
- **未割当バックログの資格:** §3 は「未割当のバックログに並ぶ」と記述しているが、moira-schedule Req 3.1 の正式定義は「**合意済み**有効葉のうち被割当者がないもの」である。ディスカバリー直後のノードはまだ見積がない（合意以前）ため、正式定義のバックログには含まれない可能性がある。§4 では §3 の記述に忠実に未割当一覧に表示しているが、**未見積ノードがバックログに載るかどうかは表示設計で検討する**（spec-value の可視ギャップ P0 とは区別されている。P0 の未見積可視化と schedule-time の未割当バックログは異なるコンセプト）。
