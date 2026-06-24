---
created_at: 2026-06-24T00:00:00Z
title: 見積の内部表現をハイブリッドに確定（値+状態は被見積ノード／est 作業ノードは重い時のみ）
bindings:
  - { kind: model, id: "moira/MODEL.md R-E1/R-E1b/R-E2/§2.2/§2.3/§7#14" }
  - { kind: decision, id: "moira/DECISIONS.md v16 見積二面性の明確化" }
  - { kind: scenario, id: "units/estimate-spec-proposed" }
source: claude-code-session
---

## 要約
- 論点: 受け入れシナリオ `units/estimate-spec-proposed.md` が見積の内部表現の三者乖離（原案=proposed/agreed を 2 行／MODEL=est 独立ノード／参照実装=作業ノード属性）を炙り出した。人間はこれを「専門家へ委譲」し、moira-model-update の敵対ループで裁定した。
- 専門家ループの発見: MODEL 内部に未解決点があった（実装が外れているだけ、ではなかった）。
  - R-E1「見積をノードで表現(shall)」が(読みA)見積*作業*の別ノード義務と(読みB)見積*値*の担体の二読みを許し、R-E2b「軽微なら畳む」と文面矛盾。
  - proposed/agreed 状態の所在（被見積ノード vs est ノード）・est ノードの木所属/lifecycle/I1 寄与が未規定。
  - 「S4 参照実装は既知簡略化」は未文書化の過剰主張。
- 選択肢: A. ハイブリッド（値+状態は被見積ノード／est 作業ノードは重い時のみ R-E2b でノード化） B. 常に作業ノード属性（est は概念のみ） C. 常に独立 est ノード（R-E1 文字通り）
- 決定: **A. ハイブリッド**（ユーザー裁定）。
- 理由: B は大きな見積スパイクを作業として管理できない。C は feature あたり約 4 ノード増＋現実装/シナリオ全面改修。A は R-E1+R-E2b+§2.3 を最小修正で整合させ、常用ケース（軽微）は現実装・シナリオのまま、重い見積作業のみノード化して EV 化できる。MODEL §2.3 の「深さは人間判断・経験的に 0〜1 段」という既存の意図とも一致。

### 確定の経路（三者分離・falsifiable ゲート）
- R1: moira-adversary ×3（モデル攻撃角 V1–V6）が独立に収束 Critical を検出（R-E1/R-E2b 矛盾・状態所在・est 木/lifecycle/I1・「既知簡略化」過剰主張）。
- FORK をユーザーへ（AskUserQuestion）→ ハイブリッド。
- 著者パッチ（編集的明確化）→ R2: moira-adversary ×2 が「パッチ過剰（est 作業ノードを過剰specし R-E2 主語が宙に浮く等）」を検出 → 最小形へ再パッチ＋R-E2 同期。
- moira-gate-judge: PASS（残存 Critical/Important = 0、反証 2 件＝est lifecycle は A1 既存論点・v16 据え置きは正当、を健全と裁定）。

### 覆った判断（自己の過去主張の撤回）
- 「MODEL は明確で内的整合・変更不要」→ 撤回（R-E1 vs R-E2b の文面矛盾を確認）。
- 「S4 参照実装は既知簡略化」→ 撤回（未文書化の過剰主張。§7#14 で fixture 簡略化として正直に開示）。
- 初回パッチ「ノード化された est は通常どおり §2.5 lifecycle を踏む」→ 過剰specと判明し撤回（est は A1 の作業ノードの一つ。非実装 lifecycle 適合は A1 既存論点として §7 開示）。

### 確定物
- `moira/MODEL.md`: R-E1/R-E1b/R-E2/§2.2/§2.3/§2.6/§7#14 を編集的に明確化（版番号据え置き v16・新 A/I/P/R 番号なし・導出/数式/状態機械不変）。§6 来歴に追記。
- `moira/DECISIONS.md`: 「v16 見積二面性の明確化」節を追記。
- `.kiro/scenarios/units/estimate-spec-proposed.md` §7: 委譲を解消しハイブリッド確定を記載。

### 残課題（別タスク・非ブロッキング）
- 下流 `moira-ingestion-adapter` spec R3/R4「est を候補ノードとして提案」を「R-E2b に従い重い場合にノード候補化」と読むよう文言同期（本スキルは MODEL と派生文書のみ確定）。
- 非実装ノード（est/運用/バグ）への `implemented`≔実装完了∧仕様FIX・P5 at-risk の適用解釈は A1 射程の既存論点として運用に委ねる。

## 生ログ（要約）
- **あなた**: 「専門家ループを回して」（⚑1/⚑2/⚑5＝見積の内部表現を MODEL に照らして裁定）。
- **Claude**: 一次資料（MODEL.md・types.ts・fixture・moira-core/ingestion 要件）を確認 → 著者裁定案を組み → moira-adversary ×3 で攻撃 → 収束 Critical を提示し「MODEL 自身に未解決の設計分岐がある」と報告、FORK を提示。
- **あなた**: FORK に「ハイブリッド（推奨）」を選択。
- **Claude**: MODEL を最小パッチ → 再攻撃（×2）で過剰を検出 → 最小形に収束 → gate-judge PASS → §6/DECISIONS/シナリオ§7/本ログを整合確定。
