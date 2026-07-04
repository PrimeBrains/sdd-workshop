---
id: units/design-spec-completed
title: 設計の成果物ができて承認される——作成完了で出来高が上がり（達成率 32%→72%→80%）玉が人間（レビュー担当）へ。承認は出来高を足さず（達成率は据え置き）、レビュー作業は出来高を得てから「承認済み」へ畳まれ、（承認レビューに工数を要すれば）AC が増える。続いてタスク分解に着手すると実行カバレッジが動く（達成率はまだ動かない）
status: in-review
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: ユニット requirements-spec-accepted の後。要件定義は accepted（EV 3）・要件定義レビューは accepted（EV 1）。開発者が kiro-spec-design を起動し Claude が設計作業を進めている最中で、設計は implementing（着手中・assignee Claude）。EV% 32%・実行カバレッジ 17%・玉＝AI（Claude が設計作業中）
postcondition: Claude が設計成果物（design.md）を作り終えて設計が implemented（レビュー待ち）になり出来高が上がり（EV% 32%→72%）玉が人間（レビュー担当＝太郎）へ。太郎が設計をレビューして設計レビュー作業が出来高を得（EV% 72%→80%）、太郎が設計を承認（implemented→accepted）——承認は出来高を足さず EV% は 80% 据え置き、設計レビュー作業も accepted へ畳まれ（ノード/EV は不変）、承認レビューに要した工数があれば AC が増え CPI がわずかに悪化。続いて開発者が kiro-spec-tasks を起動し Claude がタスク分解に着手するとタスクが implementing になり実行カバレッジが 0%→17% に動くが EV% は 80% 据え置き（タスク成果物が完成し implemented に達するのは別ユニット）
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 3.1, 3.4, 3.5, 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6"
  - "moira-evm: 1.1, 1.2, 2.1, 5.1, 5.4, 5.5, 6.1, 6.2, 9.2, 9.5, 11.1, 11.2"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 5.3, 10.1, 11.1, 11.2, 11.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.4"
  - "moira-surface-schedule: 2.5, 3.4, 8.1, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3"
---

# 設計の成果物ができて承認される——作成完了で出来高が上がり（達成率 32%→72%→80%）玉が人間（レビュー担当）へ。承認は出来高を足さず（達成率は据え置き）、レビュー作業は出来高を得てから「承認済み」へ畳まれ、（承認レビューに工数を要すれば）AC が増える。続いてタスク分解に着手すると実行カバレッジが動く（達成率はまだ動かない）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。各画面要素は**定義済み要件**（frontmatter のトレース）への参照を併記します。スライス未実装は中立に「(スライス未描画)」と記し、設計の宿題（赤字）ではありません。

## 1. このユニットで確かめること

先行ユニット `requirements-spec-accepted` の後、開発者が `kiro-spec-design` を起動して Claude が設計作業を進めている（設計＝着手中）。ここから**設計の成果物ができて出来高が上がり、人間が承認するまで**を一続きで確かめる。中核は2つ：

**（A）作成完了で出来高が上がり、玉が人間へ（＝「設計を書くのも進捗」）**
- 設計の成果物（design.md）ができて設計の行が **「レビュー待ち（作成完了・まだ承認前）」** になり、そのとき**出来高（進捗）が設計の分だけ上がる**（着手中は未完了ゆえ上がらず、**作成完了の瞬間に満額**＝二値）。達成率（EV%）は **32%→72%** に動く。
- **担当（作業者）が画面で分かる**こと（この設計作業の作業者は Claude＝エージェント）。担当（作業者）は spec-value と schedule の**両画面**に出る（要件: moira-surface-spec-value Req10／moira-surface-schedule Req3）。
- **誰がレビューするか（レビュー担当＝太郎）が per-node で分かる**こと。レビュー担当（reviewer）は作業者（assignee）とは**別**に表示され、作業者が Claude のままでも「次にレビューするのは太郎」と全員に見える（MODEL v19）。
- **いま動くべき側＝人間（レビュー担当）に玉が渡ったことが画面で分かる**こと（作業がエージェント作業キューから人間レビュー待ちキューへ移動）。この「レビュー待ち＝玉が人間」は**人間のレビュー待ち一覧に現れる**（横断の decision インボックスでは、コミット判断の区画ではなく**「受入判断する」区画**に検収待ちとして映り、承認で消える——2026-07-04 裁定同期・§7）。開発者は**レビュー担当を選んでそのレビュー待ちだけに絞り込める**。

**（B）承認は達成率（EV%）を動かさない——出来高は『レビュー待ち（implemented）』で既に獲得済みで、承認は品質確認のゲート**
- 太郎が設計をレビューすると、**設計レビュー作業（review-design）が出来高を得る**（レビューも作業＝進捗。EV% **72%→80%**）。
- そのうえで太郎が**設計を承認（accepted）しても出来高（EV）は足されない**——**EV% は 80% のまま据え置き**。承認で動くのは：lifecycle が「レビュー待ち」→「承認済み」、**AC が承認レビュー分だけ増え CPI がわずかに悪化**（出来高を伴わない AC 増。即決で工数ゼロなら AC・CPI は不変）、玉（レビュー待ちキュー）から外れる、こと。
- **設計レビュー作業（review-design）の行は出来高100%のまま動かない**（EV=1 不変）。承認時にレビュー作業ノードも「承認済み（accepted）」へ進むが、これは**自明な一段の lifecycle 遷移（fold）**であって**ノードも EV=1 も消えない**。
- 続いて**開発者がタスク分解の作業を指示する（kiro-spec-tasks を起動）と、Claude がタスク分解に着手**し、タスクが「未着手（pending）」→「着手中（implementing）」へ、玉が Claude（AI）へ移る。**この着手では達成率（EV%）はまだ動かず**（着手中は未完了）、代わりに**「着手済みの割合（実行カバレッジ）」が 0%→17% に動く**——EV% と実行カバレッジは別の物差し。

## 2. 前提（Given）

ユニット `requirements-spec-accepted` の後。要件定義は承認済み（accepted・EV 3）、要件定義レビュー作業も承認済み（accepted・EV 1）。開発者が `kiro-spec-design` を起動し、Claude が設計作業を進めている最中（設計＝着手中 implementing・assignee Claude）。玉＝AI（Claude が設計作業中）。

| ノード | 見積状態 | 見積値 | lifecycle | 担当（作業者） | レビュー担当 | 出来高(EV_abs)寄与 |
|---|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | — | 4（子の合計） |
| └ 要件定義 | agreed | 3人日 | accepted（承認済み） | 🤖 Claude | 👤 太郎 | 3（完了∧合意済み） |
| └ レビュー作業（要件定義） | agreed | 1人日（例示） | accepted（承認済み） | 👤 太郎 | — | 1 |
| └ 設計 | agreed | 5人日 | implementing（着手中） | 🤖 Claude | —（未指名） | 0（着手中＝未完了） |
| └ レビュー作業（設計） | agreed | 1人日（例示） | pending（依存元 設計 未 implemented） | — | — | 0 |
| └ タスク | agreed | 2人日 | pending | — | — | 0 |
| └ レビュー作業（タスク） | agreed | 0.5人日（例示） | pending | — | — | 0 |

- 出来高 EV%（達成率）：**32%**（EV_abs 4〔要件定義 3＋レビュー作業 1〕 ÷ 合意済み有効葉の見積合計 12.5）
- 見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 6 / 既知の有効葉 6）
- 実行カバレッジ（R-S8・葉基底＝カウント比）：**17%**（`implementing` の合意済み有効葉 1〔設計〕 / 6）
- 人間レビュー待ちキュー：**0 件**（`implemented` の葉なし。設計は implementing＝作業中で未だレビュー待ちでない）
- 玉（次の手番）：AI（Claude が設計作業中＝エージェント作業キュー）

## 3. ふるまい（When / Then）

```
When  要件定義が承認済み（accepted）で、開発者が設計（デザイン）の作業を指示し
      （kiro-spec-design を起動）、Claude が設計の作業を進めて成果物を作り終える。
Then  Claude が設計の成果物（design.md）を作成し、spec-value 画面で設計の行が
      「レビュー待ち（作成完了・まだ承認前）」になる。
And   出来高（進捗）が設計の分だけ上がる
      （着手中は未完了ゆえ上がらず、作成完了で上がる。数値・タイミングは §4/§7 で正典に接地）。
And   いま作業のボール（玉）を持っているのは人間（レビュー担当）だと、画面を見て分かる。
And   この「レビュー待ち＝玉が人間」は、人間のレビュー待ち一覧に現れる
      （横断の decision インボックスには出ない）。
And   開発者は自分の名前で、自分がレビュー担当の項目だけに絞り込んで確認できる。
Then  続いて開発者（人間）が設計の成果物をレビューして承認する（差し戻しなしの初回承認）。
And   設計のレビュー作業を実施したぶん、レビュー作業（設計）の出来高が上がる（レビューも進捗）。
And   設計は「レビュー待ち（implemented）」から「承認済み（accepted）」へ進む。
And   設計の出来高（EV）は承認では増えも減りもしない
      ——出来高は「レビュー待ち」に達した時点で既に獲得済みで、承認は品質確認のゲートであって出来高を足さない。
And   達成率（EV%）は承認では変わらない（設計が implemented／レビュー作業が完了した時点で既に伸びている）。
And   レビュー作業（設計）の行は出来高100%のまま動かない（完了のまま。承認時に「承認済み」へ畳む）。
And   今回の承認レビューに費やした工数は実コスト（AC）として増える（出来高を伴わない・即決で工数ゼロなら不変）。
And   設計が承認されたことで人間レビュー待ちから外れる。
Then  続いて開発者がタスク分解の作業を指示する（kiro-spec-tasks スキルを打鍵する）と、
      Claude がタスク分解の作業に着手する。
And   タスクの行が「未着手（pending）」から「着手中（implementing）」へ進み、玉が Claude（AI）へ移る。
And   タスクの出来高（EV）はまだ増えない（着手中は未完了＝出来高は完了時に獲得）。
And   達成率（EV%）はまだ変わらず、代わりに「着手済みの割合（実行カバレッジ）」が増える。
```

<small>注：**(1) 設計作成** ＝`kiro-spec-design`（実在スキル）を開発者が起動し Claude が設計作業を進める。lifecycle を進める書き込みの実体は `moira-progress`（仮称・⚠未実装）。「レビュー待ち」は lifecycle の `implemented`（＝作成完了・仕様FIX判定で、人間の承認 `implemented→accepted` 待ち）。**「玉が人間」は、作成中（implementing）の間はエージェント作業キューに居た作業が、作成完了（implemented）で人間レビュー待ちキューへ移ることで表れる**。担当（作業者）は作成者の Claude のまま動かず、新たに現れるのは「レビュー担当（reviewer）＝太郎」（作業者とは別の付帯属性＝MODEL v19）。**(2) 設計レビュー作業** ＝太郎が設計成果物をレビューする作業（review-design ノード・計画段階で見積合意済み＝ユニット `review-work-estimated`）。レビューも A1 通常作業ノードとして出来高を得る（MODEL §7#18(b)）。**(3) 設計承認** ＝設計ノードの `implemented→accepted`（actor＝人間。成果物の品質確認であって仕様を動かさない＝MODEL §2.5/§2.6）。承認レビューに**工数を要した場合のみ**、その工数を畳んで実コスト計上し被レビューノード（設計）に帰属（MODEL §7#18(b)(iv)）——即決（工数ほぼ0）なら cost は立たず AC・CPI は動かない。**レビュー作業ノードの承認** `implemented→accepted` は §7#18(b)(vii) の **fold（自明な一段で底打ち）**で、専用のレビュー担当を要さず（実承認者＝設計の reviewer 太郎が一段で発行）、**ノードを EV ごと消さない**。**(4) タスク着手** ＝`kiro-spec-tasks`（実在スキル）を開発者が起動し Claude がタスク分解作業を進める間ノードが `implementing`。kiro-spec-tasks は moira を直接知らず、moira のイベント（タスク transition）を emit する書き込み機構は未実装（`moira-progress` 仮称・⚠）——⟿ は「実在スキルの起動が（未実装の emit 機構を介して）moira 状態を動かす」継ぎ目を指す。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（状態・担当・レビュー担当・出来高 EV%・実行カバレッジ・CPI）＋ schedule-time（玉＝キュー移動・作業詳細）**。ガントに「進捗バー％」は出さない（出来高 EV% は spec-value/health が host・前段ユニット §7 と整合）。4断面：**Before**（設計 着手中）→ **Mid①**（設計 作成完了・レビュー待ち＝出来高が上がり玉が人間へ）→ **Mid②**（太郎がレビューし承認＝レビュー作業が出来高を得てから承認・承認は出来高を足さない）→ **After**（タスク着手＝実行カバレッジが動くが達成率は据え置き）。

### 4-1. spec-value 画面（状態・担当・レビュー担当・出来高・実行カバレッジ・CPI）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Before — 設計が着手中・Claude 作業中）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>32%</b>（4/12.5）・実行 <b>17%</b>（設計 着手中）・見積カバレッジ(P2) <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義（承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 3（不変）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）（承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 1（不変）</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 設計</b>（着手中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">着手中</span> <span style="color:#64748b">(implementing)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（未指名）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 0</b>（着手中＝未完了）<br><span style="font-size:11px;color:#1d4ed8">実行カバレッジに +1</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span> <span style="color:#94a3b8;font-size:11px">（依存元 設計 未 implemented）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク ／ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外。計2葉・合計 2.5人日）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Mid① — 設計が作成完了・レビュー待ち＝玉が人間へ）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#16a34a">72%</b>（32%→72%・9/12.5）・実行 <b>0%</b>（設計は implemented＝着手中でない）<br><span style="color:#b45309">⚑ 設計はレビュー待ち（玉＝人間）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義（承認済み）／ レビュー作業（要件定義）（承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（accepted・不変。EV寄与 3＋1）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 4（不変）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 設計</b>（レビュー待ちとして強調）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#94a3b8;font-size:11px">作成者</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span><br><span style="color:#b45309;font-size:11px">◀ 次の手番</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 5人日</b>（＝自分の予算満額・二値）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e0e7ff;border-radius:4px;padding:1px 6px">着手可</span> <span style="color:#64748b">(ready)</span> <span style="color:#94a3b8;font-size:11px">（依存元 設計 implemented＝充足）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未着手）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク ／ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ <b>設計「単体」の出来高は EV寄与＝5人日</b>（自分の凍結予算の満額・割合なら 100%・二値）；出力＝作成完了（implemented）の瞬間に満額計上され途中点（50% 等）は無い（部分EV は MODEL v16 で却下）。<b>フィーチャー全体の出来高 EV% は 32%→72%</b>（要件定義3＋レビュー作業1＋設計5＝9 ÷ 12.5＝葉基底）。作成完了で設計が `implemented` に達したため、依存辺（policy=implemented）により<b>設計レビュー作業が ready</b> になる（タスクのレビューは依存元 タスク pending ゆえ pending のまま）。実行カバレッジは設計の作成完了で 17%→0%（implementing の葉が無くなる）。なおこの後、太郎が設計レビュー作業に着手する間（e112・review-design implementing）は実行カバレッジが一時的に 17% へ戻り、完了（e113）で再び 0% になる——§4 はこの一時を独立断面にせず Mid② の「自明な一段」に畳む（§7#18(b)(vii)・素の瞬間値は §7 の弧で開示）。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#166534;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Mid② — 太郎が設計をレビューし承認）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#166534">80%</b>（72%→80%＝<b>レビュー作業の完了</b>で +1、<b>承認では足さない</b>）・実行 <b>0%</b><span style="font-size:11px;color:#b45309">（※ Mid①→Mid② の実施中は一時 17%・§4-5/§7）</span><br><span style="color:#b45309;font-size:12px">⚑ AC 増（承認レビュー分）→ CPI わずかに悪化（出来高は承認では不変）</span></td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 設計</b>（承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span><br><span style="color:#166534;font-size:11px">◀ implemented→accepted（品質確認・出来高は不変）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 5</b>（不変・獲得済み）<br><span style="font-size:11px">AC：承認レビュー工数が畳んで加算（§7#18(b)(iv)）</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）（レビュー実施→承認済みへ・自明な一段）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未指名・fold ゆえ専用 reviewer 不要）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 1</b>（レビュー実施で獲得→以後不変・ノードは消えない）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク ／ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ **「畳む」の二義に注意（重要）:** ここでレビュー作業ノードが `accepted` になるのは **lifecycle 畳み**（§7#18(b)(vii)＝レビューの承認段を自明な一段で底打ちし、レビューのレビューの…という無限後退を止める）であって、**コスト畳み**（レビュー工数を**ノードにせず cost だけ**で記録＝EV なし）とは別物。**lifecycle 畳みではノードも EV=1 も消えない。** よって本断面の **72%→80% は『設計レビュー作業（review-design）の実施＝完了』による +1** であって、**承認（accepted）が出来高を足したのではない**——承認は完了→完了の移動で EV を動かさない（設計の EV 5 も Mid① で既に獲得済み）。承認の前後で合計 EV は **要件定義3＋レビュー作業1＋設計5＋設計レビュー1＝10 のまま**、EV% も **80% のまま**——「畳んだ瞬間に 10→9 へ減る」ことは起きない。なお実行カバレッジは、この Mid① から Mid② へ至る過渡で太郎が設計レビュー作業を実施する間だけ一時的に 17%（review-design implementing・1/6）へ戻り、完了で再び 0% になる（§4-2 の過渡行・§4-5・§7 で開示。各パネル値は過渡の前後を示す）。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（After — 開発者が kiro-spec-tasks を打鍵・Claude がタスク分解に着手）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>80%</b>（<b style="color:#b45309">まだ据え置き＝着手は EV を足さない</b>）・実行 <b style="color:#1d4ed8">17%</b>（0%→17%・1/6）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義／設計／各レビュー作業（要件定義・設計）＝accepted</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（accepted・不変。EV寄与 3＋1＋5＋1＝10）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 10（不変）</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ タスク</b>（着手中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">着手中</span> <span style="color:#64748b">(implementing)</span><br><span style="color:#1d4ed8;font-size:11px">◀ pending→implementing（kiro-spec-tasks 起動 ⟿ 未実装 emit 機構）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未指名）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 0</b>（着手中＝未完了。出来高は完了時に獲得）<br><span style="font-size:11px;color:#1d4ed8">実行カバレッジに +1（着手済み）</span></td>
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

<small>※ **承認 → タスク着手のあいだ、達成率（EV%）は 80% のまま一切動かない。** 出来高は完了（implemented/accepted）で獲得・予算は完了時に施錠されるため（derivations/ev.ts: COMPLETED = implemented ∨ accepted）、承認（accepted）も着手（implementing）も EV を足さない。動くのは (1) lifecycle、(2) AC（承認レビュー分）、(3) CPI（AC 増で悪化）、(4) 玉、(5) 実行カバレッジ（タスク着手で 0%→17%）。「達成率がいつ動くか」＝**完了したときだけ**——タスクが implemented になって初めて EV% が次に動く（本ユニットの対象外）。CPI = EV_abs/AC（MODEL §3・moira-evm Req 9.2）。WIP 中の CPI 悲観側振れは正規化せず開示（Req 9.5）。</small>

### 4-2. schedule-time 画面 — 玉の受け渡し（キュー間の移動）

「玉が AI→人間→AI と動いた」ことは、作業が**2つのキューの間を移動**することで分かる（玉という一級の状態を新設せず lifecycle から導出＝§7）。要件: moira-surface-schedule Req13（一覧描画）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Before（設計 作成中・implementing）— 玉＝AI</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">設計（作成中）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / <span style="color:#94a3b8">レビュー担当 —（未指名）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Mid①（設計 作成完了・implemented）— 玉＝人間（太郎が承認すべき）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）← 設計はここから抜けた</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>人間レビュー待ちキュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>設計</b>（レビュー待ち＝作成完了・承認前）<span style="color:#b45309"> ◀ 玉＝人間</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 <span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Mid②（太郎がレビュー実施→承認）— 実施中は過渡、承認後は両キュー空</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー / 表示（導出）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr style="background:#fffbeb">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">（過渡）レビュー実施中<br><span style="font-size:11px;color:#b45309">Mid①→Mid② の間</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（設計）＝<b>implementing</b>（太郎の人間作業）<span style="color:#b45309"> ◀ どちらのキューにも入らない</span>／設計は人間レビュー待ちキューに残存（承認前・実行カバレッジは一時 17%）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span> / レビュー担当 —</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（承認後は空）<span style="color:#166534"> ◀ 設計もレビュー作業（設計）も accepted で外れた（素の導出で 0・上の過渡を経た後の終端）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">（参考）未割当の合意済み作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">タスク（agreed・pending・assignee なし）<span style="color:#b45309"> ◀ 着手はこれから（可視ギャップ）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">作業者 —（未割当）/ レビュー担当 —</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 After（kiro-spec-tasks 起動後）— タスクが agentWorkQueue へ（玉＝AI）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>タスク</b>（着手中＝implementing）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 —（未指名）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
</table>

<small>※ **「玉」は MODEL の一級概念ではなく schedule-time のキュー（P4：agentWorkQueue／humanReviewQueue という actor フィルタ）の俗称**（MODEL v19 は「assignee を ball-holder へ再定義」案を却下済み）。玉（手番）は lifecycle から導出（`implementing`∧assignee=agent →エージェント作業キュー、`implemented` の葉→人間レビュー待ちキュー＝actor 非依存・`derivations/queues.ts`）。Mid① で設計が implemented になり人間レビュー待ちキューへ（玉＝太郎）。太郎がレビューを実施する間、設計レビュー作業（review-design）は assignee=太郎（人間）で implementing になるが、これは agentWorkQueue（assignee=agent 限定）には入らない人間の作業——設計成果物自体は太郎の承認判断を待って人間レビュー待ちキューに残る。**Mid② では設計とレビュー作業がともに `accepted` になり humanReviewQueue から外れる（素の導出で 0）**——この瞬間「玉」は導出キュー上に存在しない。次にタスクを始めるのは**開発者の通常ワークフロー手番**（agreed・未着手・未割当のタスク＝可視ギャップを着手させる）。開発者が `kiro-spec-tasks` を起動するとタスクが implementing・assignee Claude になり agentWorkQueue に入る（俗称「玉＝AI」）。一覧の画面描画はスライス未描画（現状は spec-value の状態バッジで読む）。</small>

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
      ▸ <b>設計</b>（レビュー待ち・レビュー担当＝太郎）<br>
      <span style="color:#475569">＝選んだレビュー担当（太郎）を per-node の `reviewer` 属性（Actor {kind,id}）と突き合わせて絞る（moira-surface-schedule Req14）。視点 actor/『自分』概念は要さず、絞り込みは提示層ゆえ MODEL 非保持。未指名ノードはどの選択にも一致せず『未指名』ギャップとして可視に残る。</span>
    </td>
  </tr>
</table>

### 4-4. schedule-time 画面 — 作業の詳細（クリックで開く・予定/実績の開始終了日）

設計の行をクリックすると詳細が開き、**予定開始日・予定終了日・実績開始日・実績終了日**と EVM（出来高 EV／計画値 PV／実コスト AC）・担当（作業者）・レビュー担当 が見える。要件: moira-surface-schedule Req15／moira-schedule Req13。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#0f766e;color:#fff"><td colspan="2" style="padding:6px 10px">🔍 詳細：設計（Mid① — 作成完了）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;width:210px">状態</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち（implemented）</span>／玉＝人間</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者） / レビュー担当</td><td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude（作成者）／ 👤 太郎（レビュー担当・次の手番）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">予定開始日（ベースライン）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-08（値は例示・要件 moira-schedule Req13 AC2＝予定終了−所要の導出）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">予定終了日（基準完了日 frozenSlot）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-14（値は例示）<span style="color:#16a34a"> ／ フィールドは実在：Inspector「基準完了日」</span></td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">実績開始日</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-08（値は例示・要件 moira-schedule Req13 AC1＝`→implementing` の時刻）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">実績終了日</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-14（値は例示・要件 moira-schedule Req13 AC1＝`→implemented` の時刻）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV（MD）</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">5</b>（完了∧合意済み＝凍結予算満額・二値）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">計画値 PV ／ 実コスト AC（MD）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">PV 5 ／ AC 5（いずれも例示・実装が定める）</td></tr>
</table>

<small>※ 詳細パネル自体は実在（schedule の Inspector）。<b>予定終了日</b>のフィールドも実在（Inspector「基準完了日」＝`frozenSlot`・MODEL §3②）。<b>予定開始日・実績開始日・実績終了日</b>は定義済み要件（moira-schedule Req13）で、参照スライスの Inspector は未描画。**日付の値はすべて例示**（「実在」はフィールドの存在を指し日付値ではない）。作成中（implementing）に開くと実績終了日は「未」（moira-schedule Req13 AC3 の honest empty）。</small>

### 4-5. decision インボックス（横断）— 検収待ちの間だけ「受入判断する」区画に映り、承認で消える

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🗂 decision インボックス（横断）— 判断種別の4区画（見積合意／担当割当／受入／警告）・断面で変わる</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;width:34%">見積に合意する</td><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#64748b">— 全断面なし（全葉合意済み） —</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">担当を割り当てる</td><td style="padding:6px 10px;border:1px solid #cbd5e1">未割当の合意済み葉（断面に応じて レビュー作業（設計）〔太郎の着手前〕・レビュー作業（タスク）等）が可視ギャップとして出る（割当で消滅）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:600">受入判断する</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>中間断面（設計＝レビュー待ち）: 「受入判断が必要: 設計（完了・検収待ち）」</b>（レビュー完了後はレビュー作業（設計）も並ぶ）。**承認（受入）で条件が消滅**し、After（設計・レビュー作業とも承認済み）では空</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">警告に対処する</td><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#64748b">— 全断面なし（差し戻しなしの初回承認） —</td></tr>
</table>

<small>※ 2026-07-04 裁定（姉妹ユニット requirements-spec-drafted の実画面裁定と同一構造）への同期: 検収待ち（人間レビュー待ち導出・actor 非依存）はインボックスの「受入判断する」区画に**同一導出の別 read** として映る。承認・タスク着手の**事象そのもの**は判断項目にならず、5コミット判断は不変（承認は品質確認・MODEL §2.1。DECISIONS-CATALOG D-69）。E2E は終端断面（承認後）の不出現を回帰固定済み。</small>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 担当（作業者） | レビュー担当 | 出来高 EV_abs 寄与 | 実コスト AC | 実行カバレッジ寄与 |
|---|---|---|---|---|---|---|---|
| └ 要件定義 | accepted | agreed（3人日） | Claude | 太郎 | ✅ 3（獲得済み・不変） | 既往 | ❌ |
| └ レビュー作業（要件定義） | accepted | agreed（1人日・例示） | 太郎 | — | ✅ 1（不変） | 既往 | ❌ |
| └ 設計 | accepted（承認済み） | agreed（5人日） | Claude | 太郎 | ✅ 5（完了で獲得済み・accepted でも不変） | 既往＋**承認レビュー工数があれば畳んで帰属（§7#18(b)(iv)）** | ❌（`implementing` でない） |
| └ レビュー作業（設計） | accepted（自明な一段で底打ち） | agreed（1人日・例示） | 太郎 | —（未指名・fold ゆえ専用 reviewer 不要） | ✅ 1（レビュー実施で獲得・以後不変・ノードは消えない） | レビュー実施分 | ❌ |
| └ タスク | implementing（着手中・作業中） | agreed（2人日） | Claude | —（未指名） | ❌ 0（着手中＝未完了・二値。完了で初めて EV 獲得＝別ユニット） | 着手後に増 | ✅（`implementing`＝1） |
| └ レビュー作業（タスク） | pending | agreed（0.5人日・例示） | — | — | ❌ 0 | 0 | ❌ |

出来高 EV%：**80%**（EV_abs 10〔要件定義3＋レビュー作業1＋設計5＋設計レビュー1〕 / 12.5。Mid②/After とも 80% で不変＝承認も着手も EV を足さない）<br>
実行カバレッジ：**17%**（`implementing` の合意済み有効葉 1〔タスク〕 / 6。Before は 17%〔設計〕・Mid①/Mid② の各断面は 0%・After で再び 17%〔タスク〕。**なお Mid①→Mid② の間、太郎が設計レビュー作業を実施している最中は review-design が `implementing` ゆえ実行カバレッジは一時的に 17%〔1/6〕へ戻る**——4断面はこの過渡を畳んでおり、各断面値は過渡の前後を示す。実行カバレッジは assignee 種別に依らず `implementing` 葉を数える〔人間作業も算入・moira-evm Req5〕）<br>
見積カバレッジ（P2）：**100%**（合意済み有効葉 6 / 6・全断面で不変）<br>
CPI：承認レビューに**工数を要したぶん**だけ AC が増え EV_abs(10) は不変 → わずかに悪化（即決で工数ゼロなら不変。WIP 悲観側振れは開示・Req 9.5）

<small>※ **達成率（EV%）と実行カバレッジは別の物差し。** EV% は「完了（implemented/accepted）した予算の割合」、実行カバレッジは「着手中（implementing）の葉の割合」。本ユニットでは EV% が 32%→72%（設計の作成完了）→80%（設計レビュー作業の完了）と**完了のたびに**動き、承認（accepted）でも着手（implementing）でも動かない。実行カバレッジは設計の着手中（Before 17%）→作成完了で 0%→タスク着手で再び 17% と、**着手のたびに**動く。要件定義のときと同じく「設計を書くのも進捗（EV は implemented で獲得）」と「承認は品質ゲート（EV を足さない）」の正直な両立。**レビュー担当（reviewer）は出来高・カバレッジ・平準化を一切動かさない**付帯属性（MODEL v19 §7#18(b)・moira-core Req6 AC6）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ① 設計の作成完了 `transition`（implementing→implemented・actor Claude）＋レビュー担当 太郎を指名する付帯記録、② 設計レビュー作業の実施 `transition`（ready→implementing→implemented・actor 太郎＝レビュー出来高 +1）、③（承認レビューに工数を要した場合のみ）承認レビュー工数 `cost`（被レビューノード＝設計に帰属・§7#18(b)(iv)）、④ 設計承認 `transition`（implemented→accepted・actor 太郎）、⑤ レビュー作業の承認 `transition`（implemented→accepted・fold で底打ち・actor 太郎）、⑥ タスク着手 `transition`（タスク pending→…→implementing・actor 太郎〔割当＋起動〕・assignee Claude・kiro-spec-tasks 起動 ⟿ 未実装 emit 機構）。①–⑥は論理操作の括りで、下記 JSON では 8 イベント（e110–e117）に対応——①が e110＋e111（設計の作成完了＋reviewer 太郎の指名）、②が e112＋e113（設計レビュー作業の着手→完了）、③が e114、④が e115、⑤が e116、⑥が e117。件数は実装が決める |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-design-completed.md`） | 設計の作成内容・根拠、太郎のレビュー所見と承認判断、タスクフェーズ着手の指示（Claude への割当）、達成率が「完了で動き承認では動かない」理由 |
| **spec-value 画面 / schedule-time 画面** | 設計が「作成中→レビュー待ち→承認済み」、レビュー作業（設計）が「着手可→実施→承認済みへ（自明な一段・ノード/EV は残る）」、玉がエージェント作業キュー→人間レビュー待ちキュー→（承認で空）→エージェント作業キュー（タスク）、EV% 32%→72%→80%（以後据え置き）・実行カバレッジ 17%→0%→〔一時 17%〕→0%→17%（§4 参照・中間の一時はレビュー作業実施 e112） |

```json
[
  {
    "id": "e110", "ts": 110,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/design",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "設計成果物（design.md）完成・仕様FIX判定（人間の承認待ち）"
  },
  {
    "id": "e111", "ts": 111,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/design",
    "machine": "lifecycle",
    "to": "implemented",
    "reviewer": { "kind": "human", "id": "dev:taro" },
    "reason": "設計のレビュー担当に spec オーナー（太郎）を確定（状態を保つ付帯記録。AI が提案し人間が確定）"
  },
  {
    "id": "e112", "ts": 112,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-design",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "human", "id": "dev:taro" },
    "reason": "太郎が設計レビュー作業に着手（ready→implementing）"
  },
  {
    "id": "e113", "ts": 113,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-design",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "太郎が設計レビュー作業を完了（implementing→implemented）＝レビュー出来高 EV 1 を獲得"
  },
  {
    "id": "e114", "ts": 114,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "cost",
    "node": "F/design",
    "amount": 0.5
  },
  {
    "id": "e115", "ts": 115,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/design",
    "machine": "lifecycle",
    "to": "accepted",
    "reason": "設計の成果物を承認（品質確認）。implemented→accepted（出来高は不変）"
  },
  {
    "id": "e116", "ts": 116,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-design",
    "machine": "lifecycle",
    "to": "accepted",
    "reason": "レビュー作業ノードの承認（fold で底打ち＝専用 reviewer 不要・無限後退の停止。ノード/EV=1 は不変）"
  },
  {
    "id": "e117", "ts": 117,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "agent", "id": "claude" },
    "reason": "開発者がタスク分解を Claude に割当（P0・§2.1#2）し kiro-spec-tasks を起動、Claude が着手（pending→implementing）"
  }
]
```

<small>注：ノード ID・ts 値・cost amount は例示で実装が決める。**e110** は設計の作成完了＝`implementing→implemented`（出来高 EV 5 はこの時点で獲得＝ev.ts `COMPLETED={implemented,accepted}`）。**e111** は「状態を保つ `transition`（to=現状態 implemented）に `reviewer` 属性を載せた付帯記録」で、設計のレビュー担当 太郎を指名する人間のコミット判断（MODEL §2.4/§2.8/R-T5・moira-core Req6 AC4。AI は spec オーナーを提案、人間が確定。指名 reviewer は実承認者と異なってよい＝§2.4）。**e112–e113** は設計レビュー作業（review-design）の実施——太郎が assignee で `ready→implementing→implemented` と進み、**完了（e113）でレビュー出来高 EV 1 を獲得**（review-design は A1 通常作業ノード＝MODEL §7#18(b)。EV% 72%→80% はこの e113 による）。**e114** は承認レビュー工数の `cost`（`CostEvent` の kind 固有フィールドは `kind`/`node`/`amount`（共通の id/ts/actor は EventBase 継承）＝`types.ts`）——**承認レビューに工数を要した場合のみ生じる**（即決なら e114 は出ず AC・CPI は不変。これは e112–e113 の計画済みレビュー作業とは別の、承認ゲートで追加的に要した工数の畳み帰属＝§7#18(b)(iv)）。**e115** は設計承認＝`implemented→accepted`（出来高は両状態とも COMPLETED で計上され不変）。**e116** はレビュー作業ノードの承認＝fold（lifecycle 畳み）で底打ち（§7#18(b)(vii)）——**fold は「イベントを出さない」意味ではなく**（本作も accepted の transition を1件出す）、「レビューのレビュー…の無限後退を止める／レビュー作業ノードを EV ごと消さない」意味。専用 reviewer は不要で、設計の reviewer 太郎が一段で発行。`accepted` も完了として出来高に算入＝EV=1 不変（コスト畳み＝EV なし とは別概念）。**e117** はタスク着手——actor は**開発者（太郎）**（タスク分解を Claude に割り当てる P0 コミット〔§2.1#2〕＋ kiro-spec-tasks 起動を行う主体は人間。assignee＝Claude が実作業者）。`pending→ready→implementing` のうち中間 `ready` は省略表記（実行カバレッジは `implementing` のみ算入ゆえ最終値は不変）。`kiro-spec-tasks` は**既存スキル**だが moira を直接知らず、その起動が moira のイベント（タスク transition）を emit する書き込み機構（`moira-progress` 仮称・⚠）は未実装——⟿ はこの「既存スキル起動 → 未実装 emit 機構 → moira 状態遷移」の継ぎ目を指す。レビュー・承認・着手はいずれも decision インボックスの対象外。event 型は `moira/backend/src/types.ts` の `TransitionEvent`／`CostEvent` に一致。</small>

## 6. 受け入れ条件（EARS）

<!-- 検証ループ後に確定した決定のみを §7 に記す。 -->

**（A）設計の作成完了で出来高が上がり玉が人間へ**

- **WHEN** 開発者が設計の作成を打鍵し Claude が成果物を作り終えたとき、**システムは** 設計の行を「作成中（implementing）→作成完了（レビュー待ち＝implemented）」へ進め**なければならない**。
- **WHEN** 設計が作成完了になったとき、**システムは** 出来高（進捗）を、その設計の合意済み見積分だけ上げ**なければならない**（作成完了で出来高が上がる）。
- **WHEN** 設計が作成完了になったとき、**システムは** 出来高を途中段階の部分的な割合では計上**してはならない**（出来高は作成完了で初めて満額算入する＝二値）。
- **WHILE** 設計を作成している（作成中の）間、**システムは** 担当（作業者）を画面に示し、当該作業をエージェント作業キュー（玉＝エージェント）に現さ**なければならない**。
- **WHEN** 設計が作成完了になったとき、**システムは** 当該作業をエージェント作業キューから外し人間レビュー待ちキューへ移し、いま動くべき側が人間（レビュー担当）であることを画面で分かるように示さ**なければならない**（玉がエージェント→人間へ移ったことが分かる）。
- **WHEN** 設計が作成完了になったとき、**システムは** それを人間のレビュー待ち一覧に 1 件として現さ**なければならない**。
- **WHEN** 設計がレビュー待ちになったとき、**システムは** その**レビュー担当（次に誰がレビューするか）を、担当（作業者）とは別に画面で示さ**なければならない（作業者が Claude でも、レビュー担当が太郎だと一目で分かる）。
- **WHEN** レビュー担当を決めるとき、**システムは** それを人間のコミット判断として扱い、自動で決め**てはならない**（AI は spec オーナーを推薦してよいが、最終は人間）。
- **WHEN** 設計が作成完了になったとき、**システムは** それを横断の decision インボックスの**コミット判断の区画（見積合意・担当割当）**に出**してはならない**（承認はコミット判断ではない）。
- **WHEN** 設計が作成完了になったとき、**システムは** それをインボックスの**「受入判断する」区画**に検収待ちとして現し、承認（受入）まで保た**なければならない**（この区画は人間レビュー待ちの映し＋受入操作の入口であり、人間のコミット判断の数を増やさない）。
- **WHEN** 設計が作成完了（implemented）に達したとき、**システムは** 設計レビュー作業を、その前提（設計の完了）が満たされたものとして「着手可（ready）」に進め**なければならない**（依存の仕組みは §7 を参照）。

**（B）レビュー実施は出来高を得るが、承認は出来高を足さない**

- **WHEN** 太郎が設計のレビュー作業を完了したとき、**システムは** レビュー作業（設計）の合意済み見積分だけ出来高を上げ**なければならない**（レビューも作業＝進捗）。
- **WHEN** 開発者が設計を承認したとき、**システムは** 設計を「レビュー待ち（implemented）」から「承認済み（accepted）」へ進め**なければならない**。
- **WHEN** 設計が承認されたとき、**システムは** 設計の出来高（EV）を増やしても減らしても**ならない**（出来高はレビュー待ち到達時に既に獲得・予算は完了時に施錠されている）。
- **WHEN** 設計が承認されたとき、**システムは** 達成率（EV%）を承認それ自体では変え**てはならない**（承認は完了→完了の移動であって新たな出来高を生まない）。
- **WHEN** 設計が承認されたとき、**システムは** レビュー作業（設計）の行の出来高を変え**てはならない**（出来高100%のまま・ノードは消えない）。
- **WHEN** 設計が承認されたとき、**システムは** レビュー作業（設計）の行も「完了（implemented）」から「承認済み（accepted）」へ進めてよく、その際レビュー作業の出来高を変え**てはならない**（承認段は自明な一段で、専用のレビュー担当を要さない。一段の fold を行わない場合でも、一次／二次レビューの提示上の区別は提示層が担うため〔§7〕、レビュー作業ノードがレビュー待ちの滞留として前面に残り続けることはない）。
- **IF** 承認のために追加のレビュー工数が費やされたなら、**WHEN** その工数が記録されたとき、**システムは** その工数を実コスト（AC）としてのみ計上し、出来高（EV）を動かし**てはならない**（出来高を伴わない実コスト増はコスト効率（CPI）を悪化させる。工数がゼロなら AC・CPI は動かない）。
- **WHEN** 設計が承認されたとき、**システムは** 設計を人間レビュー待ち一覧から外さ**なければならない**。

**（C）タスク着手は実行カバレッジを動かし、達成率は動かさない**

- **WHEN** 開発者がタスク分解の作業を指示し Claude が着手したとき、**システムは** タスクを「未着手（pending）」から「着手中（implementing）」へ進め、タスクの作業者をエージェント（Claude）として現さ**なければならない**（誰を作業者にするかの割り当ては開発者の判断）。
- **WHEN** タスクが着手中になったとき、**システムは** タスクの出来高（EV）を増やし**てはならない**（着手中は未完了＝出来高は完了時に獲得）。
- **WHEN** タスクが着手中になったとき、**システムは** 達成率（EV%）を変えず、代わりに「着手中の作業項目の割合（実行カバレッジ）」を増やさ**なければならない**（達成率は完了で動き、実行カバレッジは着手で動く別々の指標）。

**（共通）**

- **WHEN** 各作業が画面に表示されるとき、**システムは** その担当（作業者）と（レビュー待ちなら）レビュー担当を、spec-value と schedule の両方で一目で分かるように示さ**なければならない**。
- **WHEN** 開発者が作業の詳細を開いたとき、**システムは** 予定開始日・予定終了日・実績開始日・実績終了日と、出来高・計画値・実コストを示さ**なければならない**。
- **WHEN** 開発者が特定のレビュー担当のレビュー待ちだけを見たいとき、**システムは** レビュー担当を選んでその担当の項目だけに絞り込める手段を提供**しなければならない**（per-node の reviewer を選んで突き合わせる絞り込み）。
- **WHEN** 設計が承認（受入）されたとき、**システムは** インボックスの「受入判断する」区画から当該項目を消さ**なければならない**（項目は条件の消滅でのみ消える——承認・差し戻しがその行為）。
- **WHEN** 設計承認またはタスク着手が起きたとき、**システムは** その事象そのものを新たな判断項目としてインボックスに出**してはならない**（フェーズ進行は通常の手番。判断項目は「いま判断が要る」条件が真の間だけ存在する）。

## 7. 決定事項

<!-- 検証ループ後に確定した決定のみを記す。 -->

- **本ユニットは姉妹2本の転記合成（要件定義→設計に置換）であり、人間意図（§3）はユーザー批准済み（2026-06-29）。** `requirements-spec-drafted`（打鍵→作成完了・出来高 up・玉が人間へ）と `requirements-spec-accepted`（承認は出来高を足さない・レビュー作業の lifecycle 畳み・AC 増・次フェーズ着手）の確定済み振る舞いを、フェーズを「要件定義→設計」、次フェーズを「設計→タスク」に置換して1本のハッピーパスに合成した。§3 はユーザーが読み返して「このまま確定」と批准した不可侵の人間意図。転記で変わる中核は数値（EV/EV%・実行カバレッジ）とノード名（design/review-design/tasks）で、機構（lifecycle・EV 獲得規則・fold・キュー導出）は姉妹と同一（ただし §7#18(b)(viii) の提示文言のみ、姉妹の不正確な言い回しを本ユニットが canon 準拠へ精緻化——末尾の cross-unit nit 参照）。ただしハッピーパス1本への合成のため、姉妹2本のどちらにも単独では現れない描写を2点加えた——(a) 設計レビュー作業の実施フロー e112–e113（ユーザー批准済み §3 の And「レビュー作業を実施したぶん出来高が上がる」の event 接地・後述の専用決定参照）、(b) schedule 作業詳細パネル §4-4（moira-schedule Req13/15 へのトレース）。いずれも新機構ではなく既存機構の素直な適用で、ふるまい自体は §3 の語りの範囲内。
- **転記時に加えた3つの boundary（ユーザー確定済み・2026-06-29）。** ①**開始断面＝設計 implementing**（先行 `requirements-spec-accepted` の postcondition と接続。「設計の打鍵を 0 から」ではなく「着手中の設計が完成する」断面から描く）。②**ハッピーパス＝差し戻しなし**（太郎は一度で承認。差し戻し往復は別ユニット（`design-spec-returned` 等の名前で将来切り出す射程・現時点では未作成）で、本ユニットは背骨の最小通しゆえ含めない）。③**終了断面＝タスク着手まで**（`requirements-spec-accepted` が設計着手で終わるのと同型。タスク成果物の完成＝implemented は次ユニット `tasks-spec-completed` の射程）。いずれも AI が発案した boundary ではなく、姉妹同型の連結のためユーザーが確定した。
- **出来高 EV% は「完了」で動く——設計の作成完了（implemented）で 32%→72%、設計レビュー作業の完了で 72%→80%。承認・着手では動かない。** 出来高 EV_abs は**完了葉（`implemented` または `accepted`）かつ合意済み**の凍結予算を算入（`derivations/ev.ts` の `COMPLETED={implemented,accepted}`、moira-evm 1.1）。設計が `implemented` で EV_abs に 5人日（EV% = 9/12.5 = 72%）、設計レビュー作業（review-design）が `implemented` でさらに +1（EV% = 10/12.5 = 80%）。**承認（`implemented→accepted`）は完了→完了の移動ゆえ EV を足さない**（EV% 80% 据え置き）。部分EV は計上しない＝二値（MODEL v16 で却下）。EV% は現在状態の導出ゆえ差し戻し（別ユニット）で後退しうる（MODEL P5 非単調）。
- **承認の AC・CPI への影響は条件付き（無条件ではない）。** 承認レビューに**工数を要した場合のみ**、その工数を畳んで実コスト計上し被レビューノード（設計）に帰属させ（§7#18(b)(iv)・§5 e114）、出来高を伴わない AC 増として CPI をわずかに悪化させる。**即決（工数ほぼ0）の承認なら cost は立たず AC・CPI は不変**。この e114（承認ゲートで追加的に要した工数）は、e112–e113 の**計画済みレビュー作業（review-design・EV 1 を獲得）とは別物**——前者は承認段の追加工数の畳み帰属、後者は計画段階で見積・合意した通常作業ノードの実施。姉妹 `requirements-spec-accepted` §7 の条件付き是正（「承認で必ず CPI 悪化」の無条件断定を hedge へ）を継承する。
- **レビュー作業（設計）ノードの承認は「lifecycle 畳み」——ノードも EV=1 も消えない。** §7#18(b)(vii) の fold は「レビューのレビュー…の無限後退を底打ちする／専用のレビュー担当を要さない」意味であって、**「イベントを出さない」意味ではない**（本作も accepted の transition を1件出す＝e116）。`accepted` は完了状態として出来高に算入され EV=1 は不変。**「コスト畳み（レビュー工数を cost だけにし EV なし）」とは別概念**——この二義の取り違えが「畳むと 10→9 に減るのでは」という混同を生むため本文で明示区別した（姉妹 `requirements-spec-accepted` から継承）。本ユニットの 72%→80% は**レビュー作業の実施（e113）**による +1 であって、fold（e116）でも承認（e115）でもない。
- **レビュー作業（設計）ノードの実施で EV を獲得する（happy path 固有の接地）。** 姉妹 `requirements-spec-accepted` では要件定義レビューの EV=1 が前段（差し戻し系ユニット）で獲得済みだったため、同ユニット内ではレビュー実施を描かなかった。本ユニットは**差し戻しのないハッピーパスを1本に合成**するため、設計レビュー作業（review-design）の `ready→implementing→implemented`（EV 1 獲得）を**ユニット内で明示**する（e112–e113）。これは review-work-estimated が確立した「レビュー作業ノードは A1 通常作業ノードとして出来高を得る」（MODEL §7#18(b)）の素直な適用であり、新機構ではない。
- **レビュー作業ノードの承認者は指名 reviewer 不要。** レビュー作業（設計）の reviewer は未指名でよく、設計の reviewer（太郎）が一段で発行する。指名 reviewer と実承認者の不一致は §2.4 で許容。
- **担当（作業者）と レビュー担当（reviewer）は別の役割＝MODEL v19。** 担当（assignee）は「その作業を誰がやる/やったか」＝設計作業は **Claude（agent）**、設計レビュー作業は **太郎（human）**。**レビュー担当（reviewer）は「`implemented→accepted` を行うべく指名された人間」＝太郎**で、assignee とは**別の付帯属性**（単一・latest-wins・人間限定・**平準化/EV/PV/coverage を消費しない**）。両者を両画面に別表示する（要件: moira-surface-spec-value Req10/Req11・moira-surface-schedule Req3 AC4・moira-schedule Req14・moira-core Req6 AC4-6）。
- **レビュー担当の指名（e111）は §3／§6 批准済みの「レビュー担当で絞り込める」ふるまいを成立させる人間の指名（転記であって AI 由来でない）。** §6 は「特定のレビュー担当のレビュー待ちだけを見たい」絞り込みを要求する。よって設計が implemented になった直後（e110）、その人間レビューを担う太郎を reviewer に指名するコミット判断が伴う（e111）。これは to＝現状態（implemented を保つ）の**状態保存遷移**として記録される付帯属性の設定（MODEL §2.4・moira-core Req6 AC4-6・単一・latest-wins・人間限定）で、lifecycle を進めず EV/PV/coverage も動かさない。Mid① 断面は e110（設計完了）と e111（reviewer 指名）の双方を適用した後を描く（姉妹 `requirements-spec-drafted` の reviewer 指名と同型）。§6 が要求するのは絞り込みの**能力**であり、これは reviewer 未指名でも成立する（未指名ノードはどの選択にも一致せず『未指名』ギャップとして可視に残る＝§4-3）——ゆえに e111 は §6 から論理的に**含意される**ものではない。e111 は別個の人間のコミット判断（割当＝§2.1#2。AI が spec オーナーを提案し人間が確定する）であり、本シナリオで太郎が「自分のレビュー項目を絞り込む」§3 批准済みふるまいを成立させるために、その reviewer を太郎に確定する手番を忠実に転記したもの（姉妹 `requirements-spec-drafted` の e062 と同型）。AI が originate した新ふるまいではなく、§3 批准の射程内で人間が行う指名の転記である。
- **「玉」は MODEL の一級概念ではなく schedule-time キュー（P4）の俗称。** 玉（次の手番）は lifecycle から導出（`implementing`∧assignee=agent→エージェント作業キュー、`implemented` の葉→人間レビュー待ちキュー＝actor 非依存・`derivations/queues.ts`）。MODEL v19 は「assignee を ball-holder へ再定義」案を却下済み。Mid② 断面では両キューとも空＝導出上「玉」は存在せず、次にタスクを始めるのは**開発者の通常ワークフロー手番**（agreed・未着手・未割当のタスク＝可視ギャップを着手させる）。
- **設計着手中（太郎のレビュー作業中）のキュー所在。** 太郎が設計レビュー作業（review-design）を実施する間（implementing・assignee=太郎＝human）、それは agentWorkQueue（assignee=agent 限定）には入らない人間の作業である。設計成果物（design）自体は太郎の承認判断を待って人間レビュー待ちキュー（`implemented` 葉・actor 非依存）に残る。承認で design・review-design がともに accepted になり humanReviewQueue から外れる（素の導出で 0。なお一次／二次レビューの提示上の区別は提示層の責務＝§7#18(b)(viii)・MODEL 非保持。「畳んで隠してよい」という意味ではない）。〔cross-unit nit 開示〕姉妹 `requirements-spec-accepted` は同 clause を「提示層は畳んで隠してよい」と表現するが、これは canon に無い不正確な言い回しで（canon §7#18(b)(viii) は『一次/二次の提示上の区別は presentation の責務〔MODEL 非保持〕』のみを述べ「隠す」とは言わない）、本ユニットは canon 準拠の表現を採る。姉妹側の文言は別途同期すべき既知の cross-unit nit として開示のみ（姉妹の射程ゆえ本ユニットでは是正しない）。
- **姉妹が描いた「人間レビュー待ちキュー＝2件→1件への提示畳み」状態は、本ユニットの順序づけでは構造的に発生しない（脱落ではなく by-construction）。** 姉妹 `requirements-spec-accepted` は前段（差し戻し系ユニット）で要件定義レビューが既に `implemented` だったため、Before 断面で humanReviewQueue＝2件（要件定義＋要件定義レビューがともに implemented）→提示で1件、という状態を描いた。本ユニットは差し戻しのないハッピーパスで設計レビュー作業（review-design）の lifecycle を Mid② 内で live に `ready→implementing→implemented→accepted` と進めるため、design が humanReviewQueue にいる間 review-design はまだ implemented に達しておらず、**2件同時 implemented の状態が生じない**（design 単独の1件のみ）。よってこの「2件→畳み」ケースの不在は本ユニットの順序づけによる構造的帰結であって検証漏れではない（当該ケースは姉妹 `requirements-spec-accepted` が担保済み）。
- **タスク着手は「着手の瞬間〜作業中」の断面を描く（implementing）。skill 完遂で implemented に達するのは別ユニット。** `kiro-spec-tasks` は一回の起動で tasks.md を生成完遂する実在スキル（＝完了時は implemented 相当）。本ユニットは §3 のユーザー批准「タスクが着手中（implementing）になる」を尊重し、**Claude がタスク分解作業を進めている最中（着手の瞬間〜作業中）の断面**として接地する。「打鍵すると implementing で止まる」とは断定しない（作業完了で implemented へ進むのは続編ユニット `tasks-spec-completed` の対象）。
- **設計着手の前提は先行ユニットで成立済み（本ユニットは設計 implementing から始まる）。** 開発者が設計を Claude に割当（P0・§2.1#2）し kiro-spec-design を起動して設計が implementing になる遷移は、先行 `requirements-spec-accepted` の After（設計着手）で描かれ済み。本ユニットの precondition はその postcondition（設計 implementing）を継承する。
- **⟿ シームは「既存スキル起動 → 未実装 emit 機構 → moira 状態遷移」（kiro-spec-design・kiro-spec-tasks の両方）。** `kiro-spec-design`／`kiro-spec-tasks` はいずれも実在スキルだが moira を直接知らず（moira/event-store への参照ゼロ）、その起動が moira イベント（設計／タスク transition）を emit する書き込み機構（`moira-progress` 仮称・⚠未実装）は未実装。⟿ はこの継ぎ目を指し、kiro-spec-design／kiro-spec-tasks 自体が emit するわけではない。両スキルの実在は `.claude/skills/kiro-spec-design`・`.claude/skills/kiro-spec-tasks` で確認済み。なお本ユニット内で実際に行使される ⟿ は2面——(a) 設計の**完了** emit（implementing→implemented・e110。`kiro-spec-design` の**起動**自体は先行 `requirements-spec-accepted` の After で済み、本ユニットは完了の継ぎ目だけを行使）と (b) タスクの**着手** emit（pending→implementing・e117。`kiro-spec-tasks` の起動による着手の継ぎ目）。同一シームの「完了側」と「着手側」の2面で、起動と完了が別ユニットに分かれて現れる点が背骨合成の継ぎ目。
- **達成率（EV%）と実行カバレッジは別の物差し。** EV%＝「完了（implemented/accepted）した予算の割合」、実行カバレッジ（R-S8・moira-evm Req5）＝「着手中（implementing）の合意済み葉のカウント比」。本ユニットでは EV% が完了のたび（設計作成完了・設計レビュー完了）に動き、実行カバレッジは着手のたび（設計着手・設計レビュー着手・タスク着手）に動く。承認は両者を動かさない（完了→完了）。実行カバレッジの素の弧は **17%（設計 implementing）→0%（設計 implemented・レビュー作業は ready）→〔設計レビュー作業の実施中 e112 は一時的に 17%〕→0%（レビュー作業 implemented／その後 accepted）→17%（タスク implementing・e117）**。中間の一時的 17%（review-design implementing）は素の導出に現れる瞬間値であり、§4 は4断面（Before/Mid①/Mid②/After）を描いて review-design の implementing→implemented→accepted を Mid② に「自明な一段」として畳む（§7#18(b)(vii)）ため、§4 のパネルには独立断面として現れない——畳むのは**提示の断面選択**であって瞬間値が存在しないわけではない（正直化）。
- **見積カバレッジ(P2) は葉基底＝全葉合意で 100%（全断面で不変）。** 合意済み有効葉 6 / 既知の有効葉 6 = **100%**（フェーズ 3 葉＋計画段階合意済みのレビュー作業 3 葉）。中間ノード F は I1 ロールアップで分母外。出所＝MODEL §3 P2・参照実装 `derivations/coverage.ts` の `effectiveLeaves`（姉妹ユニットと v18 同期で 100%）。
- **フェーズ進行の事象は判断項目にならないが、検収待ちの条件は「受入判断する」区画に映る（2026-07-04 裁定への同期・§1/§4-5/§6 の改訂）。** 旧版は「設計のレビュー待ち・承認・タスク着手はインボックスに出ない」と描いていたが、issue #12 がインボックスを判断種別の4区画（見積合意・担当割当・受入・警告）へ再構成し、検収待ち（人間レビュー待ち導出）が「受入判断する」区画に映るようになった（姉妹ユニット requirements-spec-drafted の 2026-07-04 実画面裁定＝実装が正、と同一の構造。DECISIONS-CATALOG D-69）。「承認・着手の事象そのものは項目にならない」「5コミット判断は不変（承認は品質確認）」は従来どおり。**§3 の括弧書き「（横断の decision インボックスには出ない）」は人間発案の記述のため本改訂では触れていない**——裁定後の実態（受入区画に映る）と齟齬があるため、再批准時の人間改訂に委ねる（§1/§4-5/§6 は同期済み）。本改訂で status を `agreed`→`in-review` に降格（再批准待ち）。
- **参照実装は暫定スライス・各要素は定義済み要件への目標。** 担当（作業者）列・レビュー担当列・人間レビュー待ちキューの一覧描画・reviewer フィルタ・詳細の予定/実績日のうち、参照スライスが未描画のものは「(スライス未描画)」と中立に記した。いずれも MODEL/spec に**定義済みの要件**（frontmatter トレース）への目標受け入れ基準であり、現スライスの挙動には縛られない。
- **イベント件数は断定しない。** lifecycle は `pending→ready→implementing→implemented→accepted`（MODEL §2.5）。§5 は主要遷移を示す。`pending→ready` 等の件数は実装（`moira-progress` 仮称・未実装）が決めるため確定しない。
- **検証トレイル。** R1：doc-adversary×3（G1–G4＋SC1–SC7）＋doc-fact-checker → 著者パッチ。R2：doc-adversary×2（patched-region 攻撃＋算術/整合 攻撃）＋doc-fact-checker（**NO_OBJECTION・10/10 CONFIRMED**・SOURCE_SET OK）→ 著者パッチ（§4 過渡パネル可視化・§7#18(b)(viii) cross-unit nit 開示・e111「含意」過剰主張の是正・2件キュー by-construction 開示・他 Minor）→ doc-gate-judge **PASS**（生存 Critical/Important = 0・新規矛盾なし・SOURCE_SET_CONFIRMED・FORK〔transient 提示〕は Option A で裁定済み）。残存 Minor：§4-5 の reviewer 非干渉注は §7 と重複するが reading-aid として保持（非ブロッキング）。**要追跡（姉妹の射程）**：姉妹 `requirements-spec-accepted`（agreed）の §7#18(b)(viii) 文言「畳んで隠してよい」は canon に無い不正確表現——canon 準拠（「提示上の区別は presentation の責務・MODEL 非保持」）へ同期すべき cross-unit nit（本ユニットでは是正せず開示のみ）。
