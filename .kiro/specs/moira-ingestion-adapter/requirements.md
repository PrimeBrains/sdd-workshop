# Requirements Document

## Introduction

`moira-ingestion-adapter` は Moira 正典モデル `moira/MODEL.md`(v16, 凍結) を本番アーキテクチャへ落とす **CQRS 分解の Wave1**（依存 = `moira-core`）であり、**仕様方法論の段階的成果物（抽象 spec-unit）→ ノード候補＋見積提案**への **read-only 正規化（producer）**を所有する spec である。具体的には次を所有する:

1. **方法論非依存の入力境界** — cc-sdd 等の固有語彙を内部マッピングに閉じ込め、抽象 spec-unit（成果物を段階的に作成し人間が承認していく構造化された開発プロセスの成果物；§2.3 の操作的定義／0c）を入力に取る。
2. **ノード候補の正規化** — フェーズ成果物を §2.6 の「フェーズ＝feature の子ノード」へ写し、木の所属・DAG の論理依存・lifecycle 初期状態を **候補**として提示する。A1 射程（0a）に従い運用/バグ/ad-hoc 作業も feature ノード候補とする。
3. **見積提案の正規化** — §2.3 の一様な見積の入力連鎖（est(req)→req→est(design)→design→est(tasks)→tasks→est(impl)→impl群）に従い、前段成果物を入力に `proposed` の見積提案を産む（R-E1/E1b/E2 の入力。est(impl) は tasks ノードと別個＝R-E1b）。
4. **read-only 性** — 本 spec は 4 イベントを一切 emit せず、ログ・ノード状態・第二層を mutate しない。出力は「候補と提案」であって正本ではない（emit/合意確定は write skill `moira-spec-ingest`/`moira-estimate-agree` の責務）。

本 spec は MODEL を唯一の真実源（SSOT）とし、MODEL の文言を変えず・新概念を足さず、その実装落とし込み（spec-unit 正規化）に徹する。`moira-core` が所有する契約概念（emit/derive・二層データ・effective-set・latest-wins・状態機械・凍結記録）は **消費**し、再定義しない——本 spec はそれらの語彙でノード候補/見積提案の **構造**を表すのみで、正本化（emit）は write skill に委ねる。

## Boundary Context

- **In scope（ingestion-adapter が所有）**: 抽象 spec-unit 入力境界と cc-sdd → 抽象の内部マッピング（参照例）、フェーズ成果物 → ノード候補（木所属・DAG 論理依存・lifecycle 初期状態の提案）の正規化、一様見積連鎖（§2.3）に沿った `proposed` 見積提案の産出（R-E1/E1b/E2 の入力）、est(impl) を tasks と別個ノード候補として扱う提案（R-E1b）、A1 射程（0a）に従う非 spec 作業単位（運用/バグ/ad-hoc）の feature ノード候補化、正規化の決定性と read-only 性（emit せず・ログ/状態/第二層を mutate しない）。
- **Out of scope（上流/下流が所有）**: イベント型・lifecycle/見積合意 状態機械・effective-set・latest-wins・二層データ・凍結記録の **定義** = `moira-core`（消費）、4 イベントの **emit** と取り込みの正本化 = `moira-spec-ingest` skill、見積の **合意確定**（`proposed→agreed`・人間承認）= `moira-estimate-agree` skill、分解の深さ・ノード化/畳むの **確定**（人間のコミット判断 P0）= 人間＋write skill、EV/被覆/PV 等の **導出** = `moira-evm`/`moira-schedule`/`moira-health`、ノード状態の正本（現行 lifecycle 状態）= core の fold、永続化・UI。
- **consumer 側ガードレール（core 契約の再掲＝越境でない）**: core と概念が重なる要件——A1 射程に従う分類（R5；分類の **定義** は core R1）・read-only 性（R6；read-only の **定義** は core R2）・初期 lifecycle 状態（R2.AC4；状態機械の **定義** は core §2.5）・決定的マージ非付与（R7.AC3；I3 は発行時 core）——は、core が **定義**する契約を本 producer 側で **再掲したガードレール**であって責務の越境ではない。本 spec はこれらを **消費**し（再定義せず）、producer 固有の falsifiable 制約（候補/提案であり正本でない・呼出可能な write シームを持たない・同一入力→同一出力）に集約する。各要件の > トレース注が定義の所有先（consumed `moira-core/*`）を明示する。
- **Adjacent expectations**: 本 spec が **産む**ノード候補/見積提案は、core が **定義**する語彙（4 イベントの decompose/transition で表現可能な木・DAG・lifecycle・見積状態）に整合させ、下流の write skill（spec-ingest/estimate-agree/decompose-author）が候補/提案を入力に emit する。本 spec の出力構造の形が変われば下流 write skill が再検証を要する（producer→consumer 契約）。R-E2 の分担: ingestion-adapter は見積値・合意対象の **構造／候補の正規化**（候補 `decompose` 入力の値・候補 `transition` の対象＝記録形）を所有し、その値の実 emit（`decompose` 発行・見積合意機械 `transition` 発行）は `moira-spec-ingest`/`moira-estimate-agree` skill が所有する（R-E2 line 283 の二節を producer/consumer に分担）。
- **独立 read spec として凍結（吸収条件は不成立）**: 本 adapter は独立した read-only producer として凍結する。roadmap 注（roadmap.md line 106）の「0c が単一ソース確定なら spec-ingest skill へ吸収」という吸収条件は **満たさない**——0c（方法論非依存化）は cc-sdd を参照例に閉じつつ抽象 spec-unit を入力境界に取る方法論非依存の正規化であり、**多ソースを許す**（単一ソース確定ではない；R1）。したがって「単一ソース確定」という吸収の前提が成立せず、本 spec は spec-ingest skill とは別の read-only 正規化責務として独立存続する。吸収可能性の条件付き記述は roadmap の注に留め、本 spec ではこれ以上 fork として残さない。

## Requirements

### Requirement 1: 方法論非依存の spec-unit 入力境界（§2.3 仕様方法論 / 0c）

**Objective:** producer 設計者として、特定方法論に縛られない抽象 spec-unit を入力境界に取りたい。それにより cc-sdd 固有語彙が emit 経路や下流へ漏れず、他方法論も同じ正規化に写像できる構造を提供できる。

> トレース注: cc-sdd は本モデルが具体的に検証した参照例であり、他方法論（Scrum・ウォーターフォール等）への一般化は MODEL §2.3 line 94 が「意図はするが網羅検証は主張しない（P2 と同型の正直化）」と hedge する。本要件はその hedge を継承し、他方法論に対しては「同一正規化への写像可能な構造を提供する」までを要件化し、「必ず同一正規化に乗る」という網羅主張へ昇格させない。

#### Acceptance Criteria

1. The system shall accept, as its input boundary, an abstract spec-unit — the deliverables of a structured development process that incrementally produces artifacts approved by humans — without depending on any particular spec methodology.
   - 和訳: システムは、特定の仕様方法論に依存せず、成果物を段階的に作成し人間が承認していく構造化された開発プロセスの成果物である抽象 spec-unit を入力境界として受理しなければならない。
2. Where the spec-unit originates from cc-sdd, the system shall map its methodology-specific vocabulary to the abstract spec-unit internally and shall not leak cc-sdd-specific terms into its output, treating cc-sdd as a reference example.
   - 和訳: spec-unit が cc-sdd 由来の場合、システムはその方法論固有の語彙を内部で抽象 spec-unit へ写し、cc-sdd 固有の語を出力へ漏らしてはならず、cc-sdd を参照例として扱わなければならない。
3. The system shall provide a normalization that maps a methodology's deliverable-approval gate to a node-level agreement target (§2.2), so that other methodologies (e.g. Scrum, waterfall) can be mapped through the same normalization without methodology-specific branches in the output — cc-sdd being the validated reference example and other-methodology generalization being intended but not exhaustively claimed (§2.3 line 94's hedge inherited).
   - 和訳: システムは、ある方法論の成果物承認ゲートをノード単位の合意対象（§2.2）へ写す正規化を提供し、他方法論（Scrum・ウォーターフォール等）が出力に方法論固有の分岐なく同一の正規化へ写像可能であるようにしなければならない——cc-sdd を検証済みの参照例とし、他方法論への一般化は意図するが網羅的には主張しない（§2.3 line 94 の hedge を継承する）。

### Requirement 2: フェーズ成果物 → ノード候補の正規化（§2.6 / R-E2 の記録形）

**Objective:** producer 設計者として、フェーズ成果物を「フェーズ＝feature の子ノード」へ正規化したい。それにより仕様作業がそのままノード（後に EV に乗る）として下流に渡る。

#### Acceptance Criteria

1. When a spec-unit carries phase deliverables, the system shall normalize each phase into a candidate feature child node (e.g. req / design / tasks) under the feature, representing tree membership distinctly from the logical-dependency DAG.
   - 和訳: spec-unit がフェーズ成果物を持つとき、システムは各フェーズを feature 配下の候補 feature 子ノード（例: req / design / tasks）へ正規化し、木の所属を論理依存 DAG とは区別して表現しなければならない。
2. The system shall propose the logical-dependency edges among phase nodes (req → design → tasks, and design → implementation tasks) as DAG candidates, without conflating tree membership with logical dependency.
   - 和訳: システムは、フェーズノード間の論理依存辺（req → design → tasks、および design → 実装タスク）を DAG 候補として提案し、木の所属と論理依存を混同してはならない。
3. The system shall propose, as candidate decompose inputs, the two-stage decomposition structure — a feature spawning phase nodes, and the feature spawning implementation tasks upon the tasks node's completion — representing the subject (feature) and the trigger (tasks completion) distinctly, and shall set the subject of the second decompose to the feature (not the tasks node), so that implementation tasks are siblings of the tasks node under the feature rather than its children (§2.6 line 126: the tasks node represents decomposition work and is not the parent of implementation tasks).
   - 和訳: システムは、二段 decompose の構造——feature がフェーズノードを生むこと、および tasks ノード完了を契機に feature が実装タスク群を生むこと——を候補 decompose 入力として提案し、主語（feature）と契機（tasks 完了）を区別して表現しなければならず、第二 decompose の主語を（tasks ノードではなく）feature とすることで、実装タスク群を tasks ノードの子ではなく feature 配下の兄弟として置かなければならない（§2.6 line 126: tasks ノードは分解作業を表す兄弟であり実装タスクの親ではない）。
   > トレース注: 本 AC は R2.AC1/AC2（フェーズ子ノード＋DAG 辺）および R4.AC2（tasks 完了契機の実装タスク誕生）と重複しない。AC1/AC2/R4.AC2 が捉えない固有の制約は、第二 decompose の**主語が feature であって tasks ノードではない**という反パターン排除（実装タスクを tasks ノードの子に吊るす誤りの禁止）であり、MODEL §2.6 line 126 の「主語と契機の区別」をこの read 要件に接地させる。
4. The system shall propose each candidate node's initial lifecycle state per the single lifecycle state machine defined by `moira-core` (§2.5), without redefining that state machine.
   - 和訳: システムは、各候補ノードの初期 lifecycle 状態を `moira-core` が定義する単一 lifecycle 状態機械（§2.5）に従って提案し、その状態機械を再定義してはならない。

### Requirement 3: 一様な見積の入力連鎖に沿った見積提案（§2.3 / R-E1 / R-E2）

> トレース注: ヘッダの `R-E1`・`R-E2` はいずれも **所有ではなく接地/入力**を指す（roadmap line 119: R-E1/E1b/E2 は ingestion-adapter+spec-ingest の共有）。本 spec が所有するのは、(a) R-E1 の入力連鎖（§2.3）を **candidate node** として表す read 側の写像（R3.AC1 — MODEL R-E1 line 277 の「node を表現」を read-only producer ゆえ候補ノードへ縮約）と、(b) R-E2 のうち**記録形**（見積提案を候補 `decompose` 入力の値として構造化する=R3.AC4）のみ。R-E1/R-E2 の **emit**（`decompose`/`transition` 発行・合意確定）は下流 write skill `moira-spec-ingest`/`moira-estimate-agree` の責務であり、本 spec は emit しない。Introduction#3 の「R-E1/E1b/E2 の入力」もこの接地（所有でなく入力連鎖の read 写像）と一致する。

**Objective:** producer 設計者として、前段成果物を入力に見積を `proposed` 提案として産みたい。それにより見積という一様な営みが、合意前の提案として下流に渡る。

#### Acceptance Criteria

1. When any work phase (req, design, tasks, implementation) requires an estimate, the system shall represent the estimation as a candidate node taking the prior phase's artifact as input, and shall propose the est-precedes-phase precedence edge (est(phase) → phase) — a DAG edge class distinct from the phase-to-phase logical-dependency edges owned by R2.AC2 (req → design → tasks, design → implementation).
   - 和訳: 任意の作業フェーズ（req・design・tasks・実装）が見積を要するとき、システムはその見積を、前段フェーズの成果物を入力とする候補ノードとして表現し、見積がフェーズに先行する先行辺（est(phase) → phase）を提案しなければならない。これは R2.AC2 が所有するフェーズ間論理依存辺（req → design → tasks、design → 実装）とは別クラスの DAG 辺である。
   > トレース注: 本 AC が所有する DAG 辺は **est ノード → phase の先行辺**（MODEL R-E1 line 277「the estimation as a node preceding that phase via a DAG edge」）であり、R2.AC2 が所有する **phase → phase の論理依存辺**とは辺クラスが異なる。両者は同一機構の二重記述ではなく、est→phase 辺は R3、phase→phase 辺は R2 が一意に所有する。
2. The system shall take a project-external given (such as roadmap or brief) as the input for the first estimation (est(req)), grounding the input regress in an external given.
   - 和訳: システムは、最初の見積（est(req)）の入力として roadmap や brief 等のプロジェクト外部の所与を取り、入力の後退を外部所与に接地させなければならない。
3. The system shall produce each estimation result as a `proposed` estimate proposal regardless of its source, and shall not transition any estimate to `agreed`.
   - 和訳: システムは、各見積結果を出所を問わず `proposed` の見積提案として産出し、いかなる見積も `agreed` へ遷移させてはならない。
4. The system shall represent each estimate proposal as the value of a candidate `decompose` input (per R-E2's recording shape), leaving the actual `decompose`/`transition` emission to a downstream write skill.
   - 和訳: システムは、各見積提案を候補 `decompose` 入力の値として（R-E2 の記録形に沿って）表現し、実際の `decompose`/`transition` 発行は下流 write skill に委ねなければならない。

### Requirement 4: 実装見積は tasks と別個ノード（R-E1b）

**Objective:** producer 設計者として、実装見積を tasks ノードとは別個の、tasks.md を入力とする見積ノード候補として扱いたい。それにより実装見積が decompose に内包されず一様性が保たれる。

#### Acceptance Criteria

1. The system shall treat the implementation estimate as a candidate node distinct from both the tasks node and any decompose candidate, taking tasks.md as input, so that the implementation estimate is not folded into a decompose (R-E1b) and the tasks-decomposition work and the implementation-estimation work remain separate candidate nodes.
   - 和訳: システムは、実装見積を、tasks ノードとも、いかなる decompose 候補とも別個の、tasks.md を入力とする候補ノードとして扱い、実装見積を decompose に内包させず（R-E1b）、タスク分解という作業と実装を見積もる作業を別個の候補ノードとして保たなければならない。
2. When the tasks node would complete, the system shall propose the implementation task nodes as born without an estimate, and propose a separate est(impl) node whose agreement (by a human, downstream) recovers coverage.
   - 和訳: tasks ノードが完了する局面で、システムは実装タスク群を未見積で誕生する候補として提案し、その合意（下流で人間が行う）がカバレッジを回復する別個の est(impl) ノードを提案しなければならない。

### Requirement 5: A1 射程に従う非 spec 作業単位の候補化（A1 射程消費 / 0a）

> トレース注: 「何が feature ノードか／何がノードでないか」という分類規則（A1 射程・§5 isBuffer 却下）の **定義**は `moira-core` R1 が所有する（roadmap line 102: core が A1 を landing）。本 spec はその分類を **消費**し、非 spec 作業単位（運用/バグ/ad-hoc）をその分類に従って候補化するのみで、分類規則を再定義しない（Introduction の「core 契約を消費し再定義しない」規律）。0a は core と本 spec の双方をブロックするが、A1 の所有先は core であり、本 spec は消費側。

**Objective:** producer 設計者として、運用タスク・バグ修正・ad-hoc 作業も core が定義する feature ノード分類に従って候補化したい。それにより遂行され出来高を生むあらゆる作業単位が、core の分類のまま同一ログ・導出・ライフサイクルに乗る候補となる。

#### Acceptance Criteria

1. The system shall classify ops tasks, bug fixes, and ad-hoc work units per the feature-node scope defined by `moira-core` (A1) and propose them as candidate feature nodes on the same log, derivations, and lifecycle, without redefining that scope.
   - 和訳: システムは、運用タスク・バグ修正・ad-hoc 作業単位を `moira-core` が定義する feature ノード射程（A1）に従って分類し、同一ログ・導出・ライフサイクルに乗る候補 feature ノードとして提案しなければならず、その射程を再定義してはならない。
2. Where a work unit omits the full phase cycle (§2.6 phase child-node expansion), the system shall propose it accordingly while still applying the single lifecycle state machine (§2.5) unchanged, treating the omission as decomposition depth — a human commitment (§2.1#4 / P0) — not a lifecycle-state omission.
   - 和訳: 作業単位がフル・フェーズ周期（§2.6 のフェーズ子ノード展開）を省略する場合、システムはそれに応じた候補を提案しつつ単一 lifecycle 状態機械（§2.5）はそのまま適用し、省略を分解の深さ——人間のコミット判断（§2.1#4 / P0）——として扱い、lifecycle 状態の省略として扱ってはならない。
3. The system shall, following `moira-core`'s isBuffer rejection (core R1.AC2: a buffer is a derived accounting quantity, not a node), not propose a buffer or any such derived quantity as a node candidate.
   - 和訳: システムは、`moira-core` の isBuffer 却下（core R1.AC2: バッファは導出される会計量でありノードではない）に従い、バッファその他の導出量をノード候補として提案してはならない。

### Requirement 6: read-only producer（出力は候補・提案であって正本でない）

> トレース注: 「読み出しはログ・保存状態を一切 mutate しない／emit/append が唯一の書き込み口」という **write 禁止規則**の定義は `moira-core` R2（AC1/AC4）が所有する（roadmap line 56「検出=読／解消=書 の分離」の一般原則）。本 spec が read spec（producer）であることは Introduction#4・Boundary Context で宣言済みであり、本要件は重複を避け、producer 固有の falsifiable な制約——出力が候補/提案であって正本でないこと——に集約する。read-only 性そのものは AC1 で core R2 への準拠ガードレールとして接地する。

**Objective:** アーキテクト として、ingestion を読み取り専用の producer に閉じ込めたい。それにより取り込み正規化（読み）と 4 イベント発行（書き）の責務が分離され、追記専用の単一書き込み口（core）が保たれる。

#### Acceptance Criteria

1. The system's normalization output artifact (node candidates and estimate proposals) shall expose no callable write seam — invoking none of `moira-core`'s emit/append, capacity-write, or config-write operations — so that the producer is structurally incapable of emitting any of the four events or writing the append-only log, node state, or the second data tier (c, deadline, target date); the definition of read-only-ness itself (emit/append as the only write path; reads never mutate) is owned by `moira-core` R2 (R2.AC1/R2.AC4) and consumed here, not restated.
   - 和訳: システムの正規化出力 artifact（ノード候補・見積提案）は呼出可能な書き込みシームを一切持たず——`moira-core` の emit/append・capacity-write・config-write 操作のいずれも呼び出さず——producer が 4 イベントの emit も、追記専用ログ・ノード状態・第二データ層（c・期日・目標日）への書き込みも構造的に不能でなければならない。read-only 性そのものの定義（emit/append が唯一の書き込み口・読み出しは mutate しない）は `moira-core` R2（R2.AC1/R2.AC4）が所有し、本要件はそれを消費し再述しない。
2. The system shall treat its output as candidates and proposals, not as the source of truth, leaving normalization results un-canonical until a downstream write skill emits events and a human agrees.
   - 和訳: システムは自らの出力を真実源ではなく候補・提案として扱い、下流 write skill がイベントを emit し人間が合意するまで、正規化結果を正本化しないでおかなければならない。

### Requirement 7: 正規化の決定性と core 契約の消費（I3 消費 / 二層データ消費）

**Objective:** producer 設計者として、同一 spec-unit から同一の候補/提案を産み、core が定義する語彙を消費（再定義しない）したい。それにより下流が決定的な入力を受け、契約が一箇所（core）に集約される。

#### Acceptance Criteria

1. The system shall produce the same node candidates and estimate proposals from the same spec-unit input under the same implementation, the normalization being a deterministic read (a producer design guarantee — same input → same output — distinct from `moira-core`'s emission-time `(ts,id)` merge in AC3).
   - 和訳: システムは、同一 spec-unit 入力から同一実装の下で同一のノード候補と見積提案を産出し、正規化を決定的な読み出しとしなければならない（これは producer の設計上の保証=同一入力→同一出力であり、AC3 の `moira-core` 発行時 `(ts,id)` マージとは別概念）。
   > トレース注: 本 AC の「決定的読み」は MODEL I3（line 152, `(ts,id)` 決定的マージ=発行時）とは別概念であり、それは AC3 が core へ委ねる。MODEL は導出の一部（P8 平準化・§3 凍結スロット）を非決定的と認めるが、それらは本 spec の責務外（schedule 系の導出）であり、本 AC が断定する決定性は read-only producer が emit を伴わず再計算もしない（純導出）という設計判断に接地する。MODEL の文言を変えず・新概念を足さない（Introduction）規律の下、当該性質を MODEL 由来の不変条件としてではなく producer 設計保証として明示する。
2. The system shall express node candidates and estimate proposals in the vocabulary defined by `moira-core` (event types, lifecycle/estimate-agreement state machines, tree/DAG, estimate `proposed`/`agreed` state) and shall not redefine any of those concepts.
   - 和訳: システムはノード候補と見積提案を `moira-core` が定義する語彙（イベント型・lifecycle/見積合意 状態機械・木/DAG・見積 `proposed`/`agreed` 状態）で表現し、これらの概念を再定義してはならない。
3. The system shall not assign event ids or `(ts,id)` ordering to its candidates, leaving deterministic merge (I3) to `moira-core` at emission time.
   - 和訳: システムは候補に event id や `(ts,id)` 順序を付与してはならず、決定的マージ（I3）を発行時の `moira-core` に委ねなければならない。

## MODEL Traceability

各 AC（要件 ID `<Req番号>.<AC番号>`）の MODEL（SSOT）出所。見出し括弧・散文の「> トレース注」に依存せず、下流 design.md の Requirements Traceability と検証ツールが `<Req.AC> ↔ MODEL R-*/§/A/P/I` を機械照合するための正典対応表。MODEL 記号（R-*/§/A/P/I）は SSOT への参照であり、trace-notation の要件 ID ref-list（spec 間参照）とは別系統。本 spec は read-only producer ゆえ、MODEL の emit/合意/確定面は `moira-core` の AC を **consumed** として併記する（再定義しない；Introduction の規律）。

| AC | MODEL 出所 | 注 |
|---|---|---|
| 1.1 | A1, §2.3 | A1 射程（spec=遂行され出来高を生む作業単位）＋§2.3 「仕様方法論」の操作的定義（0c） |
| 1.2 | A1, §2.3 | cc-sdd を参照例として内部マッピングに閉じ込め（0c） |
| 1.3 | §2.3, §2.2 | §2.3 line 94 の hedge を継承（cc-sdd 検証済み・他方法論は写像可能な一般化、網羅主張せず）；承認ゲート→§2.2 ノード合意 |
| 2.1 | §2.6 | フェーズ＝feature 子ノード（木の所属）；候補化 |
| 2.2 | §2.6 | 論理依存 DAG 辺（木の所属と区別）；候補化 |
| 2.3 | §2.6 | line 126 二段 decompose の主語（feature）と契機（tasks 完了）の区別；候補化 |
| 2.4 | §2.5 | 初期 lifecycle 状態；状態機械の **定義** は consumed `moira-core/5.1`（再定義しない） |
| 3.1 | R-E1 | est ノード→phase 先行辺（line 277）を candidate node へ縮約；emit は下流 spec-ingest |
| 3.2 | §2.3, R-E1 | est(req) の入力＝roadmap/brief 等プロジェクト外部の所与（無限後退の底） |
| 3.3 | R-U3, §2.2 | 出所を問わず `proposed`；`agreed` へ遷移させない（consumed `moira-core/4.1`） |
| 3.4 | R-E2 | 見積提案を候補 `decompose` 入力の値として表現（記録形）；emission は下流 |
| 4.1 | R-E1b | 実装見積＝tasks ノード／decompose 候補と別個、tasks.md 入力、decompose 非内包（line 280） |
| 4.2 | §2.3, §2.6 | tasks 完了契機で実装タスク群が未見積誕生＋別個 est(impl)（line 102 生成順・line 126） |
| 5.1 | A1 | A1 射程（運用/バグ/ad-hoc=feature ノード）；分類の **定義** は consumed `moira-core/1.1`（0a） |
| 5.2 | A1, §2.6, §2.5, P0 | フェーズ周期省略＝分解深さ（§2.1#4/P0）であって lifecycle 状態（§2.5）の省略でない |
| 5.3 | §5 | isBuffer 却下（導出会計量はノードでない）；consumed `moira-core/1.2`（バッファ非ノード） |
| 6.1 | R-U2 | producer 固有ガードレール（呼出可能な write シームなし）；read-only 定義は consumed `moira-core/2.1`, `moira-core/2.4`（R-U2/A2） |
| 6.2 | A1, P0 | 出力は候補/提案であって正本でない（正本化＝emit/合意は下流 write skill） |
| 7.1 | §2.3, P0 | producer 設計保証（同一入力→同一出力の決定的読み）；I3 発行時マージ（line 152）とは別概念で AC 7.3 が core へ委ねる |
| 7.2 | §2.8, §2.5, §2.2 | core 定義語彙（イベント型・状態機械・木/DAG・`proposed`/`agreed`）で表現；consumed `moira-core/3.x`,`5.x`,`4.1`（再定義しない） |
| 7.3 | I3 | 候補に event id/`(ts,id)` 順序を付与しない；決定的マージ（line 152）は発行時 core（consumed `moira-core/8.1`） |
