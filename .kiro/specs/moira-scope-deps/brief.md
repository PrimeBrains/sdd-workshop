# Brief — moira-scope-deps

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）→ `.kiro/steering/roadmap.md` 確定版。本 brief は roadmap の `moira-scope-deps` 行を一次ソースに、`moira/MODEL.md`(v16, 凍結) 準拠で just-in-time 作成。
> 位置づけ: CQRS 分解の **Wave1**（読/導出 spec）。`moira-core` の emit/derive 契約・effective-set・latest-wins・状態機械を **消費**し、tree+DAG 構造・依存/置換辺・ready/orphan/restoration の **導出（読み）** を所有する spec。

## Problem
Moira の正典モデル `moira/MODEL.md`(v16) は、プロジェクトを「見積を持つノードの **木**（価値集約）とポリシー付き辺の **DAG**（時間制約）が重なる構造」と定義し（A3）、その上に ready 判定（R-D1/R-D2）・依存/置換（supersede）辺（R-D7）・現行有効集合と restoration（R-S5）・cancel 孤児（R-C3, R-C1）といった **構造導出**を規定している。しかし `moira-core` が emit/derive 契約と effective-set の **基盤**を凍結する一方で、「木と DAG の二重グラフをどう読み出すか」「ready をどう導出するか」「supersede 辺と依存辺をどう種別分離して評価するか」「cancel 孤児をどう **検出（読み）** するか」という **構造・依存の読み出し責務が spec として凍結されていない**。これが曖昧なまま下流（surface-spec-value の DAG ビューア・surface-schedule の依存表示・cancel-scope skill の孤児評価・relate-edit skill の辺操作）が進むと、述語評価（R-D4）・閾値既定（R-D2）・restoration 規則（R-S5）の解釈が分散し、辺の組合せ爆発・誤った ready 解放・孤児の見落としが起きる。

## Current State
- 参照実装（フォワード本番・プロト）の `moira/backend/src/derivations/effective-set.ts` が現行有効集合（supersede×cancel 復帰規則 R-S5）と有効葉を導出済み、`node-states.ts` がノード状態を射影済み。tree（`childrenOf`）・DAG（依存辺・supersede 辺）の構造は `ProjectedState`（`moira-core` 所有）に既にある。
- ただし ready 判定（R-D1/R-D2 の閾値ポリシー・辺種別別既定）・cancel 孤児評価（R-C3 の依存辺走査）・述語評価（R-D4 の「源配下の全葉がポリシー充足」）の **読み出し導出**が独立したファイル/責務として凍結されていない。
- effective-set 自体は `moira-core` が **定義**する横断概念であり、本 spec はその出力（現行有効集合・有効葉）を **消費**して tree+DAG 表示・ready・orphan を導出する（再定義しない）。

## Desired Outcome
`moira-scope-deps` は、`moira-core` の契約を消費しつつ次の **構造・依存の読み出し導出**を所有する:
1. **tree+DAG の二重グラフ読み出し** — 木（所属 §2.6）と DAG（論理依存 §2.6）を混同せず区別して読み出す（A3）。
2. **依存/置換（supersede）辺の種別分離** — 依存辺は ready 判定に使い、置換辺は ready 判定に使わない（§2.7・R-D7 辺）。
3. **ready 導出（R-D1/R-D2）** — 先行群が辺の閾値ポリシーを満たしたとき ready をマーク、未指定時は辺種別別既定（仕様フェーズ辺 `accepted` / 実装タスク辺 `implemented`）を適用。
4. **述語評価（R-D4）** — 流入辺を「源配下の全葉がポリシー充足」という論理述語として評価し、辺を物理増殖させない。
5. **cancel 孤児の検出（読み・R-C3, R-C1 読）** — 先行が cancelled へ遷移し閾値が永久充足不能になったとき、被ブロック後続・未充足辺・取りうる行動を **特定（警告データの生成）**。**自動キャンセルせず**（解消＝書きは cancel-scope skill）。
6. **restoration の読み出し（R-S5）** — supersede 元（新ノード）が cancelled のとき旧ノードが現行有効集合へ復帰することを、`moira-core` の effective-set 導出規則に接地して読み出す。
7. **非循環の前提（I2）** — DAG の非循環は `moira-core`（fold）が enforce する前提で、孤児評価が有限終了することを保証する（読み側は循環不在を前提に走査する）。

## Approach
- MODEL を SSOT として、参照実装 `derivations/{effective-set.ts,node-states.ts}` の seam に整合させる。本 spec は **読み（導出）のみ**を所有し、辺の追加/削除・cancel 発行・restoration を起こす書きは下流 skill（relate-edit / cancel-scope）が所有する（**検出=読 / 解消=書 の分離**, roadmap）。
- effective-set / latest-wins / 状態機械 / 4 イベント emit / derive 契約は `moira-core` が **定義**し、本 spec はこれを **消費**する（再定義しない）。effective-set の supersede×cancel 復帰規則そのものの所有は core にあり、本 spec はその出力を tree+DAG / restoration 表示として読み出す。
- cancel 孤児は **検出（警告データ）** までを所有し、警告の確定・集約・clearance は `moira-health` が所有する（roadmap: 検出データは各 derivation、警告確定/集約は health）。本 spec は orphan の検出述語・被ブロック後続・取りうる行動の列挙データを提供する。

## Scope
### In
- tree（所属）と DAG（論理依存）の二重グラフを区別して読み出す導出（A3・§2.6）。
- 依存辺と置換（supersede）辺の **種別分離**読み出し（依存辺＝ready 判定に使う・置換辺＝ready 判定に使わない；§2.7・R-D7 辺）。
- ready 導出（R-D1）と閾値ポリシー保持・辺種別別既定の適用（R-D2）。
- 述語評価（R-D4：流入辺＝源配下の全葉がポリシー充足の論理述語・辺非増殖・流出辺はノード水準保持）。
- cancel 孤児の **検出（読み）**（R-C3：cancelled 先行を源とする依存辺の永久充足不能判定・被ブロック後続/未充足辺/取りうる行動の特定・自動キャンセルしない・有限終了）。R-C1 はノード単位 cancel が R-C3 を発火する **読み側の接続**として参照。
- restoration の読み出し（R-S5：supersede 元 cancelled→旧ノード復帰を core の effective-set 導出に接地して読む）。
- 木の子ノードが所有木でなく DAG 依存辺を通じて R-C3 評価される規則の読み出し（親 cancel は親が子の DAG 先行でもある場合のみ R-C3 発火）。

### Out
- effective-set の **導出規則そのものの所有**（supersede×cancel 復帰規則の定義）→ `moira-core`（本 spec は出力を消費）。
- 辺の追加/削除・supersede 辺の発行・ready を起こすライフサイクル遷移・cancel 発行（`relate`/`transition` の emit）→ `moira-relate-edit` / `moira-cancel-scope` / `moira-progress`（書き skill）。
- 9 warning の **確定・集約・clearance**・行為列挙の単一定義 → `moira-health`（本 spec は orphan 検出データを提供するのみ）。
- sunk EV_abs・cancelled の active basis 除外の **会計**（R-C2）→ `moira-evm`（cancel 意味論の構造側は本 spec、金額導出は evm；roadmap 共有シーム）。
- EV%/見積被覆/PV/SPI 等の **指標式** → `moira-evm` / `moira-schedule`。
- 循環 relate の **拒否（書きゲート）**（I2/R-D3 の enforce）→ `moira-core`（fold が機械的に拒否）。本 spec は I2 を読み側の有限終了前提として参照するのみ。
- tree+DAG ビューア・アコーディオン等の **UI** → `moira-surface-spec-value` / `moira-surface-schedule`（本 spec は導出を出すのみ）。

### Boundary Candidates（本 spec が所有を主張する seam）
- `moira/backend/src/derivations/effective-set.ts` の **消費面**（現行有効集合・有効葉を読み、tree+DAG/restoration 表示へ）。導出規則の所有は core。
- ready 導出（R-D1/R-D2）の純関数（参照実装には未独立＝本 spec で責務確定）。
- cancel 孤児検出（R-C3）の純関数（依存辺走査・永久充足不能判定・行動列挙）。
- 述語評価（R-D4）の論理述語ロジック（源配下の全葉がポリシー充足）。
- tree（`childrenOf`）/DAG（依存辺・supersede 辺）の二重グラフ読み出しビュー。

## Out of Boundary（本 spec が触らない）
- `ProjectedState` / `DerivedState` のスキーマ・fold・emit/derive 契約 → `moira-core`。
- 指標式（`ev.ts`/`coverage.ts`/`pv.ts`/`indices.ts`）→ `moira-evm`。
- leveler/forecast（`leveler.ts`/`forecast.ts`）→ `moira-schedule`。
- warning 確定・集約 → `moira-health`。
- 全 UI コンポーネント・サーフェス。

## Upstream（本 spec が消費する）
- **`moira-core`**（roadmap: Dependencies: moira-core）。消費する core の契約: emit/derive API、二層データ、**effective-set 導出**（supersede×cancel 復帰規則 R-S5 の定義）、`(ts,id)` latest-wins（I3）、ノード/見積 状態機械、4 イベント emit、DAG 辺種別（依存/置換）と充足ポリシーの記録（`relate` スキーマ）、非循環 enforce（I2/R-D3 の fold ゲート）。
- 一次資料: `moira/MODEL.md`(v16, 凍結・SSOT) §2.3/§2.6/§2.7・R-D1–D7・R-C1/C3・R-S5・I2。

## Downstream（本 spec の導出を消費する）
- **read spec**: `moira-health`（orphan 検出データを警告確定/集約へ）、`moira-surface-spec-value`（tree+DAG ビューア・トレーサビリティ）、`moira-surface-schedule`（依存表示）。`moira-evm`（現行有効集合・有効葉の基底を消費）。
- **write skill**: `moira-relate-edit`（依存/supersede 辺操作の構造前提）、`moira-cancel-scope`（孤児評価データを cancel 発行・付替・後続 cancel の判断材料に）、`moira-decompose-author`（R-D7 辺・I1 整合の構造前提）。
- 共有シーム（roadmap）: sunk EV（cancel 意味論=本 spec / 金額導出=evm）、warning 述語（検出データ=本 spec の orphan / 確定=health）、effective-set（定義=core / 表示=本 spec / 分母消費=evm/schedule/health）、検出=読（本 spec）/解消=書（cancel-scope/relate-edit）の分離。

## Existing Spec Touchpoints
- 既存生成済み spec: `moira-core`（Wave0）。本 spec はその requirements が所有する emit/derive・二層データ・effective-set・latest-wins・状態機械・凍結記録を **消費**する前提で書く（core が所有する概念を再定義しない；cross-spec 参照は `moira-core/<ID>`）。
- 参照実装（`moira/backend`・`moira/frontend`）は spec ではなくフォワード本番プロト。design はこの seam に整合させ、出力スキーマは MODEL 準拠とする。

## Constraints
- `moira/MODEL.md` v16 を **SSOT として凍結遵守**。MODEL の文言を勝手に変えない・新概念を足さない。モデル変更は `moira-model-update` ゲート経由のみ。
- **検出=読 / 解消=書 の分離**（roadmap）: 本 spec は ready/orphan/restoration の **検出・読み出し**のみ。辺操作・cancel 発行・遷移は書き skill が所有する。
- **辺種別の分離**（§2.7・R-D7）: 依存辺は時間制約で ready 判定に使い、置換（supersede）辺は価値・履歴関係で ready 判定に使わない。
- **辺非増殖**（R-D4）: 流入辺は論理述語として評価し物理的に増殖させない（大規模での組合せ爆発回避）。
- **自動キャンセル禁止**（R-C3/P0）: 全先行 cancelled でも一部でも本 spec は自動でキャンセルせず、人間が決める（書きは cancel-scope skill）。
- **非循環前提**（I2/R-D3）: DAG 非循環は core（fold）が enforce する前提で、孤児評価が有限終了する。本 spec は循環拒否そのものを所有しない。
- **effective-set は消費**: 現行有効集合・restoration 規則（R-S5）の定義は core が所有。本 spec はその出力を tree+DAG/restoration として読み出す（再定義しない）。
- EARS は ja・`requirements-style.md` 準拠（英文＋和訳併記）。トレースは `trace-notation.md`（cross-spec は `moira-core/<ID>`）、命名は `moira-naming.md`、配置は `structure.md`/`tech.md`。
- **0a 依存（Phase 0 決着済）**: A1 射程＝「spec」は遂行され出来高(EV_abs)を生むあらゆる作業単位（運用/バグ/ad-hoc も feature ノード）。フェーズ子ノードと実装タスクは feature の子として同列（§2.6）。バッファ等の導出会計量はノードでない。本 spec の tree+DAG 読み出しはこの射程に従う。
