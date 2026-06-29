---
id: units/enhancement-spec-discovered
title: 既存の完了フィーチャーへの改修（エンハンスメント）が新フィーチャーとして誕生し、見積案が提案される——既存の確定作業は触らず、実装はまだ生まれない（新規 spec と動きをそろえる）
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, activity(新規)]
precondition: プロジェクトに現行有効な（supersede されていない）既存の完了済みフィーチャー（G）があり、その確定作業（accepted）が成立している。開発者は G への改修（追加要件）の必要性を持っているが、まだエンハンスメント用のフィーチャーノードは存在しない
postcondition: 既存 G は一切変更されず、新しいエンハンスメント・フィーチャー E と要件定義・設計・タスクのフェーズノードが生まれ、各フェーズに未承認の見積案（proposed）が付く。実装ノードは未生成。プロジェクト全体の見積カバレッジは低下し、達成率（EV%）は合意済み領域のみで据え置き
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
touches_requirements:
  - "moira-core: 1.5, 3.2, 4.1, 5.1, 10.2, 11.2"
  - "moira-evm: 1.2, 2.1, 3.1, 3.3, 3.4, 4.1"
  - "moira-surface-spec-value: 1.1, 3.1, 4.1, 4.2, 4.3, 7.1"
---

# 既存の完了フィーチャーへの改修（エンハンスメント）が新フィーチャーとして誕生し、見積案が提案される——既存の確定作業は触らず、実装はまだ生まれない（新規 spec と動きをそろえる）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

完了済みのフィーチャー G がすでにあるプロジェクトで、開発者が **G への改修（エンハンスメント）** を立ち上げると、**新しいエンハンスメント・フィーチャー E が、新規 spec のときと同じ構造で誕生**し（要件定義・設計・タスクのフェーズノードが見積なしで並ぶ）、AI が見積案を提示して「未承認の提案」になること。中核は：

- **既存の完了済み G とその確定作業は一切触られない**（巻き戻し・再オープンしない＝追記専用）。
- 改修は **root 直下の新フィーチャー E** として立ち、新規 spec と同じ discovery→フェーズノード→見積 proposed→実装まだ の流れに乗る。
- E のフェーズノードが見積なし／未承認で増えることで、**見積もり済みの割合（カバレッジ）が下がる**（未見積・未合意の作業を発見した正直な信号）。
- 一方、**達成率（EV%）は本断面では据え置き**——EV% は合意済みの作業だけで測るため、未承認の E では水増しされない。「達成率は高いが、まだ見積もられていない作業がある」をカバレッジと**対で**読む（カバレッジが低い間は EV% を「全体の完了度」と読まない）。
- **実装の行はまだ生まれない**（タスク承認後に別途生まれる＝新規 spec と同じ）。

## 2. 前提（Given）

プロジェクトに既存フィーチャー **G** が完了済み（全葉 accepted・合意済み）で存在する。開発者は G への改修（追加要件）の必要性を持っているが、まだエンハンスメント用のノードは無い。

| ノード | 見積状態 | 見積値 | lifecycle |
|---|---|---|---|
| G（既存フィーチャー・完了済み） | agreed | 10人日（子合計・例示） | accepted |
| └ （G の有効葉：簡約のため計 4 葉と置く例示・内訳は本ユニットの主題外） | agreed | 計 10人日 | accepted |

プロジェクト全体の見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 4 / 既知の有効葉 4）<br>
達成率（EV%・現行進捗）：**100%**（EV_abs 10 / 合意済み最新見積 10）

<small>注：G の有効葉数（計 4・凍結予算合計 10人日）は**対読みの算術を見やすくするための簡約例示**であり、内訳（どのフェーズか）も葉数も本ユニットの主題ではない。**実際の完了フィーチャーは姉妹 `review-work-estimated`（agreed）が確定するとおり各フェーズのレビュー作業葉を持ち、かつ §2.6 二段 decompose で実装は複数葉になりうる**ため、現実の G は 4 葉より多い。よって後段のカバレッジ分母（4→7）と絶対値（100%→57%）は簡約に依存する例示で、実構造では分母が増え**絶対値は変わる**が「誕生でカバレッジが下がり EV% は据え置き」という**質的結論は不変**。G のレビュー作業葉・複数実装葉は本ユニットの範囲外ゆえ図に出さない（「要件定義・設計・タスク・実装」といった具体内訳も G については主張しない）。</small>

## 3. ふるまい（When / Then）

```
When  開発者が、既存の完了済みフィーチャー（例: G）への改修（エンハンスメント）の
      必要性を判定し、新しいエンハンスメントを立ち上げる。
Then  新しいエンハンスメント・フィーチャー E が 1 つ生まれ、その子として
      「要件定義」「設計」「タスク」のフェーズノードが、すべて見積なしで一緒に並ぶ
      （新規 spec のときと同じ構造）。
And   どの既存作業を改修するか（例: G の設計）は、この時点では discovery の結果
      （brief）に記録される。
And   AI が要件定義・設計・タスクの見積案を提示し、それぞれ「未承認の提案」になる。
And   既存の完了済みフィーチャー G とその確定作業は一切触られない
      （巻き戻し・再オープンをしない）。
And   実装の行はまだ生まれない（タスク承認後に別途生まれる＝新規 spec と同じ動き）。
And   見積はまだ承認も確定もしていない（この時点で数値は固定されない）。
```

<small>注：「エンハンスメント（改修）」は既存の完了作業に対する追加要件のこと（MODEL §2.7）。改修を行う実体（置換＝supersede）の構造化は本ユニットより後段（§7）。見積案の提示の実体は `moira-estimate-propose`（仮称・⚠未実装）。「履歴画面」の新規要件化は `estimate-spec-proposed` §7 で決定済み（本ユニットは継承）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value 中心**（`estimate-spec-proposed`・`discovery-spec-initialized` の決定を継承）。**Before**（G のみ）→ **After①**（E 誕生・見積なし）→ **After②**（見積案 proposed）の 3 断面で、新規 spec と同じ「見積なしで生まれ、のちに提案される」流れを示す。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before — 既存 G のみ・完了済み）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569" colspan="4">プロジェクト全体：見積カバレッジ <b>100%</b>（4/4・<b>葉数は§2注の簡約例示</b>）／達成率 EV% <b>100%</b>（10/10）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>G（既存フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 10</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">完了済み（有効葉 4・出来高 10）</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After① — エンハンスメント E 誕生・見積なし）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569" colspan="4">プロジェクト全体：見積カバレッジ <b style="color:#dc2626">57%</b>（4/7）<span style="color:#dc2626">⚠ 低下（未見積の新作業を発見）</span>／達成率 EV% <b>100%</b>（10/10・据え置き）<br><span style="color:#b45309;font-size:11px">⚑ カバレッジが低い間は EV%=100% を「全体の完了度」と読まない（霧の中の既知部分の達成度＝de-rate して対で読む）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>G（既存フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 10</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#64748b">据え置き（一切変更なし）</span></td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>E（新規エンハンスメント）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#b45309">◀ 新規・G の改修（brief に対象記録）</span></td>
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
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After② — 見積案が提案された）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569" colspan="4">プロジェクト全体：見積カバレッジ <b style="color:#dc2626">57%</b>（4/7・合意済みベース）<span style="color:#b45309">／E に提案あり 3/3 ノード</span>／達成率 EV% <b>100%</b>（10/10・据え置き）<br><span style="color:#b45309;font-size:11px">⚑ 提案（proposed）はカバレッジを回復させない（回復は人間の合意 agreed 後）。カバレッジが低い間は EV% を全体完了度と読まない</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>G（既存フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 10</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#64748b">据え置き（一切変更なし）</span></td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>E（新規エンハンスメント）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">提案あり 3/3 ノード（未承認）</td>
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

<small>※ 実装ノードはどの断面にも現れない——二段 decompose（MODEL §2.6）でタスクが受け入れられてから生まれる。本ユニットはその前段ゆえ E のフェーズ 3 葉のみを描く。レビュー作業ノードも本ユニットでは立てない（`review-work-estimated` の責務）。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🕓 履歴画面（新規）（After②）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">たった今</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>エンハンスメント E の要件定義・設計・タスクの見積案</b> を提示（要件定義 3人日 / 設計 5人日 / タスク 2人日・<span style="color:#b45309">未承認</span>）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>エンハンスメント E（G の改修）</b> を立ち上げ、要件定義・設計・タスクのフェーズノードを生成（見積なし。既存 G は変更なし）</td>
  </tr>
</table>

**データ（After②・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | P2 カバレッジへの寄与 |
|---|---|---|---|---|
| G（既存フィーチャー） | accepted | agreed | 10 | （中間ノード・葉は分母に算入済み） |
| └ G の有効葉 ×4 | accepted | agreed | 計 10 | ✅ 合意済み（分子・分母とも 4） |
| E（新規エンハンスメント） | pending | — | — | （中間ノード） |
| └ 要件定義 | pending | proposed（未承認） | 3人日 | ❌ 未合意（分母のみ） |
| └ 設計 | pending | proposed（未承認） | 5人日 | ❌ 未合意（分母のみ） |
| └ タスク | pending | proposed（未承認） | 2人日 | ❌ 未合意（分母のみ） |

見積カバレッジ（P2・合意済みベース・葉基底）：**57%**（合意済み有効葉 4 / 既知の有効葉 7。**G の葉数 4 は §2 注の簡約値**——実構造では分母が増え絶対値は変わるが質的結論は不変）<br>
達成率（EV%・現行進捗）：**100%**（EV_abs 10 / 合意済み最新見積 10。E の未合意葉は分母に入らない＝据え置き。**カバレッジ 57% と対で de-rate して読む**＝EV%=100% を全体完了度と読まない）<br>
提案済みノード数：**3/3**（E のフェーズ）／確定（凍結）した数値：**なし**

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | E 誕生の decompose **2 件**（feature E＋フェーズ子ノード）＋見積案提示の decompose **1 件**＝計 **3 件**（下記 JSON）。**G に対するイベントは 1 件も追記されない**（既存は不変） |
| **会話ログ**（`.kiro/specs/E/brief.md` / `.kiro/specs/E/conversations/{日付}-estimate-proposed.md`） | 改修の背景・**どの既存作業（例: G の設計）を改修するか**・提示した見積案と根拠・「承認は未」 |
| **履歴画面（新規）** | 「エンハンスメント E を立ち上げ」「見積案を提示」の 2 行（§4） |

```json
[
  {
    "id": "e201", "ts": 201,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "root",
    "reason": "既存 G の改修（エンハンスメント）を新フィーチャー E として立ち上げ",
    "children": [
      { "node": "E" }
    ]
  },
  {
    "id": "e202", "ts": 202,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "E",
    "reason": "§2.6①: フィーチャー初期化でフェーズ子ノードを展開（見積なし）",
    "children": [
      { "node": "E/req" },
      { "node": "E/design" },
      { "node": "E/tasks" }
    ]
  },
  {
    "id": "e203", "ts": 203,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "E",
    "reason": "brief から要件定義・設計・タスクの規模を初期見積として提案（未承認）",
    "children": [
      { "node": "E/req", "estimate": 3 },
      { "node": "E/design", "estimate": 5 },
      { "node": "E/tasks", "estimate": 2 }
    ]
  }
]
```

<small>注：ノード ID（`E`, `E/req` 等）・ts 値・親ノード名（`root`）は例示であり実装が決める（event 型は `moira/backend/src/types.ts` の `DecomposeEvent` に一致）。**e201** が E（フィーチャー）の誕生、**e202** が §2.6① の二段 decompose 第一段（フェーズ子ノード展開・`estimate` 省略＝見積なし）、**e203** が既存子（要件定義・設計・タスク）に `estimate` を載せる見積案の提示（decompose は**値を載せ**、見積状態はイベント側ではなく導出側で fold が既定 `proposed` として射影する＝`ProjectedNode.estimateState`）。見積の値と `proposed`/`agreed` 状態は被見積ノードに乗り（MODEL R-E1）、`proposed` は人間の合意 `transition`（estimate-agreement・本ユニットの範囲外）で `agreed` に変わる。**G とその有効葉に対する `transition`／`decompose` は一切発行されない**（append-only＝既存の確定履歴は汚さない）。改修対象（新→旧）を結ぶ supersede の `relate` 辺も、この段階ではまだ張らない（§7）。（e202＝展開 と e203＝見積提示 を分けるのは discovery と estimate が別タイミングの操作であることを示すためで、実装は estimate 付き単一 decompose に畳んでよい。）</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が既存作業への改修（エンハンスメント）を立ち上げたとき、**システムは** 新しいエンハンスメント・フィーチャーと、その下に要件定義・設計・タスクの 3 つのフェーズノードを生成**しなければならない**。
- **WHEN** エンハンスメント・フィーチャーが生まれたとき、**システムは** 既存の完了済みフィーチャーとその確定（承認済み＝accepted）作業を巻き戻し・再オープン**してはならない**（既存の確定作業は触らない）。
- **WHEN** AI が見積案を提示したとき、**システムは** 要件定義・設計・タスクの見積を「未承認の提案」として記録**しなければならない**。
- **WHILE** 見積案が未承認である間、**システムは** その見積値を確定（固定）**してはならない**。
- **WHEN** エンハンスメントのフェーズノードが見積なし／未承認で増えたとき、**システムは** 見積もり済みの割合（カバレッジ）が下がって表示されるよう、その低下を正直に示さ**なければならない**（未見積・未合意の作業を発見した信号）。
- **WHEN** エンハンスメントの未承認・未見積の作業が増えても、**システムは** 達成率（EV%）を合意済みの作業だけで測り、未承認の作業で水増し**してはならない**（達成率は据え置き、カバレッジが下がる＝両者を対で読む）。
- **WHILE** 見積もり済みの割合（カバレッジ）が低い間、**システムは** 達成率（EV%）を単独で全体完了度として提示**してはならない**（カバレッジと対で de-rate して読ませる。併記の具体様式は提示の自由＝MODEL §2.1）。
- **WHEN** エンハンスメントが立ち上がったとき、**システムは** 実装の行を生成**してはならない**（タスク承認後に別途生まれる）。

## 7. 決定事項

- **既存改修＝§2.7(a) エンハンスメント型（root 直下の新フィーチャー）。判定軸＝「新しい価値の追加か／既存成果物の欠陥是正か」。** 本ユニットの「改修」は**追加要件型**——既存 feature を再オープンせず root 直下の新しいエンハンスメント・フィーチャー E として立て、独自の req→design→tasks サイクルを回す（MODEL §2.7 行135「エンハンス(追加要件)は root 直下の新しい feature ノード」「既存 feature の確定履歴は汚さない」）。姉妹 `requirements-spec-superseded` の**欠陥是正**は §2.7(b)（既存完了ノードの変更＝supersede・新ノードは旧の兄弟）で別型。既存 G は append-only で不変（moira-core 1.5/10.2）。なお §2.7 の「req→design→tasks→**実装**サイクル」の実装段は二段 decompose（§2.6）を含意し、本ユニットは第一段（フェーズ展開）直後＝実装ノード生成の前段ゆえ「実装の行はまだ生まれない」は §2.7/§2.6 に整合（新規 spec と同型）。これにより新規 spec の discovery→フェーズノード→見積 proposed→実装まだ の流れと**動きがそろう**。
- **【supersede 辺はこの段階では張らない——根拠は「コミット前で停止」であって正典の断定ではない】** 改修対象の特定は brief に記録するが、置換を表す `relate`（`edgeKind:supersede`）はまだ emit されない（改修対象を旧 G ノードへ結ぶ新ノードが未 commit）ゆえ、supersede 辺はこの段階で存在しない。**置換の機構・配置・生成時期、および §2.7(a) 追加要件型と (b) 完了ノード変更型の合成は MODEL §2.7/R-D7 が未規定の既知 nit**（姉妹 `requirements-spec-superseded` §7【D2】が同じ穴を指摘済み）であり、**本ユニットは supersede のコミット手前で停止するため、この nit を解決せずに描ける**——機構の詳述は下流（`requirements-spec-superseded` / `design-spec-reworked-after-req-redo`）に委ねる。先行ドラフトの「supersede 辺は実装ノードから・タスク承認後に張る」断定は撤回する（姉妹は実装ノードでなく**フェーズノード**から誕生時に supersede を張る反例で、正典は from ノードの種別・時期を限定しない）。「実装の行はまだ生まれない」を新規 spec とそろえるのはユーザー確定の境界（2026-06-29）。
- **【EV% 据え置き×カバレッジ低下の対読み（本断面の観測・固有性は主張しない）】** エンハンスメント誕生で未見積／未合意の葉が増え、見積カバレッジ（P2）は 100%→57%（例示・4/7）に下がるが、達成率 EV%（現行進捗）は合意済み領域のみを語る（R-U8・moira-evm 1.2）ため **本断面では 100% のまま据え置き**。両者を de-rate して対で読む（P0/P2・moira-evm 3.4/4.1）——低カバレッジ時の EV% は「霧の中の既知部分の達成度」にすぎない。**提案（proposed）はカバレッジを回復させない**（回復は人間の合意 agreed 後・`estimate-spec-proposed` と同型）。ただしこの対読みは「既存合意済み作業がある所へ未見積の新作業が増えれば起きる**一般現象**」（姉妹 `review-work-estimated` の During も同型の低下を描く）であり**エンハンスメント固有ではない**——本ユニットでは独自価値ではなく**検証される副次プロパティ**として扱う（独自価値は末尾参照）。
- **【見積カバレッジ（P2）と §3 の乖離・前倒し一括見積】** §3 の「見積案が提案される」に対し MODEL P2 は**合意済み（agreed）見積のみ**を分子に算入するため、proposed 段階では分子は動かず P2 は 57%（4/7）のまま回復しない（回復は合意後）。§4 は「提案あり 3/3 ノード」を併記する（§3 の「proposed になる」＝提案中バッジが出現する視覚的変化・`estimate-spec-proposed` §7 と同じ正直化）。要件定義・設計・タスクを brief から一括提示する前倒し見積は MODEL §2.3/R-E1 の正典（入力連鎖は理想形・ハード前提でない・通常の `proposed`）に整合し、AI 提案ゆえ新たなコミット判断を増やさない（`estimate-spec-proposed` §7 を継承）。
- **【担当決め・レビュー作業ノードは対象外】** 割当（assignee）と未割当バックログはこのユニットの対象外（`estimate-spec-proposed` と同型・別ユニット `assign-spec-provisional`）。各フェーズのレビュー作業ノードの計画・見積は `review-work-estimated` が扱う。本ユニットはフェーズ 3 葉のみを描く。
- **【スコープ外のエッジケース／R-D7「completed」射程 nit】** 次は本ユニットの射程外：① 見積案の**拒否**（proposed のまま合意しない／差し戻し・`estimate-spec-proposed`/`review-work-estimated` の FORK 方針）、② **部分合意**（req だけ agreed で design/tasks 未合意＝カバレッジが中間値）、③ 改修対象が**複数フィーチャーにまたがる**場合（本ユニットの単一 E 前提を超える）、④ 改修対象が**未完了（implemented 等）だった**場合（§2.7(b)/R-D7 は完了ノード前提ゆえ、未完了なら supersede でなく後退遷移＝`design-spec-reworked-after-req-redo` の射程）、⑤ E 自体の**キャンセル**（`cancel-task-midway` の射程）。⑥ 改修対象 G が**既に supersede 済み（旧版）**だった場合（多重 supersede・P2 の現行有効集合の扱いが変わる）。precondition が G を「現行有効な完了済み（accepted）」に限定するのは ④ を後退遷移系と、⑥ を多重 supersede と分けるため。なお R-D7 の "completed" が accepted 限定か implemented を含むかは MODEL 用語の**既知 nit**（姉妹 `requirements-spec-superseded`/`design-spec-reworked-after-req-redo` の D3 と同一）で、本ユニットは accepted＝確定済みを前提とする。
- **【EV% 据え置きは本断面の性質】** 「EV% 据え置き」は本断面（E が未合意）での性質であり、E のフェーズが将来 agreed になれば分母が拡大して EV% は低下しうる（MODEL P5 の正直な非単調＝別ユニット）。永続的性質ではない。
- **【§3 And「brief に記録」は人間の種の転記】** §3 の「どの既存作業を改修するかは brief に記録される」は、ユーザーが起動時に語った「（discovery で既存改修となったら）その時点でどの spec に修正が入るかが洗い出される」（2026-06-29）の忠実な転記であり、AI が発案した boundary ではない。

検証：doc-adversary×3（R1・G1–G4＋SC1–SC7）→ 著者パッチ → doc-fact-checker（R2＝NO_OBJECTION・トレース/JSON/算術/MODEL引用 現物照合・SOURCE_SET: OK）＋ doc-adversary×2（R2 再攻撃＝収束Critical解消・独自価値正直化）→ パッチ → doc-adversary×1（R3 最終再攻撃＝G葉数内訳の抽象化・EARS緩和）→ パッチ → doc-gate-judge **PASS**（生存 Critical/Important = 0・SOURCE_SET_CONFIRMED・FORK ルーティング済み・停止性充足）。supersede 生成時期/配置・§2.7(a)(b) 合成・R-D7 "completed" 射程は MODEL 未規定の既知 nit（姉妹 D2/D3 と同一）として開示のみ（本ユニットは supersede コミット手前で停止ゆえ解決不要）。
- **【本ユニットの位置づけ＝既存改修トリガーの受け入れ基準（機構は新規でない・正直化）】** イベント列は `discovery-spec-initialized`（誕生）＋`estimate-spec-proposed`（見積提示）のエンハンスメント版で、**新しい導出機構は何も導入しない**。固有の差分は **(i) discovery が『既存改修』と判定するトリガー**（§3 And「どの既存作業を改修するかが brief に記録される」——`discovery-spec-initialized` の『真新しい spec』とは別の入口）の一点である。残りの (ii) 新規 spec と同型に launch＋proposed されること・(iii) 既存の確定作業を触らないこと（append-only）・(iv) supersede コミットの手前であることは、**独自価値ではなく、この入口でも新規 spec と挙動が一致し既存を壊さないことを確かめる回帰・安全の確認**（姉妹と同型であること自体が検証対象）であって、新規性は主張しない。本ユニットの存在意義は「既存改修という入口に対し、新規 spec と同じ launch＋proposed 挙動・既存不可侵・supersede 手前を**受け入れ基準として固定する回帰シナリオ**」である（`requirements-spec-superseded`/`design-spec-reworked-after-req-redo` は supersede／後退遷移が**起きた後**の隣接断面）。**§4 を 3 断面で描くのは §3 への忠実性**——§3 の Then は「フェーズノードが**見積なし**で並ぶ」と「見積案を提示し**proposed** になる」を別個の And として語っており、After①（見積なし）と After②（proposed）は人間が記述した 2 状態の忠実な描き起こしである（どちらを畳んでも §3 の語った状態の一方が画面から落ちる）。
