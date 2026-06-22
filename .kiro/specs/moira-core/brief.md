# Brief — moira-core

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）→ `.kiro/steering/roadmap.md` 確定版。本 brief は roadmap の `moira-core` 行を一次ソースに、`moira/MODEL.md`(v16, 凍結) 準拠で just-in-time 作成。
> 位置づけ: CQRS 分解の **Wave0**。全 read spec(×10)・全 write skill(×14) が依存する **emit/derive API とデータモデルの基盤契約**を最初に凍結する spec。

## Problem
Moira の正典モデル `moira/MODEL.md`(v16) は「追記専用 4 イベント（transition/decompose/relate/cost）＋構成入力（capacity c・期日/目標日）の上に、進捗・スケジュール・健全性をすべて導出する」という思想を確定しているが、本番アーキテクチャへ落とす際の **書き込み契約（イベント追記・capacity 追記）と読み出し契約（derive）、およびその下のデータモデル（イベント型・ノード/合意 状態機械・effective-set・latest-wins）が spec として凍結されていない**。この契約が曖昧なまま下流（10 read spec＋14 write skill）が進むと、各 spec/skill が独自に契約を解釈し、二重計算・スキーマ不整合・不変条件破れが分散して発生する。

## Current State
- 参照実装（フォワード本番・プロト）が `moira/backend/src`（`event-store.ts` / `fold.ts` / `derive.ts` / `types.ts` / `derivations/*`）と `moira/frontend/src/moira`（`store.tsx` の `appendEvent`/`appendCapacity`/`derive`、`engine.ts`）に存在する。emit/derive/fold/effective-set/latest-wins の既存シームはここで実証済み（S4 最小バックエンド = 純 TS + Vitest、追記専用ログ、薄い read 口）。
- ただしこれは「縦スライスの実証」であり、**永続化方式・契約の正式凍結・要件トレース（R-* → 実装）は未確定**（永続化の TBD 所在は本 spec 設計、と roadmap が明示）。
- steering（`structure.md`/`tech.md`）はアーキ不変条件（二層データ・決定的マージ・凍結スロット＋生きた予測の分離・裁量ノブ不在）を確定済みだが、それを満たす具体契約は本 spec が確定する。

## Desired Outcome
`moira-core` は、全 spec/skill が依存する **基盤契約**を凍結する:
1. **emit API** — 4 イベント（transition/decompose/relate/cost）の追記。
2. **capacity-write API** — 第二層 c(i,d) の追記（4 イベントではない）。
3. **config-write API** — 第二層 期日/目標日（プロジェクト構成入力）の追記。
4. **derive API** — 同一ログから R-S2 の導出群を読み出す単一オーケストレータ（読み出し専用・可変状態なし）。
5. **データモデル** — イベント型、ノード ライフサイクル状態機械（pending→ready→implementing→implemented→accepted(+cancelled)）、見積合意機械（proposed→agreed、人間のみ）、effective-set（supersede×cancel 復帰規則）、latest-wins `(ts,id)`、二層データの境界。
6. **不変条件 I1–I6 と R-D7 の構造面**（旧ノード append-only 不変・supersede 非循環 I2）を fold が機械的に担保（循環 relate 拒否・非人間 agreed 拒否）。後退遷移は合法性では拒否せず記録し、その意味的異常の警告は下流（P5/`moira-health`）が担う。
7. **永続化方式の決定**（roadmap: TBD の所在＝本 spec 設計。S4 縦スライスを基盤に永続層の境界を確定）。

## Approach
- MODEL を SSOT として、参照実装の seam に design を整合させる（出力スキーマは MODEL 準拠）。core は backend `src/` の event-store / fold / derive / types / derivations の **foundation** を所有する。
- 二層データを厳守: ①追記専用 4 イベントログ（ノードのワークデータ）、②構成入力（capacity c＝人間資源属性、期日/目標日＝プロジェクト属性）。「config 書込」は②であり第三層ではない。derivation は再計算ではなく emit→derive。
- core が **定義**する横断的概念で、下流が **消費**するもの: effective-set（分母消費は evm/schedule/health）、latest-wins、二層データ、4 イベント emit、derive 契約。core 自身は warning 確定・指標の de-rate・leveler 詳細は所有しない（それらは Wave1 以降）。

## Scope
### In
- emit/derive/capacity-write/config-write API 契約の凍結（型・前提条件・後条件・不変条件）。
- イベント型（4 種）と c(i,d)・期日/目標日 の第二層スキーマ。
- ノード ライフサイクル状態機械・見積合意機械（人間限定）の定義（R-U3/U4、R-D6 機械明示、R-S1 凍結）。
- 追記専用ログ層・畳み込み層（fold）・導出層オーケストレータ（derive）・read 層の責務境界。
- `(ts,id)` 決定的マージ（I3/R-D5）、循環 relate 拒否（I2/R-D3）、非人間 agreed 拒否（I6/R-U4）。
- effective-set 導出と supersede×cancel 復帰規則（R-S5）、累積 EV_abs basis と現行有効集合の区別（読み出し基盤）。
- ベースライン二次元の凍結機構（予算=合意時 R-U7、スロット=初回スケジュール時、I4 完了施錠）の **記録機構**（属性として既存イベントに載せる）。
- R-D7 の構造面（旧ノード append-only 不変・supersede 辺 新→旧・I2 で非循環担保）。旧ノードを後退遷移で再オープンしない表現規律は write skill 側（`relate-edit`/`decompose-author`）が担い、core は後退遷移を拒否しない（記録のみ）。
- 永続化方式の決定（永続層の境界と再導出再現性の担保）。
- 二層データ再導出契機（イベント追記 AND 構成入力 c/期日/目標日 変更）。

### Out
- EV_abs/EV%/累積/見積被覆/exec被覆(R-S8)/PV/AC/SPI/CPI/sunk の **会計式の所有** → `moira-evm`（core は derive がそれらを束ねる契約と effective-set/二層を提供するのみ。指標式の正典は evm）。
- leveler(P7/P8)・予測・baseline slot 充填ヒューリスティクス・schedule被覆・buffer(R-T6) **導出ロジック** → `moira-schedule`（core は frozenSlot 記録機構と forecast 契約の型のみ）。
- tree+DAG/ready(R-D1/D2)/orphan(R-C3)/restoration(R-S5 表示) **導出** → `moira-scope-deps`。
- 9 warning の確定・集約・clearance、行為列挙の単一定義 → `moira-health`。
- 全 read サーフェス（UI）、全 write skill（イベント発行・オーケストレーション）。
- spec-unit→ノード候補正規化 → `moira-ingestion-adapter`。
- 人間承認ステップ（合意/割当/スコープ/c 宣言の commit）→ write skill が内包（core は emit 受理のみ。R-U4 の人間限定ゲートは core が機械的に enforce）。

## Boundary Candidates（core が所有を主張する seam）
- `moira/backend/src/event-store.ts` — 追記専用ログ・`(ts,id)` ソート（I3/R-D5）。
- `moira/backend/src/capacity-store.ts` — 第二層 c(i,d)（A4/R-U14）。
- 期日/目標日 の第二層ストア（R-T6 の構成入力。参照実装には未実装＝core で新設）。
- `moira/backend/src/fold.ts` — 畳み込み（I2/I3/R-U4 enforce・状態機械適用・凍結属性記録）。
- `moira/backend/src/types.ts` — イベント型・ProjectedState・DerivedState のスキーマ。
- `moira/backend/src/derive.ts` — 導出オーケストレータ（R-S2 の導出群を同一ログから組み立てる契約）。
- `moira/backend/src/derivations/effective-set.ts`・`node-states.ts` — effective-set（R-S5）・ノード状態射影。
- frontend 側 `store.tsx`/`engine.ts` の `appendEvent`/`appendCapacity`/`derive` 公開境界（read サーフェスが読む契約面）。

## Out of Boundary（core が触らない）
- `derivations/ev.ts`・`coverage.ts`・`pv.ts`・`ac.ts`・`indices.ts` の **指標式本体** → evm（core は derive がこれらを呼ぶ契約と effective-set/二層入力のみ所有）。
- `leveler.ts`・`forecast.ts` の **平準化/予測ロジック** → schedule。
- `queues.ts` の actor フィルタ詳細（P4）→ schedule/health 側の消費（core は queue 型の契約のみ）。
- warning 検出述語・集約 → health/各 derivation。
- UI コンポーネント・サーフェス（atoms/tokens/gantt-geometry の共有 UI 含む）。

## Upstream
- **none**（roadmap: Dependencies: none。core は Wave0 で最初に凍結する基盤）。
- 一次資料: `moira/MODEL.md`(v16, 凍結・SSOT)。

## Downstream（core の契約を消費する）
- **read spec**: `moira-evm` / `moira-schedule` / `moira-scope-deps` / `moira-ingestion-adapter` / `moira-health` / `moira-surface-spec-value` / `moira-surface-schedule` / `moira-surface-health` / `moira-surface-decision`（全 surface）。
- **write skill**: `moira-spec-ingest` / `estimate-agree` / `decompose-author` / `progress` / `assign-schedule` / `capacity` / `project-config` / `reschedule` / `rebaseline` / `relate-edit` / `cancel-scope` / `cost-log` / `ticket-project` / `evm-digest`（全 14 本が emit/derive を依存）。
- 共有シーム（roadmap）: emit/derive API（全依存・最初に凍結）、effective-set（定義=core・分母消費=evm/schedule/health）、二層データ、latest-wins。

## Existing Spec Touchpoints
- 既存の他 spec は無し（Moira の spec は本 Wave0 が先頭。`.kiro/specs/` は新規）。旧アプリ（evm-studio/sdd-dashboard）の spec は除去済み・再作成しない（structure.md）。
- 参照実装（`moira/backend`・`moira/frontend`）は spec ではなくフォワード本番プロト。design はこの seam に整合させ、出力スキーマは MODEL 準拠とする。

## Constraints
- `moira/MODEL.md` v16 を **SSOT として凍結遵守**。MODEL の文言を勝手に変えない・新概念を足さない（spec は MODEL の実装落とし込み）。モデル変更は `moira-model-update` ゲート経由のみ。
- **二層データのみ**（アーキ不変条件）: ①4 イベント追記専用ログ、②構成入力（c・期日・目標日）。「config 書込」は②であって第三層ではない。derivation は再計算しない（emit→derive）。第5イベントを足さない。
- **commit を握るのは人間**: R-U4（agreed は人間のみ）は core が機械的に enforce（非人間 agreed は拒否＝structuralError）。合意/割当/スコープ/c 宣言の承認ステップ自体は write skill が内包。
- **決定的マージ** `(ts,id)`（I3/R-D5）。同一ログ・同一実装で再導出が再現する。
- **導出を調整する裁量パラメータを持たない**（c は外的事実入力で例外）。
- **再導出契機はイベント追記 AND 構成入力（c・期日・目標日）変更**（R-S2）。
- EARS は ja・`requirements-style.md` 準拠（英文＋和訳併記）。トレースは `trace-notation.md`、命名は `moira-naming.md`、配置は `structure.md`/`tech.md`、テストは `testing-conventions.md`。
- 永続化方式は本 spec 設計で決定する（TBD の所在）。決定基準（tech.md）: ①追記専用ログと決定的 `(ts,id)` 順序が自然に書ける、②ログからの再導出が再現可能、③ c の第二層を独立 tier として扱える。決定は ADR にも記録しうる。
- **0a 依存（Phase 0 決着済）**: A1 射程＝「spec」は遂行され出来高(EV_abs)を生むあらゆる作業単位（運用/バグ/ad-hoc も feature ノード）。フェーズ周期の省略は §2.6 子ノード展開の分解深さであって lifecycle 状態（§2.5）の省略ではない。バッファ等の導出会計量はノードでない。core のノード分類/型設計はこの射程に従う（isBuffer ノードを持たない）。
