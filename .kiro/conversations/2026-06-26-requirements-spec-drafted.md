---
created_at: 2026-06-26T00:00:00Z
title: 見積 agreed 後に要件定義を打鍵し「レビュー待ち（玉が人間）＋出来高30%獲得」になる受け入れシナリオを確定
bindings:
  - { kind: scenario, id: "units/requirements-spec-drafted" }
  - { kind: requirement, id: "moira-core: 5.1" }
  - { kind: requirement, id: "moira-core: 5.3" }
  - { kind: requirement, id: "moira-core: 5.4" }
  - { kind: requirement, id: "moira-evm: 1.1" }
  - { kind: requirement, id: "moira-evm: 1.2" }
  - { kind: requirement, id: "moira-surface-spec-value: 3.1" }
  - { kind: requirement, id: "moira-surface-spec-value: 5.1" }
  - { kind: requirement, id: "moira-schedule: 4.3" }
  - { kind: requirement, id: "moira-surface-schedule: 8.1" }
  - { kind: model, id: "MODEL §2.6（仕様を書くのも進捗＝implemented で EV）" }
  - { kind: decision, id: "EV 獲得閾値 = implemented（accepted を待たない）" }
  - { kind: decision, id: "見積カバレッジ P2 = ノード基底（親 F 含む）＝75%" }
source: claude-code-session
---

## 要約

- **論点:** 前段ユニット [estimate-spec-agreed](../scenarios/units/estimate-spec-agreed.md)（見積を人間が承認して合意済みにする）の続きとして、「見積が agreed になった spec で、要件定義を実際に打鍵（作成）すると何が起きるか」を受け入れシナリオ単位に起こし、敵対者ループを通して確定する。起点はユーザーの問い「spec-value の要件定義の行が proposed になり、ガントは進捗50%に進むはず／人間が玉もちなのは画面で分かる？／decision テーブルに出る？」。
- **§3（不可侵の人間意図・ユーザーが ratify）:** 見積が承認済みの spec で要件定義を打鍵する → Claude が成果物を作成し要件定義の行が「レビュー待ち」になる／出来高（進捗）が要件定義分だけ上がる／玉（次に動く側）が人間（レビュー担当）と画面で分かる／それは人間レビュー待ち一覧に出る（decision には出ない）／開発者は自分のレビュー待ちだけに絞り込める／人間の承認は別ユニット。
- **決定（§7 に正典化）:**
  1. **「proposed＝承認待ち」は lifecycle の `implemented`**（見積合意の proposed は既に agreed 済み。作成完了・承認待ち＝`implemented`）。
  2. **出来高 EV% は「作成完了（implemented）」で 0%→30% に上がり、承認を待たない。** 参照実装 `ev.ts` の `COMPLETED={implemented,accepted}` により、要件定義が implemented になった時点で凍結予算 3 が算入され EV% = 3/(3+5+2) = **30%**。承認 `implemented→accepted` は品質確認で **EV を動かさない**。これは MODEL §2.6「仕様を書くのも進捗」の正典挙動。**ユーザーの「進捗が進む」直観は正しく、数値が 50% でなく 30%・タイミングが承認前**。部分EV（途中で半分）は計上しない＝二値（v16 で却下）。EV% は現在状態の導出で凍結でなく、差し戻しで下落しうる。
  3. **「玉が人間」は人間レビュー待ち一覧（`implemented` で承認待ちの葉＝`moira-schedule` 4.3）＋状態バッジの言い換え。** MODEL に「玉」一級概念は新設しない（素値データ表に玉列を作らない）。「承認は人間」は §2.6 の設計記述であり、見積合意の I6 構造強制とは別（lifecycle の implemented→accepted の actor=human は core が構造拒否しない）。
  4. **decision インボックスには出さない。** 成果物承認（implemented→accepted）は5コミット判断（見積合意・割当・スコープ/期日・見積の深さ）にも警告にも含まれない（UI-ARCH §3・MODEL §2.1）。レビュー待ちは人間レビュー待ち一覧で扱う。
  5. **「自分でフィルター」は視点 actor を要する新規要件**（被割当者 assignee とも actor 種別フィルタとも別）。参照実装は視点 actor 不在で「自分」を無効化（UI-ARCH §5）。MODEL 変更不要・`moira-surface-schedule` の新規要件として起票（起票後 touches 更新）。§1/§4/§6/§7 で ⚠ 一貫標識。
  6. **見積カバレッジ P2 はノード基底**（親 F を分母に含む）＝**75%**（独立合意ノード3 / 既知有効ノード4）。EV%・実行カバレッジは葉基底（3）。基底差を §2/§4 に明記（出所＝`coverage.ts`：P2=`effectiveNodes`／実行・スケジュール=`effectiveLeaves`）。
  7. **範囲は「打鍵→作成完了・玉が人間へ・出来高30%獲得」まで。** 人間の承認（EV を動かさない品質確認）と差し戻し（`implemented→implementing`＝P5 at-risk）は別ユニット。イベント件数は断定しない（ready 経由は実装が補う）。ガントに進捗バー％は出さない（EV% は spec-value/health host）。
- **理由:** §3 は人間が発案・ratify した不可侵の受け入れ基準。確定値・接地は MODEL v17／引用 spec／参照実装（ev.ts・coverage.ts・queues.ts・effective-set.ts・types.ts・tiny-project.ts）で独立に裏取りし、独立採点者（doc-gate-judge）の falsifiable ゲート PASS（生存 Critical/Important = 0・SOURCE_SET_CONFIRMED）を得てから draft→agreed に上げた。

### 覆った判断（履歴）

- **EV 獲得閾値（最重要・ユーザーへの前言訂正）:** 当初 AI は「打鍵中も承認後も EV はしばらく 0／EV は承認後に 30%」と説明し、ドラフトも「承認まで出来高 0」と描いた。→ 参照実装 `ev.ts` の `COMPLETED={implemented,accepted}`・golden fixture（impl-1 が `implemented` で EV_abs に算入）により **EV は `implemented`（作成完了・承認前）で獲得**と判明。「承認まで 0」は誤りで、**作成完了で 0%→30%**へ全面訂正。結果として**ユーザーの「打鍵で進捗が進む」直観が正しかった**（数字は 50%→30%）。ユーザーに前言訂正のうえ再確認（「はい」）して反映。
- **見積カバレッジ P2 の基底:** パッチ過程で一旦「100%（合意済み3 / 有効葉3）」と**葉基底で誤記**。→ Round 2 敵対者×2 が `coverage.ts`（P2=`effectiveNodes` 基底・親 F 含む）と姉妹ユニット `estimate-spec-agreed`（75% で確定）との矛盾を Critical 指摘。著者が coverage.ts/effective-set.ts を精読し **P2=75%（ノード基底）**へ訂正。EV%・実行カバレッジ（葉基底）との基底差を明記。
- **「玉（次に動く側）」の一級化:** 当初 §2/§4 の素値データ表に「玉」列を作っていた。→ Round 1 で「MODEL に玉概念は無い・Before 行の玉列は未存在状態の前提化」と Critical 指摘。データ表から玉列を削除し、After の「玉＝人間」を人間レビュー待ち一覧＋状態バッジの言い換えに降格。
- **「担当: 太郎／自分のレビュー待ち」のログ非導出:** 当初 §4 が「担当: 太郎」を表示し「自分のレビュー待ち」を断定。→ §5 ログ（actor=claude・assignee なし）から導出不能と Critical 指摘。「担当: 太郎」を撤去し人間レビュー待ち一覧を actor 非依存表示に。「自分でフィルター」は視点 actor 新規要件（≠assignee）として ⚠ 標識へ分離。
- **transition 件数の断定:** 当初「2 件追記」と断定。→ `pending→ready→implementing→implemented` の経路と不整合（ready 省略）と指摘。「件数は実装が決める」へ。
- **差し戻しの未宣言:** implemented 到達後の差し戻し（→implementing＝P5 at-risk）が未宣言。→ §7 で別ユニットと明記（estimate-spec-agreed §7 と対称）。
- **hedge 追加:** 「EV% は凍結でなく現在状態の導出で差し戻しで下落しうる」「承認は人間＝§2.6 の設計記述で I6 構造強制とは別」を §7 に追記。

## 生ログ（該当範囲）

- **あなた**: `要件定義・設計・タスク の見積が agreed になり、kiro-spec-requirements を打鍵するシナリオをかんがえたい。spec-value の要件定義の行が proposed になり、ガントチャートの方は進捗が50%に進むはずだよね。人間が玉もちですっていうのは画面を見ればわかるのかな？decisionテーブルには出てくるんだっけ？`
- **Claude**: 接地（MODEL v17・既存4ユニット・UI-ARCH・spec群・参照実装）後、ご質問に正典接地で回答——proposed＝lifecycle implemented／玉もち＝人間レビューキューで読める／decision には出ない／「進捗50%」は正典と緊張（当時は誤って「承認後30%・部分EV却下」と説明）。4点の boundary を提示。
- **あなた**: Q1〜Q4 すべて (A)（正典どおり）。Q3 補足「開発者が自分の名前でフィルターできる機能は必要」、Q4 補足「レビューキューを自分もちでフィルターできるように」。
- **Claude**: §3 を発案どおり転記しユニットを draft で描き起こし。Round 1 で doc-adversary×3 を並列派遣。
- **Claude（前言訂正）**: 参照実装 `ev.ts`（`COMPLETED={implemented,accepted}`）を精読し「EV は implemented で 30% 獲得・承認を待たない」と判明。Q1 での「承認後30%」説明が不正確だったと訂正し、「あなたの『進捗が進む』直観は正しい（50%でなく30%）」と報告して再確認を依頼。
- **あなた**: 「はい」（EV を implemented で 0%→30% と描く正典どおりの反映を承認）。
- **Claude**: 全 Round 1 指摘＋EV 訂正をパッチ。Round 2 で doc-adversary×2＋doc-fact-checker を並列派遣。fact-checker は11主張すべて CONFIRMED（NO_OBJECTION）。敵対者×2 が「P2=100%（葉基底）誤記、正値75%（ノード基底）」を Critical 検出。
- **Claude**: `coverage.ts`／`effective-set.ts` を精読し P2 をノード基底・75% に訂正。EV%非凍結・accept=§2.6記述 の hedge も追加。
- **Claude**: doc-gate-judge が現物と参照実装を突合し **GATE PASS**（生存 Critical/Important=0・SOURCE_SET_CONFIRMED）。status を draft→agreed に確定し本会話ログを保存。
