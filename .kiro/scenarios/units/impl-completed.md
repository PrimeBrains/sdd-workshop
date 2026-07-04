---
id: units/impl-completed
title: 実装が完成して承認され、フィーチャーが完了する——kiro-impl で実装が進み、作成完了（implemented）で出来高が上がり（達成率 44%→72%→93%）玉が人間（レビュー担当）へ。レビュー作業が出来高を得て本物の100%に到達し、人間が各実装を承認、子がすべて完了したのを見てフィーチャー（F）を承認＝背骨で唯一 feature が accepted に到達する終端
status: in-review
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: ユニット estimate-impl-agreed の後。実装（実装-1・実装-2）と実装レビューの見積が合意済み（agreed）。見積合意の後・実行指示の前に、実装ノードへ担当（作業者＝Claude）が、実装レビュー作業ノードへ担当（作業者＝太郎）が割り当てられ、各実装ノードのレビュー担当（reviewer＝太郎）も指名済み。フェーズ6葉（要件定義・設計・タスク＋各レビュー作業）はすべて accepted。実装・実装レビューは pending（未着手）。EV% 44%・実行カバレッジ 0%・F（フィーチャー）は pending
postcondition: 実装-1・実装-2 が implementing→implemented→accepted、実装レビューが implementing→implemented→accepted を経て、達成率（EV%）が 44%→72%→93%→100%（本物）に到達。子9葉がすべて accepted になったのを見て人間が F（フィーチャー）を accepted へ進める（背骨で唯一 feature が accepted に到達する終端）。実行カバレッジは着手で動き完了で 0% に戻る。承認・F 完了では達成率は動かない
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
  - moira-scope-deps
touches_requirements:
  - "moira-core: 3.1, 5.1, 5.3, 5.4, 5.6, 6.1, 6.2, 6.4, 6.6, 7.4, 11.1"
  - "moira-evm: 1.1, 1.2, 1.4, 5.1, 5.4, 6.2, 8.1, 9.2, 9.5"
  - "moira-surface-spec-value: 1.1, 1.5, 3.1, 5.1, 10.1, 11.1"
  - "moira-schedule: 4.1, 13.1, 13.2, 14.1, 14.2"
  - "moira-surface-schedule: 3.1, 3.4, 8.1, 13.1, 13.2, 14.1, 15.1"
  - "moira-scope-deps: 3.1, 4.1"
---

# 実装が完成して承認され、フィーチャーが完了する——kiro-impl で実装が進み、作成完了（implemented）で出来高が上がり（達成率 44%→72%→93%）玉が人間（レビュー担当）へ。レビュー作業が出来高を得て本物の100%に到達し、人間が各実装を承認、子がすべて完了したのを見てフィーチャー（F）を承認＝背骨で唯一 feature が accepted に到達する終端

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。各画面要素は**定義済み要件**（frontmatter のトレース）への参照を併記します。スライス未実装は中立に「(スライス未描画)」と記し、設計の宿題ではありません。

## 1. このユニットで確かめること

先行ユニット `estimate-impl-agreed` の後、実装・実装レビューの見積が合意済みで、（見積合意の後・実行指示の前に）実装ノード・実装レビュー作業ノードに担当が割り当てられている。ここから**実装が完成して承認され、最後にフィーチャー（F）そのものが完了するまで**を一続きで確かめる。これは背骨フローの終端であり、**背骨（discovery〜impl-completed の線形 happy-path フロー）で唯一 feature（F）が accepted に到達する**ユニット（差し戻し・やり直し・supersede 等の分岐ユニットは背骨の射程外＝§7）。中核は3つ：

**（A）kiro-impl で実装が進み、作成完了（implemented）で出来高が上がり、玉が人間へ**
- 開発者が実装フェーズの実行を指示する（`kiro-impl` を打鍵）と、AI が作業分解リスト（タスク分解の成果物）に沿って**実装-1・実装-2 を並行して**進める。
- 各実装が**作成完了（implemented＝レビュー待ち）**になると、その実装の分だけ**出来高（進捗）が上がる**（着手中は未完了ゆえ上がらず、作成完了の瞬間に満額＝二値）。達成率（EV%）は **44%→72%→93%** と、実装が一つ完了するたびに動く。
- 実装が作成完了になると**いま動くべき側＝人間（レビュー担当）に玉が渡った**ことが画面で分かる（作業がエージェント作業キューから人間レビュー待ちキューへ移動）。

**（B）レビュー作業が出来高を得て「本物の100%」に到達し、承認は出来高を足さない**
- **実装レビューは、実装-1・実装-2 の両方が完成して初めて着手できる**（実装全体で1件のレビュー作業ノードが両実装に依存）。
- 人間（太郎）が実装内容をレビューすると、**実装レビュー作業（review-impl）が出来高を得る**（レビューも作業＝進捗。EV% **93%→100%**＝本物の100%）。
- そのうえで人間が**各実装を承認（implemented→accepted）しても出来高（EV）は足されない**——**EV% は 100% のまま据え置き**。承認で動くのは：lifecycle が「レビュー待ち」→「承認済み」、玉（レビュー待ちキュー）から外れること（承認に追加工数を要したぶんは AC が増え CPI がわずかに悪化しうる・即決なら不変）。
- **実装レビュー作業の行も「承認済み（accepted）」へ畳まれる**（自明な一段の lifecycle 畳み・ノードも EV=2 も消えない）＝ユーザーの言う「レビューも完了状態になる」。

**（C）子がすべて完了したのを見て、人間がフィーチャー（F）を完了させる＝終端**
- 実装-1・実装-2・実装レビューが accepted になり、**F の子ノード（フェーズ6葉＋実装2葉＋実装レビュー1葉＝計9葉）がすべて完了（accepted）**になる。
- それを見て**人間が F（フィーチャー）を「完了（accepted）」へ進める**＝フィーチャーの最終サインオフ。**達成率は 100% のまま据え置き**（F の承認は新たな出来高を生まない）。
- **完了の判定そのものは「子9葉がすべて accepted（未完了葉も implemented 止まりの葉も残っていない）」**であって、達成率（EV%）の値ではない。達成率100%・実行カバレッジ0% は同時に成り立つ**随伴の可視信号**で、人間が「もう全部終わった」と確認する助けにはなるが、完了判定の定義ではない（達成率100%は「合意済み葉が全て完了」を意味するだけで、accepted と implemented を区別しない＝§7）。
- これは**人間の手番（最終サインオフ）であって、システムが自動で F を完了にするのではない**——参照実装は親の状態を子から自動導出しないため、F の完了は明示の人間イベントである（F は中間ノードゆえ固有の成果物を持たず、その「品質確認」は子（各実装）のレビューで既に尽きている＝§7 で正典に接地）。

あわせて（接続ギャップの正直化）：**実装ノードへの担当割当は前提**として済んでいるが、これは前段 `assign-spec-provisional` がフェーズノードにしか担当を付けていない**接続ギャップ**を、見積合意の後・実行指示の前に埋める前提ステップである（§7 で明示）。`kiro-validate-impl`（feature レベルの最終検証スキル）との具体的連携は**本ユニットの射程外**（別ユニット）。

## 2. 前提（Given）

ユニット `estimate-impl-agreed` の後。実装（実装-1・実装-2）と実装レビューの見積が**合意済み（agreed）**。**見積合意の後・実行指示の前に**、実装ノードへ担当（作業者＝Claude）が、実装レビュー作業ノードへ担当（作業者＝太郎）が割り当てられ、各実装ノードのレビュー担当（reviewer＝太郎）も指名済み（＝①接続ギャップを埋める前提ステップ・§7）。フェーズ6葉はすべて accepted。実装・実装レビューは pending（未着手）。玉＝開発者が `kiro-impl` を起動する手番。

| ノード | 見積状態 | 見積値 | lifecycle | 担当（作業者） | レビュー担当 | 出来高(EV_abs)寄与 |
|---|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | — | 12.5（中間ノード＝子 EV_abs のロールアップ合計・F 自身は EV_abs 葉でなく分子に算入しない） |
| └ （フェーズ6葉：要件定義・設計・タスク＋各レビュー作業） | agreed | 計 12.5人日 | accepted（完了） | — | — | 計 12.5 |
| └ 実装-1 | agreed | 8人日（例示） | pending | 🤖 Claude | 👤 太郎 | 0（未着手） |
| └ 実装-2 | agreed | 6人日（例示） | pending | 🤖 Claude | 👤 太郎 | 0（未着手） |
| └ 実装レビュー（実装全体で1件） | agreed | 2人日（例示） | pending | 👤 太郎 | —（未指名） | 0（未着手） |

- 出来高 EV%（達成率）：**44%**（EV_abs 12.5〔フェーズ6葉〕 ÷ 合意済み有効葉の見積合計 28.5〔12.5＋8＋6＋2〕）
- 見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 9 / 既知の有効葉 9）
- 実行カバレッジ（R-S8・葉基底＝カウント比）：**0%**（`implementing` の合意済み有効葉 0 / 9）
- 人間レビュー待ちキュー：**0 件**（`implemented` の葉なし。実装はまだ pending）
- 依存辺（前提・estimate-impl-agreed で張り済み）：設計→実装-1／設計→実装-2（policy=implemented・**充足済み**＝設計が implemented 到達済み〔accepted はその先〕ゆえ policy=implemented の閾値を満たす）、実装-1→実装レビュー／実装-2→実装レビュー（policy=implemented・**未充足**＝実装まだ未完了ゆえ実装レビューは pending）
- 実装ノードの状態：lifecycle 状態は **pending**（着手の progress イベントがまだ無い）。一方「先行充足述語（ready-eligible）」は真（設計 accepted＝依存充足）——`ready` の lifecycle 状態（progress が emit）と `ready-eligible` 述語（moira-scope-deps が依存から導出）は別物で（一次は moira-core の「ready 二語分離」・moira-scope-deps Req3・moira-surface-spec-value Req1 AC4）、本ユニットの Before 断面は着手前ゆえ lifecycle は pending（依存充足で lifecycle が自動 ready 化することはない＝参照実装 `fold.ts` は依存検知で状態を書き換えない）
- 玉（次の手番）：開発者が `kiro-impl` を起動する手番

<small>※ 実装ノード・実装レビュー作業ノードへの担当割当（作業者＝Claude／太郎）とレビュー担当（reviewer＝太郎）の指名は、`estimate-impl-agreed`（見積合意）の後・本ユニットの実行指示（kiro-impl）の前に行われる前提ステップである。前段 `assign-spec-provisional` はフェーズノード（要件定義・設計・タスク）にしか担当を付けておらず、実装ノードを扱っていない——この**接続ギャップ**を本ユニットの前提が（見積合意後・実行前に）埋める。割当イベントは §5 に「起点（前提を生む・本ユニットの対象は以降）」として示す（§7・①）。例示見積値（8/6/2）と凍結合計 28.5 は estimate-impl-agreed から継承。</small>

## 3. ふるまい（When / Then）

```
When  開発者が実装フェーズの実行を指示する（kiro-impl を打鍵する）
Then  AI が作業分解リスト（タスク分解の成果物）に沿って実装を進める
And   実装が完了すると、その状態が「実装済み（完了一歩手前）」に遷移する
And   ここで番（玉）が人間に渡る——人間がレビューする番になる
And   人間が内容をレビューし、問題がなければ承認する
And   承認した時点で、レビューも「完了」状態になる
And   ここまでで F（フィーチャー）の子ノードがすべて完了になったら、
      F（フィーチャー）も「完了」になる
```

<small>注：本文の平易語と内部表現の対応は §5／§7 に集約する。**「実装済み（完了一歩手前）」＝lifecycle の `implemented`**（作成完了・仕様FIX判定で、人間の承認 `implemented→accepted` 待ち＝MODEL §2.5）。**「番（玉）が人間に渡る」**＝作成完了で作業がエージェント作業キューから人間レビュー待ちキューへ移ること（玉は MODEL の一級概念でなくキュー P4 の俗称・§7）。実装は実装-1・実装-2 の**2件が並行**で進み、いずれも完了する（②）。**実装レビューは実装-1・実装-2 の両方の完了を前提とする**（依存辺2本・③）。**「レビューも完了状態になる」**＝実装レビュー作業ノード（review-impl）が `accepted` に達すること（出来高は review-impl の作成完了 `implemented` で既に獲得済み・承認は自明な一段の畳み）。**「F も完了になる」**＝子9葉が全て accepted になったのを見て人間が F を `accepted` へ進める最終サインオフ（fold.ts は親 lifecycle を子から自動導出しないため明示イベント・§7）。`kiro-impl` は実在スキルだが moira を直接知らず、その起動が moira イベントを emit する書き込み機構（`moira-progress` 仮称・⚠未実装）は未実装＝継ぎ目 ⟿。（`kiro-validate-impl` 連携が射程外であることは §1／§7④ に集約。）</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（状態・担当・レビュー担当・出来高 EV%・実行カバレッジ）＋ schedule-time（玉＝キュー移動）**。ガントに「進捗バー％」は出さない（出来高 EV% は spec-value/health が host）。4断面：**Before**（実装は未着手・割当済み）→ **During**（kiro-impl で実装-1・実装-2 を並行実装中＝玉が AI・実行カバレッジが動く）→ **Mid**（両実装が作成完了＝出来高が上がり玉が人間へ・実装レビューが着手可）→ **After**（人間がレビューして本物の100%に到達・各実装を承認・実装レビューも畳まれ・子全完了で F を完了＝終端）。

### 4-1. spec-value 画面（状態・担当・レビュー担当・出来高・実行カバレッジ）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Before — 実装は未着手・割当済み）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>44%</b>（12.5/28.5）・実行 <b>0%</b>・見積カバレッジ(P2) <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ （フェーズ6葉・承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（accepted・不変。EV寄与 計 12.5）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 12.5（不変）</td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-1</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 8人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0（未着手）</td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-2</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 6人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0（未着手）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装レビュー（実装全体で1件）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span> <span style="color:#94a3b8;font-size:11px">（依存元 実装-1/実装-2 未 implemented）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未指名）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0（未着手）</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（During — kiro-impl で実装-1・実装-2 を並行実装中・玉＝AI）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>44%</b>（<b style="color:#b45309">まだ据え置き＝着手は EV を足さない</b>）・実行 <b style="color:#1d4ed8">22%</b>（0%→22%・2/9）</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-1</b>（着手中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 8人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">着手中</span> <span style="color:#64748b">(implementing)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 0</b>（着手中＝未完了）<br><span style="font-size:11px;color:#1d4ed8">実行カバレッジに +1</span></td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-2</b>（着手中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 6人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">着手中</span> <span style="color:#64748b">(implementing)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝AI（並行）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 0</b>（着手中＝未完了）<br><span style="font-size:11px;color:#1d4ed8">実行カバレッジに +1</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装レビュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・依存元 実装-1/実装-2 未 implemented）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ kiro-impl の起動で実装-1・実装-2 が `pending→（ready→）implementing` へ。**達成率（EV%）は 44% のまま動かない**（着手中は未完了＝出来高は完了で獲得）。代わりに**実行カバレッジが 0%→22%**（`implementing` の合意済み葉 2／9）。中間 `ready` は省略表記（実行カバレッジは `implementing` のみ算入）。**②並行（瞬間値の注意）：22% は実装-1・実装-2 が同時に着手中である瞬間の値**——順次（実装-1 完了後に実装-2 着手）なら同時 implementing は生じず弧は 11%（1/9）×2 になる。**完了順による違いは中間値だけで、最終の達成率 100% は順序非依存**（実装-1 先行なら中間 EV% は 44%→72%、実装-2 先行なら 44%→約69% だが、両実装完了で必ず 93% に収束）。本パネルは実装-1 先行・並行着手の例を描く。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Mid — 両実装が作成完了・レビュー待ち＝出来高が上がり玉が人間へ）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#16a34a">93%</b>（44%→72%→93%・26.5/28.5）・実行 <b>0%</b><br><span style="color:#b45309">⚑ 実装-1・実装-2 はレビュー待ち（玉＝人間）</span></td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-1</b>（レビュー待ち）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 8人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#94a3b8;font-size:11px">作成者</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span><br><span style="color:#b45309;font-size:11px">◀ 次の手番</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 8</b>（＝予算満額・二値）</td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 実装-2</b>（レビュー待ち）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 6人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#94a3b8;font-size:11px">作成者</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span><br><span style="color:#b45309;font-size:11px">◀ 次の手番</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 6</b>（＝予算満額・二値）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装レビュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e0e7ff;border-radius:4px;padding:1px 6px">着手可</span> <span style="color:#64748b">(ready)</span> <span style="color:#94a3b8;font-size:11px">（依存元 実装-1・実装-2 がともに implemented＝充足）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未指名）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ <b>実装「単体」の出来高は各々の凍結予算の満額</b>（実装-1＝8・実装-2＝6・割合なら 100%・二値）；出力＝作成完了（implemented）の瞬間に満額計上され途中点は無い（部分EV は MODEL v16 で却下）。<b>フィーチャー全体の出来高 EV% は 44%→72%（実装-1 完了で +8）→93%（実装-2 完了で +6）</b>（葉基底）。**両実装が `implemented` に達したため、依存辺（policy=implemented・2本）により実装レビューが ready** になる（③＝両実装の完了が前提）。実装-1・実装-2 はともに `implemented` の葉ゆえ人間レビュー待ちキューに入る（玉＝人間）。実行カバレッジは 22%→0%（`implementing` の葉が無くなる）。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#166534;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（After — 人間がレビューして本物の100%・各実装を承認・実装レビューも畳み・子全完了で F を完了＝終端）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 / 被覆</td>
  </tr>
  <tr style="background:#dcfce7">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span><br><span style="color:#166534;font-size:11px">◀ 子9葉が全完了→人間が F を完了（終端）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#166534">100%</b>（本物・93%→100% は<b>実装レビューの完了</b>で +2、<b>承認・F 完了では足さない</b>）・実行 <b>0%</b></td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装-1 ／ 実装-2（承認済み）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 8／6人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span><br><span style="color:#166534;font-size:11px">◀ implemented→accepted（品質確認・出来高は不変）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 8／6</b>（完了で獲得済み・accepted でも不変）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 実装レビュー（レビュー実施→承認済みへ・自明な一段）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span> <span style="color:#64748b">(accepted)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（未指名・fold ゆえ専用 reviewer 不要）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 2</b>（レビュー実施で獲得→以後不変・ノードは消えない）</td>
  </tr>
</table>

<small>※ **達成率は「完了」で動く——実装レビュー作業（review-impl）の実施＝完了（implemented）で 93%→100%（本物の100%）。承認（各実装の implemented→accepted）も F の完了も EV を足さない**（出来高は実装が implemented／レビューが implemented に達した時点で既に獲得済み。`derivations/ev.ts` の `COMPLETED={implemented,accepted}`）。**「レビューも完了状態になる」**＝実装レビュー作業ノードが `accepted` に畳まれること（§7#18(b)(vii) の **lifecycle 畳み**＝専用 reviewer 不要で太郎が一段発行・**ノードも EV=2 も消えない**。コスト畳み〔EV なし〕とは別概念）。**「F も完了になる」**＝子9葉が全 accepted になったのを見て人間が F を `accepted` へ進める（fold.ts は親 lifecycle を子から自動導出しないため明示の人間イベント・§7）。なお太郎が実装レビュー作業を実施する間（review-impl `implementing`）は実行カバレッジが一時的に 11%（1/9）へ戻り、完了で再び 0% になる——§4 はこの過渡を After に「自明な一段」として畳む（瞬間値は §5/§7 の弧で開示）。承認に追加工数を要したぶんは AC が増え CPI がわずかに悪化しうる（即決なら不変）。</small>

### 4-2. schedule-time 画面 — 玉の受け渡し（キュー間の移動）

「玉が AI→人間→（完了）と動いた」ことは、作業が**2つのキューの間を移動**することで分かる（玉という一級の状態を新設せず lifecycle から導出＝§7）。要件: moira-surface-schedule Req13（一覧描画）・Req8（actor フィルタ）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 During（実装-1・実装-2 実装中・implementing）— 玉＝AI</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">実装-1（実装中）・実装-2（実装中）<span style="color:#b45309"> ◀ 玉＝AI（並行）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 <span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Mid（両実装が作成完了・implemented）— 玉＝人間（太郎がレビュー・承認すべき）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）← 実装-1・実装-2 はここから抜けた</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>人間レビュー待ちキュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>実装-1・実装-2</b>（レビュー待ち＝作成完了・承認前）<span style="color:#b45309"> ◀ 玉＝人間</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 <span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 After（太郎がレビュー実施→各実装を承認→子全完了で F 承認）— 終端では全キュー空</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー / 表示（導出）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr style="background:#fffbeb">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">（過渡）レビュー実施中<br><span style="font-size:11px;color:#b45309">Mid→After の間</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">実装レビュー＝<b>implementing</b>（太郎の人間作業）<span style="color:#b45309"> ◀ どちらのキューにも入らない</span>／実装-1・実装-2 は人間レビュー待ちキューに残存（承認前）。実行カバレッジは一時 11%（1/9）＝<b>review-impl の implementing 由来</b>（実装-1・実装-2 は implemented で分子外）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span> / レビュー担当 —</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（承認後は空）<span style="color:#166534"> ◀ 実装-1・実装-2・実装レビューが accepted で外れた（素の導出で 0）</span></td>
  </tr>
  <tr style="background:#dcfce7">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">（終端）フィーチャー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1"><b>F が accepted</b>（子9葉が全完了→人間が最終サインオフ）<span style="color:#166534"> ◀ 背骨で唯一 feature が accepted に到達</span></td>
  </tr>
</table>

<small>※ **「玉」は MODEL の一級概念ではなく schedule-time のキュー（P4：agentWorkQueue／humanReviewQueue という actor フィルタ）の俗称**（MODEL v19 は「assignee を ball-holder へ再定義」案を却下済み）。玉（手番）は lifecycle から導出（`{ready, implementing}`∧assignee=agent →エージェント作業キュー〔参照実装 `derivations/queues.ts`・moira-schedule Req4／moira-surface-schedule Req13〕、`implemented` の葉→人間レビュー待ちキュー＝actor 非依存）。本ユニットの During 断面では実装が `implementing` ゆえ表示は変わらないが、述語は `ready` も含む。Mid で実装-1・実装-2 が implemented になり人間レビュー待ちキューへ（玉＝太郎）。太郎がレビューを実施する間、実装レビュー（review-impl）は assignee=太郎（人間）で implementing になるが、これは agentWorkQueue（assignee=agent 限定）には入らない人間の作業——実装成果物自体は太郎の承認判断を待って人間レビュー待ちキューに残る。承認で実装-1・実装-2・実装レビューがともに accepted になり humanReviewQueue から外れる（素の導出で 0）。**最後に人間が F を accepted へ進める**（子9葉全完了を見ての最終サインオフ）——これで背骨フローが終端に至る。一覧の画面描画はスライス未描画（現状は spec-value の状態バッジで読む）。</small>

### 4-3. decision インボックス（横断）— 検収待ちの間だけ「受入判断する」区画に映り、承認と F 完了で空になる

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🗂 decision インボックス（横断）— 判断種別の4区画（見積合意／担当割当／受入／警告）・断面で変わる</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;width:34%">見積に合意する</td><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#64748b">— 全断面なし（全9葉合意済み） —</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">担当を割り当てる</td><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#64748b">— 全断面なし（全合意葉が割当済み） —</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:600">受入判断する</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>Mid 断面（実装-1・実装-2＝レビュー待ち）: 「受入判断が必要: 実装-1／実装-2（完了・検収待ち）」</b>（実装レビュー作業の完了後はそれも並ぶ）。**承認（受入）で条件が消滅**し、After（全葉 accepted・F 完了）では空</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">警告に対処する</td><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#64748b">— 全断面なし（差し戻しなしの happy path） —</td></tr>
</table>

<small>※ 2026-07-04 裁定（姉妹ユニット requirements-spec-drafted の実画面裁定と同一構造）への同期: 検収待ち（人間レビュー待ち導出・actor 非依存）は「受入判断する」区画に**同一導出の別 read**として映り、承認で消える。実装の完了・レビュー実施・承認・F 完了サインオフの**事象そのもの**は判断項目にならず、5コミット判断は不変（承認・サインオフは品質確認。DECISIONS-CATALOG D-69）。After は全区画が空＝「すべて判断済み」の終端信号。E2E は終端断面の不出現を回帰固定済み。</small>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 担当（作業者） | レビュー担当 | 出来高 EV_abs 寄与 | 実行カバレッジ寄与 |
|---|---|---|---|---|---|---|
| └ （フェーズ6葉） | accepted | agreed（計 12.5） | — | — | ✅ 12.5（獲得済み・不変） | ❌ |
| └ 実装-1 | accepted（承認済み） | agreed（8人日） | Claude | 太郎 | ✅ 8（implemented で獲得済み・accepted でも不変） | ❌（`implementing` でない） |
| └ 実装-2 | accepted（承認済み） | agreed（6人日） | Claude | 太郎 | ✅ 6（implemented で獲得済み・accepted でも不変） | ❌ |
| └ 実装レビュー | accepted（自明な一段で底打ち） | agreed（2人日） | 太郎 | —（未指名・fold） | ✅ 2（レビュー実施で獲得・以後不変・ノードは消えない） | ❌ |
| F（フィーチャー） | accepted（人間の最終サインオフ） | —（中間ノード） | — | — | —（中間ノードは EV_abs 葉でない） | ❌ |

出来高 EV%：**100%**（EV_abs 28.5〔フェーズ12.5＋実装 8＋6＋実装レビュー 2〕 / 28.5。本物の100%＝実装本体を完遂しての到達）<br>
実行カバレッジ：**0%**（`implementing` の合意済み有効葉 0 / 9。素の弧＝0%〔Before〕→22%〔実装-1・実装-2 implementing〕→0%〔両 implemented〕→一時 11%〔review-impl implementing〕→0%〔終端〕。実行カバレッジは assignee 種別に依らず `implementing` 葉を数える＝人間作業も算入・moira-evm Req5）<br>
見積カバレッジ（P2）：**100%**（合意済み有効葉 9 / 9・全断面で不変）

<small>※ **達成率（EV%）と実行カバレッジは別の物差し。** EV% は「完了（implemented/accepted）した予算の割合」、実行カバレッジは「着手中（implementing）の葉の割合」。本ユニットでは EV% が **44%→72%（実装-1 完了）→93%（実装-2 完了）→100%（実装レビュー完了＝本物）** と完了のたびに動き、承認（accepted）でも F 完了でも動かない。実行カバレッジは着手のたびに動く。**レビュー担当（reviewer）は出来高・カバレッジ・平準化を一切動かさない**付帯属性（MODEL v19 §7#18(b)・moira-core Req6 AC6）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ＜起点・前提を生む＞実装・実装レビューへの担当割当＋実装のレビュー担当指名（状態を保つ付帯記録・本ユニットの対象は以降）／＜本ユニット＞① 実装-1・実装-2 の着手 `transition`（→implementing・actor Claude）、② 実装-1・実装-2 の作成完了 `transition`（→implemented・actor Claude＝各々 EV 8／6 を獲得）、③ 実装レビュー作業の実施 `transition`（ready→implementing→implemented・actor 太郎＝レビュー出来高 +2＝本物の100%）、④ 各実装の承認 `transition`（implemented→accepted・actor 太郎）、⑤ 実装レビューの承認 `transition`（implemented→accepted・fold で底打ち・actor 太郎）、⑥ F の完了 `transition`（→accepted・actor 太郎＝子全完了を見ての最終サインオフ）。件数は実装が決める |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-impl-completed.md`） | 実装の作成内容・根拠、太郎のレビュー所見と承認判断、子全完了を確認して F を完了させた判断、達成率が「完了で動き承認・F 完了では動かない」理由 |
| **spec-value 画面 / schedule-time 画面** | 実装が「未着手→実装中→レビュー待ち→承認済み」、実装レビューが「着手可→実施→承認済みへ（自明な一段・ノード/EV は残る）」、玉がエージェント作業キュー→人間レビュー待ちキュー→（承認で空）、F が accepted、EV% 44%→72%→93%→100%（以後据え置き）・実行カバレッジ 0%→22%→0%→〔一時 11%〕→0% |

### ＜起点・前提を生む＞イベント：実装・実装レビューへの担当割当とレビュー担当指名（見積合意後・実行指示前）

```json
[
  { "id": "e060", "ts": 60, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/impl-1", "machine": "lifecycle", "to": "pending",
    "assignee": { "kind": "agent", "id": "claude" }, "reviewer": { "kind": "human", "id": "dev:taro" },
    "reason": "見積合意後・実行指示前に、実装-1 の作業者を Claude に・レビュー担当を太郎に割当（状態を保つ付帯記録＝§2.4/§2.8）" },
  { "id": "e061", "ts": 61, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/impl-2", "machine": "lifecycle", "to": "pending",
    "assignee": { "kind": "agent", "id": "claude" }, "reviewer": { "kind": "human", "id": "dev:taro" },
    "reason": "実装-2 の作業者を Claude に・レビュー担当を太郎に割当（状態を保つ付帯記録）" },
  { "id": "e062", "ts": 62, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/review-impl", "machine": "lifecycle", "to": "pending",
    "assignee": { "kind": "human", "id": "dev:taro" },
    "reason": "実装レビュー作業の作業者を太郎に割当（状態を保つ付帯記録）" }
]
```

<small>注：**e060–e062 は本ユニットの前提を生む起点イベント**（estimate-impl-agreed の postcondition＝未割当 から、本ユニットの precondition＝割当済み への橋渡し）。ユーザー裁定（§7・①）に従い、見積合意の後・実行指示（kiro-impl）の前に行う。`to=pending`（現状態）を保つ**状態を保つ `transition`**で assignee／reviewer 付帯属性のみを設定する（MODEL §2.4/§2.8/R-T5・状態機械に辺を足さない）。実装ノードの作業者は Claude（agent）、実装レビュー作業ノードの作業者は太郎（human）、各実装のレビュー担当（reviewer）は太郎。これにより実装・実装レビューは未割当バックログから外れる。本ユニットが扱うのは e063 以降。</small>

### 本ユニットのイベント：実装の着手・完了／レビュー実施・承認／F 完了

```json
[
  { "id": "e063", "ts": 63, "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition", "node": "F/impl-1", "machine": "lifecycle", "to": "implementing",
    "reason": "kiro-impl 起動。Claude が実装-1 に着手（pending→（ready→）implementing）⟿ 未実装 emit 機構" },
  { "id": "e064", "ts": 64, "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition", "node": "F/impl-2", "machine": "lifecycle", "to": "implementing",
    "reason": "Claude が実装-2 に並行着手（pending→（ready→）implementing）" },
  { "id": "e065", "ts": 65, "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition", "node": "F/impl-1", "machine": "lifecycle", "to": "implemented",
    "reason": "実装-1 の成果物完成・仕様FIX判定（人間の承認待ち）＝EV 8 を獲得（EV% 44%→72%）" },
  { "id": "e066", "ts": 66, "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition", "node": "F/impl-2", "machine": "lifecycle", "to": "implemented",
    "reason": "実装-2 の成果物完成・仕様FIX判定（人間の承認待ち）＝EV 6 を獲得（EV% 72%→93%）。両実装 implemented で実装レビューが ready" },
  { "id": "e067", "ts": 67, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/review-impl", "machine": "lifecycle", "to": "implementing",
    "assignee": { "kind": "human", "id": "dev:taro" },
    "reason": "太郎が実装レビュー作業に着手（ready→implementing）＝両実装の内容をレビュー" },
  { "id": "e068", "ts": 68, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/review-impl", "machine": "lifecycle", "to": "implemented",
    "reason": "太郎が実装レビュー作業を完了（implementing→implemented）＝レビュー出来高 EV 2 を獲得（EV% 93%→100%＝本物）" },
  { "id": "e069", "ts": 69, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/impl-1", "machine": "lifecycle", "to": "accepted",
    "reason": "実装-1 の成果物を承認（品質確認）。implemented→accepted（出来高は不変）" },
  { "id": "e070", "ts": 70, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/impl-2", "machine": "lifecycle", "to": "accepted",
    "reason": "実装-2 の成果物を承認（品質確認）。implemented→accepted（出来高は不変）" },
  { "id": "e071", "ts": 71, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F/review-impl", "machine": "lifecycle", "to": "accepted",
    "reason": "実装レビュー作業ノードの承認（fold で底打ち＝専用 reviewer 不要・無限後退の停止。ノード/EV=2 は不変）＝『レビューも完了状態になる』" },
  { "id": "e072", "ts": 72, "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition", "node": "F", "machine": "lifecycle", "to": "accepted",
    "reason": "子9葉が全て accepted になったのを見て、人間が F（フィーチャー）を完了へ＝最終サインオフ（出来高は不変・終端）" }
]
```

<small>注：ノード ID・ts 値・見積値はいずれも例示で実装が決める。**e063–e064** は kiro-impl 起動で実装-1・実装-2 が `implementing` に（②並行・中間 `ready` は省略表記）——`kiro-impl` は実在スキルだが moira を直接知らず、その起動が moira イベントを emit する書き込み機構（`moira-progress` 仮称・⚠未実装）は未実装＝継ぎ目 ⟿。**e065–e066** は各実装の作成完了＝`implementing→implemented`（出来高 EV 8／6 はこの時点で獲得＝`derivations/ev.ts` `COMPLETED={implemented,accepted}`）。両実装が `implemented` に達したことで、依存辺（実装-1→review-impl／実装-2→review-impl・policy=implemented・2本）の述語が充足し実装レビューが ready になる（③＝両実装の完了が前提・moira-scope-deps R-D1/R-D4）。**e067–e068** は実装レビュー作業（review-impl）の実施——太郎が assignee で `ready→implementing→implemented` と進み、**完了（e068）でレビュー出来高 EV 2 を獲得**（review-impl は A1 通常作業ノード＝MODEL §7#18(b)。EV% 93%→100% はこの e068 による＝本物の100%）。**e069–e070** は各実装の承認＝`implemented→accepted`（出来高は両状態とも COMPLETED で計上され不変）。承認に追加工数を要した場合のみ、その工数を畳んで被レビューノードに `cost` 計上し CPI をわずかに悪化させる（即決なら cost は立たず AC・CPI 不変＝§7・MODEL §7#18(b)(iv)）——本 JSON では即決として cost を省く。**e071** は実装レビュー作業ノードの承認＝**fold（lifecycle 畳み）**で底打ち（§7#18(b)(vii)）＝『レビューも完了状態になる』——fold は「イベントを出さない」意味ではなく（accepted の transition を1件出す）、「レビューのレビュー…の無限後退を止める／ノードを EV ごと消さない」意味。専用 reviewer 不要で太郎が一段発行。**e072** は F の完了＝`transition`（node:"F"・machine:"lifecycle"・to:"accepted"・actor 太郎）。**fold.ts は親の lifecycle を子から自動導出しない（`n.lifecycle = ev.to`）ため、F の完了は明示の人間イベント**——完了判定の中核は「子9葉が全 accepted（implemented 止まりの葉が残っていない）」であって達成率の値ではない（達成率100%・実行カバレッジ0% は随伴信号）。F は固有の成果物を持たない中間ロールアップゆえ F-level の implemented（レビュー待ち）断面を別途立てず、**pending→accepted の人間サインオフ1段**として記録する。中間状態を経ない `→accepted` が記録され拒否されないのは、core が遷移合法性を enforce せず構造違反（I2/I6）のみ拒否するため（moira-core Req5 AC6）。F は中間ノードゆえ EV_abs 葉に算入されず、F の accepted も達成率を動かさない（100% 据え置き・§7）。event 型は `moira/backend/src/types.ts` の `TransitionEvent` に一致。</small>

## 6. 受け入れ条件（EARS）

**（A）kiro-impl で実装が進み、作成完了で出来高が上がり玉が人間へ**

- **WHEN** 開発者が実装フェーズの実行を指示し（kiro-impl を打鍵し）AI が作業分解リストに沿って実装に着手したとき、**システムは** 各実装の行を「未着手（pending）→着手中（implementing）」へ進め、作業者をエージェント（Claude）として現さ**なければならない**。
- **WHILE** 実装を進めている（着手中の）間、**システムは** 達成率（EV%）を増やし**てはならず**、代わりに「着手中の作業項目の割合（実行カバレッジ）」を増やさ**なければならない**（達成率は完了で動き、実行カバレッジは着手で動く別々の指標）。
- **WHEN** 各実装が作成完了（implemented）になったとき、**システムは** 出来高（進捗）を、その実装の合意済み見積分だけ上げ**なければならない**（作成完了で出来高が上がる）。
- **WHEN** 実装が作成完了になったとき、**システムは** 出来高を途中段階の部分的な割合では計上**してはならない**（出来高は作成完了で初めて満額算入する＝二値）。
- **WHEN** 実装が作成完了になったとき、**システムは** 当該作業をエージェント作業キューから外し人間レビュー待ちキューへ移し、いま動くべき側が人間（レビュー担当）であることを画面で分かるように示さ**なければならない**（玉がエージェント→人間へ移ったことが分かる）。
- **WHEN** 実装が作成完了になったとき、**システムは** それを横断の decision インボックスの**コミット判断の区画（見積合意・担当割当）**に出**してはならない**（承認はコミット判断ではない）。
- **WHEN** 実装が作成完了になったとき、**システムは** それをインボックスの**「受入判断する」区画**に検収待ちとして現し、承認（受入）まで保た**なければならない**（この区画は人間レビュー待ちの映し＋受入操作の入口であり、人間のコミット判断の数を増やさない）。

**（B）実装レビューは両実装の完了後に着手し、レビュー実施は出来高を得るが承認は出来高を足さない**

- **WHEN** 実装-1・実装-2 の**両方**が作成完了（implemented）に達したとき、**システムは** 実装レビュー作業を、その前提（両実装の完了）が満たされたものとして「着手可（ready）」に進め**なければならない**（実装レビューは実装全体に対し1件で、各実装からの依存を前提とする）。
- **WHILE** 実装-1・実装-2 のいずれかが未完了（implemented 未到達）である間、**システムは** 実装レビュー作業を「着手可」に進め**てはならない**。
- **WHEN** 人間が実装レビュー作業を完了したとき、**システムは** 実装レビューの合意済み見積分だけ出来高を上げ**なければならない**（レビューも作業＝進捗。ここで達成率が本物の100%に到達する）。
- **WHEN** 人間が各実装を承認したとき、**システムは** 当該実装を「レビュー待ち（implemented）」から「承認済み（accepted）」へ進め**なければならない**。
- **WHEN** 実装が承認されたとき、**システムは** その実装の出来高（EV）を増やしても減らしても**ならず**、達成率（EV%）を承認それ自体では変え**てはならない**（出来高は作成完了到達時に既に獲得・予算は完了時に施錠されている）。
- **WHEN** 実装が承認されたとき、**システムは** 実装レビュー作業の行も「完了（implemented）」から「承認済み（accepted）」へ進めてよく、その際 実装レビュー作業の出来高を変え**てはならない**（承認段は自明な一段で、専用のレビュー担当を要さず、ノードも出来高も消えない）。
- **IF** 承認のために追加のレビュー工数が費やされたなら、**WHEN** その工数が記録されたとき、**システムは** その工数を実コスト（AC）としてのみ計上し、出来高（EV）を動かし**てはならない**（出来高を伴わない実コスト増はコスト効率（CPI）を悪化させる。工数がゼロなら AC・CPI は不変）。
- **WHEN** 実装・実装レビューが承認されたとき、**システムは** それらを人間レビュー待ち一覧から外さ**なければならない**。

**（C）子がすべて完了したとき、人間がフィーチャーを完了させる（終端）**

- **WHEN** F（フィーチャー）の子ノードがすべて完了（accepted）になったとき、**システムは** その「子の全 accepted（未完了・implemented 止まりの葉が残っていない）」状態を人間に分かるように示さ**なければならない**（このとき随伴して達成率100%・実行カバレッジ0% も成り立つが、完了判定の中核は子の全 accepted であって達成率の値ではない）。
- **WHEN** 人間が F（フィーチャー）を完了（accepted）へ進めたとき、**システムは** その lifecycle 遷移を記録し、F を「承認済み（accepted）」とし**なければならない**（フィーチャーの最終サインオフ）。
- **WHEN** F が完了したとき、**システムは** 達成率（EV%）を F の完了それ自体では変え**てはならない**（F は中間ノードで EV_abs 葉に算入されず、子の完了で既に 100% に達している）。
- **WHEN** 子の全完了や F の完了が起きたとき、**システムは** F の完了を**自動では行わず**、人間の手番（最終サインオフ）として扱わ**なければならない**（親の lifecycle を子から自動導出しない）。
- **WHEN** 実装が承認（受入）されたとき、**システムは** インボックスの「受入判断する」区画から当該項目を消さ**なければならない**（項目は条件の消滅でのみ消える——承認・差し戻しがその行為）。
- **WHEN** F 完了が起きたとき、**システムは** その事象そのものを新たな判断項目としてインボックスに出**してはならない**（フェーズ／実装進行は通常の手番。判断項目は「いま判断が要る」条件が真の間だけ存在する）。

**（共通）**

- **WHEN** 各作業が画面に表示されるとき、**システムは** その担当（作業者）と（レビュー待ちなら）レビュー担当を、spec-value と schedule の両方で一目で分かるように示さ**なければならない**。
- **WHEN** 開発者が特定のレビュー担当のレビュー待ちだけを見たいとき、**システムは** レビュー担当を選んでその担当の項目だけに絞り込める手段を提供**しなければならない**（per-node の reviewer を選んで突き合わせる絞り込み）。

## 7. 決定事項

- **本ユニットは背骨フローの終端であり、人間意図（§3）はユーザー発案・批准済み（2026-06-29）。** 本ユニットは鏡像元のない新規ユニットで、§3 のふるまい（kiro-impl 打鍵→AI が実装→implemented→人間レビュー→承認でレビューも完了→子が全完了で F も完了）は人間が 0→1 発案し、AI が忠実に転記して人間が「忠実・このまま確定」と批准した不可侵の人間意図。AI は §3 を originate していない（鏡像元なしゆえ origninate すると外的妥当性が崩壊する＝kiro-scenario ガードレール）。
- **①実装ノードへの担当割当は「見積合意の後・実行指示の前」の前提ステップ（接続ギャップの正直化・ユーザー裁定 2026-06-29）。** 前段 `assign-spec-provisional` はフェーズノード（要件定義・設計・タスク）にしか担当を付けておらず**実装ノードを扱っていない**——この接続ギャップを、本ユニットの precondition が（estimate-impl-agreed の見積合意の後・本ユニットの kiro-impl 実行の前に）埋める。ユーザー裁定「見積を agree した後・実行を指示する前に、開発とレビューの担当割り当てをすべき」に従い、割当を §3 のふるまい（kiro-impl から始まる）には足さず、**前提を生む起点イベント e060–e062**（estimate-impl-agreed の e050 と同じ扱い）として §2/§5 に置いた。**この割当を独立ユニット（estimate-impl-agreed と本ユニットの間）として切り出すか、`assign-spec-provisional` を実装ノードへ拡張するかは将来の検討事項**（背骨の接続ギャップとして正直に開示・本セッションの射程外）——これは**閉じた境界宣言であって未決 FORK ではない**（agreed 条件に影響しない・背骨フロー合成時に kiro-scenario-flow が帰属を再裁定する）。出所＝ユーザー裁定・MODEL §2.1#2（割当は人間のコミット判断）・§2.4（assignee/reviewer）。
- **②実装は実装-1・実装-2 の並行完了。** kiro-impl で実装-1・実装-2 が並行して着手中（implementing）になり、いずれも完成する（前後しても結論は同じ）。実行カバレッジは両着手中で 22%（2/9）。出来高 EV% は完了のたびに 44%→72%→93% と動く（実装-1 で +8・実装-2 で +6）。出所＝ユーザー §3・MODEL P1/R-S8。
- **③実装レビューは両実装の完了後に着手（依存辺2本）。** 実装レビュー作業ノード（実装全体で1件＝estimate-impl-agreed §7 で確定）は、実装-1→review-impl・実装-2→review-impl の依存辺（policy=implemented・estimate-impl-agreed の e055–e056 で張り済み）を前提とし、**両実装が implemented に達して初めて ready** になる（moira-scope-deps R-D1/R-D4＝「源の配下の全葉がポリシーを満たす」述語）。出所＝ユーザー §3・MODEL R-D1/R-D2/§2.6・estimate-impl-agreed §7。
- **④kiro-validate-impl との連携は射程外。** 実装フェーズの最終検証（feature レベルの検証スキル `kiro-validate-impl`）との具体的連携は別ユニットの主題で、本ユニットでは扱わない（ユーザー §3 発案時に確認・混入させない）。
- **出来高 EV% は「完了」で動く——実装-1 の作成完了（implemented）で 44%→72%、実装-2 で 72%→93%、実装レビュー作業の完了で 93%→100%（本物）。承認・F 完了では動かない。** 出来高 EV_abs は**完了葉（`implemented` または `accepted`）かつ合意済み**の凍結予算を算入（`derivations/ev.ts` の `COMPLETED={implemented,accepted}`・moira-evm Req1）。**承認（`implemented→accepted`）は完了→完了の移動ゆえ EV を足さない**（EV% 100% 据え置き）。部分EV は計上しない＝二値（MODEL v16 で却下）。EV% は現在状態の導出ゆえ差し戻し（別ユニット）で後退しうる（MODEL P5 非単調）。**「本物の100%」は実装本体（実装-1・実装-2）＋実装レビューを実際に完遂しての到達**であり、tasks 完了時の「見かけ 100%」が実装発見で 44% に正直化（estimate-impl-agreed）されたあとの、真の完了を表す。
- **「F も完了になる」＝人間の最終サインオフ・自動導出ではない（ユーザー裁定 2026-06-29・参照実装で確認）。** 参照実装 `fold.ts` は `n.lifecycle = ev.to`（イベントの to を直接適用）であり、**親の lifecycle を子から自動ロールアップ導出しない**。よって F の完了は**明示の `transition`（→accepted・actor＝人間）**として記録する（e072・最終サインオフ）。**完了判定の中核は「子9葉がすべて accepted（未完了・implemented 止まりの葉が残っていない）」**であって達成率の値ではない——達成率100%・実行カバレッジ0% は同時に成り立つ随伴の可視信号にすぎない（達成率100%は「合意済み葉が全て完了」を意味するだけで accepted と implemented を区別しない）。F は中間ノードゆえ EV_abs 葉に算入されず（moira-evm Req1・葉のみ）、F の accepted も達成率を動かさない（100% 据え置き・I1 ロールアップ親＝moira-core Req11.1）。
- **F の lifecycle 経路の接地（A-Finding1/B-Finding2 への決着・MODEL 変更不要）。** F は固有の成果物を持たない**中間ロールアップ親**であり、その「品質確認」は子（各実装）の `implemented→accepted` レビューで既に尽きている（F 固有の「レビュー待ち＝implemented」断面は持たない）。よって本ユニットは F の完了を **pending から accepted への人間の最終サインオフ1段**（e072）として接地する（F-level の implemented を別途立てない）。これは MODEL に整合し**矛盾しない**——(i) lifecycle 状態機械は**分解の深さに依らず全ノードへ一様適用**（moira-core Req5 AC1）ゆえ中間ノード F も `accepted` に到達でき、(ii) core は**遷移合法性（段階順）を enforce せず、拒否するのは構造違反〔循環 I2・非人間 agreed I6〕のみ**（moira-core Req5 AC6）ゆえ中間状態を経ない `→accepted` も**記録され拒否されない**、(iii) §2.5 の `implemented→accepted`＝「人間による成果物の品質確認」は固有の成果物を持つノード（葉・フェーズノード）について語る規定で、固有成果物を持たない中間ロールアップ F では**子の集合の完了確認（全子 accepted）が当の品質確認**にあたる。**`ESCALATE: moira-model-update` は要さない**——MODEL は「フィーチャー（中間ノード）完了」について沈黙していない：Req5 AC1（一様適用）＋AC6（合法性非 enforce・skip 記録）＋§2.5（accepted は人間の品質確認）＋§2.7（`accepted→cancelled`＝feature 取り下げ＝feature が accepted 状態に居りうることを正典が前提）＋A2（イベント駆動・状態は4イベントのみで変わる）が**併せて** F の完了を「許容された明示の人間遷移」として**支持する**。ただし正典は F 完了を*許容*するが単一経路に*一意化*はしない（フル経路 `pending→…→accepted` も `pending→accepted` 直接サインオフも AC6 下で同じく許容される）——**本ユニットは許容経路のうち `pending→accepted` の直接サインオフを著者裁定で選ぶ**（F は固有成果物を持たない中間ロールアップゆえ最小の1段）。本ユニットは正典の穴を糊塗するのではなく、正典が許容する範囲内で1つの経路を明示選択して接地している。出所＝ユーザー裁定「人間の最終承認イベント」・参照実装 `fold.ts`／`derivations/ev.ts`・MODEL §2.5/§0/A2・moira-core Req5 AC1/AC6・Req11.1。
- **【閉じた境界宣言／未決 FORK ではない】フィーチャー完了の自動導出規則は持たない（認識済みの未採用拡張）。** 「子が全 accepted になったら親を自動で accepted にする派生ルール」を MODEL に持つかは**本ユニットの射程外**で、現 MODEL は親 lifecycle を自動導出しない（A2 のイベント駆動設計＝完了は人間イベントで起こす、と一貫）。本ユニットはこの設計のもとで明示の人間サインオフに接地しており、自動導出ルールの採否は**未決の FORK ではなく、認識済みの未採用拡張として開示する**（agreed 条件に影響しない・将来 UC 化すれば moira-model-update の所管）。
- **これは背骨（線形 happy-path フロー）で唯一 feature（F）が accepted に到達する終端ユニット。** 先行ユニット（discovery〜estimate-impl-agreed）では F は一貫して `pending`（中間ロールアップ・design-spec-completed 等）だったが、本ユニットで初めて子9葉が全完了し F が accepted に達する。EV% の弧 `0→24→32→80→100(見かけ)→44(正直化)→100(本物)` の最後の「44→100(本物)」を担う（**前半の各値は先行ユニット群の断面で、段によって分母が異なりうる**——例: 80% は design-spec-completed の分母 12.5 上、44%／100(本物) は本ユニットの分母 28.5 上。本ユニットが検算で担保するのは 28.5 基底の 44→72→93→100 のみ）。差し戻し・やり直し・supersede 等の**分岐ユニットは背骨の射程外**ゆえ「唯一」は線形背骨に限定したスコープ（背骨外で feature が accepted に至る経路の有無は本ユニットの主張範囲外）。
- **実装レビュー作業ノードの承認は「lifecycle 畳み」＝『レビューも完了状態になる』——ノードも EV=2 も消えない。** §7#18(b)(vii) の fold は「レビューのレビュー…の無限後退を底打ちする／専用のレビュー担当を要さない」意味であって、**「イベントを出さない」意味ではない**（accepted の transition を1件出す＝e071）。`accepted` は完了状態として出来高に算入され EV=2 は不変。**「コスト畳み（レビュー工数を cost だけにし EV なし）」とは別概念**——本ユニットの 93%→100% は**実装レビュー作業の実施（e068）**による +2 であって、fold（e071）でも承認（e069–e070）でもない（design-spec-completed §7 と同型の二義注意）。ユーザーの言う「承認した時点でレビューも完了状態になる」は、承認（e069–e070）と同じ手番で実装レビュー作業ノードが accepted に畳まれること（e071）を指す。
- **実装レビュー作業ノードの実施で EV を獲得する（review-work-estimated／design-spec-completed の素直な適用）。** 実装レビュー作業（review-impl）の `ready→implementing→implemented`（EV 2 獲得）はユニット内で明示する（e067–e068）。これは review-work-estimated が確立した「レビュー作業ノードは A1 通常作業ノードとして出来高を得る」（MODEL §7#18(b)）の素直な適用であり、新機構ではない。実装レビュー作業ノードの承認者は指名 reviewer 不要で、太郎が一段で発行する（fold）。
- **担当（作業者）と レビュー担当（reviewer）は別の役割＝MODEL v19。** 担当（assignee）は「その作業を誰がやる/やったか」＝実装作業は **Claude（agent）**、実装レビュー作業は **太郎（human）**。**レビュー担当（reviewer）は「`implemented→accepted` を行うべく指名された人間」＝太郎**（各実装ノードに指名）で、assignee とは**別の付帯属性**（単一・latest-wins・人間限定・**平準化/EV/PV/coverage を消費しない**）。両者を両画面に別表示する（要件: moira-surface-spec-value Req10/Req11・moira-surface-schedule Req3・moira-schedule Req14・moira-core Req6 AC4–6）。実装ノードへのレビュー担当指名は割当（§2.1#2）に属する人間のコミット判断で、e060–e061 で太郎を指名する（AI が spec オーナーを提案・人間が確定）。
- **「玉」は MODEL の一級概念ではなく schedule-time キュー（P4）の俗称。** 玉（次の手番）は lifecycle から導出（`{ready, implementing}`∧assignee=agent→エージェント作業キュー、`implemented` の葉→人間レビュー待ちキュー＝actor 非依存・`derivations/queues.ts`〔agentWorkQueue 述語は `ready` も含む〕・moira-schedule Req4 AC2）。MODEL v19 は「assignee を ball-holder へ再定義」案を却下済み。実装が implemented になると人間レビュー待ちキューへ（玉＝太郎）。太郎が実装レビュー作業を実施する間（implementing・assignee=太郎＝human）は agentWorkQueue（assignee=agent 限定）には入らない人間の作業で、実装成果物自体は太郎の承認判断を待って人間レビュー待ちキューに残る。
- **達成率（EV%）と実行カバレッジは別の物差し。** EV%＝「完了（implemented/accepted）した予算の割合」、実行カバレッジ（R-S8・moira-evm Req5）＝「着手中（implementing）の合意済み葉のカウント比」。実行カバレッジの素の弧は **0%（Before）→22%（実装-1・実装-2 implementing）→0%（両 implemented）→〔実装レビュー作業の実施中 e067 は一時的に 11%（1/9）〕→0%（終端）**。中間の一時的 11% は素の導出に現れる瞬間値であり、§4 は4断面を描いて review-impl の implementing→implemented→accepted を After に「自明な一段」として畳む（§7#18(b)(vii)）ため §4 のパネルには独立断面として現れない——畳むのは**提示の断面選択**であって瞬間値が存在しないわけではない（正直化）。実行カバレッジは assignee 種別に依らず `implementing` 葉を数える（人間作業も算入・moira-evm Req5）。
- **見積カバレッジ(P2) は葉基底＝全葉合意で 100%（全断面で不変）。** 合意済み有効葉 9 / 既知の有効葉 9 = **100%**（フェーズ6葉＋実装2葉＋実装レビュー1葉）。中間ノード F は I1 ロールアップで分母外。出所＝MODEL §3 P2・参照実装 `derivations/coverage.ts` の `effectiveLeaves`。
- **承認の AC・CPI への影響は条件付き（無条件ではない）。** 承認レビューに**工数を要した場合のみ**、その工数を畳んで実コスト計上し被レビューノードに帰属させ（§7#18(b)(iv)）、出来高を伴わない AC 増として CPI をわずかに悪化させる。**即決（工数ほぼ0）の承認なら cost は立たず AC・CPI は不変**。§5 の本体 JSON は即決として承認 cost を省く（design-spec-completed §7 の条件付き是正を継承）。
- **スコープ＝happy path（差し戻しなし）に限定（閉じた境界宣言・未決 FORK ではない）。** 本ユニットは「kiro-impl で実装→完成→人間が一度で承認→F 完了」の経路のみを扱う。**実装のレビューで差し戻し（implemented→implementing/ready 等の後退）**・**実装ノードのキャンセル（cancel-task-midway の主題）**・**kiro-validate-impl 連携**・**割当そのものを作る作業**は、それぞれ別ユニット（差し戻しは将来 `impl-returned` 等の名前で切り出す射程）。これらは agreed 条件に影響しない閉じた境界宣言であり、§3 は不可侵の人間意図ゆえ否定系をここに混入させない。
- **⟿ シームは「既存スキル起動 → 未実装 emit 機構 → moira 状態遷移」（kiro-impl）。** `kiro-impl` は実在スキル（`.claude/skills/kiro-impl` で確認可）だが moira を直接知らず、その起動が moira イベント（実装 transition）を emit する書き込み機構（`moira-progress` 仮称・⚠未実装）は未実装。⟿ はこの継ぎ目を指し、kiro-impl 自体が emit するわけではない。承認・F 完了の write（`moira-progress`／`moira-*` 仮称・⚠未実装）も同様の継ぎ目。
- **イベント件数は断定しない。** lifecycle は `pending→ready→implementing→implemented→accepted`（MODEL §2.5）。§5 は主要遷移を示す。`pending→ready` 等の件数は実装（`moira-progress` 仮称・未実装）が決めるため確定しない。
- **参照実装は暫定スライス・各要素は定義済み要件への目標。** 担当（作業者）列・レビュー担当列・人間レビュー待ちキューの一覧描画・reviewer フィルタのうち、参照スライスが未描画のものは「(スライス未描画)」と中立に記した。いずれも MODEL/spec に**定義済みの要件**（frontmatter トレース）への目標受け入れ基準であり、現スライスの挙動には縛られない。
- **§6 EARS の lifecycle 状態名は平易語を主とした最小注釈（README v0.2 準拠・姉妹同型）。** §6 は「未着手」「着手中」「作成完了（レビュー待ち）」「承認済み」等の**平易語を主**とし、`(pending)`/`(implementing)`/`(implemented)`/`(accepted)` を**一語ずつの最小注釈**として括弧併記する（README v0.2 §3「どうしても要るものは一語ずつ最小注釈」）。非専門家は平易語だけで falsifiable に各条をチェックでき、内部状態名は対応確認の補助。これは姉妹 `design-spec-completed` §6 と同型の様式で、moira 専門用語・skill 実名・MODEL 記号（R-xx/I-x/P-x）は §6 本文に出さず §5/§7 へ集約している。
- **フェーズ／実装進行の事象は判断項目にならないが、検収待ちの条件は「受入判断する」区画に映る（2026-07-04 裁定への同期・§4-3/§6 の改訂）。** 旧版は「実装の完了・レビュー・承認・F 完了はインボックスに出ない」と描いていたが、issue #12 がインボックスを判断種別の4区画（見積合意・担当割当・受入・警告）へ再構成し、検収待ち（人間レビュー待ち導出）が「受入判断する」区画に映るようになった（姉妹ユニット requirements-spec-drafted の 2026-07-04 実画面裁定＝実装が正、と同一の構造。DECISIONS-CATALOG D-69）。「承認・F 完了サインオフの事象そのものは項目にならない」「5コミット判断は不変（承認は品質確認）」は従来どおり。本改訂で status を `agreed`→`in-review` に降格（再批准待ち）。
