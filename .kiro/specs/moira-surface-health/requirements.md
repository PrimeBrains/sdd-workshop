# Requirements Document

## Introduction

`moira-surface-health` は Moira 正典モデル `moira/MODEL.md`(v16, 凍結) を本番アーキテクチャへ落とす **CQRS 分解の Wave3（read サーフェス群）** の一つで、**「健全性・EVM」軸の常駐 read-only ダッシュボード**を所有する spec である。MODEL §0 が確定する「進捗・スケジュール・健全性はすべて 4 イベントからの導出」というモデルに対し、本 spec はその導出を**読むだけ**で、管理者が「対で読んで」即座に健全性を把握できるよう次を提示する:

1. **EV_abs（累積EV）と EV%（現行進捗）の区別表示** — 混同すると嘘になる二読み（過去総出来高 vs 現行有効集合の達成率）を分離ゾーンで提示（R-S5）。
2. **PV／AC／SPI／CPI** — 予算次元 MD の絶対量。SPI は低スケジュール・カバレッジで de-rate（R-S6）、CPI は領域非対称（分子=完了/分母=WIP 含む）を正直に提示（§3）。
3. **人別（actor 別）の CPI 時系列** — valid-time c の制約下で実点のみを描き、補間・捏造曲線を描かない。人別 CPI は actor 帰属が正典に定義されている AC（P3）に立脚するが、actor 別 EV_abs/CPI を導出する責務は MODEL 未定義であり上流（`moira-evm`）の新規導出契約に依存する（参照実装の DerivedState は project-level の単一 spi/cpi のみ供給・per-actor は未供給）。人別 SPI は PV の actor 帰属が正典に無い（MODEL §2.4: 計画軸=単一 assignee）ため本サーフェスでは扱わない。
4. **CCPM フィーバー的可視化と スケジュール・バッファ残量/消費率（R-T6）** — スケジュール・カバレッジと対で de-rate し、境界条件・R-T4 表裏を正直に扱う。
5. **見積カバレッジ＋予算基底（PV/EV、および予算総額 BAC）と 実行カバレッジ（R-S8）の EVM 文脈での再掲** — 三者対読み（EV%・見積カバレッジ・実行カバレッジ）を算術和しない。なお BAC（予算総額の基底量）の提示自体は roadmap（surface-health スコープ）が裁可するが、BAC は MODEL §3 の R-S2 導出群に正典列挙が無く（MODEL の BAC 言及は §5/§7#11 の「工数軸バッファ＝未採用拡張」のみ）、BAC が `moira-evm` の R-S2 導出値であるかは MODEL §3 では未確定であるため、本書は BAC を「上流が導出する R-S2 値として読む」とは断定せず、その出所（凍結ベースライン予算総和か最新見積総和か）と上流供給責務は design 送り［要検証］とする（§7#11 の「BAC×想定生産性」工数バッファとは別物の単純な予算基底量である）。

本 spec は UI-ARCHITECTURE §6 の read 規律に従う **read-only ダッシュボード**であり、自前の真実源・可変状態・dismiss フラグ・隠れキャッシュを持たず、導出は `moira-core` の R-S2 オーケストレータと上流（`moira-evm`／`moira-schedule`／`moira-health`）が所有するものを消費する。指標式・effective-set 導出・平準化／D_pred／buffer 導出・warning 確定・全 write（スコープ/期日判断・再ベースライン・c 宣言等の人間コミット判断）は本 spec の範囲外で、**再定義・再計算しない**（二系統計算の禁止）。write 行為は各 write skill（`moira-*`）への deep-link で起動し、本 spec は write を所有しない（CQRS。UI-ARCH §2/§6）。なお read-only 規律は per-node 属性射影（per-task PV/EV を frozenBudget/ac から表示用に合成し SV/CV をその差分とする提示恒等式）を**許容**する——これは集約 derive() 所有指標の二系統計算ではなく属性の表示用写像である（UI-ARCH §6#6・参照実装 `Inspector.tsx`）。本 spec が固有に担保するのは、MODEL が強制する**提示の下限**（R-S2 の該当導出を surface・R-S5/R-S6 の区別表示と de-rate・R-U9/P0 の可視ギャップ）と、三者を算術和しない de-rate 規律（R-S4/R-S6 同型）である。

数式・magic number・配色・ゾーン閾値は本書に埋め込まない（指標の定義式の正典は MODEL §3／`moira-naming.md`、UI 技術選定や閾値は design 以下に置く。CCPM のゾーン閾値〔GREEN/YELLOW/RED〕は裁量パラメータゆえ正典外＝本サーフェスでも採らない；MODEL §5）。

## Boundary Context

- **In scope（本 spec が所有 = 提示と読みの規律）**: 「健全性・EVM」軸の read 提示——EV_abs（累積EV）と EV%（現行進捗）の区別ゾーン表示（R-S5; 現行有効集合は R-S5〔supersede 除外〕＋R-C2〔cancelled を active basis から除外〕）、PV/AC/SPI/CPI の絶対量提示（§3）、SPI の低スケジュール・カバレッジ de-rate（R-S6・**主 host=health・副 host=schedule-time**＝UI-ARCH §4.1/§4.3。schedule-time が SPI＋カバレッジ strip を描画。集約スケジュール・カバレッジ host=health／spec-value は per-leaf 標識のみ）、CPI の領域非対称の正直な提示、SV/CV を提示する場合の「正典外の提示恒等式」扱い＋SV のカバレッジ対 de-rate（SPI 同型）・CV の仕掛側悲観の正直提示（CPI 同型・参照実装が host）、per-task EVM の per-node 属性射影（read-only 許容＝UI-ARCH §6#6 二段: PV/EV は frozenBudget/ac の表示射影・SV/CV はその差分の提示恒等式。集約 derive() 所有指標の二系統計算は禁止）、SPI/CPI が PV/AC=0 のとき「算出不能」を潰さず示すこと（P0）、実行カバレッジ（R-S8）の EVM 文脈での再掲（三者対読み副 host・算術和禁止）、人別（actor 別）CPI 時系列（actor 帰属 AC=P3 に立脚・actor 別 EV_abs/CPI は上流新規契約依存／人別 SPI は PV の actor 帰属が正典に無く扱わない・valid-time c 制約下で実点のみ・補間/捏造禁止）、スケジュール・バッファ残量/消費率（R-T6）の提示＋スケジュール・カバレッジ対 de-rate＋境界条件＋R-T4 表裏、CCPM フィーバー的可視化、見積カバレッジ＋予算基底（PV/EV、および予算総額 BAC ※BAC は MODEL §3 の R-S2 導出に正典列挙が無く、上流供給と出所は design 送り［要検証］）、可視ギャップの提示（R-U9/P0）、read-only 規律（自前状態なし・参照のみ・二系統計算禁止）。
- **Charter との整合開示（人別SPI 非対象・改訂済 roadmap と一致）**: 改訂済 roadmap surface-health 行（roadmap.md:110）は責務を「人別CPI時系列（人別SPIは MODEL §2.4 単一assignee・PV非actor帰属で非対象）」と明示しており、本 spec が landing する範囲（**人別 CPI のみ・人別 SPI は非対象**）と完全に一致する。**人別 SPI が非対象**である根拠は——SPI の分母 PV が node ベースラインで actor 帰属を持たない（MODEL §2.4: 計画軸=単一 assignee、actor 別 PV は正典に無い）。よって charter（改訂済 roadmap）と MODEL §2.4 と本 spec は同一の normative 内容（人別 CPI only）で整合し、開示すべき charter 差分は存在せず FORK は生じない（人別 CPI は Req5・人別 SPI 非対象は Req5.1 に landing）。
- **Out of scope（下流/上流/基盤が所有）**: 指標式本体（EV_abs/EV%/累積EV/見積カバレッジ/実行カバレッジ/PV/AC/SPI/CPI/sunk）= `moira-evm`；平準化(P7/P8)・予測・D_pred・スケジュール・カバレッジ・buffer 残量/消費率の**導出** = `moira-schedule`；tree+DAG/effective-set/ready(R-D1)/orphan(R-C3 読)/restoration(R-S5) の**導出** = `moira-scope-deps`；9 warning（R-T4 期日超過・R-S3 thrashing・R-S6 等）の確定・集約・行為列挙の単一定義 = `moira-health`；判断型警告の集約・ルーティング（decision インボックス）= `moira-surface-decision`；ノード木/トレーサビリティ/見積カバレッジ行明細の主 host・三者対読みの主 host = `moira-surface-spec-value`；Gantt/担当/未割当バックログ、および SPI/R-S6 de-rate の**副 host**（SPI＋スケジュール・カバレッジ strip の描画。主 host は本 spec=health。同一導出の read であって再計算でない）= `moira-surface-schedule`；全 write（スコープ/期日判断・再ベースライン・c 宣言・割当等の人間コミット判断）= moira-* write skill 群；emit/derive・二層データ・effective-set 導出・latest-wins・状態機械・凍結記録・R-S2 オーケストレータ = `moira-core`。
- **被覆表との整合開示（見積カバレッジ host・CQRS 整合更新後に確定済み）**: §4.1 被覆表（CQRS 整合更新 2026-06-22）は「見積カバレッジ（P2）」の主 host を spec-value とし、health 列を **「三者対読み内の従属再掲＝host でない」**と明記する。同じく R-S8 行は health を「EVM 文脈で EV%・実行カバレッジを従属再掲＝host でない」と明記する。よって Req4.3（health を三者対読みの副 host とする）・Req8.3（health に見積カバレッジ P2＋PV・EV を提示させる）は §4.1 と整合する: health の見積カバレッジ提示は独立掲示ではなく**三者対読み（R-S8）文脈の従属再掲**であり、主 host は spec-value のままである（health は同一導出を読むだけで第二の値を導出しない＝§6 規律。集約スケジュール・カバレッジ host=health とは別物——カバレッジの種別が異なる）。この点は CQRS 整合更新で被覆表自身が「従属再掲＝host でない」と明記したことで決着済みであり、再 FORK しない。
- **Adjacent expectations**: 本 spec は `moira-core` が**定義**する横断概念（R-S2 導出群・effective-set・latest-wins・二層データ・凍結属性記録）と、上流が導出する EV_abs／EV%／累積EV／見積カバレッジ／実行カバレッジ／PV／AC／SPI／CPI／D_pred／スケジュール・カバレッジ／buffer 残量・消費率を**消費する**前提で提示要件を書く（これらの概念を再定義しない）。これら上流契約の形が変われば本 spec は再検証を要する。**依存の現実（参照実装＝フォワード本番に対する falsifiable な前提）**: 現参照実装の DerivedState（v14 era）は buffer 残量/消費率・D_pred・deadline/target date フィールドを供給しておらず、また per-actor の SPI/CPI/PV も供給していない（project-level の単一 spi/cpi と acByNode のみ）。**ただし per-task の EVM 内訳（Req10.7 の per-node 属性射影）は新規契約に依存しない**——参照実装 `Inspector.tsx` は per-node 属性（`frozenBudget`・`acByNode`・forecast の frozenSlot）から表示用に taskPv/taskEv/sv/cv を合成しており（read-only 射影。集約 derive() の再計算ではない）、これが Req10.7 の接地である。新規契約に依存するのは per-actor 集約指標（人別 CPI 時系列）であって per-node 射影ではない。**ただし正典未確定なのは CCPM のゾーン閾値〔GREEN/YELLOW/RED, §5〕と CCPM バッファ*生成*（安全余裕除去・末尾集約, A1/§7#11）のみであり、buffer 残量/消費率（R-T6）は MODEL v16 で正典化済み（R-S2 導出列挙・R-T6・§5）＝本サーフェスの提示下限**である。これは fever-chart 的*可視化*（P0 提示の自由）とは別レイヤである。参照実装 HealthSurface.tsx が fever を「CCPM 暫定 — MODEL v14 未確定／正典未確定のため未供給」と空表示しているのは**参照実装が v16 に未追従**な落差であり、本 spec の提示下限（R-T6 buffer）はこの参照実装の現状に引きずられない（buffer も未確定→提示不要、という誤読を排する）。BAC フィールドも DerivedState に存在しない。ゆえに Req5（人別 CPI）・Req6/7/8.1（buffer/D_pred/fever）・Req8.3（BAC）は `moira-evm`／`moira-schedule` の**新規導出契約の追加**に依存する——design ではこれらフィールドの上流契約（型）を先に固定する。R-S6 de-rate 型は inbox に集約せず本サーフェスの常時メトリクス修飾として表出し（UI-ARCH §3/§4.2）、判断型警告（R-T4/R-S3）の集約・ルーティングは `moira-surface-decision` が所有して本 spec は深リンクの発信元側のみを担う。

## Requirements

### Requirement 1: 累積EV(EV_abs) と 現行進捗(EV%) の区別ゾーン表示（R-S5/P1/§2.7）

**Objective:** 健全性を読む管理者として、現行進捗（現行有効集合の EV%）を、supersede された過去出来高を含む累積 EV（EV_abs）と区別して読みたい。それにより長寿命プロジェクトで累積が膨らんでも現行進捗が希釈されず、混同による誤読を避けられる。

#### Acceptance Criteria

1. The system shall present current progress (EV% over the currently-effective set, R-S5) and cumulative EV (EV_abs retaining superseded past work) in distinct zones as derived by `moira-evm`, never conflating the two readings.
   - 和訳: システムは、現行進捗（現行有効集合の EV%。R-S5）と累積EV（supersede された過去作業を残す EV_abs）を、`moira-evm` が導出する値として区別したゾーンで提示し、両者の読みを決して混同してはならない。
2. The system shall present EV_abs/PV/AC as absolute quantities in the budget dimension (attention-time MD), EV% as the achievement ratio, and SPI/CPI as dimensionless ratios (computed from the same-dimension absolutes EV_abs/PV/AC per MODEL P1), never mixing the dimensions.
   - 和訳: システムは、EV_abs/PV/AC を予算次元（アテンション時間 MD）の絶対量として、EV% を達成率として、SPI/CPI を（MODEL P1 に従い同次元の絶対量 EV_abs/PV/AC から計算される）無次元の比として提示し、次元を混同してはならない。
3. The system shall read the currently-effective set (leaves not superseded per R-S5, including the supersede×cancel restoration rule of R-S5; and excluded from the active basis when cancelled per R-C2) as derived by `moira-scope-deps`/`moira-evm` (mechanism owned by `moira-core`) and shall not implement the effective-set derivation in this surface.
   - 和訳: システムは、現行有効集合（R-S5: supersede されていない葉。supersede×cancel 復帰規則を含む。加えて R-C2: cancelled は active basis から除外）を `moira-scope-deps`/`moira-evm` が導出するもの（機構は `moira-core` 所有）として読み、本サーフェスで effective-set 導出を実装してはならない。
4. The system shall present cumulative EV (EV_abs) independently of estimate coverage, since its basis differs from the currently-effective set, and shall not pair it with coverage as the current-progress reading does.
   - 和訳: システムは、累積EV（EV_abs）を、その基底が現行有効集合と異なるため見積カバレッジと独立に提示し、現行進捗の読みのようにカバレッジと対で示してはならない。
5. While estimate coverage is low, the system shall de-rate the presentation of EV% on this surface (isomorphic to R-S4, this surface being the secondary host of R-S4 per UI-ARCH §4.3, the primary host being `moira-surface-spec-value`) and shall not present EV% as project-wide completion, surfacing the unmeasured-but-known region as a visible gap.
   - 和訳: 見積カバレッジが低い間、システムは本サーフェス上の EV% の提示を割り引き（R-S4 同型。本サーフェスは UI-ARCH §4.3 の R-S4 副 host であり主 host は `moira-surface-spec-value`）、EV% を全体完成度として提示してはならず、未計測だが既知の領域を可視のギャップとして示さなければならない。

### Requirement 2: PV/AC/SPI/CPI の提示と SPI の低スケジュール・カバレッジ de-rate（§3/R-S6）

**Objective:** 健全性を読む管理者として、SPI を必ずスケジュール・カバレッジと対で読み、低い間は「スケジュール済み領域内の進捗率にすぎない」と分かるように示したい。それにより未割当バックログが大きいときの偽りの安心を防げる。

#### Acceptance Criteria

1. The system shall display SPI, CPI, PV, and AC as derived by `moira-evm` (the canonical definition of each index resides in MODEL §3/`moira-naming.md`), without re-computing any of these formulas in this surface.
   - 和訳: システムは、SPI・CPI・PV・AC を `moira-evm` が導出する値として表示し（各指数の定義式の正典は MODEL §3／`moira-naming.md`）、本サーフェスでこれらの式を一切再計算してはならない。
2. While schedule coverage is low, the system shall de-rate the presentation of SPI and shall not present it as whole-project schedule progress, surfacing the unscheduled-but-agreed work as a visible gap; the de-rate presentation is this surface's (the R-S6 primary host's) responsibility, while the raw SPI value and the schedule-coverage value it de-rates against are supplied by `moira-evm`/`moira-schedule` and are not recomputed here.
   - 和訳: スケジュール・カバレッジが低い間、システムは SPI の提示を割り引き、全体の対計画進捗として提示してはならず、未スケジュールの合意作業を可視のギャップとして示さなければならない。de-rate の**提示**は本サーフェス（R-S6 主 host）の責務であり、割り引く対象の素の SPI 値と対読みするスケジュール・カバレッジ値は `moira-evm`／`moira-schedule` が供給する（本サーフェスで再計算しない）。
3. The system shall always pair SPI with the schedule coverage reading derived by `moira-schedule`, never showing SPI without it.
   - 和訳: システムは、SPI を必ず `moira-schedule` が導出するスケジュール・カバレッジの読みと対で示し、SPI を単独で表示してはならない。
4. The system shall present CPI with its domain asymmetry honest — numerator EV_abs covers completed work only while denominator AC includes work-in-progress cost — and shall not present a pessimistic mid-project CPI as a normalized cross-project figure.
   - 和訳: システムは、CPI を領域非対称が正直に分かるように提示し——分子 EV_abs は完了のみ、分母 AC は仕掛コストを含む——仕掛が多い時点の悲観的な CPI を、正規化されたプロジェクト間比較値として提示してはならない。
5. Where the system presents SV (EV_abs − PV) and CV (EV_abs − AC) as presentation identities (the reference implementation hosts both; they are not canonical R-S2 indices), it shall label them as non-canonical, read SV paired with schedule coverage and de-rated while coverage is low (isomorphic to SPI/R-S6), and present CV's WIP-side pessimism honestly (isomorphic to CPI), never reading SV as whole-project schedule variance; it shall read both as derived quantities (EV_abs/PV/AC supplied by `moira-evm`) without computing the index formulas in this surface.
   - 和訳: システムは、SV（EV_abs − PV）・CV（EV_abs − AC）を提示恒等式として提示する場合（参照実装は両者を host する。これらは正典の R-S2 指標ではない）、それらを正典外と明示し、SV はスケジュール・カバレッジと対で読み低カバレッジ間は de-rate し（SPI/R-S6 同型）、CV は仕掛側の悲観性を正直に提示し（CPI 同型）、SV を全体スケジュール差として読んではならない。両者は導出量（EV_abs/PV/AC は `moira-evm` が供給）として読み、本サーフェスで指数の式を計算してはならない。
6. The system shall present the aggregate SPI and its R-S6 de-rate as the primary host (this surface), reading the same SPI and schedule-coverage derivation that the secondary host `moira-surface-schedule` reads (it draws the SPI+coverage strip; UI-ARCH §4.1/§4.3) without deriving a divergent second value, and shall host the aggregate schedule coverage here while `moira-surface-spec-value` carries only the per-leaf scheduled marker, not the aggregate.
   - 和訳: システムは、集約 SPI とその R-S6 de-rate を主 host（本サーフェス）として提示し、副 host である `moira-surface-schedule`（SPI＋カバレッジの strip を描画）が読むのと同一の SPI・スケジュール・カバレッジ導出を読み（UI-ARCH §4.1/§4.3）、乖離する第二の値を導出してはならず、集約スケジュール・カバレッジを本サーフェスで host しなければならない（`moira-surface-spec-value` は per-leaf のスケジュール済み標識のみを担い、集約は担わない）。

### Requirement 3: SPI/CPI=N/A を潰さない（§3/P0/R-U9）

**Objective:** 健全性を読む管理者として、PV や AC が 0 で SPI/CPI が計算できないとき、それを 1.0 や 0 に潰さず「算出不能」と分かるように示してほしい。それにより偽の指標値による誤判断を避けられる。

#### Acceptance Criteria

1. If PV is zero, then the system shall present SPI as uncomputable rather than potting it to 1.0 or 0, exposing it as a visible gap.
   - 和訳: PV が 0 ならば、システムは SPI を 1.0 や 0 に潰さず算出不能として提示し、可視のギャップとして公開しなければならない。
2. If AC is zero, then the system shall present CPI as uncomputable rather than potting it to 1.0 or 0, exposing it as a visible gap.
   - 和訳: AC が 0 ならば、システムは CPI を 1.0 や 0 に潰さず算出不能として提示し、可視のギャップとして公開しなければならない。
3. The system shall present every derived health metric as speaking only of its committed region and shall expose the uncommitted region as a visible gap, never implicitly assuming it.
   - 和訳: システムは、各健全性メトリクスをそのコミット領域についてのみ語るものとして提示し、未コミット領域を暗黙に仮定せず可視のギャップとして公開しなければならない。

### Requirement 4: 実行カバレッジ(R-S8) の EVM 文脈再掲と三者対読み（R-S8/R-S4）

**Objective:** 健全性を読む管理者として、完了主義の EV% が動かない「執行中」区間を、EVM 文脈でも実行カバレッジとして再掲して読みたい。それにより EV% が低いのが「未着手」なのか「仕掛中だが未完了」なのかを区別できる。

#### Acceptance Criteria

1. The system shall display the execution coverage (R-S8: count ratio of agreed effective leaves currently in `implementing` over all agreed effective leaves, empty denominator → 0) as derived by `moira-evm`, re-shown in the EVM context alongside EV%, without re-computing the ratio.
   - 和訳: システムは、実行カバレッジ（R-S8: 合意済み有効葉のうち `implementing` にあるものの、合意済み有効葉全体に対するノード数比率。分母0→0。`moira-evm` が導出）を、EVM 文脈で EV% と並べて再掲し、比率を再計算せずに表示しなければならない。
2. The system shall not sum execution coverage with EV% as project-wide progress, presenting it as in-progress volume rather than earned value (an R-S4/R-S6-isomorphic de-rate discipline).
   - 和訳: システムは、実行カバレッジを EV% と算術和して全体進捗として提示してはならず、出来高ではなく仕掛中の量として提示しなければならない（R-S4/R-S6 同型の de-rate 規律）。
3. The system shall present execution coverage as the secondary host of the triple reading (EV% / estimate coverage / execution coverage), the primary host being `moira-surface-spec-value`.
   - 和訳: システムは、実行カバレッジを三者対読み（EV%・見積カバレッジ・実行カバレッジ）の副 host として提示し、主 host は `moira-surface-spec-value` であることを前提としなければならない。
4. The system shall present execution coverage as derived agreed-only and shall note that its fidelity rests on `implementing` being recorded (a `ready→implemented` skip lowers fidelity), without itself altering the lifecycle or the EV formulas.
   - 和訳: システムは、実行カバレッジを合意済みのみで導出されたものとして提示し、その忠実度が `implementing` の記録に依る（`ready→implemented` のスキップで忠実度が落ちる）ことを示しつつ、ライフサイクルや EV の式を本サーフェスで変えてはならない。

### Requirement 5: 人別(actor 別) CPI 時系列（P3/R-U14・valid-time）

> トレース注記: R-S2（MODEL §4.2）は **project-level の単一導出群**を列挙する要件であり、actor 別 CPI は R-S2 の列挙に存在しない（AC2 が自認する通り）。本要件の per-actor CPI は R-S2 では裏付けられず、`moira-evm` の**新規 actor 帰属導出契約**に依存する。R-U14（valid-time c）と P3（AC の actor 帰属）が接地源であり、R-S2 はタイトルの根拠として引かない。

**Objective:** 健全性を読む管理者として、CPI を全体だけでなく人（actor）別の時系列でも読みたい。それにより誰の担当領域でコスト効率が悪化しているかを辿れる。ただし過去時点の再現には valid-time の c が要るため、捏造した曲線でなく実点のみを正直に描いてほしい。なお人別 SPI は、SPI の分母 PV が node ベースラインで actor 帰属を持たない（MODEL §2.4: 計画軸=単一 assignee、actor 別 PV は正典に無い）ため本要件では扱わない。

#### Acceptance Criteria

1. The system shall present CPI as a per-actor time series, reading each point from the upstream-derived actor-attributed state grounded in P3 (AC attributed to the actor), without re-computing the index in this surface. Per-actor SPI is excluded because PV (the SPI denominator) carries no actor attribution in the canon (MODEL §2.4: the planning axis is single-assignee).
   - 和訳: システムは、CPI を人別（actor 別）の時系列として提示し、各点を P3（AC の actor 帰属）に立脚する上流の actor 帰属導出状態から読み、本サーフェスで指数を再計算してはならない。人別 SPI は、分母 PV が正典上 actor 帰属を持たない（MODEL §2.4: 計画軸=単一 assignee）ため除外する。
2. The system shall treat per-actor EV_abs/CPI as derived state that `moira-evm` must newly supply — actor-level EV_abs/CPI is not defined in MODEL today (P3 attributes AC only) — and shall consume it without re-defining; where it is not yet supplied, this surface shall present only what the upstream contract provides and not synthesize the per-actor index itself.
   - 和訳: システムは、actor 別 EV_abs/CPI を `moira-evm` が新規に供給すべき導出状態として扱い——actor 別 EV_abs/CPI は現 MODEL では未定義（P3 が帰属させるのは AC のみ）——再定義せず消費しなければならない。未供給の間は、本サーフェスは上流契約が供給するものだけを提示し、人別指数を自前で合成してはならない。
3. The system shall plot only actual derived points, never interpolating or fabricating a curve between points where the valid-time c needed for point-in-time reproduction (R-U14) is unavailable.
   - 和訳: システムは、実際に導出された点のみをプロットし、過去時点の再現に必要な valid-time の c（R-U14）が無い区間で点間を補間したり曲線を捏造したりしてはならない。
4. The system shall present a single as-of point honestly when historical points cannot yet be reproduced, rather than displaying a misleading trend line.
   - 和訳: システムは、過去点をまだ再現できない場合、誤解を招くトレンド線を表示するのではなく、単一の as-of 点を正直に提示しなければならない。
5. The system shall, when presenting the project-level SPI/CPI trend (a zone of this surface per UI-ARCH §5), plot only reproducible actual points and shall neither interpolate between points nor fabricate a curve over any interval where the valid-time c (R-U14) is unavailable, presenting a single as-of point honestly while c is not yet supplied (the same discipline as the per-actor series).
   - 和訳: システムは、project-level の SPI/CPI トレンド（UI-ARCH §5 が列挙する本サーフェスのゾーン）を提示する場合も、再現可能な実点のみをプロットし、valid-time の c（R-U14）が無い区間で点間補間や曲線捏造をしてはならず、c が未供給の間は単一の as-of 点を正直に提示しなければならない（人別系列と同一規律）。

### Requirement 6: スケジュール・バッファ残量/消費率(R-T6) の提示と de-rate 対読み（R-T6/R-S6）

**Objective:** 健全性を読む管理者として、プロジェクト全体で管理しているバッファ残量と消費率を、スケジュール・カバレッジと対で読みたい。それにより未割当バックログが大きいときの「偽の余裕」を見抜き、超過前に監視できる。

#### Acceptance Criteria

1. The system shall display the schedule buffer remaining and buffer consumption as derived by `moira-schedule` from the deadline/target configuration inputs and D_pred (the canonical definition of remaining/consumption resides in R-T6/MODEL §3), without re-computing D_pred or the buffer in this surface.
   - 和訳: システムは、スケジュール・バッファ残量とバッファ消費率を、期日/目標日の構成入力と D_pred から `moira-schedule` が導出する値として表示し（残量/消費率の定義式の正典は R-T6/MODEL §3）、本サーフェスで D_pred やバッファを再計算してはならない。
2. While schedule coverage is low, the system shall de-rate the buffer reading and present it paired with schedule coverage (isomorphic to R-S6), so that a large unassigned backlog is not read as false comfort.
   - 和訳: スケジュール・カバレッジが低い間、システムはバッファの読みを割り引き、スケジュール・カバレッジと対で提示し（R-S6 同型）、大きな未割当バックログが偽の余裕として読まれないようにしなければならない。
3. The system shall present the buffer as a live-forecast quantity that moves with D_pred (an honest non-monotonicity like P5), distinct from the frozen baseline PV/SPI which it does not affect.
   - 和訳: システムは、バッファを D_pred とともに動く生きた予測側の量（P5 同型の正直な非単調）として提示し、影響を受けない凍結ベースライン PV/SPI とは区別しなければならない。
4. The system shall present buffer remaining and the R-T4 deadline-overrun magnitude as two faces of the same derived completion — buffer remaining is the pre-breach monitoring, the overrun magnitude is buffer remaining once clamped to 0 — without itself raising or clearing the R-T4 warning (owned by `moira-health`).
   - 和訳: システムは、バッファ残量と R-T4 の期日超過量を同一の導出完了の表裏——バッファ残量は超過前の監視、超過量はバッファ残量が 0 にクランプされた後の同量——として提示し、R-T4 警告の発火・消去（`moira-health` が所有）自体は行ってはならない。

### Requirement 7: バッファ境界条件の正直な提示（R-T6/§3/P0）

**Objective:** 健全性を読む管理者として、期日や目標日が欠けている・等しい・逆転しているなどの境界条件で、バッファ表示が誤解なく扱われてほしい。それにより構成入力の不足や誤りを偽の数字で隠さず把握できる。

#### Acceptance Criteria

1. Where a target date is absent, the system shall present buffer remaining (= slack to deadline) only and shall present buffer consumption as N/A.
   - 和訳: 目標日が無い場合、システムはバッファ残量（= 対期日スラック）のみを提示し、バッファ消費率を N/A として提示しなければならない。
2. Where a deadline is absent, the system shall present the buffer as undefined and shall not raise an overrun reading.
   - 和訳: 期日が無い場合、システムはバッファを未定義として提示し、超過の読みを出してはならない。
3. Where the target date equals the deadline, the system shall present buffer consumption as N/A (zero denominator) and present remaining only.
   - 和訳: 目標日が期日と等しい場合、システムはバッファ消費率を N/A（分母0）として提示し、残量のみを提示しなければならない。
4. If the target date is later than the deadline, then the system shall present the configuration-error warning (sanctioned by R-T6/§3/§2.1) as derived/confirmed upstream and present the buffer as N/A, without auto-rejecting the input and without itself raising, confirming, or clearing the warning (read-only: it presents only). The config-error warning is not one of the nine inbox-classified warnings; its raising/hosting authority is an upstream `moira-schedule`/`moira-health` derivation contract to be fixed in design [to-verify].
   - 和訳: 目標日が期日より後の場合、システムは構成エラー警告（R-T6/§3/§2.1 が裁可）を上流が導出・確定したものとして提示しバッファを N/A として提示し、入力を自動拒否せず、かつ本サーフェスで当該警告を発火・確定・消去してはならない（read-only: 提示のみ）。本構成エラー警告は inbox 分類される 9 警告には含まれず、発火・host の権限は上流 `moira-schedule`/`moira-health` の導出契約として design で確定する［要検証］。
5. If D_pred does not exist (schedule coverage = 0), then the system shall present buffer remaining as uncomputable, shown as a visible gap rather than potted to a value.
   - 和訳: D_pred が存在しない（スケジュール・カバレッジ = 0）場合、システムはバッファ残量を算出不能として、値に潰さず可視のギャップとして提示しなければならない。

### Requirement 8: CCPM フィーバー的可視化と見積カバレッジ＋予算基底（R-T6/P2/§3/§5）

**Objective:** 健全性を読む管理者として、消費%×進捗% のフィーバー的可視化と、見積カバレッジ＋予算基底（PV/EV、および予算総額 BAC）を一目で読みたい。それにより監視の俯瞰と、コミット領域の根拠（カバレッジ・予算総額）を同時に把握できる。なお「明快メトリクス」は MODEL/NAMING/UI-ARCH に無い roadmap 由来のスコープ語（正式用語ではない）ゆえ要件タイトルには据えない。

#### Acceptance Criteria

1. The system shall present a fever-chart-style visualization of buffer consumption against progress as presentation freedom (P0), reading both axes from the derived state without computing the buffer or progress itself.
   - 和訳: システムは、バッファ消費率と進捗のフィーバーチャート的可視化を提示の自由（P0）として提示し、両軸を導出状態から読み、バッファや進捗自体を計算してはならない。
2. The system shall not apply CCPM zone thresholds (GREEN/YELLOW/RED) as canonical, since they are discretionary parameters outside the canon (§5), speaking with the raw data and accounting instead.
   - 和訳: システムは、CCPM のゾーン閾値（GREEN/YELLOW/RED）を正典のものとして適用してはならず、それらは正典外の裁量パラメータ（§5）であるため、生データと会計で語らなければならない。
3. The system shall present estimate coverage (P2) together with PV and EV read from the derived state, and shall present the budget total BAC as the budget basis, so that the committed region (coverage) and the budget basis are read together. BAC is canonically listed neither in the MODEL §3 R-S2 derivations nor in `moira-naming.md` (MODEL's only BAC reference is the NOT-adopted effort-axis buffer of §5/§7#11); therefore this surface shall not assert BAC as an upstream-derived R-S2 value, and its supplying skill and origin (frozen-baseline budget sum vs latest-estimate sum) are deferred to design [to-verify]. BAC here is the plain budget-total basis, distinct from §7#11's "BAC × expected-productivity" effort buffer.
   - 和訳: システムは、見積カバレッジ（P2）と、導出状態から読む PV・EV を提示し、予算総額 BAC を予算基底として提示して、コミット領域（カバレッジ）と予算基底が対で読まれるようにしなければならない。BAC は MODEL §3 の R-S2 導出群にも `moira-naming.md` にも正典列挙が無い（MODEL の BAC 言及は §5/§7#11 の未採用「工数軸バッファ」のみ）。ゆえに本サーフェスは BAC を上流導出の R-S2 値として断定せず、その供給 skill と出所（凍結ベースライン予算総和か最新見積総和か）は design 送り［要検証］とする。ここでの BAC は単純な予算総額の基底量であり、§7#11 の「BAC×想定生産性」工数バッファとは別物である。
4. The system shall not represent the buffer as a node (A1) nor adopt CCPM buffer generation (active safety-margin stripping and tail aggregation), reading the buffer only as a derived quantity from two reference dates and derived completion.
   - 和訳: システムは、バッファをノードとして表現してはならず（A1）、CCPM のバッファ生成（安全余裕の能動的除去と末尾集約）を採ってはならず、バッファを二参照日付と導出完了からの導出量としてのみ読まなければならない。

### Requirement 9: 警告の提示と de-rate 型 vs 判断型の区別（R-S6/R-T4/R-S3/§2.1）

**Objective:** 健全性を読む管理者として、SPI を割り引く R-S6 のような de-rate 型の信号は常時メトリクス修飾として読み、R-T4 期日超過や R-S3 thrashing のような判断・行為を要する警告は decision インボックスへ導線として現してほしい。それにより解釈の割引と行為要求を取り違えない。

#### Acceptance Criteria

1. The system shall present the R-S6 de-rate signal as a standing metric modifier on this surface and shall not route it as an action item to the decision inbox.
   - 和訳: システムは、R-S6 の de-rate 信号を本サーフェスの常時メトリクス修飾として提示し、行為項目として decision インボックスへルーティングしてはならない。
2. The system shall surface the R-T4 deadline-overrun warning (carrying its overrun magnitude) and the R-S3 thrashing warning as confirmed by `moira-health`, deep-linking to the decision inbox / write context, without itself confirming or clearing these warnings.
   - 和訳: システムは、R-T4 期日超過警告（超過量を伴う）と R-S3 thrashing 警告を `moira-health` が確定したものとして surface し、decision インボックス／write 文脈へ深リンクし、これらの警告を本サーフェスで確定・消去してはならない。
3. The system shall not provide an acknowledge/dismiss/seen mutable state for any warning; a warning persists as a visible gap while its condition is true and clears only when an input falsifies the condition (§2.1).
   - 和訳: システムは、いかなる警告に対しても acknowledge/dismiss/既読の可変状態を提供してはならない。警告は条件が真の間は可視のギャップとして持続し、入力が条件を偽化した時にのみ消える（§2.1）。
4. The system shall, where it de-emphasizes or collapses a warning (collapse, dimming, sorting), never drop it from the visible-gap accounting, keeping the P0 falsifiable line.
   - 和訳: システムは、警告を抑制・畳み込み（畳む・淡色化・並び替え）する場合も、それを可視ギャップの会計から落としてはならず、P0 の falsifiable な線を保たなければならない。
5. The system shall present the buffer configuration-error warning (target > deadline; sanctioned by R-T6/§3/§2.1) — which is neither a de-rate-type nor one of the nine inbox-classified warnings — as a configuration-input fault on this surface, as derived/confirmed upstream, without itself raising, confirming, or clearing it (read-only); its raising/hosting authority is fixed in design [to-verify].
   - 和訳: システムは、バッファ構成エラー警告（目標日 > 期日。R-T6/§3/§2.1 が裁可）——de-rate 型でも 9 警告のいずれでもない——を、本サーフェス上の構成入力の不備として、上流が導出・確定したものとして提示し、本サーフェスで発火・確定・消去してはならない（read-only）。発火・host の権限は design で確定する［要検証］。

### Requirement 10: read-only ダッシュボード規律（UI-ARCH §6・R-S2/P0）

**Objective:** Moira の実装者として、本サーフェスが導出を読むだけで自前の真実源・可変状態を持たないことを保証したい。それにより「真実源が可変状態」の画面版（二つの真実）への転落を防げる。

#### Acceptance Criteria

1. The system shall read all displayed values from the single R-S2 derivation provided by `moira-core`, referencing the same query as the other dashboards for any value it draws (P4 spirit; e.g. the same PV the schedule surface references), and shall hold no source of truth, no mutable derived cache, and no dismiss/seen flag of its own, never deriving a divergent second value for the same concept.
   - 和訳: システムは、表示する全値を `moira-core` が提供する単一の R-S2 導出から読み、描画する値について他ダッシュボードと同一のクエリを参照し（P4 の精神。例: schedule サーフェスが参照するのと同一の PV）、自前の真実源・可変な導出キャッシュ・dismiss/既読フラグを一切持たず、同一概念に対し乖離する第二の値を導出してはならない。
2. When an event is appended or a configuration input (c, deadline, or target date) changes upstream and the derived state is re-provided, the system shall reflect the updated derived state without performing a second recalculation per surface.
   - 和訳: 上流でイベントが追記されるか構成入力（c・期日・目標日）が変化して導出状態が再提供されたとき、システムはサーフェスごとの二度目の再計算を行わずに更新後の導出状態を反映しなければならない。
3. The system shall not own any write — scope/deadline judgement (R-T4 follow-up), re-baseline, or c declaration are human commitment decisions owned by write skills — providing only deep links to their write contexts; for the R-T4 scope/deadline judgement, which requires both the health and schedule-time contexts, the system shall provide multiple deep links (to schedule-time/spec-value write contexts) and shall not collapse it into a one-side jump closed within the health context alone (UI-ARCH §6#4).
   - 和訳: システムは、いかなる write も所有してはならず——スコープ/期日判断（R-T4 後続）・再ベースライン・c 宣言は write skill が所有する人間のコミット判断である——それらの write 文脈への深リンクのみを提供しなければならない。R-T4 スコープ/期日判断は health と schedule-time の両文脈を要するため、システムは複数 deep-link（schedule-time/spec-value の write 文脈へ）を提供し、health 単文脈に閉じた片面飛びにしてはならない（UI-ARCH §6#4）。
4. The system shall render shared visual primitives (the R-S4/R-S6 de-rate hatch, coverage/progress bars, metric tiles, status tones) via the shared theme modules (`theme/atoms`, `theme/tokens`, and `gantt-geometry` where applicable) referenced by all surfaces, and shall not re-implement the R-S4/R-S6 de-rate presentation divergently in this surface (UI-ARCH §6); for this surface's own visualizations (the CCPM fever chart, the SPI/CPI trend line) it shall reuse the shareable shared primitives (bars, tiles, tones, de-rate hatch) from those modules, permitting surface-specific composition but not re-implementing a shared primitive divergently.
   - 和訳: システムは、共有視覚部品（R-S4/R-S6 の de-rate ハッチ・カバレッジ/進捗バー・メトリクスタイル・状態トーン）を全サーフェス共通の theme モジュール（`theme/atoms`・`theme/tokens`、該当する場合は `gantt-geometry`）から描画し、R-S4/R-S6 の de-rate 提示を本サーフェスで独自に再実装してはならない（UI-ARCH §6）。本サーフェス固有の可視化（CCPM フィーバーチャート・SPI/CPI トレンド線）についても、共通化可能な共有原子部品（バー・タイル・トーン・de-rate ハッチ）をこれらのモジュールから再利用し、サーフェス固有の合成は許すが共有原子部品を独自に再実装してはならない。
5. The system shall read each warning's available-actions enumeration (e.g. the R-T4 three choices, the R-S3 options) from the `moira-health` derivation layer and shall not re-define those action lists in this surface — the enumeration is single-sourced in the derivation layer (UI-ARCH §6#3); this surface is the deep-link originator only.
   - 和訳: システムは、各警告の取りうる行為の列挙（例: R-T4 の3択・R-S3 の選択肢）を `moira-health` 導出層から読み、本サーフェスでそれらの行為リストを再定義してはならない——列挙は導出層に一本化される（UI-ARCH §6#3）。本サーフェスは深リンクの発信元のみを担う。
6. The system shall treat the role (管理者/開発者) of this surface as an actor-kind preset/filter over the SAME single R-S2 derivation (the initial preset being 管理者 per UI-ARCH §5) and shall not physically split the surface by role to derive a separate, divergent value stream (the "two truths" prohibited by UI-ARCH §2.1, grounded in MODEL §2.1 "human-internal authority is out of scope" and the P4 spirit).
   - 和訳: システムは、本サーフェスの役割（管理者/開発者）を、同一の単一 R-S2 導出に対する actor 種別のプリセット/フィルタとして扱い（初期プリセットは UI-ARCH §5 に従い管理者）、役割で物理分割して別系統の乖離する値を導出してはならない（UI-ARCH §2.1 が禁ずる「二つの真実」。根拠は MODEL §2.1「人間内部の権威はスコープ外」と P4 の精神）。
7. Where the system displays a per-task EVM breakdown, it shall distinguish two tiers per UI-ARCH §6#6 and shall not conflate them: (a) the aggregate derive()-owned indices (EV%/EV_abs/PV/AC/SPI/CPI and the coverages, computed once by the R-S2 derivation) shall NOT be re-computed in this surface; (b) a per-node attribute projection — synthesizing a per-task PV/EV from per-node frozen attributes (`frozenBudget` under the single-leaf inclusion rule, `ac`) for display, and SV/CV as the differences of those displayed values (SV = EV − PV, CV = EV − AC) labelled as non-canonical presentation identities (grounded in `surfaces/schedule/Inspector.tsx`) — is permitted as a read-only display mapping and is NOT the prohibited second-system computation of an aggregate derive()-owned index.
   - 和訳: システムは、per-task の EVM 内訳を表示する場合、UI-ARCH §6#6 に従い二系統を区別し混同してはならない: (a) 集約 derive() 所有指標（EV%/EV_abs/PV/AC/SPI/CPI と各カバレッジ。R-S2 導出が一度だけ計算）を本サーフェスで再計算してはならない。(b) per-node 属性射影——per-node の凍結属性（単一葉算入規則下の `frozenBudget`・`ac`）から表示用に per-task PV/EV を合成し、SV/CV をそれら表示値の差分（SV = EV − PV・CV = EV − AC）として正典外の提示恒等式と明示する射影（参照実装 `surfaces/schedule/Inspector.tsx` に接地）——は read-only の表示用写像として許容され、集約 derive() 所有指標の禁止された二系統計算には当たらない。
