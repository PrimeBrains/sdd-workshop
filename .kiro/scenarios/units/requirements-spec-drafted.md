---
id: units/requirements-spec-drafted
title: 要件定義を打鍵すると成果物ができ「レビュー待ち（玉が人間へ・レビュー担当は太郎）」になり、出来高が上がる
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: 要件定義・設計・タスクの見積が合意済みで、要件定義の作業はまだ着手前（pending）
postcondition: 要件定義が「作成完了・レビュー待ち（implemented）」になり、玉（次に動く側）が作成したエージェントから人間（レビュー担当＝太郎）に渡って人間レビュー待ち一覧に現れ、出来高（EV%）が要件定義分だけ上がる。人間の承認はまだ未実施
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6"
  - "moira-evm: 1.1, 1.2"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 5.3, 10.1, 11.1, 11.2, 11.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.4"
  - "moira-surface-schedule: 2.5, 8.1, 3.4, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3"
---

# 要件定義を打鍵すると成果物ができ「レビュー待ち（玉が人間へ・レビュー担当は太郎）」になり、出来高が上がる

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。各画面要素は**定義済み要件**（frontmatter のトレース）への参照を併記します。スライス未実装は中立に「(スライス未描画)」と記し、設計の宿題（赤字）ではありません。

## 1. このユニットで確かめること

見積が合意済みの spec で開発者が要件定義を実際に作る作業（打鍵）を行うと、**要件定義の成果物ができて「レビュー待ち（まだ承認前）」**になり、**そのとき出来高（進捗）が要件定義分だけ上がる**こと（「仕様を書くのも進捗」）。さらに：

- **担当（作業者）が画面で分かる**こと（この打鍵では作業者は Claude＝エージェント）。担当（作業者）は spec-value と schedule の**両画面**に出る（要件: moira-surface-spec-value Req10／moira-surface-schedule Req3）。
- **誰がレビューするか（レビュー担当＝太郎）が per-node で分かる**こと。レビュー担当（reviewer）は作業者（assignee）とは**別**に表示され、作業者が Claude のままでも「次にレビューするのは太郎」と全員に見える（MODEL v19；要件: moira-surface-spec-value Req11／moira-surface-schedule Req3 AC4・Req14／moira-schedule Req14）。
- **いま動くべき側＝人間（レビュー担当）に玉が渡ったことが画面で分かる**こと。玉が **AI（作成中）→ 人間（レビュー待ち）**へ移ったことは、作業が**エージェント作業キューから人間レビュー待ちキューへ移動**することで分かる（要件: moira-surface-schedule Req13）。
- この「レビュー待ち＝玉が人間」は**人間のレビュー待ち一覧に現れる**（横断の decision インボックスには出ない）こと（要件: moira-surface-schedule Req13）。
- 開発者が**レビュー担当を選んで（例：太郎）そのレビュー待ちだけに絞り込める**こと（reviewer フィルタ＝per-node `reviewer` を選んだ担当と突き合わせる提示層フィルタ。視点 actor/『自分』概念は要さない＝MODEL §7#18(f)。要件: moira-surface-schedule Req14。参照スライスは reviewer 選択フィルタ未供給で現状無効）。
- schedule の作業詳細を開くと、**予定開始日・予定終了日・実績開始日・実績終了日**と出来高/計画値/実コストが見えること（要件: moira-surface-schedule Req15／moira-schedule Req13）。

## 2. 前提（Given）

新規 spec `F` のフェーズノード（要件定義・設計・タスク）に見積が合意済みで、要件定義の作業はまだ着手前。レビュー作業ノードは計画段階で 3 葉とも見積合意済み（agreed・pending；ユニット `review-work-estimated` の後）。

| ノード | 見積状態 | 見積値 | lifecycle | 担当（作業者） | レビュー担当 |
|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | — |
| └ 要件定義 | agreed | 3人日 | pending | （打鍵で Claude が着手） | （まだ未指名） |
| └ レビュー作業（要件定義） | agreed | 1人日（例示） | pending（依存未充足・対象外） | —（未着手） | — |
| └ 設計 | agreed | 5人日 | pending | —（本ユニット対象外） | — |
| └ レビュー作業（設計） | agreed | 1人日（例示） | pending（依存未充足・対象外） | —（未着手） | — |
| └ タスク | agreed | 2人日 | pending | —（本ユニット対象外） | — |
| └ レビュー作業（タスク） | agreed | 0.5人日（例示） | pending（依存未充足・対象外） | —（未着手） | — |

見積カバレッジ（P2・**葉基底**＝MODEL v18）：**100%**（合意済み有効葉 6 / 既知の有効葉 6。中間ノード F は I1 ロールアップで独立合意を受けず分母に入らない＝§7。レビュー作業 3 葉は計画段階で合意済み＝ユニット review-work-estimated）／実行カバレッジ（葉基底）：**0%**（`implementing` の葉なし）／EV%（出来高）：**0%**（完了葉なし）

## 3. ふるまい（When / Then）

```
When  要件定義・設計・タスクの見積が承認済み（合意済み）になった spec について、
      要件定義を実際に作る作業を打鍵する（要件定義づくりを実行する）。
Then  Claude が要件定義の成果物を作成し、spec-value 画面で要件定義の行が
      「レビュー待ち（提案された・まだ承認前）」になる。
And   出来高（進捗）が要件定義の分だけ上がる
      （※開発者の見立てでは「進捗が進む（50% くらい）」。実際の数値・上がるタイミングは
        §4/§7 で正典に接地）。
And   いま作業のボール（玉）を持っているのは人間（レビュー担当）だと、画面を見て分かる。
And   この「レビュー待ち＝玉が人間」は、人間のレビュー待ち一覧に現れる
      （横断の decision インボックスには出ない）。
And   開発者は自分の名前で、自分がレビュー担当の項目だけに絞り込んで確認できる。
And   人間の承認（OK を出すこと）は、このユニットの対象外（別ユニット）。
```

<small>注：「要件定義を打鍵」の実体は `kiro-spec-requirements`。これが Claude（エージェント）として成果物を作る。lifecycle を進める書き込みの実体は `moira-progress`（仮称・未実装スキル）。「レビュー待ち」は lifecycle の `implemented`（＝作成完了・仕様FIX判定で、人間の承認 `implemented→accepted` 待ち）。**「玉が人間」は、作成中（implementing）の間はエージェント作業キューに居た作業が、作成完了（implemented）で人間レビュー待ちキューへ移ることで表れる。担当（作業者）は作成者の Claude のまま動かず、新たに現れるのは「レビュー担当（reviewer）＝太郎」（作業者とは別の付帯属性＝MODEL v19）。** 人間の承認 `implemented→accepted` は別ユニットで、出来高は動かさない品質確認（§7）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（状態・担当・レビュー担当・出来高 EV%）＋ schedule-time（担当/レビュー担当・玉＝キュー間の移動・作業詳細）**。ガントに「進捗バー％」は出さない（出来高 EV% は spec-value/health が host、ガントは状態＋予測＋詳細のみ＝前段ユニット `estimate-spec-proposed` §7 と整合）。

### 4-1. spec-value 画面（状態・担当・レビュー担当・出来高）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value 画面（Before — 着手前）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 / 被覆</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（中間ノード＝独立見積なし）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>0%</b>・実行 <b>0%</b>・見積カバレッジ(P2) <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（これから Claude）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（未指名）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 0.5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value 画面（After — 要件定義が作成完了・レビュー待ち）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 / 被覆</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（中間ノード＝独立見積なし）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#16a34a">24%</b>（0%→24%）・実行 <b>0%</b>・見積カバレッジ(P2) <b>100%</b>（不変）<br><span style="color:#b45309">⚑ 要件定義はレビュー待ち（玉＝人間）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（レビュー待ちとして強調）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#94a3b8;font-size:11px">作成者</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span><br><span style="color:#b45309;font-size:11px">◀ 次の手番</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 3人日</b>（＝自分の予算満額・二値）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e0e7ff;border-radius:4px;padding:1px 6px">着手可</span> <span style="color:#64748b">(ready)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未着手）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span> <span style="color:#94a3b8;font-size:11px">（依存元 設計 pending）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 0.5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span> <span style="color:#94a3b8;font-size:11px">（依存元 タスク pending）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ <b>担当（作業者）と レビュー担当 は別の役割</b>（MODEL v19）。作業者は作成した Claude（agent）のまま；レビュー担当は指名された人間 太郎（reviewer・要件: moira-surface-spec-value Req11／moira-core Req6 AC4-6）。担当（作業者）列の表示も含め参照スライス（`SpecValueSurface.tsx`）は未描画＝定義済み要件への目標（スライス未描画）。<b>要件定義「単体」の出来高は EV寄与＝3人日（自分の凍結予算の満額・割合なら 100%・二値）</b>；出力＝作成完了（implemented）の瞬間に満額計上され <b>50% にはならない</b>（部分EV は MODEL v16 で却下）。<b>フィーチャー全体の出来高 EV% は 0%→24%</b>（3 ÷ 3+5+2+1+1+0.5=12.5＝MODEL v18 葉基底。レビュー作業 3 葉も計画段階で合意済みゆえ分母に算入＝ユニット review-work-estimated）。打鍵の<b>最中</b>（implementing）は実行カバレッジが一時 1/6≈17% になるが、<b>仕掛中の量であって出来高ではなく</b>作成完了で 0% に戻る。</small>

### 4-2. schedule-time 画面 — 玉の受け渡し（エージェント作業キュー → 人間レビュー待ちキュー）

「玉が AI→人間に変わった」ことは、作業が**2つのキューの間を移動**することで分かる（玉という一級の状態を新設せず、lifecycle から導出＝§7）。要件: moira-surface-schedule Req13（一覧描画）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 作成中（打鍵の最中・implementing）— 玉＝AI</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義（作成中）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / <span style="color:#94a3b8">レビュー担当 太郎（指名済・出番待ち）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 作成完了（implemented）— 玉＝人間（After）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）← 要件定義はここから抜けた</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>人間レビュー待ちキュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>要件定義</b>（レビュー待ち＝作成完了・承認前）<span style="color:#b45309"> ◀ 玉＝人間</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 <span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
</table>

<small>※ 玉が動いても**担当（作業者）は Claude のまま**——担当（作業者）列は「誰が作った/やる作業か」、レビュー担当列は「次に誰がレビューするか（太郎）」を表す別概念。玉（手番）は lifecycle から導出（`implementing`→エージェント作業キュー、`implemented`→人間レビュー待ちキュー＝actor 非依存・`queues.ts`）。人間レビュー待ちキューの**一覧描画**は要件 moira-surface-schedule Req13（導出 `humanReviewQueue` は backend 実在・キュー自体は actor 非依存で不変＝moira-schedule Req14；一覧の画面描画はスライス未描画）。reviewer の per-node 併置は moira-schedule Req14・moira-surface-schedule Req3 AC4。</small>

### 4-3. schedule-time 画面 — レビュー待ちの reviewer フィルタ（レビュー担当を選んで絞る）

要件: moira-surface-schedule Req14（reviewer フィルタ）。これは per-node の `reviewer` 属性を**選んだレビュー担当と突き合わせる提示層フィルタ**で、認証された『自分』や視点 actor という中間概念を要さない（MODEL §7#18(f)）。MODEL は保持しない（提示層）。参照スライスは reviewer 選択フィルタを未供給のため現状無効（既知ギャップ）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🔎 キュー絞り込み（actor フィルタ）</td></tr>
  <tr>
    <td style="padding:8px 10px;border:1px solid #cbd5e1;width:160px">フィルタ</td>
    <td style="padding:8px 10px;border:1px solid #cbd5e1">
      <span style="border:1px solid #1e3a8a;background:#dbeafe;color:#1e3a8a;border-radius:999px;padding:2px 10px">全員</span>
      <span style="border:1px solid #cbd5e1;background:#f8fafc;color:#475569;border-radius:999px;padding:2px 10px">人間（レビュー/作業）</span>
      <span style="border:1px solid #cbd5e1;background:#f8fafc;color:#475569;border-radius:999px;padding:2px 10px">エージェント</span>
      <span style="border:1px dashed #cbd5e1;background:#f1f5f9;color:#94a3b8;border-radius:999px;padding:2px 10px" title="reviewer フィルタ＝per-node reviewer 属性の選択・提示層・スライス未供給">レビュー担当＝太郎<span style="font-size:11px">（スライス未供給で現状無効）</span></span>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 10px;border:1px solid #cbd5e1">「レビュー担当＝太郎」選択時<br>の期待結果</td>
    <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#eff6ff">
      人間レビュー待ちキューのうち <b>太郎が reviewer の項目だけ</b>に絞り込まれる：<br>
      ▸ <b>要件定義</b>（レビュー待ち・レビュー担当＝太郎）<br>
      <span style="color:#475569">＝選んだレビュー担当（太郎）を per-node の `reviewer` 属性（Actor {kind,id}）と突き合わせて絞る（moira-surface-schedule Req14）。視点 actor/『自分』概念は要さず、絞り込みは提示層ゆえ MODEL 非保持。未指名ノードはどの選択にも一致せず『未指名』ギャップとして可視に残る。</span>
    </td>
  </tr>
</table>

### 4-4. schedule-time 画面 — 作業の詳細（クリックで開く・予定/実績の開始終了日）

要件定義の行をクリックすると詳細が開き、**予定開始日・予定終了日・実績開始日・実績終了日**と EVM（出来高 EV／計画値 PV／実コスト AC）・担当（作業者）・レビュー担当 が見える。要件: moira-surface-schedule Req15／moira-schedule Req13。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#0f766e;color:#fff"><td colspan="2" style="padding:6px 10px">🔍 詳細：要件定義（After — 作成完了）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;width:210px">状態</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち（implemented）</span>／玉＝人間</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者） / レビュー担当</td><td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude（作成者）／ 👤 太郎（レビュー担当・次の手番）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">予定開始日（ベースライン）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-05（値は例示・要件 moira-schedule Req13 AC2＝予定終了−所要の導出）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">予定終了日（基準完了日 frozenSlot）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-07（値は例示）<span style="color:#16a34a"> ／ フィールドは実在：Inspector「基準完了日」</span></td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">実績開始日</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-05（値は例示・要件 moira-schedule Req13 AC1＝`→implementing` の時刻）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">実績終了日</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-07（値は例示・要件 moira-schedule Req13 AC1＝`→implemented` の時刻）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV（MD）</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">3</b>（完了∧合意済み＝凍結予算満額・二値）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">計画値 PV ／ 実コスト AC（MD）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">PV 3 ／ AC 3（いずれも例示・実装が定める）</td></tr>
</table>

<small>※ 詳細パネル自体は実在（schedule の Inspector）。<b>予定終了日</b>のフィールドも実在（Inspector「基準完了日」＝`frozenSlot`・MODEL §3②）。<b>予定開始日・実績開始日・実績終了日</b>は定義済み要件（moira-schedule Req13：実績＝lifecycle `→implementing`/`→implemented` の時刻、予定開始＝予定終了−所要）で、参照スライスの Inspector は未描画。**日付の値はすべて例示**（「実在」はフィールドの存在を指し日付値ではない）。作成中（implementing）に開くと実績終了日は「未」（moira-schedule Req13 AC3 の honest empty）。</small>

### 4-5. decision インボックス（横断）— 要件定義のレビューは出ない

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td style="padding:6px 10px">🗂 decision インボックス（横断）（After）</td></tr>
  <tr>
    <td style="padding:14px 10px;border:1px solid #cbd5e1;color:#64748b;text-align:center">— 要件定義の「レビュー待ち（承認）」はここには出ない（成果物の承認は5コミット判断のうちの4つにも判断要警告にも含まれない＝§7）。レビューは上の人間レビュー待ちキューで扱う。 —</td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 担当（作業者） | レビュー担当 | 出来高 EV_abs 寄与 | 実行カバレッジ寄与 |
|---|---|---|---|---|---|---|
| └ 要件定義 | implemented（レビュー待ち） | agreed（3人日） | Claude（agent） | 太郎（human） | ✅ 3人日（完了＝implemented ∧ 合意済み） | ❌（`implementing` でない＝0） |
| └ 設計 | pending | agreed（5人日） | —（対象外） | — | ❌ 未完了＝0 | ❌ |
| └ タスク | pending | agreed（2人日） | —（対象外） | — | ❌ 未完了＝0 | ❌ |
| └ レビュー作業（要件定義） | ready（依存充足・未着手） | agreed（1人日・例示） | —（未着手） | — | ❌ 未完了＝0 | ❌（`implementing` でない） |
| └ レビュー作業（設計） | pending | agreed（1人日・例示） | —（対象外） | — | ❌ 未完了＝0 | ❌ |
| └ レビュー作業（タスク） | pending | agreed（0.5人日・例示） | —（対象外） | — | ❌ 未完了＝0 | ❌ |

出来高 EV%：**24%**（EV_abs 3 / 合意済み有効**葉**の最新見積総和 3+5+2+1+1+0.5=12.5。**葉基底**）<br>
実行カバレッジ：**0%**（`implementing` の合意済み有効**葉** 0 / 6。**葉基底**）／見積カバレッジ（P2）：**100%**（合意済み有効**葉** 6 / 既知の有効**葉** 6。**葉基底**・本ユニットで不変）<br>
人間レビュー待ちキュー：**1 件**（要件定義＝`implemented` で人間の承認待ち・レビュー担当 太郎。レビュー作業ノードは ready/pending＝未着手でキュー外）

<small>※ 基底に注意：EV%・実行カバレッジ・**見積カバレッジ(P2) はいずれも葉基底**（req/design/tasks＋レビュー作業 3 葉＝計 6 葉）で測る（MODEL v18 で P2 をノード基底→葉基底へ是正＝参照実装 `coverage.ts` の `effectiveLeaves` 基底）。中間ノード F は分母外。よって**全葉合意で P2 = 100%**。レビュー作業 3 葉は計画段階で合意済み（ユニット review-work-estimated）ゆえ分母 12.5 に算入。**レビュー担当（reviewer）は出来高・カバレッジ・平準化を一切動かさない**付帯属性（MODEL v19 §7#18(b)・moira-core Req6 AC6）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | 要件定義を前進させる lifecycle `transition`（作成開始→作成完了。actor＝Claude＝agent、作成開始遷移に作業者 assignee）＋ **レビュー担当 太郎を指名する付帯記録**（人間のコミット判断・状態を保つ `transition` に reviewer 属性。下記 JSON は主要 3 件で、`pending→ready` 等の件数は実装が決める） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-requirements-drafted.md`） | 要件定義の作成内容・根拠・レビュー担当の指名・「承認はこれから（玉は人間）」 |
| **spec-value 画面 / schedule-time 画面** | 要件定義が「レビュー待ち」になり、担当 Claude・レビュー担当 太郎が出て、玉がエージェント作業キュー→人間レビュー待ちキューへ移り、出来高 EV% が 24% に上がる（§4） |

```json
[
  {
    "id": "e060", "ts": 60,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "agent", "id": "claude" },
    "reason": "要件定義の作成を開始（kiro-spec-requirements 打鍵）"
  },
  {
    "id": "e061", "ts": 61,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "要件定義ドラフト完成・仕様FIX判定（人間の承認待ち）"
  },
  {
    "id": "e062", "ts": 62,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "implemented",
    "reviewer": { "kind": "human", "id": "dev:taro" },
    "reason": "レビュー担当に spec オーナー（太郎）を確定（AI が提案し人間が確定する割当；指名 write の actor は例示）"
  }
]
```

<small>注：ノード ID・ts 値は例示で実装が決める。lifecycle は `pending → ready → implementing → implemented → accepted`（MODEL §2.5）で、e060/e061 は作成の開始・完了の主要遷移。**作成開始 `→implementing` に作業者 `assignee`（Claude＝agent）が載ることで作成中はエージェント作業キューに入る**（`agentWorkQueue`＝`{ready,implementing}∧assignee.kind=agent`・`queues.ts`）。`implemented` 到達で人間レビュー待ちキュー（`humanReviewQueue`＝`implemented` の葉・actor 非依存）へ移る。**e062 は「状態を保つ `transition`（to=現状態 implemented）に `reviewer` 属性を載せた付帯記録」**で、レビュー担当 太郎を指名する人間のコミット判断（MODEL §2.4/§2.8/R-T5・moira-core Req6 AC4。AI は spec オーナーを提案、人間が確定）。太郎は spec オーナー（ディスカバリ起点者）で MODEL §2.4「AI は spec オーナーを提案」に沿う自然なレビュー担当；**誰が指名 write を確定するか（指名 actor）は実装/運用が定める例示**。reviewer は単一・latest-wins・人間限定（書込み層規律）で**平準化/EV/PV/coverage を消費しない**（MODEL §7#18・moira-core Req6 AC6）。指名 reviewer は実際に `accepted` を発行する actor と異なってよい（plan）。**出来高 EV_abs は完了葉かつ合意済みの凍結予算を算入**（`ev.ts`：`COMPLETED={implemented,accepted}`）。作成は Claude が行い、**承認 `implemented→accepted`（actor=human）は別ユニット**。event 型は `moira/backend/src/types.ts` の `TransitionEvent`（v19 で `reviewer?` 追加済）に一致。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が要件定義の作成を打鍵したとき、**システムは** 要件定義の行を「作成中 → 作成完了（レビュー待ち）」へ進め**なければならない**。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 出来高（進捗）を、その要件定義の合意済み見積分だけ上げ**なければならない**（作成完了で出来高が上がる）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 出来高を途中段階の部分的な割合では計上**してはならない**（出来高は作成完了で初めて満額算入する＝二値）。
- **WHILE** 要件定義を作成している（作成中の）間、**システムは** 担当（作業者）を画面に示し、当該作業をエージェント作業キュー（玉＝エージェント）に現さ**なければならない**。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 当該作業をエージェント作業キューから外し人間レビュー待ちキューへ移し、いま動くべき側が人間（レビュー担当）であることを画面で分かるように示さ**なければならない**（玉がエージェント→人間へ移ったことが分かる）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** それを人間のレビュー待ち一覧に 1 件として現さ**なければならない**。
- **WHEN** 要件定義がレビュー待ちになったとき、**システムは** その**レビュー担当（次に誰がレビューするか）を、担当（作業者）とは別に画面で示さ**なければならない（作業者が Claude でも、レビュー担当が太郎だと一目で分かる）。
- **WHEN** レビュー担当を決めるとき、**システムは** それを人間のコミット判断として扱い、自動で決め**てはならない**（AI は spec オーナーを推薦してよいが、最終は人間）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** それを横断の decision 一覧（インボックス）に出**してはならない**（レビュー待ちはレビュー一覧で扱う）。
- **WHILE** 要件定義が作成完了だが人間の承認前である間、**システムは** 人間の承認を待たずに出来高をそれ以上増減**してはならない**（承認は品質確認であって出来高を動かさない）。
- **WHEN** 各作業が画面に表示されるとき、**システムは** その担当（作業者）と（レビュー待ちなら）レビュー担当を、spec-value と schedule の両方で一目で分かるように示さ**なければならない**。
- **WHEN** 開発者が作業の詳細を開いたとき、**システムは** 予定開始日・予定終了日・実績開始日・実績終了日と、出来高・計画値・実コストを示さ**なければならない**。
- **WHEN** 開発者が特定のレビュー担当のレビュー待ちだけを見たいとき、**システムは** レビュー担当を選んでその担当の項目だけに絞り込める手段を提供**しなければならない**（per-node の reviewer を選んで突き合わせる絞り込み）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 人間の承認（OK 判断）を自動で行っ**てはならない**（承認は人間）。

## 7. 決定事項

<!-- 検証ループ後に確定した決定のみを記す。 -->

- **「レビュー待ち＝提案された」は lifecycle の `implemented`:** §3 の「要件定義の行が『レビュー待ち（提案された・まだ承認前）』になる」は、見積合意の `proposed`（既に `agreed` 済み）ではなく、**lifecycle の `implemented`（作成完了・仕様FIX判定で人間の承認 `implemented→accepted` 待ち）**を指す（MODEL §2.5/§2.6・`moira-core` 5.1/5.3/5.4）。
- **出来高 EV% は「作成完了（implemented）」で 0%→24% に上がる（承認を待たない）:** 出来高 EV_abs は**完了葉（`implemented` または `accepted`）かつ合意済み**の凍結予算を算入（`ev.ts` の `COMPLETED={implemented,accepted}`、`moira-evm` 1.1）。要件定義が `implemented` で EV_abs に 3人日、**EV% = 3/(3+5+2+1+1+0.5) = 3/12.5 = 24%**（分母はレビュー作業 3 葉を含む計画段階合意済みの全 6 葉＝ユニット review-work-estimated）。§3 の「進捗が進む」見立ては正しく、数値は 50% でなく 24%、上がるタイミングは承認前の作成完了（MODEL §2.6「仕様を書くのも進捗」）。承認（`implemented→accepted`）は品質確認で **EV を動かさない**。部分EV は計上しない＝二値（MODEL v16 で却下）。EV% は現在状態の導出ゆえ差し戻し（別ユニット）で 24%→0% に後退しうる（MODEL P5 非単調）。
- **要件定義「単体」の出来高は EV寄与＝3人日（二値・割合なら100%）。50% にはならない:** per-node の「EV%」表示は実装に無く（per-task は二値）、要件定義単体の出来高は (a) spec-value の「EV寄与 3」、(b) schedule 詳細（Inspector）の「EV 出来高 3」で読む。出力＝implemented＝満額計上で「出力したが未承認だから半分（50%）」という途中点は無い。
- **見積カバレッジ(P2) は葉基底＝全葉合意で 100%（MODEL v18 で是正）:** 合意済み有効葉 6 / 既知の有効葉 6 = **100%**（フェーズ 3 葉＋計画段階合意済みのレビュー作業 3 葉）。中間ノード F は I1 ロールアップで分母外（§7#14(d)）。出所＝MODEL §3 P2・§6 v17→v18・参照実装 `coverage.ts` の `effectiveLeaves`。本作業のレビューで人間が「全葉合意なのに 75% は直感に反する」と指摘し `moira-model-update` の独立敵対ゲートを PASS して確定（姉妹ユニットも v18 同期で 100%）。
- **担当（作業者）と レビュー担当（reviewer）は別の役割＝MODEL v19:** 担当（assignee）は「その作業を誰がやる/やったか」＝この打鍵では **Claude（agent）**（§5 actor=claude）。**レビュー担当（reviewer）は「`implemented→accepted` を行うべく指名された人間」＝太郎**で、assignee とは**別の付帯属性**（単一・latest-wins・人間限定・**平準化/EV/PV/coverage を消費しない**）。両者を両画面に別表示する（要件: moira-surface-spec-value Req10/Req11・moira-surface-schedule Req3 AC4・moira-schedule Req14・moira-core Req6 AC4-6）。この reviewer 概念は本作業で `moira-model-update` の独立敵対ゲートを通して **MODEL v19** に正典化された（先行案「担当 assignee を ball-holder＝現在の手番に再定義」は、`leveler.ts` が assignee を平準化消費するため完了作業分の容量を太郎に誤消費する等で**却下**された＝MODEL §6 v18→v19）。
- **「玉が人間」は2キュー間の移動＋reviewer 表示（新状態を作らない）:** 玉（次の手番）は lifecycle から導出（`implementing`→エージェント作業キュー、`implemented`→人間レビュー待ちキュー＝actor 非依存・`queues.ts`）。MODEL に「玉」という一級概念は新設しない。誰がレビューするか（太郎）は **reviewer 属性**（per-node 指名）で示す——人間レビュー待ちキュー導出自体は actor 非依存のまま不変で、reviewer は per-node 併置（moira-schedule Req14・moira-surface-schedule Req13）。一覧の画面描画はスライス未描画（現状は spec-value の `implemented` バッジで読む）。
- **reviewer 指名のタイミングと未指名断面（スコープの正直化）:** §4 の After は **reviewer 指名済み（§5 e062）後の断面**を描く。reviewer の指名は `implemented` 到達（e061）の自動的帰結ではなく、別の人間のコミット判断（§2.1#2 割当・e062；AI は spec オーナー太郎を提案、人間が確定）。**reviewer 未指名のまま `implemented` のノード**は、人間レビュー待ちキュー（actor 非依存・不変）になお現れつつ reviewer は『未指名』の可視ギャップ（P0）として示す——これは上流の定義済み要件（moira-core Req6 AC6・moira-schedule Req14 AC4・moira-surface-spec-value Req11 AC3）が被覆する別断面で、本ユニットは指名済み断面を描く（未指名→指名の Before/After はレビュー負荷を上げないため展開しない）。指名 reviewer は実際に `accepted` を発行する actor と異なってよい（plan；MODEL §7#18(c)）。
- **レビュー待ちの reviewer フィルタ（提示層・MODEL 非保持）:** 開発者が「特定のレビュー担当（太郎）のレビュー待ち」に絞るのは、**選んだレビュー担当**を per-node の `reviewer` 属性（Actor {kind,id}）と突き合わせて行う（要件: moira-surface-schedule Req14）。これは認証された『自分』や視点 actor という中間概念を要さない——reviewer 属性の選択で足り、絞り込みは提示層ゆえ MODEL 非保持（MODEL §7#18(f)；v19 までの『視点 actor=提示層で別途』gloss は撤回）。未指名ノードはどの選択にも一致せず『未指名』可視ギャップに残す。将来 backend が閲覧者識別を供給すれば『自分の分』の自動選択を上に載せられる（提示層拡張・MODEL 非保持は不変）。参照スライスは reviewer 選択フィルタ未供給で現状無効（既知ギャップ）。
- **schedule 詳細の4日付（定義済み要件）:** 予定終了日＝凍結スロット `frozenSlot`（Inspector「基準完了日」実在）。予定開始日（＝予定終了−所要）・実績開始日（`→implementing` 時刻）・実績終了日（`→implemented` 時刻）は **moira-schedule Req13** の per-node 導出（提示層導出・MODEL 変更不要）。Inspector への表示は **moira-surface-schedule Req15**。参照スライスの Inspector は基準完了日・予測完了日のみ描画（残り3日付はスライス未描画）。
- **「ガントの進捗バー」は採らない:** 出来高 EV% の host は spec-value（主）・health（副）（UI-ARCH §4.1）。ガントは状態＋予測＋詳細を描く（前段 `estimate-spec-proposed` §7 と整合）。
- **decision インボックスには出さない（成果物承認は5判断のうち4つにも警告にも非該当）:** インボックスが集約するのは5コミット判断のうち4つ（見積合意・割当・スコープ/期日・見積の深さ。第5＝c 宣言は capacity 面）＋判断要警告（[UI-ARCHITECTURE.md](../../../moira/UI-ARCHITECTURE.md) §3・MODEL §2.1）。成果物の承認（`implemented→accepted`）はそのどちらにも含まれないため「decision には出ない／人間レビュー待ちキューに出る」と確定。なお**レビュー担当の指名**は §2.1#2 割当に属する人間のコミット判断だが、これは割当 write の文脈で扱い、本ユニットの decision インボックス（承認）論点とは別。
- **本ユニットの範囲は「打鍵→作成完了・玉が人間へ・レビュー担当 太郎・出来高 24% 獲得」まで:** 人間の**承認**（`implemented→accepted`・出来高を動かさない品質確認）と、レビューでの**差し戻し**（`implemented→implementing` への後退＝MODEL P5）は別ユニット。
- **計画段階のレビュー作業ノードを木に含める（分母 12.5・agreed 後の同期）:** ユニット `review-work-estimated`（計画段階で 3 レビュー作業ノードを前倒し見積・合意）の agreed を承け、本ユニットの前提・木・メトリクスに**レビュー作業 3 葉（要件定義1・設計1・タスク0.5）を agreed・pending として算入**した。これにより合意済み有効葉は 3→6、見積総和は 10→12.5 となり、**作成完了時の EV% は 30%→24% に是正**（EV_abs 3 / 12.5）。P2 は 6/6＝100%（不変）、実行カバレッジの打鍵中ピークは 1/3→1/6≈17%。要件定義が `implemented` に達すると依存辺（policy=implemented）により要件定義レビューが ready になる（設計・タスクのレビューは依存元 pending ゆえ pending）。出所＝`review-work-estimated` §7・本会話ログ（2026-06-26）。
- **参照実装は暫定スライス・各要素は定義済み要件への目標:** 担当（作業者）列・レビュー担当列・人間レビュー待ちキューの一覧描画・自分フィルタ・詳細の予定/実績日のうち、参照スライス（`SpecValueSurface.tsx`/`ScheduleTimeSurface.tsx`/`Inspector.tsx`）が未描画のものは「(スライス未描画)」と中立に記した。いずれも MODEL/spec に**定義済みの要件**（frontmatter トレース）への目標受け入れ基準であり、現スライスの挙動には縛られない。フロントエンド/上流 read 契約への実装は別タスク（spec の Reference-implementation deviation／必要な上流 read 契約 に明記済み）。
- **イベント件数は断定しない:** lifecycle は `pending→ready→implementing→implemented`（MODEL §2.5）。§5 は作成の開始・完了とレビュー担当指名の主要遷移を示す。`pending→ready` 等の件数は実装（`moira-progress` 仮称・未実装）が決めるため確定しない。
