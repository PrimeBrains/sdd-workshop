---
id: units/tasks-spec-completed
title: タスク分解の成果物ができて承認される——作成完了で出来高が上がり（達成率 80%→96%→100%・見かけ）玉が人間（レビュー担当）へ。承認は出来高を足さず（達成率は据え置き）、レビュー作業は出来高を得てから「承認済み」へ畳まれ、（承認レビューに工数を要した場合は）AC が承認レビュー分だけ増える。これで spec フェーズ（要件・設計・タスク）が出そろい達成率は見かけ 100% に達するが、これは既知作業の完了度にすぎず——タスク承認の §2.6 帰結として実装フェーズのノードが未見積で誕生し（見積カバレッジが 100%→75% に下がる＝発見信号）、その見積・合意は次の作業に委ねられ、次フェーズには着手しない（実行カバレッジは 0% で終わる）
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: ユニット design-spec-completed の後。要件定義は accepted（EV 3）・要件定義レビューは accepted（EV 1）・設計は accepted（EV 5）・設計レビューは accepted（EV 1）。開発者が kiro-spec-tasks を起動し Claude がタスク分解作業を進めている最中で、タスクは implementing（着手中・assignee Claude）。EV% 80%・実行カバレッジ 17%・玉＝AI（Claude がタスク分解作業中）
postcondition: Claude がタスク分解の成果物（tasks.md）を作り終えてタスクが implemented（レビュー待ち）になり出来高が上がり（EV% 80%→96%）玉が人間（レビュー担当＝太郎）へ。太郎がタスクをレビューしてタスクレビュー作業が出来高を得（EV% 96%→100%・見かけ）、太郎がタスクを承認（implemented→accepted）——承認は出来高を足さず EV% は 100%（見かけ）据え置き、タスクレビュー作業も accepted へ畳まれ（ノード/EV は不変）、承認レビューに要した工数があれば AC が増え CPI がわずかに悪化。これで spec フェーズ（要件定義・設計・タスク＋各レビュー）が全 accepted となり達成率は見かけ 100% に達する。タスク accepted の §2.6 帰結として実装フェーズのノード（実装-1・実装-2）が未見積で誕生し、見積カバレッジが 100%→75% に低下（＝既知作業の完了度にすぎないことの正直な発見信号。達成率は未見積実装が R-U8 で分母外ゆえ 100% 据え置き）。その見積・合意は次ユニット estimate-impl-agreed の射程（分母が 12.5→28.5 に増え達成率は 44% へ正直に低下する）で、本ユニットでは生まれたばかりの実装に着手しない（未見積・pending ゆえ実行カバレッジは 0% で終わる）。feature はまだ accepted でない
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 3.1, 3.4, 3.5, 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 11.1, 11.2"
  - "moira-evm: 1.1, 1.2, 2.1, 3.1, 3.3, 5.1, 5.4, 5.5, 6.1, 6.2, 9.2, 9.5, 11.1, 11.2"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 5.3, 10.1, 11.1, 11.2, 11.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.4"
  - "moira-surface-schedule: 2.5, 3.4, 8.1, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3"
---

# タスク分解の成果物ができて承認される——作成完了で出来高が上がり（達成率 80%→96%→100%・見かけ）玉が人間（レビュー担当）へ。承認は出来高を足さず（達成率は据え置き）、レビュー作業は出来高を得てから「承認済み」へ畳まれ、（承認レビューに工数を要した場合は）AC が承認レビュー分だけ増える。これで spec フェーズ（要件・設計・タスク）が出そろい達成率は見かけ 100% に達するが、これは既知作業の完了度にすぎず——タスク承認の §2.6 帰結として実装フェーズのノードが未見積で誕生し（見積カバレッジが 100%→75% に下がる＝発見信号）、その見積・合意は次の作業に委ねられ、次フェーズには着手しない（実行カバレッジは 0% で終わる）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。各画面要素は**定義済み要件**（frontmatter のトレース）への参照を併記します。スライス未実装は中立に「(スライス未描画)」と記し、設計の宿題（赤字）ではありません。

## 1. このユニットで確かめること

先行ユニット `design-spec-completed` の後、開発者が `kiro-spec-tasks` を起動して Claude がタスク分解作業を進めている（タスク＝着手中）。ここから**タスク分解の成果物ができて出来高が上がり、人間が承認するまで**を一続きで確かめる。これで spec フェーズ（要件定義・設計・タスク）が出そろい、達成率は**見かけ上 100%** に達する——が、その承認の帰結として実装ノードが未見積で生まれ、見積カバレッジが下がる＝「見かけ 100% は既知作業の完了度にすぎない」と正直に露見する、ここまでを確かめる。中核は3つ：

**（A）作成完了で出来高が上がり、玉が人間へ（＝「タスク分解を書くのも進捗」）**
- タスク分解の成果物（tasks.md）ができてタスクの行が **「レビュー待ち（作成完了・まだ承認前）」** になり、そのとき**出来高（進捗）がタスクの分だけ上がる**（着手中は未完了ゆえ上がらず、**作成完了の瞬間に満額**＝二値）。達成率（EV%）は **80%→96%** に動く。
- **担当（作業者）が画面で分かる**こと（このタスク分解作業の作業者は Claude＝エージェント）。担当（作業者）は spec-value の一覧と schedule（キュー列〔§4-2〕・作業詳細〔§4-4〕）の**両画面**に出る（要件: moira-surface-spec-value Req10／moira-surface-schedule Req3）。
- **誰がレビューするか（レビュー担当＝太郎）が per-node で分かる**こと。レビュー担当（reviewer）は作業者（assignee）とは**別**に表示され、作業者が Claude のままでも「次にレビューするのは太郎」と全員に見える（MODEL v19）。
- **いま動くべき側＝人間（レビュー担当）に玉が渡ったことが画面で分かる**こと（作業がエージェント作業キューから人間レビュー待ちキューへ移動）。この「レビュー待ち＝玉が人間」は**人間のレビュー待ち一覧に現れる**（横断の decision インボックスには出ない）。開発者は**レビュー担当を選んでそのレビュー待ちだけに絞り込める**。

**（B）承認は達成率（EV%）を動かさない——出来高は『レビュー待ち（implemented）』で既に獲得済みで、承認は品質確認のゲート**
- 太郎がタスク分解をレビューすると、**タスクレビュー作業（review-tasks）が出来高を得る**（レビューも作業＝進捗。EV% **96%→100%・見かけ**）。
- そのうえで太郎が**タスクを承認（accepted）しても出来高（EV）は足されない**——**EV% は 100%（見かけ）のまま据え置き**。承認で動くのは：lifecycle が「レビュー待ち」→「承認済み」、**AC が承認レビュー分だけ増え CPI がわずかに悪化**（出来高を伴わない AC 増。即決で工数ゼロなら AC・CPI は不変）、玉（レビュー待ちキュー）から外れる、こと。
- **タスクレビュー作業（review-tasks）の行は出来高100%のまま動かない**（EV=0.5 不変）。承認時にレビュー作業ノードも「承認済み（accepted）」へ進むが、これは**自明な一段の lifecycle 遷移（fold）**であって**ノードも EV=0.5 も消えない**。

**（C）spec フェーズが出そろうと達成率は見かけ 100%——だがタスク承認の帰結で実装ノードが未見積で生まれ、見積カバレッジが正直に下がる（次フェーズには着手しない）**
- 要件定義・設計・タスク（と各レビュー作業）がすべて承認済みになり、達成率（EV%）は**見かけ上 100%** に達する。
- **タスクが承認された帰結として（MODEL §2.6）、実装フェーズのノードが「未見積」で木に生まれる**。これにより**見積もり済みの割合（見積カバレッジ）が 100%→75% に下がる**——これが「達成率 100% でも、まだ見積もられていない実装作業がある」という**正直な発見信号**になる。達成率（EV%）自体は未見積の実装を分母に含めない（R-U8）ため 100%（見かけ）のまま。
- だからこの **達成率 100% は「いま分かっている（見積もり済みの）作業」の完了度にすぎない**——生まれたばかりの実装ノードはまだ見積もられておらず（その見積・合意は次の作業＝`estimate-impl-agreed` の主題）。
- よって**次フェーズ（実装）には着手しない**（実装ノードは生まれたが未見積・未着手）。**「着手済みの割合（実行カバレッジ）」は 0% のまま終わる**——設計のときのように次フェーズ着手で実行カバレッジが動くことは、本ユニットでは起きない。
- 実装が次ユニットで見積・合意されると、**達成率の分母が 12.5→28.5 に増え、見かけ 100% は正直に 44% へ下がる**（達成率は新規合意見積の算入で非単調に動く＝MODEL P5(c)）。この「見かけ 100% → 見積カバレッジ低下 → 正直化」の入口を本ユニットが用意する。

## 2. 前提（Given）

ユニット `design-spec-completed` の後。要件定義は承認済み（accepted・EV 3）、要件定義レビュー作業も承認済み（accepted・EV 1）、設計は承認済み（accepted・EV 5）、設計レビュー作業も承認済み（accepted・EV 1）。開発者が `kiro-spec-tasks` を起動し、Claude がタスク分解作業を進めている最中（タスク＝着手中 implementing・assignee Claude）。玉＝AI（Claude がタスク分解作業中）。実装ノードはまだ木に無い（タスクが accepted に達していないため §2.6 帰結が未発火）。

| ノード | 見積状態 | 見積値 | lifecycle | 担当（作業者） | レビュー担当 | 出来高(EV_abs)寄与 |
|---|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | — | 10（子の合計） |
| └ 要件定義 | agreed | 3人日 | accepted（承認済み） | 🤖 Claude | 👤 太郎 | 3（完了∧合意済み） |
| └ レビュー作業（要件定義） | agreed | 1人日（例示） | accepted（承認済み） | 👤 太郎 | — | 1 |
| └ 設計 | agreed | 5人日 | accepted（承認済み） | 🤖 Claude | 👤 太郎 | 5（完了∧合意済み） |
| └ レビュー作業（設計） | agreed | 1人日（例示） | accepted（承認済み） | 👤 太郎 | — | 1 |
| └ タスク | agreed | 2人日 | implementing（着手中） | 🤖 Claude | —（未指名） | 0（着手中＝未完了） |
| └ レビュー作業（タスク） | agreed | 0.5人日（例示） | pending（依存元 タスク 未 implemented） | — | — | 0 |

- 出来高 EV%（達成率）：**80%**（EV_abs 10〔要件定義 3＋レビュー作業 1＋設計 5＋レビュー作業 1〕 ÷ 合意済み有効葉の見積合計 12.5）
- 見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 6 / 既知の有効葉 6。実装ノードは未誕生で既知の葉に未算入）
- 実行カバレッジ（R-S8・葉基底＝カウント比）：**17%**（`implementing` の合意済み有効葉 1〔タスク〕 / 6）
- 人間レビュー待ちキュー：**0 件**（`implemented` の葉なし。タスクは implementing＝作業中で未だレビュー待ちでない）
- 玉（次の手番）：AI（Claude がタスク分解作業中＝エージェント作業キュー）

## 3. ふるまい（When / Then）

```
When  設計が承認済み（accepted）で、開発者がタスク分解（作業分解）の作業を指示し
      （kiro-spec-tasks を起動）、Claude がタスク分解の作業を進めて成果物を作り終える。
Then  Claude がタスク分解の成果物（tasks.md）を作成し、spec-value 画面でタスクの行が
      「レビュー待ち（作成完了・まだ承認前）」になる。
And   出来高（進捗）がタスクの分だけ上がる
      （着手中は未完了ゆえ上がらず、作成完了で上がる。数値・タイミングは §4/§7 で正典に接地）。
And   いま作業のボール（玉）を持っているのは人間（レビュー担当）だと、画面を見て分かる。
And   この「レビュー待ち＝玉が人間」は、人間のレビュー待ち一覧に現れる
      （横断の decision インボックスには出ない）。
And   開発者は自分の名前で、自分がレビュー担当の項目だけに絞り込んで確認できる。
Then  続いて開発者（人間）がタスク分解の成果物をレビューして承認する（差し戻しなしの初回承認）。
And   タスクのレビュー作業を実施したぶん、レビュー作業（タスク）の出来高が上がる（レビューも進捗）。
And   タスクは「レビュー待ち（implemented）」から「承認済み（accepted）」へ進む。
And   タスクの出来高（EV）は承認では増えも減りもしない
      ——出来高は「レビュー待ち」に達した時点で既に獲得済みで、承認は品質確認のゲートであって出来高を足さない。
And   達成率（EV%）は承認では変わらない（タスクが implemented／レビュー作業が完了した時点で既に伸びている）。
And   レビュー作業（タスク）の行は出来高100%のまま動かない（完了のまま。承認時に「承認済み」へ畳む）。
And   今回の承認レビューに費やした工数は実コスト（AC）として増える（出来高を伴わない・即決で工数ゼロなら不変）。
And   タスクが承認されたことで人間レビュー待ちから外れる。
Then  これで spec フェーズ（要件定義・設計・タスク）の作業がすべて承認済みになり、
      達成率（EV%）が見かけ上 100% に達する。
And   タスクが承認された帰結として、実装フェーズのノードが「未見積」で木に生まれ、
      「見積もり済みの割合（見積カバレッジ）」が 100%→75% に下がる
      ——これが「達成率 100% でも、まだ見積もられていない実装作業がある」という正直な発見信号になる
      （達成率そのものは未見積の実装を分母に含めないため 100%・見かけ のまま）。
And   ただしこの達成率 100% は「いま分かっている（見積もり済みの）作業」の完了度にすぎず、
      生まれたばかりの実装ノードはまだ見積もられていない（その見積・合意は次の作業の主題）。
And   よって本ユニットでは次のフェーズ（実装）には着手せず（実装ノードは生まれたが未見積・未着手で）、
      「着手済みの割合（実行カバレッジ）」は 0% のまま終わる。
```

<small>注（要点のみ・機構の詳細は §4／§5／§7 に接地）：**(1) タスク分解作成**＝`kiro-spec-tasks`（実在スキル）起動で Claude が進める作業。「レビュー待ち」＝lifecycle `implemented`（作成完了・人間の `implemented→accepted` 承認待ち）。「玉が人間」は implementing（エージェント作業キュー）→implemented（人間レビュー待ちキュー）のキュー移動で表れる（§4-2）。**(2) タスクレビュー作業**＝太郎が成果物をレビューする A1 通常作業ノード（review-tasks・計画段階で見積合意済み）で、実施すると出来高を得る（MODEL §7#18(b)）。**(3) タスク承認**＝`implemented→accepted`（品質確認であって出来高を足さない＝MODEL §2.5）。レビュー作業ノードの承認は §7#18(b)(vii) の fold（ノード/EV を消さない）。**(4) 実装ノードの誕生（未見積）**＝タスクが accepted に達した §2.6 帰結（decompose）で実装ノードが未見積で生まれ、見積カバレッジが 100%→75% に下がる（＝見かけ 100% は既知作業の完了度にすぎないことの正直な発見信号）。**この終端のふるまい（誕生＝タスク完了時／カバレッジ低下）はユーザー裁定済み（2026-06-29・Reading Y）。** fold の二義・EV 弧・R-U8・§2.6 継ぎ目・e050 相互参照の詳細は §5／§7。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（状態・担当・レビュー担当・出来高 EV%・見積/実行カバレッジ・CPI）＋ schedule-time（玉＝キュー移動・作業詳細）**。ガントに「進捗バー％」は出さない（出来高 EV% は spec-value/health が host・前段ユニット §7 と整合）。4断面：**Before**（タスク 着手中）→ **Mid①**（タスク 作成完了・レビュー待ち＝出来高が上がり玉が人間へ）→ **Mid②**（太郎がレビューし承認＝レビュー作業が出来高を得てから承認・承認は出来高を足さない）→ **After**（spec フェーズ出そろい・達成率 見かけ 100%＝タスク承認の帰結で実装ノードが未見積で誕生し見積カバレッジ 100%→75%・次フェーズには着手せず実行カバレッジ 0% で終わる）。

### 4-1. spec-value 画面（状態・担当・レビュー担当・出来高・見積/実行カバレッジ・CPI）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Before — タスクが着手中・Claude 作業中）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（中間ノード）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>80%</b>（10/12.5）・実行 <b>17%</b>（タスク 着手中）・見積カバレッジ(P2) <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義／設計／各レビュー作業（要件定義・設計）＝accepted</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（accepted・不変。EV寄与 3＋1＋5＋1＝10）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 10（不変）</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ タスク</b>（着手中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">着手中</span> <span style="color:#64748b">(implementing)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（未指名）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 0</b>（着手中＝未完了）<br><span style="font-size:11px;color:#1d4ed8">実行カバレッジに +1</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 0.5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span> <span style="color:#94a3b8;font-size:11px">（依存元 タスク 未 implemented）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Mid① — タスクが作成完了・レビュー待ち＝玉が人間へ）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#16a34a">96%</b>（80%→96%・12/12.5）・実行 <b>0%</b>（タスクは implemented＝着手中でない）<br><span style="color:#b45309">⚑ タスクはレビュー待ち（玉＝人間）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義／設計／各レビュー作業（要件定義・設計）＝accepted</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（accepted・不変。EV寄与 3＋1＋5＋1＝10）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 10（不変）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ タスク</b>（レビュー待ちとして強調）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#94a3b8;font-size:11px">作成者</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span><br><span style="color:#b45309;font-size:11px">◀ 次の手番</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 2人日</b>（＝自分の予算満額・二値）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 0.5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e0e7ff;border-radius:4px;padding:1px 6px">着手可</span> <span style="color:#64748b">(ready)</span> <span style="color:#94a3b8;font-size:11px">（依存元 タスク implemented＝充足）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未着手）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ <b>タスク「単体」の出来高は EV寄与＝2人日</b>（自分の凍結予算の満額・割合なら 100%・二値）；出力＝作成完了（implemented）の瞬間に満額計上され途中点（50% 等）は無い（部分EV は MODEL v16 で却下）。<b>フィーチャー全体の出来高 EV% は 80%→96%</b>（要件定義3＋レビュー作業1＋設計5＋レビュー作業1＋タスク2＝12 ÷ 12.5＝葉基底）。作成完了でタスクが `implemented` に達したため、依存辺（policy=implemented）により<b>タスクレビュー作業が ready</b> になる。実行カバレッジはタスクの作成完了で 17%→0%（implementing の葉が無くなる）。なおこの後、太郎がタスクレビュー作業に着手する間（e122・review-tasks implementing）は実行カバレッジが一時的に 17% へ戻り、完了（e123）で再び 0% になる——§4 はこの一時を独立断面にせず Mid② の「自明な一段」に畳む（§7#18(b)(vii)・素の瞬間値は §7 の弧で開示）。<b>見積カバレッジはこの断面ではまだ 100%</b>（実装ノードはタスクが accepted に達する Mid② の §2.6 帰結で初めて生まれる）。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#166534;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Mid② — 太郎がタスクをレビューし承認）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 / 被覆 / CPI</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#166534">100%（見かけ）</b>（96%→100%＝<b>レビュー作業の完了</b>で +0.5、<b>承認では足さない</b>）・実行 <b>0%</b><br><span style="color:#b45309;font-size:12px">⚑ AC 増（承認レビュー分）→ CPI わずかに悪化（出来高は承認では不変）</span></td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ タスク</b>（承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span><br><span style="color:#166534;font-size:11px">◀ implemented→accepted（品質確認・出来高は不変）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 2</b>（不変・獲得済み）<br><span style="font-size:11px">AC：承認レビュー工数が畳んで加算（§7#18(b)(iv)）</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（タスク）（レビュー実施→承認済みへ・自明な一段）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 0.5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未指名・fold ゆえ専用 reviewer 不要）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 0.5</b>（レビュー実施で獲得→以後不変・ノードは消えない）</td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-1 ／ 実装-2</b>（タスク accepted の §2.6 帰結で誕生）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span> <span style="color:#b45309;font-size:11px">◀ 未見積で誕生</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未割当）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 0</b>（未見積・I1 総和から除外）<br><span style="color:#dc2626;font-size:11px">見積カバレッジ 100%→75%（既知の葉 6→8）</span></td>
  </tr>
</table>

<small>※ **「畳む」の二義に注意（重要）:** ここでレビュー作業ノードが `accepted` になるのは **lifecycle 畳み**（§7#18(b)(vii)＝レビューの承認段を自明な一段で底打ちし、レビューのレビューの…という無限後退を止める）であって、**コスト畳み**（レビュー工数を**ノードにせず cost だけ**で記録＝EV なし）とは別物。**lifecycle 畳みではノードも EV=0.5 も消えない。** よって本断面の **96%→100% は『タスクレビュー作業（review-tasks）の実施＝完了』による +0.5** であって、**承認（accepted）が出来高を足したのではない**——承認は完了→完了の移動で EV を動かさない（タスクの EV 2 も Mid① で既に獲得済み）。承認の前後で合計 EV は **要件定義3＋レビュー作業1＋設計5＋レビュー作業1＋タスク2＋タスクレビュー0.5＝12.5 のまま**、EV% も **100%（見かけ）のまま**——「畳んだ瞬間に 12.5→12 へ減る」ことは起きない。**実装-1・実装-2 の誕生は別物**：タスクが accepted に達した §2.6 帰結（decompose）で**未見積**（pending・合意予算なし）のノードが生まれる。未見積ゆえ **EV_abs にも達成率の分母（R-U8）にも入らない**（達成率は 100% 据え置き）が、**既知の葉**としてカバレッジ分母には入る（6→8）ため**見積カバレッジが 100%→75% に下がる**（moira-core Req11.2）。これが「見かけ 100% は既知作業の完了度にすぎない」の正直な可視化。なお本断面の **AC 増・CPI わずかな悪化は承認レビューに工数を要した場合**を描いたもので、**即決（工数ゼロ）なら e124 は生じず AC・CPI は不変**（§6(B)・§7）。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（After — spec フェーズ出そろい・達成率 見かけ 100%／実装ノードが未見積で誕生・見積カバレッジ 75%／次フェーズには着手せず）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span> <span style="color:#94a3b8;font-size:11px">（まだ accepted でない）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#166534">100%（見かけ）</b>（<b style="color:#b45309">据え置き＝承認は EV を足さない</b>）・実行 <b style="color:#b45309">0%</b>（着手中の葉なし）・見積カバレッジ <b style="color:#dc2626">75%</b>（6/8）<br><span style="color:#dc2626;font-size:12px">⚠ 達成率 100%（見かけ）でも見積カバレッジ 75%——タスク承認の §2.6 帰結で実装が未見積で誕生（既知の葉 6→8）。次の見積・合意で分母 12.5→28.5・達成率は 44% へ正直に低下</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義／設計／タスク／各レビュー作業（要件定義・設計・タスク）＝accepted</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（accepted・不変。EV寄与 3＋1＋5＋1＋2＋0.5＝12.5）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 12.5（不変）</td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-1</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未割当）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0（未見積で誕生・未着手）</td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-2</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#f1f5f9;border-radius:4px;padding:1px 6px;color:#94a3b8">見積なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未割当）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0（未見積で誕生・未着手）<br><span style="color:#b45309;font-size:11px">見積・合意は estimate-impl-agreed の射程</span></td>
  </tr>
</table>

<small>※ **この After は Mid②（承認の瞬間）と同一の論理時点を、確定後の「総括」として描く断面**——両者の間に新たなイベントは無く（Mid② が承認・fold・実装誕生の遷移そのものを写すのに対し、After は確定した resting state＝spec フェーズ全体像と次ユニット `estimate-impl-agreed` への引き継ぎを総括する）。**承認 → 終端のあいだ、達成率（EV%）は見かけ 100% のまま一切動かない。** 出来高は完了（implemented/accepted）で獲得・予算は完了時に施錠されるため（ev.ts: COMPLETED = implemented ∨ accepted）、承認（accepted）は EV を足さない。動くのは (1) lifecycle、(2) AC（承認レビュー分）、(3) CPI（AC 増で悪化）、(4) 玉（両キューが空に）、(5) **見積カバレッジ 100%→75%**（タスク accepted の §2.6 帰結で実装-1・実装-2 が未見積で誕生＝既知の葉 6→8）。**設計のとき（design-spec-completed の After）は次フェーズ着手で実行カバレッジが 0%→17% に動いたが、本ユニットでは動かない**——生まれた実装ノードは**未見積・pending** で着手すべき状態（ready/implementing）に至らないため実行カバレッジは 0% のまま終わる。**「見かけ 100%」の正直さ**：達成率 100% は分母 12.5（見積もり済みの spec 作業）に対する完了度で、同じ画面の見積カバレッジ 75% が「未見積の実装作業がまだある」と正直に示す（達成率は必ずカバレッジと対で読む＝MODEL P2）。次ユニット `estimate-impl-agreed` で実装ノードが見積・合意されると分母が 12.5→28.5 に増え、達成率は **100%→44% へ正直に低下**する（MODEL P5(c) 非単調＝新規合意見積の算入。低下は異常ではなく現実化）。CPI = EV_abs/AC（MODEL §3・moira-evm Req 9.2）。WIP 中の CPI 悲観側振れは正規化せず開示（Req 9.5）。</small>

### 4-2. schedule-time 画面 — 玉の受け渡し（キュー間の移動）

「玉が AI→人間と動いた」ことは、作業が**2つのキューの間を移動**することで分かる（玉という一級の状態を新設せず lifecycle から導出＝§7）。要件: moira-surface-schedule Req13（一覧描画）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Before（タスク 作成中・implementing）— 玉＝AI</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">タスク（作成中）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / <span style="color:#94a3b8">レビュー担当 —（未指名）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Mid①（タスク 作成完了・implemented）— 玉＝人間（太郎が承認すべき）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）← タスクはここから抜けた</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>人間レビュー待ちキュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>タスク</b>（レビュー待ち＝作成完了・承認前）<span style="color:#b45309"> ◀ 玉＝人間</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 <span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Mid②（太郎がレビュー実施→承認）— 両キュー空・実装は未見積で誕生（キューには出ない）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー / 表示（導出）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）<span style="color:#166534"> ◀ タスクもレビュー作業（タスク）も accepted で外れた（素の導出で 0）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">（参考）未割当の合意済み作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（合意済み・未着手の作業なし）<span style="color:#b45309"> ◀ 実装-1・実装-2 は木に生まれたが「未見積・pending」ゆえ着手可（ready）でも合意済みでもなく、どのキューにも現れない（見積・合意は estimate-impl-agreed）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 After（spec フェーズ出そろい）— 両キュー空・実装は未見積で誕生済みだがキューには現れない</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）<span style="color:#b45309"> ◀ 設計のときと違い、次フェーズが着手済みで入ってこない——実装-1・実装-2 は誕生したが未見積・pending で、agentWorkQueue（{ready, implementing}∧agent）にも humanReviewQueue（implemented 葉）にも該当しない</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
</table>

<small>※ **「玉」は MODEL の一級概念ではなく schedule-time のキュー（P4：agentWorkQueue／humanReviewQueue という actor フィルタ）の俗称**（MODEL v19 は「assignee を ball-holder へ再定義」案を却下済み）。玉（手番）は lifecycle から導出（`{ready, implementing}`∧assignee=agent →エージェント作業キュー、`implemented` の葉→人間レビュー待ちキュー＝actor 非依存・`queues.ts`）。Mid① でタスクが implemented になり人間レビュー待ちキューへ（玉＝太郎）。太郎がレビューを実施する間、タスクレビュー作業（review-tasks）は assignee=太郎（人間）で implementing になるが、これは agentWorkQueue（assignee=agent 限定）には入らない人間の作業——タスク成果物自体は太郎の承認判断を待って人間レビュー待ちキューに残る。**Mid② ではタスクとレビュー作業がともに `accepted` になり humanReviewQueue から外れる（素の導出で 0）**——この瞬間「玉」は導出キュー上に存在しない。**設計のとき（design-spec-completed）は、ここで開発者が次フェーズ（タスク）を着手させ agentWorkQueue に玉が戻ったが、本ユニットでは実装ノードが「未見積・pending」で生まれるため、どちらのキューにも現れない**（agentWorkQueue は {ready, implementing}∧agent、humanReviewQueue は implemented 葉——どちらも未割当・pending・未見積の実装には該当しない〔未見積ノードは assignee も無く、ready に進んでもエージェント割当が無いため agentWorkQueue に入らない〕。これは「隠蔽」ではなく木に在るが着手可状態に至っていない正直な状態で、見積・合意は estimate-impl-agreed の射程）。一覧の画面描画はスライス未描画（現状は spec-value の状態バッジで読む）。</small>

### 4-3. schedule-time 画面 — レビュー待ちの reviewer フィルタ（レビュー担当を選んで絞る）

要件: moira-surface-schedule Req14（reviewer フィルタ）。per-node の `reviewer` 属性を**選んだレビュー担当と突き合わせる提示層フィルタ**で、認証された『自分』や視点 actor という中間概念を要さない（MODEL §7#18(f)）。MODEL は保持しない（提示層）。参照スライスは reviewer 選択フィルタ未供給のため現状無効（既知ギャップ）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🔎 キュー絞り込み（actor フィルタ・Mid① 断面）</td></tr>
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
      ▸ <b>タスク</b>（レビュー待ち・レビュー担当＝太郎）<br>
      <span style="color:#475569">＝選んだレビュー担当（太郎）を per-node の `reviewer` 属性（Actor {kind,id}）と突き合わせて絞る（moira-surface-schedule Req14）。視点 actor/『自分』概念は要さず、絞り込みは提示層ゆえ MODEL 非保持。未指名ノードはどの選択にも一致せず『未指名』ギャップとして可視に残る。</span>
    </td>
  </tr>
</table>

### 4-4. schedule-time 画面 — 作業の詳細（クリックで開く・予定/実績の開始終了日）

タスクの行をクリックすると詳細が開き、**予定開始日・予定終了日・実績開始日・実績終了日**と EVM（出来高 EV／計画値 PV／実コスト AC）・担当（作業者）・レビュー担当 が見える。要件: moira-surface-schedule Req15／moira-schedule Req13。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#0f766e;color:#fff"><td colspan="2" style="padding:6px 10px">🔍 詳細：タスク（Mid① — 作成完了）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;width:210px">状態</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち（implemented）</span>／玉＝人間</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者） / レビュー担当</td><td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude（作成者）／ 👤 太郎（レビュー担当・次の手番）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">予定開始日（ベースライン）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-15（値は例示・要件 moira-schedule Req13 AC2＝予定終了−所要の導出）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">予定終了日（基準完了日 frozenSlot）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-16（値は例示）<span style="color:#16a34a"> ／ フィールドは実在：Inspector「基準完了日」</span></td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">実績開始日</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-15（値は例示・要件 moira-schedule Req13 AC1＝`→implementing` の時刻）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">実績終了日</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-16（値は例示・要件 moira-schedule Req13 AC1＝`→implemented` の時刻）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV（MD）</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">2</b>（完了∧合意済み＝凍結予算満額・二値）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">計画値 PV ／ 実コスト AC（MD）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">PV 2 ／ AC 2（いずれも例示・実装が定める）</td></tr>
</table>

<small>※ 詳細パネル自体は実在（schedule の Inspector）。<b>予定終了日</b>のフィールドも実在（Inspector「基準完了日」＝`frozenSlot`・MODEL §3②）。<b>予定開始日・実績開始日・実績終了日</b>は定義済み要件（moira-schedule Req13）で、参照スライスの Inspector は未描画。**日付の値はすべて例示**（「実在」はフィールドの存在を指し日付値ではない）。作成中（implementing）に開くと実績終了日は「未」（moira-schedule Req13 AC3 の honest empty）。誕生直後の実装-1・実装-2 は未見積・pending ゆえ予定/実績日とも未確定（honest empty）。</small>

### 4-5. decision インボックス（横断）— タスクのレビュー・承認は出ない／実装誕生も横断判断ではない

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td style="padding:6px 10px">🗂 decision インボックス（横断）（全断面）</td></tr>
  <tr>
    <td style="padding:14px 10px;border:1px solid #cbd5e1;color:#64748b;text-align:center">— タスクの「レビュー待ち（承認）」「承認」はここには出ない。成果物の承認（`implemented→accepted`）は5コミット判断のうちの4つにも判断要警告にも含まれず、フェーズ進行は SDLC 既定の手番。レビューは人間レビュー待ちキューで扱う。タスク承認の §2.6 帰結である実装ノードの誕生（decompose）も、システムが自動で行う構造操作であって人間の横断的意思決定ではないため、ここには出ない（実装の見積・ノード化要否の確認は次ユニット estimate-impl-agreed の主題）。 —</td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 担当（作業者） | レビュー担当 | 出来高 EV_abs 寄与 | 実コスト AC | 実行カバレッジ寄与 |
|---|---|---|---|---|---|---|---|
| └ 要件定義 | accepted | agreed（3人日） | Claude | 太郎 | ✅ 3（獲得済み・不変） | 既往 | ❌ |
| └ レビュー作業（要件定義） | accepted | agreed（1人日・例示） | 太郎 | — | ✅ 1（不変） | 既往 | ❌ |
| └ 設計 | accepted | agreed（5人日） | Claude | 太郎 | ✅ 5（獲得済み・不変） | 既往 | ❌ |
| └ レビュー作業（設計） | accepted | agreed（1人日・例示） | 太郎 | — | ✅ 1（不変） | 既往 | ❌ |
| └ タスク | accepted（承認済み） | agreed（2人日） | Claude | 太郎 | ✅ 2（完了で獲得済み・accepted でも不変） | 既往＋**承認レビュー工数があれば畳んで帰属（§7#18(b)(iv)）** | ❌（`implementing` でない） |
| └ レビュー作業（タスク） | accepted（自明な一段で底打ち） | agreed（0.5人日・例示） | 太郎 | —（未指名・fold ゆえ専用 reviewer 不要） | ✅ 0.5（レビュー実施で獲得・以後不変・ノードは消えない） | レビュー実施分 | ❌ |
| └ 実装-1 | pending（誕生・未着手） | **見積なし** | —（未割当） | — | —（未見積で誕生＝I1 総和から除外） | — | ❌（`implementing` でない） |
| └ 実装-2 | pending（誕生・未着手） | **見積なし** | —（未割当） | — | —（未見積で誕生＝I1 総和から除外） | — | ❌（`implementing` でない） |

出来高 EV%：**100%（見かけ）**（EV_abs 12.5〔要件定義3＋レビュー作業1＋設計5＋レビュー作業1＋タスク2＋タスクレビュー0.5〕 / 合意済み最新見積総和 12.5。Mid②/After とも 100% で不変＝承認は EV を足さず、未見積の実装は R-U8 で達成率の分母に未算入。**この 100% は分母 12.5＝既知の見積もり済み spec 作業に対する完了度で、実装本体は未見積**）<br>
見積カバレッジ（P2）：**75%**（合意済み有効葉 6 / 既知の有効葉 8。**タスク accepted の §2.6 帰結で実装-1・実装-2 が未見積で誕生し既知の葉が 6→8 に増えた**＝Before/Mid① の 100% から低下。未見積子は I1 総和から除外＝moira-core Req11.2。次ユニット estimate-impl-agreed で実装が見積・合意されると 75%→100% に回復）<br>
実行カバレッジ：**0%**（`implementing` の合意済み有効葉 0 / 6。Before は 17%〔タスク〕・Mid①/Mid②/After の各断面は 0%。**なお Mid①→Mid② の間、太郎がタスクレビュー作業を実施している最中は review-tasks が `implementing` ゆえ実行カバレッジは一時的に 17%〔1/6〕へ戻る**——4断面はこの過渡を畳んでおり、各断面値は過渡の前後を示す。**設計のとき（design-spec-completed の After）と違い、次フェーズ着手が無いため終端でも 0% のまま**〔実装ノードは未見積・pending で着手可状態に至らない〕。実行カバレッジは assignee 種別に依らず `implementing` 葉を数える〔人間作業も算入・moira-evm Req5〕）<br>
CPI：承認レビューに**工数を要したぶん**だけ AC が増え EV_abs(12.5) は不変 → わずかに悪化（即決で工数ゼロなら不変。WIP 悲観側振れは開示・Req 9.5）

<small>※ **達成率（EV%）・見積カバレッジ・実行カバレッジは別の物差し。** EV% は「完了（implemented/accepted）した予算の割合（分母＝合意済み見積）」、見積カバレッジは「見積もり済みの割合（合意済み葉/既知の葉）」、実行カバレッジは「着手中（implementing）の葉の割合」。本ユニットでは EV% が 80%→96%（タスク作成完了）→100%・見かけ（タスクレビュー完了）と**完了のたびに**動き、承認（accepted）では動かない。**見積カバレッジは終端でのみ 100%→75% に動く**（タスク承認の §2.6 帰結で実装が未見積で誕生＝既知の葉が増えた）。実行カバレッジは着手のたびに動き、終端は 0%（実装は未見積・pending で着手できない）。**「見かけ 100%」の正直さ**：要件定義・設計のときと同じ「書くのも進捗（EV は implemented で獲得）」「承認は品質ゲート（EV を足さない）」に加え、本ユニットは**「達成率 100% でも、それは見積もり済み作業の完了度にすぎず、見積カバレッジ 75% が未見積の実装を正直に示す」**を可視化する（達成率は必ずカバレッジと対で読む＝MODEL P2）——実装ノードが次ユニットで見積・合意されると分母が 12.5→28.5 に増え達成率は 44% へ下がる（MODEL P5(c) 非単調）。**レビュー担当（reviewer）は出来高・カバレッジ・平準化を一切動かさない**付帯属性（MODEL v19 §7#18(b)・moira-core Req6 AC6）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ① タスク分解の作成完了 `transition`（implementing→implemented・actor Claude）＋レビュー担当 太郎を指名する付帯記録、② タスクレビュー作業の実施 `transition`（ready→implementing→implemented・actor 太郎＝レビュー出来高 +0.5）、③（承認レビューに工数を要した場合のみ）承認レビュー工数 `cost`（被レビューノード＝タスクに帰属・§7#18(b)(iv)）、④ タスク承認 `transition`（implemented→accepted・actor 太郎）、⑤ レビュー作業の承認 `transition`（implemented→accepted・fold で底打ち・actor 太郎）、⑥ **実装ノードの誕生 `decompose`（未見積・parent F・actor Claude＝タスク accepted の §2.6 帰結）**。①–⑥は論理操作の括りで、下記 JSON では 8 イベント（e120–e127）に対応——①が e120＋e121（タスクの作成完了＋reviewer 太郎の指名）、②が e122＋e123（タスクレビュー作業の着手→完了）、③が e124、④が e125、⑤が e126、⑥が e127（実装ノード誕生）。**次フェーズ着手のイベントは無い**（生まれた実装は未見積・pending ゆえ `→implementing` に至らない）。件数は実装が決める |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-tasks-completed.md`） | タスク分解の作成内容・根拠、太郎のレビュー所見と承認判断、spec フェーズが出そろい達成率が見かけ 100% に達したこと、タスク承認の帰結で実装が未見積で生まれ見積カバレッジが 75% に下がったこと（＝見かけ 100% が既知作業の完了度にすぎないこと）、達成率が「完了で動き承認では動かない」理由 |
| **spec-value 画面 / schedule-time 画面** | タスクが「作成中→レビュー待ち→承認済み」、レビュー作業（タスク）が「着手可→実施→承認済みへ（自明な一段・ノード/EV は残る）」、実装-1・実装-2 が「未見積で誕生（pending）」、玉がエージェント作業キュー→人間レビュー待ちキュー→（承認で空）、EV% 80%→96%→100%（見かけ・以後据え置き）・見積カバレッジ 100%→75%（終端で実装誕生）・実行カバレッジ 17%→0%→〔一時 17%〕→0%（§4 参照・中間の一時はレビュー作業実施 e122）。**設計ユニットと違い終端で次フェーズ（実装）はキューに現れない**（未見積・pending で着手可状態に至らない） |

```json
[
  {
    "id": "e120", "ts": 120,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "タスク分解の成果物（tasks.md）完成・仕様FIX判定（人間の承認待ち）"
  },
  {
    "id": "e121", "ts": 121,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "lifecycle",
    "to": "implemented",
    "reviewer": { "kind": "human", "id": "dev:taro" },
    "reason": "タスクのレビュー担当に spec オーナー（太郎）を確定（状態を保つ付帯記録。AI が提案し人間が確定）"
  },
  {
    "id": "e122", "ts": 122,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-tasks",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "human", "id": "dev:taro" },
    "reason": "太郎がタスクレビュー作業に着手（ready→implementing）"
  },
  {
    "id": "e123", "ts": 123,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-tasks",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "太郎がタスクレビュー作業を完了（implementing→implemented）＝レビュー出来高 EV 0.5 を獲得"
  },
  {
    "id": "e124", "ts": 124,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "cost",
    "node": "F/tasks",
    "amount": 0.25
  },
  {
    "id": "e125", "ts": 125,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "lifecycle",
    "to": "accepted",
    "reason": "タスク分解の成果物を承認（品質確認）。implemented→accepted（出来高は不変）"
  },
  {
    "id": "e126", "ts": 126,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-tasks",
    "machine": "lifecycle",
    "to": "accepted",
    "reason": "レビュー作業ノードの承認（fold で底打ち＝専用 reviewer 不要・無限後退の停止。ノード/EV=0.5 は不変）"
  },
  {
    "id": "e127", "ts": 127,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "タスクの accepted 到達（e125）を契機に、作業分解の成果物のトップレベル項目から実装ノードを未見積で誕生（§2.6/§2.3・R-E1b）。見積もり済みの割合 100%→75%",
    "children": [
      { "node": "F/impl-1" },
      { "node": "F/impl-2" }
    ]
  }
]
```

<small>注：ノード ID・ts 値・cost amount は例示で実装が決める。**e120** はタスク分解の作成完了＝`implementing→implemented`（出来高 EV 2 はこの時点で獲得＝ev.ts `COMPLETED={implemented,accepted}`）。**e121** は「状態を保つ `transition`（to=現状態 implemented）に `reviewer` 属性を載せた付帯記録」で、タスクのレビュー担当 太郎を指名する人間のコミット判断（MODEL §2.4/§2.8/R-T5・moira-core Req6 AC4。AI は spec オーナーを提案、人間が確定。指名 reviewer は実承認者と異なってよい＝§2.4）。**e122–e123** はタスクレビュー作業（review-tasks）の実施——太郎が assignee で `ready→implementing→implemented` と進み、**完了（e123）でレビュー出来高 EV 0.5 を獲得**（review-tasks は A1 通常作業ノード＝MODEL §7#18(b)。EV% 96%→100% はこの e123 による）。**e124** は承認レビュー工数の `cost`（`CostEvent` は `kind`/`node`/`amount` のみ＝`types.ts`）——**承認レビューに工数を要した場合のみ生じる**（即決なら e124 は出ず AC・CPI は不変。これは e122–e123 の計画済みレビュー作業とは別の、承認ゲートで追加的に要した工数の畳み帰属＝§7#18(b)(iv)）。**e125** はタスク承認＝`implemented→accepted`（出来高は両状態とも COMPLETED で計上され不変）。**e126** はレビュー作業ノードの承認＝fold（lifecycle 畳み）で底打ち（§7#18(b)(vii)）——**fold は「イベントを出さない」意味ではなく**（本作も accepted の transition を1件出す）、「レビューのレビュー…の無限後退を止める／レビュー作業ノードを EV ごと消さない」意味。専用 reviewer は不要で、タスクの reviewer 太郎が一段で発行。`accepted` も完了として出来高に算入＝EV=0.5 不変（コスト畳み＝EV なし とは別概念）。**e127** は実装ノードの誕生＝`decompose`（parent F・actor Claude〔agent〕。**この actor はシステム起動の構造操作の一例**で、MODEL §2.6 は decompose の actor を制約せず§6(C) も主語を「システム」と書く＝具体 agent id は実装依存）——**タスクの accepted 到達（e125）を契機とする MODEL §2.6 の二段 decompose 第1段**で、作業分解の成果物のトップレベル項目から実装ノード（impl-1・impl-2）を**未見積**（children に estimate を持たない＝合意予算なし）で誕生させる。未見積子は I1 総和から除外（moira-core Req11.2）され達成率の分母にも未算入（R-U8）ゆえ達成率は 100% 据え置きだが、既知の葉が 6→8 に増え**見積カバレッジが 100%→75% に低下**する。**この e127 は次ユニット `estimate-impl-agreed` が起点 e050 として参照する同一の論理イベント**（id/ts は各ユニットの例示連番で、論理的に同一の decompose を指す。estimate-impl-agreed はこの誕生後＝見積もり済み 75% を起点に、第2段 est(impl) で見積・合意する）。**次フェーズ着手のイベントは無い**——生まれた実装は未見積・pending で着手可（ready）にも `→implementing` にも至らない（設計ユニットの e117〔タスク着手〕に当たる行が無いのが背骨合成の継ぎ目）。`kiro-spec-tasks` は**既存スキル**だが moira を直接知らず、その起動が moira のイベント（タスク transition）を emit する書き込み機構（`moira-progress` 仮称・⚠）は未実装——⟿ はこの「既存スキル起動 → 未実装 emit 機構 → moira 状態遷移」の継ぎ目を指す（本ユニットで行使されるのはタスクの**完了** emit＝e120 の一面。`kiro-spec-tasks` の**起動**自体は先行 design-spec-completed の After で済み。e127 の decompose は skill 起動ではなくシステム内部の §2.6 帰結で、emit 主体は別系統＝`moira-progress` 仮称）。レビュー・承認・実装誕生はいずれも decision インボックスの対象外。event 型は `moira/backend/src/types.ts` の `TransitionEvent`／`CostEvent`／`DecomposeEvent`（children の estimate は任意）に一致。</small>

## 6. 受け入れ条件（EARS）

<!-- 検証ループ後に確定した決定のみを §7 に記す。 -->

**（A）タスク分解の作成完了で出来高が上がり玉が人間へ**

- **WHEN** 開発者がタスク分解の作成を打鍵し Claude が成果物を作り終えたとき、**システムは** タスクの行を「作成中（implementing）→作成完了（レビュー待ち＝implemented）」へ進め**なければならない**。
- **WHEN** タスクが作成完了になったとき、**システムは** 出来高（進捗）を、そのタスクの合意済み見積分だけ上げ**なければならない**（作成完了で出来高が上がる）。
- **WHEN** タスクが作成完了になったとき、**システムは** 出来高を途中段階の部分的な割合では計上**してはならない**（出来高は作成完了で初めて満額算入する＝二値）。
- **WHILE** タスク分解を作成している（作成中の）間、**システムは** 担当（作業者）を画面に示し、当該作業をエージェント作業キュー（玉＝エージェント）に現さ**なければならない**。
- **WHEN** タスクが作成完了になったとき、**システムは** 当該作業をエージェント作業キューから外し人間レビュー待ちキューへ移し、いま動くべき側が人間（レビュー担当）であることを画面で分かるように示さ**なければならない**（玉がエージェント→人間へ移ったことが分かる）。
- **WHEN** タスクが作成完了になったとき、**システムは** それを人間のレビュー待ち一覧に 1 件として現さ**なければならない**。
- **WHEN** タスクがレビュー待ちになったとき、**システムは** その**レビュー担当（次に誰がレビューするか）を、担当（作業者）とは別に画面で示さ**なければならない（作業者が Claude でも、レビュー担当が太郎だと一目で分かる）。
- **WHEN** レビュー担当を決めるとき、**システムは** それを人間のコミット判断として扱い、自動で決め**てはならない**（AI は spec オーナーを推薦してよいが、最終は人間）。
- **WHEN** タスクが作成完了になったとき、**システムは** それを横断の decision 一覧（インボックス）に出**してはならない**（レビュー待ちはレビュー一覧で扱う）。
- **WHEN** タスクが作成完了（implemented）に達したとき、**システムは** タスクレビュー作業を、その前提（タスクの完了）が満たされたものとして「着手可（ready）」に進め**なければならない**（依存の仕組みは §7 を参照）。

**（B）レビュー実施は出来高を得るが、承認は出来高を足さない**

- **WHEN** 太郎がタスクのレビュー作業を完了したとき、**システムは** レビュー作業（タスク）の合意済み見積分だけ出来高を上げ**なければならない**（レビューも作業＝進捗）。
- **WHEN** 開発者がタスクを承認したとき、**システムは** タスクを「レビュー待ち（implemented）」から「承認済み（accepted）」へ進め**なければならない**。
- **WHEN** タスクが承認されたとき、**システムは** タスクの出来高（EV）を増やしても減らしても**ならない**（出来高はレビュー待ち到達時に既に獲得・予算は完了時に施錠されている）。
- **WHEN** タスクが承認されたとき、**システムは** 達成率（EV%）を承認それ自体では変え**てはならない**（承認は完了→完了の移動であって新たな出来高を生まない）。
- **WHEN** タスクが承認されたとき、**システムは** レビュー作業（タスク）の行の出来高を変え**てはならない**（出来高100%のまま・ノードは消えない）。
- **WHEN** タスクが承認されたとき、**システムは** レビュー作業（タスク）の行も「完了（implemented）」から「承認済み（accepted）」へ進めてよく、その際レビュー作業の出来高を変え**てはならない**（承認段は自明な一段で、専用のレビュー担当を要さない。一段の fold を行わない場合でも、一次／二次レビューの提示上の区別は提示層が担うため〔§7〕、レビュー作業ノードがレビュー待ちの滞留として前面に残り続けることはない）。
- **IF** 承認のために追加のレビュー工数が費やされたなら、**WHEN** その工数が記録されたとき、**システムは** その工数を実コスト（AC）としてのみ計上し、出来高（EV）を動かし**てはならない**（出来高を伴わない実コスト増はコスト効率（CPI）を悪化させる。工数がゼロなら AC・CPI は動かない）。
- **WHEN** タスクが承認されたとき、**システムは** タスクを人間レビュー待ち一覧から外さ**なければならない**。

**（C）spec フェーズ出そろいの達成率は見かけ 100%——タスク承認の帰結で実装が未見積で誕生し見積カバレッジが下がる／次フェーズには着手しない**

- **WHEN** 要件定義・設計・タスク（と各レビュー作業）がすべて承認済みになったとき、**システムは** 達成率（EV%）を、その時点で**見積もり済み（合意済み）の作業に対する完了度**として示さ**なければならない**（spec フェーズ完了で達成率は見かけ 100% に達する）。
- **WHEN** タスクが承認済み（accepted）に達したとき、**システムは** 実装ノード群を**見積なしで作成**し（§2.6 帰結。MODEL §2.6 は「実装タスク群」を生むとのみ定め粒度を規定せず、ノード粒度は方法論／プロジェクト規約＝P0 に従う。本ユニットでは作業分解の成果物のトップレベル作業項目を一例とする）、それにより見積もり済みの割合（見積カバレッジ）が下がることを表示に反映**しなければならない**。
- **WHEN** 実装ノードが未見積で誕生したとき、**システムは** その未見積ノードを達成率（EV%）の分母に算入**してはならず**（達成率は 100%・見かけ のまま）、**かつ** 既知の作業として見積カバレッジの分母には算入**しなければならない**（達成率 100% と見積カバレッジ 75% の乖離が「未見積の実装作業がある」ことを正直に示す）。
- **WHEN** 達成率が見かけ 100% に達したとき、**システムは** それを「未発見・未見積の作業を含めた絶対的な完了」として提示**してはならない**（達成率は常に合意済み見積を分母とする導出であり、未見積の実装作業を含まない。見積カバレッジと対で示す）。
- **WHEN** 後続で実装作業が見積もられ合意され、合意済みの全体量が増えたとき、**システムは** 達成率の表示をその新しい全体量に基づいて更新**しなければならない**（達成率は新規合意見積の算入で下がりうる＝非単調を隠蔽しない。低下は本ユニットの対象外＝次ユニット）。
- **WHEN** 実装ノードが未見積で誕生した時点で、**システムは** それを実行カバレッジ（着手中の合意済み葉の割合＝R-S8）の算定に算入**してはならない**（未見積ノードは「合意済み葉」でないため、その lifecycle が pending でも ready でも、実行カバレッジの分子・分母いずれにも入らない）。**かつ** その帰結として実行カバレッジが「着手中の合意済み作業は無い（0%）」と示すことを正直に表示**しなければならない**（生まれた実装は未見積・未割当で、出来高を生む着手＝`implementing`〔合意済み葉〕には至らない。その見積・合意は別の作業＝次ユニットの主題）。

**（共通）**

- **WHEN** 各作業が画面に表示されるとき、**システムは** その担当（作業者）と（レビュー待ちなら）レビュー担当を、spec-value と schedule の両方で一目で分かるように示さ**なければならない**。
- **WHEN** 開発者が作業の詳細を開いたとき、**システムは** 予定開始日・予定終了日・実績開始日・実績終了日と、出来高・計画値・実コストを示さ**なければならない**。
- **WHEN** 開発者が特定のレビュー担当のレビュー待ちだけを見たいとき、**システムは** レビュー担当を選んでその担当の項目だけに絞り込める手段を提供**しなければならない**（per-node の reviewer を選んで突き合わせる絞り込み）。
- **WHEN** タスク承認や実装ノード誕生が起きたとき、**システムは** それらを横断の決定一覧（インボックス）に出**してはならない**（フェーズ進行・システム内部の構造操作は通常の手番であって横断的な意思決定の集約対象ではない）。

## 7. 決定事項

<!-- 検証ループ後に確定した決定のみを記す。 -->

- **本ユニットは姉妹 `design-spec-completed` の転記合成（設計→タスクに置換）であり、人間意図（§3）はユーザー批准済み（2026-06-29）。** 確定ループ中の `design-spec-completed`（設計の作成完了→承認→次フェーズ着手）の振る舞いを、フェーズを「設計→タスク」に置換し、終端を「次フェーズ＝タスク着手」から「タスク承認の §2.6 帰結＝実装ノードの未見積誕生」に差し替えて1本のハッピーパスに合成した。§3 はユーザーが読み返し終端のふるまい（実装の誕生時期＝タスク完了時／見積カバレッジ 100%→75%）を裁定して批准した人間意図。転記で変わる中核は数値（EV/EV%・カバレッジ）とノード名（tasks/review-tasks）で、機構（lifecycle・EV 獲得規則・fold・キュー導出）は姉妹と同一。**姉妹と異なる本質的差分は終端**——設計ユニットが「次フェーズ（タスク）着手で実行カバレッジが 0%→17% に動く」で終わるのに対し、本ユニットは spec フェーズが出そろって**達成率が見かけ 100%** に達したのち、**タスク承認の帰結で実装ノードが未見積で生まれ見積カバレッジが 100%→75% に下がり**、生まれた実装は未見積・pending ゆえ次フェーズに着手できず実行カバレッジ 0% のまま終わる（後述の §2.6 継ぎ目決定を参照）。
- **転記時に踏襲した3つの boundary（姉妹同型・ユーザー確定済み・2026-06-29）。** ①**開始断面＝タスク implementing**（先行 `design-spec-completed` の postcondition＝タスク着手と接続。「タスクの打鍵を 0 から」ではなく「着手中のタスク分解が完成する」断面から描く）。②**ハッピーパス＝差し戻しなし**（太郎は一度で承認。差し戻し往復は別ユニットで、本ユニットは背骨の最小通しゆえ含めない）。③**終了断面＝spec フェーズ出そろい・達成率 見かけ 100%／実装ノードの未見積誕生・見積カバレッジ 75%／次フェーズ未着手まで**（設計ユニットが次フェーズ着手で終わるのと異なり、本ユニットは §2.6 帰結の誕生で終わる＝下記 §2.6 継ぎ目）。
- **【§2.6 継ぎ目・ユーザー裁定済み 2026-06-29＝Reading Y】終端は「実装ノードがタスク承認の §2.6 帰結として未見積で誕生・見積カバレッジ 100%→75%・達成率 見かけ 100%（分母 12.5）」として描く。** MODEL §2.6「tasks ノードの accepted 到達を**契機**に feature 主語の decompose が実装ノードを生む」・§2.3「tasks 完了 → 実装ノードを未見積で誕生 → est(impl)」・moira-core Req11.2「tasks 完了で生まれた直後の実装ノード（未見積で I1 総和から除外）」に従い、**タスクが accepted に達する終端（e125）を契機に実装ノード（実装-1・実装-2）を未見積で誕生（e127）させる**。これにより既知の葉が 6→8 に増え見積カバレッジが 100%→75% に低下する（達成率は未見積実装が R-U8 で分母外ゆえ 100%・見かけ のまま）。**当初は計画 #9 の字面「実装ノードはまだ未誕生を明示」に従い Reading X（終端＝未誕生・P2 100%・誕生は次ユニットの起点 e050 に委ねる）で描いたが、(i) MODEL §2.6 は accepted 到達を誕生契機と定める、(ii) 姉妹 `estimate-impl-agreed` の precondition は「実装は tasks 完了の §2.6 帰結として未見積で誕生済み・P2=75%」で誕生済みを前提とする、(iii) ユーザー直感「実装ノードはタスク完了時に生まれてよい」——の三者一致により、ユーザーが Reading Y を裁定。** Reading Y では本ユニット終端（P2=75%・実装誕生済み未見積・達成率 100%）が estimate-impl-agreed の precondition と完全一致し spine が連続する。本ユニットの e127 が estimate-impl-agreed の起点 e050 と**同一の論理イベント**（同一の decompose を各ユニットが自連番で参照）であり、これにより estimate-impl-agreed §7(d) の未決「実装ノード誕生を独立ユニット（tasks 完了の断面）として切り出すか」は**本ユニット終端への取り込みで解消**（estimate-impl-agreed は誕生後＝75% 起点を扱う点は不変ゆえ、同ユニットの編集は不要）。出所＝MODEL §2.6/§2.3・moira-core Req11.2・`estimate-impl-agreed` §2/§7(a)/§7(d)・ユーザー裁定 Reading Y。
- **「見かけ 100%」の正直化は本ユニットの新規中核（姉妹になく、終端差から生じる）。** 達成率 100% は**分母 12.5＝見積もり済み（合意済み）の spec 作業に対する完了度**であって、実装本体を含まない。**同じ画面の見積カバレッジ 75% が「未見積の実装作業がまだある」と正直に示す**（達成率は必ずカバレッジと対で読む＝MODEL P2）。実装が次ユニット `estimate-impl-agreed` で見積・合意されると分母が 12.5→28.5 に増え、達成率は **100%→44% へ正直に低下**する（MODEL P5(c) 新規合意見積の算入＝非単調・隠蔽しない）。本ユニットはこの「見かけ 100% → 見積カバレッジ低下 → 正直化」の入口を用意する役割を負う（EV% 弧 `…→80→100(見かけ)→44(正直化)→100(本物)` の中継点で、見積カバレッジ弧 `100→75→（次ユニットで）100` の起点でもある）。提示側は見かけ 100% を絶対完了として誇張せず、見積カバレッジ 75% を併示する（§4-1 After の ⚠ 注記・§6(C)）。
- **実装ノードは未見積で誕生→別段で見積（R-E1b）。** 実装ノードは未見積の葉として誕生し（I1 総和から除外＝Req11.2、達成率分母からも除外＝R-U8）、見積は tasks ノードの decompose に内包せず別段（est(impl)・次ユニット）で作業分解の成果物を入力に行う。ゆえに見積カバレッジが本ユニット終端で低下（100%→75%）してから次ユニットで回復（75%→100%）する。実装ノードの単位は「作業分解の成果物のトップレベル作業項目」とする——**ただし MODEL §2.6 は decompose が「実装タスク群」を生むとのみ定め粒度を規定せず、MODEL A1 も作業ノードの存在を述べるが粒度を規定しない**。粒度は方法論／プロジェクト規約（P0）の選択で、特定方法論・ファイル名に依存しない（cc-sdd では `tasks.md` のトップレベル番号タスクが一例）。出所＝MODEL R-E1b・§2.3・§2.6（粒度は P0）。
- **出来高 EV% は「完了」で動く——タスクの作成完了（implemented）で 80%→96%、タスクレビュー作業の完了で 96%→100%（見かけ）。承認では動かない。** 出来高 EV_abs は**完了葉（`implemented` または `accepted`）かつ合意済み**の凍結予算を算入（`ev.ts` の `COMPLETED={implemented,accepted}`、moira-evm 1.1）。タスクが `implemented` で EV_abs に 2人日（EV% = 12/12.5 = 96%）、タスクレビュー作業（review-tasks）が `implemented` でさらに +0.5（EV% = 12.5/12.5 = 100%・見かけ）。**承認（`implemented→accepted`）は完了→完了の移動ゆえ EV を足さない**（EV% 100% 据え置き）。**終端の実装ノード誕生も EV% を動かさない**（未見積＝R-U8 で達成率の分母に未算入）。部分EV は計上しない＝二値（MODEL v16 で却下）。EV% は現在状態の導出ゆえ差し戻し（別ユニット）や新規見積合意（次ユニット）で後退しうる（MODEL P5 非単調）。
- **承認の AC・CPI への影響は条件付き（無条件ではない）。** 承認レビューに**工数を要した場合のみ**、その工数を畳んで実コスト計上し被レビューノード（タスク）に帰属させ（§7#18(b)(iv)・§5 e124）、出来高を伴わない AC 増として CPI をわずかに悪化させる。**即決（工数ほぼ0）の承認なら cost は立たず AC・CPI は不変**。この e124（承認ゲートで追加的に要した工数）は、e122–e123 の**計画済みレビュー作業（review-tasks・EV 0.5 を獲得）とは別物**——前者は承認段の追加工数の畳み帰属、後者は計画段階で見積・合意した通常作業ノードの実施。姉妹 `design-spec-completed` §7 の条件付き是正（「承認で必ず CPI 悪化」の無条件断定を hedge へ）を継承する。
- **レビュー作業（タスク）ノードの承認は「lifecycle 畳み」——ノードも EV=0.5 も消えない。** §7#18(b)(vii) の fold は「レビューのレビュー…の無限後退を底打ちする／専用のレビュー担当を要さない」意味であって、**「イベントを出さない」意味ではない**（本作も accepted の transition を1件出す＝e126）。`accepted` は完了状態として出来高に算入され EV=0.5 は不変。**「コスト畳み（レビュー工数を cost だけにし EV なし）」とは別概念**——この二義の取り違えが「畳むと 12.5→12 に減るのでは」という混同を生むため本文で明示区別した（姉妹 `design-spec-completed` から継承）。本ユニットの 96%→100% は**レビュー作業の実施（e123）**による +0.5 であって、fold（e126）でも承認（e125）でも実装誕生（e127）でもない。
- **レビュー作業（タスク）ノードの実施で EV を獲得する（happy path 固有の接地）。** 本ユニットは**差し戻しのないハッピーパスを1本に合成**するため、タスクレビュー作業（review-tasks）の `ready→implementing→implemented`（EV 0.5 獲得）を**ユニット内で明示**する（e122–e123）。これは review-work-estimated が確立した「レビュー作業ノードは A1 通常作業ノードとして出来高を得る」（MODEL §7#18(b)）の素直な適用であり、新機構ではない（姉妹 `design-spec-completed` の e112–e113 と同型）。
- **レビュー作業ノードの承認者は指名 reviewer 不要。** レビュー作業（タスク）の reviewer は未指名でよく、タスクの reviewer（太郎）が一段で発行する。指名 reviewer と実承認者の不一致は §2.4 で許容。
- **担当（作業者）と レビュー担当（reviewer）は別の役割＝MODEL v19。** 担当（assignee）は「その作業を誰がやる/やったか」＝タスク分解作業は **Claude（agent）**、タスクレビュー作業は **太郎（human）**、誕生直後の実装ノードは**未割当**。**レビュー担当（reviewer）は「`implemented→accepted` を行うべく指名された人間」＝太郎**で、assignee とは**別の付帯属性**（単一・latest-wins・人間限定・**平準化/EV/PV/coverage を消費しない**）。両者を両画面に別表示する（要件: moira-surface-spec-value Req10/Req11・moira-surface-schedule Req3 AC4・moira-schedule Req14・moira-core Req6 AC4-6）。
- **レビュー担当の指名（e121）は §3／§6 批准済みの「レビュー担当で絞り込める」ふるまいの含意。** §6 は「特定のレビュー担当のレビュー待ちだけを見たい」絞り込みを要求する——これは reviewer が確定していることを前提とする。よってタスクが implemented になった直後（e120）、その人間レビューを担う太郎を reviewer に指名するコミット判断が伴う（e121）。これは to＝現状態（implemented を保つ）の**状態保存遷移**として記録される付帯属性の設定（MODEL §2.4・moira-core Req6 AC4-6・単一・latest-wins・人間限定）で、lifecycle を進めず EV/PV/coverage も動かさない。Mid① 断面は e120（タスク完了）と e121（reviewer 指名）の双方を適用した後を描く（姉妹 `design-spec-completed` の reviewer 指名と同型）。§3 本文は指名を独立の手番として列挙しないが、指名なしに「レビュー担当で絞り込む」は成立しないため reviewer 確定は §3／§6 が含意する（AI が spec オーナーを提案し人間が確定する付帯記録であって、AI 由来の新ふるまいではない）。
- **「玉」は MODEL の一級概念ではなく schedule-time キュー（P4）の俗称。** 玉（次の手番）は lifecycle から導出（`{ready, implementing}`∧assignee=agent→エージェント作業キュー、`implemented` の葉→人間レビュー待ちキュー＝actor 非依存・`queues.ts`）。MODEL v19 は「assignee を ball-holder へ再定義」案を却下済み。Mid②/After 断面では両キューとも空＝導出上「玉」は存在しない。**設計ユニットではここで開発者が次フェーズ（タスク）を着手させ玉が AI に戻ったが、本ユニットでは誕生した実装ノードが「未見積・pending」のため、agentWorkQueue（{ready, implementing}∧agent）にも humanReviewQueue（implemented 葉）にも該当せず、どちらのキューにも現れない**（隠蔽ではなく木に在るが着手可状態に至っていない正直な状態。見積・合意は estimate-impl-agreed の射程）。**【cross-unit nit】** 本ユニットは agentWorkQueue を `queues.ts`（`ready || implementing` かつ assignee=agent）に忠実な `{ready, implementing}∧agent` と記すが、agreed 済みの姉妹 `design-spec-completed` は同箇所を `implementing∧agent`（`ready` を欠く）と不正確に記している。本ユニット側が正典準拠で正しく、姉妹の是正は本セッション射程外（tasks-spec-completed.md のみ新規作成）の follow-up とする。「機構は姉妹と同一」の宣言はこの表記精度差を除いて成立する。
- **タスク着手中（太郎のレビュー作業中）のキュー所在。** 太郎がタスクレビュー作業（review-tasks）を実施する間（implementing・assignee=太郎＝human）、それは agentWorkQueue（assignee=agent 限定）には入らない人間の作業である。タスク成果物（tasks）自体は太郎の承認判断を待って人間レビュー待ちキュー（`implemented` 葉・actor 非依存）に残る。承認で tasks・review-tasks がともに accepted になり humanReviewQueue から外れる（素の導出で 0。なお一次／二次レビューの提示上の区別は提示層の責務＝§7#18(b)(viii)・MODEL 非保持。「畳んで隠してよい」という意味ではない）。
- **タスク完了の前提は先行ユニットで成立済み（本ユニットはタスク implementing から始まる）。** 開発者がタスク分解を Claude に割当（P0・§2.1#2）し kiro-spec-tasks を起動してタスクが implementing になる遷移は、先行 `design-spec-completed` の After（タスク着手）で描かれ済み。本ユニットの precondition はその postcondition（タスク implementing）を継承する。
- **⟿ シームは「既存スキル起動 → 未実装 emit 機構 → moira 状態遷移」。本ユニットで行使されるのはタスクの完了 emit と実装誕生の decompose emit。** `kiro-spec-tasks` は実在スキルだが moira を直接知らず（moira/event-store への参照ゼロ）、その起動が moira イベント（タスク transition）を emit する書き込み機構（`moira-progress` 仮称・⚠未実装）は未実装。⟿ はこの継ぎ目を指す。本ユニット内で行使される ⟿ は2面——(i) タスクの**完了** emit（implementing→implemented・e120。`kiro-spec-tasks` の**起動**自体は先行 `design-spec-completed` の After で済み、本ユニットは完了の継ぎ目を行使）、(ii) タスク accepted を契機とする**実装ノード誕生 decompose emit**（e127）。後者は skill 起動による着手 emit ではなくシステム内部の §2.6 帰結（emit 主体は `moira-progress` 仮称等の別系統・⚠未実装）。**設計ユニットが持っていた「次フェーズ着手 emit」（e117・タスク着手）に当たる ⟿ は本ユニットに無い**——本ユニットの終端は「着手」ではなく「誕生」で、生まれた実装は未見積・pending ゆえ着手 emit に至らない。スキルの実在は `.claude/skills/kiro-spec-tasks` で確認できる。
- **達成率（EV%）・見積カバレッジ・実行カバレッジは別の物差し。** EV%＝「完了（implemented/accepted）した予算の割合（分母＝合意済み見積）」、見積カバレッジ（P2・moira-evm Req3）＝「見積もり済みの割合（合意済み有効葉/既知の有効葉）」、実行カバレッジ（R-S8・moira-evm Req5）＝「着手中（implementing）の合意済み葉のカウント比」。本ユニットでは EV% が完了のたび（タスク作成完了・タスクレビュー完了）に動き、見積カバレッジは終端の実装誕生（100%→75%）でのみ動き、実行カバレッジは着手のたび（タスクレビュー着手）に動く。承認は三者いずれも動かさない（完了→完了）。実装誕生は見積カバレッジのみ動かす（達成率・実行カバレッジは不変）。実行カバレッジの素の弧は **17%（タスク implementing）→0%（タスク implemented・レビュー作業は ready）→〔タスクレビュー作業の実施中 e122 は一時的に 17%〕→0%（レビュー作業 implemented／その後 accepted）→0%（終端・実装は未見積 pending で着手不能）**。中間の一時的 17%（review-tasks implementing）は素の導出に現れる瞬間値であり、§4 は4断面（Before/Mid①/Mid②/After）を描いて review-tasks の implementing→implemented→accepted を Mid② に「自明な一段」として畳む（§7#18(b)(vii)）ため、§4 のパネルには独立断面として現れない——畳むのは**提示の断面選択**であって瞬間値が存在しないわけではない（正直化）。**設計ユニットの終端が 17%〔タスク着手〕だったのに対し、本ユニットの終端は 0%〔実装は未見積 pending〕**である点が背骨合成の継ぎ目の差。
- **見積カバレッジ(P2) は葉基底——Before/Mid① は 100%・終端は 75%。** Before/Mid① では合意済み有効葉 6 / 既知の有効葉 6 = **100%**（フェーズ 3 葉＋計画段階合意済みのレビュー作業 3 葉）。**終端ではタスク accepted の §2.6 帰結（e127）で実装-1・実装-2 が未見積で誕生し既知の有効葉が 6→8 に増え、合意済み 6 / 既知 8 = 75% に低下**（未見積子は I1 ロールアップから除外＝moira-core Req11.2）。中間ノード F は I1 ロールアップで分母外。出所＝MODEL §3 P2・参照実装 `coverage.ts` の `effectiveLeaves`・姉妹 `estimate-impl-agreed`（起点 75% と一致）。次ユニットで実装が見積・合意されると 75%→100% に回復する。
- **フェーズ進行・実装誕生は decision インボックスの対象外。** タスクのレビュー待ち・承認は SDLC 既定の手番（通常の品質ゲート遷移）であって、横断的な意思決定の集約対象ではない（成果物の承認は5コミット判断のうち4つにも判断要警告にも非該当＝UI-ARCHITECTURE §3・MODEL §2.1）。タスク承認の §2.6 帰結である実装ノード誕生（decompose）も、システムが自動で行う構造操作であって人間の横断的意思決定ではないためインボックスに出ない（実装の見積・ノード化要否の確認は次ユニット estimate-impl-agreed の主題で、そこで人間の判断が入る）。
- **参照実装は暫定スライス・各要素は定義済み要件への目標。** 担当（作業者）列・レビュー担当列・人間レビュー待ちキューの一覧描画・reviewer フィルタ・詳細の予定/実績日・未見積ノードの表示のうち、参照スライスが未描画のものは「(スライス未描画)」と中立に記した。いずれも MODEL/spec に**定義済みの要件**（frontmatter トレース）への目標受け入れ基準であり、現スライスの挙動には縛られない。
- **イベント件数は断定しない。** lifecycle は `pending→ready→implementing→implemented→accepted`（MODEL §2.5）。§5 は主要遷移を示す。`pending→ready` 等の件数は実装（`moira-progress` 仮称・未実装）が決めるため確定しない。
- **【表現の接地】§2.6 の誕生契機は「accepted 到達」で本ユニットはこれに従う（MODEL 内の「完了」表記は同一マイルストーンの口語）。** MODEL §2.6② は「tasks ノードが `accepted` に達したことを契機に」と**明示的に accepted で pin** する一方、同②末尾「契機(何が先行するか)は tasks ノードの完了であり」や §2.3「tasks 完了」は **`完了` を口語的に用いる**（`ev.ts` の `COMPLETED={implemented, accepted}` ゆえ「完了」は字面上 `implemented` を含みうる）。両者は矛盾ではなく、精密な統制文（§2.6② の `accepted`）が支配し、`完了` はその同一マイルストーンへの言い換えである（§2.6② の主眼は「主語＝feature／契機＝tasks の到達」の区別）。本ユニットは §2.6② に従い**誕生契機を `accepted`（e125）**に置く。MODEL 側の口語ゆれは canon 内で自己解決可能ゆえ ESCALATE しないが、誤読余地として本注で明示開示する。出所＝MODEL §2.6②／§2.3・`ev.ts`。
- **【誕生時 lifecycle】実装ノードは未見積の葉として誕生し、本ユニットは誕生状態＝pending を描く。** §4 のパネルは decompose 直後の初期状態（pending・未割当）を写す。先行（design・tasks）が accepted ゆえ依存が充足し導出 R-D1 で `ready` へ前進しうるかは MODEL が未見積ノードの ready 適格性を明示せず曖昧だが、**いずれであっても本ユニットの三計器は不変**——EV%（未見積は R-U8 で分母外）、見積カバレッジ（lifecycle 非依存で 6/8＝75%）、実行カバレッジ（未見積は R-S8 の合意済み葉でないため pending でも ready でも算入されず 0%）。よって pending 表記は計器に影響しない誕生状態の描写であり、`ready` 解釈とも両立する。**要点は出来高を生む着手＝`implementing` に至らないこと**で、これは lifecycle の曖昧さに依存しない独立の事実——担当割当は人間の P0 決定（§2.1#2）で自動付与の規則は無く、誕生直後の実装ノードは未割当ゆえ `→implementing` に進めない（かつ未見積で予算が施錠されていない）。
- **【射程】F（フィーチャー）の lifecycle は葉から導出され、本ユニットの計器（EV%／P2／R-S8 はいずれも葉基底）に影響しない。** F は中間ノードで、その lifecycle は子葉の状態から導出される（独立の手番ではない）。終端で F が `accepted` でない（pending）のは、実装-1・実装-2 が未完了（未見積・pending）で子葉が出そろわないため——これは正直な状態であって本ユニットの主張（達成率・カバレッジ）には作用しない（feature accepted は背骨 #11 `impl-completed` の到達点）。
- **【射程】本ユニットは §2.6 decompose が正常に発火するハッピーパスを描く。** decompose の発火そのものの失敗（実装バグ等）や、実装ノードが 0 個になる縮退ケースは本ユニットの対象外（背骨の最小通し）。
- **【status の意味】`status: agreed` は falsifiable 確定ゲート通過を表す。** §3 の人間意図はユーザー批准済み（Reading Y・2026-06-29）で、これは確定ゲートの**前提**であって通過ではない。本文書は doc-adversary（G1–G4＋SC1–SC7）→ doc-fact-checker（一次ソース照合）→ doc-gate-judge の2ラウンドを経て、生存 Critical/Important=0・FORK なし・MODEL escalation なし・一次ソース確定で `draft→agreed` に遷移した（README の draft→in-review→agreed）。
- **【spine 継ぎ目】本ユニット終端（P2=75%・実装未見積誕生済み・EV% 100% 見かけ・実行カバレッジ 0%）は次ユニット `estimate-impl-agreed` の precondition と連続する。** 次ユニットの precondition が実行カバレッジに言及せず P2/EV% を主に記すのは、同ユニットが動かす計器が P2/EV% だからで、本ユニット postcondition の「実行カバレッジ 0%（着手中の合意済み葉なし）」とは矛盾しない（着手中作業が無い以上 0% は含意される）。次ユニット側の編集は本セッションの射程外（本セッションは tasks-spec-completed.md のみ新規作成）。
