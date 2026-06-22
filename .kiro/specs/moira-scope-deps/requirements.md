# Requirements Document

## Introduction

`moira-scope-deps` は Moira 正典モデル `moira/MODEL.md`(v16, 凍結) を本番アーキテクチャへ落とす **CQRS 分解の Wave1（読/導出 spec）** であり、プロジェクトの **構造（木）と依存（DAG）の二重グラフ**（A3）上で次の **読み出し導出**を所有する spec である:

1. **tree+DAG の二重グラフ読み出し** — 木（所属 §2.6）と DAG（論理依存 §2.6）を混同せず区別して読み出す（A3）。
2. **依存/置換（supersede）辺の種別分離** — 依存辺は ready 判定に使い、置換辺は使わない（§2.7・R-D7 辺）。
3. **ready-eligible（先行充足述語）の導出（R-D1/R-D2）** — 先行群が辺の閾値ポリシーを満たすという**適格性述語（ready-eligible）**を導出し、未指定時は辺種別別既定を適用する。**`ready` 自体は moira-progress が emit する lifecycle 状態**（`moira-progress`/`moira-core/5.1` の状態機械が遷移を起こす）であり、本 spec はその遷移条件となる**先行充足の適格性データを読み・導出するだけ**である（ready 二語分離: 状態=lifecycle / 適格性=本 spec 導出）。
4. **述語評価（R-D4）** — 流入辺を「源配下の**全葉（cancelled 葉を含む）**がポリシー充足」という論理述語として評価し、辺を物理増殖させない。cancelled 葉は永久に充足不能ゆえ、その辺は R-C3 孤児検出へ接続する（R-D4 文言の母集合＝全葉）。
5. **cancel 孤児の検出（読み・R-C3, R-C1 読）** — 先行が cancelled へ遷移し閾値が永久充足不能になったとき、被ブロック後続・未充足辺・取りうる行動を **特定（検出データの生成）**。**自動キャンセルしない**。
6. **restoration の読み出し面（R-S5 の読み）** — supersede 元（新ノード）が cancelled のとき旧ノードが現行有効集合へ復帰することを、`moira-core` の effective-set 導出規則に接地して読み出す。R-S5 の **派生規則本体は `moira-core` が所有**し、本 spec はその出力（復帰後の現行有効集合・有効葉）を読み出す **読み出し面のみを所有**する（roadmap L55「effective-set: 定義は moira-core」）。

本 spec は MODEL を唯一の真実源（SSOT）とし、MODEL の文言を変えず・新概念を足さず、その **構造・依存の読み出し落とし込み**に徹する。`moira-core` が **定義**する横断概念（emit/derive 契約・二層データ・effective-set 導出規則 R-S5（`moira-core/10.1`・restoration `moira-core/10.3`）・`(ts,id)` latest-wins・ノード/見積 状態機械・4 イベント emit・`relate` 辺種別と充足ポリシーの記録・非循環 enforce I2/R-D3（`moira-core/9.1`）・述語評価の構造 enforce（辺非増殖・流出辺ノード水準保持、`moira-core/9.2`）・supersede 辺の非循環/向き（`moira-core/10.4`））を **消費**する前提で書き、core が所有する概念を再定義しない。cross-spec 参照は trace-notation 準拠の `moira-core/<Req>.<AC>` 形式で記す（`moira-core` の requirements.md は確定済みであり、本 spec はその正規 ID を直接参照する）。

本 spec は **読み（検出・導出）のみ**を所有する。辺の追加/削除（`relate`）・cancel 発行（`transition`）・ready を起こすライフサイクル遷移・restoration を起こす cancel は下流 write skill（`moira-relate-edit` / `moira-cancel-scope` / `moira-progress`）が所有する（**検出=読 / 解消=書 の分離**）。指標式・cancel の **金額会計**（sunk EV_abs 導出／R-C2 の EV_abs 側）・warning の確定/集約は下流（`moira-evm` / `moira-health`）が所有する。なお R-C2 は二面を持ち、**cancelled の active basis 除外（cancelled 葉を現行有効集合・有効葉から外す集合意味論）は `moira-core` の effective-set 導出規則（R-S5 派生規則・R-C2 集合意味論を含む。`moira-core/10.1`・`moira-core/10.3`）が定義し、本 spec はその出力を消費・適用する**（roadmap L55「effective-set: 定義は moira-core」・effective-set.ts:34 `// R-C2` は core の effective-set 導出に同居）一方、**サンク EV_abs の金額導出は `moira-evm` が所有する**（roadmap L53「金額導出は moira-evm」・L122「R-C2→evm(sunk)」）。本 spec は R-C2 の集合意味論を自前で再定義せず、core の effective-set 出力を消費するに留める。

## Boundary Context

- **In scope（本 spec が所有）**: tree（所属）と DAG（論理依存）の二重グラフ区別読み出し（A3・§2.6）、依存辺と置換（supersede）辺の **種別分離**読み出し（§2.7・R-D7 辺）、**ready-eligible（先行充足述語）の導出**（R-D1：先行が辺の閾値ポリシーを満たす適格性述語を導出。**`ready` 状態そのものは moira-progress が emit する lifecycle 状態であり本 spec は適格性データを読むだけ＝ready 二語分離**）と充足閾値ポリシー保持・辺種別別既定の適用（R-D2）、**R-D1/R-D2/R-D4 の述語評価・閾値適用は本 spec 所有**（辺種別/policy の**構造**保持・既定値の記録・非循環・辺非増殖の**構造 enforce** は `moira-core` 所有〔`moira-core/9.1`・`moira-core/9.2`〕＝**構造=core / 評価=scope-deps**）、述語評価（R-D4：流入辺＝源配下の**全葉（cancelled 葉を含む）**がポリシー充足を読み側で評価。cancelled 葉は永久充足不能ゆえ R-C3 へ接続。辺非増殖・流出辺のノード水準保持という構造 enforce は `moira-core/9.2` 所有でその上に乗る）、cancel 孤児の **検出（読み）**（R-C3：cancelled 先行を源とする依存辺の永久充足不能判定・被ブロック後続/未充足辺/取りうる行動の特定・自動キャンセルしない・有限終了・木の子は DAG 依存辺を通じて評価）、R-C1 のノード単位 cancel が R-C3 を発火する読み側接続、restoration の **読み出し面**（R-S5 の読み：supersede 元 cancelled→旧ノード復帰を core の effective-set 導出に接地して読み出す。派生規則本体は `moira-core` 所有）。R-C2 は active basis 除外**機構**（cancelled 葉を effective-set から外す集合意味論）＝`moira-core`、sunk 金額導出＝`moira-evm`、本 spec は core の effective-set 出力を**消費**しつつ R-C3 孤児検出・restoration 読みを所有する。
- **Out of scope（上流/下流が所有）**: effective-set の **導出規則そのもの**（R-S5 派生規則＝supersede×cancel 復帰の定義、`moira-core/10.1`・`moira-core/10.3`）= `moira-core`（本 spec は出力を消費）、`(ts,id)` latest-wins・状態機械・4 イベント emit・`relate` スキーマ・非循環 enforce（I2/R-D3 の fold ゲート）= `moira-core`、辺の追加/削除・supersede/cancel/ready 遷移の emit = `moira-relate-edit`/`moira-cancel-scope`/`moira-progress`、9 warning の確定・集約・clearance・行為列挙 = `moira-health`、sunk EV_abs の金額会計（R-C2 の EV_abs 導出側）= `moira-evm`（cancelled の active basis 除外の**集合意味論**そのものは `moira-core` の effective-set 導出規則が定義し本 spec が消費・適用）、EV%/見積被覆/PV/SPI 等の指標式 = `moira-evm`/`moira-schedule`、tree+DAG ビューア・アコーディオン等の UI = `moira-surface-spec-value`/`moira-surface-schedule`。
- **Adjacent expectations**: 本 spec は `moira-core` の effective-set 導出（現行有効集合・有効葉）と `relate` 辺種別/充足ポリシーの記録を **入力**として消費し、その上で ready-eligible（先行充足述語）/orphan/restoration を **導出して出す**だけである（`ready` 状態自体は `moira-progress` が emit し、本 spec は適格性データを読むだけ＝ready 二語分離。自前の真実源・可変状態を持たない）。**Req6 AC1 の「cancelled でない葉」という条件は、R-C2 の active basis 除外（cancelled を集合から外す集合意味論）を core の effective-set 導出を通じて消費・適用したもの**であり、本 spec の中核導出（現行有効集合の読み出し）はこの除外に依存する（参照実装 `moira/backend/src/derivations/effective-set.ts:34 // R-C2`：cancelled 除外は core の effective-set 導出に同居）。**R-C2 集合意味論の単一 owner は `moira-core` の effective-set 定義であり、本 spec はその出力を消費するに留める**（roadmap L55「effective-set: 定義は moira-core」）。R-C2 のサンク EV_abs **金額導出は `moira-evm` 所有**である（roadmap L53「金額導出は moira-evm」・L122「R-C2→evm(sunk)」）。`moira-health` は本 spec の orphan 検出データを警告として確定・集約し、`moira-cancel-scope` は本 spec の孤児評価データを cancel/付替/後続 cancel の判断材料に使う。core の effective-set 契約や `relate` スキーマの形が変われば本 spec の導出も再検証を要する。

## Requirements

### Requirement 1: 木と DAG の二重グラフを区別して読み出す（A3・§2.6）

**Objective:** read サーフェス作者として、所属を表す木と論理依存を表す DAG を混同せず区別して読み出したい。それにより tree+DAG ビューアが所属関係と依存関係を取り違えず表示できる。

#### Acceptance Criteria

1. The system shall read the value tree (ownership: a feature's req/design/tasks/implementation children as siblings) and the constraint DAG (logical dependency edges) as two distinct overlaid graphs over the same nodes, without conflating ownership with dependency.
   - 和訳: システムは、価値の木（所属: feature の req/design/tasks/実装タスク子ノードを同列の兄弟とする）と制約 DAG（論理依存辺）を、同一ノード上に重なる二つの区別されたグラフとして読み出し、所属と依存を混同してはならない。
2. The system shall represent every phase node (e.g. req/design/tasks) and implementation task as a child of its feature in the ownership tree, applying the one lifecycle state machine uniformly regardless of decomposition depth.
   - 和訳: システムは、すべてのフェーズノード（例: req/design/tasks）と実装タスクを所有木上で feature の子として表現し、分解の深さに依らず単一のライフサイクル状態機械を一様に適用しなければならない。
3. The system shall read the spec-phase dependency chain (`req → design → tasks`) and the implementation dependency (`design → implementation task`) as DAG edges expressing logical dependency, separately from the ownership tree.
   - 和訳: システムは、仕様フェーズ依存連鎖（`req → design → tasks`）と実装依存（`design → 実装タスク`）を、所有木とは別に論理依存を表す DAG 辺として読み出さなければならない。
4. The system shall consume the currently-effective set and effective leaves derived by `moira-core` as the basis for reading the two-graph structure, and shall not re-define the effective-set derivation rule (this non-redefinition constraint applies spec-wide to every derivation in this spec that reads from the effective-set).
   - 和訳: システムは、`moira-core` が導出する現行有効集合と有効葉を、二重グラフ構造を読み出す基底として消費し、effective-set 導出規則を再定義してはならない（この非再定義制約は、effective-set から読み出す本 spec の全導出に横断的に適用される）。

### Requirement 2: 辺種別の分離 — 依存辺と置換（supersede）辺（§2.7・R-D7 辺）

**Objective:** read/relate-edit 作者として、依存辺と置換（supersede）辺を種別ごとに分離して読み出したい。それにより置換辺が誤って ready 判定に使われない。

#### Acceptance Criteria

1. The system shall read each DAG edge with its kind — dependency or supersede (replacement) — as recorded on the `relate` event by `moira-core`.
   - 和訳: システムは、各 DAG 辺を、`moira-core` が `relate` イベント上に記録した種別（依存 または 置換 supersede）とともに読み出さなければならない。
2. The system shall use dependency edges, which carry a satisfaction policy, for `ready` determination as a time constraint.
   - 和訳: システムは、充足ポリシーを持つ依存辺を、時間制約として `ready` 判定に使わなければならない。
3. The system shall not use supersede (replacement) edges for `ready` determination, treating them as value/history relations only.
   - 和訳: システムは、置換（supersede）辺を `ready` 判定に使ってはならず、価値・履歴関係としてのみ扱わなければならない。
4. The system shall read a supersede edge as pointing new→old, with the old node kept immutable and never reopened by backward transition, relying on `moira-core` to keep the edge acyclic via I2 without a separate directional invariant.
   - 和訳: システムは、supersede 辺を新→旧を指すものとして読み出し、旧ノードが不変に保たれ後退遷移で再オープンされないものとして扱い、辺の非循環は独立した向きの不変条件なしに I2 で担保する `moira-core` に依拠しなければならない。

### Requirement 3: ready-eligible（先行充足述語）の導出と充足閾値ポリシー（R-D1・R-D2）

**Objective:** scope/schedule 導出作者として、先行群が辺の閾値ポリシーを満たすという **ready-eligible（先行充足述語）** をノードについて導出したい。それにより、moira-progress が起こす `ready` への lifecycle 遷移が、確定した先行状態にのみ依存する適格性データに基づける（`ready` 状態そのものは本 spec は emit せず、適格性を読み・導出するだけ＝ready 二語分離）。

#### Acceptance Criteria

1. When a node's predecessors satisfy that edge's threshold policy, the system shall derive the node as **ready-eligible** (the predecessor-satisfaction predicate). The system shall not itself mark the node `ready` or emit the lifecycle transition into `ready`; the `ready` lifecycle state is emitted by `moira-progress` over the state machine owned by `moira-core` (`moira-core/5.1`), consuming this ready-eligible read as its transition condition.
   - 和訳: 先行群が辺の閾値ポリシーを満たしたとき、システムは当該ノードを **ready-eligible（先行充足述語）** として導出しなければならない。システムは当該ノードを自ら `ready` とマークしたり `ready` への lifecycle 遷移を emit してはならない;`ready` の lifecycle 状態は `moira-progress` が `moira-core`（`moira-core/5.1`）所有の状態機械上で emit し、本 ready-eligible の読み出しをその遷移条件として消費する（ready 二語分離: 状態=lifecycle / 適格性=本 spec 導出）。
2. The system shall apply the satisfaction-threshold predicate evaluation (R-D1/R-D2 evaluation is owned by this spec), reading the per-edge threshold property and the edge-type default — `accepted` for spec-phase edges (`req → design → tasks`) and `implemented` (= code-complete ∧ spec-fixed) for implementation-task edges — that `moira-core` structurally retains and records (the per-edge policy/default value is recorded by `moira-core`; structure = core / evaluation = scope-deps).
   - 和訳: システムは、充足閾値述語の評価を適用しなければならない（R-D1/R-D2 の**評価**は本 spec 所有）。すなわち、`moira-core` が構造的に保持・記録する辺ごとの閾値属性と辺種別別既定——仕様フェーズ辺（`req → design → tasks`）は `accepted`、実装タスク辺は `implemented`（= 実装完了 ∧ 仕様FIX）——を読み出して評価する（辺ごとの policy/既定値の**記録**は `moira-core` 所有;**構造=core / 評価=scope-deps**）。
3. If a predecessor transitions to terminal `cancelled` and the edge's threshold becomes permanently unsatisfiable, then the system shall follow the cancel-orphan evaluation (R-C3) rather than deriving the node as ready-eligible.
   - 和訳: 先行が終端 `cancelled` へ遷移し辺の閾値が永久に充足不能になった場合、システムは当該ノードを ready-eligible として導出せず、キャンセル孤児評価（R-C3）に従わなければならない。
4. The system shall treat ready-eligible determination as a derived read over the current projected state and shall not emit any event (the `ready` transition belongs to `moira-progress`).
   - 和訳: システムは、ready-eligible 判定を現在の projected 状態に対する導出された読み出しとして扱い、いかなるイベントも発行してはならない（`ready` 遷移は `moira-progress` の責務）。

### Requirement 4: 述語評価と辺の非増殖（R-D4）

**Objective:** 大規模プロジェクトの導出作者として、分解されたノードへの流入辺を論理述語として評価したい。それにより辺が組合せ的に増殖せずスケールする。

#### Acceptance Criteria

1. When a node decomposes, the system shall evaluate each inbound edge as a logical predicate over the children — "all leaves beneath the source satisfy the policy" — relying on the edge non-multiplication and node-level outbound-edge retention that `moira-core` structurally enforces (`moira-core/9.2`), without re-deriving that structure.
   - 和訳: ノードが分解されたとき、システムは各流入辺を子に対する論理述語（「源の配下の全葉がポリシーを満たす」）として評価し、辺の非物理増殖および流出辺のノード水準保持は `moira-core` が構造的に enforce するもの（`moira-core/9.2`）に依拠し、その構造を再導出してはならない。
2. The system shall evaluate the inbound-edge predicate over **all leaves beneath the source, including cancelled leaves** (the R-D4 wording — the population is every leaf, not the effective-set leaves), so that predicate evaluation avoids combinatorial edge growth at scale. A cancelled leaf is permanently unsatisfiable, so an edge whose source has such a leaf cannot satisfy the predicate and connects to the cancel-orphan detection (R-C3); the tree-structure read of leaves under the source relies on the structure `moira-core` retains (the non-redefinition constraint of Req 1.4 applies to any effective-set read, but the R-D4 predicate population is all leaves, distinct from the currently-effective set).
   - 和訳: システムは、流入辺の述語を**源の配下の全葉（cancelled 葉を含む）**に対して評価しなければならない（R-D4 の文言どおり——母集合は全葉であって effective-set の有効葉ではない）。これにより述語評価が大規模での辺の組合せ的増殖を避ける。cancelled 葉は永久に充足不能ゆえ、そのような葉を持つ源の辺は述語を満たせず、キャンセル孤児検出（R-C3）へ接続する;源配下の葉という木構造の読みは `moira-core` が保持する構造に依拠する（Req 1.4 の非再定義制約は effective-set の読みに適用されるが、R-D4 述語の母集合は全葉であり現行有効集合とは別物である）。

### Requirement 5: cancel 孤児の検出（R-C3・R-C1 読・§2.7）

**Objective:** cancel-scope skill / health 作者として、先行ノードのキャンセルが後続を永久にブロックする孤児を検出したい。それにより人間が辺除去・付替・後続キャンセルを判断できる検出データが得られる。

#### Acceptance Criteria

1. When a predecessor node transitions to terminal `cancelled`, the system shall evaluate each dependency edge (not supersede edges) whose source is the cancelled node.
   - 和訳: 先行ノードが終端 `cancelled` へ遷移したとき、システムは当該 cancelled ノードを源とする各依存辺（supersede 辺を除く）を評価しなければならない。
2. If an evaluated edge's satisfaction threshold (R-D1/R-D2) becomes permanently unsatisfiable because the source is terminal `cancelled` and cannot reach the required state, then the system shall produce a cancel-orphan detection identifying the blocked successor, the unsatisfied edge, and the available actions: remove the edge (`relate`), redirect to an alternative predecessor (`relate`), or cancel the successor (`transition`).
   - 和訳: 評価された辺の充足閾値（R-D1/R-D2）が、源が終端 `cancelled` で要求状態に到達不能であることにより永久に充足不能になった場合、システムは、被ブロック後続・未充足辺・取りうる行動（辺の除去（`relate`）、代替先行への付け替え（`relate`）、後続のキャンセル（`transition`））を特定するキャンセル孤児検出を生成しなければならない。
3. The system shall not auto-cancel any node — whether all or some predecessors are cancelled — leaving the decision to the human (P0), and shall surface the detection as data for the warning layer (`moira-health`) and the cancel write skill (`moira-cancel-scope`).
   - 和訳: システムは、全先行が cancelled でも一部でも、いかなるノードも自動キャンセルしてはならず、判断を人間に委ね（P0）、検出を警告層（`moira-health`）と cancel write skill（`moira-cancel-scope`）向けのデータとして顕在化しなければならない。
4. The system shall evaluate a tree-child node through its DAG dependency edges, not through the ownership tree, so that a parent's cancellation triggers cancel-orphan evaluation only if the parent is also a DAG predecessor of the child.
   - 和訳: システムは、木の子ノードを所有木ではなく DAG 依存辺を通じて評価し、親のキャンセルが、親が当該子の DAG 先行でもある場合にのみキャンセル孤児評価を発火させるようにしなければならない。
5. The system shall terminate the cancel-orphan evaluation finitely, relying on the DAG being acyclic as enforced by `moira-core` (I2).
   - 和訳: システムは、`moira-core` が担保する DAG の非循環（I2）に依拠して、キャンセル孤児評価を有限に終了させなければならない。
6. When a node-level cancellation is emitted (R-C1), the system shall read it as the trigger for the cancel-orphan evaluation above, without itself emitting the cancellation.
   - 和訳: ノード単位のキャンセルが発行されたとき（R-C1）、システムはそれを上記のキャンセル孤児評価の発火契機として読み出し、キャンセル自体は発行してはならない。

### Requirement 6: restoration — supersede 元キャンセルによる旧ノード復帰の読み出し（R-S5・§2.7）

**Objective:** read サーフェス作者として、置換が取り消されたとき旧ノードが現行有効集合へ復帰することを読み出したい。それにより取り消された置換の旧作業が現行機能として正しく再表示される。

#### Acceptance Criteria

1. The system shall consume the currently-effective set (the effective leaves — not superseded and not cancelled) derived by `moira-core` (`moira-core/10.1`) as the basis of the two-graph read, so that work earned but later superseded is not misread as a currently-effective feature; the distinction of this set from the cumulative earned-value (EV_abs) basis is the EV-accounting read owned by `moira-evm` (`moira-evm/2.1`), not re-derived here.
   - 和訳: システムは、`moira-core` が導出する現行有効集合（supersede されておらず cancelled でない有効葉、`moira-core/10.1`）を二重グラフ読み出しの基底として消費し、出来高として計上されたが後に supersede された作業が現行有効な機能と誤読されないようにしなければならない。当該集合と累積出来高（EV_abs）basis との区別は `moira-evm`（`moira-evm/2.1`）が所有する EV 会計の読みであり、本 spec では再導出しない。
2. When a superseding (new) node has transitioned to `cancelled`, the system shall read that supersede edge as inert in the effective-set derivation so that the old node re-enters the currently-effective set, consuming the derivation rule defined by `moira-core` (the non-redefinition constraint of Req 1.4 applies).
   - 和訳: supersede 元（新）ノードが `cancelled` へ遷移しているとき、システムは当該 supersede 辺を effective-set 導出上で不活性として読み出し、旧ノードが現行有効集合へ復帰するようにし、`moira-core` が定義する導出規則を消費しなければならない（Req 1.4 の非再定義制約が適用される）。
3. The system shall read the supersede edge as remaining on the log (append-only) even while it is operationally inert for the effective-set derivation.
   - 和訳: システムは、supersede 辺が effective-set 導出上は不活性であっても、ログ上にはそのまま残る（append-only）ものとして読み出さなければならない。
4. The system shall expose the currently-effective set (the set of effective leaves per AC1 — a structural collection of nodes, not an accounting quantity) as a read-only output, without presenting it (UI/presentation belongs to `moira-surface-*`); the cumulative-vs-current progress-basis distinction and the EV_abs/sunk accounting that consume this set as a denominator are owned by `moira-evm` (`moira-evm/2.1`, `moira-evm/10.1`), not derived here.
   - 和訳: システムは、現行有効集合（AC1 の有効葉の集合——会計量ではなくノードの構造的集合）を **read-only に出力**し（提示はしない——UI/提示は `moira-surface-*` 所有）、累積と現行の進捗基底区別・および当該集合を分母として消費する EV_abs／サンクの会計は `moira-evm`（`moira-evm/2.1`・`moira-evm/10.1`）が所有し、本 spec では導出しない。

## MODEL Traceability

各 AC（要件 ID `<Req番号>.<AC番号>`）の MODEL（SSOT）出所。見出し括弧の自由記述に依存せず、下流 design.md の Requirements Traceability と検証ツールが `<Req.AC> ↔ MODEL R-*/§` を機械照合するための正典対応表。MODEL 記号（R-*/§/A/P/I）は SSOT への参照であり、trace-notation の要件 ID ref-list（spec 間参照）とは別系統。上流/下流所有が確定している項目は cross-spec 参照（`moira-core/<Req>.<AC>`・`moira-evm/<Req>.<AC>`）で消費元を付す。

| AC | MODEL 出所 | 注 |
|---|---|---|
| 1.1 | A3, §2.6 | 木（所属）と DAG（依存）の二重グラフ区別読み出し |
| 1.2 | §2.5, §2.6 | 単一ライフサイクル状態機械を所属木で一様適用（機械本体は `moira-core/5.1` 消費） |
| 1.3 | §2.6, A3 | 仕様フェーズ依存連鎖・実装依存を DAG 辺として読み出し |
| 1.4 | R-S5, §2.7 | core の effective-set 出力を消費・非再定義（`moira-core/10.1`）。spec 横断の非再定義基底 |
| 2.1 | §2.7, R-D7 | 辺種別（依存/置換）を `relate` から読み出し（スキーマは `moira-core/3.3` 消費） |
| 2.2 | R-D1, R-D2 | 依存辺＝時間制約として ready 判定に使用 |
| 2.3 | §2.7 | 置換辺を ready 判定に使わず価値・履歴関係として扱う |
| 2.4 | R-D7, I2 | supersede 辺＝新→旧・旧不変。非循環は `moira-core/10.4`（I2）に依拠 |
| 3.1 | R-D1 | 先行充足で ready-eligible を導出。`ready` 状態は `moira-progress` が emit（`moira-core/5.1` 状態機械）＝ready 二語分離 |
| 3.2 | R-D2 | 充足閾値述語の**評価**は本 spec 所有（構造=core/評価=scope-deps）。per-edge policy/既定値の**記録**は `moira-core` 消費 |
| 3.3 | R-C3, R-D2 | 先行 cancelled で永久充足不能なら R-C3 へ（ready-eligible 導出せず） |
| 3.4 | R-D1, P0 | ready-eligible は projected 状態の導出読み・イベント非発行（`ready` 遷移は `moira-progress`） |
| 4.1 | R-D4 | 流入辺＝論理述語の評価（評価は本 spec 所有）。辺非増殖・流出辺ノード水準保持の構造 enforce は `moira-core/9.2` 消費 |
| 4.2 | R-D4 | 述語を源配下の**全葉（cancelled 含む）**に評価＝R-D4 母集合（effective-set ではない）。cancelled 葉は永久充足不能→R-C3 接続 |
| 5.1 | R-C3, §2.7 | cancelled 先行を源とする依存辺（supersede 除く）を評価 |
| 5.2 | R-C3 | 永久充足不能の孤児検出データ生成（被ブロック後続・未充足辺・取りうる行動） |
| 5.3 | R-C1, P0 | 自動キャンセルしない・判断は人間・health/cancel-scope 向け検出データ |
| 5.4 | R-C3, §2.6 | 木の子は DAG 依存辺を通じて評価（所属木では発火しない） |
| 5.5 | I2 | 非循環（`moira-core/9.1`）に依拠して有限終了 |
| 5.6 | R-C1 | ノード単位 cancel を孤児評価の発火契機として読む（cancel 自体は非発行） |
| 6.1 | R-S5, §2.7 | core の effective-set 出力（`moira-core/10.1`）を消費。累積との区別は `moira-evm/2.1` 所有 |
| 6.2 | R-S5, §2.7 | supersede 元 cancelled→旧復帰を core の導出規則（`moira-core/10.3`）消費で読む |
| 6.3 | §2.7, A2 | supersede 辺は不活性でもログに残る（append-only） |
| 6.4 | R-S5, §2.7 | 現行有効集合（構造的集合）を read-only 出力。会計分母としての消費は `moira-evm/2.1`・`moira-evm/10.1` 所有 |
