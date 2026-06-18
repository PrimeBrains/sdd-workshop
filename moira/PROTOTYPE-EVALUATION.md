# プロトタイプ評価 — Moira の思想を体現するシステム構築への有用性

> 評価日: 2026-06-18 / ものさし: `moira/MODEL.md`（正典 v12）
> 観点: 「**Moira の思想を体現するシステムの構築に役立つか**」の一点。
> 立場: 対象はいずれも**捨てる前提**の試作。おもねらない。使えないものは使えないと判定し、同時に**救出すべき資産**を具体パスで指す（両立させる）。
> 一次資料: Moira 原理は `moira/MODEL.md` を厳密検証の土台とし、プロトタイプ内部の主張は各ソースの**現状**を正とする（README 等の自己申告ではなく実コード/実仕様。本書は doc-refine 独立敵対ゲートを通している）。

---

## 1. 目的と前提

本命システム **Moira**（仕様駆動 × チケット駆動 × EVM 統合）は `moira/MODEL.md` を正典とし、現行は v12（A4 を人間ごとの割当率 α_i にパラメータ化した版）。本書は、その素材候補となる5本のプロトタイプ／成果物を Moira 正典に照らして評価する。

評価対象:

| # | 対象 | 所在 | 種別 |
|---|---|---|---|
| 1 | AI WBS 生成スペック群 | `generative-ai/docs/research/101-ai-wbs-generation/spec/`（SPEC.md＋WBS-* 11本＝12ファイル） | 仕様書（一部実装） |
| 2 | evmtools | `generative-ai/.claude/skills/evmtools/` | 実装済み CLI スキル |
| 3 | morning-report-full | `generative-ai/.claude/skills/morning-report-full/` | オーケストレータ スキル |
| 4 | sdd-dashboard | `sdd-workshop/sdd-dashboard/` | 仕様レビュー UI 試作 |
| 5 | evm-studio | `sdd-workshop/evm-studio/` | EVM ダッシュボード試作 |

> WBS 群の評価は共通スキーマ `WBS-COMMON.md` と全体仕様 `SPEC.md`/`WBS-ORCH.md` を主対象とし、残りのサブスペック（ELICIT/ESTIMATE/STAFFING/SCHEDULE/RESCHEDULE 等）は算法・ライフサイクルの裏付けに用いる。

---

## 2. 評価基準 — Moira の定義的コミットメント

Moira を Moira たらしめているのは EVM の生の数式ではない。背骨は以下の**アーキテクチャ的決意**である（`moira/MODEL.md`）。

| 基準 | 内容 | 出典 |
|---|---|---|
| **§2.1 メタ原理** | システムは観測・導出・警告に徹し、コミット判断（見積合意・割当・スコープ/期日・見積深さ・α_i 宣言）は人間に残す | MODEL.md L14, §2.1(L52) |
| **A1 単一実体** | 存在するのは spec とその分解ノードのみ。チケットは射影 | MODEL.md L22-23 |
| **A2 単一データ＝追記専用4イベントログ** | データは `transition`/`decompose`/`relate`/`cost` の追記専用ログのみ。**進捗・スケジュール・健全性はすべてその導出** | MODEL.md L14, L25-26, §2.8 |
| **P0/P1/P2 コミット領域のみを語る**（§2.1 の測定面） | EV%＝完了÷合意済み。未コミットは**可視ギャップ**（見積カバレッジ・未割当バックログ）として常時表示 | MODEL.md L149-162 |
| **§2.2 見積＝合意状態を持つ提案** | 状態機械 `proposed→agreed`、常に変動、合意は人間のみ | MODEL.md L69-73 |
| **§2.7 supersede** | スコープ変更は置換辺で**前進記録**（append-only、旧ノード不変、サンク可視化） | MODEL.md L114-125 |
| **A4 α_i・能力非モデル化** | 各人間の割当率 α_i ∈ (0,1.0] MD/日。ただし**システムは人間の能力（スキル・習熟度）をモデル化しない** | MODEL.md L31-37, R-U6(L221) |
| **A6 単一通貨** | 実コストは人間アテンション時間（MD）。金額は持たない | MODEL.md L42-43 |

> EVM 指標そのもの（SPI=EV/PV, CPI=EV/AC, EAC…）は式形こそ教科書 EVM だが、Moira の SPI は**分母 PV がスケジュール済み領域のみ**を覆い、低カバレッジ時に de-rate される（§3 L193, **R-S6** L287）。式が同じでも**意味論が異なる**——「式が一致するからそのまま使える」とは読まない。

---

## 3. 総括判定

**結論を先に:**

- **土台／アーキテクチャとしては：全本「捨て」。** 5本いずれも Moira の背骨——**追記専用4イベントログを唯一の真実源とし、状態をすべてそこからの導出にする**（A2＋A1）——を持たず、**真実源が可変状態**（YAML/SQLite 行/Excel セル/spec.json）である点で逆向きに建っている。これは「値を記録するか否か」の問題ではない（Moira も §3 でベースライン値をログへ凍結記録する; L186-187）。**真実源が追記専用ログでない**ことが背骨の欠落である。
- **ただし完全な無菌ではない**: sdd-dashboard は append-only の監査ログ（書込操作のサイド記録）という A2 の*精神*の希薄な痕跡を持つ（背骨ではない。所見1）。
- **実装の入力／参照としては：選択的かつ実質的に有用。** 3本（sdd-dashboard・evm-studio・WBS specs）は Moira の異なる**層／半分**の事実上の部分参照実装であり、各々**高価値の資産**を1つ以上持つ。

> 裁定「**捨**」の意味: Moira の**背骨**（A2 追記専用ログ＋全導出）としては不採用、という一点を指す。コード/算法/ドメインモデルの個別資産の可否は「救出すべき資産」「落とすべき毒」列で別途裁定する。

| # | 対象 | 背骨裁定 | 救出すべき資産（→対応する Moira 原理）／価値 | 落とすべき毒 |
|---|---|---|---|---|
| 1 | WBS 生成スペック | **捨** | fill-to-capacity α_i スケジューリング算法（→P7-P8/R-U11/R-T1。実装依存部分の具体化。ただし単一容量・エージェント非対応・CP 非優先で P7/R-T2 適合には上乗せ要）**[高]**／ライフサイクル分解＝要件チェックリスト **[中]**／α_i の随伴データ(暦・祝日・休暇・在籍期間) **[中]** | **習熟度テーブル（⊥A4）**／可変 YAML＋Excel 基盤 |
| 2 | evmtools | **捨** | plan-adherence 4象限の派生シグナル（→観測/導出/警告）**[高]**／日次PV過負荷検知（→R-T3 参照実装）**[中]**／アラート分類（出発点カタログ） **[低]** | Excel 入力・スナップショット差分 |
| 3 | morning-report-full | **捨** | 固定レポートテンプレ＝日次ダイジェストの出力 UX 仕様 **[低〜中]** | 薄いオーケストレータ以上の独自性なし（evmtools に従属） |
| 4 | sdd-dashboard | **捨** | **仕様半分のドメインモデル＋UX**：4フェーズ承認 transition／トレーサビリティグラフ／カバレッジ行列・未カバー検出（→A1・木+relate・P2）**[高]**／**承認順序強制ライタ**（→R-D2/R-D1 transition 順序ゲート）**[中]**／**append-only 監査ログ＋ファイル監視→SSE 配信**（→A2 の部分的予兆・導出のライブ配信） **[中]** | regex パーサ（remark/mdast 未移行の手抜き）／真実源は spec.json mutation（⊥A2） |
| 5 | evm-studio | **捨** | **検証済み EVM 計算骨格（標準 EVM。EV 意味論は P1 と相違）[高]**／α_i の独立到達（傍証）／派生シグナル・UX カタログ(SPI/CPIトレンド・CCPM fever・alertLevel・前日比・Gantt) **[中]** | SQLite スナップショット保存（⊥A2）／WBS 先行（A1 欠）／固定見積（§2.2 欠）／※isBuffer 予約は未決の設計論点（§5.5） |

---

## 4. 横断的所見

### 所見1 — 5本とも A2「追記専用ログを唯一の真実源とし全導出」の背骨を欠く（最大の構造的欠落）

Moira の一文定義は「**4種の追記専用イベント列であり、進捗・スケジュール・健全性はすべてその導出**」（MODEL.md L14）。5本の真実源は**いずれも可変状態**:

- WBS specs: 可変 `tasks.yaml`／`schedule.yaml`（段階ごとに同一ファイルへ見積・担当・日程を書き加え・書換）＋ Excel セル
- evmtools: WBS が産んだ Excel（`.xlsm`）を入力に、2スナップショットの差分（`diff(now, prev)`）
- morning-report-full: evmtools への薄い合成
- sdd-dashboard: markdown＋`spec.json` の書換（承認＝`spec-json-writer` による spec.json アトミック上書き）
- evm-studio: SQLite の `progress_snapshots`（(task,date) 単位の可変行。`server/src/db/schema.ts` L78-89）を真実源

これは Moira の背骨の**逆**である。Moira では「diff」も「現在状態」も**ログを ts まで再生した導出**にすぎない。注意すべきは、これは「値をどこかに記録するか」の問題**ではない**——Moira も §3 でベースライン（予算・スロット）を transition の凍結属性として**ログへ記録**し、「純導出で記録不要」という旧主張を v10 で撤回している（MODEL.md L186-187, L402）。欠落は**真実源が追記専用ログでない**ことに尽きる。

**ただし完全な逆ではない弱い痕跡が見える**（いずれも背骨ではなく、過大評価しない）:
- **sdd-dashboard の `audit-log`**（`server/src/services/writes/audit-log.ts`）は書込試行（成否）を**append-only** で1行 JSON 記録する。ただし `.kiro/` 本体には書かず状態を駆動しない**サイドの監査ログ**で、記録対象も domain event ではなく write 操作——A2 の*精神*の最も希薄な痕跡。
- evm-studio の `progress_snapshots` には `pvDays/evDays`（`schema.ts` L83-84「保全用」コメント）というフィールドがあるが、**導出系（evm-engine・evm-fever）はこれを一切読まず**、毎回 `progressPct`/`estimateDays` から再計算して API 応答にエコーするだけの**死蔵カラム**である（`evm-fever.ts` はコメントで `evDays` と書きつつ実装は再計算する）。§3 の凍結記録のような「読み戻す正本」の**機構ではなく**、保全の**意図のスキーマ痕跡**にとどまる。

→ **背骨としては全本「捨て」が正しい**（追認ではなく、真実源が可変という独立した理由による）。救出は算法・ドメインモデル・派生シグナル、および上記2断片の層に限る。

### 所見2 — α_i の独立到達（2系統）：v12 公理化の動機の傍証

**人間ごとの1日あたり割合容量**という同じ概念に、複数の成果物が独立に到達している:

- WBS specs: `availability_rate ∈ 0.0〜1.0`、`duration_days = ceil(estimate_days / availability_rate)`（`WBS-COMMON.md` WBS-CMN-008 L369／WBS-CMN-012 L595）
- evmtools: 日次 PV > 閾値（既定 1.0/人/日）を過負荷として検知（`check-daily-pv`）
- evm-studio: `availabilityRate`（既定 1.0）を日次 PV に算入。タスク単位の fill-to-capacity cap（`min(N·α_i, estimateDays)`; `evm-engine.ts` L250、docstring も WBS-CMN-013 を参照）は持つが、**複数タスク横断の `capacity_map` ビンパッキングは持たず**、WBS 産の `planned_start/end` を入力に取る

ただし**「三重独立」ではない**: evmtools は WBS が産出した Excel を読む下流（`ExcelProjectCreator`）であり、WBS specs と系譜上独立でない。真に独立な到達は **2系統**——「WBS パイプライン系（specs＋evmtools）」と「evm-studio」。

この2系統の到達は、v12 で公理 A4 に格上げした **α_i ∈ (0,1.0] MD/日** の**動機の傍証**である（公理化の妥当性を経験的に証明する強い証拠ではない——妥当性は MODEL §5 が UC 論証で立てる）。定義域も対等な比較ではない: WBS の `0.0` は `ceil(estimate_days / availability_rate)` で**ゼロ除算となり機能しない**（実質下限 >0）、evm-studio は app 層で `[0,1]` を強制（0 は PV=0 の退化値）。Moira の `(0,1.0]` は **0 を意図的に定義域外**とし「投下しない人間は割当解除で表現」（MODEL.md L32）と明示分離した点が**設計上の改良**である。

### 所見3 — プロトタイプは「Moira の二つの半分＋接合層」を実装している

- **sdd-dashboard ＝ 仕様・価値の左半分**: spec（req→design→tasks→impl）を実体として扱い（≈A1）、トレーサビリティ（≈木+relate）とカバレッジ／未カバー検出（≈P2）、人間承認（≈transition、順序ゲートまで実装）を持つ。**しかし EVM・見積・時間が無い**。
- **evm-studio ＝ EVM・スケジュールの右半分**: EVM 導出（P1・§3）・α_i 按分・トレンド・fever・alerts を持つ。**しかし spec 実体が無い**（WBS タスク先行で req/design リンクなし）。
- **WBS specs ＝ 両半分をつなぐ接合層**: 左半分（見積・要員・ライフサイクルゲート）と右半分（スケジュール・PV）を橋渡しする **α_i スケジューリング算法**を供給する。「二つの半分」のどちらにも完全には属さないが、最高価値[高]の救出資産はここにある。

これら（左半分＋接合算法＋右半分）を**単一の追記専用ログ上で導出として統合**したものが Moira である。どれも逆アーキなのでコードは流用できないが、**三つのドメインモデル／算法は「統合すべき部品」の参照として価値が高い**。evmtools・morning-report はこの三部構成の外で、EVM 側の派生シグナル・出力 UX を供出する。

### 所見4 — 落とすべき毒: WBS の習熟度モデル

`WBS-COMMON.md` WBS-CMN-007（L317-352）は member `level`（junior/mid/senior）× task `difficulty`（low/medium/high）の互換性テーブルを定義し、非互換時に警告する（junior→low のみ、mid→low/medium、senior→low/medium/high; L332-337）。

これは MODEL.md A4「α_i は能力（スキル・習熟度）ではない——**システムは人間の能力をモデル化しない**」（L31, L36, R-U6 L221）と**正面衝突**する。WBS specs から算法やデータ構造を流用する場合、この習熟度モデルは**必ず除去**しなければならない。Moira では割当は人間が外から与える入力（§2.4）であり、スキル適合判定は持たない。

---

## 5. 個別評価

### 5.1 AI WBS 生成スペック群 — 裁定: 捨（算法とライフサイクルは救出）

**何か**: タスク洗い出し(elicit)→見積(estimate)→要員(staffing)→スケジュール(schedule)→Excel 生成(generate) の**コア5 STEP**に、サポート（wbs-review）と任意リスケ（reschedule・import-actuals）を加えた**全8スキル**のパイプライン（`SPEC.md` L5, L37-56）。kiro 方式の仕様書群。最終成果物は Excel（`.xlsm`、五反田式進捗ツール）。

**Moira との一致点**:
- 人間承認ゲート（各 STEP 後のレビューループ・自動修正）＝ §2.1 メタ原理「観測・導出・警告、コミットは人間」と整合。AI が提案し人間が確定する形（wbs-elicit/estimate/schedule）。
- 単位が MD（マンデー）で金額を持たない＝ A6 と一致。
- `availability_rate` ＝ α_i の独立到達（所見2）。
- タスク ID の不変性（一度採番した ID は変更禁止、`WBS-COMMON.md` WBS-CMN-003）＝ append-only の精神に**部分的に**近い。

**不一致・欠落**:
- 真実源が**可変 YAML＋Excel**（⊥A2）。`tasks.yaml` は段階ごとに同一ファイルへ見積・担当・日程を**書き加える**設計で、追記専用イベントログではない。
- **WBS 先行**で spec（req→design→tasks→impl）を実体としない（⊥A1）。タスクはブレスト／インポートで列挙され、仕様からの分解ではない。
- 見積は**固定値＋バッファ係数**で、`proposed→agreed` 状態機械もカバレッジも無い（⊥§2.2, ⊥P2）。
- **習熟度モデル（⊥A4、所見4）**。
- スコープ変更は「タスク追加か description 修正」で supersede 辺・サンク可視化が無い（⊥§2.7）。

**救出すべき資産**:
- **fill-to-capacity α_i スケジューリング算法** `[高]` — `WBS-COMMON.md` WBS-CMN-013（fill-to-capacity ビンパッキング: 残余キャパへ詰める・依存タスク同日完了の余剰消化, L627-672）＋ WBS-CMN-012（`duration_days = ceil(estimate_days / availability_rate)`, L595）。MODEL.md は α_i 平準化を「非最適・発見的・**実装依存**」とする（P7-P8 L175-180, §3 L182-188）。ここにある具体的ヒューリスティクスは、その実装依存部分の出発点になる。**ただし WBS-CMN-013 は単一容量・エージェント概念なし・CP 非優先の素朴ビンパッキング**で、Moira P7/R-T2 が要求する α_i 資源制約・エージェント律速（リードタイムの CP 寄与）・クリティカルパス優先を持たない——出発点であって、これらの上乗せと**習熟度割当制約の除去**が要る。
- **ライフサイクル分解** `[中]` — elicit→estimate→staffing→schedule→generate のコア＋review ゲート＋reschedule/import-actuals という機能分解（SPEC.md は「全8スキル」と呼称）は、Moira 実装が備えるべきユースケースのチェックリストとして使える。
- **α_i の随伴データ** `[中]` — staffing.yaml の `public_holidays`・`leave_days`・`assignment_start/end`・`work_days_per_week` は、MODEL.md が現状あまり明示しない「α_i を機能させる暦・在籍の随伴入力」を具体的に示す。

**落とす毒**: 習熟度テーブル（WBS-CMN-007）、可変 YAML＋Excel 基盤、バッファ係数の固定運用。

### 5.2 evmtools — 裁定: 捨（派生シグナルのカタログは救出）

**何か**: WBS が産んだ Excel（`.xlsm`）を読み、SPI/CPI/EAC/遅延等を計算し、アラート・朝会レポート・計画追従率・日次PV を出力する Node.js/TypeScript CLI（実装済み・テスト有り）。WBS パイプラインの**下流**ツール。

**Moira との一致点**:
- 「日次の導出ダイジェスト」という発想＝ Moira の三ダッシュボード導出（R-S2）に近い。
- EVM 数式（SPI=EV/PV, CPI=EV/AC, EAC=AC+(BAC−EV)/CPI）は式形は標準 EVM。ただし Moira の SPI は分母がスケジュール済み領域限定で意味論が異なる（R-S6、§2 末尾参照）——式の流用は意味論の差を踏まえて行う。

**不一致・欠落**:
- 入力が **Excel WBS**、比較が**2スナップショットの差分**（⊥A2）。Moira なら「ログを ts1/ts2 まで再生した二つの導出の差」になる。
- spec 実体・見積状態機械・カバレッジ・supersede を持たない。

**救出すべき資産**:
- **plan-adherence 4象限** `[高]` — `scripts/src/core/plan-adherence.ts`。計画通り着手／着手出来ず／先回り着手／遅延回収中の4分類は、Moira が志向する「観測・導出・警告」の良質な**派生健全性シグナル**そのもの。Moira へ概念移植する価値が高い。
- **日次PV過負荷検知** `[中]` — `scripts/src/cli/check-daily-pv.ts`。PV>閾値（既定 1.0、`--threshold` で可変）/人/日 の検知は R-T3（α_i 過負荷）の単一容量版の参照実装。
- **アラート分類カタログ** `[低]` — `scripts/src/core/alerts.ts`（`CRITICAL_DELAY`/`WARNING_DELAY`/`OVERDUE`/`HIGH_WORKLOAD`）。出発点としては使えるが、Moira は固定閾値より**状態から導出する非単調性警告**（P5）を好むため、閾値はそのまま採らない。

**落とす毒**: Excel 入力、スナップショット差分アーキ。

### 5.3 morning-report-full — 裁定: 捨（ダイジェスト UX 仕様としてのみ）

**何か**: evmtools の複数 CLI を順に叩き、固定フォーマットの Markdown 朝会レポートを生成するオーケストレータ。

**評価**: アーキテクチャ的独自性はほぼ無く、evmtools への薄い合成。Moira への価値は **1点に限られる**:
- **固定レポートテンプレ** `[低〜中]` — SPI 推移／現況／差分／リスケ／日次PV／遅延／計画追従率／考察 という構成は、Moira の「観測・導出・警告」を**人間に届ける日次ダイジェストの出力 UX 仕様**として参照できる（`SKILL.md`）。

独立した**アーキ的**救出資産は無い（このテンプレ自体、evmtools 出力の提示形式であって evmtools 評価に従属する）。

### 5.4 sdd-dashboard — 裁定: 捨（背骨は spec.json mutation で ⊥A2）／仕様半分のドメインモデルと永続/順序機構は高価値

**何か**: `.kiro/` の spec（requirements/design/tasks/spec.json）を読み、レビューワークフロー（承認・手戻り）とトレーサビリティ（AC⇄Design⇄Task）を可視化する仕様レビュー UI。

> 注: README は「SSE / 書込なし・スタブ」を自称するが、**現ソースは README より進んでいる**。実コードには chokidar ファイル監視・SSE 配信・zod 検証付きの実書込ルート（承認順序検証・spec.json アトミック書換・append-only 監査ログ）が実装済みで、README の当該記述は陳腐化している（現ソースを正とする本評価の方針による）。

**Moira との一致点（5本中で A1 に最も近い）**:
- **spec を実体として扱う**: req→design→tasks→impl の4フェーズは、Moira の「フェーズもノード」（§2.6）に対応。これは A1「spec とその分解が唯一の実体」に最も接近した試作。
- **4フェーズ承認＋順序ゲート**: 各フェーズが人間承認でゲートされ、`approval-writer` が「req→design→tasks の順に先行フェーズが approved」を強制する（`server/src/services/writes/approval-writer.ts`、違反は `APPROVAL_ORDER_VIOLATION`）。これは Moira の **R-D2 既定 `accepted`（先行フェーズ承認で後続が進む）の*精神*に対応する動く参照**——ただし dashboard は単一 `approved` boolean であり、Moira の多状態機械（pending→…→accepted）や R-D1 の `ready` 解放（着手可能化）そのものではない。
- **トレーサビリティグラフ** AC⇄Design⇄Task ＝ 木＋relate のノード／辺構造。
- **カバレッジ行列・未カバー検出** ＝ P2 カバレッジ（「既知ツリーの何が未カバーか」）の概念に近い。
- **ライブ配信**: chokidar 監視（`server/src/watcher/kiro-watcher.ts`）→ EventBus → SSE（`server/src/api/events.ts`）で `.kiro/` 変更をリロードなしに反映。導出のプッシュ配信に思想的に近い。

**不一致・欠落**:
- **EVM・見積・時間・スケジュールが一切無い**（Moira の右半分が丸ごと欠落）。
- 真実源が markdown＋`spec.json` で、承認は spec.json の**アトミック書換**（`spec-json-writer`、⊥A2）。`audit-log` は append-only だが `.kiro/` には書かない**サイドの監査**であって状態を駆動しない——背骨は依然 mutation。
- 「チケット＝ノードの射影」が無い（そもそもチケット概念が無い）。

**救出すべき資産**:
- **仕様半分のドメインモデル＋UX** `[高]` — 4フェーズ・承認 transition・トレーサビリティグラフ・カバレッジ行列。Moira の**左半分**の事実上の参照設計。**画面構成とドメインの切り方**が Moira の仕様ダッシュボード設計に直接活きる。E2E（`e2e/review.spec.ts`, `e2e/workflow.spec.ts`）も承認・手戻りの振る舞い仕様として参考。
- **承認順序強制ライタ** `[中]` — `approval-writer.ts`。フェーズ順序ゲート（R-D2/R-D1）の動く参照実装。
- **append-only 監査ログ＋ファイル監視→SSE** `[中]` — `audit-log.ts`／`kiro-watcher.ts`／`events.ts`。A2 の*精神*（追記専用ジャーナリング）と導出のライブ配信の部分参照。
- 残る手抜き: パーサは依然 **regex**（本実装の remark/mdast 置換は未了）、サイドバイサイド比較・逆方向ジャンプ未実装、フロー可視化は CSS。これらは捨ててよい。

**落とす毒**: regex パーサ（remark/mdast 未移行）、spec.json mutation を真実源とするアーキ（⊥A2）。

### 5.5 evm-studio — 裁定: 捨（背骨はスナップショット保存で ⊥A2）／EVM 半分の検証済み導出は高価値

**何か**: WBS（タスク木）＋日次進捗スナップショットから PV/EV/AC/SPI/CPI/EAC/ETC/TCPI/VAC を計算し、Gantt・SPI トレンド・CCPM フィーバーチャートで可視化するダッシュボード（React＋Hono＋tRPC＋Drizzle/SQLite）。EVM エンジンは純関数群＋テスト有り。

**Moira との一致点（5本中で EVM 導出 P1/§3 に最も近い）**:
- **EVM 導出が純関数**: `calculateTaskEv = estimateDays * progressPct/100`（`evm-engine.ts` L275-276）、`AC = Σ acDays`（L300-301、フラット総和）。これは**標準 EVM（%完了×現見積）**で、**MODEL P1 とは EV 意味論が異なる**（P1 は完了サブ単位×凍結ベースライン値・葉での部分クレジットなし; L156-158）。AC も P3 の木再帰ロールアップ `cost+ΣAC(children)` ではなくフラット総和、SPI も R-S6 のスケジュール・カバレッジ de-rate を持たない。**式は動く参照だが、意味論（完了判定・凍結・領域限定）は Moira 側で調整が要る**。
- **α_i（availabilityRate）を PV 按分に算入**（所見2。線形按分でビンパッキングではない）。
- **時系列トレンド**（各履歴日で EV/PV 再計算）＝「各時点での導出」で、ログ再生に思想的に近い。
- **派生警告**（alertLevel: `CRITICAL_DELAY`/`WARNING_DELAY`/`OVERDUE`）・**前日比** ＝ 観測/導出/警告に整合。

**不一致・欠落**:
- 真実源が **SQLite の `progress_snapshots`**（(task,date) 単位の可変行。`schema.ts` L78-89）。**追記専用ログの再生ではなく、可変スナップショットからの再計算**（⊥A2）。なお `pvDays`/`evDays`（L83-84「保全用」）は §3 ベースライン凍結記録と発想が近い（所見1の断片）が、真実源が可変行である点は変わらない。
- **WBS 先行**で spec 実体・req/design リンクが無い（⊥A1）。
- 見積は**固定 `estimateDays`** で `proposed→agreed` 状態機械もカバレッジも無い（⊥§2.2, ⊥P2）。
- supersede／サンク可視化が無い（⊥§2.7）。

**救出すべき資産**:
- **検証済み EVM 計算骨格** `[高]` — `server/src/services/evm-engine.ts`（PV/EV/AC/SPI/CPI/EAC…）。**標準 EVM の動く・検証された実装**である点が価値（テスト込み）。P1 の完了サブ単位×凍結ベースライン、SPI の領域限定 de-rate(R-S6) との意味論差は移植時に調整する——Moira 固有意味論の参照ではなく、計算骨格の参照。
- **派生シグナル・UX カタログ** `[中]` — SPI/CPI トレンド（`evm-trend.ts`）、CCPM フィーバー＋クリティカルチェーン（`evm-fever.ts`）、alertLevel、前日比、Gantt レイアウト（`evm-gantt.ts`）。Moira の EVM 側ダッシュボードの出力カタログとして参照可。
- **α_i の独立到達**（所見2）。

**落とす毒**: SQLite スナップショット保存を真実源とするアーキ（⊥A2）、WBS 先行（A1 欠）、固定見積（§2.2 欠）。

**未決の設計論点（毒とは断定しない）**: `isBuffer` は CCPM バッファ**ノード**（留保量を `estimateDays` として保持。`bufferTotalDays = Σ(isBuffer タスクの estimateDays)`、`bufferConsumption = 累積遅延/バッファ総日数` は導出消費率＝裁量「留保率 tuning」ではない）。MODEL §5/L45 は reserve を裁量パラメータとして全廃したが、バッファ*ノード*の可否は明言していない——fever の消費率シグナルの出力 UX は参照可だが、バッファ予約（留保量）を Moira に持ち込むかは**設計判断として留保する**（本評価では互換/非互換を断定しない；ユーザー裁定により開示扱い）。

---

## 6. 救出資産 抽出サマリ（資産別の正本台帳）

Moira 実装に持ち込む価値がある資産を横断で一覧化する（裁定の根拠は §5、**毒は持ち込まない**）。

| 資産 | 出所 | 対応する Moira 原理 | 価値 |
|---|---|---|---|
| fill-to-capacity α_i スケジューリング算法（習熟度制約除去・単一容量/エージェント非対応につき上乗せ要） | WBS `WBS-COMMON.md` CMN-012/013 | P7-P8/R-U11/R-T1（実装依存部分の具体化） | 高 |
| 仕様半分のドメインモデル＋UX（4フェーズ・承認 transition・トレーサビリティ・カバレッジ行列） | sdd-dashboard `client/` ＋ `server/src/services/trace-graph.ts` | A1・木+relate・P2・transition | 高 |
| 検証済み EVM 計算骨格（PV/EV/AC/SPI/CPI/EAC） | evm-studio `server/src/services/evm-engine.ts` | 標準 EVM 計算骨格（P1 とは EV 意味論相違・R-S6 de-rate 欠） | 高 |
| plan-adherence 4象限 派生シグナル | evmtools `scripts/src/core/plan-adherence.ts` | 観測/導出/警告（R-S系） | 高 |
| 承認順序強制ライタ（先行承認ゲート） | sdd-dashboard `server/src/services/writes/approval-writer.ts` | R-D2 accepted 既定の*精神*（単一 boolean。多状態機械・R-D1 ready 解放そのものではない） | 中 |
| append-only 監査ログ＋ファイル監視→SSE 配信 | sdd-dashboard `server/src/services/writes/audit-log.ts`／`watcher/kiro-watcher.ts`／`api/events.ts` | A2 の精神（部分）・導出のライブ配信 | 中 |
| 日次PV過負荷検知 | evmtools `scripts/src/cli/check-daily-pv.ts` | R-T3（α_i 過負荷） | 中 |
| 派生シグナル・UX カタログ（トレンド・fever・alert・前日比・Gantt） | evm-studio `server/src/services/evm-*.ts` | R-S2・P5・健全性導出 | 中 |
| ライフサイクル分解（要件チェックリスト。SPEC は「全8スキル」と呼称） | WBS `SPEC.md`/`WBS-ORCH.md` | ユースケース網羅 | 中 |
| α_i 随伴データ（暦・祝日・休暇・在籍期間） | WBS `WBS-COMMON.md` CMN-006/011 | A4 を機能させる入力 | 中 |
| 日次ダイジェスト出力 UX 仕様 | morning-report-full `SKILL.md` | R-S2 の提示面 | 低〜中 |
| アラート分類カタログ（閾値は流用しない） | evmtools `scripts/src/core/alerts.ts` | P5（ただし固定閾値は不採用） | 低 |

---

## 7. 結論

- **問い「Moira の思想を体現するシステムの構築に役立つか」への答え:**
  - **土台／アーキテクチャとしては No。** 5本すべてが Moira の背骨（A2 追記専用ログを唯一の真実源とする全導出、A1 spec 単一実体）を持たず、真実源が可変状態である。背骨としては捨てて正しい（追認ではなく、真実源が可変という独立した理由による。sdd-dashboard の append-only 監査ログは A2 の*精神*の希薄な痕跡にとどまり、evm-studio の `pvDays/evDays` は導出に読まれない死蔵カラムで、いずれも背骨ではない）。
  - **実装の入力／参照としては Yes、選択的かつ実質的に。** 3本が Moira の異なる層／半分の事実上の部分参照実装であり、各々高価値資産を持つ: **WBS specs＝α_i スケジューリング算法（接合層）**、**sdd-dashboard＝仕様半分のドメインモデル＋順序ゲート/監査の動く機構**、**evm-studio＝EVM 半分の検証済み導出**。evmtools は派生シグナルのカタログ、morning-report はダイジェスト UX 仕様を供出する。

- **最大の収穫**: α_i の独立到達（2系統）が、v12 で公理化した α_i の**方向の傍証**になっている（妥当性の経験的証明とまでは言わない；定義域は Moira の (0,1.0] が 0 除外を割当解除に分離した点で最も洗練されている）。

- **最鋭の警告**: WBS の習熟度モデル（level × difficulty）は A4 と正面衝突する。資産を流用する際、これを**持ち込まないこと**が最も重要な一線。

- **次の一手の示唆**: 「二つの半分＋接合層」（sdd-dashboard の仕様側＋WBS の α_i 算法＋evm-studio の EVM 側）を、**単一の追記専用4イベントログの上で導出として再構築する**のが Moira 実装の核心。プロトタイプは三つの部品を先取りして見せた——が、背骨（追記専用ログを真実源とする全導出）だけは、どれも持っていない。そこが新規に書くべき本丸である。
