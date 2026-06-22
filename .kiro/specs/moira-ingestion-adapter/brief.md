# Brief — moira-ingestion-adapter

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）→ `.kiro/steering/roadmap.md` 確定版。本 brief は roadmap の `moira-ingestion-adapter` 行を一次ソースに、`moira/MODEL.md`(v16, 凍結) 準拠で just-in-time 作成。
> 位置づけ: CQRS 分解の **Wave1**（依存 = `moira-core`）。spec-unit（仕様方法論の段階的成果物＝抽象 spec-unit、cc-sdd は参照例）から **ノード候補＋見積提案**へ正規化する **read-only producer**。Phase 0 の 0a（A1 射程）・0c（spec 単位の方法論非依存化）に接地。

## Problem
Moira の正典モデル `moira/MODEL.md`(v16) は「見積はボトムアップで形成され、前段成果物を入力に人間と AI が擦り合わせ人間が合意する `proposed→agreed` の一様な営み」（§2.2/§2.3）であり、フェーズ（req/design/tasks）は feature の子ノードである（§2.6）と確定している。しかし、外部の仕様方法論（cc-sdd 等）が産む段階的成果物を **どう Moira のノード候補と見積提案へ写すか**——すなわち「spec phase 成果物 → ノード候補＋見積提案」の正規化責務——が spec として切り出されていない。これが曖昧なまま write skill（`moira-spec-ingest`）がイベント発行と取り込み正規化を兼ねると、(1) 方法論固有の語彙（cc-sdd の req/design/tasks）が emit 経路へ漏れて方法論依存になり、(2) 正規化（読み）と発行（書き）が混線して責務境界が崩れる。

## Current State
- 参照実装（`moira/backend/src`・`moira/frontend/src/moira`）には emit/derive/fold/effective-set の縦スライスは存在するが、**spec-unit 取り込み正規化（ingestion）の実装は存在しない**（forward-looking; read-only producer パターンを新設する）。
- MODEL は 0c で「仕様方法論」を操作的に定義済み（§2.3「成果物を段階的に作成し人間が承認していく構造化された開発プロセス」。cc-sdd は検証参照例）。0a で A1 射程＝「spec」は遂行され出来高(EV_abs)を生むあらゆる作業単位（運用/バグ/ad-hoc も feature ノード）と確定済み。
- `moira-core`（生成済）が emit/derive・二層データ・effective-set・latest-wins・状態機械・凍結記録の **基盤契約**を所有する。本 spec はそれを **消費**する前提（再定義しない）。

## Desired Outcome
`moira-ingestion-adapter` は、spec-unit を入力に **ノード候補（木の所属・DAG の論理依存・lifecycle 状態の初期提案）と見積提案（`proposed` の値提案）**を **read-only に正規化**して出力する producer である:
1. 方法論非依存の **抽象 spec-unit** を入力境界に取り、cc-sdd 固有の語彙を内部マッピングに閉じ込める（0c）。
2. フェーズ成果物を §2.6 のフェーズ＝子ノードとしてノード候補に写す（req/design/tasks → feature 子ノード候補、二段 decompose の構造に対応）。
3. 一様な見積（§2.3）の入力連鎖（est(req)→req→est(design)→design→est(tasks)→tasks→est(impl)→impl群）に従い、前段成果物を入力に **見積提案**を `proposed` 状態の提案として産出する（R-E1/E1b/E2 の入力）。
4. A1 射程（0a）に従い、運用タスク・バグ修正・ad-hoc 作業も feature ノード候補として正規化しうる（フル・フェーズ周期の省略は分解の深さ＝人間判断であり、本 producer は提案に留める）。
5. **read-only に徹する**: emit は一切しない（4 イベントの発行・合意確定は write skill `moira-spec-ingest`/`estimate-agree` の責務）。本 spec は「候補と提案」を出すだけで、ログにもノード状態にも一切書き込まない。

## Approach
- MODEL を SSOT として、§2.2/§2.3/§2.6・R-E1/E1b/E2・A1 射程注釈(0a)・§2.3「仕様方法論」操作的定義(0c) からトレースする。
- **read-only producer パターン**: 入力（spec-unit）→ 正規化（純関数）→ 出力（ノード候補＋見積提案の構造）。下流の write skill が候補/提案を受けて 4 イベントを emit し、人間が合意する。本 spec は emit せず・ログを mutate せず・状態を持たない。
- 方法論非依存（0c）: 「仕様方法論」を抽象 spec-unit として扱い、cc-sdd は写像の参照例として括弧内に保持。Scrum/ウォーターフォール等は各自の成果物承認ゲートを §2.2 のノード合意へ写す（MODEL §2.3 と同型）。
- core の所有概念（emit/derive・二層データ・effective-set・latest-wins・状態機械・凍結記録）は **消費**し、再定義しない。本 spec はノード候補/見積提案の **構造**のみを定義し、それを正本化する emit は write skill に委ねる。

## Scope
### In
- 抽象 spec-unit（方法論非依存の段階的成果物）を入力境界として受け取る正規化（0c）。
- フェーズ成果物 → ノード候補（feature 子ノード＝req/design/tasks、木の所属・DAG の論理依存・lifecycle 初期状態の提案）への写像（§2.6）。
- 一様な見積の入力連鎖（§2.3）に従う **見積提案**（`proposed` 値提案）の産出（R-E1/E1b/E2 の入力）。
- est(impl) を tasks ノードとは別個の、tasks.md を入力とする見積提案ノード候補として扱う（R-E1b。decompose に内包させない提案）。
- A1 射程（0a）に従う非 spec 作業単位（運用/バグ/ad-hoc）の feature ノード候補正規化。
- 入力に対する正規化の決定性（同一 spec-unit → 同一候補/提案）と read-only 性（emit せず・ログ/状態を mutate しない）。

### Out
- 4 イベント（transition/decompose/relate/cost）の **emit** → `moira-spec-ingest` skill。
- 見積の **合意確定**（`proposed→agreed`、人間承認）→ `moira-estimate-agree` skill。
- イベント型・状態機械・effective-set・latest-wins・二層データ・凍結記録の **定義** → `moira-core`（本 spec は消費）。
- 分解の深さ・ノード化/畳むの判断（人間のコミット判断 P0）の **確定** → 人間＋write skill（本 spec は候補/提案に留める）。
- EV/被覆/PV 等の **導出** → `moira-evm`/`moira-schedule`/`moira-health`。
- 永続化・UI。

## Boundary Candidates（ingestion-adapter が所有を主張する seam）
- spec-unit 入力スキーマ（抽象・方法論非依存）と cc-sdd → 抽象の内部マッピング（参照例）。
- フェーズ成果物 → ノード候補（木所属・DAG 論理依存・lifecycle 初期状態提案）の正規化関数（純関数・read-only）。
- 一様見積連鎖（§2.3）に沿った見積提案（`proposed` 値）の産出関数。
- ノード候補＋見積提案の **出力構造**（write skill が emit へ写す契約面）。

## Out of Boundary（ingestion-adapter が触らない）
- emit 経路（event-store/fold への書き込み）→ core 契約を write skill が使う。
- 見積合意機械の `agreed` 遷移（人間限定 R-U4）→ core が enforce・estimate-agree が emit。
- derive オーケストレータ・導出層 → core/evm/schedule/health。
- ノード状態の正本（lifecycle 現行状態）→ core の fold が決める（本 spec は初期状態の提案のみ）。

## Upstream
- **moira-core**（roadmap: Dependencies: moira-core）— emit/derive・二層データ・effective-set・latest-wins・状態機械（lifecycle/見積合意）・凍結記録の基盤契約。本 spec はこれらを **消費**し、ノード候補/見積提案の構造はこの契約の語彙で表す。
- 一次資料: `moira/MODEL.md`(v16, 凍結・SSOT)。

## Downstream（ingestion-adapter の候補/提案を消費する）
- **write skill**: `moira-spec-ingest`（候補/提案を入力に decompose/transition を emit。0c が単一ソース確定なら本 adapter を吸収しうる＝条件付き存続）。`moira-estimate-agree`（見積提案を人間合意へ）。`moira-decompose-author`（ノード候補を decompose へ）。
- roadmap 要件カバレッジ: R-E1/E1b/E2 → ingestion-adapter ＋ spec-ingest。

## Existing Spec Touchpoints
- 上流: `moira-core`（生成済 requirements.md）。本 spec は core の契約概念を消費（再定義しない）。
- 参照実装（`moira/backend`・`moira/frontend`）に ingestion 実装は無し（read-only producer を新設）。design はこの producer パターンに整合させ、出力スキーマは MODEL（§2.2/§2.3/§2.6・R-E1/E1b/E2）準拠とする。
- roadmap 注: 本 spec は「0c が単一ソース確定なら spec-ingest skill へ吸収（条件付き存続）」と記されていたが、requirements は 0c の方法論非依存化が多ソースを許す（単一ソース確定でない）ため吸収条件は不成立と判断し、spec-ingest skill とは別の read-only 正規化責務として独立 read spec に凍結する。

## Constraints
- `moira/MODEL.md` v16 を **SSOT として凍結遵守**。MODEL の文言を勝手に変えない・新概念を足さない（spec は MODEL の実装落とし込み）。モデル変更は `moira-model-update` ゲート経由のみ。
- **read-only producer**: 本 spec は emit を一切しない（4 イベント発行・合意確定は write skill）。ログ・ノード状態・第二層を mutate しない。出力は「候補と提案」であって正本ではない。
- **方法論非依存（0c）**: 入力境界は抽象 spec-unit。cc-sdd 固有語彙は内部マッピングに閉じる（cc-sdd は検証参照例として保持）。
- **A1 射程（0a）**: 「spec」は遂行され出来高(EV_abs)を生むあらゆる作業単位（運用/バグ/ad-hoc も feature ノード）。フェーズ周期の省略は §2.6 子ノード展開の分解深さであって lifecycle 状態（§2.5）の省略ではない。バッファ等の導出会計量はノードでない（候補化しない）。
- **見積は提案（`proposed`）**: 本 spec が産むのは出所を問わない `proposed` 見積提案であり、`agreed` への確定は人間のみ（R-U4／§2.2／A5）。本 spec は確定しない。
- core の所有概念を **消費**し再定義しない（emit/derive・二層データ・effective-set・latest-wins・状態機械・凍結記録）。
- EARS は ja・`requirements-style.md` 準拠（英文＋和訳併記）。トレースは `trace-notation.md`、命名は `moira-naming.md`、配置は `structure.md`/`tech.md`。
