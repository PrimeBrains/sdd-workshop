# Brief — moira-surface-spec-value

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）→ `.kiro/steering/roadmap.md` の読/導出 spec 行を一次ソースに、`moira/MODEL.md`(v16, 凍結) からトレースして起こした just-in-time brief。CQRS 分解の Wave3（surface 群、`[0d]` 後着手）。

## Problem
Moira 正典 MODEL v16 は「spec とその分解＝ノードの木と DAG の上を流れる 4 イベントから、進捗・価値の観測をすべて導出する」モデルを確定したが、**仕様・価値の軸**（feature ─ req/design/tasks/impl のノード木、トレーサビリティ、見積カバレッジ、現行有効集合の EV%、実行カバレッジ）を人間が読むための常駐ダッシュボード面が、本番アーキとして spec 化されていない。MODEL は提示の下限（R-S2 の導出群・R-S4/R-S5 の区別表示・R-U9/P0 の可視ギャップ）を既に強制しているが、その「仕様・価値」軸への割付（UI-ARCHITECTURE §3 `spec-value`・§4.1/§4.3・§5）は派生設計どまりで、消費契約（どの導出をどう対読みするか）を要件として固定する spec が無い。

## Current State
- 正典: `moira/MODEL.md`(v16) — A1（単一実体ノード）・P1（EV_abs/EV%）・P2（見積カバレッジ）・R-S2（導出群提供）・R-S4（低カバレッジ de-rate）・R-S5（現行有効集合の区別表示）・R-S8（実行カバレッジ）・R-U9/P0（可視ギャップ）・R-D1（ready 表示）・§2.6（フェーズ＝ノード）・§2.7（supersede）。
- 派生設計: `moira/UI-ARCHITECTURE.md` §3 で `spec-value` を「フェーズノード木・トレーサビリティ・見積カバレッジ・現行有効集合 EV%・見積合意」、§4.1 で EV%／見積カバレッジ／実行カバレッジ（R-S8）の**三者対読みの主 host**、§5 で三者併置・ノード木・トレーサビリティ・現行有効集合（R-S5）・低カバレッジ de-rate（R-S4）、§6 で read-only 規律（自前状態なし・deep-link は再計算でなく参照・二系統計算禁止）を規定。
- 基盤契約: `.kiro/specs/moira-core/requirements.md`（生成済）が emit/derive・二層データ・effective-set（R-S5 復帰規則）・latest-wins・状態機械・凍結記録・R-S2 導出オーケストレータを所有。
- 参照実装（フォワード本番）: `moira/frontend/src/surfaces/spec/SpecValueSurface.tsx`（EV%＋見積カバレッジ対読み・ノード木＋状態 pill・被覆マトリクス＝行クリック明細の素地・トレーサビリティ dependency/supersede 描き分け）。`moira/backend`（derive の縦スライス）。
- 上流（未生成）: `moira-evm`（EV%/累積EV/見積カバレッジ/実行カバレッジ R-S8 の式本体）・`moira-scope-deps`（tree+DAG/ready R-D1/effective-set/restoration R-S5）。

## Desired Outcome
MODEL v16 の「仕様・価値」軸を、core/上流の導出を**読むだけ**の read-only ダッシュボードとして要件化する。具体的には:
- ノード木（feature ─ req/design/tasks/impl）をアコーディオン表示し、進行中（`implementing`）ノードを上位に出す。
- トレーサビリティ（木＋relate DAG）を、再利用可能な DAG ビューア部品として dependency 辺と supersede 辺を描き分けて表示。
- 見積カバレッジ（P2）と EV%（R-S5・現行有効集合）と実行カバレッジ（R-S8）を**三者併置で対読み**し、算術和しない（R-S4/R-S6 同型の de-rate）。
- 見積カバレッジ／被覆マトリクスは**行クリックで葉明細**（合意/スケジュール/完了/EV 寄与）へ展開。
- `proposed` のまま停滞している見積ノードを抽出するフィルタ。
- 深リンク（decision インボックス等から特定ノード/警告起点へ着地）。

## Approach
read-only ダッシュボード（UI-ARCHITECTURE §6 規律: 自前の真実源・可変状態・隠れキャッシュを持たず、core の R-S2 導出を read 派生として描く）。導出式・effective-set 導出・ready 判定は **core/上流が所有**し、本 spec はそれらを消費して提示・対読み・行クリック明細・フィルタ・深リンクのみを要件化する。三者対読みの主 host（R-S8）として、提示規律（算術和禁止・低カバレッジ de-rate）を本 spec が担保する。

## Scope
### In
- 仕様・価値軸の read 提示: ノード木（アコーディオン＋進行中上位）、トレーサビリティ＋DAG ビューア（再利用部品）、見積カバレッジ表示、現行有効集合の EV%、実行カバレッジ（R-S8）、三者対読み（主 host）、見積カバレッジ＝行クリック明細、`proposed` 停滞フィルタ、深リンク受理、ready 表示（R-D1）。
- 提示規律: 低カバレッジ時の EV de-rate（R-S4）、現行有効集合と累積 EV の区別表示（R-S5）、可視ギャップ（R-U9/P0）。

### Out
- 導出式の本体（EV_abs/EV%/見積カバレッジ/実行カバレッジ/PV/AC/SPI/CPI/sunk）= `moira-evm`。
- tree+DAG/依存・supersede 辺/effective-set/ready(R-D1)/orphan(R-C3 読)/restoration(R-S5) の**導出** = `moira-scope-deps`（本 spec は表示する側）。
- 平準化/予測/スケジュール被覆/buffer = `moira-schedule`、Gantt/担当表示 = `moira-surface-schedule`。
- SPI/CPI/PV/トレンド/バッファ可視化 = `moira-surface-health`。
- 9 warning 確定・集約・行為列挙の単一定義 = `moira-health`／decision インボックス = `moira-surface-decision`。
- 全 write（見積合意 proposed→agreed・再見積・割当・キャンセル・config 等の人間コミット行為）= moira-* write skill 群。emit/derive・二層データ・effective-set 導出・latest-wins・状態機械・凍結記録 = `moira-core`。

## Boundary Candidates
- ノード木の表示（アコーディオン・進行中上位・ready 表示）— 本 spec が host（表示）、ツリー構造/ready 判定の導出は scope-deps。
- トレーサビリティ DAG ビューア（再利用部品・dependency/supersede 描き分け）— 本 spec が host、辺データは scope-deps。
- 三者対読み（EV%・見積カバレッジ・実行カバレッジ）の主 host（UI-ARCH §4.1）— 本 spec。
- 見積カバレッジ＝行クリック明細・`proposed` 停滞フィルタ・深リンク — 本 spec。

## Out of Boundary
- 導出の計算・effective-set/ready/restoration の導出・warning 確定・全 write。これらは消費するのみで再定義・再計算しない（UI-ARCH §6・roadmap「検出=読/解消=書」「行為列挙は導出層に一本化」）。

## Upstream
- `moira-evm` — EV%/累積EV(EV_abs)/見積カバレッジ/実行カバレッジ(R-S8) の式本体を提供。
- `moira-scope-deps` — tree+DAG/dependency・supersede 辺/effective-set(R-S5)/ready(R-D1) を提供。
- （基盤）`moira-core` — R-S2 導出オーケストレータ・二層データ・latest-wins・状態機械・凍結記録。

## Downstream
- なし（surface は読専用の末端）。深リンクの**発信元**は `moira-surface-decision`（decision インボックス）だが、本 spec はその着地を受理する側であり責務を所有しない。

## Existing Spec Touchpoints
- `moira-core`（生成済・依存契約の消費元）。
- `moira-evm` / `moira-scope-deps`（上流・未生成・本 spec が導出を消費）。
- UI-ARCHITECTURE §3/§4.1/§4.3/§5/§6（割付・規律の派生設計ソース）。
- validation-scenarios S1（立ち上げ）・S2（見積合意・カバレッジ）・S3（フェーズ進行・R-S4）・S6（カバレッジ信頼性）・S12（supersede・R-S5）・S14（実行カバレッジ R-S8 固有判断）。

## Constraints
- `moira/MODEL.md` v16 を SSOT として凍結遵守。MODEL の文言を変えず・新概念を足さず、提示の下限を MODEL からトレースする。
- read-only: 自前の真実源・可変状態・dismiss フラグ・隠れキャッシュを持たない（UI-ARCH §6）。deep-link は再計算でなく参照（二系統計算禁止）。
- 三者（EV%・見積カバレッジ・実行カバレッジ）は次元が異なるため算術和して全体進捗としない（R-S4/R-S6 同型の de-rate）。
- EARS は ja・`requirements-style.md` 準拠（英文＋和訳併記）。トレースは `trace-notation.md` 準拠。命名は `moira-naming.md` 準拠（累積EV/実行カバレッジ/コミット行為）。
- 本段は requirements.md のみ生成（design/tasks は後続）。
