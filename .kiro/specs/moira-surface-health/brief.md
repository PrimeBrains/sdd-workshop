# Brief — moira-surface-health

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）→ `.kiro/steering/roadmap.md` の読/導出 spec 行（`moira-surface-health`）を一次ソースに、`moira/MODEL.md`(v16, 凍結) からトレースして起こした just-in-time brief。CQRS 分解の Wave3（surface 群、`[0d]` 後着手）。

## Problem
Moira 正典 MODEL v16 は「4 イベント＋構成入力の上に進捗・スケジュール・健全性をすべて導出する」モデルを確定したが、**健全性・EVM の軸**（EV_abs／EV%／PV／AC／SPI／CPI／実行カバレッジ／スケジュール・バッファ）を管理者が「対で読んで」即座に健全性を把握するための常駐ダッシュボード面が、本番アーキとして spec 化されていない。MODEL は提示の下限（R-S2 の導出群を surface・R-S5/R-S6 の区別表示・R-U9/P0 の可視ギャップ）を既に強制しているが、その「健全性」軸への割付（UI-ARCHITECTURE §3 `health`・§4.1/§4.3・§5）は派生設計どまりで、消費契約（どの導出をどの de-rate 規律でどう対読みするか）を要件として固定する spec が無い。EV_abs（累積）と EV%（現行）の混同、SPI を低スケジュール・カバレッジで割引かない誤読、バッファ残量の偽の余裕は、いずれも分離・de-rate を提示層で保証しないと「嘘の安心」を生む。

## Current State
- 正典: `moira/MODEL.md`(v16) — P1（EV_abs/EV% の二形・SPI/CPI/PV は絶対量）・§3 導出指標（PV/EV_abs/SPI/CPI 定義・領域非対称・de-rate 規律）・R-S2（導出群提供）・R-S5（現行進捗 vs 累積EV の区別表示）・R-S6（低スケジュール・カバレッジで SPI を de-rate）・R-S8（実行カバレッジの三者対読み・算術和禁止）・R-T6（スケジュール・バッファ残量/消費率・カバレッジ対 de-rate・境界条件）・R-U9/P0（可視ギャップ）。
- 派生設計: `moira/UI-ARCHITECTURE.md`(v16) §3 で `health` を「EV_abs/EV% 区別（R-S5）・PV/AC・SPI/CPI（§3）・スケジュール・カバレッジ de-rate（R-S6）」、§4.1 で EV_abs（累積EV）/PV/AC/SPI/CPI/スケジュール・バッファ残量/消費率（R-T6）の主 host・実行カバレッジ（R-S8）の EVM 文脈での再掲、§4.3 で R-S5 区別表示（分離ゾーン）と R-S6 de-rate の host、§5 で health の構成（SPI de-rate／区別ゾーン／実行カバレッジ再掲／SPI・CPI トレンド／CCPM フィーバー／バッファ残量/消費率）、§6 で read-only 規律（自前状態なし・deep-link は再計算でなく参照・二系統計算禁止）を規定。
- 基盤契約: `.kiro/specs/moira-core/requirements.md`（生成済）が emit/derive・二層データ・effective-set（R-S5 復帰規則）・latest-wins・状態機械・凍結記録・R-S2 導出オーケストレータを所有。
- 参照実装（フォワード本番）: `moira/frontend/src/surfaces/health/HealthSurface.tsx`（現行進捗ゾーン＝EV%＋見積カバレッジ／SPI＋スケジュール・カバレッジ de-rate／実行カバレッジ／CPI／EV_abs/PV/AC／SV=EV−PV・CV=EV−AC 提示恒等式、累積稼得ゾーン＝累積 EV_abs と現行 EV_abs の差分、SPI/CPI 推移＝単一 asOf 実点、CCPM フィーバー＝暫定空状態）。
- 上流（生成済）: `moira-evm`（EV_abs/EV%/累積EV/見積カバレッジ/実行カバレッジ R-S8/PV/AC/SPI/CPI/sunk の式本体）・`moira-schedule`（平準化/予測/D_pred/スケジュール・カバレッジ/buffer R-T6 の導出）・`moira-health`（9 warning 確定・行為列挙の単一定義）。

## Desired Outcome
MODEL v16 の「健全性・EVM」軸を、core/上流の導出を**読むだけ**の read-only ダッシュボードとして要件化する。具体的には:
- EV_abs（累積EV）と EV%（現行進捗）を区別ゾーンで分離表示（R-S5）。
- PV／AC／SPI／CPI を絶対量（予算次元 MD）で提示し、SPI は低スケジュール・カバレッジで de-rate（R-S6）。SPI/CPI は PV/AC=0 で「算出不能」を潰さない。
- 人別（actor 別）の CPI 時系列（valid-time c の制約下で実点のみ・捏造曲線を描かない）。人別 SPI は PV が MODEL §2.4 で actor 帰属を持たないため非対象（本 spec スコープ外）。
- スケジュール・バッファ残量/消費率（R-T6）をスケジュール・カバレッジと対で de-rate して提示し、境界条件・R-T4 表裏を正直に扱う。CCPM フィーバー的可視化。
- 明快メトリクス（見積カバレッジ＋PV/EV/BAC）と実行カバレッジ（R-S8）の EVM 文脈での再掲。

## Approach
read-only ダッシュボード（UI-ARCHITECTURE §6 規律: 自前の真実源・可変状態・隠れキャッシュ・dismiss フラグを持たず、core の R-S2 導出を read 派生として描く）。導出式・effective-set 導出・平準化/D_pred/buffer 導出・warning 確定は **core/上流が所有**し、本 spec はそれらを消費して提示・区別表示・de-rate 規律・対読み・トレンド表示のみを要件化する。R-S5（累積/現行の分離）・R-S6（SPI de-rate）・R-T6（buffer の de-rate 対読み・境界条件）・R-S8（三者対読み・算術和禁止）の提示規律を本 spec が担保する。CCPM フィーバーは「監視の着想のみ借用・生成は採らない・ゾーン閾値は裁量ゆえ正典外」を踏襲する（MODEL §5）。

## Scope
### In
- 健全性・EVM 軸の read 提示: EV_abs（累積EV）/EV%（現行進捗）の区別ゾーン表示（R-S5）、PV/AC/SPI/CPI（§3・絶対量）、SPI の低スケジュール・カバレッジ de-rate（R-S6）、CPI の領域非対称の正直化、実行カバレッジ（R-S8）の EVM 文脈再掲（三者対読み・算術和禁止）。
- 人別（actor 別）の SPI/CPI 時系列（valid-time c 制約下で実点のみ・補間禁止・捏造曲線禁止）。
- スケジュール・バッファ残量/消費率（R-T6）の提示＋スケジュール・カバレッジ対 de-rate＋境界条件（目標日なし/期日なし/目標日=期日/目標日>期日/D_pred なし）＋R-T4 表裏。CCPM フィーバー的可視化（消費%×進捗%）。
- 明快メトリクス（見積カバレッジ＋PV/EV/BAC）。
- 提示規律: SPI/CPI=N/A を潰さない（算出不能の明示）、可視ギャップ（R-U9/P0）、de-rate（R-S4/R-S6 同型）。

### Out
- 導出式の本体（EV_abs/EV%/累積EV/見積カバレッジ/実行カバレッジ/PV/AC/SPI/CPI/sunk）= `moira-evm`。
- 平準化(P7/P8)/予測/D_pred/スケジュール・カバレッジ/buffer 残量・消費率の**導出** = `moira-schedule`（本 spec は表示する側）。
- tree+DAG/effective-set/ready/restoration の導出 = `moira-scope-deps`。
- 9 warning（R-T4 期日超過・R-S3 thrashing・R-S6 de-rate 等）の**確定・集約・行為列挙** = `moira-health`／集約・ルーティング = `moira-surface-decision`（decision インボックス）。
- ノード木/トレーサビリティ/見積カバレッジ行明細の主 host = `moira-surface-spec-value`、Gantt/担当/未割当 = `moira-surface-schedule`。
- 全 write（スコープ/期日判断・再ベースライン・c 宣言等の人間コミット行為）= moira-* write skill 群。emit/derive・二層データ・effective-set 導出・latest-wins・状態機械・凍結記録・R-S2 オーケストレータ = `moira-core`。
- CCPM のバッファ**生成**（安全余裕除去＋末尾集約）・ゾーン閾値（GREEN/YELLOW/RED）= 正典外（MODEL §5）。工数軸（MD/MM）のバッファ = §7#11 開示の未採用拡張。

## Boundary Candidates
- EV_abs（累積EV）と EV%（現行進捗）の区別ゾーン表示（R-S5）— 本 spec が host（分離提示）、式・effective-set は evm/scope-deps。
- SPI/CPI/PV/AC/SV/CV の提示＋SPI の R-S6 de-rate — 本 spec が host、式・スケジュール・カバレッジは evm/schedule。
- 実行カバレッジ（R-S8）の EVM 文脈再掲（三者対読み副 host）— 本 spec（主 host は spec-value）。
- スケジュール・バッファ残量/消費率（R-T6）＋CCPM フィーバー＋境界条件＋de-rate 対読み — 本 spec が host、D_pred/buffer 導出は schedule。
- 人別 SPI/CPI 時系列・明快メトリクス（見積カバレッジ＋PV/EV/BAC）— 本 spec。

## Out of Boundary
- 導出の計算・D_pred/buffer/スケジュール・カバレッジの導出・warning 確定・集約・全 write。これらは消費するのみで再定義・再計算しない（UI-ARCH §6・roadmap「検出=読/解消=書」「行為列挙は導出層に一本化」「de-rate 型は inbox 非集約・該当ダッシュボードの常時メトリクス修飾」）。

## Upstream
- `moira-evm` — EV_abs/EV%/累積EV/見積カバレッジ/実行カバレッジ(R-S8)/PV/AC/SPI/CPI/sunk の式本体を提供。
- `moira-schedule` — 平準化(P7/P8)/予測/D_pred/スケジュール・カバレッジ/buffer 残量・消費率(R-T6) を提供。
- `moira-health` — 9 warning（R-T4/R-S3/R-S6 de-rate 等）の確定・行為列挙の単一定義を提供（本 spec は R-S6 de-rate を常時メトリクス修飾として読み、判断型警告は inbox へ深リンク）。
- （基盤）`moira-core` — R-S2 導出オーケストレータ・二層データ・latest-wins・状態機械・凍結記録。

## Downstream
- なし（surface は読専用の末端）。判断型警告（R-T4 期日超過・R-S3 thrashing）の集約・ルーティングの**発信先**は `moira-surface-decision`（decision インボックス）だが、本 spec はそこへ深リンクする側であり inbox の責務を所有しない。

## Existing Spec Touchpoints
- `moira-core`（生成済・依存契約の消費元）。
- `moira-evm` / `moira-schedule` / `moira-health`（上流・生成済・本 spec が導出を消費）。
- UI-ARCHITECTURE §3/§4.1/§4.3/§5/§6（割付・規律の派生設計ソース）。
- validation-scenarios S4（健全性のリアルタイム把握・対読み）・S5（期日検算・バッファ正常系）・S6（カバレッジ信頼性 de-rate）・S9（見積膨張・EV 非単調）・S12（supersede・累積/現行区別 R-S5）・S14（実行カバレッジ R-S8 固有判断）・S15（バッファ境界条件 R-T6）。

## Constraints
- `moira/MODEL.md` v16 を SSOT として凍結遵守。MODEL の文言を変えず・新概念を足さず、提示の下限を MODEL からトレースする。
- read-only: 自前の真実源・可変状態・dismiss フラグ・隠れキャッシュを持たない（UI-ARCH §6）。deep-link は再計算でなく参照（二系統計算禁止）。
- 三者（EV%・見積カバレッジ・実行カバレッジ）は次元が異なるため算術和して全体進捗としない（R-S4/R-S6 同型の de-rate）。SPI は低スケジュール・カバレッジで de-rate（R-S6）、バッファは低スケジュール・カバレッジで de-rate（R-T6・R-S6 同型）。
- SPI/CPI=N/A（PV/AC=0）を 1.0/0 に潰さず「算出不能」として可視ギャップに出す（P0）。時系列は valid-time c 制約下で実点のみ・補間/捏造曲線を描かない。
- EARS は ja・`requirements-style.md` 準拠（英文＋和訳併記）。トレースは `trace-notation.md` 準拠。命名は `moira-naming.md` 準拠（累積EV/実行カバレッジ/コミット判断）。
- 本段は requirements.md のみ生成（design/tasks は後続）。
