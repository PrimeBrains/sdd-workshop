---
id: units/requirements-spec-accepted
title: 要件定義の成果物がついに承認される——承認は出来高（EV）を足さず（達成率は据え置き）、lifecycle が「承認済み」へ・AC が承認レビュー分だけ増え・玉がレビュー待ちから外れる。続いて設計に着手すると実行カバレッジが動く（達成率はまだ動かない）
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: ユニット requirements-spec-re-returned の後、Claude が二度目の差し戻しに対応し要件定義を再び「レビュー待ち（implemented）」にした状態。レビュー作業（要件定義）は implemented・EV=1。玉＝人間（太郎が承認すべき）
postcondition: 開発者（太郎）が要件定義を承認（implemented→accepted）。出来高（EV）は据え置きで EV% は 32% のまま。レビュー作業（要件定義）も accepted へ底打ち。承認レビューに工数を要したぶんだけ AC 計上（CPI がわずかに悪化。即決で工数ゼロなら AC・CPI は不変）。続いて開発者が kiro-spec-design を起動し Claude が設計作業を進めている間は設計が implementing（着手中・assignee Claude）、実行カバレッジ 0%→17%、EV% は 32% 据え置き（設計成果物が完成し implemented に達するのは別ユニット）
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
  - "moira-surface-schedule: 2.5, 8.1, 3.4, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3"
---

# 要件定義の成果物がついに承認される——承認は出来高（EV）を足さず（達成率は据え置き）、lifecycle が「承認済み」へ・AC が承認レビュー分だけ増え・玉がレビュー待ちから外れる。続いて設計に着手すると実行カバレッジが動く（達成率はまだ動かない）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。各画面要素は**定義済み要件**（frontmatter のトレース）への参照を併記します。スライス未実装は中立に「(スライス未描画)」と記し、設計の宿題（赤字）ではありません。

## 1. このユニットで確かめること

先行ユニット `requirements-spec-re-returned`（二度目の差し戻し）の後、Claude が指摘対応で要件定義を再作成し、再度「レビュー待ち」にした。ここで**開発者（太郎）が要件定義をついに承認する**と何が起きるか。中核は **「承認は達成率（EV%）を動かさない——出来高は『レビュー待ち（implemented）』に達した時点で既に獲得済みで、承認は品質確認のゲートだから」**こと：

- **承認（accepted）は出来高（EV）を足さない。** 要件定義の出来高は「レビュー待ち（implemented）」になった時点で既に獲得済み（EV 3・予算は完了時に施錠）。承認はその予算を動かさない。**EV% は 32% のまま据え置き**。
- 承認で動くのは：**lifecycle が「レビュー待ち」→「承認済み（accepted）」**、**（このシナリオでは承認レビューに工数を要したので）AC が増え CPI がわずかに悪化**（出来高を伴わない AC 増。※即決で工数ゼロの承認なら AC・CPI は動かない——CPI 悪化は承認の必然ではなく、工数が掛かったときの帰結）、**玉（レビュー待ちキュー）から外れる**。
- **レビュー作業（要件定義）の行は進捗率100%のまま動かない**（EV=1 不変）。承認時にレビュー作業ノードも「承認済み（accepted）」へ進むが、これは**自明な一段の lifecycle 遷移**であって**ノードも EV=1 も消えない**（`accepted` は `implemented` と同じ「完了」状態として出来高に算入される）。**前作 re-returned の「コスト畳み（レビュー工数を cost だけにし EV なし）」とは別物**——本作のレビュー作業ノードは EV=1 を保ったまま。したがって合計 EV は **要件定義 3 ＋ レビュー作業 1 = 4 のまま不変**（EV% 32% 不変）。
- 続いて**開発者が設計（デザイン）の作業を指示する（kiro-spec-design を起動）と、Claude が設計に着手**し、設計が「未着手（pending）」→「着手中（implementing）」へ、玉が Claude（AI）へ移る。**この「着手中」は Claude が設計作業を進めている最中の状態**であり、作業が完了すると設計は「作成完了（implemented・レビュー待ち）」へ達する（＝design.md 生成完了。それは別ユニットの対象で、本ユニットは着手の瞬間までを描く）。
- **設計が着手中になっても達成率（EV%）はまだ動かない**（着手中は未完了＝出来高は完了時に獲得）。代わりに**「着手済みの割合（実行カバレッジ）」が 0%→17% に動く**——EV% と実行カバレッジは別の物差しで、フェーズ着手で先に動くのは後者。

## 2. 前提（Given）

ユニット `requirements-spec-re-returned` の後、Claude が二度目の差し戻しに対応し要件定義を再作成して再び「レビュー待ち（implemented）」にした状態。玉＝人間（太郎が承認すべき）。

| ノード | 見積状態 | 見積値 | lifecycle | 担当（作業者） | レビュー担当 | 出来高(EV_abs)寄与 |
|---|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | — | 4（子の合計） |
| └ 要件定義 | agreed | 3人日 | implemented（レビュー待ち） | 🤖 Claude | 👤 太郎 | 3（完了∧合意済み） |
| └ レビュー作業（要件定義） | agreed | 1人日（例示） | implemented（レビュー完了・据え置き） | 👤 太郎 | — | 1 |
| └ 設計 | agreed | 5人日 | pending | —（これから） | — | 0 |
| └ レビュー作業（設計） | agreed | 1人日（例示） | pending | — | — | 0 |
| └ タスク | agreed | 2人日 | pending | — | — | 0 |
| └ レビュー作業（タスク） | agreed | 0.5人日（例示） | pending | — | — | 0 |

- 出来高 EV%（達成率）：**32%**（EV_abs 4〔要件定義 3＋レビュー作業 1〕 ÷ 合意済み有効葉の見積合計 12.5）
- 見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 6 / 既知の有効葉 6）
- 実行カバレッジ（R-S8・葉基底＝カウント比）：**0%**（`implementing` の合意済み有効葉 0 / 6。要件定義は implemented、他は pending）
- 人間レビュー待ちキュー：**2 件（導出）**（要件定義＝implemented と レビュー作業ノード＝implemented の両葉。actor 非依存導出＝MODEL §7#18(b)(viii)。提示層は二次レビューを畳んで 1 件に底打ちしてよい）
- 玉（次の手番）：人間（太郎が承認すべき）
- AC：Claude の作業（初回＋再作業×2）＋太郎の既往レビュー（実績値は例示省略）

## 3. ふるまい（When / Then）

```
When  Claude が二度目の差し戻しに対応し終え、要件定義を再び「レビュー待ち（implemented）」にして
      玉が人間に移った後、開発者（人間）が要件定義の成果物をレビューし、今度は承認する。
Then  要件定義は「レビュー待ち（implemented）」から「承認済み（accepted）」へ進む。
And   要件定義の出来高（EV）は増えも減りもしない
      ——出来高は「レビュー待ち」に達した時点で既に獲得済みで、承認は品質確認のゲートであって出来高を足さない。
And   達成率（EV%）は承認では変わらない（要件定義が implemented になった時点で既に伸びている）。
And   レビュー作業（要件定義）の行は進捗率100%のまま動かない（完了のまま。承認時に「承認済み」へ畳む）。
And   今回の承認レビューに費やした工数は実コスト（AC）として増える（出来高を伴わず畳んで計上）。
And   要件定義が承認されたことで人間レビュー待ちから外れる。
Then  続いて開発者が設計（デザイン）の作業を指示する（kiro-spec-design スキルを打鍵する）と、
      Claude が設計の作業に着手する。
And   設計の行が「未着手（pending）」から「着手中（implementing）」へ進み、玉が Claude（AI）へ移る。
And   設計の出来高（EV）はまだ増えない（着手中は未完了＝出来高は完了時に獲得）。
And   達成率（EV%）はまだ変わらず、代わりに「着手済みの割合（実行カバレッジ）」が増える。
```

<small>注：**(1) 要件承認** ＝要件定義ノードの `implemented→accepted`（actor＝人間。成果物の品質確認であって仕様を動かさない＝MODEL §2.5/§2.6）。承認レビューに**工数を要した場合のみ**、その工数を畳んで実コスト計上し被レビューノード（要件定義）に帰属する（MODEL §7#18(b)(iv)）——即決（工数ほぼ0）の承認なら cost は立たず AC・CPI は動かない。**(2) レビュー作業ノードの承認** `implemented→accepted` は §7#18(b)(vii) の **fold（自明な一段で底打ち）**——これは「レビューのレビュー…」の無限後退を止める意味で、**専用のレビュー担当を要さない**（レビュー作業ノードの reviewer は未指名でよい。実承認者＝要件定義の reviewer 太郎が一段で発行、指名 reviewer と実承認者の不一致は §2.4 で許容）。**fold は「イベントを出さない」意味ではなく**（前作のコスト畳みが cost イベントを出したのと同様、本作も accepted の transition を1件出す＝§5 e092）、「無限後退を底打ちする／レビュー作業ノードを EV ごと消さない」意味。`accepted` は完了状態として出来高に算入され EV=1 は不変。**(3) 設計着手** ＝`kiro-spec-design`（実在スキル）を開発者が起動し、Claude が設計作業を進める間ノードが `implementing`。kiro-spec-design は moira を直接知らず、moira のイベント（設計 transition）を emit する書き込み機構は未実装（`moira-progress` 仮称・⚠）——⟿ は「実在スキルの起動が（未実装の emit 機構を介して）moira 状態を動かす」継ぎ目を指す。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（状態・担当・出来高 EV%・実行カバレッジ・CPI）＋ schedule-time（玉＝キュー移動）**。3断面：**Before**（Claude の再作業完了・レビュー待ち）→ **Mid**（承認）→ **After**（設計着手）。承認では EV% が動かず lifecycle/AC/玉が動き、設計着手では実行カバレッジが動くが EV% はまだ動かない——この「達成率がいつ動き、いつ動かないか」を3断面で見せる。

### 4-1. spec-value 画面（状態・担当・出来高・実行カバレッジ・CPI）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Before — Claude が再作業完了・要件定義はレビュー待ち）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>32%</b>（4/12.5）・実行 <b>0%</b>・見積カバレッジ <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（レビュー待ち）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 3</b>（完了・満額・獲得済み）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日（例示）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#d1fae5;border-radius:4px;padding:1px 6px">完了</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 1</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計〜レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外。計4葉・合計 8.5人日）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#166534;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Mid — 開発者が要件定義を承認）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>32%</b>（<b style="color:#166534">据え置き＝承認は EV を足さない</b>）・実行 <b>0%</b><br><span style="color:#b45309;font-size:12px">⚑ AC 増（承認レビュー分）→ CPI わずかに悪化（出来高は不変）</span></td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span><br><span style="color:#166534;font-size:11px">◀ implemented→accepted（品質確認・出来高は不変）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 3</b>（不変・獲得済み）<br><span style="font-size:11px">AC：承認レビュー工数が畳んで加算（§7#18(b)(iv)）</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）（承認済みへ・自明な一段）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日（例示）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 1</b>（不変・進捗率100%のまま・ノードは消えない）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計〜レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ **「畳む」の二義に注意（重要）:** ここでレビュー作業ノードが `accepted` になるのは **lifecycle 畳み**（§7#18(b)(vii)＝レビューの承認段を自明な一段で底打ちし、レビューのレビューの…という無限後退を止める）であって、前作 re-returned の **コスト畳み**（二度目レビュー工数を**ノードにせず cost だけ**で記録＝EV なし）とは別物。**lifecycle 畳みではノードも EV=1 も消えない。** ゆえに承認の前後で合計 EV は **3（要件定義）＋1（レビュー作業）＝4 のまま**、EV% も **32% のまま**——「畳んだ瞬間に 4→3 へ減る」ことは起きない。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（After — 開発者が kiro-spec-design を打鍵・Claude が設計に着手）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>32%</b>（<b style="color:#b45309">まだ据え置き＝着手は EV を足さない</b>）・実行 <b style="color:#1d4ed8">17%</b>（0%→17%・1/6）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義（承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 3（不変）</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 設計</b>（着手中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">着手中</span> <span style="color:#64748b">(implementing)</span><br><span style="color:#1d4ed8;font-size:11px">◀ pending→implementing（kiro-spec-design 起動 ⟿ 未実装 emit 機構）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 0</b>（着手中＝未完了。出来高は完了時に獲得）<br><span style="font-size:11px;color:#1d4ed8">実行カバレッジに +1（着手済み）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）＝accepted ／ 他 pending</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（タスク・各レビュー作業は pending・対象外）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 1（レビュー作業・不変）</td>
  </tr>
</table>

<small>※ **承認 → 設計着手のあいだ、達成率（EV%）は 32% のまま一切動かない。** 出来高は完了（implemented/accepted）で獲得・予算は完了時に施錠されるため（ev.ts: COMPLETED = implemented ∨ accepted）、承認（accepted）も着手（implementing）も EV を足さない。動くのは (1) lifecycle、(2) AC（承認レビュー分）、(3) CPI（AC 増で悪化）、(4) 玉、(5) 実行カバレッジ（設計着手で 0%→17%）。「達成率がいつ動くか」＝**完了したときだけ**——設計が implemented になって初めて EV% が次に動く（本ユニットの対象外）。CPI = EV_abs/AC（MODEL §3・moira-evm Req 9.2）。WIP 中の CPI 悲観側振れは正規化せず開示（Req 9.5）。</small>

### 4-2. schedule-time 画面 — 玉の動き

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Before（レビュー待ち）— 玉＝人間（太郎が承認すべき）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1" rowspan="2">人間レビュー待ちキュー<br><span style="font-size:11px;color:#64748b">（導出 2 件・actor 非依存）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義（レビュー待ち＝implemented）<span style="color:#b45309"> ◀ 太郎が承認すべき</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 🤖 Claude / レビュー担当 👤 太郎</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（要件定義）＝implemented <span style="color:#64748b">（提示層は畳んで隠してよい・§7#18(b)(viii)）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 👤 太郎 / レビュー担当 —</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Mid（承認直後）— 両キュー空。設計は「合意済みだが未着手・未割当」の可視ギャップ</td></tr>
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
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）<span style="color:#166534"> ◀ 要件定義もレビュー作業も accepted で両方とも外れた（素の導出で 2→0）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">（参考）未割当の合意済み作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">設計（agreed・pending・assignee なし）<span style="color:#b45309"> ◀ 着手はこれから（可視ギャップ）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">作業者 —（未割当）/ レビュー担当 —</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 After（kiro-spec-design 起動後）— 設計が agentWorkQueue へ（玉＝AI）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー / 表示（導出）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>設計</b>（着手中＝implementing）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 —（未指名）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
</table>

<small>※ **「玉」は MODEL の一級概念ではなく、schedule-time のキュー（P4：agentWorkQueue／humanReviewQueue という actor フィルタ）の俗称**（MODEL v19 は「assignee を ball-holder へ再定義」案を却下済み）。承認で要件定義とレビュー作業がともに `accepted` になり humanReviewQueue から外れる（queues.ts: humanReviewQueue は `implemented` 葉のみ）。**Mid 断面では両キューとも空**——この瞬間「玉」は導出キュー上に存在しない。次に設計を始めるのは**開発者の通常のワークフロー手番**（agreed・未着手・未割当の設計＝可視ギャップを着手させる）であって、導出キューから現れる状態ではない。開発者が `kiro-spec-design` を起動すると設計が implementing・assignee Claude になり agentWorkQueue に入る（俗称「玉＝AI」）。設計のレビュー担当は現時点「未指名」（reviewer 未指名は可視ギャップ・§7#18(d)）。</small>

### 4-3. 作業の詳細＋素のデータ（After）

| ノード | lifecycle | 見積状態 | 担当（作業者） | レビュー担当 | 出来高 EV_abs 寄与 | 実コスト AC | 実行カバレッジ寄与 |
|---|---|---|---|---|---|---|---|
| └ 要件定義 | accepted（承認済み） | agreed（3人日） | Claude | 太郎 | ✅ 3（完了で獲得済み・accepted でも不変） | 既往＋**承認レビューに要した工数があれば畳んで帰属（§7#18(b)(iv)）** | ❌（`implementing` でない） |
| └ レビュー作業（要件定義） | accepted（自明な一段で底打ち） | agreed（1人日・例示） | 太郎 | —（未指名・fold ゆえ専用 reviewer 不要） | ✅ 1（不変・ノードは消えない） | 既往レビュー分のみ | ❌ |
| └ 設計 | implementing（着手中・作業中） | agreed（5人日） | Claude | —（未指名） | ❌ 0（着手中＝未完了・二値。完了で初めて EV 獲得＝別ユニット） | 着手後に増 | ✅（`implementing`＝1） |
| └ タスク | pending | agreed（2人日） | — | — | ❌ 0 | 0 | ❌ |
| └ レビュー作業（設計） | pending | agreed（1人日・例示） | — | — | ❌ 0 | 0 | ❌ |
| └ レビュー作業（タスク） | pending | agreed（0.5人日・例示） | — | — | ❌ 0 | 0 | ❌ |

出来高 EV%：**32%**（EV_abs 4〔要件定義 3＋レビュー作業 1〕 / 12.5。Before/Mid/After とも 32% で不変＝承認も着手も EV を足さない）<br>
実行カバレッジ：**17%**（`implementing` の合意済み有効葉 1〔設計〕 / 6。Before/Mid は 0%、After で 17%）<br>
見積カバレッジ（P2）：**100%**（合意済み有効葉 6 / 6）<br>
CPI：承認レビューに**工数を要したぶん**だけ AC が増え EV_abs(4) は不変 → わずかに悪化（即決で工数ゼロなら不変。WIP 悲観側振れは開示・Req 9.5）

<small>※ **達成率（EV%）と実行カバレッジは別の物差し。** EV% は「完了（implemented/accepted）した予算の割合」、実行カバレッジは「着手中（implementing）の葉の割合」。承認（accepted）は EV% にも実行カバレッジにも影響せず（完了→完了の移動・着手中ではない）、設計着手（implementing）は実行カバレッジだけを動かす（まだ未完了ゆえ EV% は不変）。要件定義が「レビュー待ち」になった時点で EV% は既に伸びていた——だから**承認の瞬間に進捗バーは伸びない**。これが「仕様を書くのも進捗」（EV は implemented で獲得）と「承認は品質ゲート」（EV を足さない）の正直な両立。</small>

### 4-4. decision インボックス（横断）— 承認・着手は出ない

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td style="padding:6px 10px">🗂 decision インボックス（横断）（After）</td></tr>
  <tr>
    <td style="padding:14px 10px;border:1px solid #cbd5e1;color:#64748b;text-align:center">— 要件承認・設計着手はここには出ない。承認は通常の品質ゲート遷移、着手は通常の作業開始であり、decision インボックスの集約対象外。 —</td>
  </tr>
</table>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ①（承認レビューに工数を要した場合のみ）レビュー工数 `cost`（被レビューノード＝要件定義に帰属・§7#18(b)(iv)）、② 要件承認 `transition`（要件定義 implemented→accepted・actor 太郎）、③ レビュー作業の承認 `transition`（implemented→accepted・fold で底打ち＝専用 reviewer 不要・actor 太郎）、④ 設計着手 `transition`（設計 pending→…→implementing・actor 太郎〔割当＋起動〕・assignee Claude・kiro-spec-design 起動 ⟿ 未実装 emit 機構） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-requirements-accepted.md`） | 太郎の承認判断・根拠、設計フェーズ着手の指示（Claude への割当）、達成率が動かない理由（既に implemented で獲得済み） |
| **spec-value 画面 / schedule-time 画面** | 要件定義が「レビュー待ち→承認済み」、レビュー作業が「承認済みへ（自明な一段・ノード/EV は残る）」、レビュー待ちキューが 2→0、設計が「未着手→着手中」で agentWorkQueue へ、EV% 32% 据え置き・実行カバレッジ 0%→17%（§4） |

```json
[
  {
    "id": "e090", "ts": 90,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "cost",
    "node": "F/req",
    "amount": 0.5
  },
  {
    "id": "e091", "ts": 91,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "accepted",
    "reason": "要件定義の成果物を承認（品質確認）。implemented→accepted（出来高は不変）"
  },
  {
    "id": "e092", "ts": 92,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-req",
    "machine": "lifecycle",
    "to": "accepted",
    "reason": "レビュー作業ノードの承認（fold で底打ち＝専用 reviewer 不要・無限後退の停止。ノード/EV=1 は不変）"
  },
  {
    "id": "e093", "ts": 93,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/design",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "agent", "id": "claude" },
    "reason": "開発者が設計を Claude に割当（P0・§2.1#2）し kiro-spec-design を起動、Claude が着手（pending→implementing）"
  }
]
```

<small>注：ノード ID・ts 値・cost amount は例示で実装が決める。**e090** は承認レビュー工数の `cost`（`CostEvent` は `kind`/`node`/`amount` のみ＝`types.ts`。畳み帰属の根拠はこの注と会話ログ）。**この e090 は承認レビューに工数を要した場合のみ生じる**——即決（工数ほぼ0）の承認なら e090 は出ず AC・CPI は動かない（§1・§6 と整合）。**e091** は要件承認＝`implemented→accepted`（出来高は両状態とも COMPLETED で計上され不変＝ev.ts）。**e092** はレビュー作業ノードの承認＝fold（lifecycle 畳み）で底打ち（§7#18(b)(vii)）——**fold は「イベントを出さない」意味ではなく**（本作も accepted の transition を1件出す）、「レビューのレビュー…の無限後退を止める／レビュー作業ノードを EV ごと消さない」意味。専用 reviewer は不要で、要件定義の reviewer 太郎が一段で発行（指名 reviewer と実承認者の不一致は §2.4 で許容）。`accepted` も完了として出来高に算入＝EV=1 不変（前作の「コスト畳み＝EV なし」とは別概念）。**e093** は設計着手——actor は**開発者（太郎）**（設計を Claude に割り当てる P0 コミット〔§2.1#2〕＋ kiro-spec-design 起動を行う主体は人間。assignee＝Claude が実作業者）。`pending→ready→implementing` のうち中間 `ready` は省略表記（実行カバレッジは `implementing` のみ算入ゆえ最終値は不変。ただし状態機械は三状態で、ready 段では agentWorkQueue に載るが実行カバレッジはまだ 0%＝MODEL §7#13(b) の忠実度論点）。`kiro-spec-design` は**既存スキル**だが moira を直接知らず、その起動が moira のイベント（設計 transition）を emit する書き込み機構（`moira-progress` 仮称・⚠）は未実装——⟿ はこの「既存スキル起動 → 未実装 emit 機構 → moira 状態遷移」の継ぎ目を指す。承認・着手はいずれも decision インボックスの対象外（フェーズ進行は SDLC 既定の手番であって横断 decision の集約対象でない）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が要件定義を承認したとき、**システムは** 要件定義を「レビュー待ち（implemented）」から「承認済み（accepted）」へ進め**なければならない**。
- **WHEN** 要件定義が承認されたとき、**システムは** 要件定義の出来高（EV）を増やしても減らしても**ならない**（出来高はレビュー待ち到達時に既に獲得・予算は完了時に施錠されている）。
- **WHEN** 要件定義が承認されたとき、**システムは** 達成率（EV%）を変え**てはならない**（承認は完了→完了の移動であって新たな出来高を生まない）。
- **WHEN** 要件定義が承認されたとき、**システムは** レビュー作業（要件定義）の行の出来高を変え**てはならない**（進捗率100%のまま・ノードは消えない）。
- **WHEN** 要件定義が承認されたとき、**システムは** レビュー作業（要件定義）の行も「完了（implemented）」から「承認済み（accepted）」へ進めてよく、その際レビュー作業の出来高を変え**てはならない**（承認段は自明な一段で、専用のレビュー担当を要さない）。
- **IF** 承認のために追加のレビュー工数が費やされたなら、**WHEN** その工数が記録されたとき、**システムは** その工数を実コスト（AC）としてのみ計上し、出来高（EV）を動かし**てはならない**（出来高を伴わない実コスト増はコスト効率（CPI）を悪化させる。工数がゼロなら AC・CPI は動かない）。
- **WHEN** 要件定義が承認されたとき、**システムは** 要件定義を人間レビュー待ち一覧から外さ**なければならない**。
- **WHEN** 開発者が設計の作業を指示し Claude が着手したとき、**システムは** 設計を「未着手（pending）」から「着手中（implementing）」へ進め、設計の作業者をエージェント（Claude）として現さ**なければならない**（誰を作業者にするかの割り当ては開発者の判断）。
- **WHEN** 設計が着手中になったとき、**システムは** 設計の出来高（EV）を増やし**てはならない**（着手中は未完了＝出来高は完了時に獲得）。
- **WHEN** 設計が着手中になったとき、**システムは** 達成率（EV%）を変えず、代わりに「着手中の作業項目の割合（実行カバレッジ）」を増やさ**なければならない**（達成率は完了で動き、実行カバレッジは着手で動く別々の指標）。
- **WHEN** 要件承認または設計着手が起きたとき、**システムは** それらを横断の決定一覧（インボックス）に出**してはならない**（フェーズ進行は通常の手番であって横断的な意思決定の集約対象ではない）。

## 7. 決定事項

- **承認（`implemented→accepted`）は出来高（EV）を足さない＝達成率（EV%）は据え置き。** EV_abs は完了状態（`implemented` ∨ `accepted`）で計上され、予算は完了到達時（implemented）に施錠される（ev.ts `COMPLETED={implemented,accepted}`・MODEL §2.5/§2.6）。要件定義の EV 3 は「レビュー待ち（implemented）」到達時に既に獲得済みで、承認はそれを動かさない。本ユニットの中核教示＝「承認の瞬間に進捗バーは伸びない（既に implemented で伸びていた）。承認は品質ゲート」。
- **承認の AC・CPI への影響は条件付き（無条件ではない）。** 承認レビューに**工数を要した場合のみ**、その工数を畳んで実コスト計上し被レビューノード（要件定義）に帰属させ（§7#18(b)(iv)）、出来高を伴わない AC 増として CPI をわずかに悪化させる。**即決（工数ほぼ0）の承認なら cost は立たず AC・CPI は不変**。当初ドラフトは「承認で必ず CPI 悪化」と無条件断定していたが、敵対ゲートで過剰主張（hedge 喪失）と判定し条件付きへ是正（§3 はユーザーが工数ありを posit したため不可侵のまま維持し、§1/§6/postcondition で一般則を hedge）。
- **レビュー作業ノードの承認は「lifecycle 畳み」——ノードも EV=1 も消えない。** §7#18(b)(vii) の fold は「レビューのレビュー…の無限後退を底打ちする／専用のレビュー担当を要さない」意味であって、**「イベントを出さない」意味ではない**（本作も accepted の transition を1件出す＝e092）。`accepted` は完了状態として出来高に算入され EV=1 は不変。**前作 re-returned の「コスト畳み（レビュー工数を cost だけにし EV なし）」とは別概念**——この二義の取り違えが「畳むと 4→3 に減るのでは」という混同を生むため、本文で明示区別した（ユーザー指摘由来）。
- **レビュー作業ノードの承認者は指名 reviewer 不要。** レビュー作業ノードの reviewer は未指名でよく、要件定義の reviewer（太郎）が一段で発行する。指名 reviewer と実承認者の不一致は §2.4 で許容。
- **人間レビュー待ちキューは actor 非依存導出。承認で req・review-req 両葉が accepted になり素の導出 2→0。** queues.ts は `implemented` 葉のみをキューに入れる。Mid 断面では両葉が accepted ゆえ素の導出で 0 件（提示層の畳みではなく導出そのものが 0）。先行 re-returned（review-req が implemented で残り素の導出 1）との違いは「承認で両葉が accepted に進む」点。
- **「玉」は MODEL の一級概念ではなく schedule-time キュー（P4）の俗称。** MODEL v19 は「assignee を ball-holder（現在の手番）へ再定義」案を却下済み。Mid 断面では両キューとも空＝導出上「玉」は存在せず、次に設計を始めるのは**開発者の通常ワークフロー手番**（agreed・未着手・未割当の設計＝可視ギャップを着手させる）。導出キューから現れる状態ではない。
- **設計着手は「着手の瞬間〜作業中」の断面を描く（implementing）。skill 完遂で implemented に達するのは別ユニット。** `kiro-spec-design` は一回の起動で Step1-6 を走り design.md を生成完遂する実在スキル（＝完了時は implemented 相当）。本ユニットは §3 のユーザー批准「設計が着手中（implementing）になる」を尊重し、**Claude が設計作業を進めている最中（着手の瞬間〜作業中）の断面**として接地する。「打鍵すると implementing で止まる」とは断定しない（作業完了で implemented へ進むのは続編ユニットの対象）。
- **設計着手 transition の actor は開発者（人間）、assignee は Claude。** 誰を作業者にするかの割り当ては開発者のコミット判断（P0・§2.1#2）。`kiro-spec-design` 起動も人間契機。実作業者（assignee）は Claude。当初ドラフトは actor=agent としていたが、割当主体の不在を敵対ゲートが指摘し是正。
- **⟿ シームは「既存スキル起動 → 未実装 emit 機構 → moira 状態遷移」。** `kiro-spec-design` は実在スキルだが moira を直接知らず（moira/event-store への参照ゼロ）、その起動が moira イベント（設計 transition）を emit する書き込み機構（`moira-progress` 仮称・⚠）は未実装。⟿ はこの継ぎ目を指し、kiro-spec-design 自体が emit するわけではない。
- **達成率（EV%）と実行カバレッジは別の物差し。** EV%＝「完了（implemented/accepted）した予算の割合」、実行カバレッジ（R-S8・moira-evm Req5）＝「着手中（implementing）の合意済み葉のカウント比」。承認は両者を動かさず（完了→完了）、設計着手は実行カバレッジのみを 0%→17% に動かす（未完了ゆえ EV% は不変）。トレースに導出要件 moira-evm Req5/6 を追加（提示要件 surface-spec-value 5.1/5.3 だけでなく導出側も明記）。
- **フェーズ進行は decision インボックスの対象外。** 要件承認・設計着手は SDLC 既定の手番（通常の品質ゲート遷移・作業開始）であって、横断的な意思決定の集約対象ではない。
