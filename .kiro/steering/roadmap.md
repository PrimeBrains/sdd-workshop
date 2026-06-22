# Roadmap — Moira 正典化（MODEL v16 → 読 spec ×10 ／ 書 skill ×14 ／ Phase 0）

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）＋ `doc-refine` 独立敵対ゲート確定版。
> 一次資料: `moira/MODEL.md`(v16)・`moira/UI-ARCHITECTURE.md`・`moira/validation-scenarios.md`・`moira/backend/src`・`.kiro/steering`・`.claude/skills`/`agents`（ユーザー確定済）。

## Overview
凍結された正典モデル `moira/MODEL.md`(v16) を、本番アーキテクチャへ落とすための SDD 分解ロードマップ。
プロジェクトは「追記専用 4 イベント（transition / decompose / relate / cost）＋構成入力（capacity c・期日/目標日）
の上に、すべての観測（進捗・スケジュール・健全性）を導出する」モデル。これを **CQRS** で実装する:
**読み（観測・導出の常駐ダッシュボード）= app サーフェス**、**書き（イベント発行・オーケストレーション・バッチ・射影）
= Claude Code skill**。`moira/backend`(Hono/TS)・`moira/frontend`(React19/TS) は参照実装（フォワード本番）。

## Approach Decision
- **Chosen**: CQRS 分解。読/導出を 10 spec（`.kiro/specs/moira-*`）、書/オペを 14 skill（`.claude/skills/moira-*`）。
  正典モデルに触れる論点は先に `moira-model-update`（Phase 0）で決着させてから分解する。
- **Why**: (1) MODEL は「観測・導出・警告に徹し、commit を握るのは人間」(§2.1) を中核とし、読(導出)と書(commit を伴う
  イベント発行) の責務が本質的に分離している。(2) 既存 agentic SDLC（kiro-*/moira-model-update）と同型に、書き
  /オーケストレーションを skill に寄せると surface が痩せて陳腐化しにくい。(3) doc-refine 敵対ゲートで境界の orphan/
  二重/循環/冗長を是正済み。
- **Rejected alternatives**:
  - 単純 6 spec（既存サーフェスをそのまま spec 化）— UX/概念の欠陥をそのまま固定化。
  - サーフェス縦割り 5 spec — 導出ロジックが各サーフェスへ重複。
  - 全機能を app 内実装 — 一括 capacity 作成・リスケ整合・日次差分など書き/バッチが surface を肥大化。
  - `surface-foundation` を独立 spec — 共通関心は既存共有モジュール(atoms/tokens/gantt-geometry)＋UI-ARCH §6 規律で充足、
    DAG ビューア/アコーディオンは未実装で spec 凍結不能（敵対ゲートで廃止）。
  - `supersede-enhance`/`decision-guide` を独立 skill — 前者は decompose-author+relate-edit の合成で不変条件は core/fold が担保、
    後者は「行為列挙は導出層に一本化」(UI-ARCH §6) ゆえ surface-decision が読むだけ（敵対ゲートで廃止）。

## Scope
- **In**: MODEL v16 の 4 イベント・全導出（v16 R-S2 実列挙 ≈13）・9 warning・5 サーフェス相当の読み機能・書き/オペ skill 群の
  本番実装、永続化(core で決定)、デプロイ方針(ADR)。Phase 0 によるモデル/命名/正典の決着。
- **Out**: 工数軸/BAC スケーリング(§7#11)・acknowledge 状態(§5 で意図的に持たない)・人間能力モデリング(A4/R-U6)・
  金額(A6)・MODEL の数式（EV%=EV_abs/Σagreed 等）の再オープン（Phase 0 は周辺の文言/分類/命名/正典更新に限る）。

## Constraints
- `moira/MODEL.md` v16 を **SSOT として凍結遵守**。モデル変更は `moira-model-update` ゲート経由のみ。
- アーキ不変条件: **データは二層のみ**＝①追記専用 4 イベントログ、②構成入力（capacity c＝人間資源属性／期日・目標日＝
  プロジェクト属性、§5）。「config 書込」は②であり第三層ではない。derivation は再計算しない（emit→derive）。
- **commit を握るのは人間**（§2.1×5: 見積合意/割当/スコープ・期日・目標日/見積深さ/c 宣言。R-U4 は人間限定）。
  これらに触れる write skill は人間承認ステップを内包する。
- EARS は ja・`requirements-style.md` 準拠。アーキ決定は ADR（`adr.md`）に記録。命名は `moira-naming.md` 準拠。
- TBD の所在: 永続化→`moira-core` 設計、UI フレームワーク→各 surface spec 設計、デプロイ→ADR（横断）。

## Boundary Strategy
- **なぜこの分割か**: 既存コードのモジュール seam（backend `derivations/`・frontend `surfaces/`）と MODEL の概念 seam
  （4 イベント・導出・警告・サーフェス）が一致する箇所で切った。読=導出 spec、書=イベント発行 skill に分け、
  両者の共通契約を `moira-core` の emit/derive API に集約。
- **Shared seams to watch（共有シーム）**:
  - **emit/derive API（moira-core）**: 全 skill(write) と全 surface(read) が依存する契約。最初に凍結。プロト実装は
    [store.tsx](../../moira/frontend/src/moira/store.tsx)(appendEvent/appendCapacity/derive)・[types.ts](../../moira/backend/src/types.ts)・[derive.ts](../../moira/backend/src/derive.ts)。
  - **行為列挙の単一定義**: `moira-health`（導出層）に一度だけ定義し、`surface-decision`・`evm-digest` が読む（UI-ARCH §6）。
  - **schedule coverage**: 導出は `moira-schedule`、SPI の de-rate 消費は `moira-evm`(R-S6)。
  - **sunk EV / cancel**: cancelled の active basis 除外は `moira-core` の effective-set 機構が担い（**構造境界 core**）、sunk 金額導出は `moira-evm`、R-C3 孤児検出は `moira-scope-deps`(読)、cancel emit は `moira-cancel-scope`。
  - **warning 述語**: 検出データは各 derivation（schedule の overload/deadline、scope-deps の orphan）、警告確定/集約は `moira-health`。
  - **effective-set**: 機構（supersede/cancelled 除外を含む現行有効集合の導出）は `moira-core` が所有、`moira-scope-deps`/`moira-evm`/`moira-schedule`/`moira-health` は消費（**構造境界 core**）。
  - **検出=読 / 解消=書 の分離**: R-S3/R-S6 等 de-rate・検出系は読 spec のみ（書 skill で解消しない）。

## Phase 0（前提・`moira-model-update` ゲート。分解より先に決着）
| # | 論点 | 決めること | ブロックされる下流 |
|---|---|---|---|
| 0a | 非spec/未仕様タスク vs A1 | A1 に非specノードを明示 or 分類 | core(ノード分類/型)・scope-deps・decompose-author・cost-log(ops)・ingestion-adapter |
| 0b | チケット射影機構 | node→ticket 写像・往復同一性・外部出力範囲（kiro-issue feature キーとの対応） | ticket-project・surface の ticket ビュー |
| 0c | spec 単位の汎用化(cc-sdd 非依存) | 「spec phase 成果物」を抽象 spec-unit へ | ingestion-adapter・spec-ingest |
| 0d | 用語/NAMING | 行為(遷移/手戻りの正式語)／実行中(仕掛)=execution coverage(R-S8)／累積稼得=cumulative EV(R-S5) | 全 surface spec（ラベル＋DAG ビューアの遷移表示＝構造依存） |
| 0e | 正典の陳腐化解消 | UI-ARCHITECTURE v14→v16（R-S8/R-T6 を導出・被覆表へ）／validation-scenarios v10→v16（R-S8/R-T6 追加・S1 に R-D1・S8 に R-T5）／NAMING に executionCoverage 追記 | 被覆検証の母数・S1–S13 の正確性 |
（0a–0c=MODEL クラス、0d=NAMING クラス、0e=確定ナレッジ更新。）

## アーキテクチャ（CQRS・不変条件）
- app サーフェス = 常駐 read-only ダッシュボード（derive() を読むだけ・自前状態なし＝UI-ARCH §6）。
- skill = (1) 全 write（4 イベント＋capacity＋config の二層）＋ (2) エージェント起動のオーケストレーション/バッチ/射影
  （後者は read-only でも skill：ticket-project / evm-digest）。
- 共通 UI は既存共有コードモジュール（atoms.tsx/tokens.ts/gantt-geometry.ts）＋ UI-ARCH §6 規律を各 surface spec が参照。

## 書き/オペ skill（14 本・`.claude/skills/moira-*`・build order）
> これらは cc-sdd spec ではなく Claude Code skill（`origin: "custom"`）。`/kiro-spec-batch` の対象外。下記 build order で authoring。

| # | skill | emit/種別 | 主担当 R-* | 依存・注 |
|---|---|---|---|---|
| 1 | moira-spec-ingest | decompose/transition | R-E1/E1b/E2,§2.6 | core,ingestion-adapter ｜kiro-spec-* の出力を入力に取る(← パイプライン) ｜0a,0c |
| 2 | moira-estimate-agree | transition(合意)/decompose(再見積) | R-U4/U7,R-E3/E4,R-U12解消,R-U13 | core ｜人間承認内包 |
| 3 | moira-decompose-author | decompose | §2.6,R-E2b,I1 | core,scope-deps ｜enhancement の新ノードもここ ｜0a |
| 4 | moira-progress | transition(状態遷移) | ライフサイクル ready/implementing/implemented/accepted,R-D6,P5 解消(再到達) | core |
| 5 | moira-assign-schedule | transition(担当/slot 凍結) | R-T1/T5/T2,P7/P8,§3 | core,schedule,capacity ｜人間承認内包 |
| 6 | moira-capacity | capacity-write(bulk+fine) | A4,R-U14,R-U11 | core ｜人間承認(c 宣言) |
| 7 | moira-project-config | config-write | deadline/target(R-T6,§2.1#3) | core,schedule ｜人間承認 |
| 8 | moira-reschedule | orchestration(承認付き修正write) | R-S2/S6/S7,R-T3/T4/T6 | core,schedule,health,evm,capacity,project-config,assign-schedule,rebaseline |
| 9 | moira-rebaseline | transition/decompose(凍結属性改訂) | §3,R-U7,I4,R-S7,S13 | core,evm,schedule ｜人間承認 |
| 10 | moira-relate-edit | relate(依存/supersede) | R-D1/D2/D3/D4,R-D7(supersede辺),I2 | core,scope-deps |
| 11 | moira-cancel-scope | transition(cancelled)+orphan評価 | R-C1/C2/C3,§2.7 | core,scope-deps,relate-edit,reschedule ｜人間承認 |
| 12 | moira-cost-log | cost | A6/R-U10,P3/P6 | core,evm ｜R-S3 は検出側(evm/health)、cost-log は AC 入力を足すのみ |
| 13 | moira-ticket-project | オペ(read 射影→外部) | A1,R-U1,P4 | core ｜外部出力は kiro-issue/sdd-issue-creator へ委譲(写像は0b) ｜0b |
| 14 | moira-evm-digest | オペ(as-of 導出差分) | R-S2 as-of,I3,P5 | core,evm,health ｜cron/ETL でなく日境界 as-of 導出の差分(TE03)。行為列挙は導出層を読む |

build order: core後 `cost-log,progress` → evm/scope後 `estimate-agree,decompose-author[0a],relate-edit` →
scope後 `cancel-scope` → adapter後 `spec-ingest[0a,0c]` → schedule後 `assign-schedule,capacity,project-config,rebaseline` →
health後 `reschedule` → 全導出後 `evm-digest,ticket-project[0b]`。

## Specs (dependency order)
> 読/導出側のみ（`/kiro-spec-batch` がパース）。Wave=依存順。Phase 0 ブロック印 [0x] 付き spec は Phase 0 決着後に着手。
> **brief.md は Phase 0 後に just-in-time で作成**（core/scope-deps=0a, surface=0d, ingestion-adapter=0c, derivation 系=Wave1 API 依存ゆえ前倒しは陳腐化）。

- [ ] moira-core -- event store+fold+derive+ノード/合意 状態機械(ready 含む lifecycle)+effective-set 機構(supersede/cancelled 除外)+latest-wins(I3)+辺の型/policy 構造保持(R-D2 既定値の記録)+循環拒否(I2/R-D3)+cancelled 受理/fold(R-C1 構造面)+R-S2 オーケストレータ・シーム契約(値は下流供給)+emit/derive API+二層データ。**構造境界 core（構造/不変条件/機構のみ所有・評価/値/式は下流）**。A1–A3,I1–I6,4イベント,R-U1/U2/U3/U6/U7,R-S5(累積/現行 basis 機構),R-D3/D5/D6,R-D7(旧ノード append-only 不変・I2; 一般の後退遷移は記録し P5/health が警告),P0。R-D1/D2/D4 の述語評価・閾値適用は scope-deps。Dependencies: none [0a]
- [ ] moira-evm -- EV_abs/EV%/cumulative/見積被覆/exec被覆(R-S8)/PV/AC/SPI/CPI/sunk(R-C2)/R-U9 可視ギャップ会計。P0–P2,R-U8/U9/U10,R-S1/S3(検出)/S4/S8。Dependencies: moira-core
- [ ] moira-schedule -- leveler(P7/P8)/予測/baseline slot/未割当backlog/schedule被覆/D_pred/buffer(R-T6)/queues(P4)/R-S6/S7/R-T1–T4(検出)。R-U11。Dependencies: moira-core [0a 軽]
- [ ] moira-scope-deps -- tree+DAG/依存・supersede辺読み/effective-set 消費(core 所有)/ready-eligible 導出(R-D1/D2/D4 述語評価; ready 状態自体は progress が emit)/辺述語の母集合=全葉(cancelled 含む→永久充足不能は R-C3 へ)/orphan(R-C3読)/restoration(R-S5読)。R-D7(辺の読み),R-C1(読),§2.7。Dependencies: moira-core [0a]
- [ ] moira-ingestion-adapter -- spec-unit→ノード候補+見積提案の read-only 正規化。0c が単一ソース確定なら spec-ingest skill へ吸収（条件付き存続）。Dependencies: moira-core [0a,0c]
- [ ] moira-health -- 9 warning(R-U12/U13/T3/T4/S3/S6/S7/C3 + P5 at-risk)検出+行為列挙の単一定義(導出層)+clearance(§2.1)。R-S6 は de-rate 型＝inbox 非集約(8集約+R-S6 常駐=9)。Dependencies: moira-evm, moira-schedule, moira-scope-deps
- [ ] moira-surface-spec-value -- ノード木(アコーディオン+進行中上位)/トレーサビリティ+DAGビューア(再利用部品)/見積被覆/EV%(R-S5)/被覆=行クリック明細/proposed停滞フィルタ/深リンク。Dependencies: moira-evm, moira-scope-deps [0d]
- [ ] moira-surface-schedule -- Gantt+DAGビューア/担当常時表示/未割当=Gantt内赤/付替プルダウン/R-S7陳腐(原因別)/未割当フィルタ/人別日次充当健全性。Dependencies: moira-schedule [0d]
- [ ] moira-surface-health -- EV_abs/EV%区別/PV/AC/SPI(R-S6 de-rate; 副host=schedule-time)/CPI/人別CPI時系列(人別SPIは MODEL §2.4 単一assignee・PV非actor帰属で非対象)/CCPMフィーバー/buffer/明快メトリクス(見積被覆+PV/EV/BAC)。Dependencies: moira-evm, moira-schedule, moira-health [0d]
- [ ] moira-surface-decision -- 薄: warning読+深リンク+詳細/次action/判断基準(導出層=health の行為列挙を読む)+新規vs常設(P0)+capacity heatmap は deep-link で capacity config 面へ(decision 面は host しない)。Dependencies: moira-health [0d]

## 要件カバレッジ（是正後・全 R-* が landing）
- 検出=読 / 解消=書 の分離。R-S3/R-S6 等 de-rate・検出系は読 spec のみ（書 skill で解消しない）。
- R-U6→core(能力非モデル化)+assign-schedule(割当=人間入力)。R-U9→evm/health(可視ギャップ)+surface(P0表示)。
  queues(P4)→schedule。P5 at-risk 解消→moira-progress(implemented 再到達)。
- 導出母数は MODEL v16 R-S2 実列挙(≈13: ノード状態/EV%/EV_abs/見積被覆/exec被覆R-S8/PV/AC/SPI/CPI/queues/予測/未割当backlog/buffer R-T6 + schedule被覆)。UI-ARCH v14 の「11」は 0e で更新。
- R-U1/U2/U3/U7→core(+estimate-agree)／R-U4/U5→estimate-agree,spec-ingest／R-U8–U10→evm(+cost-log R-U10)／R-U11→schedule,assign-schedule／R-U12/U13→health 検出+estimate-agree／R-U14→core+capacity。
- R-E1/E1b/E2→ingestion-adapter+spec-ingest／R-E2b→evm+decompose-author(§2.1#4 深さ判断は人間承認)/cost-log／R-E3/E4→evm+estimate-agree。
- R-S1/S3/S4/S8→evm(+cost-log は S3 の AC 入力)／R-S2→core(append/構成入力変更で再導出)／R-S5→scope-deps+supersede(relate-edit+decompose-author)／R-S6→schedule(導出)+evm(de-rate)／R-S7→schedule+rebaseline/reschedule。
- R-T1/T2/T5→schedule+assign-schedule／R-T3/T4→schedule 検出+reschedule／R-T6→schedule(buffer)+project-config(設定)。
- R-C1/C3→scope-deps(検出読)+cancel-scope(emit)／R-C2→**core(effective-set の active basis 除外機構)**+evm(sunk 金額)+cancel-scope(emit)／**R-D 構造(辺型/policy 保持・非増殖・循環拒否 I2)→core、R-D1/D2/D4 述語評価・閾値適用→scope-deps、emit→relate-edit**／R-D5/D6→core+全 transition writer／R-D7→core(旧ノード append-only 不変・I2)+scope-deps(辺の読み)+relate-edit/decompose-author。
- **doc-refine 確定（要件 doc-refine 敵対ゲート, 2026-06-22）**: 上記 R-D/R-C2/effective-set/ready の境界は「構造境界 core」ユーザー裁定で確定（core=構造/不変条件/機構, 下流=評価/値/式）。ready=lifecycle 状態(progress emit)＋ready-eligible 導出(scope-deps)の二語分離。R-D4 述語の母集合=全葉(cancelled 含む)。ingestion-adapter の est は MODEL §2.3 忠実に candidate ノード化。

## S1–S13 → 主 skill（0e で validation-scenarios を v16 化する際の指針）
S1→spec-ingest+estimate-agree+decompose-author+relate-edit(R-D1)／S2→spec-ingest+estimate-agree(R-U9 は evm/surface)／
S3→spec-ingest+estimate-agree+decompose-author／S4→(読 surfaces)+evm-digest／S5→assign-schedule／S6→(読 被覆: evm 見積被覆+schedule schedule被覆)／
S7→cost-log(検出は evm/health)／S8→capacity+assign-schedule(R-T5)+reschedule／S9→estimate-agree+reschedule／
S10→reschedule(+progress で P5 解消)／S11→cancel-scope／S12→decompose-author+relate-edit(supersede)／S13→rebaseline。

## マスター順序
Phase0(0a–0e ゲート) → Wave0 `moira-core`[0a]（emit/derive 契約＋R-D7 不変条件を最初に凍結）→
Wave1 `evm | schedule | scope-deps[0a] | ingestion-adapter[0a,0c]` → Wave2 `health` →
Wave3 `surface-spec-value | surface-schedule | surface-health | surface-decision`（全て[0d]）。
skill は上記 build order。`/kiro-spec-batch` は Phase 0 決着後に実行。

## 次コマンド
1. `/moira-model-update` で Phase 0 (0a–0e) を確定（canon 0e 含む。最優先）。
2. 決着後 `/kiro-spec-batch`（依存順で読 spec を生成。慎重なら `/kiro-spec-init moira-core` で先頭検証）。
   ※ batch 実行前に対象 spec の brief.md を just-in-time で作成（`/kiro-discovery` 再entry または手動）。
3. skills を `.claude/skills/moira-*/SKILL.md` として build order で authoring（`origin: "custom"`）。

---
_確定経緯: kiro-discovery(Path D) → doc-refine 敵対ゲート(adversary×3＋fact-checker NO_OBJECTION＋再反論×3 UNSOUND→修正＋gate-judge PASS)。初版 11 spec/15 skill から読 10/書 14 へ是正。_
