# Moira UI 設計ブリーフ（高フィデリティ実装の正本）

> 由来: UI 専門家 × Moira ドメイン専門家の敵対ディベート（9エージェント / Positions→Debate→Audit→Synthesis）の合成成果。`moira-adversary` 監査で検出した Critical 4 / Important 6 / Minor 3 を全件 §0 に織り込み済み。
> 位置づけ: `moira/MODEL.md`（正典 v14）と `moira/UI-ARCHITECTURE.md`（5サーフェス・被覆表）を**上位**とし、本書はそれを UI 実装へ写像する設計判断を確定する。両者と矛盾した場合は正典が優先。
> 対象実装: `moira/frontend/`（Vite + React + TS、backend `derive()` 直 import）。

---

## 0. 不変条件（実装前に全サーフェスで満たす「赤線」）

`moira/backend/src/` の実地検証で確定した事実と、それが課す設計制約。**全実装者の必須チェック項目。**

1. **`ForecastRow.frozenSlot` は完了葉でも `null` になりうる**（`types.ts:152-156`, `pv.ts`, MODEL:197）。c=0 の日だけ働いて完了した葉＝「完了・未スケジュール」。稲妻線の完了葉Xを一律 `frozenSlot` に置く設計は禁止（null を 0/asOf に代入した瞬間 P0・R-S6 違反）。→ **第三状態「完了・未スケジュール（PV不算入の可視ギャップ）」を明示描画**。
2. **視点 actor は backend に無い**。三キュー＝`kind`（作業/レビュー/エージェント, `queues.ts`）であって「自分/他者」ではない。**actorフィルタは「全員/人間/エージェント」に確定**、「自分」キューは backend 拡張までグレーアウト予約。
3. **trend 系列・valid-time c が無い**（`http.ts` は `/derived?asOf=` 単発、`capacityOf` に as-of 引き無し、MODEL:479 が valid-time 未担保と明言）。**trend/前日比は valid-time c lookup 新設までブロッカー**、それまで「単一 asOf のみ正・過去点は描かない」に縮退。
4. **スケジュール・バッファは MODEL v15（R-T6）で正典化されたが backend には未実装**。期日・目標日を構成入力とし、**バッファ残量 = max(0, 期日 − 導出完了)**・消費率を**スケジュール・カバレッジ対読みで de-rate**して導出する（R-T6/§3）。**ただし `isBuffer` ノードは A1 違反ゆえ不採用**（「isBufferノード由来」表現は全廃のまま）、**CCPM のバッファ生成・工数軸（BAC×想定生産性）・ゾーン閾値は不採用**（§5・§7#11）。backend に確定導出ができるまでは **Fever/buffer は別型の provisional 専用ソースのみ**から供給し、未供給時は空状態を正直表示（fever 風の消費%×進捗% 可視化は提示の自由 P0、ただし正典のバッファ定義は二参照日付＋導出完了であって安全余裕集約ではない）。
5. **`cumulativeEvAbs` は supersede 込・cancelled（サンク）除外**（`ev.ts:39`）。「サンク込」表記は誤り。サンク EV_abs を出すなら別系列（backend 拡張依存）。
6. **`level`（木の深さ）フィールド無し**（`parent`/`childrenOf` のみ）。インデントは **`effectiveLeaves`/有効木に限定した深さ**を UI が `childrenOf` から算出（supersede/cancelled で抜けた子を飛ばす）。
7. **`staleCause`・`commit-decision` 無し**。R-S7「原因別」Pill と contract改定→inbox 第5判断連動は backend 追加までブロッカー（未実装の間は「stale（原因未分類）」に縮退・contract 再分類を UI で生成しない）。

**用語精密化**：「フロント計算ゼロ」＝**数値メトリクス（SPI/PV/EV/EAC/coverage 等）の再計算ゼロ**。表示用の射影変換（有効木の深さ算出・entry 存在判定・大小比較・kind フィルタ）は許容。確定基準は **独立敵対ゲートの残存 Critical/Important = 0**（網羅証明ではない）。

---

## 1. 全体方針

**「evm-app の視覚言語・SVG テクニック・インタラクション骨格を全面採用し、データ供給と書き込み対象だけを Moira 導出層（単一 `DerivedState`）＋イベント追記に差し替える」。**

### 採るもの（手本）
- warm-paper デザイントークン（`mockup/shared.jsx` の `EVM` 24-50）、Source Serif 4 大数値＋`tabular-nums slashed-zero`、JetBrains Mono 等幅。
- HTML 行 + SVG 3層 Gantt（`shared.jsx:487-747`）、clipPath 左右色分け稲妻線、基準日縦線。
- SpiTrend の invisible hit-strip hover＋ツールチップ（`shared.jsx:232-336`）、Sparkline（455-467）。
- Fever のゾーン polygon・トレイル（`shared.jsx:338-451`）※ provisional として隔離。
- Portal 全画面（`variation-a.jsx:999`、createPortal + Esc + `overflow:hidden` + evmSlideUp）。
- sdd-dashboard：SpecCard 承認チップ、CoverageTable 未カバー赤、RequirementsView、FlowGraph(`@xyflow/react`)、Accordion 相互ナビ＋anchor-flash、MarkdownView（GFM/ハイライト/mermaid）。

### 死守するもの（正典）
1. 全数値は**単一 `derive()` 出力の props 射影**（二truth 禁止 R-S2）。各画面で別 derive を呼ばない。
2. write は**4イベント追記 or c 改定のみ**。可変 progress/state/見積フィールドを持たない（A2）。
3. 警告に **self-state（dismiss/seen/snooze）なし**。会計から除かない（§2.1）。消滅は導出再評価のみ。
4. **EV% ↔ estimateCoverage**・**SPI ↔ scheduleCoverage** を必ず対表示。SPI 生値を presenter が de-rate。**SPI は全体進捗ではない**（R-S4/R-S6）。
5. **EV_abs = 完了 ∧ agreed の frozenBudget 二値和**。%完了×見積は使わない（P1、evm-studio 式禁止）。
6. **凍結 PMB（frozenSlot）と生きた予測 EAC（predictedCompletion）を2レイヤー描画**（§3/R-S7）。
7. スキル属性なし（A4）・担当単一 latest-wins（R-T5）・c∈[0,1.0]（0含む）理由必須・追記専用（R-U14）・α_i は表示専用 view。

### テーマ・シェル
- **warm-light（evm-app）に一本化**（dark の現モックと sdd-dashboard dark を破棄）。
- 区別表示（R-S4/R-S5/R-S6/R-S7）は**色＋形（破線/ハッチ/ラベル）の二重符号化を義務化**（色覚・印刷耐性）。
- evm-app `WorkbenchShell`（top bar + 232px 左 rail + center + 380/440px right inspector）に **Moira 5サーフェス**を載せる。役割（管理者/開発者）は物理分割せず **actor kind プリセット/フィルタ**に降格。

---

## 2. サーフェス別 設計

### 2.1 spec-value（仕様・価値 / read）
- **SpecCard**：sdd-dashboard の単一 approved boolean を捨て、**lifecycle 6状態（pending/ready/implementing/implemented/accepted/cancelled）＋ estimateState（proposed/agreed）を多面 Pill**で表示（`nodeStates` 射影）。承認＝`implemented→accepted` transition 追記。`proposed→agreed` ボタンは **human actor のみ活性**（R-U4／backend が agent 合意を `structuralErrors` に落とす）。
- **CoverageTable**：sdd-dashboard の regex パーサを捨て、`estimateCoverage`・`scheduleCoverage`・`effectiveLeaves` から供給（被覆判定の二truth 回避）。未カバー行を赤、グループ初期展開、クリックで anchor ジャンプ。
- **EV% を描く全箇所**で estimateCoverage を隣に必須配置、低カバレッジ時 de-rate（淡色＋斜線ハッチ＋「霧の中の既知部分の達成度」注記、R-S4）。
- **SpecFlowGraph**（`@xyflow/react` LR）：`supersedeEdges`（新→旧）と `dependencyEdges` を**別種で描き分け**、状態色、ノードクリックで該当文書へ deep-link、全画面 remount + fitView。
- タブ：req/design/tasks（markdown+mermaid）＋ `_traceability`/`_coverage`/`_taskflow`（遅延ロード・active ガード）。

### 2.2 schedule-time（スケジュール・時間 / 母 view）→ §3。

### 2.3 health（健全性・EVM / read）
- **二ゾーン分離**（R-S5/R-C2）。
  - **上＝現行進捗**：`evPercent` と `estimateCoverage` を SummaryStat で**必ず対並置**（EV% 単独禁止 R-S4）、`spi` と `spiScheduleCoverage` を**対並置し de-rate**（R-S6）、`pv`/`evAbs`/`ac`/`cpi`。`spi===null`/`cpi===null`（PV=0/AC=0）は **1.0/0 に潰さず「算出不能」空表示**。
  - **下＝累積稼得**：`cumulativeEvAbs`（**supersede込・cancelled除外**）を `paperWarm` 背景で隔離。サンク EV_abs を見せるなら別系列（拡張依存）。
- 前日比＝`derive(asOf:today)` と `derive(asOf:yesterday)` の二導出差（**スナップショット保存禁止 A2**。yesterday も valid-time c が要る＝§4.1 と同じブロッカー）。
- 固定閾値色帯なし（1.0 破線のみ EVM 慣行で可）。「SPI＝スケジュール済み領域内の進捗率（全体進捗ではない）」常設注記。
- SPI/CPI 推移・Fever → §4。

### 2.4 decision インボックス（横断・行為 / 層B）
- AlertStrip（`variation-a:531-569`）を全画面インボックスに拡張。各行 onJump→文脈 write へ deep-link。
- **dismiss/既読/スヌーズ ボタンを一切置かない**（§2.1 self-state 禁止＝P0 falsifiable line）。new（brand Dot）/standing（ink3 Dot）を色で区別し standing 畳み可だが、**件数サマリ「全N件・うち据え置きM件」で会計算入を常時可視化**。
- **集約8警告**（R-U12/R-U13/R-T3/R-T4/R-S3/R-S7/R-C3/P5）。**R-S6/R-S4 は de-rate 型ゆえ非集約＝health の常時メトリクス修飾**。
- 消滅は導出再評価のみ（UI-ARCH §4.2 消滅トリガー表どおり）。各警告の選択肢列挙（R-T4 3択 等）は**導出層に一本化**（二重実装しない）。コミット判断点のみ書込ボタン（dirty 時活性・理由メモ付き）。第5判断＝c宣言（contract）は capacity 面。

### 2.5 capacity·calendar config（層B）→ §5。

---

## 3. リッチ Gantt 詳細仕様

`<ScheduleGantt derived asOf actorKindFilter onNodeClick onIntentDraft />`。データは単一 `derive()` の射影のみ。

### 3.1 行・親子インデント・担当者
- HTML 行 + SVG 3層（`shared.jsx:487-747` 継承）。インデント＝`paddingLeft: 4+(有効木深さ-1)*14`（有効木深さは `childrenOf`＋`effectiveLeaves` から UI 算出、赤線#6）。
- 親＝三角キャップ細線、葉＝枠線バー。担当者＝行ラベルに **アバター＋名前のみ**（**スキル/レベル/習熟度欄を作らない** A4/R-U6）。`assignee: Actor|null`（単一 R-T5）。
- **エージェント行（kind='agent'）は別色 #6c7a59 ＋非平準化ハッチ**で人間行と視覚区別（A5/R-U11）、**過負荷標識を出さない**。
- **バッファ行は描かない**（isBuffer は backend に無い・赤線#4）。provisional ソース供給時のみ `paperWarm` 隔離＋「暫定・正典未確定」Pill の差し込み口を用意。

### 3.2 稲妻線＝三状態マーカー（赤線#1）
evm-app のジグザグ SVG path・clipPath 左右色分け・基準日縦線・進捗点丸は**形を全採用**。`t.progress/100` 線形中間点（`shared.jsx:511`）は **P1 違反ゆえ撤去**。頂点 X 座標と色を `ForecastRow` から再構築：
- **状態A 完了∧frozenSlot有**：頂点 X = `frozenSlot` の X（獲得済み PV 位置）、**塗り円**。
- **状態B 未完**（schedulable で `predictedCompletion` あり）：頂点 X = **基準日 asOf 縦線上**（未獲得0）、**中空円**。
- **状態C 完了∧frozenSlot=null（第三状態・新規）**：MODEL:197 の正規ケース。frozenSlot を 0/asOf に代入せず、**「PV不算入の可視ギャップ」帯**（`critSoft` 斜線ハッチ＋「完了・未スケジュール（PVに載らない）」ラベル）を行に描き、稲妻線には参加させない。EV_abs に寄与する旨を Inspector で明示。
- `predictedCompletion===null` の未完葉も asOf に置かず未スケジュール薄表示。
- **色分け**：%でなく **`predictedCompletion` vs `frozenSlot` の前後**（R-S7 乖離）で clipPath 左右色分け（遅れ橙 #d97706 / 先行緑 #2d8a4e、両 null は対象外）。
- 量感の代替：完了葉数/agreed葉数 と EV_abs/PV 帯幅を別途明示。凡例「EV_abs は完了二値・部分クレジット無し（P1）」常設。

### 3.3 二層バー（凍結PMB帯＋生きた予測EACバー）
- **背面（zIndex1）＝凍結PMB帯**：`frozenSlot` 起点・薄 `ruleSoft` 地＋**1px 破線枠**（不変）。`frozenSlot===null` の葉は帯を描かない（=可視ギャップ、§3.2状態C と整合）。
- **前面＝生きた予測EACバー**：`predictedCompletion` 区間・**実線枠**（human=brand / agent=#6c7a59）、完了葉のみ `frozenBudget` 分塗り。
- **乖離葉のみ** 2帯間ギャップを橙/緑コネクタで結び stale 可視化。stale Pill は self-state なし（dismiss 不可・条件偽化で自動消滅）、当面「stale（原因未分類）」（赤線#7）。
- 行バー色は `spiTone`（SPI生値）由来を**撤去**し、`葉の lifecycle ＋ predicted vs frozenSlot 乖離`由来に再定義（母 view で SPI 生表示は R-S6 違反）。

### 3.4 三キュー・未割当・de-rate
- **actorフィルタ＝kind 三キュー**（全員/人間/エージェント）。`agentWorkQueue`/`humanReviewQueue` 射影。「自分」タブはグレーアウト予約（赤線#2）。
- **未割当**（`unassignedBacklog`）は時間軸に載せず**最上部の別レーン（時間軸を持たない「未スケジュール」バンド）**で常時可視（P0/R-U9）。
- Gantt 上部 SPI 表示は必ず `scheduleCoverage` 帯を隣接、低カバレッジ区間は淡色 de-rate＋注記。値は derive の射影そのまま。

### 3.5 行クリック→Inspector / 全画面（読取・遷移2ゾーン）
- **Inspector（440px、`variation-a:1179` レイアウト流用）**。
  - **読取ゾーン**：lifecycle/estimateState/latestEstimate/frozenBudget/frozenSlot/predictedCompletion/ownCost/単一assignee/node SPI sparkline。**未合意ノードは「EV_abs 寄与0・PV不算入」を可視ギャップ Pill で明示**。
  - **行為ゾーン**（**スライダー全廃**／`variation-a:1237` type=range・1333 の 600_000 係数・1332 の bac×progress を**全撤去**）：`[→ready][→implementing][→implemented][→accepted]`＝TransitionEvent draft、`[再見積]`＝latestEstimate proposed 追記、`[担当付替]`＝単一 assignee 置換 transition、`[合意]`＝estimate-agreement transition（**human actor のみ活性** R-U4）。各押下は `onIntentDraft` 経由で**即時書込でなく確認後追記**。
  - **ライブ計算欄**：フロント係数でなく `derive(events+pending, asOf)` の**プレビュー射影**（差分「この遷移で evAbs が +frozenBudget」）。インクリメンタル fold が無く全再生ゆえ**明示/確認時のみ計算**。
- **全画面**：createPortal + Esc + `overflow:hidden` + evmSlideUp。全画面時のみ情報列を表示。
- **基準日**：`asOf` を実計算に接続（表示用モックでなく derive の asOf）。青破線縦線＋brandSoft ラベル。

---

## 4. SPI/CPI 推移 ＆ Fever 詳細仕様

### 4.1 SpiCpiTrendChart（`shared.jsx:232-336` 踏襲）
- **データ契約**：`{asOf, spi:number|null, cpi:number|null, scheduleCoverage, estimateCoverage, evPercent, evAbs, pv, ac}[]`。供給＝backend を asOf ごとに N 回 derive した `DerivedState` の射影。
- **ブロッカー縮退（赤線#3）**：valid-time c lookup 未実装ゆえ現 c で N 回呼ぶと過去点が誤再導出＝二truth。よって **trend は「単一 asOf 1点・履歴は valid-time c 実装後」に縮退**（円1点＋注記）。実装後に折れ線へ昇格。
- **折れ線**：`M/L で実点直線連結のみ`、**spline 補間禁止**（捏造防止）。各実点 circle 必須。点間直線は「実点の連結であり間の値の主張でない」と凡例明示。
- **de-rate（連続符号化に一本化）**：`strokeDasharray` 二値段階化は暗黙閾値ゆえ撤去。**opacity と直下カバレッジ帯高を scheduleCoverage の連続関数（∝ (1-coverage)）に一本化**。閾値を置かない。
- **null 処理**：`spi===null` は線分を切る・円のみ ink3 中空＋「PV=0 ゆえ算出不能」tooltip。
- tooltip に SPI/CPI＋「schedCov NN% / estCov NN%」併記必須。Y=0.7..1.15 固定、1.0 のみ ink3 破線（許容される唯一の固定線）。点クリックで asOf の forecast/backlog へ deep-link（dismiss/seen なし）。EV%（0-1, estimateCoverage 対）は別軸／別チャート。

### 4.2 FeverProvisionalChart（`shared.jsx:338-451`）— CCPM 未確定を正直に
- **データ契約（確定型と分離・赤線#4）**：`{asOf, criticalChainCompletion, bufferConsumption, zone, trail[], provisional:true}`＝**確定 `DerivedState` とは別型**。backend に確定導出は無く**専用 provisional ソースのみ**から供給。`isBuffer` 由来表現は全廃。
- **正直な出し方**：①枠に **Pill `na`「CCPM 暫定 — MODEL v14 未確定」常設**。②確定チャートと**別ゾーン・`paperWarm` 隔離カード**・彩度抑制。③ゾーン polygon・トレイル・現在ドット+ハローの絵は採用。④**予約率/閾値スライダー等の裁量入力を一切置かない**（A6、ゾーン境界は固定図示のみ）。⑤**データ未供給時は空状態「CCPM 導出は正典未確定のため未供給」を正直表示**（ダミートレイル禁止）。⑥tooltip に「暫定・確定保証外」注記。⑦正典化時に確定型へ昇格できる差し込み口のみ用意。

---

## 5. capacity·calendar 入力 UX 詳細

3ゾーン：**人×暦ヒートマップ（中央・読取射影）＋右440px 改定パネル（唯一の write 入口）＋下部 R-U14 追記タイムライン**。warm paper、Gantt と同一 `startDate/dayW`・月ヘッダで schedule-time と左右整列。

### 5.1 CapacityGrid（中央）
- 行＝メンバー（Avatar+名前+role ラベルのみ＝**スキル属性なし** A4）、列＝日付。セル背景塗りを c で段階表現。
- **reason 別色＋形（二重符号化）**：contract=brand 実塗り濃度=brand×capacity / holiday・leave=warn 赤系 / temporary-reduction=点線ハッチ。
- **未指定1.0（淡 brand 5%・点線枠）vs 明示入力1.0（実塗り）を区別**。`capacityOf` は両者 1.0 を返すため、**`all()` から (human,date) の entry 存在を判定する射影**が必要（read 層に「entry 存在」を返させる）。凡例「淡色=未指定(1.0仮定)/実色=明示入力」。
- 未来側の未指定区間に**開示バー**「この先 c 未指定＝1.0 仮定。祝日/休暇の入れ忘れは楽観スケジュールに」（self-state なし・閉じるボタンなし・c 明示で自動縮小、MODEL 開示#5）。
- 矩形ドラッグ選択→一括起票。

### 5.2 CapacityEditor（右パネル・唯一の write）
上から：(a) 対象「田中×6/16–6/20（5セル）」。(b) **α_i SummaryStat（読取専用・grayed・注記「c の contract 成分の導出値。変更は下の c 改定で」）**＝直接編集欄を作らない（A4）。(c) 値 `type=range step0.1 min0 max1.0`＋number clamp（**1.0超不可・0許容**）。(d) 理由セグメント `contract|holiday|leave|temporary-reduction`。(e) 理由メモ textarea **必須**（種別で既定文プレフィル）。(f) 範囲プリセット chip。(g) **影響プレビュー（what-if）**。保存ボタン文言は**「追記する」**（上書きでなく履歴伸長）。

### 5.3 mental model（追記専用整合）
- **「セル＝最新値の射影、編集＝右パネルでの改定起票」**。セルクリックは直接編集せず右パネルを開く。保存＝`CapacityStore.append`（理由・メモ・ts 付）。上書き概念は存在しない（latest-ts wins）。

### 5.4 影響プレビュー（what-if・二truth回避）
- **ドラフト c を backend の `derive()/level()` に what-if 投入した結果の射影に限定**（フロント近似禁止）。編集中の未保存 c を `capacityOf:draftLookup` として `derive(events,{asOf,capacityOf:draftLookup})` を呼び、返却 ForecastRow 乖離・再レベリング差分・stale 化数を描く。保存は同じドラフトを append＝**プレビューと確定が同一導出関数を通る**。
- **性能**（leveler `MAX_DAYS=3650`・capacity 線形走査・全再生 fold）：what-if は**「明示更新ボタン or 保存直前のみ」**。ドラッグ中の連続発火禁止。プレビュー中は**「未確定ドラフト射影」ラベル帯同**（確定値との取り違え＝一時的二truth 防止）。

### 5.5 contract↔暦の区別・再導出導線
- reason=contract 選択時のみ右パネルが**「コミット判断モード」**に切替（確認文「これは組織コミット。decision インボックスに第5コミット判断として記録されます」）。**contract→inbox 連動は `commit-decision` 導出までブロッカー**（赤線#7、未実装の間は連動保留・inbox 行を生成しない）。暦改定は inbox 非集約・履歴のみ。
- **恒久離脱は capacity 語彙から排除**。長期 c=0 検出時にヒント「恒久離脱は schedule-time で割当解除を」＋deep-link。c=0 は一時不在のみ。
- 下部 **HistoryTimeline（R-U14）**：選択 (human,date) の `CapacityEntry` を ts 降順、mono 表示、Accordion ジャンプ。**dismiss/編集/削除ボタンなし**（追記専用）。

---

## 6. backend 依存（現 S4 で未供給＝stage-1 はスタブ／縮退）

| 機能 | 必要な backend 拡張 | 正典影響 | stage-1 の扱い |
|---|---|---|---|
| SPI/CPI trend 折れ線・前日比 | valid-time c lookup（capacity の as-of 引き）＋ snapshot | なし | 単一 asOf 1点・「履歴は実装後」注記 |
| R-S7 原因別 stale | `ForecastRow.staleCause` | なし | 「stale（原因未分類）」 |
| 「自分」キュー | derive の視点 actor パラメータ化 | なし | グレーアウト予約 |
| contract改定→inbox 第5判断 | `commit-decision` 導出 | なし | 連動保留（履歴のみ） |
| スケジュール・バッファ残量/消費率 | 期日・目標日の構成入力＋ D_pred からの導出（R-T6） | **MODEL v15/R-T6 で正典化済**（isBuffer/CCPM生成/工数軸は不採用） | provisional 空状態（backend 導出までは別型ソースのみ） |

---

## 7. 実アプリ アーキテクチャ（`moira/frontend/`）

- **スタック**：Vite + React 19 + TypeScript。`@xyflow/react`、`react-markdown`+`remark-gfm`+`rehype-slug`+`highlight.js`+`mermaid`。Gantt/SpiCpiTrend/Fever は `mockup/shared.jsx` 移植の手書き SVG。warm-light `EVM` トークン。
- **単一真実源（構造的保証）**：**backend の `derive()`（＋ `fold`/`leveler`/`capacity-store`/`dates`/`derivations/*`/`types`）を frontend に直 import** し in-browser 実行。`derive()` の import グラフが触れる Node builtin は `node:fs`（`capacity-store.ts`）のみ＝Vite で shim 化。`read/http.ts`・`event-store.ts`（`process`/`fs`）は import しない。`types.ts` は自己完結（import 0）なので型は type-only import で取得。
- **データ**：アプリが in-memory のイベントログ（`Event[]`）＋ `CapacityEntry[]` を保持。イベント draft 追記→`derive()` 再実行で**ライブ再導出（R-S2 実演）**。localStorage 永続＋JSON import/export。`derive` は親で1回だけ呼び Context/props で全サーフェスへ配る（各画面で別 derive を呼ばない）。
- **デモデータ**：画面充実用 rich デモイベントログは**データのみ**（導出/機能の追加ではない）。検証パリティ用に golden `tiny-project`（asOf=2026-01-28：EV_abs20/EV%0.769/coverage0.833/PV20/AC25/SPI1.00/CPI0.80）も同梱。

---

## 8. 忠実性チェックリスト（`moira-ui-fidelity-reviewer` 判定基準）

### 禁止コードパターン（grep で 0 件であること）
- `progress / 100`・`* (progress` 等の**進捗%線形中点**（稲妻線/バー位置に使用）→ P1 違反。
- `type="range"` / `<input type=range`（**容量以外の見積/進捗スライダー**）→ A2/A6 違反（capacity c の 0–1.0 range のみ例外）。
- `600_000` / `600000`（evm-studio の MD→円 係数）→ A6 違反。
- `bac * progress` / `* progress` による **EV 近似計算** → P1 違反。
- 各サーフェス内での **`derive(` 直接呼び**（親1回以外）→ R-S2 二truth。
- `dismiss` / `seen` / `acknowledged` / `snooze` を持つ inbox/warning 状態 → §2.1 self-state 禁止。
- `frozenSlot ?? asOf` / `frozenSlot || 0` 等の **null 潰し** → 赤線#1 違反。
- スキル/レベル/難易度（`skill`/`level`/`difficulty`）を assignment に使う UI → A4 違反。
- `spi` を「全体進捗」と表示・`scheduleCoverage` 非対表示 → R-S6 違反。

### 必須実装
- EV% に estimateCoverage、SPI に scheduleCoverage が**常に対表示**。
- 稲妻線/バーが**三状態**（完了∧slot有 / 未完 / 完了∧slot=null）を区別。
- inbox に**件数サマリ（全N/据え置きM）**があり dismiss ボタンが無い。
- capacity 編集が**追記**（append）で、α_i が読取専用。
- 三画面が**同一 derive 出力**を参照（同一 asOf でメトリクスがビット一致）。
