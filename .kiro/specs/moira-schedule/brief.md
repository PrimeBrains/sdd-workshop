# Brief — moira-schedule（読/導出 spec）

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）の roadmap.md（`.kiro/steering/roadmap.md`）moira-schedule 行を一次ソースとし、`moira/MODEL.md`(v16, 凍結) からトレースして作成。CQRS 分解の Wave1（依存: moira-core）。

## Problem
正典モデル `moira/MODEL.md`(v16) は、人間が与えた割当と DAG の上で **c(i,d) 平準化（P7/P8）** によりスケジュールを導出し、各サブ単位の予測完了・未割当バックログ・三キュー（P4）・スケジュール・カバレッジ（R-S6）・スロット陳腐化（R-S7）・期日超過/過負荷の検出（R-T1–T4）・スケジュール・バッファ（R-T6）を「同一ログ＋構成入力からの導出」として要求する。これらの**時間軸（schedule）導出ロジック**を本番アーキテクチャへ落とす担い手が必要である。現状この責務は参照実装（`moira/backend/src/leveler.ts`・`derivations/forecast.ts`・`derivations/queues.ts`・`derivations/coverage.ts`）に散在しており、CQRS の読側 spec として境界づけて凍結する必要がある。

## Current State
- `moira-core`(生成済) が emit/derive 契約・二層データ・effective-set・latest-wins・状態機械・凍結属性記録を所有する。
- 参照実装（フォワード本番）に schedule 導出が存在: `leveler.ts`（c 平準化・クリティカルパス優先の発見的解・生きた予測 P7/P8）、`forecast.ts`（予測行＋凍結スロット＋未割当バックログ）、`queues.ts`（P4 三キュー）、`coverage.ts`（scheduleCoverage = R-S6 の母数）、`dates.ts`（決定的日付演算）。
- buffer(R-T6) の導出は MODEL §3／R-T6 に式が確定済みだが、参照実装には未確認（design で接地）。

## Desired Outcome
moira-schedule が「時間軸の導出読み口」を所有する: core の emit/derive 契約・effective-set・凍結スロット記録を **消費**し、(1) 生きた予測スケジュール（各サブ単位の予測完了; P7/P8）、(2) 未割当バックログ（P0 可視ギャップ）、(3) 三キュー（P4 actor フィルタ）、(4) スケジュール・カバレッジ（R-S6 の母数導出）、(5) スロット陳腐化検出（R-S7 原因別）、(6) 期日超過・過負荷の**検出データ**（R-T3/R-T4）、(7) スケジュール・バッファ残量/消費率と D_pred（R-T6）、(8) c(i,d) 平準化対象＝人間のみ・エージェント非平準化（R-U11/R-T1/R-T2）を、同一ログ・同一構成入力から決定的に導出する。

## Approach
MODEL v16 の §3・R-T1–T6・R-S6/S7・P7/P8・P4・A4/A5・R-U11 から忠実にトレースし、EARS(ja)で時間軸導出の責務だけを記述する。指標式本体（EV_abs/EV%/PV/AC/SPI/CPI/sunk）は `moira-evm` が所有し本 spec は触れない。SPI の de-rate **消費**も moira-evm(R-S6 の SPI 適用) の責務であり、本 spec は **scheduleCoverage の母数導出**のみを所有する（roadmap 共有シーム「schedule coverage: 導出は moira-schedule、SPI の de-rate 消費は moira-evm」）。warning の**確定/集約**は `moira-health`、本 spec は検出データ（overload/deadline/stale-slot）を提供するに留める（roadmap「検出データは各 derivation、警告確定/集約は moira-health」「検出=読/解消=書 の分離」）。

## Scope
### In（moira-schedule が所有）
- 生きた予測スケジュール導出（c(i,d) 平準化・クリティカルパス優先・発見的増分; P7/P8/R-T1）と各サブ単位の予測完了。
- エージェント非平準化＋リードタイムのパス長寄与（R-U11/R-T2）。
- 未割当バックログ導出（割当なし＝可視ギャップ; P0/R-U9 のスケジュール側）。
- 三キュー（作業/レビュー/エージェント）＝同一クエリの actor フィルタ（P4）。
- スケジュール・カバレッジ（合意済みのうちスケジュール済みの割合）の**母数導出**（R-S6 の被覆部分）。
- スロット陳腐化の**検出**（生きた予測 vs 凍結ベースライン・スロットの乖離; R-S7、原因別カウント）。
- 過負荷の**検出データ**（c 平準化に収まらない人物・期間; R-T3）。
- 期日超過の**検出データ**（導出スケジュール vs 期日; R-T4、超過量）。
- プロジェクト導出完了 D_pred（クリティカルパス末端の max）とスケジュール・バッファ残量/消費率（R-T6、境界条件含む、スケジュール・カバレッジ de-rate 対読み）。

### Out（下流/上流が所有）
- emit/derive 契約・effective-set・凍結スロット**記録機構**・状態機械・二層データの永続化 → `moira-core`（上流）。
- 指標式本体（EV_abs/EV%/PV/AC/SPI/CPI/sunk）と SPI への R-S6 de-rate 適用 → `moira-evm`。
- 9 warning の**確定/集約**・行為列挙・clearance・at-risk(P5) → `moira-health`。
- tree+DAG/ready/orphan/restoration の**表示** → `moira-scope-deps`。
- スケジュール書込（割当 transition の発行・slot 凍結・c 改定・期日/目標日 設定・再ベースライン・リスケのオーケストレーション・人間承認）→ write skill 群（assign-schedule/capacity/project-config/reschedule/rebaseline）。
- 全 UI 提示（Gantt/DAG ビューア/付替プルダウン/CCPM フィーバー）→ `moira-surface-schedule`/`moira-surface-health`。

## Boundary Candidates
- 生きた予測 leveler（c 平準化エンジン; P7/P8）。
- 予測行＋未割当バックログ導出。
- 三キュー導出（P4）。
- スケジュール・カバレッジ母数導出（R-S6）。
- スロット陳腐化検出（R-S7）。
- 過負荷/期日超過 検出データ（R-T3/R-T4）。
- D_pred＋buffer 導出（R-T6）。

## Out of Boundary
- 凍結スロットを**書く**こと（core が記録機構を所有、書込は write skill）。本 spec は凍結スロットを**読んで**生きた予測と突合する（R-S7）のみ。
- 警告の確定・集約・acknowledge（health／そもそも acknowledge 状態は MODEL が持たない）。
- SPI/PV/CPI の計算（evm）。本 spec は D_pred・スケジュール・カバレッジ・予測・未割当を提供し、evm/health が消費する。

## Upstream（moira-core）
core が定義し本 spec が消費する契約: emit/derive API、effective-set（supersede×cancel 復帰）、`(ts,id)` latest-wins、ノード ライフサイクル状態機械、凍結スロット属性記録（初回スケジュール時に core が記録、本 spec は読む）、二層データ（c(i,d)・期日・目標日の第二層）、再導出契機（イベント追記 AND c/期日/目標日 変更）。本 spec はこれらを**再定義しない**。

## Downstream
- `moira-evm`（R-S6 の SPI de-rate 消費・スケジュール・カバレッジを読む）。
- `moira-health`（過負荷/期日超過/スロット陳腐化の検出データを警告へ確定・集約; P5 at-risk と並ぶ）。
- `moira-surface-schedule`/`moira-surface-health`（予測・未割当・キュー・buffer・D_pred を表示）。
- write skill 群（assign-schedule/capacity/project-config/reschedule/rebaseline）が本 spec の導出を読んで人間承認付き修正を行う。

## Existing Spec Touchpoints
- `moira-core/requirements.md`（生成済）: Requirement 7（凍結スロット記録）・Requirement 10（effective-set）・Requirement 12（導出オーケストレータ・再導出契機）・Requirement 14（二層永続化）を消費する。

## Constraints
- `moira/MODEL.md` v16 を **SSOT として凍結遵守**。各要件は §3・R-T1–T6・R-S6/S7・P7/P8・P4・A4/A5・R-U11 へトレース。MODEL の文言を変えず・新概念を足さない。
- アーキ不変条件: 二層データ（4 イベントログ＋構成入力）。derivation は再計算でなく emit→derive。スケジュールは合意済み・割当済みのコミット領域のみを語り、未割当は可視ギャップ（P0）。
- 検出=読／解消=書 の分離: 本 spec は検出データを出すのみ。R-S6 de-rate は moira-evm/health が消費。
- 平準化対象は**人間のみ**（A5/R-U11）、エージェントは非平準化だがリードタイムでパス長に寄与（R-T2）。
- バッファは凍結でなく生きた予測側の量（D_pred とともに動く）。核心会計（EV/SPI/CPI/PV）を一切調整しない（R-T6/§5）。
- EARS は ja・`requirements-style.md` 準拠、トレースは `trace-notation.md` 準拠、命名は `moira-naming.md` 準拠。
