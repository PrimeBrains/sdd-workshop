# Brief — moira-evm（読/導出 spec）

> 由来: `.kiro/steering/roadmap.md`（Path D 多 spec 分解・doc-refine 確定版）の `moira-evm` 行を一次ソースとし、`moira/MODEL.md`(v16, 凍結) からトレース。CQRS 分解の Wave1（依存: `moira-core`）。

## Problem
Moira 正典モデル `moira/MODEL.md`(v16) は「4 イベント＋構成入力の上に進捗・出来高・健全性をすべて導出する」モデルだが、その **出来高・コスト・指数の会計（EVM 系導出）** をどの spec が所有し、どの式・規律・可視ギャップを正典どおり実装すべきかが、本番アーキへ落とす際に未確定である。EV の二形（EV_abs/EV%）・カバレッジ三種・PV/AC・SPI/CPI・sunk・実行カバレッジ(R-S8) を一箇所に集約しないと、各サーフェスへ導出ロジックが重複し陳腐化する（roadmap Rejected: サーフェス縦割り）。

## Current State
- 正典 `moira/MODEL.md`(v16, 凍結) が SSOT。P0–P3／R-U8/U9/U10／R-S1/S3/S4/S8／R-C2／§3 導出指標定義 に EVM 会計の思想が確定済み。
- 基盤契約 `moira-core`(requirements 生成済) が emit/derive・二層データ・effective-set・latest-wins・状態機械・凍結属性記録（予算=合意時 R-U7・スロット=初回スケジュール時・I4 完了施錠）を所有。
- 参照実装（フォワード本番）が `moira/backend/src/derivations/{ev,pv,ac,indices,coverage}.ts` に存在し、EV_abs/EV%/累積EV/PV/AC/SPI/CPI/見積カバレッジ/スケジュールカバレッジ/実行カバレッジ を純関数として実装済み（core の ProjectedState・EffectiveSet を消費）。
- 派生設計 `moira/UI-ARCHITECTURE.md`(v16) が「EV%・見積カバレッジ・実行カバレッジ の三者併置」「R-S5 区別表示（現行進捗 vs 累積EV/サンク）」の host を規定。検証は `moira/validation-scenarios.md` S1/S3/S4/S14(R-S8)/S11(サンク)/S12(supersede)。

## Desired Outcome
`moira-evm` が **EVM 会計指標の式と規律を所有する単一の導出 spec** として、core の effective-set/凍結属性/二層入力を消費し、次を MODEL から忠実に導出する: EV_abs／EV%／累積EV／見積カバレッジ／実行カバレッジ(R-S8)／PV／AC／SPI／CPI／sunk EV_abs(R-C2)／R-U9 可視ギャップ会計。式そのものは MODEL §3／`moira-naming.md` を正典とし、本 spec は WHAT（導出契約・規律・領域・de-rate・可視ギャップ）を確定する。

## Approach
roadmap の CQRS 方針に従い、本 spec は read/導出側。式を再定義せず MODEL §3 の定義を実装契約へ落とす。core が所有する概念（effective-set・latest-wins・凍結属性記録・状態機械・二層データ）は **消費**し再定義しない。de-rate（R-S4/R-S6 同型）・三者対読み（EV%×見積カバレッジ×実行カバレッジ、算術和禁止）・領域非対称（SPI の分子完了/分母スケジュール済み、CPI の分子完了/分母 WIP 含む）・可視ギャップ（P0/R-U9）を規律として明示する。

## Scope
### In
- EV_abs（完了凍結予算の総和・合意済みのみ R-U8）・EV%（= EV_abs / Σ合意済み最新見積 ∈[0,1]）の二形導出（P1/R-U8）。
- 累積EV（EV_abs、supersede 済み葉を含む全葉・cancelled 除外）と現行進捗（現行有効集合 EV%）の **区別導出**（R-S5・§2.7）。
- 見積カバレッジ（P2）・実行カバレッジ executionCoverage（R-S8）の count-based 導出と三者対読み規律。
- PV（時間配分ベースライン予算・領域三除外）・AC（同型集約 P3・WIP/cancelled 含む）。
- SPI（= EV_abs/PV・スケジュール済み領域限定・R-S6 de-rate 規律）・CPI（= EV_abs/AC・領域非対称の正直化）。
- sunk EV_abs（R-C2・cancelled ノードの出来高を別途保存せず導出）。
- 低カバレッジ de-rate（R-S4）・可視ギャップ会計（R-U9/P0: 見積カバレッジ／未スケジュール合意作業）。
- thrashing 検出データ（R-S3: EV_abs 非増 ∧ AC 継続増の検出側。閾値・窓は実装定義、確定/集約は health）。
- AC の単一通貨記録（R-U10: MD・EV へ混入させない）。

### Out
- 式の再オープン・magic number（正典は MODEL §3／`moira-naming.md`）。
- 平準化(P7/P8)・予測・slot 充填・D_pred・schedule buffer 導出（= `moira-schedule`）。スケジュールカバレッジの **導出は schedule**、本 spec は SPI de-rate の **消費**のみ（roadmap 共有シーム）。
- effective-set 定義・latest-wins・凍結属性記録機構・状態機械・二層データ（= `moira-core`。本 spec は消費）。
- cancel 意味論・orphan・restoration（= `moira-scope-deps`/`moira-cancel-scope`）。sunk の **金額導出**は本 spec、cancel 意味論は scope-deps（共有シーム）。
- 9 warning の確定/集約・行為列挙の単一定義・clearance（= `moira-health`）。R-S3 thrashing は本 spec が **検出データ**を出し、警告確定は health。
- AC 入力（cost イベント発行）の write（= `moira-cost-log` skill。R-S3 検出は本 spec、cost-log は AC 入力を足すのみ）。
- 全 read サーフェス（UI 提示・三者併置の表示 host）= `moira-surface-*`。本 spec は導出データと規律を提供。

## Boundary Candidates
- EV_abs/EV%/累積EV の導出（R-S5 区別を含む）。
- 見積カバレッジ・実行カバレッジ の count-based 導出と三者対読み規律。
- PV/AC/SPI/CPI の導出と領域非対称・de-rate 規律。
- sunk EV_abs(R-C2) 導出。
- R-U9/P0 可視ギャップ会計（見積カバレッジ＝EV の未コミット領域）と R-S4 低カバレッジ de-rate。
- R-S3 thrashing 検出データ（EV_abs/AC の二項条件）。

## Out of Boundary
- スケジュール領域の導出（PV のスロットは core 凍結属性を読むのみ・D_pred/buffer は schedule）。
- 警告の確定/集約/clearance（health）。
- cancel/orphan/restoration の意味論（scope-deps）。
- イベント・構成入力の write（write skill 群）。

## Upstream (moira-core)
- 消費する core 契約: `derive` 経由の ProjectedState（各ノードの lifecycle/estimateState/latestEstimate/frozenBudget/frozenSlot/ownCost・childrenOf）、effective-set 導出（現行有効葉/ノード・supersede×cancel 復帰 R-S5）、`(ts,id)` latest-wins、二層データ（c・期日・目標日は本 spec の式に直接は効かないが、PV のスロットは core が記録した凍結属性を読む）、I1 整合（合意済み子の総和・未見積子除外）。
- core が概念を所有し、本 spec は再定義しない（effective-set・latest-wins・凍結記録・状態機械・二層境界）。

## Downstream
- `moira-health` — R-S3 thrashing 検出データ・SPI/CPI 等を消費し 9 warning を確定/集約。
- `moira-surface-spec-value` — EV%・見積カバレッジ・実行カバレッジ の三者併置 host（主）。R-S5 現行進捗。
- `moira-surface-health` — EV_abs/EV% 区別・PV/AC・SPI(R-S6 de-rate)/CPI・累積/サンク/supersede 履歴。
- `moira-cost-log`(skill) — AC 入力（cost）を足す。R-S3 検出は本 spec 側。
- `moira-cancel-scope`(skill) — cancel 意味論を所有。本 spec は sunk EV_abs を導出。

## Existing Spec Touchpoints
- `moira-core/*` — 基盤契約（emit/derive・二層・effective-set・latest-wins・状態機械・凍結記録）を消費。
- 参照実装 `moira/backend/src/derivations/{ev,pv,ac,indices,coverage}.ts`（フォワード本番・該当導出のみ）。
- `moira/UI-ARCHITECTURE.md`(§4 被覆表・§5 サーフェス構成) — 三者対読み host・R-S5 区別表示。
- `moira/validation-scenarios.md` — S1（カバレッジ可視化）・S3（仕様作業の EV_abs・R-S4）・S4（同一ログ導出）・S7→S3（thrashing）・S11（サンク R-C2）・S12（supersede 累積EV）・S14（実行カバレッジ R-S8）。

## Constraints
- `moira/MODEL.md` v16 を SSOT として凍結遵守。式・数式の再オープン禁止（Phase 0 は周辺文言のみ）。指標式の正典は MODEL §3／`moira-naming.md`。
- EARS は ja・`requirements-style.md` 準拠（英文 EARS＋和訳併記）。トレースは `trace-notation.md` 準拠（全 ID 列挙・範囲/ワイルドカード禁止）。命名は `moira-naming.md` 準拠（用語の唯一所有者）。
- read/導出に徹し、自前の真実源・可変状態を持たない（structure.md 導出層規律: 純関数群を core オーケストレータが R-S2 として束ねる）。
- 引用は章 ID（P1/R-U8/§3 等）で行い MODEL のバージョン番号を本文に書かない（陳腐化回避）。
- 検出=読 / 解消=書 の分離（R-S3 等 de-rate・検出系は読 spec のみ。書 skill で解消しない）。
