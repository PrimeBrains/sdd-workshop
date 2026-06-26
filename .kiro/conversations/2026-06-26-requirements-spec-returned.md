---
created_at: 2026-06-26T21:30:00Z
title: requirements-spec-returned（太郎がレビューして差し戻す）を作成。レビュー工数のEV計上をMODEL v19へ正典化し、差し戻しEVモデルは敵対ゲートで「MODEL変更不要・3→0」と確定してシナリオをagreedへ
bindings:
  - { kind: scenario, id: "units/requirements-spec-returned" }
  - { kind: scenario, id: "units/requirements-spec-drafted" }
  - { kind: model, id: "moira/MODEL.md@v19" }
  - { kind: model-change, id: "review-work-nodization-§7#18(b)" }
  - { kind: design-decision, id: "rework-ev-3to0-no-model-change" }
  - { kind: requirement, id: "moira-core: Req6 AC4-6" }
  - { kind: requirement, id: "moira-evm: Req1, Req2" }
  - { kind: requirement, id: "moira-schedule: Req13, Req14" }
  - { kind: requirement, id: "moira-surface-spec-value: Req10, Req11" }
  - { kind: requirement, id: "moira-surface-schedule: Req3, Req13, Req14, Req15" }
source: claude-code-session
---

## 要約

- 論点（ユーザー発案）:
  1. `requirements-spec-drafted` の続編として「人間（太郎）が AI 作成の requirements.md をレビューし、指摘事項をプロンプトで打って差し戻す」シナリオを作りたい。作業者は太郎・状態はレビュー中・EV は進む（実際にレビュー作業をしているから）。
  2. （MODEL 接地中に判明）レビュー工数を作業単位としてモデル化しないと、差し戻しのたびに被レビューノードの EV が 30%→0%→30%→0% とスラッシュするだけで「レビューは進んでいるのに何が起きているか分からない」EVM になる。レビュー工数をちゃんとモデル化すべき。
  3. （シナリオ批准中に発案）差し戻しで EV が 3→0 に暴落するのは違和感。ベースは残り指摘ぶんだけ修正するのだから、再見積して 3−1=2 で EV 3→2 が自然ではないか。

- 決定:
  - **論点2 → MODEL v19 へ正典化（commit e7b197a）**: §7#18(b) の「レビュー工数を作業単位としてモデル化しない」既知の簡略化を**解消**。レビュー*作業*は運用タスク・バグ修正と同様に **A1 射程内の通常の作業ノード**（新概念でない）として、相応に重ければノード化（見積・assignee・lifecycle・EV）、軽微なら畳んで cost 計上できる。reviewer *属性*（指名）の非干渉は不変。独立敵対ゲート（moira-adversary×3〔V1–V6〕→ R1 FAIL〔再反論未経過〕→ 再反論×2 → 現物 gate PASS）。当初案（`review(x)` を新概念として正典本文に導入）を C1/C8 DEFEATED で撤回し、A1 射程の確認（β）へ転換。導出・数式・状態機械・A/I/P/R 番号 不変ゆえ**版据え置き**（v16二面性・v19内訂正の先例）。
  - **論点3 → 敵対ゲートで「MODEL 変更不要」と確定**: 「差し戻し時に完了ノードを kept＋rework に後付け decompose して EV を按分（3→2）」案を moira-adversary×3（V1–V6）が**全員却下**——I4 完了施錠・R-E3（完了ノード再見積禁止）・§2.7 supersede・§2.5 lifecycle を同時に破り、部分EV（v16 却下）を密輸し、かつ decompose は後退遷移でないため **P5 が発火せず「差し戻し回数の可視化」というユーザー当初 UC を自滅**させる。忠実解は「要件定義を計画時に細分解しておき、指摘された葉だけを P5 後退（3→2）」だが、ユーザーは複雑さ（前作との不連続・3階層木・AI 接地の機構）を見たうえで **「3→0 に簡素化」を選択**。
  - **シナリオ確定**: `requirements-spec-returned` を作成。太郎のレビュー＝レビュー作業ノード（作業者太郎・レビュー中・完了で EV +1）、差し戻し＝要件定義（単一ノード）の `implemented→implementing`（EV 3→0・P5）。2つの出来高（レビュー +1／要件定義 −3）が別々に見え、AC 残存＋レビュー EV で「作業は無駄でない」が読める。EV% は 30%→27%→9%。doc-adversary×3（G1–G4＋SC1–SC7）→ 3→0 全面書き直し → doc-gate-judge **PASS**（反論されない Critical/Important = 0、数値を導出コード ev/coverage/queues で照合）。status を draft → **agreed**。

- 理由:
  - レビューは実際に時間を要する仕事であり、A1「遂行され出来高を生む作業」に該当する。ノード化すれば EV を獲得し、差し戻しが繰り返されても「レビューは進んだ」がレビュー作業ノードの EV として残り、被レビューノードの EV スラッシュと分離して見える。
  - 「3→2」の直感は正しいが、忠実な実現には**計画時の細分解**が要る（完了後の後付け分割は4不変条件違反）。単一ノードの本シナリオでは差し戻しは 3→0 が正直で、「ベースは失われない」は AC 残存＋レビュー EV＋再作業の安さで表現する。

### 覆った判断

- **当初の MODEL パッチ案（`review(x)` を新概念として正典本文に導入）を撤回**。敵対 R2 で C1（est(x) と違い専用要件/セクションなく構造的接地を欠く）・C8（「規範的変更あり」と「構造的に新しくない」が自己矛盾）が DEFEATED となり、「新概念でなく A1 射程の確認」へ再フレーミング（β）。
- **差し戻しEV「3→2 後付け按分」案を却下**。I4/R-E3/§2.7/§2.5/部分EV(v16)/P5 自滅の6点で敵対ゲートが全員 DEFEATED。MODEL 変更不要と確定。
- **シナリオ第1版（3→2・要件定義をエリア葉へ前倒し分解）を撤回し 3→0 へ全面書き直し**。doc-adversary×3 が (a) 実行カバレッジ 9% の算術破綻（カウント比なら 1/6）、(b) 「EV% 27% 安定」が 30%→27% 希釈の糊塗、(c) 前提が前作 drafted（req 単一葉）と不連続、(d) 3階層 ID が参照実装に例なし、(e) エリア分解が人間発案でなく AI 接地（SC4）等を検出。ユーザーが 3→0 簡素化を選択し、全指摘を解消。

## 生ログ（該当範囲）

- **あなた**: requirements-spec-drafted の続編として、太郎が requirements.md をレビューし指摘を打って差し戻すシナリオを作りたい。作業者は太郎、状態はレビュー中、EV は進むのか？
- **Claude**: MODEL 接地中に §7#18(b) のギャップ（レビュー工数を作業単位としない簡略化）を検出。EV を進めるにはレビューを作業ノード化する必要がある。
- **あなた**: レビュー工数は EV に反映できないとまずい。モデル化しないと差し戻しで EV が乱高下するだけで何が起きているか分からなくなる。ちゃんとモデル化すべき。今すぐ moira-model-update を起動して。
- **Claude**: moira-model-update 実行。当初案（review(x) 新概念）を敵対ゲートが却下 → A1 射程の確認（β）へ転換、版据え置きで v19 に正典化、commit e7b197a。コミット&プッシュ（push は別途）。
- **Claude**: kiro-scenario でシナリオ第1版（3→2・エリア分解）をドラフト。批准前確認。
- **あなた**: 差し戻しで 3→0 は違和感。ベースは残るので再見積して 3→2 が自然では？
- **Claude**: 「3→2 後付け按分」を敵対ゲートで検証 → I4/R-E3/§2.7/部分EV/P5自滅で却下、MODEL 変更不要。忠実な 3→2 は計画時の細分解が必要と判明。
- **あなた**: （細分解 3→2 vs 3→0 vs 上流ユニット新設の選択で）3→0 に簡素化。
- **Claude**: 3→0 でシナリオ全面書き直し（前作と連続・全指摘修正）。doc-gate-judge PASS。
- **あなた**: 問題ないのでアグリードに確定して、会話ログを記録し、コミットしてプッシュして。
- **Claude**: status を agreed に確定、本会話ログを記録、コミット&プッシュ。
