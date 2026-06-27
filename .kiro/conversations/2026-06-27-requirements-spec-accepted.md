---
created_at: 2026-06-27T02:00:00Z
title: requirements-spec-accepted（要件定義の承認＋設計着手）を作成。承認は EV% を足さず（既に implemented で獲得済み）lifecycle/AC/キュー/実行カバレッジが動く、を MODEL §2.5/§2.6・ev.ts・kiro-spec-design 実体へ接地し敵対ゲートで agreed へ
bindings:
  - { kind: scenario, id: "units/requirements-spec-accepted" }
  - { kind: scenario, id: "units/requirements-spec-re-returned" }
  - { kind: model, id: "moira/MODEL.md@v19" }
  - { kind: design-decision, id: "accept-adds-no-ev-evpct-flat" }
  - { kind: design-decision, id: "accept-cost-cpi-is-conditional-not-unconditional" }
  - { kind: design-decision, id: "review-node-accept-is-lifecycle-fold-not-cost-fold" }
  - { kind: design-decision, id: "design-start-implementing-snapshot-skill-runs-to-implemented-elsewhere" }
  - { kind: design-decision, id: "design-start-transition-actor-human-assignee-claude" }
  - { kind: design-decision, id: "ball-is-colloquial-for-queue-not-model-concept" }
  - { kind: requirement, id: "moira-core: Req3.1, Req3.4-5, Req5, Req6" }
  - { kind: requirement, id: "moira-evm: Req1, Req2, Req5, Req6, Req9, Req11" }
  - { kind: requirement, id: "moira-surface-spec-value: Req1, Req3, Req5, Req10, Req11" }
  - { kind: requirement, id: "moira-schedule: Req3, Req4, Req13, Req14" }
  - { kind: requirement, id: "moira-surface-schedule: Req2, Req8, Req3, Req13, Req14, Req15" }
source: claude-code-session
---

## 要約

- 論点（ユーザー発案・§3 の種）:
  re-returned（二度目の差し戻し）の後、Claude が三度目の再作業で要件定義を再び implemented にした状態から、**開発者がついに要件定義を承認**し、続いて**設計フェーズに着手**するふるまいを確かめたい。ユーザー想定：(a) 承認時、レビューは既に進捗率100%なので動かず完了のまま、(b) レビューした分の AC が増える、(c) 次に設計へ移り、開発者が kiro-spec-design を打鍵 → Claude が設計作業 → 玉が Claude へ・設計が着手中（implementing）。「この動きで合っているか」＋シナリオ化。

- 接地で判明した最重要の機微（ユーザーに先に提示）:
  **承認（accepted）は達成率（EV%）を動かさない。** EV 計上コード（ev.ts:16 `COMPLETED={implemented,accepted}`）で確認——出来高は `implemented` 到達時に既に獲得・予算施錠され、`accepted` でも不変。よって承認の瞬間に進捗バーは伸びず、動くのは lifecycle・AC（工数があれば）・CPI・キュー・実行カバレッジ。3断面（Before/Mid/After）で「達成率がいつ動き、いつ動かないか」を見せる構成にした。

- ユーザーレビュー（検証ループ前にドラフト提示）での指摘と是正:
  - ユーザー「承認済みに畳んだ瞬間、EV が 4（req3＋review1）→3 に減るのは変では」→ **EV は減らない**（accepted も完了で算入）。原因は「畳む」の二義（前作のコスト畳み＝EV なし vs 本作の lifecycle 畳み＝ノード/EV 残る）の取り違え。本文で二義を明示区別して是正。ユーザー承認後に検証ループへ。

- 決定（§7 へ記録）:
  - **承認は EV% を足さない**（既に implemented で獲得済み・ev.ts）。
  - **承認の AC/CPI 影響は条件付き**（工数を要した場合のみ。即決ゼロなら不変）——当初の無条件断定を hedge。
  - **レビュー作業ノードの承認＝lifecycle 畳み**（無限後退の底打ち・専用 reviewer 不要・実 transition は出る・ノード/EV=1 不変）。コスト畳みとは別概念。
  - **人間レビュー待ちキューは actor 非依存で req・review-req 両葉 accepted により素の導出 2→0**。
  - **「玉」は queue（P4）の俗称**（MODEL は ball-holder を一級概念として持たない）。Mid は両キュー空＝設計は未割当の可視ギャップ。
  - **設計着手は「着手中（implementing）」の作業中断面**を描き、skill 完遂で implemented に達するのは別ユニット（kiro-spec-design は一回起動で design.md 生成完遂する実在スキル）。
  - **設計着手 transition の actor=開発者（人間・割当 P0）、assignee=Claude**。
  - **⟿ は「既存スキル起動→未実装 emit 機構（moira-progress 仮称）→moira 遷移」の継ぎ目**。
  - **達成率と実行カバレッジは別物差し**（導出要件 moira-evm Req5/6 をトレース追加）。

- 理由: §3 の人間意図（承認・着手中）を不可侵に保ちつつ、正典に従うと §3 の素朴な像と細部が違う点（EV% 不変・AC 条件付き・fold 二義・玉の非接地・skill 実体）を §4-§6 でグラウンディングし §7 に開示。観測される結論は §3 のまま、内部表現は正典のまま。

## 覆った判断（敵対ループで是正）

3体の `doc-adversary`（G1–G4＋SC1–SC7）が出し、著者がパッチで塞いだもの（`doc-gate-judge` 現物照合で PASS）:

- **C1（adv1/adv2・Critical）**: 「承認に必ずレビュー工数 cost が伴い CPI 悪化」を §1/postcondition/§6 で無条件断定（過剰主張）→ 条件付き（工数を要した場合のみ・即決ゼロなら不変）へ hedge。
- **C2（adv1/adv2・Critical）**: kiro-spec-design は一回起動で design.md 生成完遂（implemented 相当）する実在スキルなのに「打鍵で implementing 停止」と矛盾 → 「implementing は着手の瞬間〜作業中の断面、implemented 到達は別ユニット」と reframe（§3 批准語は維持）。
- **C3（adv1/adv2・Critical）**: 設計着手 transition の actor=agent だが打鍵者は人間・割当主体不在 → actor=human(太郎)・assignee=claude、割当は開発者 P0 判断（§2.1#2）と明記。
- **C4（adv1・Critical）**: レビュー作業ノードの accepted 化が「fold＝イベント無し」か「実 transition」か曖昧、Mid キュー件数が揺れる → 「fold は無限後退の底打ち（イベントは出る・ノード/EV 不変）」と明記、Mid は両葉 accepted で素の導出 2→0。
- **I1（adv1/adv2・Important）**: Mid「玉＝人間」が導出非接地（両キュー空・ball-holder 概念なし）→ 「玉は queue 俗称」全体注記＋設計を未割当可視ギャップとして表示。
- **I2（adv2/adv1・Important）**: §6 EARS の専門語 → 平易化（「着手中の作業項目の割合（実行カバレッジ）」等）。
- **I3（adv1・Important）**: 「次フェーズ着手 P0」と「decision 対象外」の緊張 → 「フェーズ進行は SDLC 既定の手番」と明記。
- **I4（adv2・Important）**: ⟿ が kiro-spec-design 自体の emit と誤読 → 「既存スキル→未実装 emit 機構→moira 遷移」の継ぎ目と明記。
- **I5（adv3・Important）**: 実行カバレッジ導出要件 moira-evm Req5（R-S8）のトレース欠落 → frontmatter に 5.1,5.4,5.5,6.1,6.2 追加。
- **S1（adv1/adv3）**: レビュー作業ノード accepted 化を課す EARS 欠落 → §6 に追加。

検証ループ: ドラフト提示→ユーザーレビュー（「畳む」二義の是正）→ユーザー承認→一次資料確定（SOURCE_SET_CONFIRMED）→ doc-adversary×3（並列・独立）→ 一次資料を著者が現物照合（ev.ts/queues.ts/coverage.ts/MODEL §2.5/§7#18(b)/kiro-spec-design SKILL/moira-evm Req5）→ 著者パッチ → doc-gate-judge 現物照合 **PASS**（生存 Critical/Important = 0・SOURCE_SET_CONFIRMED・未ルーティング FORK なし）。status を draft → **agreed**。
