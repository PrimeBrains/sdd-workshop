# Requirements Document

## Introduction

`moira-evm` は Moira 正典モデル `moira/MODEL.md`(v20) を本番アーキテクチャへ落とす **CQRS 分解の Wave1（読/導出側）** であり、Moira の **EVM 会計（出来高・コスト・指数・カバレッジ）の導出を一箇所に集約して所有する** spec である。基盤契約 `moira-core`（emit/derive・二層データ・effective-set・latest-wins・状態機械・凍結属性記録）を **消費**する前提で、同一ログ・同一実装から次を MODEL §3／要件群（P0–P3・R-U8/U9/U10・R-S1/S3/S4/S8・R-C2）に忠実に導出する:

1. **EV の二形** — 絶対出来高 EV_abs（完了凍結予算の総和・合意済みのみ）と達成率 EV%（= EV_abs / Σ合意済み最新見積 ∈ [0,1]）。
2. **二つの読み** — 現行進捗（現行有効集合の EV%）と累積EV（EV_abs、supersede 済みを含む過去総出来高）の区別導出（R-S5・§2.7）。
3. **カバレッジ三種の対読み** — 見積カバレッジ（P2）・スケジュールカバレッジ（R-S6, 導出は schedule・本 spec は SPI de-rate で消費）・実行カバレッジ executionCoverage（R-S8）。
4. **EVM 指数** — PV（時間配分ベースライン予算）・AC（同型集約）・SPI（= EV_abs/PV・スケジュール済み領域限定）・CPI（MODEL §3 の単一 CPI = EV_abs/AC・現行有効 basis。累積EV 基底の CPI 変種は持たない）。
5. **サンクと可視ギャップ** — sunk EV_abs（R-C2）・R-U9/P0 可視ギャップ会計・R-S4 低カバレッジ de-rate・R-S3 thrashing 検出データ。

本 spec は MODEL を唯一の真実源（SSOT）とし、指標の **定義式そのものは MODEL §3／`moira-naming.md` を正典**として再定義せず、その導出契約・規律（de-rate・三者対読み・領域非対称・可視ギャップ）を確定する。式・magic number は本書に埋め込まず、実装詳細は design 以下に置く。

## Boundary Context

- **In scope（moira-evm が所有）**: `moira-core` が供給する effective-set／basis 機構の上での EV_abs／EV%／累積EV の**値計算**（R-S5 が要求する現行進捗 vs 累積EV の区別読みを、core 供給の現行 basis・累積 basis それぞれで値計算する。basis 機構そのものは core 所有）、見積カバレッジ・実行カバレッジ(R-S8) の count-based 導出と三者対読み規律、PV／AC／SPI／CPI の導出と領域非対称・R-S4/R-S6 de-rate **データ供給**規律（提示制御は surface-* 所有）、sunk EV_abs(R-C2) の導出（累積EV とは別量；NAMING §7）、R-U9/P0 可視ギャップ会計のデータ供給（EV の見積カバレッジ・未スケジュール合意作業；可視ギャップの提示は surface-* 所有）、R-S3 thrashing 検出データ（EV_abs/AC 二項条件）、AC の単一通貨記録（R-U10）。CPI は MODEL §3 の単一 CPI（現行有効 basis）に固定し、累積EV 基底の CPI 変種は持たない（surface-health 所有）。
- **Out of scope（上流/下流が所有）**: effective-set 定義・**effective-set 機構〔supersede／cancelled 除外〕および R-S5 の現行有効集合導出規則（supersede 元 cancelled 時の旧ノード復帰判定）・累積 basis／現行 basis の basis 機構**・latest-wins・凍結属性記録機構・状態機械・二層データ・I1 整合 enforce・**R-S2 の単一導出束ね/再導出契機（イベント追記・構成入力変更）オーケストレーション** = `moira-core`（本 spec は basis 機構を消費し、その basis 上で EV の値計算のみを所有する。純関数群として束ねられ・消費される側）。平準化(P7/P8)・予測・slot 充填・D_pred・スケジュールカバレッジ導出・schedule buffer = `moira-schedule`（本 spec は SPI de-rate のため schedule coverage を消費するのみ）。cancel 意味論・orphan・restoration = `moira-scope-deps`／`moira-cancel-scope`（本 spec は sunk EV_abs を導出）。9 warning の確定/集約・行為列挙・clearance = `moira-health`（R-S3 は本 spec が検出データを出し health が警告確定）。cost イベント発行（AC 入力 write）= `moira-cost-log` skill。全 read サーフェスの提示 host = `moira-surface-*`。
- **Adjacent expectations**: core が **定義・所有**する effective-set 機構（現行有効葉/ノード・supersede／cancelled 除外・supersede×cancel 復帰 R-S5・累積/現行 basis 機構）・凍結属性（frozenBudget/frozenSlot）・latest-wins・状態機械を、本 spec は **消費**し、その basis の上で指標の**値**を導出する（本 spec は basis を持たず値計算のみを所有する＝構造境界 core）。本 spec が **定義**する指標の値契約（EV_abs/EV%/累積/カバレッジ/PV/AC/SPI/CPI/sunk と各 de-rate データ・可視ギャップ会計データ）を、下流の health/サーフェスが消費し、de-rate の提示制御・可視ギャップの提示は surface-* が所有する。core の ProjectedState/effective-set の形が変われば本 spec の導出は再検証を要する。

## Requirements

### Requirement 1: EV の二形（EV_abs と EV%）の導出（P1/R-U8/R-S1）

**Objective:** 健全性サーフェス作者として、合意済み領域のみを語る絶対出来高と達成率を、core の凍結予算と最新見積から導出したい。それにより進捗が水増しなく正直に読める。

#### Acceptance Criteria

1. The system shall derive EV_abs over the currently-effective set (leaves not superseded and not cancelled, consuming the effective-set defined by `moira-core`) as the sum, over completed sub-units, of their frozen baseline budget, counting only agreed work and excluding un-agreed and un-estimated work, using no state-weight table; cumulative EV (R2-AC2) is the distinct read taken over all leaves.
   - 和訳: システムは EV_abs を現行有効集合（supersede されておらず cancelled でない葉。`moira-core` が定義する effective-set を消費）の上で、完了サブ単位のベースライン凍結予算の総和として、合意済みの作業のみを算入し未合意・未見積を除外し、重みテーブルを用いずに導出しなければならない（累積EV〔R2-AC2〕は全葉で測る別の読みである）。
2. The system shall derive EV% at every level as EV_abs divided by the sum of agreed sub-units' latest estimates, yielding a value in [0,1].
   - 和訳: システムは EV% を全階層で、EV_abs ÷ 合意済みサブ単位の最新見積の総和として、[0,1] の値となるよう導出しなければならない。
3. When the denominator (the sum of agreed latest estimates) is zero, the system shall derive EV% as 0 as an honest empty value. (Design-level zero-denominator rule consistent with EV%'s [0,1] range and P0; the MODEL does not specify a zero-denominator rule for EV% literally.)
   - 和訳: 分母（合意済み最新見積の総和）が 0 のとき、システムは EV% を honest empty として 0 に導出しなければならない。（EV% の [0,1] 範囲と P0 に整合する設計レベルのゼロ分母規則であり、MODEL は EV% のゼロ分母規則を文言として規定しない。）
4. The system shall use the completion-frozen budget (the core-recorded frozen value, locked at completion) for the EV_abs numerator and the latest estimate for the EV% denominator, never mixing the two dimensions.
   - 和訳: システムは EV_abs の分子に完了時凍結予算（core が記録した、完了時に施錠された凍結値）を、EV% の分母に最新見積を用い、両次元を混同してはならない。
5. The system shall read bare "EV" as EV% (achievement) and shall label any absolute quantity explicitly as EV_abs.
   - 和訳: システムは無印の「EV」を EV%（達成率）と読み、絶対量は EV_abs として明示しなければならない。

### Requirement 2: 現行進捗と累積EV の区別導出（R-S5/§2.7/P2）

**Objective:** サーフェス作者として、現行有効集合の達成率と、supersede 済みを含む累積出来高を別々に読みたい。それにより陳腐化した旧作業が現行機能と誤読されない。

#### Acceptance Criteria

1. The system shall derive current progress (EV%) over the currently-effective set only — the leaves not superseded and not cancelled — consuming the effective-set defined by `moira-core`.
   - 和訳: システムは現行進捗（EV%）を、現行有効集合（supersede されておらず cancelled でない葉）のみで導出し、`moira-core` が定義する effective-set を消費しなければならない。
2. The system shall derive cumulative EV (EV_abs) over all leaves including superseded ones, excluding cancelled nodes, admitting only leaves that satisfy the EV_abs conditions (agreed, completed, frozen budget; R1-AC1) — so that cumulative EV is defined by the same basis difference of EV_abs (it differs from R1-AC1 only in basis: all leaves vs the currently-effective set) and work earned but later superseded remains in the cumulative basis. Cumulative EV is the past total earned including superseded work and is a quantity distinct from sunk EV_abs (R10): a cancelled node's earned value is excluded from cumulative EV here and is read only as sunk (R10) — the two are never the same read (NAMING §7).
   - 和訳: システムは累積EV（EV_abs）を、supersede 済みを含む全葉について cancelled ノードを除いて、EV_abs の算入条件（合意済み・完了・凍結予算；R1-AC1）を満たす葉に限り導出し——累積EV が EV_abs と同じ basis 差分のみで定義される（R1-AC1 とは basis〔全葉 vs 現行有効集合〕のみが異なる）ようにし、出来高として計上され後に supersede された作業が累積 basis に残るようにしなければならない。累積EV は supersede 済みを含む過去総出来高であり、サンク EV_abs（R10）とは別量である：cancelled ノードの出来高は本要件の累積EV からは除外され、サンク（R10）としてのみ読まれる——両者は同一の読みになることはない（NAMING §7）。
3. The system shall derive cumulative EV (EV_abs) over a basis (all leaves) distinct from the currently-effective set with which estimate coverage is paired, so that it is not coupled to estimate coverage as companion data (the independence-of-coverage read follows from this basis difference; R2-AC2 / R1-AC1).
   - 和訳: システムは累積EV（EV_abs）を、見積カバレッジが対で読む現行有効集合とは異なる basis（全葉）の上で導出し、見積カバレッジの対データとして結びつけないようにしなければならない（カバレッジから独立に読まれることは、この basis 差分から従う；R2-AC2／R1-AC1）。
4. The system shall not count a superseded old leaf in the leaf-basis coverage denominator (P2), keeping coverage measured over the currently-effective known leaves (leaf-basis per PR-COVERAGE-LEAF).
   - 和訳: システムは supersede 済みの旧葉を葉基底のカバレッジ分母（P2）に算入せず、カバレッジを現行有効な既知の葉（葉基底；PR-COVERAGE-LEAF）で測り続けなければならない。

### Requirement 3: 見積カバレッジの導出と EV% との対読み（P2/R-U9/P0）

**Objective:** spec-value サーフェス作者として、既知ツリーのうち合意済みの割合を導出し、EV% と必ず対で読ませたい。それにより低カバレッジ時の EV% を「霧の中の既知部分の達成度」と正しく解釈できる。

#### Acceptance Criteria

1. The system shall derive estimate coverage as the count of agreed effective leaves over all known effective leaves (leaf-basis per PR-COVERAGE-LEAF / MODEL P2 v18 — intermediate/rollup nodes are NOT counted in either term, so all-leaves-agreed reaches 100%; superseded/cancelled leaves are excluded), measuring the known tree's leaves only and treating undiscovered work as unmeasurable.
   - 和訳: システムは見積カバレッジを、合意済みの有効葉数 ÷ 既知の有効葉総数（葉基底；PR-COVERAGE-LEAF／MODEL P2 v18——中間・ロールアップノードは分子・分母とも数えず、全葉合意で 100% に達する。supersede/cancelled 葉は除外）として導出し、既知ツリーの葉のみを測り未発見作業を測定不能として扱わなければならない。
2. When the known effective leaf count is zero, the system shall derive estimate coverage as 0 as an honest empty value. (Design-level zero-denominator rule consistent with P0 and the R-S8 honest-empty convention; MODEL P2 does not specify a zero-denominator rule literally.)
   - 和訳: 既知の有効葉数が 0 のとき、システムは見積カバレッジを honest empty として 0 に導出しなければならない。（P0 および R-S8 の honest empty 慣行に整合する設計レベルのゼロ分母規則であり、MODEL P2 はゼロ分母規則を文言として規定しない。）
3. The system shall expose the uncommitted region of EV — the un-agreed and un-estimated work — as a visible gap (estimate coverage) and shall not implicitly assume it.
   - 和訳: システムは EV の未コミット領域（未合意・未見積の作業）を可視のギャップ（見積カバレッジ）として公開し、暗黙に仮定してはならない。
4. The system shall provide estimate coverage as the companion data to EV% so that EV% is always read paired with coverage.
   - 和訳: システムは見積カバレッジを EV% の対データとして提供し、EV% が常にカバレッジと対で読まれるようにしなければならない。

### Requirement 4: 低カバレッジ時の EV 解釈 de-rate のための対データ供給（R-S4）

**Objective:** 導出層作者として、カバレッジが低い間に EV の解釈を割り引く R-S4 の規律を提示側が再計算なしに適用できるよう、導出層は素の EV% と見積カバレッジを de-rate 適用可能な対データとして供給したい。それにより EV% が全体完了度として誤提示されることを提示側が防げる。

#### Acceptance Criteria

1. While estimate coverage is low, the system shall provide the raw EV% together with estimate coverage as de-rate-applicable companion data and shall not fold a coverage factor into the EV_abs/EV% formulas, leaving the de-rating and the not-as-project-wide-completion presentation to the presenter (surface-*), isomorphic to the SPI de-rate of R9-AC4.
   - 和訳: 見積カバレッジが低い間、システムは素の EV% を見積カバレッジとともに de-rate 適用可能な対データとして提供し、カバレッジ係数を EV_abs/EV% の式に織り込んではならず、de-rate と「全体完了度として提示しない」表示は提示側（surface-*）に委ねなければならない（R9-AC4 の SPI de-rate と同型）。
2. The system shall keep the de-rate as an interpretation discipline over already-derived data and shall not fold a coverage factor into the EV_abs/EV% formulas. (The companion data needed to apply the de-rate without recomputation — raw EV% paired with estimate coverage — is owned by R3-AC4, not restated here.)
   - 和訳: システムは de-rate を、既に導出済みのデータに対する解釈規律として保ち、カバレッジ係数を EV_abs/EV% の式に織り込んではならない。（再計算なしに de-rate を適用するための対データ＝素の EV% と見積カバレッジの組は R3-AC4 が所有し、本要件では再述しない。）

### Requirement 5: 実行カバレッジ executionCoverage の導出（R-S8）

**Objective:** spec-value サーフェス作者として、完了主義の EV% が落とす「執行中」領域を集約レベルで読みたい。それにより仕掛中（`implementing`）の進捗把握の遅れを補える。

#### Acceptance Criteria

1. The system shall derive execution coverage as the count ratio of agreed effective leaves currently in `implementing` over all agreed effective leaves, over the currently-effective agreed leaf basis (consuming the effective-set defined by `moira-core`). (The structural sameness with schedule coverage is stated by R5-AC4; the leaf basis is grounded in core's effective-set, not on schedule coverage's derived value owned by `moira-schedule`.)
   - 和訳: システムは実行カバレッジを、現行有効・合意済み葉のうち `implementing` にあるものの、合意済み有効葉全体に対するノード数比率として、現行有効・合意済みの葉基底（`moira-core` が定義する effective-set を消費）の上で導出しなければならない。（スケジュールカバレッジとの構造同型は R5-AC4 が述べる。葉基底は `moira-schedule` が所有するスケジュールカバレッジの導出値ではなく core の effective-set に接地する。）
2. When the denominator (agreed effective leaves) is empty, the system shall derive execution coverage as 0 as an honest empty value.
   - 和訳: 分母（合意済み有効葉）が空のとき、システムは実行カバレッジを honest empty として 0 に導出しなければならない。
3. The system shall derive execution coverage agreed-only, excluding an un-agreed `implementing` leaf from both numerator and denominator, that leaf appearing instead as an estimate-coverage gap.
   - 和訳: システムは実行カバレッジを合意済みのみで導出し、未合意の `implementing` 葉を分子・分母とも除外し、その葉を見積カバレッジのギャップとして現さなければならない。
4. The system shall provide execution coverage as a count ratio over a state predicate, structurally isomorphic to schedule coverage, multiplying no budget by any per-state weight, and shall touch none of the EV_abs/EV%/PV/SPI/CPI formulas.
   - 和訳: システムは実行カバレッジを、状態述語上のノード数比率（スケジュールカバレッジと構造同型）として、予算に状態別乗率を一切掛けずに提供し、EV_abs/EV%/PV/SPI/CPI の式に一切触れてはならない。
5. The system shall derive execution coverage from lifecycle state (log-deterministic), not from slots or leveling, so that it does not move on re-estimation and changes only on state transitions.
   - 和訳: システムは実行カバレッジを lifecycle 状態（ログから決定的）から導出し、スロットや平準化には依らせず、再見積では動かず状態遷移時のみ変化するようにしなければならない。

### Requirement 6: 実行カバレッジの三者対読みと算術和の禁止（R-S8/R-S4/R-S6）

**Objective:** サーフェス作者として、実行カバレッジを EV% と見積カバレッジに併置して読み、出来高と取り違えないようにしたい。それにより「仕掛中の量」を「出来高」と誤って合算しない。

#### Acceptance Criteria

1. The system shall provide execution coverage as companion data alongside EV% and estimate coverage from the same derivation, so that the three can be read paired to surface the in-execution region the completion-based EV% omits (the aggregate-level presentation host is owned by surface-*).
   - 和訳: システムは実行カバレッジを、EV% および見積カバレッジと同一導出から併置できる対データとして提供し、完了主義の EV% が落とす執行中領域を三者対で読めるようにしなければならない（集約レベルの提示 host は surface-* が所有する）。
2. The system shall not sum execution coverage with EV% as project-wide progress, since it is in-progress volume — a different dimension (node count) from EV% (budget) — not earned value.
   - 和訳: システムは実行カバレッジを EV% と算術和して全体進捗として提示してはならない（これは仕掛中の量であり、EV%（予算）とは次元（ノード数）が異なる、出来高ではないため）。
3. The system shall keep this non-summation as an R-S4/R-S6-isomorphic de-rate discipline, treating a leaf merely parked in `implementing` as still counted, its actual advance being read via R-S7 divergence and lead time (P6) — concerns owned by `moira-schedule`/`moira-health`.
   - 和訳: システムはこの非合算を R-S4/R-S6 同型の de-rate 規律として保ち、`implementing` に居座るだけの葉も算入しつつ、実際の前進は R-S7 乖離・リードタイム(P6)（`moira-schedule`/`moira-health` が所有）で読ませなければならない。

### Requirement 7: PV（時間配分ベースライン予算）の導出（§3/P0）

**Objective:** 健全性サーフェス作者として、ベースライン上その時点で完了予定のサブ単位の予算総和を、core が記録した凍結属性から導出したい。それにより PV を再平準化せず正本どおり読める。

#### Acceptance Criteria

1. The system shall derive PV at a point in time as the sum of the baseline budget of agreed, scheduled, non-cancelled effective leaves whose frozen slot is at or before that time.
   - 和訳: システムは時点 PV を、合意済み・スケジュール済み・非 cancelled の有効葉のうち凍結スロットが当該時点以前のものについて、そのベースライン予算の総和として導出しなければならない。
2. The system shall read PV only from the frozen dimensions (frozen budget and frozen slot recorded by `moira-core`) and never from latest or live-forecast values.
   - 和訳: システムは PV を凍結次元（`moira-core` が記録した凍結予算・凍結スロット）のみから読み、最新値や生きた予測値からは読んではならない。
3. The system shall exclude scheduled-but-unagreed sub-units from PV (no budget addend), this exclusion being read as reduced estimate coverage (owned by R3); the visible-gap presentation belongs to the presenter (surface-*/R-U9), not to this derivation.
   - 和訳: システムはスケジュール済み・未合意のサブ単位を PV から除外し（被加算予算が無いため）、この除外は見積カバレッジの低下（R3 が所有）として読まれる。可視ギャップの表示は本導出ではなく提示側（surface-*／R-U9）が担う。
4. The system shall exclude agreed-but-unscheduled sub-units from PV (no slot) until they are scheduled, this exclusion being read as the unscheduled-agreed accounting (the R3 estimate-coverage/unscheduled read); the visible-gap (P0) presentation belongs to the presenter (surface-*/R-U9), not to this derivation.
   - 和訳: システムは合意済み・未スケジュールのサブ単位を、スケジュールに載るまで PV から除外し（スロットが無いため）、この除外は未スケジュール合意作業の会計（R3 の見積カバレッジ／未スケジュール会計の読み）として読まれる。可視ギャップ（P0）の表示は本導出ではなく提示側（surface-*／R-U9）が担う。
5. The system shall include a completed-but-never-scheduled sub-unit in EV_abs but exclude it from PV (no frozen slot), this domain asymmetry being surfaced by the SPI de-rate (R-S6).
   - 和訳: システムは完了したがスケジュールに一度も載らなかったサブ単位を EV_abs に含めつつ PV から除外し（凍結スロットが無いため）、この領域非対称を SPI の de-rate（R-S6）で現さなければならない。

### Requirement 8: AC（実コスト）の同型集約と単一通貨（P3/R-U10/A6/P6）

**Objective:** 健全性サーフェス作者として、実コストを木に沿って同型集約し、出来高と分離して読みたい。それにより滞留時間ではなく実費を正直に読める。

#### Acceptance Criteria

1. The system shall derive AC for a node as its own cost plus the sum of its children's AC, attributing cost to its actor.
   - 和訳: システムはノードの AC を、自ノードの cost ＋子の AC の総和として導出し、コストを行為者に帰属させなければならない。
2. The system shall record and aggregate actual cost in the single currency of human attention-time (MD) and shall never fold it into EV.
   - 和訳: システムは実コストを人間アテンション時間（MD）の単一通貨で記録・集約し、それを EV に混入させてはならない。
3. The system shall include in-progress (WIP) cost and retain cancelled nodes' cost in AC, since cost is a fact, deriving AC over a domain independent of completion.
   - 和訳: システムは仕掛中（WIP）コストを含め、cancelled ノードのコストも AC に保持し（コストは事実であるため）、完了に依らない領域で AC を導出しなければならない。
4. The system shall treat elapsed time (ts differences) as lead time and not as cost, deriving cost only from `cost` events.
   - 和訳: システムは滞留時間（ts 差）をリードタイムとして扱いコストとはせず、コストを `cost` イベントのみから導出しなければならない。

### Requirement 9: SPI と CPI の導出と領域非対称（§3/R-S6）

**Objective:** 健全性サーフェス作者として、予算次元で揃った SPI/CPI を導出し、その領域非対称を素データとして正直に供給したい。それにより提示側が SPI を全体進捗と取り違えず提示でき、CPI の悲観側振れを理解できる。

#### Acceptance Criteria

1. The system shall derive SPI as EV_abs / PV in the shared MD budget dimension, returning null (the index is undefined — distinct from 0) when PV is zero. (This null differs from the honest-empty 0 of EV%/estimate coverage/execution coverage: a coverage/EV% 0 is a fact value meaning "the denominator is empty," whereas a null SPI/CPI means the index itself is undefined — there is no scheduled/cost domain to rate against — so SPI=0, full schedule delay, is never conflated with SPI=null, no schedule domain.)
   - 和訳: システムは SPI を、共有 MD 予算次元で EV_abs / PV として導出し、PV が 0 のとき null（指標が未定義；0 とは区別する）を返さなければならない。（この null は EV%／見積カバレッジ／実行カバレッジの honest empty=0 とは別である——カバレッジ／EV% の 0 は「分母が空である」という事実値であるのに対し、SPI/CPI の null は指標そのものが未定義である〔対計画／対コストの領域が存在しない〕ことを意味する。ゆえに SPI=0〔完全な遅延〕と SPI=null〔スケジュール領域なし〕を取り違えない。）
2. The system shall derive CPI as the single CPI of MODEL §3 — EV_abs / AC over the current effective basis (the EV_abs of R1-AC1) in the shared MD budget dimension — returning null (the index is undefined — distinct from 0) when AC is zero, and shall not hold a cumulative-EV-based CPI variant (a CPI over the cumulative EV basis of R2 would be a surface-health judgement, owned by `moira-health`, not derived here).
   - 和訳: システムは CPI を MODEL §3 の単一 CPI——共有 MD 予算次元で、現行有効 basis（R1-AC1 の EV_abs）上の EV_abs / AC——として導出し、AC が 0 のとき null（指標が未定義；0 とは区別する）を返さなければならず、累積EV 基底の CPI 変種を持ってはならない（累積EV〔R2〕基底の CPI は surface-health の判断であり、本 spec の導出ではなく `moira-health` が所有する）。
3. While schedule coverage is low, the system shall provide the raw SPI together with schedule coverage as de-rate-applicable companion data and shall not fold a coverage factor into the SPI formula, leaving the de-rating and the not-as-whole-project-schedule-progress presentation to the presenter (surface-*), and shall surface the unscheduled-but-agreed work as the schedule-coverage gap (the visible-gap presentation belonging to the presenter; R-U9). (Isomorphic to the EV de-rate of R4-AC1 and the PV visible-gap of R7-AC3/AC4: the de-rate data is owned by this derivation, the presentation control by the presenter.)
   - 和訳: スケジュールカバレッジが低い間、システムは素の SPI をスケジュールカバレッジとともに de-rate 適用可能な対データとして提供し、カバレッジ係数を SPI 式に織り込んではならず、de-rate と「全体の対計画進捗として提示しない」表示は提示側（surface-*）に委ね、未スケジュールの合意作業はスケジュールカバレッジのギャップとして現さなければならない（可視ギャップの表示は提示側が担う；R-U9）。（R4-AC1 の EV de-rate・R7-AC3/AC4 の PV 可視ギャップと同型——de-rate 用データは本導出が所有し、提示制御は提示側が所有する。）
4. The system shall provide the raw SPI together with schedule coverage (consumed from `moira-schedule`), leaving the de-rating to the presenter (surface-*) while always providing the data, and shall not fold a coverage factor into the SPI formula. (The de-rating discipline applied over this companion data is owned by R9-AC3; this AC owns the data supply.)
   - 和訳: システムは素の SPI を（`moira-schedule` から消費する）スケジュールカバレッジとともに提供し、de-rate は提示側（surface-*）に委ねつつデータは常に提供し、カバレッジ係数を SPI 式に織り込んではならない。（この対データに適用される de-rate 規律は R9-AC3 が所有し、本 AC はデータ供給を所有する。）
5. The system shall keep CPI's numerator (completed only, EV_abs) and denominator (AC, including WIP) over asymmetric domains, so that CPI skews pessimistic while WIP is large, this being disclosed rather than normalized.
   - 和訳: システムは CPI の分子（完了のみ EV_abs）と分母（WIP を含む AC）を非対称な領域で保ち、WIP が多い時点で CPI が悲観側に振れることを、正規化せず開示しなければならない。

### Requirement 10: サンク EV_abs の導出（R-C2）

**Objective:** スコープ削除を扱うサーフェス/skill 作者として、取り消しノードの出来高をサンクとして別途保存せず導出したい。それにより回収不能の出来高を append-only のログから正直に読める。

#### Acceptance Criteria

1. The system shall derive sunk EV_abs as the sum of earned value over cancelled-state nodes, without storing it separately, as a quantity distinct from cumulative EV (R2-AC2): sunk is the cancelled read and is never included in cumulative EV (NAMING §7). (The exclusion of cancelled nodes from the active basis is owned by the effective-set consumption in R2-AC1 / R7-AC1, not restated here.)
   - 和訳: システムはサンク EV_abs を、cancelled 状態ノードの出来高総和として、別途保存せずに、累積EV（R2-AC2）とは別量として導出しなければならない：サンクは cancelled の読みであり累積EV には決して含まれない（NAMING §7）。（cancelled ノードの稼働 basis からの除外は R2-AC1／R7-AC1 の effective-set 消費が所有し、本要件では再述しない。）
2. When a superseded node is later cancelled, the system shall derive its EV_abs as sunk per this requirement, terminal cancelled taking priority over the supersede cumulative-basis retention.
   - 和訳: supersede 済みノードが後に cancelled になったとき、システムはその EV_abs を本要件に従いサンクとして導出し、終端 cancelled を supersede の累積 basis 保持より優先させなければならない。
3. When the superseding (new) node is cancelled and the effective-set is restored (the old node re-enters the currently-effective set per R-S5 — that restoration judgement being a `moira-core` consumption, not derived here), the system shall derive the new node's EV_abs as sunk per this requirement and shall keep the old node's EV_abs in the cumulative basis (R2-AC2).
   - 和訳: supersede 元（新ノード）が cancelled となり R-S5 に従って effective-set が復帰する（旧ノードが現行有効集合へ復帰する。この復帰判定は本 spec の導出ではなく `moira-core` の消費である）とき、システムは新ノードの EV_abs を本要件に従いサンクとして導出し、旧ノードの EV_abs を累積 basis（R2-AC2）に保持しなければならない。

### Requirement 11: thrashing 検出データの導出（R-S3）

**Objective:** `moira-health` 作者として、出来高が増えないのにコストが増え続けるノードを検出するデータがほしい。それにより警告確定は health に委ねつつ、検出ロジックを導出層に一本化できる。

#### Acceptance Criteria

1. The system shall derive a thrashing-detection signal for a node whose EV_abs is non-increasing while its AC continues to rise over a sustained window, the window being implementation-defined.
   - 和訳: システムは、EV_abs が非増のまま AC が継続的な期間にわたり増え続けるノードについて、thrashing 検出シグナルを導出しなければならない（期間は実装定義）。
2. The system shall not raise the thrashing signal for a one-off cost from a folded estimation activity (R-E2b) **or a folded review activity (§7#18(b))** landing without an estimate, treating it as expected (MODEL R-S3 本文と一致；2026-07-04 追いつき——旧文言は畳んだ見積活動のみを挙げ、MODEL v19 編集で拡張された畳んだレビュー作業の carve-out〔§7#18(b)(v)〕を取りこぼしていた既知 spec-gap の解消).
   - 和訳: システムは、畳んだ見積活動（R-E2b）**または畳んだレビュー作業（§7#18(b)）**が見積なしに一度だけ計上する cost について、これを想定内として thrashing シグナルを立ててはならない（carve-out は各回の畳み cost を**単独で**免責するのみで、差し戻しの反復により AC が持続的期間にわたり積み上がる場合の正当な発火を妨げない）。
3. The system shall provide the thrashing-detection data to the warning layer and shall not itself finalize, aggregate, or clear the warning (those being owned by `moira-health`).
   - 和訳: システムは thrashing 検出データを警告層へ提供し、警告の確定・集約・解消は自ら行ってはならない（それらは `moira-health` が所有する）。
4. The system shall not normalize CPI to account for the node-vs-fold modeling choice, deriving the detection from the EV_abs/AC two-condition signal only.
   - 和訳: システムは、ノード化と畳むのモデル化選択を補正するための CPI 正規化を行わず、検出を EV_abs/AC の二項条件シグナルのみから導出しなければならない。

### Requirement 12: 純関数・無状態の導出ガードレール（R-S2 への寄与；束ね役は `moira-core`）

**Objective:** read サーフェス作者として、本 spec の EVM 導出群が真実源も隠れキャッシュも持たない純関数として供給されることを保証したい。それにより `moira-core` が R-S2 として全 read 消費者へ単一導出を束ねるとき、各サーフェスが二度目の計算をせず一貫した値を読める。

#### Acceptance Criteria

1. The system shall provide each EVM derivation — EV%, EV_abs, cumulative EV, estimate coverage, execution coverage, PV, AC, SPI, CPI, and sunk EV_abs — as a pure function over the `moira-core` projected state and effective-set, so that `moira-core` can bind them as the single derivation it makes available to all read consumers from the same log (the bundling/single-derivation orchestration R-S2 is owned by `moira-core`; this spec is bundled, not the binder).
   - 和訳: システムは各 EVM 導出（EV%・EV_abs・累積EV・見積カバレッジ・実行カバレッジ・PV・AC・SPI・CPI・サンク EV_abs）を、`moira-core` の projected 状態と effective-set に対する純関数として提供し、`moira-core` が同一ログから全 read 消費者へ単一の導出として束ねられるようにしなければならない（束ね・単一導出オーケストレーション R-S2 は `moira-core` が所有する。本 spec は束ねられる側であり束ね役ではない）。
2. The system shall derive its outputs deterministically from the `moira-core` projected state and effective-set alone, so that re-derivation triggered by `moira-core` on event append or configuration-input change (R-S2) yields the consistent updated outputs without this spec holding its own re-derivation trigger or orchestration (those being owned by `moira-core`).
   - 和訳: システムは出力を `moira-core` の projected 状態と effective-set のみから決定的に導出し、`moira-core` がイベント追記・構成入力変更時に発火する再導出（R-S2）が一貫した更新出力を得られるようにしなければならない（再導出契機・オーケストレーションは本 spec ではなく `moira-core` が所有する）。
3. The system shall hold no source of truth and no hidden mutable cache, deriving its outputs only as pure functions over the consumed `moira-core` projected state and effective-set.
   - 和訳: システムは真実源も隠れた可変キャッシュも持たず、出力を、消費する `moira-core` の projected 状態と effective-set に対する純関数としてのみ導出しなければならない。
   - 注: 各メトリクスの「コミット領域のみを語り未コミット領域を可視ギャップとして公開する」P0 規律は、各メトリクス要件（R3-AC3 見積カバレッジ・R7-AC3/AC4 PV・R9-AC3 SPI）に局所化済みであり、本要件では再述しない。R-S2 の単一導出束ね・再導出契機は `moira-core` が所有し、本 spec は純関数群として消費される（Boundary Context 参照）。
