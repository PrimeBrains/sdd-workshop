# Brief — moira-surface-schedule

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）→ `.kiro/steering/roadmap.md` 確定版。本 brief は roadmap の `moira-surface-schedule` 行を一次ソースに、`moira/MODEL.md`(v16, 凍結) ＋ `moira/UI-ARCHITECTURE.md`(§3 母 view・§4.1/§4.2・§5・§6) 準拠で just-in-time 作成。
> 位置づけ: CQRS 分解の **Wave3 read サーフェス**。`schedule-time`（スケジュール・時間）= R-S2 が予約する三ダッシュボードの一つで、**全 actor 共通の母 view**（UI-ARCH §3）。read-only（自前状態なし・derive() を読むだけ；UI-ARCH §6）。

## Problem
Moira の正典モデル `moira/MODEL.md`(v16) は「スケジュール・割当・期日・未割当ギャップ」を導出として確定し、UI-ARCHITECTURE は `schedule-time` を全 actor 共通の母 view として予約しているが、その **read サーフェスが spec として凍結されていない**。具体的には、(1) 生きた予測スケジュール（P7、各サブ単位の予測完了）と凍結ベースライン slot の両表示、(2) 担当（単一被割当者 R-T5）の常時表示、(3) 未割当バックログ（P0 可視ギャップ）の Gantt 内赤表示、(4) スロット陳腐化（R-S7）の原因別提示、(5) 人別の c 充当健全性、(6) 三キュー（P4）の actor フィルタ——これらを「どの導出を・どう区別表示するか」という提示の下限（UI-ARCH §2 ②層）として spec 化する必要がある。

## Current State
- 参照実装（フォワード本番プロト）が `moira/frontend/src/surfaces/schedule/*` に存在する: `ScheduleTimeSurface.tsx`（母 view・actor kind フィルタ・SPI×scheduleCoverage de-rate・未割当バックログ lane・Gantt host）、`ScheduleGantt.tsx`（凍結 PMB 帯＋生きた EAC バーの二本立て・R-S7 乖離色分け・状態A/B/C のマーカー）、`Inspector.tsx`（タスク別 read ＋付替プルダウンの draft→確認→追記）、`gantt-geometry.ts`（表示専用幾何・effective-tree depth・slotState 分類）。
- これらは `derived.forecast`（frozenSlot/predictedCompletion）・`derived.scheduleCoverage`・`derived.unassignedBacklog`・`projected.nodes/childrenOf/supersedeEdges` を **読むだけ**で、指標を再計算しない（UI-ARCH §6 規律を実証）。
- ただしこれは「縦スライスの実証」であり、**要件トレース（R-* → サーフェス）・DAG ビューア・R-S7 原因別の正式凍結は未確定**。UI フレームワークの選定は本 surface spec の design で決める（roadmap: TBD の所在）。

## Desired Outcome
`moira-surface-schedule` は、`moira-schedule`（導出）と `moira-core`（emit/derive 契約）の導出を **読み出すだけ**の read-only サーフェスとして、次を提示の下限として凍結する:
1. **Gantt + DAG ビューア** — 木×DAG 射影、生きた予測スケジュール（P7、各サブ単位の予測完了）と凍結ベースライン slot（PV/PMB）の両表示。
2. **担当の常時表示** — 単一被割当者（R-T5）を行に常時表示（スキル/レベルは出さない＝A4）。
3. **未割当バックログ** — Gantt 内で赤（P0 可視ギャップ）として、時間軸を持たない lane に表示。
4. **付替プルダウン** — 担当付替の deep-link（write は write skill が所有；surface は導線のみ）。
5. **R-S7 スロット陳腐化** — 原因別（割当変更 / c 変更）の可視ギャップ提示。
6. **未割当フィルタ** — 未割当ノードの絞り込み。
7. **人別日次充当健全性** — 人ごとの c(i,d) 充当（過負荷 R-T3 の可視化は read）。
8. **actor フィルタ（母 view）** — 三キュー（作業/レビュー/エージェント）= P4 の同一クエリ actor フィルタ違い。

## Approach
- MODEL を SSOT、UI-ARCHITECTURE を派生設計の接地点として、参照実装 `surfaces/schedule/*` の seam に design を整合させる。
- **read-only 厳守**（UI-ARCH §6）: 自前状態・キャッシュ・dismiss フラグを持たず、`moira-schedule`/`moira-core` の derive() を読むだけ。指標の二系統計算を禁ずる。
- **検出=読 / 解消=書 の分離**（roadmap）: R-S7 陳腐化・R-S6 de-rate・R-T3 過負荷・未割当ギャップは **検出（読）のみ**を所有し、再ベースライン・再割当・c 改定の **解消（書）は write skill**（reschedule/assign-schedule/capacity）へ deep-link する。
- **de-rate 型と判断型の区別**（UI-ARCH §4.2/§3）: R-S6（SPI de-rate）は常時メトリクス修飾として表出し inbox 行為項目にしない。R-S7・R-T3 は inbox 集約対象だが、本 surface は文脈ビュー（schedule-time）として host し write へ deep-link する。

## Scope
### In
- `schedule-time` 母 view の read 提示（全 actor 共通・actor kind フィルタ）。
- Gantt（木×DAG 射影）＋ DAG ビューア（再利用部品）。生きた予測（P7・各サブ単位の予測完了）と凍結 slot の両表示。
- 各ノード状態（Gantt 上の副 host；主 host は spec-value）。
- 担当の常時表示（単一被割当者 R-T5・人間/エージェントの視覚区別）。
- 未割当バックログの Gantt 内赤表示（P0/R-U9）＋未割当フィルタ。
- 担当付替プルダウン（deep-link；write は assign-schedule/reschedule）。
- R-S7 スロット陳腐化の原因別（割当変更 / c 変更）可視ギャップ提示。
- SPI を scheduleCoverage と対で読み低カバレッジ時 de-rate 表示（R-S6；read 修飾）。
- 人別の日次 c 充当健全性（過負荷 R-T3 の可視化＝read；c=0 日の AC 含む）。
- 三キュー（作業/レビュー/エージェント）= 同一クエリの actor フィルタ違い（P4・副 host=inbox）。
- 生きた予測スケジュール（各サブ単位の予測完了）の表示（schedule-time 主 host）。

### Out
- スケジュール導出ロジック本体（leveler P7/P8・予測 forecast・slot 充填・schedule被覆・D_pred・buffer R-T6 導出）→ `moira-schedule`（surface は読むだけ）。
- 凍結ベースラインの **記録機構**（予算=合意時 R-U7・スロット=初回スケジュール時・I4 施錠）→ `moira-core`。
- emit/derive 契約・effective-set・latest-wins・二層データ → `moira-core`。
- 担当の **書き込み**（割当 transition・暫定割当・付替の追記）→ `moira-assign-schedule` / `moira-reschedule`（人間承認内包）。
- c 改定の **書き込み**（per-date c・理由付き）→ `moira-capacity` / `capacity·calendar config` 面。
- 再ベースライン・スコープ/期日判断の **書き込み** → `moira-rebaseline` / `moira-reschedule` / `moira-project-config`。
- 9 warning の **確定・集約・clearance**・行為列挙の単一定義 → `moira-health`（surface は read 表示と deep-link のみ）。
- バッファ残量/消費率（R-T6）・SPI/CPI トレンド・CCPM フィーバー → `moira-surface-health`（health host）。
- EV%・見積カバレッジ・実行カバレッジ・現行有効集合の EV% → `moira-surface-spec-value`（spec-value host）。
- decision インボックス（横断・行為集約・ルーティング）→ 別面（UI-ARCH §3 層B）。

## Boundary Candidates（本 surface が所有を主張する seam）
- `moira/frontend/src/surfaces/schedule/ScheduleTimeSurface.tsx` — 母 view・actor kind フィルタ・未割当 lane・SPI de-rate strip・Gantt/Inspector host。
- `moira/frontend/src/surfaces/schedule/ScheduleGantt.tsx` — Gantt（凍結 PMB 帯＋生きた EAC バー・R-S7 乖離色・状態A/B/C マーカー）。
- `moira/frontend/src/surfaces/schedule/Inspector.tsx` — タスク別 read（PV/EV/AC・基準/予測完了日）＋担当付替プルダウン（draft→確認→deep-link）。
- `moira/frontend/src/surfaces/schedule/gantt-geometry.ts` — 表示専用幾何・effective-tree depth・slotState 分類（再利用部品）。
- DAG ビューア（再利用部品；spec-value のトレーサビリティ DAG と共有；参照実装に未確立＝design で確定）。

## Out of Boundary（本 surface が触らない）
- `moira/backend/src/derivations/{leveler,forecast,queues}.ts` — 平準化/予測/キュー導出 → schedule。
- 凍結属性の記録・fold・effective-set 導出 → core。
- warning 検出述語・集約・clearance → health/各 derivation。
- 共有 UI モジュール（atoms.tsx/tokens.ts）の所有 → 共有（surface は参照のみ；UI-ARCH §6）。

## Upstream
- **`moira-schedule`**（roadmap: Dependencies: moira-schedule）— leveler(P7/P8)・予測・baseline slot・未割当 backlog・schedule被覆・D_pred・buffer(R-T6)・queues(P4)・R-S6/S7・R-T1–T4(検出) の **導出**を所有。本 surface はその derive() 出力（forecast/scheduleCoverage/unassignedBacklog/queues 等）を読む。
- 推移的に `moira-core`（emit/derive 契約・二層データ・effective-set・latest-wins）。
- 一次資料: `moira/MODEL.md`(v16, 凍結・SSOT)、`moira/UI-ARCHITECTURE.md`（§3 母 view・§4.1/§4.2・§5・§6）。

## Downstream
- **none**（surface は read の末端。下流 spec/skill は本 surface に依存しない）。
- decision インボックス（UI-ARCH §3 層B）が本 surface の文脈ビューへ deep-link するが、それは UI 層の導線であって spec 依存ではない。

## Existing Spec Touchpoints
- `moira-core` / `moira-schedule`（生成済 or 同 Wave 計画）の derive 契約・導出出力を消費する（再定義しない）。
- 他 surface spec（spec-value/health/decision）と **DAG ビューアを再利用部品として共有**（roadmap: 再利用部品）。三者対読みの host 分担は UI-ARCH §4.1 に従う（schedule-time は予測スケジュール・未割当・担当・状態 副 host を持つ）。
- 参照実装（`surfaces/schedule/*`）は spec ではなくフォワード本番プロト。design はこの seam に整合させ、提示は MODEL/UI-ARCH 準拠とする。

## Constraints
- `moira/MODEL.md` v16 を **SSOT として凍結遵守**。MODEL の文言を変えない・新概念を足さない。surface は提示の下限（UI-ARCH §2 ②層）を写すのみ。
- **read-only 厳守**（UI-ARCH §6）: 自前状態・隠れキャッシュ・dismiss フラグなし。derive() を読むだけで再計算しない（二系統計算禁止）。
- **役割は分割軸でない**（UI-ARCH §2）: 管理者/開発者で物理分割せず、同一導出への actor フィルタ／初期プリセットに降格。schedule-time は全 actor 共通の母 view。
- **警告は acknowledge で消えない**（MODEL §2.1・UI-ARCH §2）: R-S7 据え置き受容は陳腐化標識を消さない。提示は顕著さ抑制（畳む・淡色化）可だが、可視ギャップの会計から警告を除いてはならない（P0・falsifiable な線）。
- **検出=読 / 解消=書 の分離**（roadmap）: R-S7/R-S6/R-T3/未割当ギャップは検出（読）のみ。解消は write skill へ deep-link。
- **担当はスキル/レベルを出さない**（A4/R-U6）: 単一被割当者の名指しのみ表示（R-T5）。
- **SPI は scheduleCoverage と対読み・低カバレッジで de-rate**（R-S6）。全体進捗として見せない。
- EARS は ja・`requirements-style.md` 準拠（英文＋和訳併記）。トレースは `trace-notation.md`、命名は `moira-naming.md`、配置は `structure.md`。
- **0d 依存（Phase 0 決着済）**: 用語確定（実行カバレッジ R-S8・コミット行為＝UI 語）。本 surface のラベルは NAMING §7 正式語に従う（DAG ビューアの遷移表示＝構造依存）。
