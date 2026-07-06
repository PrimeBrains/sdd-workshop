---
id: flows/new-feature-happy-path
title: 新規フィーチャーの背骨ハッピーパス——発見から真の完了まで、すべての継ぎ目で正直な信号を保って運ぶ
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time, activity(新規)]
precondition: 開発者が spec の元になる情報を持っているが、プロジェクトにまだ対象のフィーチャーノードが存在しない
postcondition: 実装-1・実装-2 が accepted、実装レビューが accepted、子9葉がすべて accepted → 人間が F（フィーチャー）を accepted（背骨で唯一 feature が accepted に到達する終端）。達成率（EV%）は 0%→100%（本物）に到達
composes:
  - units/discovery-spec-initialized
  - units/estimate-spec-proposed
  - units/estimate-spec-agreed
  - units/requirements-spec-drafted
  - units/requirements-spec-returned
  - units/requirements-spec-re-returned
  - units/requirements-spec-accepted
  - units/design-spec-completed
  - units/tasks-spec-completed
  - units/estimate-impl-agreed
  - units/impl-completed
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
  - moira-scope-deps
touches_requirements:
  - "moira-core: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 5.1, 5.3, 5.4, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.4, 11.1, 11.2"
  - "moira-evm: 1.1, 1.2, 1.4, 2.1, 3.1, 3.3, 3.4, 5.1, 5.4, 5.5, 6.1, 6.2, 8.1, 9.2, 9.5, 11.1, 11.2"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 4.1, 4.3, 5.1, 5.3, 6.2, 7.1, 7.3, 10.1, 11.1, 11.2, 11.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.4"
  - "moira-surface-schedule: 2.5, 3.1, 3.4, 8.1, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3"
  - "moira-scope-deps: 3.1, 4.1"
---

# 新規フィーチャーの背骨ハッピーパス——発見から真の完了まで、すべての継ぎ目で正直な信号を保って運ぶ

> 読み方：開発者は §1〜§4 を見れば、この通しを作るべきかを判断できます。各ユニット単体の正しさは既に
> 確定済み（agreed）で、ここで確かめるのは**ユニットを跨ぐ継ぎ目と、AI が生成し人間が批准した通しの主張**です。

## 1. このフローで確かめること

新規フィーチャーを**発見（ゼロのノード）から真の完了（feature accepted）まで**一気通貫で運んだとき、各フェーズの継ぎ目で**達成率の弧が正直であり続ける**こと——差し戻しで後退し、見かけ100%は見積カバレッジ低下で正直に露呈し、新規見積合意で44%へ落ちたのち、実装完了で本物の100%に至る——を、11ユニットの合成で確かめる。

## 2. 合成するユニット（composes）

このフローは次のユニットを**この順**で合成します。隣接メンバーの大半は前段の postcondition が次段の precondition を直接満たしますが、2 箇所（#4→#5・#10→#11）だけは背骨に含めない支援ユニット（レビュー作業の見積／担当割当）の成立を前提とします——その継ぎ目は §5 に明示します。

| # | ユニット | このフローでの役割（一行） | 入口（precondition）→ 出口（postcondition） |
|---|---|---|---|
| 1 | `units/discovery-spec-initialized` | フィーチャーとフェーズノードを木に誕生させる（EV% 0%・起点） | ノード無し → F＋3フェーズが未見積で誕生 |
| 2 | `units/estimate-spec-proposed` | 要件定義・設計・タスクに未承認の見積案を付ける | フェーズ見積なし → 見積案 proposed |
| 3 | `units/estimate-spec-agreed` | 見積を合意・凍結（EV% の分母が確定・P2 が初めて100%） | 見積案 proposed → 見積 agreed（凍結値確定） |
| 4 | `units/requirements-spec-drafted` | Claude が要件定義を書き、出来高が初めて動く（EV% 0%→24%） | 見積 agreed・未着手 → 要件定義 implemented（EV 3/12.5） |
| 5 | `units/requirements-spec-returned` | 初回レビューで差し戻し（レビューも進捗＋差し戻しで後退） | 要件定義 implemented → 差し戻し（EV% 24%→32%→8%） |
| 6 | `units/requirements-spec-re-returned` | 二度目の差し戻し（畳む→新行の是正・CPI 悪化） | 再提出 implemented → 再差し戻し（EV% 32%→8%） |
| 7 | `units/requirements-spec-accepted` | 要件定義承認・設計フェーズ着手（承認は EV を足さない） | 再提出 implemented → 要件定義 accepted・設計 implementing |
| 8 | `units/design-spec-completed` | 設計の作成完了→承認→タスク着手（EV% 32%→80%） | 設計 implementing → 設計 accepted・タスク implementing |
| 9 | `units/tasks-spec-completed` | タスク完了→見かけ100%→実装誕生でP2低下（正直化の入口） | タスク implementing → spec 全 accepted・EV% 100%見かけ・P2 75% |
| 10 | `units/estimate-impl-agreed` | 実装見積合意で分母増→達成率が正直に低下（100%→44%） | 実装未見積・P2 75% → 実装見積 agreed・EV% 44%・P2 100% |
| 11 | `units/impl-completed` | 実装完了→F accepted（背骨唯一の feature 完了＝終端） | 実装 pending・EV% 44% → 子全 accepted・F accepted・EV% 100%本物 |

通しの起点：開発者が spec の元になる情報を持っているがフィーチャーノードが無い／通しの終点：F（フィーチャー）が accepted（背骨で唯一 feature が accepted に到達する終端）

## 3. E2E のふるまい（通しの When / Then）

```
When  開発者が新規フィーチャーを発見（ノードなし）し、
      見積の提案・合意を経て spec 作成（要件定義→設計→タスク）を
      1フェーズずつ進め、各段で人間がレビュー・承認し、
      見積合意の後に実装を完了して、最終的にフィーチャーを承認する。
Then  達成率（EV%）は通しで次の弧を描く：
        0 → 24（要件定義完了）→ 32（レビュー完了）→ 8（差し戻しで後退）
        → 32（再作業＋再提出）→ 8（二度目の差し戻し）→ 32（承認・EV は不変）
        → 72（設計完了）→ 80（設計レビュー完了）
        → 96（タスク完了）→ 100（見かけ・タスクレビュー完了）
        → 44（正直化・実装見積合意で分母増）
        → 72 → 93 → 100（本物・実装完了＋レビュー完了）
And   差し戻し2往復で CPI が段階的に悪化し（差し戻された要件定義の出来高が失われ、
      費やした実コストは残る——レビュー作業自体の出来高は獲得済みで別に残る）、
      差し戻しのたびに EV% が後退する——「差し戻しは無償ではない」が数値で分かる。
And   タスクが承認された帰結で実装ノードが未見積で生まれ、
      見積カバレッジが 100%→75% に下がる——「見かけ 100% は既知作業の完了度にすぎない」
      と画面が正直に警告し、見かけの達成率を絶対完了と誤認させない。
And   実装見積の合意で分母が 12.5→28.5 に増え、達成率が 100%→44% へ正直に低下する
      ——新しい作業の確約ぶん正直に現実化する（MODEL P5(c) 非単調）。
And   実装が全て完了し、レビュー作業が出来高を得て、子9葉がすべて accepted になったのを
      見て人間が F（フィーチャー）を accepted へ進め、背骨で唯一 feature が完了する。
And   この最終の 100% は見かけではなく本物——見積カバレッジも 100%、すべてのフェーズの
      作成・レビュー・承認を通過した真の完了。
```

<small>注：「レビュー待ち」＝lifecycle `implemented`（作成完了・人間の承認待ち）。「承認済み」＝`accepted`。「着手中」＝`implementing`。差し戻し＝`implemented→implementing` の後退遷移。EV% の弧は各ユニットの §4 数値から連鎖した合成値。差し戻しは2往復（#5, #6）で、3度目の提出で承認（#7）。</small>

## 4. 通しの変化（Before → After）

採用表現は **spec-value（達成率 EV%・見積カバレッジ・lifecycle）**。通しの弧（達成率 `0→24→32→8→32→8→32→72→80→96→100(見かけ)→44(正直化)→72→93→100(本物)`）を一望できる形で描く。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 通しの弧 — 新規フィーチャーの EV%・カバレッジ・lifecycle 遷移</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">段（メンバー）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV%</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">主な lifecycle 遷移</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">玉（手番）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">通しで見える信号</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#1</b> discovery</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>0%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">F＋3フェーズ誕生（pending）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">AI</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">起点・見積なし</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#2</b> estimate proposed</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">0%</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積案 proposed（未承認）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">AI が提案・人間がまだ承認していない</td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#3</b> estimate agreed</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>0%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">100%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 agreed・凍結値確定</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">AI</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#16a34a">✦ EV% の分母が確定（12.5人日）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#4</b> requirements drafted</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">0→24%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">100%</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義 implemented</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#16a34a">✦ 出来高が初めて動く</span></td>
  </tr>
  <tr style="background:#fef2f2">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#5</b> requirements returned</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#dc2626">24→32→8%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">100%</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー完了（+EV）→差し戻し（−EV）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">AI</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">⚑ 差し戻しで EV% が後退＝差し戻しは無償でない</span></td>
  </tr>
  <tr style="background:#fef2f2">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#6</b> requirements re-returned</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#dc2626">(8→)32→8%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">100%</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">再差し戻し（−EV）・CPI さらに悪化</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">AI</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">⚑ 二度目の差し戻し＝AC だけ増え CPI 悪化</span></td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#7</b> requirements accepted</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>32%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">100%</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義 accepted・設計 implementing</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">AI</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">承認は EV を足さない（32% 据え置き）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#8</b> design completed</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">32→72→80%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">100%</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">設計 implemented→accepted・タスク implementing</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">AI</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#16a34a">✦ 設計完了＋レビュー完了で大幅前進</span></td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#9</b> tasks completed</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#b45309">80→96→100%(見かけ)</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#dc2626">100→75%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">タスク accepted・実装誕生（未見積）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—（両キュー空）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#b45309">⚠ 見かけ100%だが P2 75%＝正直な発見信号</span></td>
  </tr>
  <tr style="background:#fef2f2">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#10</b> estimate-impl agreed</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#dc2626">100→44%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">75→100%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">実装見積 agreed（分母 12.5→28.5）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">⚑ 正直化＝新規見積で分母増→達成率が落ちる</span></td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>#11</b> impl completed</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#166534">44→72→93→100%(本物)</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>100%</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">実装 accepted・F accepted</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—（全完了）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#166534">✦ 本物の100%＝全フェーズ承認済み・F完了</span></td>
  </tr>
</table>

**データ（通しの弧・素の値）**

| 段（メンバー） | lifecycle 到達点 | 達成率(EV%) | 見積カバレッジ | 実行カバレッジ | CPI の動き |
|---|---|---|---|---|---|
| #1 discovery | F＋3フェーズ pending | — | 0% | — | — |
| #2 estimate proposed | 見積 proposed | — | 0% | — | — |
| #3 estimate agreed | 見積 agreed | 0% | 100% | 0% | — |
| #4 requirements drafted | 要件定義 implemented | 24%（3/12.5） | 100% | 17%→0% | 計上開始 |
| #5 requirements returned | 要件定義 implementing（差し戻し） | 8%（1/12.5） | 100% | 17%→0% | 悪化（EV 後退・AC 増） |
| #6 requirements re-returned | 要件定義 implementing（再差し戻し） | 8%（1/12.5） | 100% | 17%→0% | さらに悪化 |
| #7 requirements accepted | 要件定義 accepted・設計 implementing | 32%（4/12.5） | 100% | 17% | 承認分 AC 増（工数あれば） |
| #8 design completed | 設計 accepted・タスク implementing | 80%（10/12.5） | 100% | 17% | — |
| #9 tasks completed | spec 全 accepted・実装 pending（未見積） | 100%（見かけ） | **75%** | 0% | 承認分 AC 増（工数あれば） |
| #10 estimate-impl agreed | 実装見積 agreed | **44%**（12.5/28.5） | 100% | 0% | — |
| #11 impl completed | 子9葉 accepted・**F accepted** | **100%（本物）** | 100% | 0%（全完了） | 承認分 AC 増（工数あれば） |

EV% 弧: `0 → 24 → (32→8) → (32→8) → 32 → (72→80) → (96→100見かけ) → 44 → (72→93→100本物)`
見積カバレッジ 弧: `0 → 0 → 100 → 100 → … → 100 → 75 → 100 → 100`

<small>※ **#5–#6 の中間**（Claude の再作業 implementing→implemented）では EV% が一時 8%→32% に戻り再び 8% に落ちる——通しの弧はこの往復を見せる。**#4–#8 の間**に review-work-estimated（非背骨ユニット）が暗黙に成立しレビュー作業ノードが存在する前提。**#10→#11 の間**に assign-spec-provisional 相当の割当が暗黙に成立。これらは §5 継ぎ目として開示。実行カバレッジは implementing 葉のカウント比で着手中にのみ動き、完了/未見積/未着手で 0% に戻る。弧の各値はメンバーユニット §4 の素の値から連鎖。**#1/#2 は見積合意前で達成率の分母が未確定ゆえ表では `—`**（弧の先頭 `0` は #3＝見積合意で分母 12.5 が確定した時点の値）。**実行カバレッジ列は各段の到達点スナップショット**で、段内の非単調な往復（例 #8 の 17%→0%→17%）は各メンバー §4 に詳らか。</small>

## 5. 継ぎ目と境界接続（メンバー間）

単体ユニットのレビューでは見えない、**メンバー間の継ぎ目**を通しで行使する。

| # | 継ぎ目（⟿ / ⚠） | 前段の出口 | 次段の入口 | 連続（状態・数値が連続するか） |
|---|---|---|---|---|
| 1 | ⟿ #3→#4 | 見積 agreed・P2 100%・未着手 | 見積 agreed・要件定義着手前 | ✅ 連続。`kiro-spec-requirements` 起動→⚠ `moira-progress`（未実装）経由で moira に implementing emit |
| 2 | ⟿ #4→#5 | 要件定義 implemented・EV% 24% | 要件定義 implemented・レビュー作業 agreed/ready | ⚠ **暗黙依存**: `review-work-estimated`（非背骨ユニット）が間に成立し、レビュー作業ノードが存在する前提。背骨はこの支援ユニットを合成せず、前提として扱う |
| 3 | ⟿ #5→#6 | 要件定義 implementing（差し戻し後）・EV% 8% | 要件定義 implemented（Claude 再作業後）・EV% 32% | ⟿ **暗黙の Claude 再作業**: implementing→implemented が間にあり、EV% が 8%→32% に戻る |
| 4 | ⟿ #6→#7 | 要件定義 implementing（再差し戻し後）・EV% 8% | 要件定義 implemented（Claude 再作業後）・EV% 32% | ⟿ 同上パターン |
| 5 | ⟿ #7→#8 | 要件定義 accepted・設計 implementing | 設計 implementing | ✅ 連続。`kiro-spec-design` 起動→⚠ emit |
| 6 | ⟿ #8→#9 | 設計 accepted・タスク implementing | タスク implementing | ✅ 連続。`kiro-spec-tasks` 起動→⚠ emit |
| 7 | ⟿ #9→#10 | タスク accepted・**実装 pending/未見積・見積カバレッジ 75%** | **実装誕生済み未見積・見積カバレッジ 75%** | ✅ **§2.6 継ぎ目**（核心）: タスク accepted の帰結で実装ノードが未見積で誕生。達成率 100%見かけ→見積カバレッジ 75%→次段で分母増→達成率 44%。両メンバー §5 では #9 の `e127` decompose と #10 の起点 `e050` が同一の論理イベントとして対応（ID 自体は各ユニットの自連番） |
| 8 | ⟿ #10→#11 | 実装見積 agreed・EV% 44% | 実装/実装レビュー pending・EV% 44% | ⚠ **暗黙の割当**: 見積合意後・実行前に担当割当（assign-spec-provisional 相当）が成立する前提 |

<small>注：`⟿` = spec/skill を跨ぐ継ぎ目（前段の出力が次段の入力になる接続点）／`⚠` = 未実装 skill を跨ぐ箇所 or 暗黙依存。**⚠ `moira-progress`（仮称）**: `kiro-spec-*` スキルの起動/完了が moira のイベント（transition）を emit する書き込み機構——⚠ 未実装。各 `kiro-spec-*` は実在スキルだが moira を直接知らず、その起動が moira 状態遷移を起こす機構が未実装。**暗黙依存（review-work-estimated / assign-spec-provisional）**: 背骨はこれらの支援ユニットを合成に含めないが、#5 の precondition が review-work-estimated の後を、#11 の precondition が割当済みを前提とする。支援ユニットは別フロー（支援フロー）で合成すべき。なお **#1→#2・#2→#3（発見→見積提案→見積合意）は状態・数値の不連続も emit 継ぎ目も無い自明な連続**ゆえ本表から省く（弧が動く／継ぎ目を行使する境界に絞る）。</small>

## 6. 受け入れ条件（EARS・通し）

- **WHEN** 開発者が新規フィーチャーを発見して見積・合意を経て各フェーズの作成・レビュー・承認を順に進めたとき、**システムは** 達成率（EV%）を作成完了（implemented）のたびに上げ、承認（accepted）では動かさ**なければならない**。
- **WHEN** レビュー担当が成果物を差し戻したとき、**システムは** 差し戻された成果物の出来高を失わせ、達成率（EV%）を後退させ**なければならない**——差し戻しのたびに費やした実コスト（AC）は残り CPI が悪化する。
- **WHILE** spec フェーズ（要件定義・設計・タスク）の作成完了と承認を通しで繰り返している間、**システムは** 達成率（EV%）を「完了で上がり、承認では動かず、差し戻しで後退する」原則で一貫して動かさ**なければならない**。
- **WHEN** spec フェーズがすべて承認済みになり達成率が見かけ上100%に達したとき、**システムは** タスク承認の帰結で実装ノードを未見積で誕生させ、見積カバレッジを100%より低く表示し**なければならない**——見かけの100%を絶対的な完了として提示**してはならない**。
- **WHEN** 実装の見積が合意され合意済み全体量が増えたとき、**システムは** 達成率を新しい全体量に基づいて更新し**なければならない**（達成率は非単調に低下しうる）。
- **WHEN** 実装がすべて完了・レビュー完了・承認され、フィーチャーの**すべての子葉が accepted** になったとき、**システムは** 人間がフィーチャー（F）を accepted へ進められるようにし**なければならない**（本例では子葉は9つ）。
- **WHEN** F が accepted に達したとき、**システムは** 達成率を本物の100%として——見積カバレッジも100%の状態で——表示**しなければならない**。

## 7. 決定事項

<!-- 検証ループで確定した決定のみを記す。 -->

- **スコープは人間が明示承認済み（SCOPE_APPROVED・2026-06-29）。** 合成する11ユニット（`discovery-spec-initialized` → `impl-completed`）・その順序・起点（フィーチャーノード未存在）／終点（F accepted）・スコープ外（`assign-spec-provisional`／`review-work-estimated`／スケジュール三部作／手戻り2本／`enhancement-spec-discovered`／`discovery-direct-impl-agreed`／`cancel-task-midway`／`manager-spots-review-bottleneck`）を人間が承認した。これは発案でなく**選択・合成の承認**。
- **通しの価値（§1/§3）は AI 生成・人間がドラフト批准済み（DRAFT_RATIFIED・2026-06-29）。** 「発見から真の完了まで、各継ぎ目で**達成率の弧が正直であり続ける**ことを通しで確かめる」という E2E 価値（合成で初めて見える創発性質）を AI が生成し、人間が読み返して批准した。
- **接地の一次資料セットはユーザー確定済み（SOURCE_SET_CONFIRMED・2026-06-29）。** README v0.2／11メンバーユニット／`trace-notation.md`／`requirements-style.md`。
- **支援ユニット2本（`review-work-estimated`／`assign-spec-provisional`）は `composes:` に含めず、前提（§5 継ぎ目）として扱う。** 人間のスコープ承認に基づく。#4→#5 はレビュー作業ノードの存在を、#10→#11 は担当割当の成立を前提とし、いずれも §5 に明示。背骨は spec ライフサイクルの直線に絞り、支援作業は別フロー（支援フロー）の射程。§2 冒頭の連続性主張も「大半は直接連続・2 箇所は支援ユニット前提」に正直化した（当初の無条件全称を是正）。
- **実装レビューは「ノード化」経路を採る（子9葉・分母 28.5・終端達成率 44%）。** agreed メンバー `impl-completed` が採るノード化経路を継承する（`estimate-impl-agreed` が提示する「畳んで実費計上」経路なら子8葉・分母 26.5・終端達成率 47%）。本フローは agreed メンバーの確定経路に従う。
- **「子9葉」「実装-1・実装-2」は本例固有の例示値。** 実装ノード数（2）・葉総数（9）はこのシナリオの例示で、フィーチャーにより異なる（§6 EARS は「すべての子葉」で一般化し、9 は例示として併記）。agreed メンバー `impl-completed` から継承。
- **「見かけ100%／本物100%」の二語は通しの正直化の中核語彙。** #9 終端の達成率100%は「見積もり済み作業の完了度」（見積カバレッジ75%が未見積実装を併示）にすぎず、#11 終端の100%は全フェーズ承認済み・見積カバレッジ100%の本物。
- **§4 は通しの弧を描く（フロー様式）。** 各メンバーの画面別 Before→After モックアップではなく、段（メンバー）ごとの達成率・カバレッジ・lifecycle の弧を HTML 表＋データ表で一望する（`templates/flow.template.md` の §4 様式）。画面別断面は各メンバー §4 に在る。
- **トレース合併は全メンバーの重複排除した和（混入1件を是正）。** 検証ループで `moira-schedule` に混入していた `14.3`（どのメンバーにも無い・`moira-surface-schedule` からの取り違え）を削除。残りの `touches_specs`/`touches_requirements` は事実検証で全 CONFIRMED。
- **メンバー `tasks-spec-completed` は本セッション中に `agreed` へ昇格（現物確認・内的整合）。** 本フロー起票時点では `draft` だったが、セッション中に当該メンバー自身の確定ループ（doc-adversary→fact-check→gate-judge）を通過し、frontmatter（`status: agreed`）と本文 §7（「`status: agreed` は確定ゲート通過を表す…`draft→agreed` に遷移した」）がともに `agreed` で整合することを現物で確認した（git 上はまだ未追跡 `??`＝未コミット）。**これで確定時点（2026-06-29）では `composes:` の全11メンバーが疑義なく `agreed`** となり、FC7 の「全メンバー agreed」要件を満たした。**〔時制注記・issue #19 追いつき 2026-07-05〕** その後、メンバー7本（`requirements-spec-{drafted,returned,re-returned,accepted}`／`design-spec-completed`／`tasks-spec-completed`／`impl-completed`）は実装先行分の裁定同期で `agreed`→`in-review`（＝裁定済み挙動の文書再同期・再批准待ち）に降格した。本フローの `status: agreed` は**確定時点のスナップショット**であり、メンバー再批准が完了するまで「全メンバーが現時点で agreed」を主張しない（再批准で再ズレ窓が閉じる。coverage gate はメンバーの agreed/in-review を許容）。
- **〔参考・要追跡〕メンバー `estimate-impl-agreed` の trace 候補。** 同メンバー §5 は依存辺生成（relate）を扱うが `touches_specs` に `moira-scope-deps` を持たない。メンバー側の trace 判断ゆえ `ESCALATE: kiro-scenario` 候補として開示（フローの合併は現メンバー群に対しては正＝事実検証 CONFIRMED ゆえフロー確定を妨げない）。
- **【status の意味】本フローは検証ループ通過後に `status: agreed` へ確定（2026-06-29）。** スコープ承認（SCOPE_APPROVED）・ドラフト批准（DRAFT_RATIFIED）・ソース確定（SOURCE_SET_CONFIRMED）・全11メンバー `agreed`・生存 Critical/Important=0（doc-gate-judge 採点）を満たし `draft→agreed` に遷移した。当初は §1 のユーザー指示で draft 据え置きだったが、合成メンバー `tasks-spec-completed` がセッション中に `agreed` へ昇格して前提が解消したため、ユーザー確認のうえ agreed へ昇格した（README の draft→in-review→agreed）。
