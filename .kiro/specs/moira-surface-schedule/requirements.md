# Requirements Document

## Introduction

`moira-surface-schedule` は Moira 正典モデル `moira/MODEL.md`(v19) を本番アーキテクチャへ落とす **CQRS 分解の Wave3 read サーフェス**であり、`moira/UI-ARCHITECTURE.md` が R-S2 に予約する三ダッシュボードの一つ `schedule-time`（スケジュール・時間）を担う。UI-ARCHITECTURE §3 のとおり、これは **全 actor 共通の母 view** であり、A1 上の射影（projection）であって独立した一級実体ではない。

本 surface は次を **提示の下限**（UI-ARCH §2 ②層: MODEL 既定・必須）として凍結する:

1. **Gantt + DAG ビューア** — 木×DAG 射影に、生きた予測スケジュール（P7、各サブ単位の予測完了）と凍結ベースライン完了スロット（各サブ単位の `frozenSlot`；MODEL §3。PV(t)/PMB 予算総和は health host）を両表示する。
2. **担当の常時表示** — 単一被割当者（R-T5）を行に常時表示する（スキル/習熟度は出さない＝A4/R-U6）。
3. **未割当バックログ** — 時間軸を持たない可視ギャップ（P0/R-U9）として Gantt 内に赤で表示し、未割当フィルタを提供する。
4. **担当付替** — 付替プルダウンから write skill（割当/リスケ）へ deep-link する（書き込みは所有しない）。
5. **R-S7 スロット陳腐化** — 原因別（割当変更 / c 変更）の可視ギャップとして提示する。
6. **人別日次充当健全性** — 人ごとの c(i,d) 充当（過負荷 R-T3）を read として可視化する。
7. **actor フィルタ** — actor 種別フィルタ（全員/人間/エージェント）で P4 の同一 DAG×ログクエリを actor 違いで読み、三キュー（作業/レビュー/エージェント）を被覆する（種別を切替えるのであって三キューを直接の選択肢として列挙するのではない；`human` は作業/レビューを束ねる）。
8. **SPI＋スケジュールカバレッジ de-rate strip（R-S6 の副 host）と未割当ギャップの割当付与動線** — SPI とスケジュールカバレッジを対で表示し、低カバレッジ時はカバレッジバーを淡色化（de-rate）＋注記で SPI を全体進捗と読ませない strip を、R-S6 の**副 host**として描画する（主 host=`moira-surface-health`・集約スケジュールカバレッジの host も health。SPI 値は素値表示・health と同一導出の read・再計算なし；UI-ARCH §4.1/§4.3）。あわせて scheduleCoverage 低下の原因となる未割当を可視ギャップ（P0/R-U9）として提示し、割当付与（write・カバレッジ改善）へ deep-link する。
9. **期日超過アラート（R-T4）の read 表示と deep-link** — 導出スケジュールが外部期日を超えた事実を read で表示し、判断（health）と実行への deep-link のみを所有する（R-T4 の主集約は inbox・判断は health；本 surface は実行動線としての read 表示と deep-link に限る）。
10. **P5 at-risk（解放済み後続）の read 表示と deep-link** — 起点ノードの後退で at-risk となった**解放済み後続**を、本 surface（Gantt/スケジュール文脈）の副 host として read 表示し、起点ノードの再到達（write）へ deep-link する。起点ノードの主 host は `moira-surface-spec-value`、主集約は inbox（UI-ARCH §4.2 P5 文脈ビュー＝spec-value／health/schedule-time〔解放済み後続〕）。
11. **R-C3 キャンセル孤児の read 表示と deep-link** — cancel により永久充足不能となった依存（孤児）を、本 surface（スケジュール文脈）の文脈ビューとして read 表示し、辺除去/付替/後続 cancel の write へ deep-link する。主集約は inbox、文脈ビューは spec-value と schedule-time の双方（UI-ARCH §4.2 R-C3 文脈ビュー＝spec-value／schedule-time）。孤児の**検出（述語評価）は上流 `moira-scope-deps` が所有**し、本 surface は読むだけ。

本 surface は **read-only** であり（UI-ARCH §6: 自前状態・隠れキャッシュ・dismiss フラグを持たず、derive() を読むだけで再計算しない）、上流 `moira-schedule`（導出）および推移的に `moira-core`（emit/derive 契約・effective-set・latest-wins・二層データ）の導出出力を **消費**する。MODEL を唯一の真実源（SSOT）とし、MODEL/UI-ARCHITECTURE の文言を変えず・新概念を足さず、その提示の下限を写すことに徹する。**検出=読 / 解消=書 の分離**（roadmap）に従い、陳腐化・de-rate・過負荷・未割当ギャップは検出（読）のみを所有し、再ベースライン・再割当・c 改定は write skill へ委譲する。

## Boundary Context

- **In scope（本 surface が所有）**: Req1–15 が host する read 提示と deep-link。すなわち read-only 母 view 規律（Req1）、Gantt＋DAG ビューア＝予測/凍結 slot 両表示・ノード状態副 host（Req2）、担当（作業者）の常時表示とレビュー担当 reviewer の併設表示（Req3；reviewer は v19 で AC4 追加・read-only・非平準化）、未割当バックログの赤表示＋未割当フィルタ（Req4）、担当付替プルダウンの deep-link（Req5）、R-S7 スロット陳腐化の原因別可視ギャップ（Req6）、人別日次 c 充当健全性＝R-T3 過負荷の read（Req7）、actor kind フィルタ（Req8）、SPI＋スケジュールカバレッジ de-rate strip の副 host 描画＋未割当ギャップの割当付与 write 文脈づけ（Req9；主 host・集約 scheduleCoverage は health・本 surface は副 host の read strip と deep-link のみ）、R-T4 期日超過の read 表示と判断・実行 deep-link（Req10）、P5 解放済み後続の副 host read と起点再到達 deep-link（Req11）、R-C3 キャンセル孤児の文脈ビュー read と解消 write deep-link（Req12）、人間レビュー待ちキューの一覧描画＝玉がエージェント作業→人間レビューへ（Req13；既存 actor 非依存導出の read 描画新設）、レビュー待ちの reviewer フィルタ＝レビュー担当を選んで絞る（Req14；提示層・per-node `reviewer` 選択・現状スライス未供給で無効）、作業詳細 Inspector の予定/実績 開始・終了日と per-task EVM（Req15；予定終了 frozenSlot 実在・予定開始/実績開始/実績終了は新規導出）。各 Req 本文と AC が責務の正本であり、本行は索引である。
- **Out of scope（上流/他 spec が所有）**: スケジュール導出ロジック本体（leveler P7/P8・予測 forecast・slot 充填・schedule被覆・D_pred・buffer R-T6 導出）= `moira-schedule`、emit/derive 契約・effective-set・latest-wins・二層データ・凍結ベースラインの記録機構（R-U7/I4）= `moira-core`、担当・c・再ベースライン・スコープ/期日の **書き込み**（イベント/構成入力の追記・人間承認）= `moira-assign-schedule`/`moira-reschedule`/`moira-capacity`/`moira-rebaseline`/`moira-project-config`、9 warning の確定・集約・clearance・行為列挙の単一定義 = `moira-health`、バッファ残量/消費率（R-T6）・SPI/CPI トレンド・CCPM フィーバー・**SPI を scheduleCoverage で de-rate する表示の主 host と集約 scheduleCoverage の host（R-S6；UI-ARCH §4.1/§4.3。本 surface は同一導出を read する副 host strip を持つが、主 host・集約値・再計算は health）** = `moira-surface-health`、EV%・見積カバレッジ・実行カバレッジ・現行有効集合の EV% = `moira-surface-spec-value`、decision インボックスの横断集約・ルーティング = 別面（UI-ARCH §3 層B）。
- **Reference-implementation deviation（参照実装＝フォワード本番との乖離・read-only 規律の立証）**: 参照実装 `moira/frontend/src/surfaces/schedule/Inspector.tsx`（行 67–73, 80–125, 178–197）は action zone で `appendEvent` により lifecycle 遷移・見積合意（agree）・再見積（reestimate）・担当付替（reassign）を **surface 内で直接 write** している。これは本 surface の read-only 規律（Intro／Req1.1／Req5.1 の「書き込みを所有しない」）と乖離する。本 spec はこの inline write を **本 surface のスコープから除外**し、対応する write を CQRS の write skill へ移管する: lifecycle 遷移＝`moira-progress`、見積合意/再見積＝`moira-estimate-agree`、担当付替＝`moira-assign-schedule`（roadmap「書き/オペ skill」#2/#4/#5・「検出=読 / 解消=書 の分離」）。本 surface は付替プルダウン等の **deep-link（参照）のみ**を所有し、書き込みは行わない（Req5）。すなわち Req5 の read-only 主張は参照実装の inline write を**意図的に否定する**設計判断であり、本 note でその乖離を接地する（SPI＋scheduleCoverage de-rate strip については、ユーザー裁定により schedule-time を R-S6 の**副 host**として確定済み——下記 Req9 参照——ゆえ参照実装 `ScheduleTimeSurface.tsx` の strip 描画は乖離ではなく整合する）。
  - **per-node 属性射影（taskPv/taskEv/SV/CV）の接地（乖離ではない・確定 FORK 反映）**: 参照実装 `Inspector.tsx`（行 50–56）は per-node 属性（`frozenBudget`/`frozenSlot`/`predictedCompletion`/`ac`）から taskPv／taskEv／sv（=EV−PV）／cv（=EV−AC）を surface 内で合成する。**ユーザー裁定（2026-06-22）により、この per-node 属性射影は read-only として許容される**（UI-ARCH §6 の二段の許容射影——(i) PV/EV は per-node 属性の射影、(ii) SV/CV はそれら表示値の差分による提示恒等式であり canon index ではない）。これは集約 derive() 所有指標の二系統計算ではなく、属性の表示用写像ゆえ §6 の「二系統計算の禁止」に当たらない（線引きは UI-ARCH §6 に明記済み）。したがって Req1.2 は per-node 射影を**禁止せず許容**し、本ノート は参照実装 `Inspector.tsx`（行 50–56 コメント「SV/CV are presentation identities (differences of the above), not canon indices」）が本 surface の read-only 規律と**整合する**ことを接地する。禁止が及ぶのは集約 derive() 所有指標（SPI/CPI・EV%/EV_abs・各カバレッジ・予測）の再計算のみである。
  - **P5 解放済み後続の schedule-time 副 host 新設（参照実装に無い host の追加）**: Req11 は P5 at-risk の**解放済み後続**を schedule-time（Gantt 文脈）の副 host として read 表示すると規定するが、参照実装 `moira/frontend/src/moira/warnings.ts`（行 64–76）は P5 を **起点ノード**（implemented 後に後退したノードそのもの）について `surface: 'spec-value'` 一本で inbox 集約しており、schedule-time 上の「解放済み後続」read シグナルは実装に存在しない。Req11 の schedule-time 副 host は UI-ARCH §4.2 P5 行（文脈ビュー＝spec-value〔起点〕／health・schedule-time〔解放済み後続〕）に**忠実化する設計判断**であり、参照実装 `warnings.ts`（spec-value 一本・起点ノード集約）に対する追加である。あわせて参照実装 `DerivedState` は released-successors を read 面として導出していない（上記 Adjacent expectations「必要な上流 read 契約」(d) 参照）ため、この副 host は上流 derive 契約の拡張を前提とする。
- **Adjacent expectations**: 本 surface は `moira-schedule`/`moira-core` の derive() 出力（forecast〔frozenSlot/predictedCompletion〕・scheduleCoverage・unassignedBacklog・queues・各ノード状態・supersede 辺/effective-set・SPI）を **読むだけ**で、いかなる集約導出指標も再計算しない（SPI/R-S6 de-rate の**主 host**・集約スケジュールカバレッジの host は `moira-surface-health` であり、本 surface は同一導出を read する**副 host** strip として SPI＋scheduleCoverage を対表示・低カバレッジで淡色化するに留まり〔Req9〕、SPI 値・de-rate・集約値を再計算しない）（UI-ARCH §6 二系統計算の禁止）。上流の derive 契約・スキーマの形が変われば本 surface の提示も再検証を要する。
- **必要な上流 read 契約（参照実装 `DerivedState` に未存在・新設要）**: 本 surface が host を主張する Req6（R-S7 原因別陳腐化カウント）・Req7（人別 c(i,d) 充当・R-T3 過負荷）・Req10（R-T4 期日超過量）・Req11（P5 解放済み後続）・Req12（R-C3 孤児）の各 read データは、いずれも上流 derive() 出力を「読むだけ」と宣言するが、**参照実装の read 契約 `moira/backend/src/types.ts` の `DerivedState`（MODEL v14 時点の 11 導出のみ）にはこれらが一切公開されていない**。具体的には: (a) `ForecastRow`（`predictedCompletion`/`frozenSlot` のみ）には R-S7 の**原因別属性（割当変更／c 変更）**が無く、Req6.1 の cause 別カウントを供給する read 口が存在しない。(b) `acByNode`（per-node AC）はあるが、**per-person c(i,d) 充当**（Req7.1）を供給する読み口が無い。(c) **R-T4 overrun magnitude**（Req10.1＝導出完了−期日）、(d) **P5 released-successors**（Req11.1）、(e) **R-C3 orphan**（Req12 の孤児リスト・現状 `warnings.ts` の inbox 集約に内在するのみで `DerivedState` に read 面として無い）、いずれも未公開である。したがって本 surface の「読むだけ」が design 段で成立するには、これらの read データ（R-S7 原因別カウント／per-person c 充当／R-T4 overrun／P5 released-successors／R-C3 orphan、およびそれぞれの cause/attribution）を **上流 `moira-schedule`／`moira-health`／`moira-scope-deps` が derive 契約へ新たに追加する**ことが前提となる。これは上記 Adjacent expectations の「derive 契約の形が変われば再検証」に該当する具体項目であり、参照実装 v14 `DerivedState`（11 導出）に未存在である事実を本 surface のスコープ前提として接地する（design はこの read 契約拡張を上流 spec への依存として明示すること）。さらに **v19/reviewer・作業詳細日付の新規 Req（Req3 AC4／Req13–15）** が依存する read データのうち次は同様に上流契約の拡張を前提とする: (f) **per-node の指名 reviewer**（Req3 AC4／Req15 が読む reviewer identity）——供給は `moira-core` の fold（`ProjectedNode.reviewer`・latest-wins。`types.ts` に v19 で追加済）だが、**`DerivedState` の read 行（`NodeStateRow`/`ForecastRow`）には reviewer が未公開**であり、`moira-schedule` Req14 が per-node reviewer を read として併置する契約拡張を前提とする。(g) **作業詳細の予定開始／実績開始／実績終了**（Req15）——`moira-schedule` Req13 が新設する per-node 導出（実績＝lifecycle `→implementing`／`→implemented` 時刻、予定開始＝予定終了−所要）に依存し、現行 `ForecastRow` は `predictedCompletion`/`frozenSlot` の二項のみで**これら三日付の read 口が無い**。(h) **reviewer 選択フィルタ**（Req14）——これは derive 契約ではなく**提示層の絞り込み**で、per-node `reviewer`（Actor {kind,id}・上記(f)で fold が供給）を選んだレビュー担当と突き合わせる（MODEL 非保持・§7#18(f)；視点 actor/『自分』概念を要さない）。参照実装フロントエンドは reviewer 選択フィルタ自体が未供給の既知ギャップである（derive 契約の問題ではなく提示層への reviewer 選択 UI 導入を要する）。なお **人間レビュー待ちキューの一覧描画（Req13）は新たな derive 契約を要しない**——`DerivedState.humanReviewQueue` は既存（actor 非依存）であり、Req13 が新設するのは既存導出を消費する**一覧の read 描画**のみである（現フロントエンドは未描画＝§Req13 deviation note）。warning の **消滅トリガー**（R-S7 再ベースライン/再収束、R-T3 再割当/c 変更、R-T4 スコープ削減/要員追加/期日変更、P5 当該起点ノードの implemented 再到達〔後続自身の完了では消えない〕、R-C3 辺除去/付替 or 後続 cancel）は write 側で起き、追記後に derive() が再評価されると条件が偽化した項目は自動的に消える（本 surface は dismiss フラグを持たない）。P5 起点ノードと R-C3 孤児の**検出（述語評価）は上流が所有**し（P5/R-C3 検出＝`moira-health`／孤児述語＝`moira-scope-deps`、解放済み後続は `moira-schedule` の forecast/queues に現れる）、本 surface は解放済み後続・孤児を**読むだけ**で再計算しない（UI-ARCH §6 二系統計算の禁止）。

## Requirements

### Requirement 1: schedule-time 母 view と read-only 規律（R-S2・UI-ARCH §3/§6）

**Objective:** read サーフェス利用者として、同一ログから導出されたスケジュール状態を、全 actor 共通の母 view で読むだけのダッシュボードがほしい。それにより自前状態を持たず、二系統計算による「二つの真実」を避けられる。

#### Acceptance Criteria

1. The system shall present the `schedule-time` surface as a read-only view over the upstream-derived state, holding no source of truth, no hidden mutable cache, and no dismiss/seen flag of its own.
   - 和訳: システムは `schedule-time` サーフェスを、上流の導出状態に対する read-only view として提示し、真実源も隠れた可変キャッシュも自前の dismiss/既読フラグも持ってはならない。
2. The system shall read every displayed value — node states, the live forecast schedule, frozen baseline slots, schedule coverage, unassigned backlog, and queues — from the same single upstream derivation (R-S2), never recomputing any aggregate derive()-owned metric (e.g. SPI/CPI, EV%/EV_abs, coverage, forecast) (UI-ARCH §6: deep-link は再計算でなく参照・二系統計算の禁止). The system may project per-node display values (per-task PV/EV from per-node attributes `frozenBudget`/`frozenSlot`/`predictedCompletion`/`ac`, and the presentation identities SV=EV−PV / CV=EV−AC as differences of those displayed values) as a read-only attribute mapping — this is permitted because it is an attribute projection, not a second computation of an aggregate derive()-owned metric (UI-ARCH §6: 集約 derive() 所有指標 vs per-node 属性射影の二段の許容).
   - 和訳: システムは、表示する全ての値（各ノード状態・生きた予測スケジュール・凍結ベースライン slot・スケジュールカバレッジ・未割当バックログ・各キュー）を、同一の上流導出（R-S2）から読み出し、derive() 層が所有する**集約**導出指標（SPI/CPI・EV%/EV_abs・各カバレッジ・予測など）をサーフェス内で再計算してはならない（UI-ARCH §6: deep-link は再計算でなく参照・二系統計算の禁止）。システムは per-node の表示値（per-node 属性 `frozenBudget`/`frozenSlot`/`predictedCompletion`/`ac` からの per-task PV/EV、およびそれら表示値の差分による提示恒等式 SV=EV−PV／CV=EV−AC）を **read-only の属性射影として合成してよい**——これは属性の表示用写像であって集約 derive() 所有指標の二系統計算ではないため許容される（UI-ARCH §6 の「集約 derive() 所有指標 vs per-node 属性射影」の二段）。
3. When an event is appended or a configuration input (c, deadline, target date) changes upstream, the system shall reflect the re-derived schedule state on the next read without maintaining its own derivation.
   - 和訳: 上流でイベントが追記されるか構成入力（c・期日・目標日）が変化したとき、システムは自前の導出を保持せず、次の読み出しで再導出されたスケジュール状態を反映しなければならない。
4. The system shall present the surface as a projection over the currently-effective tree, excluding cancelled and superseded nodes from the schedule view while leaving their accounting to upstream derivations.
   - 和訳: システムは本サーフェスを現行有効木上の射影として提示し、cancelled・supersede 済みノードをスケジュール表示から除外しつつ、それらの会計は上流導出に委ねなければならない。

> **裁定済（FORK 決着・2026-06-22 ユーザー裁定／per-node 射影と SV/CV の扱い）:** 参照実装 `moira/frontend/src/surfaces/schedule/Inspector.tsx`（行 50–56）の per-node 属性（`frozenBudget`/`frozenSlot`/`predictedCompletion`/`ac`）からの **taskEv／taskPv／sv＝EV−PV／cv＝EV−AC** 合成は、**read-only の per-node 属性射影として許容**することが裁定された。UI-ARCH §6 に二段の許容射影が明記済みである——(i) **PV/EV は per-node 属性（`frozenBudget`）の射影**、(ii) **SV/CV はそれら表示値の差分による提示恒等式（canon index ではない）**——ゆえ §6「二系統計算の禁止」が及ぶのは**集約 derive() 所有指標**（SPI/CPI・EV%/EV_abs・各カバレッジ・予測）の再計算のみであり、per-node 属性射影はその対象外である。したがって Req1.2 は per-node 射影を**許容**する立場で確定し、参照実装 `Inspector.tsx`（行 50–56 コメント「SV/CV are presentation identities (differences of the above), not canon indices」）と整合する（再 fork にしない）。

### Requirement 2: Gantt + DAG ビューア（予測スケジュールと凍結 slot の両表示）（R-S2〔生きた予測スケジュール／各ノード状態 副 host〕・A5/R-U11〔エージェント区別・過負荷マーカー無し〕・R-T2 read 面〔エージェント span 表示〕）

**Objective:** 管理者として、木×DAG の構造の上で「予定（凍結ベースライン）」と「予測（生きた予測）」を同時に読みたい。それにより両者の乖離（先行/遅れ）を構造に沿って把握できる。

#### Acceptance Criteria

1. The system shall display a Gantt over the tree×DAG projection together with a DAG viewer as a reusable component, showing dependency edges between nodes.
   - 和訳: システムは木×DAG 射影の上に Gantt を、依存辺をノード間に示す DAG ビューアを再利用部品として併せて表示しなければならない。
2. The system shall display, for each sub-unit, both the live forecast completion (the live forecast schedule of P7, each sub-unit's predicted completion) and the frozen baseline completion slot (the per-sub-unit `frozenSlot`; MODEL §3), distinctly so that the two are not conflated; the PV(t)/PMB budget total (the time-phased baseline budget sum) is a health-hosted quantity (UI-ARCH §4.1 PV 主 host=health) and is not drawn in this surface.
   - 和訳: システムは各サブ単位について、生きた予測完了（P7 の生きた予測スケジュール・各サブ単位の予測完了）と凍結ベースライン完了スロット（各サブ単位の `frozenSlot`；MODEL §3）の両方を、両者が混同されないよう区別して表示しなければならない。PV(t)/PMB の予算総和（time-phased なベースライン予算の総和）は health が host する量（UI-ARCH §4.1 PV 主 host=health）であり、本サーフェスでは描画しない。
3. The system shall display agent work as schedulable spans between human touchpoints, visually distinct from human work, without drawing an over-allocation marker on agent rows (agents are not leveled; A5/R-U11). The agent span's lead time contributes to the derived completion / critical path **unconditionally regardless of successor kind — including a trailing agent span with no human successor** (PR-CRITPATH-AGENT / R-T2; rate-limiting a human successor is only the representative case — see Req10 AC1), so a trailing agent span must not be visually dropped from the timeline.
   - 和訳: システムはエージェント作業を、人間接点間の実行可能スパンとして人間作業と視覚的に区別して表示し、エージェント行に過負荷マーカーを描いてはならない（エージェントは平準化されない；A5/R-U11）。エージェント・スパンのリードタイムは後続種別を問わず**無条件に**——**後続の無い末尾エージェント・スパンを含め**——導出完了／クリティカルパスへ寄与する（PR-CRITPATH-AGENT／R-T2；人間後続を律速する場合は代表例にすぎない——Req10 AC1 参照）ため、末尾エージェント・スパンをタイムライン表示から落としてはならない。
4. The system shall reference the same frozen baseline (the upstream-recorded `frozenSlot` baseline) as the health surface for the baseline band, never recomputing the baseline in this surface (UI-ARCH §4.1: PV 副 host=schedule-time「同一ベースラインを参照・再計算しない」).
   - 和訳: システムは凍結ベースライン帯について health サーフェスと同一の凍結ベースライン（上流が記録する `frozenSlot` ベースライン）を参照し、本サーフェスでベースラインを再計算してはならない（UI-ARCH §4.1: PV 副 host=schedule-time「同一ベースラインを参照・再計算しない」）。
5. The system shall display each node's lifecycle state (including `ready`/`implementing`/`implemented`/`accepted` and the visually distinguished `cancelled`) on its Gantt row as a sub-host (the main host of node state is `spec-value`; UI-ARCH §4.1「各ノード状態 主=spec-value／副=schedule-time（Gantt 上）」), reading the lifecycle state from upstream and never recomputing it.
   - 和訳: システムは各ノードの lifecycle 状態（`ready`/`implementing`/`implemented`/`accepted`、および視覚的に区別する `cancelled` を含む）を、その Gantt 行上に**副 host** として表示しなければならない（各ノード状態の主 host は `spec-value`；UI-ARCH §4.1「各ノード状態 主=spec-value／副=schedule-time（Gantt 上）」）。lifecycle 状態は上流から読み取り、本サーフェスで再計算してはならない。
   - 注（ready の二語分離）: ここで表示する `ready` は **lifecycle 状態（progress emit による状態）としての語**であり、本サーフェスは `ready-eligible` 導出（依存充足述語 R-D1/D2/D4＝上流 `moira-scope-deps` 所有）を自前で導出してはならない（roadmap line 123「ready=lifecycle 状態(progress emit)＋ready-eligible 導出(scope-deps)の二語分離」・UI-ARCH §6）。

### Requirement 3: 担当（作業者）の常時表示とレビュー担当の併設表示（R-T5・A4/R-U6・§7#18）

**Objective:** 利用者として、各タスクの担当（作業者 assignee）が誰かを常に見たい。それにより割当の偏りや未割当を一目で把握できる。あわせて、`implemented`（レビュー待ち）のノードについては、その `implemented→accepted` を行うべく指名された **レビュー担当 reviewer** を、担当（作業者）とは別に同じ行で読みたい（v19；MODEL §2.4/R-T5/§7#18）。いずれも identity（avatar/name）のみで、スキル/習熟度は出さない（A4/R-U6）。

#### Acceptance Criteria

1. The system shall display the single assignee of each node as an always-visible property of the row, showing the assignee as identity (avatar/name) only.
   - 和訳: システムは各ノードの単一被割当者を、行の常時表示プロパティとして表示し、被割当者を識別情報（アバター/名前）としてのみ示さなければならない。
2. The system shall not display any human skill or proficiency for the assignee, treating assignment purely as a human-provided input read from upstream.
   - 和訳: システムは被割当者について人間のスキルや習熟度を一切表示せず、割当を上流から読み取った人間が与える入力としてのみ扱わなければならない。
3. When upstream records a new assignee by `(ts,id)` latest-wins, the system shall display the current single assignee, never accumulating multiple assignees on one node.
   - 和訳: 上流が `(ts,id)` latest-wins で新しい被割当者を記録したとき、システムは現行の単一被割当者を表示し、一ノードに複数の被割当者を蓄積してはならない。
4. The system shall display, alongside the assignee and distinct from it, the designated `reviewer` (the human to perform `implemented→accepted`) on a node awaiting review, as identity (avatar/name) read from the per-node attribute projected by `moira-core` (`ProjectedNode.reviewer`, latest-wins; `moira-schedule` Req14), so that a node whose worker is an agent while its reviewer is a human is read correctly. Where no reviewer is designated, the system shall present it as an "undesignated" visible gap (P0/R-U9) and shall not fabricate one. The reviewer **attribute** is a read-only display that consumes no leveling/EV/PV/coverage (the non-interference is of the reviewer *designation*; review *work* nodized as a normal A1 node earns EV via its OWN assignee — a separate concern, PR-ASSIGNEE-REVIEWER / §7#18(b)) and is never the schedulable assignee; designating/changing a reviewer is a human commitment (§2.1#2 assignment) routed to a write skill via deep-link (Req5-isomorphic), never written in this surface.
   - 和訳: システムは、被割当者と並べて（かつそれと区別して）、レビュー待ちノードの指名 `reviewer`（`implemented→accepted` を行う人間）を、`moira-core` が射影する per-node 属性（`ProjectedNode.reviewer`・latest-wins；`moira-schedule` Req14）から読み取り identity（avatar/name）で表示し、作業者がエージェントでレビュー担当が人間であるノードが正しく読まれるようにしなければならない。reviewer 未指名の場合は『未指名』の可視ギャップ（P0/R-U9）として提示し、捏造してはならない。reviewer **属性**は平準化/EV/PV/coverage を消費しない read-only 表示であり（非干渉は reviewer の**指名**についての話で、レビュー**作業**を A1 通常ノードとして立てた場合はそのノード自身の assignee を通じて EV を獲得する——別論点；PR-ASSIGNEE-REVIEWER／§7#18(b)）、スケジュール対象の被割当者では決してない。reviewer の指名・変更は write skill へ deep-link でルーティングされる人間のコミット判断（§2.1#2 割当）であり（Req5 同型）、本サーフェスでは書き込まない。

### Requirement 4: 未割当バックログの可視ギャップ表示と未割当フィルタ（P0/R-U9・R-T5）

**Objective:** 管理者として、まだ誰にも割り当てていない合意済みタスクを見落とさず、絞り込んで把握したい。それにより未コミット領域を「偽の余裕」として暗黙に仮定せずに済む。

> **同一集合の明記（可視ギャップを二重計上しない・Req9 との関係）:** 本モデルでは「合意済みだが未スケジュール＝未割当」であり、ノードは初回スケジュール載り（＝初回割当）で初めて PV/スケジュールに入る（MODEL §3 PV(t)・P0）。したがって本 Req4 の「未割当バックログ（被割当者のいない合意済みノード）」と、Req9 が R-S6 警告の write 文脈として指す「未スケジュール（未割当）の合意作業」は**同一の P0/R-U9 可視ギャップ集合**であり（参照実装でも単一の `derived.unassignedBacklog` を読む）、別集合ではない。本 surface はこの可視ギャップを**一度だけ会計**し、二重計上しない。役割分担は (a) Req4＝可視ギャップそのもの（Gantt 内赤の time-less lane）＋未割当フィルタの提示、(b) Req9＝同一ギャップを **R-S6 警告の write 文脈**（割当付与が scheduleCoverage を上げる）として deep-link する側面、という**同一集合の二つの側面**である。

#### Acceptance Criteria

1. The system shall display the unassigned backlog (agreed nodes without an assignee) as a visible gap in a time-less lane within the Gantt view, marked in red.
   - 和訳: システムは未割当バックログ（被割当者のいない合意済みノード）を、Gantt 内の時間軸を持たない lane に可視ギャップとして赤で表示しなければならない。
2. The system shall present the unassigned backlog as a visible gap and shall not implicitly assume the uncommitted (unassigned) region as scheduled.
   - 和訳: システムは未割当バックログを可視ギャップとして提示し、未コミット（未割当）領域をスケジュール済みとして暗黙に仮定してはならない。
3. Where an unassigned filter is applied, the system shall narrow the view to unassigned nodes so the user can focus on the uncommitted region.
   - 和訳: 未割当フィルタが適用される場合、システムは表示を未割当ノードへ絞り込み、利用者が未コミット領域に集中できるようにしなければならない。

### Requirement 5: 担当付替プルダウン（deep-link；検出=読 / 解消=書 の分離）（R-T5）

**Objective:** 管理者として、割当を変えたいときに付替の導線をその場で開きたい。ただし書き込み自体は write skill が持つ。それにより read サーフェスが write 責務を侵さない。

#### Acceptance Criteria

1. The system shall provide a re-assignment pulldown on a node that deep-links to the assignment/reschedule write skill, without performing the write in this surface.
   - 和訳: システムはノード上に、割当/リスケの write skill へ deep-link する付替プルダウンを提供し、本サーフェスでは書き込みを行ってはならない。
2. The system shall treat detection (reading the assignment/unassigned state) and resolution (the assignment write) as separated, owning detection only and routing resolution to the write skill.
   - 和訳: システムは検出（割当/未割当状態の読み出し）と解消（割当の書き込み）を分離したものとして扱い、検出のみを所有し解消を write skill へルーティングしなければならない。
3. When the assignment write is appended upstream and the schedule is re-derived, the system shall reflect the updated assignment and schedule on the next read.
   - 和訳: 割当の書き込みが上流で追記されスケジュールが再導出されたとき、システムは次の読み出しで更新後の割当とスケジュールを反映しなければならない。

### Requirement 6: スロット陳腐化（R-S7）の原因別可視ギャップ提示（R-S7）

**Objective:** 管理者として、凍結ベースライン slot が生きた予測から乖離した（陳腐化した）タスクを、原因別に把握したい。それにより再ベースラインすべきか据え置くかを判断できる。

#### Acceptance Criteria

1. While a sub-unit's live-forecast completion diverges from its frozen baseline slot, the system shall flag the baseline slot as potentially stale and surface the stale-slot count, attributed by cause (an assignment change, or a capacity c(i,d) change such as a holiday/leave), as a visible gap alongside schedule coverage.
   - 和訳: あるサブ単位の生きた予測完了が凍結ベースライン slot と乖離している間、システムはベースライン slot を陳腐化の可能性ありとして標識し、陳腐化スロット数を原因別（割当変更、または祝日・休暇などの容量 c(i,d) 変更）に、スケジュールカバレッジと並ぶ可視ギャップとして提示しなければならない。
2. The system shall route the human to re-baseline or confirm via deep-link, and shall present "confirm" (a deliberate non-commitment to keep the baseline) as not clearing the stale flag.
   - 和訳: システムは人間に再ベースラインまたは確認を deep-link で促し、「確認」（ベースラインを意図的に維持する非コミット）を陳腐化標識を消さないものとして提示しなければならない。
3. The system shall keep a still-diverging stale slot in the visible-gap accounting even when its salience is suppressed (collapsed/de-emphasized), never removing it from the count while the divergence holds.
   - 和訳: システムは、依然乖離している陳腐化スロットを、顕著さを抑制（畳む・淡色化）した場合でも可視ギャップの会計に残し、乖離が続く限りカウントから除いてはならない。
4. When a reason-stamped re-baseline is appended upstream or the live forecast re-converges to the slot, the system shall reflect the cleared stale flag on the next read.
   - 和訳: 理由付き再ベースラインが上流で追記されるか、生きた予測が slot へ再収束したとき、システムは次の読み出しで解除された陳腐化標識を反映しなければならない。

### Requirement 7: 人別日次充当健全性と過負荷（R-T3）の可視化（R-T3・R-U11）

**Objective:** 管理者として、人ごとの日次容量 c の充当が過負荷になっていないかを read で把握したい。それにより誰の・いつの割当を再調整すべきかを判断できる。

#### Acceptance Criteria

1. The system shall display per-person daily capacity c(i,d) allocation health so that a person's leveling load over a window is visible.
   - 和訳: システムは人別の日次容量 c(i,d) 充当健全性を、ある人物の期間内の平準化負荷が見えるように表示しなければならない。
2. While a human-provided assignment cannot fit c(i,d) leveling for some person over some window — including AC recorded on a c=0 day — the system shall surface the over-allocation, identifying the person and window, as a read signal routed to re-assignment (deep-link), not resolved in this surface.
   - 和訳: 人間が与えた割当が、ある人物・ある期間で c(i,d) 平準化に収まらない間（c=0 の日に AC が計上された場合を含む）、システムは当該人物と期間を特定する過負荷を、再割当へ deep-link する read シグナルとして提示し、本サーフェスでは解消しないものとしなければならない。
3. The system shall raise the over-allocation signal only against human resources and shall not raise it for agent resources, which are unconstrained.
   - 和訳: システムは過負荷シグナルを人間資源に対してのみ表出し、制約対象外であるエージェント資源には発してはならない。

### Requirement 8: actor 種別フィルタ（同一クエリで三キューを被覆）（P4）

**Objective:** 利用者として、actor 種別（全員/人間/エージェント）フィルタで同一 view を切り替え、作業/レビュー/エージェントのキューを同一導出から被覆して読みたい（種別フィルタが三キューを被覆する；`human` は作業/レビューを束ね、作業 vs レビューの分割は別軸=lifecycle）。それにより役割で物理分割せず、同一導出を乖離させずに読める。

#### Acceptance Criteria

1. The system shall provide an actor-**kind** filter (all / human / agent) that reads the same DAG×log query under different actor filters (P4), never as separately computed queries. The `human` kind bundles the human review and human work queues (the reference label is 「人間（レビュー/作業）」); the filter selects by actor *kind*, not by a work/review split (work vs review is a different axis — lifecycle state — not this filter).
   - 和訳: システムは、同一 DAG×ログクエリを actor フィルタ違い（P4）で読む actor **種別**フィルタ（全員 / 人間 / エージェント）を提供し、別々に計算されたクエリとしてはならない。`human` 種別は人間レビューキューと人間作業キューを束ねる（参照ラベルは「人間（レビュー/作業）」）。本フィルタが切るのは actor の**種別**であって作業/レビューの分割ではない（作業 vs レビューは別軸＝lifecycle 状態であって、本フィルタの軸ではない）。
   - 注（被覆との接地）: UI-ARCH §4.1 行 68 が「actor フィルタで作業/レビュー/エージェントの三キューをカバー」と言うのは、P4 の同一クエリを actor 種別違いで読むことで**三キューを被覆する**という意味であり、本フィルタが「三キュー」を直接の選択肢として列挙するという意味ではない（MODEL P4 が名指すのは「エージェント作業キュー／人間レビューキュー」の2種）。
2. The system shall treat the human role (manager/developer) as a filter or initial preset over the same derivation, never as a physical split that computes a separate schedule.
   - 和訳: システムは人間の役割（管理者/開発者）を、別個のスケジュールを計算する物理分割としてではなく、同一導出に対するフィルタまたは初期プリセットとして扱わなければならない。
3. The system shall keep the surface as the common mother view for all actors, with the actor filter changing only which subset is shown, not which derivation is read. The filter acts on leaf rows only; structural scaffolding (parent/non-leaf nodes) is retained regardless of the filter so the tree structure stays intact (参照実装 `gantt-geometry.ts` 行 111 `|| !isLeaf` の scaffolding 規律).
   - 和訳: システムは本サーフェスを全 actor 共通の母 view として保ち、actor フィルタが変えるのは表示される部分集合のみで、読み出す導出ではないようにしなければならない。絞り込みは**葉ノード**に作用し、**構造足場（親ノード／非葉ノード）はフィルタに依らず保持**して木構造を保つ（参照実装 `gantt-geometry.ts` 行 111 `|| !isLeaf` の scaffolding 規律）。すなわちここでの「部分集合」は**葉の部分集合**を指し、親足場は常時表示される。

### Requirement 9: SPI＋スケジュールカバレッジ de-rate strip の副 host 描画と未割当ギャップの割当付与 write 文脈（R-S6 副 host・主 host は health）

**Objective:** 利用者として、スケジュール文脈で SPI とスケジュールカバレッジを対で読み、低カバレッジ時に SPI を全体進捗と誤読しないよう de-rate（カバレッジバーの淡色化＋注記）された strip を見たい。あわせて管理者として、scheduleCoverage を下げている未割当の合意作業について、割当付与 write へ進めたい。ただし SPI の de-rate の主 host・集約スケジュールカバレッジの host は `moira-surface-health` であり、本 surface は同一導出を read する**副 host** strip を描くに留まる。

> **最小性の注（Req4/Req5/Req8 との非冗長性）:** 本 Req9 は Req4（同一可視ギャップの提示・上記 Req4 脚注で同一集合と明記）および Req5/Req8（割当 write への deep-link 動線）と機能的に一部重なる。本 Req9 が固有に立てるのは二点である: (a) **SPI＋スケジュールカバレッジ de-rate strip を R-S6 の副 host として描画する**こと（参照実装 `ScheduleTimeSurface.tsx` 行 25–77 整合・UI-ARCH §4.1/§4.3）、(b) 同一未割当ギャップを R-S6 警告の write 文脈（割当付与が scheduleCoverage を上げる）として位置づける**否定的境界**——すなわち **R-S6 de-rate の主 host・集約スケジュールカバレッジの host は `moira-surface-health` であり、schedule-time はその主 host でも集約値の host でもなく、同一導出を read する副 host strip と deep-link のみを所有する**こと。割当 deep-link 動線そのものは Req5/Req8 が所有し、本 Req9 は重複を再宣言しない。

#### Acceptance Criteria

1. The system shall draw, as the R-S6 secondary host, a strip that pairs SPI with schedule coverage and, while schedule coverage is low, de-rates the coverage bar (de-emphasis/greying) with an annotation so SPI is not read as whole-project progress — reading both SPI and schedule coverage from the same upstream derivation as the health surface (the primary host), showing the SPI value as-is, and never recomputing the de-rate or the aggregate schedule coverage in this surface (UI-ARCH §4.1/§4.3).
   - 和訳: システムは、R-S6 の**副 host**として、SPI とスケジュールカバレッジを対で示し、スケジュールカバレッジが低い間はカバレッジバーを淡色化（de-rate）＋注記して SPI を全体進捗と読ませない strip を描画しなければならない——SPI とスケジュールカバレッジは health サーフェス（主 host）と同一の上流導出から読み、SPI 値は素値で表示し、de-rate も集約スケジュールカバレッジも本サーフェスで再計算してはならない（UI-ARCH §4.1/§4.3）。
2. The system shall not present this surface as the primary host of the SPI de-rate display nor as the host of the aggregate schedule coverage — both hosted by `moira-surface-health` (UI-ARCH §4.1/§4.3) — and shall instead frame the same unassigned visible gap (Req4) as the write context of the R-S6 warning, deep-linking to the assignment/scheduling write (assignment grants raise schedule coverage; the deep-link itself is owned by Req5/Req8).
   - 和訳: システムは、本サーフェスを SPI de-rate 表示の**主 host** としても集約スケジュールカバレッジの host としても提示してはならず——いずれも `moira-surface-health` が host（UI-ARCH §4.1/§4.3）——、同一の未割当可視ギャップ（Req4）を **R-S6 警告の write 文脈**として位置づけ、割当/スケジューリング write へ deep-link しなければならない（割当付与が scheduleCoverage を上げる。deep-link 動線そのものは Req5/Req8 が所有）。

> **裁定済（FORK 決着・2026-06-22 ユーザー裁定／R-S6 de-rate strip の host 割付）:** 参照実装 `moira/frontend/src/surfaces/schedule/ScheduleTimeSurface.tsx`（行 25–77）が schedule-time 上に描く SPI＋scheduleCoverage de-rate strip は、**schedule-time を R-S6 の副 host とする**ことで確定した（主 host=health・集約スケジュールカバレッジの host=health・UI-ARCH §4.1/§4.3 に副 host 追記済み・roadmap line 110「SPI(R-S6 de-rate; 副host=schedule-time)」整合）。de-rate は `derate={cov < 0.999}`（カバレッジバーの淡色化）であり SPI 値自体は素値表示、health と同一導出の read であって再計算ではない。よって参照実装の strip 描画は乖離ではなく**整合**であり、Req9 は AC1 でこの副 host strip を要件化し、AC2 で主 host・集約値が health 単独であることの否定的境界を保つ（再 fork にしない）。

### Requirement 10: 期日超過アラート（R-T4）の read 表示と判断・実行への deep-link（R-T4）

**Objective:** 管理者として、導出スケジュールが期日を超えたことを read で把握し、判断（health）と実行（schedule-time/spec-value）へ動線をつなげたい。ただし要員追加・スコープ削除は自動化しない。本 surface が所有するのは R-T4 の**実行文脈としての read 表示と deep-link のみ**であり、横断集約（主 host = inbox）と判断（host = health）は所有しない（UI-ARCH §4.2）。

#### Acceptance Criteria

1. While the derived schedule (including agent lead time per R-T2) exceeds the external deadline, the system shall display the deadline-overrun alert carrying the overrun magnitude (derived completion − deadline), and shall not automatically add resources or cut scope.
   - 和訳: 導出スケジュール（R-T2 によりエージェントのリードタイムを含む）が外部期日を超える間、システムは超過量（導出完了 − 期日）を伴う期日超過アラートを表示し、要員追加やスコープ削除を自動で行ってはならない。
2. The system shall route the human from the overrun alert to the scope/deadline decision (health) and to its execution (schedule-time/spec-value) via deep-link, owning the read display and routing only.
   - 和訳: システムは超過アラートから、スコープ/期日判断（health）とその実行（schedule-time/spec-value）へ deep-link で人間を導き、read 表示とルーティングのみを所有しなければならない。
3. When a commitment (scope cut / added resource / deadline change) is appended upstream so the derived schedule falls within the deadline, the system shall reflect the cleared alert on the next read; accepting the overrun with no action shall not clear it.
   - 和訳: コミット（スコープ削減 / 要員追加 / 期日変更）が上流で追記され導出スケジュールが期日内に収まったとき、システムは次の読み出しで解除されたアラートを反映しなければならない。超過を受容して行動しないことはアラートを消さない。

### Requirement 11: P5 at-risk（解放済み後続）の副 host read 表示と起点再到達への deep-link（P5・UI-ARCH §4.2）

**Objective:** 管理者として、起点ノードの後退で危うくなった**解放済み後続**を、スケジュール文脈（Gantt）で読み、起点ノードの再到達（write）へ動線をつなげたい。それにより後続を独立に手当てするのでなく、根本である起点ノードの再到達へ向かわせる。

> 注: P5 at-risk の**起点ノード**の主 host は `moira-surface-spec-value`（起点）、主集約は inbox。本 surface は UI-ARCH §4.2 の通り**解放済み後続**の副 host（health/schedule-time）として read 表示と deep-link のみを所有する。P5 述語の検出は上流（`moira-health`）が所有し、解放済み後続は `moira-schedule` の forecast/queues に現れるのを読むに留まる（UI-ARCH §6 二系統計算の禁止）。

#### Acceptance Criteria

1. While a node's regression puts its already-released successors at risk (P5 at-risk), the system shall display the released successors as a sub-host read signal in the schedule context (Gantt), deep-linking the human to the upstream re-attainment write of the originating node, without performing the write or recomputing the P5 predicate in this surface.
   - 和訳: あるノードの後退により、その**解放済み後続**が危うくなっている間（P5 at-risk）、システムは解放済み後続をスケジュール文脈（Gantt）の副 host read シグナルとして表示し、起点ノードの再到達 write へ人間を deep-link しなければならない。本サーフェスでは書き込みも P5 述語の再計算も行ってはならない。
2. The system shall not present this surface as the host of the originating node (the originating node's host is `moira-surface-spec-value`; the cross-cutting aggregation is the inbox), owning only the released-successor sub-host display and routing (UI-ARCH §4.2).
   - 和訳: システムは本サーフェスを起点ノードの host として提示してはならず（起点ノードの host は `moira-surface-spec-value`、横断集約は inbox）、解放済み後続の副 host 表示とルーティングのみを所有しなければならない（UI-ARCH §4.2）。
3. When the originating node re-attains `implemented` upstream so the P5 condition is falsified, the system shall reflect the cleared at-risk signal on the next read, holding no dismiss flag of its own; a successor's own completion shall not clear it.
   - 和訳: 起点ノードが上流で `implemented` に再到達して P5 条件が偽化したとき、システムは次の読み出しで解除された at-risk シグナルを反映し、自前の dismiss フラグを持ってはならない。後続自身の完了はこれを消さない。

### Requirement 12: R-C3 キャンセル孤児の文脈ビュー read 表示と解消 write への deep-link（R-C3・UI-ARCH §4.2）

**Objective:** 管理者として、cancel により永久に充足できなくなった依存（孤児）を、スケジュール文脈で読み、辺除去/付替/後続 cancel の write へ動線をつなげたい。それにより孤児を放置して偽のスケジュールを描かずに済む。

> 注: R-C3 孤児の**検出（依存述語の永久充足不能評価）は上流 `moira-scope-deps`（読）が所有**し、主集約は inbox。本 surface は UI-ARCH §4.2 の文脈ビュー（spec-value／schedule-time の双方）の一つとして、スケジュール文脈での read 表示と deep-link のみを所有する（UI-ARCH §6 二系統計算の禁止＝孤児述語を自前で再評価しない）。

#### Acceptance Criteria

1. While a cancel renders a dependency permanently unsatisfiable (R-C3 cancel orphan, detected upstream by `moira-scope-deps`), the system shall display the orphan as a context-view read signal in the schedule context, deep-linking the human to the resolution write skill (edge removal / re-pointing / cancel the successor), without performing the write or re-evaluating the orphan predicate in this surface.
   - 和訳: cancel により依存が永久に充足不能となっている間（R-C3 キャンセル孤児・検出は上流 `moira-scope-deps`）、システムは孤児をスケジュール文脈の文脈ビュー read シグナルとして表示し、解消 write skill（辺除去 / 付替 / 後続 cancel）へ人間を deep-link しなければならない。本サーフェスでは書き込みも孤児述語の再評価も行ってはならない。
2. The system shall treat the schedule-context display as one of the R-C3 context views (the other being `moira-surface-spec-value`; the cross-cutting aggregation is the inbox), owning detection-read and routing only and never owning the orphan detection itself (UI-ARCH §4.2).
   - 和訳: システムはスケジュール文脈表示を R-C3 の文脈ビューの一つ（他方は `moira-surface-spec-value`、横断集約は inbox）として扱い、検出 read とルーティングのみを所有し、孤児の検出そのものは所有してはならない（UI-ARCH §4.2）。
3. When an edge removal/re-point (relate) or a successor cancel (transition) is appended upstream so the R-C3 condition is falsified, the system shall reflect the cleared orphan signal on the next read, holding no dismiss flag of its own.
   - 和訳: 辺除去/付替（relate）または後続 cancel（transition）が上流で追記され R-C3 条件が偽化したとき、システムは次の読み出しで解除された孤児シグナルを反映し、自前の dismiss フラグを持ってはならない。

### Requirement 13: 人間レビュー待ちキューの一覧表示（玉がエージェント作業→人間レビューへ）（P4・R-T5・§2.5）

**Objective:** 利用者として、`implemented`（作成完了・人間の承認待ち）になった有効葉を、schedule-time 上の「レビュー待ち」一覧として読みたい。それにより、いま動くべき側（次の手番＝玉）が、エージェント作業キューから人間レビュー待ちキューへ移ったことを read で把握できる。承認 `implemented→accepted` は別面の write であり、本一覧は read 表示のみを所有する。

> **Reference-implementation deviation（一覧描画が参照実装に無い）:** `humanReviewQueue` の**導出**は参照実装 backend に実在する（`moira/backend/src/derivations/queues.ts`＝`lifecycle === 'implemented'` の有効葉・**actor 非依存**。`DerivedState.humanReviewQueue: NodeId[]`）。一方、フォワード本番の参照実装フロントエンドは**この一覧を schedule-time 上の独立した「レビュー待ち」リストとしては未描画**であり、現状は `moira-surface-spec-value` の `implemented` バッジで読む。本 Req13 は、既存の actor 非依存導出 `humanReviewQueue` を**消費して一覧描画する read 提示の新設**であり（導出の再計算ではない；UI-ARCH §6 二系統計算の禁止）、玉の受け渡し（エージェント作業キュー → 人間レビュー待ちキュー）を read で可視化する。これは横断の decision インボックスには出さない（成果物の承認は §2.1 の5コミット判断にも判断要警告にも含まれない；UI-ARCH §3）。

#### Acceptance Criteria

1. The system shall render the human review queue — the agreed effective leaves at `implemented` awaiting the human `implemented→accepted` review, the actor-independent derivation supplied by `moira-schedule`/`moira-core` (`DerivedState.humanReviewQueue`) — as a "review-waiting" list in the schedule-time surface, reading it from the single upstream derivation and never recomputing the queue.
   - 和訳: システムは人間レビュー待ちキュー——人間の `implemented→accepted` レビュー待ちである `implemented` の合意済み有効葉。`moira-schedule`/`moira-core` が供給する actor 非依存導出（`DerivedState.humanReviewQueue`）——を、schedule-time サーフェス上の「レビュー待ち」一覧として描画し、単一の上流導出から読み、キューを再計算してはならない。
2. The system shall make visible that the ball (the next turn) has moved from the agent work queue to the human review queue when a leaf transitions `implementing → implemented`, by the leaf leaving the agent work queue (`{ready, implementing} ∧ assignee.kind=agent`) and appearing in the human review queue, without introducing a first-class "ball" state (the ball is derived from lifecycle + queues, MODEL has no "ball" concept).
   - 和訳: システムは、葉が `implementing → implemented` に遷移したとき、玉（次の手番）がエージェント作業キューから人間レビュー待ちキューへ移ったことを、当該葉がエージェント作業キュー（`{ready, implementing} ∧ assignee.kind=agent`）から外れ人間レビュー待ちキューに現れることで可視化しなければならない。その際、一級の「玉」状態を導入してはならない（玉は lifecycle＋キューから導出され、MODEL に「玉」概念はない）。
3. The system shall present the review-waiting list as the schedule-context read of "the ball is on the human", and shall not route it to the cross-cutting decision inbox — deliverable acceptance (`implemented→accepted`) is neither one of the §2.1 five commitment decisions nor a judgement-requiring warning (UI-ARCH §3), so it is read here, not in the inbox.
   - 和訳: システムはレビュー待ち一覧を「玉が人間にある」ことのスケジュール文脈 read として提示し、横断の decision インボックスへルーティングしてはならない——成果物の承認（`implemented→accepted`）は §2.1 の5コミット判断にも判断要警告にも含まれない（UI-ARCH §3）ため、ここで読み、インボックスでは扱わない。
4. When the human `implemented→accepted` review is appended upstream so the leaf leaves `implemented`, the system shall reflect the leaf leaving the review-waiting list on the next read, holding no dismiss flag of its own.
   - 和訳: 人間の `implemented→accepted` レビューが上流で追記され当該葉が `implemented` を離れたとき、システムは次の読み出しで当該葉がレビュー待ち一覧から外れることを反映し、自前の dismiss フラグを持ってはならない。

### Requirement 14: レビュー待ちの reviewer フィルタ（レビュー担当を選んで絞り込む）（P4・§7#18(f)・UI-ARCH §2/§5）

**Objective:** 利用者として、レビュー待ち一覧やキューを『特定のレビュー担当（例：太郎）の分だけ』に絞り込みたい。それにより、種別（全員/人間/エージェント）フィルタでは表せない『このレビュー担当の持ち分』を発見できる。これは被割当者（assignee）とも actor 種別フィルタ（Req8）とも別の、**per-node の `reviewer` 属性を選んだレビュー担当と突き合わせる提示層フィルタ**であり、認証された『自分』や視点 actor という中間概念を要さない（MODEL §7#18(f)）。

> **Reference-implementation deviation（reviewer 選択フィルタはスライス未供給）:** フォワード本番の参照実装 `moira/frontend/src/surfaces/schedule/ScheduleTimeSurface.tsx` は actor 種別フィルタ（全員／人間（レビュー/作業）／エージェント）を持つが、**特定のレビュー担当を選んで絞る reviewer フィルタは未供給**である。旧スライスの「自分」選択肢は視点 actor を前提に disabled だったが、本 Req は視点 actor を要さず per-node `reviewer` 属性（v19 で `moira-core` の fold が供給）の**選択**で実現する設計へ改める（MODEL §7#18(f) で「自分のレビュー＝視点 actor」gloss は撤回）。reviewer フィルタは per-node `reviewer`（Actor {kind,id}）に対する提示層の絞り込みで MODEL は保持しない（UI-ARCH §2「役割はモデル外」）。本 Req14 は reviewer 選択フィルタを**要件**として起票し、現状（スライス未供給）を明記する。

#### Acceptance Criteria

1. The system shall provide a reviewer filter that narrows the review-waiting list / queues to the items whose per-node `reviewer` matches a selected reviewer (matched on the reviewer's Actor {kind,id}; for review-waiting, lifecycle=`implemented`).
   - 和訳: システムは reviewer フィルタを提供し、レビュー待ち一覧／キューを、per-node の `reviewer` が選ばれたレビュー担当に一致する項目（突き合わせは reviewer の Actor {kind,id}；レビュー待ちでは lifecycle=`implemented`）へ絞り込まなければならない。
2. The system shall treat the reviewer selection as a presentation-layer input that the MODEL does not hold (§7#18(f); UI-ARCH §2 "role is outside the model"), distinct from both the assignee and the reviewer designation write itself, and shall apply it as a filter over the same single derivation — never as a physically separate computation per selection (the screen-layer "two truths" anti-pattern is forbidden).
   - 和訳: システムは reviewer フィルタの選択を、MODEL が保持しない**提示層入力**（§7#18(f)；UI-ARCH §2「役割はモデル外」）として、被割当者とも reviewer 指名の write 自体とも区別して扱い、同一の単一導出に対するフィルタとして適用しなければならない——選択ごとに物理的に別計算してはならない（画面層の「二つの真実」反パターンは禁止）。
3. The system shall keep the underlying human review queue derivation actor-independent and unchanged regardless of the reviewer filter (the queue membership does not change; only the displayed subset is narrowed), consistent with `moira-schedule` Req14 AC2 — the reviewer-filter narrowing is a presentation filter, not a re-derivation.
   - 和訳: システムは、reviewer フィルタに依らず、基盤の人間レビュー待ちキュー導出を actor 非依存・不変に保たなければならない（キューの母集合は変わらず、絞り込むのは表示部分集合のみ）。これは `moira-schedule` Req14 AC2 と整合する——reviewer フィルタの絞り込みは提示フィルタであって再導出ではない。
4. While the reviewer-selection filter is not yet supplied in the reference slice, the system shall present it as absent/disabled (a known gap) and shall not silently substitute the assignee or a role kind for the reviewer; a node with no designated reviewer matches no reviewer selection and shall stay visible as an "undesignated" gap (moira-schedule Req14 AC4), not hidden by the filter.
   - 和訳: 参照スライスが reviewer 選択フィルタを未供給の間、システムはそれを欠落／無効（既知ギャップ）として提示し、reviewer の代わりに被割当者や役割種別を暗黙に代用してはならない。reviewer 未指名のノードはどの reviewer 選択にも一致せず、フィルタで隠さず『未指名』ギャップ（moira-schedule Req14 AC4）として可視に保たなければならない。

### Requirement 15: 作業詳細（Inspector）の予定/実績 開始・終了日と EVM 表示（§3・§2.5・R-S2）

**Objective:** 利用者として、作業（例：要件定義）の行をクリックして開く詳細（Inspector）で、**予定開始日・予定終了日・実績開始日・実績終了日**と、出来高（EV）・計画値（PV）・実コスト（AC）を読みたい。それにより、予定（ベースライン）と実績（lifecycle 進行）の開始・終了を対で、EVM とともに把握できる。

> **Reference-implementation deviation（4日付のうち予定終了のみ実在）:** 詳細パネル自体は参照実装 `moira/frontend/src/surfaces/schedule/Inspector.tsx` に実在し、**予定終了日＝基準完了日（凍結スロット `frozenSlot`；MODEL §3②）**と予測完了日（生きた予測 `predictedCompletion`）、担当 identity（Avatar＋name）、PV/EV/AC（per-node 属性射影＝§6.6 許容 flavor。`Inspector.tsx`「PROJECTED from per-node attributes, NOT a second derive()」）を表示する。一方、**予定開始日・実績開始日・実績終了日は表示フィールドも導出も未実装**である。これらは上流 `moira-schedule` Req13 が新設する per-node 導出（実績＝lifecycle `transition` の `→implementing`／`→implemented` 時刻、予定開始＝予定終了−所要）に依存する read 表示であり、本 Req15 はその表示の新設を起票する（MODEL は完了スロットのみ凍結し開始日を一級では持たない＝§3②）。

#### Acceptance Criteria

1. When the user opens a sub-unit's work detail (Inspector), the system shall display the planned end date (the frozen baseline slot `frozenSlot`; MODEL §3②, already present), the planned start date, the actual start date, and the actual completion date, reading each from the upstream per-node derivation (`moira-schedule` Req13: actual dates from the lifecycle `→implementing`/`→implemented` timestamps, planned start from planned-end − duration) and never re-deriving them in this surface.
   - 和訳: 利用者がサブ単位の作業詳細（Inspector）を開いたとき、システムは予定終了日（凍結ベースライン・スロット `frozenSlot`；MODEL §3②・実在）・予定開始日・実績開始日・実績終了日を表示し、各々を上流の per-node 導出（`moira-schedule` Req13：実績は lifecycle `→implementing`／`→implemented` の時刻、予定開始は予定終了−所要から）から読み取り、本サーフェスで再導出してはならない。
2. The system shall also display the per-task EVM — earned value (EV), planned value (PV), and actual cost (AC) — as the read-only per-node attribute projection already blessed by UI-ARCH §6.6(b) (`Inspector.tsx`: "PROJECTED from per-node attributes, NOT a second derive()"), and shall not recompute any aggregate derive()-owned metric.
   - 和訳: システムは per-task の EVM——出来高（EV）・計画値（PV）・実コスト（AC）——も、UI-ARCH §6.6(b) が既に許容する read-only の per-node 属性射影（`Inspector.tsx`「per-node 属性から PROJECTED、二度目の derive() でない」）として表示し、集約 derive() 所有指標を再計算してはならない。
3. Where a sub-unit has not yet reached `implementing` (or `implemented`), the system shall present the corresponding actual date as absent (e.g. "未"/empty) rather than fabricating it, an honest empty consistent with `moira-schedule` Req13 AC3; the display variant for a detail opened mid-`implementing` (actual completion still empty) is part of this new requirement.
   - 和訳: サブ単位がまだ `implementing`（または `implemented`）に達していない場合、システムは対応する実績日付を（捏造せず）欠落（例：「未」/空）として提示しなければならない（`moira-schedule` Req13 AC3 と整合する honest empty）。`implementing` 最中に開いた詳細（実績終了日がまだ空）の表示バリアントは本新規要件に含む。
4. The system shall keep the frozen baseline slot (planned end) as the canonical planned-completion record and shall not move it when composing these dates (the upstream frozen-baseline inviolability of `moira-schedule` Req12 AC2 is preserved); the date values themselves are upstream-derived, this surface only displaying them.
   - 和訳: システムは凍結ベースライン・スロット（予定終了）を予定完了の正本記録として保ち、これらの日付を合成する際にそれを動かしてはならない（上流 `moira-schedule` Req12 AC2 の凍結ベースライン不可侵を保つ）。日付値そのものは上流導出であり、本サーフェスは表示のみを行う。
