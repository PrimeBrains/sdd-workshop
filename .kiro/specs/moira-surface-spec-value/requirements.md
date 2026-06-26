# Requirements Document

## Introduction

`moira-surface-spec-value` は Moira 正典モデル `moira/MODEL.md`(v16, 凍結) を本番アーキテクチャへ落とす **CQRS 分解の Wave3（read サーフェス群）** の一つで、**「仕様・価値」軸の常駐 read-only ダッシュボード**を所有する spec である。MODEL §0 が確定する「進捗・価値はすべて 4 イベントからの導出」というモデルに対し、本 spec はその導出を**読むだけ**で次を人間に提示する:

1. **ノード木** — feature ─ req/design/tasks/impl（MODEL §2.6 フェーズ＝ノード）のライフサイクル状態と見積状態を、アコーディオン＋進行中（`implementing`）上位で表示。
2. **トレーサビリティ＋DAG ビューア** — 木と relate DAG（依存辺・supersede 辺）を区別して描く再利用可能な部品。
3. **三者対読み** — 現行有効集合の EV%（現行進捗。提示義務の出典は MODEL R-S2、host 割付の出典は UI-ARCHITECTURE §4.1 の主 host）・見積カバレッジ（P2）・実行カバレッジ（R-S8）を併置し、UI-ARCHITECTURE §4.1 が定める**三者対読みの主 host** を務める（累積／現行の区別表示 R-S5 そのものは health が host）。
4. **見積カバレッジ＝行クリック明細** — 葉ごとの合意/スケジュール/完了/EV 寄与の明細展開。
5. **未合意フィルタ**（`proposed` のまま合意に進んでいないノードの抽出。停滞窓という裁量ノブは持たない＝純粋な状態述語）と **深リンク受理**。

本 spec は UI-ARCHITECTURE §6 の read 規律に従う **read-only ダッシュボード**であり、自前の真実源・可変状態・dismiss フラグ・隠れキャッシュを持たず、導出は `moira-core` の R-S2 オーケストレータと上流（`moira-evm`／`moira-scope-deps`）が所有するものを消費する。導出式・effective-set 導出・ready 判定・warning 確定・全 write（見積合意 proposed→agreed 等の人間のコミット判断）は本 spec の範囲外で、**再定義・再計算しない**（二系統計算の禁止）。本 spec が固有に担保するのは、MODEL が強制する**提示の下限**（R-S2 の該当導出を surface・R-S4 の低カバレッジ de-rate 区別表示・R-U9/P0 の可視ギャップ）と、三者を算術和しない de-rate 規律（R-S4/R-S6 同型）である（R-S5 の累積/現行の区別表示そのものは `moira-surface-health` が host する＝UI-ARCHITECTURE §4.3）。

数式・magic number・配色は本書に埋め込まない（指標の定義式の正典は MODEL §3／`moira-naming.md`、UI 技術選定や閾値は design 以下に置く）。

## Boundary Context

- **In scope（本 spec が所有 = 提示と読みの規律）**: 「仕様・価値」軸の read 提示——ノード木（feature ─ req/design/tasks/impl のライフサイクル＋見積状態・アコーディオン・進行中上位・ready 表示の反映）、トレーサビリティ＋DAG ビューア（dependency 辺と supersede 辺の描き分け・**共有モジュール参照**＝atoms/gantt-geometry と同列・所有 spec なし）、現行有効集合の EV%（現行進捗。提示義務の出典は MODEL R-S2、主 host 割付の出典は UI-ARCHITECTURE §4.1。累積／現行の区別表示 R-S5 そのものは health が host）・見積カバレッジ（P2）・実行カバレッジ（R-S8）の**三者併置対読みの主 host**、低カバレッジ時の EV de-rate 表示（R-S4）、見積カバレッジ／被覆マトリクスの**行クリック葉明細**（per-node 属性射影＝read-only として許容・UI-ARCH §6.6）、**未合意フィルタ**（`proposed` のまま合意に進んでいないノードの抽出。停滞窓という裁量ノブを持たない純粋な状態述語）、深リンク（ノード/起点指定）の受理と着地、可視ギャップの提示（R-U9/P0）、read-only 規律（自前状態なし・参照のみ・二系統計算禁止・役割=actor フィルタ）。
- **Out of scope（下流/上流/基盤が所有）**: 指標式本体（EV_abs/EV%/見積カバレッジ/実行カバレッジ/PV/AC/SPI/CPI/sunk）= `moira-evm`；tree+DAG/依存・supersede 辺/effective-set/ready(R-D1)/orphan(R-C3 読)/restoration(R-S5) の**導出** = `moira-scope-deps`；平準化(P7/P8)・予測・スケジュール被覆・buffer = `moira-schedule`；Gantt/担当表示 = `moira-surface-schedule`；SPI/CPI/PV/トレンド/バッファ可視化 = `moira-surface-health`；9 warning 確定・集約・行為列挙の単一定義 = `moira-health`；decision インボックス（横断行為・深リンクの発信元）= `moira-surface-decision`；全 write（見積合意・再見積・割当・キャンセル・config 等の人間のコミット判断）= moira-* write skill 群；emit/derive・二層データ・effective-set 導出・latest-wins・状態機械・凍結記録・R-S2 オーケストレータ = `moira-core`。
- **scheduleCoverage 集約の所在（参照実装との差分・host 明示）**: 参照実装 `SpecValueSurface.tsx` は被覆マトリクスゾーンで集約 `scheduleCoverage`（行73 の CovStat「スケジュールカバレッジ」）を主表示している。一方、本 spec の集約対読みは **EV%・見積カバレッジ・実行カバレッジの三者**（UI-ARCHITECTURE §4.1）であり、集約 `scheduleCoverage` は UI-ARCH §4.1 の host 割付に**無く**、その de-rate（R-S6 低スケジュールカバレッジで SPI を割引）は §4.3 で **health が host** する。よって本 surface は **per-leaf のスケジュール済み標識（行クリック明細の「scheduled status」＝Req6 AC1。参照実装 行94 の per-leaf「スケジュール slot/未」列に対応）のみを表示し、集約 `scheduleCoverage` 指標は host しない**（集約 host は `moira-surface-health`／`moira-surface-schedule` 側）。参照実装が集約 `scheduleCoverage` を CovStat 表示している点は本 spec の host 割付に対する余剰であり、design はこれを spec-value の集約指標として踏襲してはならない（三者対読みは EV%／見積／実行の三者で固定）。
- **Read 依存（供給契約の明示）**: roadmap 行108 は本 spec の Dependencies を `moira-evm, moira-scope-deps` と宣言するが、本 requirements は複数 AC で `moira-core` が射影する per-node 属性（Req6 AC3 の `frozenBudget`・lifecycle・`estimateState`）・ポリシー構造の保持（Req2 AC4）・単一の R-S2 導出（Req9 AC1）を**読む**ことを要求する。本 spec が前提とする供給経路は次の通り確定する: **`moira-core` は R-S2 オーケストレータかつ per-node 属性射影（fold）の供給元**であり、その R-S2 導出は上流 derivation 系（`moira-evm`／`moira-scope-deps`）を介して本 surface へ**中継供給される**（surface は `derive()` の結果＝射影を読むだけ。roadmap「構造境界 core」）。すなわち本 spec は core を**間接 read 依存**（中継元）として持ち、core を介さず evm/scope-deps から同属性を**別経路で再取得して二経路供給にしてはならない**（同一概念は単一の供給に一本化＝R9）。roadmap の Dependencies 行（直接依存＝evm/scope-deps）と本 spec の AC（core 射影の読み）は、この中継供給の確定により整合する。
- **Adjacent expectations**: 本 spec は `moira-core` が**定義**する横断概念（R-S2 導出群・effective-set・latest-wins・二層データ・凍結属性記録）と、上流が導出する EV%／見積カバレッジ／実行カバレッジ／tree+DAG／ready を**消費する**前提で提示要件を書く（これらの概念を再定義しない）。これら上流契約の形が変われば本 spec は再検証を要する。深リンクの**発信元**は `moira-surface-decision` 等であり、本 spec は着地（受理）側の責務のみを所有する。
- **Forward 注記（UI-ARCH §3/§5 との host 帰属差分の解消）**: UI-ARCHITECTURE §3（行38）と §5（行115）は spec-value の責務に**行為**として「見積合意 proposed→agreed（人間のみ；R-U4）・再見積（R-E3）・見積の深さ判断（R-E2b）」を列挙している。これらの行為は、本リポジトリの CQRS 分解（roadmap 行39/108：read=surface／write=skill）により **write skill 群（`moira-estimate-agree`／`moira-cost-log` 等）へ移管済み**である。よって本 surface はこれらの**行為（write）を一切実行・提供せず**、当該 write 文脈への**深リンク（参照）のみ**を所有する（Req7 AC3）。UI-ARCH §3/§5 の行為記述は v16 時点の文脈ビュー帰属の名残であり、本 spec を**正**として write を排する（design は UI-ARCH の行為記述を根拠に write を引き込んではならない）。
- **Forward 注記（参照実装との差分）**: 三者対読みの三者目＝実行カバレッジ（R-S8）は、導出側（`moira-evm` の `executionCoverage`）には既に実在するが、フォワード本番の参照実装 `SpecValueSurface.tsx` は現状これを未提示（見積カバレッジ／スケジュールカバレッジのみ描画）であり、副 host の `moira-surface-health` が唯一実体を持つ。本 spec は §4.1 が定める三者対読みの**主 host** として、実行カバレッジを EV%・見積カバレッジと三者併置で**新規に提示する**責務を所有する（health は EVM 文脈での再掲＝§4.1 副 host）。主 host 責務が空洞のまま下流タスクへ伝播しないよう、design/tasks はこの三者目の追加を明示すること。
- **Reference-implementation deviation（担当・レビュー担当の列が参照実装に無い・read 表示の新設）**: Req10（担当 assignee の常時表示）・Req11（レビュー担当 reviewer の表示）の各 read 列は、フォワード本番の参照実装 `moira/frontend/src/surfaces/spec/SpecValueSurface.tsx` に**未描画である**——同サーフェスのノード木／被覆マトリクスが描く列は「葉／合意／スケジュール／完了／EV寄与」のみで、**担当（assignee）列も reviewer 表示も存在しない**（担当の常時表示は現状 `moira-surface-schedule` の Inspector〔`surfaces/schedule/Inspector.tsx` の Avatar＋name〕にのみ実在）。供給側は `moira-core` の fold が射影する per-node 属性（`ProjectedNode.assignee`／`ProjectedNode.reviewer`・latest-wins。`types.ts` に v19 で `reviewer` 追加済）であり、本 spec はこれを**読んで列として表示する read 提示**を新設する（per-node 属性射影＝UI-ARCHITECTURE §6.6(b) が read-only として許容する flavor で、二系統計算ではない；Req6 AC3 の EV_abs 寄与射影と同列）。すなわち Req10/Req11 は MODEL/spec が定める「あるべき read 提示」への目標受け入れ基準であり、現スライス（担当列なし）の挙動には縛られない（design/tasks はこの担当列・reviewer 表示の新設を明示すること）。reviewer は出来高・会計を一切動かさない read 表示である（MODEL §2.4/R-T5/§7#18(b)）。

## Requirements

### Requirement 1: ノード木の表示（feature ─ req/design/tasks/impl・§2.6/A1）

**Objective:** 仕様・価値を読む人間として、feature とそのフェーズ・実装の子ノードを階層構造のまま、各ノードのライフサイクル状態と見積状態とともに一望したい。それにより「仕様を書くのも進捗」というモデルの構造を画面上で追える。

#### Acceptance Criteria

1. The system shall display the node tree as the ownership tree of `feature ─ req / design / tasks / impl` children derived by `moira-scope-deps`, showing for each node its lifecycle state and, for leaves, its estimate state (`proposed`/`agreed`), without re-deriving the tree itself.
   - 和訳: システムは、ノード木を `moira-scope-deps` が導出する `feature ─ req / design / tasks / impl` の所有木として表示し、各ノードのライフサイクル状態を、葉については見積状態（`proposed`/`agreed`）も併せて示し、木そのものを再導出してはならない。
2. The system shall present the node tree as an accordion, allowing a node's subtree to be expanded or collapsed without altering any derived state.
   - 和訳: システムは、ノード木をアコーディオンとして提示し、導出状態を一切変えずにノードのサブツリーを展開・畳み込みできるようにしなければならない。
3. While a node is in `implementing`, the system shall surface it at a higher position than non-`implementing` siblings so that work in execution is prominent. (This higher-position sort is a presentation choice belonging to UI-ARCHITECTURE §3 presentation freedom — it is NOT a MODEL presentation floor; it must not drop any sibling from the visible-gap accounting, AC9.4/AC9.7.)
   - 和訳: ノードが `implementing` である間、システムはそれを `implementing` でない兄弟より上位に出し、執行中の作業が目立つようにしなければならない。（この上位ソートは UI-ARCHITECTURE §3「提示の自由」に属する提示判断であり、MODEL の提示下限ではない——いかなる兄弟も可視ギャップ会計から落としてはならない＝AC9.4/AC9.7。）
4. The system shall display a node's `ready` lifecycle state (emitted via progress, surfaced through `moira-core`) in the tree — this lifecycle state is the only `ready`-related supply within the R-S2 presentation floor (R-S2 supplies each node's lifecycle state). The `ready-eligible` predicate is a separate concept introduced by the roadmap's structural boundary (ready の二語分離: `ready` lifecycle state = progress emit ／ `ready-eligible` predicate = `moira-scope-deps`, evaluated from the R-D1 threshold-satisfaction predicate); it is NOT a distinct supply named by R-S2 and is therefore presentation freedom, not a presentation floor. If a design chooses to additionally reflect the `ready-eligible` mark, it shall read it from `moira-scope-deps` (whose evaluation rests on the R-D1 threshold predicate) and shall compute neither the lifecycle state nor the eligibility predicate in this surface.
   - 和訳: システムは、ノードの `ready` ライフサイクル状態（progress が emit し `moira-core` 経由で供給）を木に表示しなければならない——この `ready` ライフサイクル状態が R-S2 提示下限における唯一の `ready` 関連供給である（R-S2 は各ノードのライフサイクル状態を供給する）。`ready-eligible` 述語は roadmap の構造境界が導入する別概念であり（ready の二語分離: `ready` ライフサイクル状態 = progress emit ／ `ready-eligible` 述語 = `moira-scope-deps` が R-D1 の閾値充足述語に基づき導出）、R-S2 が名指す別供給項ではないため、提示下限ではなく提示の自由に属する。design が `ready-eligible` マークを追加で反映することを選ぶ場合は、それを `moira-scope-deps`（その評価は R-D1 の閾値述語に依拠する）から読み、ライフサイクル状態・eligibility 述語のいずれも本サーフェスでは計算してはならない。
5. The system shall apply the single lifecycle vocabulary (`pending`/`ready`/`implementing`/`implemented`/`accepted`/`cancelled`) uniformly to all nodes regardless of decomposition depth, never inventing a state outside this vocabulary.
   - 和訳: システムは、単一のライフサイクル語彙（`pending`/`ready`/`implementing`/`implemented`/`accepted`/`cancelled`）を分解の深さに依らず全ノードへ一様に適用し、この語彙外の状態を作り出してはならない。

### Requirement 2: トレーサビリティと再利用 DAG ビューア（§2.7/R-D7/R-S5・relate）

**Objective:** 仕様・価値を読む人間として、ノード間の依存（dependency）辺と置換（supersede）辺を区別して見たい。それにより supersede された旧作業を現行有効な機能と誤読せず、トレーサビリティを正しく辿れる。

#### Acceptance Criteria

1. The system shall render traceability as the tree plus the relate DAG provided by `moira-scope-deps`, drawing dependency edges and supersede edges as visually distinct kinds.
   - 和訳: システムは、トレーサビリティを木と `moira-scope-deps` が提供する relate DAG として描画し、依存辺と supersede 辺を視覚的に区別される種別として描き分けなければならない。
2. The system shall present a supersede edge as pointing new→old and shall visually mark the superseded (old) node as excluded from the currently-effective set, while still showing the edge.
   - 和訳: システムは、supersede 辺を新→旧として提示し、supersede された（旧）ノードを現行有効集合から除外されたものとして視覚的にマークしつつ、辺自体は表示し続けなければならない。
3. The system shall provide the DAG viewer as a **shared presentation module on the same footing as the existing `theme/atoms` and `schedule/gantt-geometry` shared modules — owned by no surface spec** (it is a shared building block, not a spec-owned deliverable; cf. Req9 AC5 and UI-ARCHITECTURE §6 shared building blocks / roadmap "共通 UI は既存共有コードモジュール（atoms.tsx/gantt-geometry.ts）＋ UI-ARCH §6 規律を各 surface spec が参照"), so that `moira-surface-schedule` can embed the same edge-rendering without a second implementation. This surface references the shared DAG viewer rather than forking its own.
   - 和訳: システムは、DAG ビューアを**既存の共有モジュール `theme/atoms`・`schedule/gantt-geometry` と同列の共有提示モジュール——いずれの surface spec も所有しない**として提供しなければならない（共有部品であって特定 spec の所有成果物ではない;cf. Req9 AC5・UI-ARCHITECTURE §6 共有提示部品／roadmap「共通 UI は既存共有コードモジュール（atoms.tsx/gantt-geometry.ts）＋ UI-ARCH §6 規律を各 surface spec が参照」）。これにより `moira-surface-schedule` が辺描画を二重実装せず同一部品を埋め込めるようにする。本サーフェスは独自に fork せず当該共有 DAG ビューアを参照する。
4. The system shall consume the dependency-edge satisfaction policy as a per-edge attribute carried within the relate DAG projection supplied by `moira-scope-deps` (the policy structure is held by `moira-core` and evaluated by `moira-scope-deps`; this surface computes neither) and display it, without computing edge satisfaction itself.
   - 和訳: システムは、依存辺の充足ポリシーを `moira-scope-deps` の relate DAG 射影に同梱されて供給される辺ごとの属性として消費し（ポリシー構造の保持は `moira-core`・評価は `moira-scope-deps` であり、本サーフェスはどちらも計算しない）表示しなければならず、辺の充足判定自体を計算してはならない。

### Requirement 3: EV%（現行進捗）の提示（提示義務 R-S2／主 host 割付 UI-ARCHITECTURE §4.1・P1）

**Objective:** 仕様・価値を読む人間として、現行進捗（現行有効集合の EV%）を、supersede された過去出来高を含む累積 EV と混同しない形で読みたい。それにより長寿命プロジェクトで現行進捗が累積に希釈されない。EV% 提示そのものの義務は MODEL R-S2（更新後の導出を三ダッシュボードへ提供せよ）に由来し、本 surface を主 host とする割付は UI-ARCHITECTURE §4.1（R-S2 導出の host 割付表）に由来する——R-S2 は提示義務を定めるが主/副 host は規定せず、host 帰属は派生設計の UI-ARCH が定める。本 surface は EV%（現行進捗）の主 host（UI-ARCHITECTURE §4.1）であり、現行 EV% 値のみを提示して EV_abs と混同させない規律を負う。**累積／現行の区別表示そのもの（R-S5）は `moira-surface-health` が host する**（§4.3）——本 surface は R-S5 区別表示を host しない（従属的言及）。

#### Acceptance Criteria

1. The system shall display the achievement EV% over the currently-effective set (R-S5: leaves not superseded) as derived by `moira-evm`, labeled as current progress, without re-computing the EV% formula.
   - 和訳: システムは、現行有効集合（R-S5: supersede されていない葉）に対する達成率 EV%（`moira-evm` が導出）を現行進捗として表示し、EV% の式を再計算してはならない。
2. The system shall present the EV% explicitly as the achievement ratio of the currently-effective set, and shall not present it in a way that conflates current progress with the whole output that includes cumulative EV (EV_abs); the cumulative-vs-current distinction (R-S5) itself is hosted by `moira-surface-health` (UI-ARCHITECTURE §4.3), and this surface does not host or draw EV_abs.
   - 和訳: システムは、EV% を現行有効集合の達成率として明示し、累積 EV（EV_abs）を含む全体出来高と現行進捗を混同させる提示をしてはならない。累積／現行の区別表示（R-S5）そのものは `moira-surface-health` が host する（UI-ARCHITECTURE §4.3）ものであり、本サーフェスは EV_abs を host・描画しない。
3. The system shall read the currently-effective set as derived by `moira-scope-deps` (including the supersede×cancel restoration rule of R-S5) and shall not implement the effective-set derivation in this surface.
   - 和訳: システムは、現行有効集合を `moira-scope-deps` が導出するもの（R-S5 の supersede×cancel 復帰規則を含む）として読み、本サーフェスで effective-set 導出を実装してはならない。

### Requirement 4: 見積カバレッジの表示と低カバレッジ de-rate（P2/R-S4/R-U9/P0）

**Objective:** 仕様・価値を読む人間として、見積カバレッジを EV% と必ず対で読み、カバレッジが低いときは EV% が「霧の中の既知部分の達成度」にすぎないと分かるように示したい。それにより低カバレッジでの偽りの安心を防げる。

#### Acceptance Criteria

1. The system shall display the estimate coverage (P2: agreed-estimated known-tree ratio over the currently-effective set) as derived by `moira-evm`, always paired with the EV% reading.
   - 和訳: システムは、見積カバレッジ（P2: 現行有効集合上の合意済み見積／既知ツリー比率。`moira-evm` が導出）を、必ず EV% の読みと対で表示しなければならない。
2. While estimate coverage is low, the system shall de-rate the presentation of EV% and shall not present it as project-wide completion. The "low" judgement (whether de-rating applies) is itself a predicate supplied by the derivation layer (`moira-evm` per R-S4); this surface reflects the supplied de-rate flag/standard only and shall not hold the threshold itself (no magic number in this surface — the threshold belongs to design and below, per Introduction).
   - 和訳: 見積カバレッジが低い間、システムは EV% の提示を割り引き、全体完了度として提示してはならない。「低い」かどうかの判定（de-rate すべきか）の述語そのものも導出層（`moira-evm`／R-S4）が供給するものであり、本サーフェスは供給された de-rate 標識を反映するのみで、閾値を自前に持ってはならない（閾値の magic number を本サーフェスに埋め込まず design 以下に置く＝Introduction）。
3. The system shall present the uncommitted region — work that is not agreed-estimated — as a visible gap and shall never implicitly assume it as complete.
   - 和訳: システムは、未コミット領域（合意済み見積でない作業）を可視のギャップとして提示し、それを暗黙に完了と仮定してはならない。

### Requirement 5: 実行カバレッジの提示と三者対読み（R-S8/R-S4）

**Objective:** 仕様・価値を読む人間として、完了主義の EV% が動かない「執行中」区間を、実行カバレッジとして集約レベルで読みたい。それにより仕掛中の量と出来高を取り違えずに健全性を把握できる。

#### Acceptance Criteria

1. The system shall display the execution coverage (R-S8: count ratio of agreed effective leaves currently in `implementing` over all agreed effective leaves) as derived by `moira-evm`, treating an empty denominator as 0 (honest empty), without re-computing the ratio.
   - 和訳: システムは、実行カバレッジ（R-S8: 合意済み有効葉のうち `implementing` にあるものの、合意済み有効葉全体に対するノード数比率。`moira-evm` が導出）を、分母0を 0（honest empty）として、比率を再計算せずに表示しなければならない。
2. The system shall present execution coverage in a triple placement together with EV% and estimate coverage, serving as the primary host of this triple reading (UI-ARCHITECTURE §4.1). Because the reference implementation `SpecValueSurface.tsx` currently does not present execution coverage (it draws only estimate/schedule coverage) while the `executionCoverage` derivation already exists in `moira-evm` and is presented only by the sub-host `moira-surface-health`, this AC shall be implemented as a **new presentation that consumes the existing `executionCoverage` derivation** — a new placement at the primary host, not a migration of code from health — so the primary-host assignment (§4.1) is not left hollow against implementation reality.
   - 和訳: システムは、実行カバレッジを EV% および見積カバレッジと三者併置で提示し、この三者対読みの主 host を務めなければならない（UI-ARCHITECTURE §4.1）。参照実装 `SpecValueSurface.tsx` は現状 実行カバレッジを未提示（見積／スケジュールカバレッジのみ描画）であり、`executionCoverage` 導出は既に `moira-evm` に実在して副 host の `moira-surface-health` のみが提示している。したがって本 AC は、health の `executionCoverage` 導出を消費する**新規提示**として実装する（health からのコード移植ではなく主 host への新規配置）——§4.1 の主 host 割付が実装現実に対して空洞のまま残らないようにする。
3. The system shall not sum execution coverage with EV% as project-wide progress, presenting it as in-progress volume rather than earned value (an R-S4/R-S6-isomorphic de-rate discipline).
   - 和訳: システムは、実行カバレッジを EV% と算術和して全体進捗として提示してはならず、出来高ではなく仕掛中の量として提示しなければならない（R-S4/R-S6 同型の de-rate 規律）。
4. The system shall present execution coverage as derived agreed-only, surfacing an unagreed `implementing` leaf as an estimate-coverage gap rather than including it in this reading.
   - 和訳: システムは、実行カバレッジを合意済みのみで導出されたものとして提示し、未合意の `implementing` 葉をこの読みに含めず見積カバレッジのギャップとして現さなければならない。

### Requirement 6: 見積カバレッジ＝行クリック葉明細（P2/P1/R-U9）

**Objective:** 仕様・価値を読む人間として、カバレッジや被覆マトリクスの行をクリックして、その葉が合意済みか・スケジュール済みか・完了か・EV にいくら寄与しているかを明細で確認したい。それによりカバレッジの数字の根拠まで辿れる。

#### Acceptance Criteria

1. When a coverage row (a leaf) is clicked, the system shall reveal that leaf's detail — estimate state (agreed/proposed), scheduled status, completion, and EV_abs contribution — composed from the per-node attributes projected by the derived state (the same single source read in AC3 below), never computing a divergent second value.
   - 和訳: カバレッジ行（葉）がクリックされたとき、システムはその葉の明細（見積状態（agreed/proposed）・スケジュール済みか・完了か・EV_abs 寄与）を、導出状態が射影する per-node 属性から合成して（下記 AC3 と同一の単一供給を読み）表示し、乖離する第二の値を計算してはならない。
2. The system shall visually distinguish an unagreed (proposed) leaf in the coverage detail so that the uncommitted region is read as a visible gap (R-U9/P0).
   - 和訳: システムは、未合意（proposed）の葉を被覆明細で視覚的に区別し、未コミット領域が可視のギャップとして読まれるようにしなければならない（R-U9/P0）。
3. The system shall display each leaf's EV_abs contribution by reading the per-node attributes projected by `moira-core` (`frozenBudget`, lifecycle, `estimateState`) and composing the per-leaf contribution that follows the canonical EV_abs definition (EV_abs = Σ completed frozen estimates, MODEL §3/P1, counted agreed-only per R-U8): contribution = `frozenBudget` when the leaf is both completed and agreed, else 0. This is the **per-node attribute projection explicitly permitted as read-only by UI-ARCHITECTURE §6.6(b)** ("per-node 属性（`frozenBudget`/`ac`）から表示用に per-task の値を合成する projection は read-only として許容する") — it is the same blessed flavor as the schedule Inspector's per-task EVM (`surfaces/schedule/Inspector.tsx:44-54`, "PROJECTED from per-node attributes, NOT a second derive() (R-S2)") and is therefore NOT a second `derive()` and NOT a re-computation of any R-S2-owned aggregate (UI-ARCHITECTURE §6.6(a)); it does not violate R-S2 and is not the screen-layer "二系統計算". The system shall not apply any state-weight or any partial-credit of its own.
   - 和訳: システムは、各葉の EV_abs 寄与を、`moira-core` が射影する per-node 属性（`frozenBudget`・lifecycle・`estimateState`）を読み取り、正典の EV_abs 定義（EV_abs = 完了凍結見積の総和。MODEL §3/P1。算入は R-U8 に従い合意済みのみ）に沿った per-leaf 寄与として合成して表示しなければならない（寄与 = 完了かつ合意済みのとき `frozenBudget`、それ以外は 0）。これは **UI-ARCHITECTURE §6.6(b) が read-only として明示的に許容する per-node 属性射影**（「per-node 属性（`frozenBudget`/`ac`）から表示用に per-task の値を合成する projection は read-only として許容する」）であり——schedule Inspector の per-task EVM（`surfaces/schedule/Inspector.tsx:44-54`「per-node 属性から PROJECTED、二度目の derive() でない（R-S2）」）と同じ blessed flavor で——ゆえに二度目の `derive()` ではなく、R-S2 が所有する集約導出値の再計算でもない（UI-ARCHITECTURE §6.6(a)）。R-S2 に反せず、画面層の「二系統計算」でもない。システムは、独自の状態別重みや部分加点を適用してはならない。

### Requirement 7: 未合意フィルタ（R-U3/§2.2/R-U9）

**Objective:** 仕様・価値を読む人間として、未だ `proposed` のまま合意（人間のコミット判断）に進んでいない見積ノードを抽出したい。それにより合意が必要な箇所を発見できる。フィルタの述語は「`proposed` か `agreed` か」という導出状態の状態述語のみであり、本サーフェスは「どれだけ古ければ停滞か」という**停滞窓（時間しきい値）という裁量ノブを持たない**——窓を持てば本サーフェスが自前の裁量パラメータ＝可変状態を持つことになり read-only 規律（Req9）に反するため、フィルタは未合意という純粋な状態述語に留める（NAMING §7 はこのフィルタに固有の正式語を与えず、「停滞」は MODEL/NAMING の正典語ではない——よって本要件は「未合意フィルタ」と正名する）。

#### Acceptance Criteria

1. The system shall provide an **unagreed filter** that selects nodes whose estimate is still `proposed` (not yet `agreed`), reading the estimate state from the derived state — the predicate is the `proposed`/`agreed` state alone, with no stall-window or time threshold (no discretionary knob held by this surface, per Req9).
   - 和訳: システムは、見積が未だ `proposed`（未 `agreed`）であるノードを選び出す**未合意フィルタ**を提供し、見積状態を導出状態から読み取らなければならない——述語は `proposed`/`agreed` 状態のみであり、停滞窓・時間しきい値を持たない（本サーフェスは裁量ノブを持たない＝Req9）。
2. When the unagreed filter is applied, the system shall restrict the displayed node set to the matching nodes without mutating any derived or stored state.
   - 和訳: 未合意フィルタが適用されたとき、システムは表示ノード集合を一致ノードに限定し、導出状態・保存状態を一切 mutate してはならない。
3. The system shall not perform or offer the agreement action itself from this surface — agreement (`proposed→agreed`) is a human commitment owned by a write skill — providing only a deep link to the agreement write context (the `moira-estimate-agree` skill, per UI-ARCHITECTURE §4.2/§5).
   - 和訳: システムは、合意アクション自体を本サーフェスで実行・提供してはならず——合意（`proposed→agreed`）は write skill が所有する人間のコミット判断である——合意 write の文脈（`moira-estimate-agree` skill。UI-ARCHITECTURE §4.2/§5）への深リンクのみを提供しなければならない。

### Requirement 8: 深リンクの受理と着地（UI-ARCH §6・P4）

**Objective:** decision インボックス等の発信元から特定のノードや警告起点を指す深リンクを受けて、対応する箇所へ着地したい。それにより横断面からの導線が本サーフェスで途切れない。

#### Acceptance Criteria

1. When the surface is opened with a deep link targeting a specific node, the system shall navigate to and reveal that node in the node tree (expanding ancestors as needed).
   - 和訳: 特定ノードを指す深リンクで本サーフェスが開かれたとき、システムはノード木内の当該ノードへ移動して可視化しなければならない（必要に応じて祖先を展開する）。
2. When the deep-link target node is currently in a suppressed display state — superseded (excluded mark), `cancelled`, hidden by the unagreed filter, or under a collapsed accordion — the system shall still land on it by temporarily revealing it (e.g. expanding the accordion and/or relaxing the active filter for that target), without mutating any derived state and without dropping the item from the P0 visible-gap accounting; landing shall never silently fail because the target is filtered or collapsed.
   - 和訳: 深リンク対象ノードが現在 抑制表示状態にあるとき——supersede 済み（除外マーク）・`cancelled`・未合意フィルタで非表示・アコーディオン畳み込み下——システムは、対象を一時的に可視化して（例: アコーディオンを展開する／当該対象に対し有効フィルタを一時解除する）なお着地しなければならない。その際、導出状態を一切 mutate せず、項目を P0 可視ギャップ会計から落としてはならない。対象がフィルタ・折りたたみに隠れているという理由で着地が暗黙に失敗してはならない。
3. The system shall resolve a deep link by reading the derived state and shall not recompute any metric the deep link refers to, referencing the same derivation as the originating surface (no second-system calculation).
   - 和訳: システムは、深リンクを導出状態の読み取りで解決し、深リンクが参照するメトリクスを再計算してはならず、発信元サーフェスと同一の導出を参照しなければならない（二系統計算の禁止）。
4. The system shall own only the landing (reception) of a deep link; it shall not own the originating routing surface (the decision inbox), which is `moira-surface-decision`.
   - 和訳: システムは、深リンクの着地（受理）のみを所有し、発信元のルーティング面（decision インボックス。`moira-surface-decision`）を所有してはならない。

### Requirement 9: read-only ダッシュボード規律（UI-ARCH §6・R-S2/P0）

**Objective:** Moira の実装者として、本サーフェスが導出を読むだけで自前の真実源・可変状態を持たないことを保証したい。それにより「真実源が可変状態」の画面版（二つの真実）への転落を防げる。

#### Acceptance Criteria

1. The system shall read all displayed values from the single R-S2 derivation provided by `moira-core` and shall hold no source of truth, no mutable derived cache, and no dismiss/seen flag of its own.
   - 和訳: システムは、表示する全値を `moira-core` が提供する単一の R-S2 導出から読み、自前の真実源・可変な導出キャッシュ・dismiss/既読フラグを一切持ってはならない。
2. When an event is appended or a configuration input changes upstream and the derived state is re-provided, the system shall reflect the updated derived state without performing a second recalculation per surface.
   - 和訳: 上流でイベントが追記されるか構成入力が変化して導出状態が再提供されたとき、システムはサーフェスごとの二度目の再計算を行わずに更新後の導出状態を反映しなければならない。
3. The system shall reference the same query as the other dashboards for any value it draws (P4 spirit), never deriving a divergent second value for the same concept.
   - 和訳: システムは、描画する値について他ダッシュボードと同一のクエリを参照し（P4 の精神）、同一概念に対し乖離する第二の値を導出してはならない。
4. The system shall, where it de-emphasizes or collapses an item (e.g. accordion collapse, filtering), never drop it from the visible-gap accounting, keeping the P0 falsifiable line.
   - 和訳: システムは、項目を抑制・畳み込み（例: アコーディオンの畳み込み・フィルタ）する場合も、それを可視ギャップの会計から落としてはならず、P0 の falsifiable な線を保たなければならない。
5. The system shall render through the shared presentation building blocks of the forward production reference rather than re-implementing them per surface — the shared atoms/theme (pills, bars, cards, section titles, lifecycle/estimate pills, tokens), the shared DAG/Gantt geometry, and the shared read-side labels/warnings/store readers — so that the same concept is drawn identically across dashboards and no surface forks its own divergent rendering of a shared concept (the concrete component inventory is design-level).
   - 和訳: システムは、surface ごとに再実装するのではなく、フォワード本番の参照実装の共有提示部品を通じて描画しなければならない——共有 atoms/theme（pill・bar・card・セクション見出し・lifecycle/estimate pill・token）、共有 DAG/Gantt ジオメトリ、共有の読口ラベル/warning/store リーダー——同一概念がダッシュボード間で同一に描かれ、いずれの surface も共有概念の描画を独自に fork しないようにする（具体的な部品目録は design レベルとする）。
6. Where this surface applies a role preset (the UI-ARCHITECTURE §5 "初期プリセット: 開発者" landing), the system shall treat the role (manager/developer) as an actor filter / initial preset over the same single derivation, never as a physical split that runs a separate calculation per role (UI-ARCHITECTURE §2: "役割はモデル外", role demoted to actor filter / preset; splitting by role and computing a divergent second value is the screen-layer "二つの真実" anti-pattern, forbidden).
   - 和訳: 本サーフェスが役割プリセット（UI-ARCHITECTURE §5「初期プリセット: 開発者」着地）を適用する場合、システムは役割（管理者/開発者）を**同一の単一導出に対する actor フィルタ／初期プリセット**として扱い、役割ごとに別系統計算を走らせる物理分割としては扱ってはならない（UI-ARCHITECTURE §2「役割はモデル外」＝役割を actor フィルタ／プリセットに降格。役割で分割し乖離する第二の値を計算するのは画面層の「二つの真実」反パターンであり禁止）。
7. The system may hold transient presentation/view state (accordion expand/collapse, the active unagreed-filter ON/OFF, the active role actor-preset selection of AC9.6, deep-link landing highlight, and any temporary reveal of AC8.2), but every such presentation state shall satisfy all of: (a) it is never a source of truth for any derived value (the derived value is always read back from the single R-S2 supply, AC9.1); (b) it never drops an item from the P0 visible-gap accounting (AC9.4); (c) it never represents an acknowledge/dismiss/seen state for a warning (MODEL §2.1: "the system holds NO acknowledge/dismiss/seen mutable state" — collapsing/de-emphasizing is presentation freedom, removing from the visible-gap accounting is forbidden; UI-ARCHITECTURE §6.5). Salience suppression (collapse, de-emphasis, re-ordering, mark-as-seen) is allowed; removal from the accounting is not.
   - 和訳: システムは、一時的な提示状態（アコーディオンの展開/折りたたみ・未合意フィルタの ON/OFF・AC9.6 の役割 actor プリセット選択・深リンク着地ハイライト・AC8.2 の一時的可視化）を保持してよいが、いかなる提示状態も次のすべてを満たさねばならない: (a) いかなる導出値の真実源にもならない（導出値は常に単一の R-S2 供給から読み戻す＝AC9.1）。(b) P0 可視ギャップ会計から項目を落とさない（AC9.4）。(c) warning の acknowledge/dismiss/既読を表さない（MODEL §2.1「本システムは acknowledge/dismiss/既読を可変状態として持たない」——畳む・淡色化は提示の自由、可視ギャップ会計から除くのは不可。UI-ARCHITECTURE §6.5）。顕著さの抑制（畳む・淡色化・並び替え・mark-as-seen）は許容されるが、会計からの除去は許されない。

### Requirement 10: ノード木の担当（作業者 assignee）の常時表示（R-T5・A4/R-U6・P0/R-U9）

**Objective:** 仕様・価値を読む人間として、ノード木の各葉に、その作業を誰がやる/やったか（単一被割当者）を常に見たい。それにより割当の偏りや未割当を、状態・出来高と同じ木の上で一目で把握できる。これは `moira-surface-schedule` Req3（担当の常時表示）と同方針を「仕様・価値」軸にも持たせるものであり、表示するのは identity（avatar/name）のみで、スキル/習熟度は出さない（A4/R-U6）。

#### Acceptance Criteria

1. The system shall display each leaf's single assignee (the worker) as an always-visible property of its row in the node tree, showing the assignee as identity (avatar/name) only, read from the per-node attribute projected by `moira-core` (`ProjectedNode.assignee`, latest-wins) and never re-derived in this surface.
   - 和訳: システムは各葉の単一被割当者（作業者）を、ノード木の行の常時表示プロパティとして、identity（avatar/name）のみで表示し、`moira-core` が射影する per-node 属性（`ProjectedNode.assignee`・latest-wins）から読み取り、本サーフェスで再導出してはならない。
2. The system shall not display any human skill or proficiency for the assignee, treating assignment purely as a human-provided input read from upstream (A4/R-U6).
   - 和訳: システムは被割当者について人間のスキルや習熟度を一切表示せず、割当を上流から読み取った人間が与える入力としてのみ扱わなければならない（A4/R-U6）。
3. Where a leaf has no assignee, the system shall present the assignee as an unassigned visible gap (P0/R-U9), and shall not fabricate an assignee; the assignee shown is the `(ts,id)` latest-wins single assignee, never an accumulation of multiple assignees on one node.
   - 和訳: 葉が未割当の場合、システムは被割当者を未割当の可視ギャップ（P0/R-U9）として提示し、被割当者を捏造してはならない。表示する被割当者は `(ts,id)` latest-wins の単一被割当者であり、一ノードに複数を蓄積してはならない。
4. The system shall treat the assignee column as a read-only per-node attribute projection (the UI-ARCHITECTURE §6.6(b) blessed flavor, isomorphic to the schedule Inspector's assignee identity and to Req6 AC3's EV_abs projection), performing no write (assignment is a human commitment owned by a write skill) and computing no aggregate derive()-owned value.
   - 和訳: システムは担当列を read-only の per-node 属性射影（UI-ARCHITECTURE §6.6(b) の許容 flavor。schedule Inspector の担当 identity・Req6 AC3 の EV_abs 射影と同型）として扱い、書き込みを行わず（割当は write skill が所有する人間のコミット判断）、集約 derive() 所有値を計算してはならない。

### Requirement 11: レビュー担当 reviewer の表示（R-T5・§2.4/§7#18・P0/R-U9）

**Objective:** 仕様・価値を読む人間として、`implemented`（レビュー待ち）の葉について、その `implemented→accepted` を行うべく指名されたレビュー担当（reviewer）が誰かを per-node で見たい。それにより「次にレビューするのは誰か（例：太郎）」が、担当（作業者）が Claude のままでも分かる。reviewer は assignee とは別に表示し、出来高・会計には一切影響しない read 表示である（MODEL §2.4/R-T5/§7#18(b)；v19）。

#### Acceptance Criteria

1. The system shall display, on an `implemented` (awaiting-review) leaf, its designated `reviewer` (the human to perform `implemented→accepted`) as identity (avatar/name), read from the per-node attribute projected by `moira-core` (`ProjectedNode.reviewer`, latest-wins) and never re-derived in this surface.
   - 和訳: システムは `implemented`（レビュー待ち）の葉に、その指名 `reviewer`（`implemented→accepted` を行う人間）を identity（avatar/name）で表示し、`moira-core` が射影する per-node 属性（`ProjectedNode.reviewer`・latest-wins）から読み取り、本サーフェスで再導出してはならない。
2. The system shall display the reviewer distinctly from the assignee (a separate role on the row), so that a node whose worker is an agent while its reviewer is a human is read correctly — the reviewer is not the worker and the worker column is not the reviewer.
   - 和訳: システムは reviewer を被割当者とは区別して（行の別役割として）表示し、作業者がエージェントでレビュー担当が人間であるノードが正しく読まれるようにしなければならない——reviewer は作業者ではなく、担当列は reviewer ではない。
3. Where an `implemented` leaf has no designated reviewer, the system shall present the reviewer as an "undesignated" visible gap (P0/R-U9) and shall not fabricate a reviewer; the human review queue membership is unaffected by whether a reviewer is designated (the queue is the actor-independent `implemented` derivation; `moira-schedule` Req14 AC2).
   - 和訳: `implemented` の葉が reviewer 未指名の場合、システムは reviewer を『未指名』の可視ギャップ（P0/R-U9）として提示し、reviewer を捏造してはならない。人間レビュー待ちキューの母集合は reviewer 指名の有無に依らない（キューは actor 非依存の `implemented` 導出；`moira-schedule` Req14 AC2）。
4. The system shall treat the reviewer as a read-only display that moves no derived accounting — it shall not feed EV%/EV_abs, coverage, PV, SPI/CPI, or the schedule, and shall not host a reviewer-filter narrowing (the reviewer filter that selects on the per-node `reviewer` attribute is owned by `moira-surface-schedule` Req14; MODEL §7#18(f)); designating or changing a reviewer is a human commitment (§2.1#2 assignment) owned by a write skill, so this surface performs no reviewer write (offering at most a deep link to the write context).
   - 和訳: システムは reviewer を、いかなる導出会計も動かさない read-only 表示として扱わなければならない——EV%/EV_abs・カバレッジ・PV・SPI/CPI・スケジュールに与えず、レビュー担当を選んで絞る reviewer フィルタを host しない（それは `moira-surface-schedule` Req14 が所有する per-node `reviewer` 属性の選択フィルタ；視点 actor を要さない＝MODEL §7#18(f)）。reviewer の指名・変更は write skill が所有する人間のコミット判断（§2.1#2 割当）であり、本サーフェスは reviewer の書き込みを行わない（行うのは高々 write 文脈への深リンク）。
