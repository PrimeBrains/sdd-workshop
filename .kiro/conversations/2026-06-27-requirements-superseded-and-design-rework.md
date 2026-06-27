---
created_at: 2026-06-27T05:00:00Z
title: 手戻り2本（要件 supersede／設計 後退遷移）を agreed 化。設計中に accepted 要件の欠陥発見→やり直しノードを supersede、やり直し承認後に設計を再レビュー→不一致→後退遷移。前段で moira-model-update を回し「手戻り機構は確定状態で決まる・来歴分類警告は却下・MODEL 変更なし」を確定
bindings:
  - { kind: scenario, id: "units/requirements-spec-superseded" }
  - { kind: scenario, id: "units/design-spec-reworked-after-req-redo" }
  - { kind: scenario, id: "units/requirements-spec-accepted" }
  - { kind: model, id: "moira/MODEL.md@v19" }
  - { kind: design-decision, id: "rework-mechanism-by-finalization-state" }
  - { kind: design-decision, id: "supersede-downstream-staleness-no-auto-signal" }
  - { kind: design-decision, id: "design-rework-via-backward-transition-P5-at-risk" }
  - { kind: requirement, id: "moira-core: Req3, Req5(5.6), Req7(7.4), Req10" }
  - { kind: requirement, id: "moira-evm: Req1, Req2(2.2), Req5(5.1)" }
  - { kind: requirement, id: "moira-surface-spec-value: Req1, Req3, Req5, Req10, Req11" }
  - { kind: requirement, id: "moira-schedule: Req3, Req4, Req13, Req14" }
  - { kind: requirement, id: "moira-surface-schedule: Req2, Req3, Req8, Req13, Req14, Req15" }
source: claude-code-session
---

## 要約

- 論点（ユーザー発案）:
  requirements-spec-accepted（承認＋設計着手）の続きとして、(0) 設計/タスク分解で要件の見落としに気づき要件まで手戻りするケースを扱いたい。ユーザーが2本に分けて発案：
  - **(1) requirements-spec-superseded**：AI が設計をレビュー依頼→人間が設計レビュー中に要件の見落とし（欠陥）に気づく→**確定済み(accepted)の要件行は再オープンせず、「要件定義やり直し」新ノードを supersede で足す**→新ノードは作業中、人間が「こう変えたい」と伝え AI が supersede して行を足す。
  - **(2) design-spec-reworked-after-req-redo**：やり直しが accepted まで完了後、設計を新要件で再レビュー→**合わない→設計を後退遷移で差し戻して作り直す**。陳腐化で温存していた設計の出来高が作り直し確定で正直に落ちる。

- 前段の正典判断（moira-model-update・2ラウンド・各 moira-adversary×3）→ **MODEL 変更なし**で確定:
  - **手戻り機構は確定状態（finalization）で決まる**：`implemented`（レビュー待ち・未確定）→ 後退遷移（差し戻し・既存 returned）／`accepted`（最終確定）→ supersede（§2.7・新ノードが EV 獲得・旧は累積 basis 温存・バッファ消費）。欠陥/追加要件の別ではなく状態で分かれる。
  - **却下**：「supersede に来歴分類（欠陥是正/計画的変更）を載せ欠陥のときだけ下流 at-risk」案——二律背反（導出を駆動するなら6番目の判断で五判断不変違反／駆動しないなら空虚）、clearing が既存 P5（後続完了で消えない）と衝突、ゲーミング裏口（§2.1 dismiss 禁止）、影響軸でなく意図軸、冗長。詳細はメモリ [[moira-rework-mechanism]]。
  - ユーザー Q2 で「下流陳腐化は依存張り替えで接地・MODEL 変更なし」を選択。

- 2本のシナリオ確定（敵対者×3／本→パッチ→ gate PASS）:
  - **(1)**：accepted 要件を supersede（新→旧）。旧は accepted のまま**累積出来高に残る**（computeCumulativeEvAbs）が現在有効集合から外れ、**現在 EV% 72%→52%**（やり直し側で測る）。やり直し見積は**人間が agreed**（合意は人間限定 I6）してから着手。
  - **(2)**：設計は未 accepted ゆえ**後退遷移**で差し戻し。後退で「完了」でなくなり現在 EV% も**累積も** 5 を失う（**累積 11→7**＝設計−5＋設計レビュー作業+1）。**設計に P5 at-risk が立つ**（warnings.ts・implemented 到達後の後退）。(1) supersede=累積温存／(2) 後退=累積脱落 の対比が機構分けの理由を裏から照らす。

- 検証ループで是正した主な穴（敵対者→パッチ）:
  - (1)：relate イベントを types.ts 準拠（op/edgeKind）に・**人間の見積合意段を追加**・**D1 正直化**（設計の陳腐化は自動導出信号にしない＝supersede 上流依存を警告する導出は MODEL に無い／設計は implemented・EV5 据え置き・信号化は (2) の P5）・累積を spec-value から外す（surface-health 責務）・トレース是正（core 7.4/10.x・evm 2.2 追加）・§2.7(b) 配置を接地＋既知 nit。
  - (2)：**P5 at-risk を §4/§5/§6 に追加**（最重・確定済み returned と同型）・Before 実行カバレッジ 33%→17%（不変）・§4-2 After 人間レビュー待ちキュー非空（review-design 在席）・累積 11→7 の算術明記・トレース是正（core 5.6・evm 2.2/5.1）・累積を surface-health へ。

- 決定（§7 へ記録・両ユニット）:
  - 確定済みの手戻りは supersede（再オープンせず）／未確定の差し戻しは後退遷移。
  - 出来高の二読み：累積（surface-health）と現在 EV%（spec-value）を分離。supersede は累積温存、後退遷移は累積も脱落。
  - 設計の陳腐化に自動信号は無い（人間が抱える）。信号化は後退遷移＝P5 at-risk のとき。
  - 【既知 nit / D2】§2.7 は (b) の新ノード配置（兄弟か root か）を明示しない→欠陥是正は兄弟（§2.7(b)）採用。
  - 【既知 nit / D3】R-D7 "completed" の射程（accepted 限定の読み）は MODEL 用語未確定。

- 理由: §3 の人間意図を不可侵に保ちつつ、正典で接地できない過大主張（陳腐化の自動信号化）を D1 で正直化し、確定状態による機構分けを2本の対比（supersede 累積温存／後退 累積脱落）で可視化。MODEL は変えず既存正典で接地。

## 覆った判断（敵対ループで是正）

検証ループ（doc-adversary×6＝各ユニット3体）が出した Critical の主なもの：
- (1) relate 型不一致（edge→edgeKind・op 欠落）／52% が未確定値依存（agreed・旧レビュー残置）／やり直し合意段欠落（AI 自己合意問題）／トレース未被覆／§2.7 配置／陳腐化が導出非接地（e103 は何も動かさない）。
- (2) **P5 at-risk 欠落（後退遷移を扱うのに最も正直な信号を落としていた・確定済み returned と矛盾）**／Before 実行カバレッジ 33% 自己矛盾／§4-2 キュー「空」が queues.ts と矛盾／R-D7 completed 射程。
いずれも著者パッチで塞ぎ、doc-gate-judge が両ユニット **PASS**（生存 Critical/Important = 0・一次資料現物照合・SOURCE_SET_CONFIRMED）。status を draft → **agreed**。
