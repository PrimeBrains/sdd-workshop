# Requirements Document

## Introduction

`moira-schedule` は Moira 正典モデル `moira/MODEL.md`(v19) を本番アーキテクチャへ落とす **CQRS 分解の Wave1**（依存: `moira-core`）であり、Moira の **時間軸（schedule）導出**を所有する read/導出 spec である。具体的には次を所有する:

1. **生きた予測スケジュール** — 人間が与えた割当と DAG の上での **c(i,d) 平準化（P7/P8）**・クリティカルパス優先の発見的増分解として、各サブ単位の予測完了を導出する（R-T1/R-U11/R-T2）。割当の読み取りでは、各サブ単位の被割当者を作業開始ライフサイクル遷移の単一属性（latest-wins 置換）として解釈し、平準化が誰の容量を消費するかを一意に決める（R-T5/§2.4）。
2. **未割当バックログとキュー（P4 同一クエリ）** — 割当なしの合意済み作業を可視ギャップ（P0）として、エージェント作業キューと人間レビューキューを同一 DAG×ログへの actor フィルタ違い（P4）として導出する（参照実装 `queues.ts`＝二導出列＝`agentWorkQueue`／`humanReviewQueue`）。P4 見出しの「三キュー」および UI-ARCHITECTURE §4.1 の「作業/レビュー/エージェント」は、この同一クエリへの actor フィルタ・プリセット（全員/人間/エージェント）の表記であり、被覆上は **1 導出**（UI-ARCHITECTURE §4.1 line 73）として数える——本 spec が出すのはこの 1 導出（二導出列）であって、第 3 の独立キューを再計算しない。
3. **スケジュール・カバレッジとスロット陳腐化** — 合意済みのうちスケジュール済みの割合（R-S6 の母数）と、生きた予測が凍結ベースライン・スロットと乖離する陳腐化スロットの**検出**（R-S7、原因別）。
4. **検出データ** — 過負荷（R-T3）・期日超過（R-T4）の検出データを提供する（警告の**確定/集約**は `moira-health` が所有；本 spec は検出データを出すのみ）。
5. **D_pred とスケジュール・バッファ** — プロジェクト導出完了 D_pred（クリティカルパス末端の max）と、二参照日付（期日・目標日）から導くスケジュール・バッファ残量/消費率（R-T6、境界条件含む）。

本 spec は MODEL を唯一の真実源（SSOT）とし、MODEL の文言を変えず・新概念を足さず、`moira-core` が所有する契約概念（emit/derive・二層データ・effective-set・latest-wins・状態機械・凍結属性記録）を **消費**する前提で時間軸導出の責務だけを記述する。指標式本体（EV_abs/EV%/PV/AC/SPI/CPI/sunk）は `moira-evm` が所有し、SPI への R-S6 de-rate **適用**も `moira-evm`／健全性提示は `moira-health` が消費する——本 spec は de-rate される側の母数（スケジュール・カバレッジ）と D_pred・予測・未割当を提供するに留める（roadmap 共有シーム「schedule coverage: 導出は moira-schedule、SPI の de-rate 消費は moira-evm」「検出データは各 derivation、警告確定/集約は moira-health」）。

数式・magic number（平準化の充填ヒューリスティクスの具体・乖離閾値・過負荷の窓）は本書に埋め込まない（指標の定義式の正典は MODEL §3／`moira-naming.md`、実装定義部分は design 以下に置く）。ただし default 容量 1.0MD/日（MODEL A4／R-U11 が正典化した外的事実の既定値）はこの除外対象ではない——これは雇用契約・暦に基づく外的事実の既定であって、実装に委ねる充填ヒューリスティクス・閾値・窓とは別カテゴリであり、AC 1.2 が MODEL からの忠実なトレースとして本文に記述する。

## Boundary Context

- **In scope（moira-schedule が所有）**: 生きた予測スケジュール導出（c(i,d) 平準化・クリティカルパス優先・発見的増分; P7/P8/R-T1）と各サブ単位の予測完了、エージェント非平準化＋リードタイムのパス長寄与（R-U11/R-T2）、未割当バックログ導出（P0 のスケジュール側可視ギャップ; R-U9）、キュー導出（エージェント作業/人間レビュー= 同一 DAG×ログへの actor フィルタ違い・P4。参照実装 `queues.ts` の二導出列＝被覆上 1 導出。P4 見出し「三キュー」／UI-ARCHITECTURE §4.1「作業/レビュー/エージェント」は同一クエリの actor フィルタ・プリセット表記でありこの 1 導出に対応する）、単一被割当者の作業開始遷移属性としての解釈（latest-wins 置換; R-T5/§2.4）、スケジュール・カバレッジ（合意済みのうちスケジュール済みの割合）の**母数導出**（R-S6 の被覆部分）、スロット陳腐化の**検出**（生きた予測 vs 凍結ベースライン・スロットの乖離、原因別カウント; R-S7）、過負荷の**検出データ**（c 平準化に収まらない人物・期間; R-T3）、期日超過の**検出データ**（導出スケジュール vs 期日、超過量; R-T4）、プロジェクト導出完了 D_pred（クリティカルパス末端の max）とスケジュール・バッファ残量/消費率（境界条件含む、スケジュール・カバレッジ de-rate 対読み; R-T6）。
- **Out of scope（上流/下流が所有）**: emit/derive 契約・effective-set 導出・凍結スロット**記録機構**・ノード/見積 状態機械・二層データ永続化 = `moira-core`（上流）、指標式本体（EV_abs/EV%/PV/AC/SPI/CPI/sunk）と SPI への R-S6 de-rate **適用** = `moira-evm`、9 warning の**確定/集約**・行為列挙・clearance・at-risk(P5) = `moira-health`、tree+DAG/ready/orphan/restoration の**表示** = `moira-scope-deps`、全 write（割当 transition 発行・slot 凍結・c 改定・期日/目標日 設定・再ベースライン・リスケのオーケストレーション・人間承認）= write skill 群、全 UI 提示（Gantt/DAG ビューア/付替プルダウン/CCPM フィーバー）= `moira-surface-schedule`/`moira-surface-health`。
- **Adjacent expectations**: 本 spec は `moira-core` の derive 契約・effective-set・凍結スロット記録・二層データ・再導出契機を **消費**し、`moira-evm`（スケジュール・カバレッジを SPI de-rate に消費）・`moira-health`（過負荷/期日超過/スロット陳腐化の検出データを警告へ確定）・surface 群（予測/未割当/キュー/buffer/D_pred を表示）・write skill 群（導出を読んで人間承認付き修正）へ導出を **提供**する。core の凍結スロット記録の形・effective-set の形が変われば本 spec の R-S7/R-S6/予測導出が再検証を要する。

## Requirements

### Requirement 1: 生きた予測スケジュールの c(i,d) 平準化導出（R-T1/P7/P8）

**Objective:** read サーフェス/リスケ skill 作者として、人間が与えた割当と DAG の上での c 平準化として生きた予測スケジュールを得たい。それにより各サブ単位がいつ完了する見込みかを正直な time-phased 形で読める。

#### Acceptance Criteria

1. The system shall derive the live forecast schedule as a c(i,d)-leveled, critical-path-priority heuristic over the human-provided assignments and the dependency DAG, recomputed incrementally on each event.
   - 和訳: システムは生きた予測スケジュールを、人間が与えた割当と依存 DAG の上での c(i,d) 平準化・クリティカルパス優先の発見的解として導出し、イベント毎に増分再計算しなければならない。
2. The system shall consume each human's daily capacity c(i,d) when leveling, defaulting unspecified days to 1.0MD/day and placing no planned work on a c=0 day.
   - 和訳: システムは平準化時に各人間の日次容量 c(i,d) を消費し、未指定日を 1.0MD/日 とし、c=0 の日には計画作業を載せてはならない。
3. The system shall derive each schedulable sub-unit's predicted completion under the current latest estimate and current capacity, treating a leaf as schedulable only when it is agreed, assigned, and estimated.
   - 和訳: システムは各スケジュール可能なサブ単位の予測完了を、現行の最新見積と現行容量の下で導出し、葉を「合意済み・割当済み・見積済み」のときにのみスケジュール可能として扱わなければならない。
4. The system shall keep the live forecast schedule as a heuristic, feasible, non-optimal solution and shall not pursue a global optimum, treating slot placement as implementation-dependent.
   - 和訳: システムは生きた予測スケジュールを発見的・実行可能・非最適な解として保ち、大域最適を追わず、スロット配置を実装依存として扱わなければならない。
5. The system shall recompute the live forecast schedule (not the frozen baseline) when an event is appended and when a configuration input (c, deadline, target date) changes (the frozen baseline slot is not touched during forecasting — the inviolability is owned by Req12 AC2).
   - 和訳: システムは、イベント追記時および構成入力（c・期日・目標日）変更時に生きた予測スケジュール（凍結ベースラインではない）を再計算しなければならない（予測導出中に凍結ベースライン・スロットには触れない——不可侵は Req12 AC2 が所有する）。

### Requirement 2: 人間のみ平準化・エージェント非平準化とリードタイム寄与（R-U11/R-T2/A5）

**Objective:** read サーフェス作者として、希少資源たる人間のみを c 平準化の対象とし、エージェントは非平準化だが律速時にはパス長へ寄与させたい。それにより資源の非対称が導出に正直に反映される。

#### Acceptance Criteria

1. The system shall subject only human resources to c(i,d) leveling and shall leave agent resources unconstrained by capacity.
   - 和訳: システムは c(i,d) 平準化を人間資源にのみ適用し、エージェント資源を容量による制約の対象外としなければならない。
2. The system shall display agent work as schedulable spans between human touchpoints even though agent work is not leveled.
   - 和訳: システムはエージェント作業を、平準化対象外でも人間接点間の実行可能スパンとして表示しなければならない。
3. The system shall include an agent task's lead time (P6) in dependency-chain path-length calculations **unconditionally — regardless of successor kind, including a trailing agent task with no successor** — so that it always contributes to the critical path (the longest path through the dependency chains, supersede edges excluded; R-D7/§2.7). Rate-limiting a human successor is merely the representative case, NOT a precondition for the contribution; the contribution is over scheduled effective assigned leaves (P0). (PR-CRITPATH-AGENT / R-T2 / P7, v19.)
   - 和訳: システムはエージェントタスクのリードタイム（P6）を、後続の種別を問わず——後続が無い末尾のエージェントタスクを含め——**無条件に**依存連鎖のパス長計算に算入し、常にクリティカルパス（依存連鎖の最長路；置換辺=supersede は除く＝R-D7/§2.7）へ寄与させなければならない。人間後続を律速する場合は代表例にすぎず、寄与の**条件ではない**。寄与の対象はスケジュール対象＝有効・割当済みの葉に限る（P0）。（PR-CRITPATH-AGENT／R-T2／P7、v19）

### Requirement 3: 未割当バックログの可視ギャップ導出（P0/R-U9）

**Objective:** read サーフェス作者として、合意済みだが割当のない作業を可視ギャップとして得たい。それによりスケジュールが割当済みのコミット領域のみを語り、未割当を暗黙に仮定しないことを保証できる。

#### Acceptance Criteria

1. The system shall derive the unassigned backlog as the agreed effective leaves that have no assignee and shall keep them off the schedule.
   - 和訳: システムは未割当バックログを、被割当者を持たない合意済み有効葉として導出し、それらをスケジュールに載せないでおかなければならない。
2. The system shall present the schedule as speaking only of the assigned (committed) region and shall expose the unassigned backlog as a visible gap, not implicitly assumed.
   - 和訳: システムはスケジュールを割当済み（コミット）領域についてのみ語るものとして提示し、未割当バックログを暗黙に仮定せず可視ギャップとして公開しなければならない。

### Requirement 4: キューは同一クエリの actor フィルタ（P4）

**Objective:** read サーフェス/decision 作者として、エージェント作業/人間レビューのキューを同一 DAG×ログへの actor フィルタ違いとして得たい。それにより二系統計算を避け、被覆上 1 導出として扱え、UI-ARCHITECTURE §4.1 の「作業/レビュー/エージェント」三キュー表記（actor フィルタ・プリセット）を同一クエリで満たせる。

#### Acceptance Criteria

1. The system shall derive the agent work queue and the human review queue as the same query over the DAG × log differing only by an actor filter, never as separate recomputations, and shall expose them as a single derivation (UI-ARCHITECTURE §4.1's "work/review/agent three-queue" labels are actor-filter presets over this same query, not a third independent recomputation).
   - 和訳: システムはエージェント作業キューと人間レビューキューを、同一 DAG×ログへの actor フィルタ違いとして導出し、別々の再計算としてはならず、これを 1 導出として公開しなければならない（UI-ARCHITECTURE §4.1 の「作業/レビュー/エージェントの三キュー」ラベルはこの同一クエリへの actor フィルタ・プリセットであって、第 3 の独立した再計算ではない）。
2. The system shall include in the agent work queue the effective leaves in `ready` or `implementing` assigned to an agent.
   - 和訳: システムはエージェント作業キューに、エージェントに割り当てられた `ready` または `implementing` の有効葉を含めなければならない。
3. The system shall include in the human review queue the effective leaves at `implemented` awaiting the human `implemented→accepted` review.
   - 和訳: システムは人間レビューキューに、人間の `implemented→accepted` レビュー待ちである `implemented` の有効葉を含めなければならない。

### Requirement 5: スケジュール・カバレッジの母数導出（R-S6）

**Objective:** evm/health の消費者作者として、合意済みのうちスケジュール済みの割合を生データとして得たい。それにより SPI を de-rate する側がこの母数を読んで偽の全体進捗を防げる。

#### Acceptance Criteria

1. The system shall derive schedule coverage as the share of agreed effective leaves that are scheduled (have a frozen baseline slot), returning the raw ratio with an empty denominator yielding zero.
   - 和訳: システムはスケジュール・カバレッジを、合意済み有効葉のうちスケジュール済み（凍結ベースライン・スロットを持つ）ものの割合として導出し、生の比率を返し、分母が空なら 0 としなければならない。
2. The system shall surface the unscheduled-but-agreed work as a visible gap alongside schedule coverage so a downstream consumer can de-rate SPI.
   - 和訳: システムは未スケジュールの合意済み作業を、スケジュール・カバレッジと並ぶ可視ギャップとして提示し、下流の消費者が SPI を de-rate できるようにしなければならない。
3. The system shall provide schedule coverage as a read for the SPI de-rate, and shall not itself compute SPI or apply the de-rate (those belong to the EVM/health consumers).
   - 和訳: システムはスケジュール・カバレッジを SPI de-rate 用の読みとして提供し、SPI の計算や de-rate の適用は自身では行わない（それらは EVM/health 消費者の責務）でなければならない。

### Requirement 6: スロット陳腐化の原因別検出（R-S7）

**Objective:** health/リスケ skill 作者として、生きた予測が凍結ベースライン・スロットと乖離するサブ単位を原因別に検出したい。それにより人間に再ベースラインか確認を促す可視ギャップを得られる。

#### Acceptance Criteria

1. While a sub-unit's live-forecast completion diverges from its frozen baseline slot, the system shall flag the baseline slot as potentially stale and surface the stale-slot count attributed by cause (an assignment change, or a capacity c(i,d) change such as a newly-declared holiday/leave) as a visible gap alongside schedule coverage.
   - 和訳: サブ単位の生きた予測完了が凍結ベースライン・スロットと乖離する間、システムはベースライン・スロットを陳腐化の可能性ありとして標識し、陳腐化スロット数を原因別（割当変更、または新たに宣言された祝日・休暇などの容量 c(i,d) 変更）にスケジュール・カバレッジと並ぶ可視ギャップとして提示しなければならない。
2. The system shall reuse the already-derived live forecast (each sub-unit's predicted completion) for the divergence check and shall introduce no new prediction algorithm, with the divergence threshold implementation-defined.
   - 和訳: システムは乖離判定に、既に導出済みの生きた予測（各サブ単位の予測完了）を再利用し、新たな予測アルゴリズムを導入してはならず、乖離の閾値は実装定義とする。
3. The system shall clear the stale flag only when a reason-stamped re-baseline re-draws the frozen slot or the live forecast re-converges to the slot (the divergence condition is falsified), and shall not clear it on a deliberate no-action "confirm".
   - 和訳: システムは陳腐化標識を、理由付き再ベースラインが凍結スロットを引き直したとき、または生きた予測がスロットへ再収束（乖離条件の偽化）したときにのみ解除し、意図的な無行動の「確認（据え置き受容）」では解除してはならない。
4. The system shall keep the stale-slot detection independent from schedule coverage (R-S6), allowing both to hold at once, and shall surface this as detection data without confirming or aggregating it as a warning (that belongs to health).
   - 和訳: システムは陳腐化スロット検出をスケジュール・カバレッジ（R-S6）から独立に保ち、両者が同時に成立しうるものとし、これを検出データとして提示するのみで警告として確定・集約しない（それは health の責務）でなければならない。

### Requirement 7: 過負荷の検出データ（R-T3）

**Objective:** health/リスケ skill 作者として、人間が与えた割当が c 平準化に収まらない人物・期間を検出したい。それにより人間が再調整できる過負荷の検出データを得られる。

#### Acceptance Criteria

1. If a human-provided assignment cannot fit c(i,d) leveling for some person over some window — including AC recorded on a c=0 day — then the system shall surface over-allocation detection data identifying the person and window, with the alert threshold/window implementation-defined.
   - 和訳: 人間が与えた割当が、ある人物・ある期間で c(i,d) 平準化に収まらない場合（c=0 の日に AC が計上された場合を含む）、システムは当該人物と期間を特定する過負荷検出データを提示しなければならない（発火閾値・期間は実装定義）。
2. The system shall let the over-allocation condition become false via a re-assignment (`transition`) or a c change (a c-driven re-derivation), and shall let a point event such as AC on a c=0 day age out of the implementation-defined window rather than persist forever.
   - 和訳: システムは過負荷条件を、割当変更（`transition`）または c の変更（c 起因の再導出）で偽化させ、c=0 の日の AC のような点事象を、永久に残すのではなく実装定義の窓から外れて消えるようにしなければならない。
3. The system shall surface the over-allocation as detection data and shall not automatically rebalance or add resources, leaving the rebalancing decision to the human via downstream confirmation/aggregation (health) and write skills.
   - 和訳: システムは過負荷を検出データとして提示し、自動で再調整や要員追加を行わず、再調整の判断を下流の確定/集約（health）と write skill を通じて人間に委ねなければならない。

### Requirement 8: 期日超過の検出データと超過量（R-T4）

**Objective:** health/リスケ skill 作者として、導出スケジュールが外部期日を超えるとき、超過量つきの検出データを得たい。それにより人間がスコープ/要員/期日を判断でき、自動でスコープや要員を動かさない。

#### Acceptance Criteria

1. If the derived schedule exceeds the external deadline, then the system shall surface deadline-overrun detection data carrying the overrun magnitude (derived completion − deadline), and shall not automatically add resources or cut scope (the derived schedule already includes agent-span lead time per Req2 AC3 / R-T2 — included **unconditionally**, so the overrun fires correctly whether an agent rate-limits a human successor OR is a trailing agent with no successor — MODEL R-T4 references this as an R-T2 prerequisite, not an independent requirement).
   - 和訳: 導出スケジュールが外部期日を超える場合、システムは超過量（導出完了 − 期日）を伴う期日超過検出データを提示し、自動で要員追加やスコープ削除を行ってはならない（導出スケジュールは Req2 AC3／R-T2 によりエージェント区間のリードタイムを**無条件に**算入済みのため、エージェントが人間後続を律速する場合でも、後続の無い末尾エージェントの場合でも超過が正しく発火する——MODEL R-T4 はこれを R-T2 の前提として参照するのみで独立要件化していない）。
2. The system shall let the deadline-overrun condition persist while the derived schedule exceeds the deadline and become false only when the derived schedule comes within the deadline (a configuration-input change or other commitment moves it), surfacing it as detection data for downstream warning confirmation (health) rather than auto-resolving.
   - 和訳: システムは期日超過条件を、導出スケジュールが期日を超える間は持続させ、導出スケジュールが期日内に収まったとき（構成入力変更その他のコミットがそれを動かす）にのみ偽化させ、自動解決でなく下流の警告確定（health）のための検出データとして提示しなければならない。

### Requirement 9: 単一被割当者の作業開始遷移属性としての解釈（R-T5/§2.4）

**Objective:** スケジュール導出として、各サブ単位の被割当者を作業開始ライフサイクル遷移の単一属性（latest-wins・置換）として読み取りたい。それにより平準化が誰の容量を消費するかを一意に決められる。

#### Acceptance Criteria

1. The system shall read a node's single assignee as a property of a lifecycle `transition` — the work-start transition into the active state, or, for a provisional assignee set ahead of time, a **state-preserving transition (to=current state) carrying the assignee attribute** (R-T5/§2.4/§2.8) — and shall treat a provisional assignee identically for forecasting.
   - 和訳: システムはノードの単一被割当者を、ライフサイクル `transition` の属性——作業開始（active 状態への）遷移、または事前設定の暫定被割当者では**状態を保つ遷移（to=現状態）に載せた assignee 属性**（R-T5/§2.4/§2.8）——として読み取り、暫定被割当者も予測のため同一に扱わなければならない。
2. When multiple assignee namings exist on a node, the system shall use the `(ts,id)` latest-wins assignee as the current one for leveling, treating naming as replacement rather than addition.
   - 和訳: ノードに複数の被割当者名指しが存在するとき、システムは平準化のため `(ts,id)` latest-wins の被割当者を現行として用い、名指しを追加でなく置換として扱わなければならない。

### Requirement 10: プロジェクト導出完了 D_pred とスケジュール・バッファ（R-T6）

**Objective:** health/リスケ skill 作者として、二参照日付（期日・目標日）と生きた予測の導出完了からスケジュール・バッファ残量/消費率を得たい。それにより核心会計を一切調整せずに超過前の監視ができる。

#### Acceptance Criteria

1. The system shall derive the project derived completion D_pred from the live forecast as the predicted completion of the critical-path end (the max over multiple critical-path ends).
   - 和訳: システムはプロジェクト導出完了 D_pred を、生きた予測からクリティカルパス末端の予測完了（複数末端なら max）として導出しなければならない。
2. The system shall consume the project deadline (an externally imposed hard ceiling) and target date (the human-managed planned-completion reference) as second-tier configuration inputs and shall re-derive the buffer on their change.
   - 和訳: システムはプロジェクトの期日（外部から課される硬い上限）と目標日（人間が管理する計画完了の参照点）を第二層の構成入力として消費し、その変更時にバッファを再導出しなければならない。
3. The system shall derive schedule buffer remaining = max(0, deadline − D_pred) and buffer consumption = clamp₀¹((D_pred − target)/(deadline − target)), depending the remaining only on the deadline and D_pred (not on the target).
   - 和訳: システムはスケジュール・バッファ残量 = max(0, 期日 − D_pred) とバッファ消費率 = clamp₀¹((D_pred − 目標日)/(期日 − 目標日)) を導出し、残量を期日と D_pred のみ（目標日には依らない）に依存させなければならない。
4. The system shall derive the buffer de-rated while schedule coverage is low and pair it with schedule coverage for reading (the buffer de-rate is owned by this spec as R-T6 — distinct from the SPI de-rate, which is owned/applied by moira-evm/health; what this spec emits is the de-rated buffer data plus the paired schedule-coverage denominator, while the visual presentation, e.g. CCPM fever chart, is consumed by moira-surface-health), and shall not adjust any core derivation (EV/SPI/CPI/PV/schedule) by the deadline or target date — they parameterize only this buffer overlay.
   - 和訳: システムはスケジュール・カバレッジが低い間はバッファを de-rate して導出し、対読みのためスケジュール・カバレッジと対で提示しなければならない（バッファの de-rate は本 spec が R-T6 として所有する——SPI の de-rate（moira-evm／health が所有・適用）とは別である。本 spec が出すのは de-rate 済バッファデータと対読み母数のスケジュール・カバレッジであり、視覚的提示〔CCPM フィーバー等〕は moira-surface-health が消費する）。また、期日・目標日で核心導出（EV/SPI/CPI/PV/スケジュール）を一切調整してはならない——これらはこのバッファ・オーバーレイのみを画定する。
5. The system shall treat the buffer as a live-forecast quantity that moves with D_pred (on supersede/re-estimate/c change), not as a frozen baseline.
   - 和訳: システムはバッファを、D_pred とともに動く（supersede・再見積・c 変更で）生きた予測側の量として扱い、凍結ベースラインとしては扱わないでなければならない。

### Requirement 11: スケジュール・バッファの境界条件（R-T6 境界条件）

**Objective:** read サーフェス作者として、期日・目標日・D_pred の有無に応じたバッファの境界条件を一意に得たい。それにより N/A・算出不能・構成エラーを偽の値で潰さず正直に提示できる。

#### Acceptance Criteria

1. Where a target date is absent, the system shall compute buffer remaining (= slack to deadline) but report consumption as N/A.
   - 和訳: 目標日がない場合、システムはバッファ残量（= 対期日スラック）を算出し、消費率を N/A として報告しなければならない。
2. Where a deadline is absent, the system shall report the buffer as undefined and shall keep deadline-overrun detection (R-T4) silent.
   - 和訳: 期日がない場合、システムはバッファを未定義として報告し、期日超過検出（R-T4）を発火させないでおかなければならない。
3. Where the target date equals the deadline, the system shall report consumption as N/A (zero denominator) and report the remaining only.
   - 和訳: 目標日が期日と等しい場合、システムは消費率を N/A（分母 0）として報告し、残量のみを報告しなければならない。
4. If the target date is later than the deadline, then the system shall raise a configuration-error warning rather than auto-rejecting the input, and report the buffer as N/A.
   - 和訳: 目標日が期日より後の場合、システムは入力を自動拒否せず構成エラー警告を発し、バッファを N/A として報告しなければならない。
5. Where D_pred does not exist (schedule coverage = 0), the system shall report buffer remaining as uncomputable and surface it as a visible gap rather than potting it to a value.
   - 和訳: D_pred が存在しない（スケジュール・カバレッジ = 0）場合、システムはバッファ残量を算出不能として報告し、値に潰さず可視ギャップとして提示しなければならない。

### Requirement 12: 凍結ベースラインと生きた予測の分離（§3/P8）

**Objective:** evm/health/surface 作者として、PV/SPI 用の凍結ベースラインと、割当・期日用の生きた予測スケジュールを別物として読みたい。それにより暫定割当変更や supersede がベースラインを動かさないことを保証できる。

#### Acceptance Criteria

1. The system shall treat the frozen baseline (the source for PV, from which SPI is computed by moira-evm) and the live forecast schedule (recomputed incrementally for assignment/deadline) as distinct, mirroring the PMB-vs-EAC separation.
   - 和訳: システムは凍結ベースライン（PV の源；SPI は moira-evm がこれから算出する）と生きた予測スケジュール（割当・期日用に増分再計算）を別物として扱い、PMB と EAC/forecast の分離を写さなければならない。
2. The system shall never recompute or overwrite the frozen baseline slot during any forecasting/derivation (this is the single inviolability owned here; a provisional-reassignment or a supersede moves only the live forecast, not the frozen baseline slot).
   - 和訳: システムはいかなる予測導出中も凍結ベースライン・スロットを再計算・上書きしてはならない（不可侵はここに一本化して所有する;暫定割当変更や supersede では生きた予測のみを動かし、凍結ベースライン・スロットは動かさない）。
3. The system shall keep frozen-slot selection implementation-dependent and reproducible only for the same log under the same leveling implementation, addressing the non-determinism (P8) by disclosure rather than removal.
   - 和訳: システムは凍結スロットの選定を実装依存とし、同一ログ・同一平準化実装に対してのみ再現可能とし、非決定性（P8）を除去でなく開示で扱わなければならない。

### Requirement 13: 作業の予定/実績 開始・終了の per-node 導出（§2.5/§3・lifecycle transition 時刻）

**Objective:** read サーフェス作者として、各サブ単位の作業詳細を読むために、予定終了（凍結スロット）に加えて **予定開始・実績開始・実績終了** を per-node 導出として得たい。それにより作業詳細（Inspector）が、予定（ベースライン）と実績（lifecycle 進行）の開始・終了を対で読める。

> **新設の根拠（参照実装 `DerivedState` に未存在）:** 現行の read 契約 `moira/backend/src/types.ts` の `ForecastRow` は `predictedCompletion`（生きた予測完了）と `frozenSlot`（凍結ベースライン完了スロット＝予定終了）の二項のみを公開し、**実績開始/終了・予定開始を供給する read 口が存在しない**。MODEL は完了スロット（予定終了）のみを凍結記録し（§3②）、開始日を一級の凍結属性としては持たない——したがって本要件が要求するのは、(a) 実績開始/終了を lifecycle `transition` の時刻から、(b) 予定開始を予定終了−所要から **per-node に導出する read データ**の新設であり、いずれも提示層のための導出（MODEL の構造を変えず・新イベント/新凍結属性を足さない）である。基準完了日（frozenSlot）は既存（Req2/Req12 が所有）。

#### Acceptance Criteria

1. The system shall derive each sub-unit's actual start date from the timestamp of its lifecycle `transition` into `implementing` (`→implementing`) and its actual completion date from the timestamp of its `transition` into `implemented` (`→implemented`), reading these timestamps from the append-only log (via `moira-core`) and never inventing a new event or frozen attribute for them.
   - 和訳: システムは各サブ単位の**実績開始日**を、その lifecycle `transition`（`→implementing`）の時刻から、**実績終了日**を `transition`（`→implemented`）の時刻から導出し、これらの時刻を追記専用ログ（`moira-core` 経由）から読み取り、そのために新イベントや新たな凍結属性を作り出してはならない。
2. The system shall derive each scheduled sub-unit's planned start date as its planned completion (the frozen baseline slot `frozenSlot`; MODEL §3②) minus its duration (derived from the latest estimate under capacity), keeping the frozen baseline slot itself as the canonical planned-completion record and treating the planned start as a derived read only (the MODEL freezes only the completion slot, not a start date).
   - 和訳: システムは各スケジュール済みサブ単位の**予定開始日**を、その予定終了（凍結ベースライン・スロット `frozenSlot`；MODEL §3②）から所要（容量下の最新見積から導出）を引いて導出し、凍結ベースライン・スロットそのものを予定完了の正本記録として保ち、予定開始は導出 read としてのみ扱わなければならない（MODEL は完了スロットのみを凍結し開始日を持たない）。
3. The system shall surface the planned-start / actual-start / actual-completion reads as per-node derived data alongside the existing `ForecastRow` (predicted completion + frozen slot), so a read surface can compose the work-detail dates without re-deriving them; where a sub-unit has not yet reached `implementing` (or `implemented`), the corresponding actual date shall be absent (an honest empty), not fabricated.
   - 和訳: システムは、予定開始/実績開始/実績終了の read を、既存の `ForecastRow`（予測完了＋凍結スロット）と並ぶ per-node 導出データとして提示し、read サーフェスがそれらを再導出せずに作業詳細の日付を合成できるようにしなければならない。サブ単位がまだ `implementing`（または `implemented`）に達していない場合、対応する実績日付は（捏造せず）欠落（honest empty）としなければならない。
4. The system shall derive these dates from the lifecycle state and timestamps (log-deterministic) and from the frozen slot, and shall not recompute or move the frozen baseline slot in the process (the frozen-baseline inviolability of Req12 AC2 is preserved).
   - 和訳: システムはこれらの日付を lifecycle 状態と時刻（ログから決定的）および凍結スロットから導出し、その過程で凍結ベースライン・スロットを再計算・移動してはならない（Req12 AC2 の凍結ベースライン不可侵を保つ）。

### Requirement 14: レビュー担当 reviewer の per-node 併置とレビュー待ちキューの不変性（R-T5/§2.4・P4・§7#18）

**Objective:** read サーフェス/decision 作者として、人間レビュー待ちキュー（`implemented` の有効葉・actor 非依存）を読むのと並んで、各ノードの **指名レビュー担当 `reviewer`** を per-node 属性として得たい。それにより surface が「誰がレビューするか」を表示し、提示層で『特定のレビュー担当の分だけ』に絞り込める（per-node `reviewer` を選んだ担当と突き合わせる；視点 actor/『自分』概念を要さない＝MODEL §7#18(f)）。ただしキュー導出そのものは actor 非依存のまま不変で、reviewer は平準化（P7）に**入らない**。

> **境界の明示（v19 reviewer の落とし込み）:** reviewer は `moira-core` の fold（`ProjectedNode.reviewer`・latest-wins）が供給する per-node 属性であり（Req6/moira-core）、本 spec はそれを **時間軸の read（キュー/forecast）に併置して公開する**だけで reviewer 自体を再計算しない（UI-ARCH §6 二系統計算の禁止）。`humanReviewQueue` の導出（Req4 AC3＝`implemented` の有効葉・actor 非依存）は **不変**であり、reviewer 指名の有無で母集合が変わらない——reviewer は per-node 属性として併置されるのみで、『特定のレビュー担当の分だけ』の絞り込みは per-node `reviewer` を選んで突き合わせる提示層フィルタに委ねる（視点 actor/『自分』概念を要さない＝MODEL §7#18(f)；`moira-surface-schedule` 所管）。reviewer は **leveler（P7）・EV/PV/coverage・未割当バックログを一切動かさない**（§7#18(b)；参照実装 `leveler.ts` は reviewer を参照しない）。

#### Acceptance Criteria

1. The system shall surface each node's designated `reviewer` (the human to perform `implemented→accepted`) as a per-node attribute read supplied by `moira-core`'s fold (latest-wins), placing it alongside the human review queue and forecast reads, without re-deriving the reviewer in this spec.
   - 和訳: システムは各ノードの指名 `reviewer`（`implemented→accepted` を行う人間）を、`moira-core` の fold が供給する per-node 属性 read（latest-wins）として、人間レビュー待ちキュー・予測 read と並べて提示し、本 spec で reviewer を再導出してはならない。
2. The system shall keep the `humanReviewQueue` derivation actor-independent and unchanged (the agreed effective leaves at `implemented`, Req4 AC3) regardless of whether a reviewer is designated — a designated reviewer shall not narrow or widen the queue membership; the reviewer is co-located as a per-node attribute only, leaving any narrowing to a presentation-layer filter that selects on the per-node `reviewer` attribute (no viewpoint-actor/"self" concept; MODEL §7#18(f)).
   - 和訳: システムは `humanReviewQueue` の導出を、reviewer の指名有無に依らず actor 非依存・不変（`implemented` の合意済み有効葉＝Req4 AC3）に保たなければならない——指名 reviewer はキューの母集合を狭めも広げもしない。reviewer は per-node 属性として併置されるのみで、『特定のレビュー担当の分だけ』の絞り込みは per-node `reviewer` 属性を選んで突き合わせる提示層フィルタに委ねる（視点 actor を要さない＝MODEL §7#18(f)）。
3. The system shall keep the reviewer **attribute** out of c(i,d) leveling (P7) and out of every schedule derivation (forecast, D_pred, schedule coverage, stale-slot, over-allocation, buffer) — the reviewer *designation* consumes no capacity and rate-limits no path — because the reviewer attribute carries no estimate (the `implemented→accepted` review is a lifecycle step, not an estimated work unit); only the assignee (Req9/R-T5) is consumed by leveling. (Review *work* itself, if substantial, MAY be nodized as a normal A1 work node that earns EV and is leveled via that node's OWN assignee — a separate concern from this non-interfering reviewer attribute; PR-ASSIGNEE-REVIEWER / §7#18(b).)
   - 和訳: システムは reviewer **属性**を c(i,d) 平準化（P7）から外し、あらゆるスケジュール導出（予測・D_pred・スケジュールカバレッジ・スロット陳腐化・過負荷・バッファ）からも外さなければならない——reviewer の**指名**は容量を消費せず、いかなるパスも律速しない——reviewer 属性は見積を持たない（`implemented→accepted` レビューは見積を持つ作業単位ではなく lifecycle ステップ）からである。平準化が消費するのは被割当者（Req9/R-T5）のみである。（レビュー**作業そのもの**は、相応に重ければ A1 の通常作業ノードとして立て、その**ノード自身の assignee** を通じて EV を獲得し平準化に参加しうる——これは非干渉な reviewer 属性とは別の論点；PR-ASSIGNEE-REVIEWER／§7#18(b)。）
4. Where a node reaches `implemented` with no designated reviewer, the system shall still include it in the (unchanged) human review queue while surfacing the reviewer as absent (an "undesignated" visible gap, P0), and shall not fabricate a reviewer.
   - 和訳: ノードが reviewer 未指名のまま `implemented` に達した場合、システムはそれを（不変の）人間レビュー待ちキューになお含めつつ、reviewer を未指名（『未指名』の可視ギャップ、P0）として提示し、reviewer を捏造してはならない。
