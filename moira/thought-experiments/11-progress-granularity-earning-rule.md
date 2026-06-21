# 思考実験 11:二値 EV と進捗把握の遅れ —— 獲得ルールは却下、実行カバレッジへ収束

> 状態: **確定済み(MODEL v16)**。round 1 で当初提案 **P-EARN(partial EV 獲得ルール)を却下**(Critical 生存)。
> ユーザー FORK 裁定により **核心会計を読まない別建ての客観オーバーレイ「実行カバレッジ」P-EXECCOV** へ収束。
> round 2 で致命傷なし→修正(count-based 化)＋ユーザー裁定(canon-home=正典 R-S 要件)。round 3 で R-U8 反証が
> 再反論を生存し、**gate-judge PASS(残存 Critical/Important = 0)**。MODEL を **v15→v16** に確定:**R-S8** 新設・
> §3 定義・R-S2 列挙・§6 来歴・§7#13・DECISIONS 追記。

> 問い:Moira は意図的に %進捗を持たない(A2／P1「重みテーブルなし」／主観%は捏造で accuracy-first と衝突)。
> その帰結として **1 葉の EV_abs は完了まで 0、完了で満額**の二値になる(ev.ts / R-U8 / P1)。粗い葉では
> 仕掛中(`implementing`)の間、プロジェクトの **集約 EV%/SPI/CPI が一切動かず、把握・遅延検知が遅れる**。
> これは正典の欠陥か、正典が既に扱っているか。

---

## 1. 問題の所在

現行 EV_abs は完了サブ単位のみ算入(P1 / R-U8 / ev.ts `COMPLETED={implemented,accepted}`)。仕掛中の葉は EV=0。
正典の緩和は二つ:**分解**(P1「EV 解像度=分解解像度」)と **可視シグナル**(Track A・実装済:`implementing` 経過・
予測完了の基準乖離 R-S7・AC 先行)。両者には届かない領域がある:分解は **R-U5「項目層に状態機械を持たない
(意図的非対称)」** ゆえ葉の二値性が床。Track A は **per-task の質的表示**で **集約指標を動かさない**。
→「執行中に**集約レベルで進捗が見える**」要求は両者では満たせない。

---

## 2. round 1:P-EARN(partial EV 獲得ルール)= **却下**

**却下案**: 葉が `implementing` で凍結予算の固定割合 F(例 0.5)を稼ぎ残りを完了で稼ぐ。F は固定正典定数。

**敵対ゲート round 1(moira-adversary×3＋fact-checker)= Critical 生存・反証不能:**
- **[Critical] R-U8「state-weight table を使わない」/ P1「重みテーブルなし」に該当**。F は状態→重み写像
  `{implementing:0.5, implemented:1.0, 他:0}` ＝ state-weight table そのもの。
- **[Critical] L47／v15 ヘッダ litmus 違反**。v15 は留保率を「EV に折り込まれ進捗を歪めた暗黙の乗率」として
  全廃し、正当入力との区別を「核心会計を読まない」に置いた。F は核心会計(EV_abs)を読み変える乗率。§7#11 の
  判定「留保率との算術同型」に該当。「固定 vs 裁量」では救えない(F 値の選択自体が出力を変える)。
- **[Critical] 最小性=除去可能**。正典の進捗粒度の答えは分解(P1)。
- **[多数] 未処理ケース**:PV(二値)×EV(部分)の SPI 破壊・SPI>1、下方再見積で EV%>1(P1 [0,1] 違反)、
  supersede/cancel 仕掛の部分稼得未定義、I4 施錠の遡及、implementing 非経由完了、P8 平準化の EV_abs 伝播。

**fact-checker = NO_OBJECTION**(0/100・50/50・20/80 は標準 EVM の客観手法・主観%と別カテゴリ・留保とも別概念)。
ただし **Moira の L47/R-U8 は標準より厳格**(標準が保持する重み表を意図的に溶かした)。固定式は「短期・誤差有界」の
手法で、P-EARN の動機(粗い葉)は誤差が**非有界**になる場面。→ **却下(accuracy-first により強行せず)**。

---

## 3. round 2:P-EXECCOV(実行カバレッジ)= **採用方向**(canon-home=正典 R-S 要件・ユーザー裁定 2026-06-21)

partial EV を使わず、**核心会計(EV_abs/EV%/PV/SPI/CPI)の式を一切変えない別建ての客観 coverage** で、執行中の
進捗を集約レベルに通す。

### 3.1 定義（count-based）
- **実行カバレッジ executionCoverage** = |現行有効・合意済み**葉**のうち lifecycle=`implementing`| /
  |現行有効・合意済み**葉**|（**ノード数**・有効集合上、scheduleCoverage と**同じ葉基底**）。**分母0（合意済み
  有効葉なし）→ 0（honest empty・P0）**——scheduleCoverage/estimateCoverage（coverage.ts）の空集合 0 と同一規律。
- **構造同型（R-U8 反証の核）**: **scheduleCoverage(R-S6)と同型**——述語が「scheduled か否か(frozenSlot≠null)」→
  「`implementing` か否か」に変わっただけで、分母集合(合意済み有効葉)も一致。**予算・見積に一切掛けず状態述語で
  ノードを数えるだけ**ゆえ、EV_abs に状態別乗率を折り込む weight table（R-U8 が EV% **稼得**について禁ずる対象)
  とは別物。scheduleCoverage が既に正典(R-S6)で weight table 扱いされていない以上、execCov も非該当（独立採点者
  により R-U8 反証は再反論を生存＝健全と確認・round 3）。
- **同型の限界(開示)**: (a) estimateCoverage(P2)は分母が**全有効ノード**(中間含む)で葉基底の execCov/
  scheduleCoverage とは**集合が異なる**(同じノード数次元だが同一集合ではない)。(b) 述語の**時間安定性**が異なる
  ——frozenSlot は凍結属性で再ベースラインまで不変、`implementing` は生きた状態で前進/後退に追従(execCov は
  scheduleCoverage より変動的)。よって「同型」であり「完全同一」ではない。

### 3.2 必須規律(de-rate・対読み)
- **出来高ではない**。execCov は「**仕掛中の量**」であって進捗・完了度ではない——`implementing` に居座るだけで
  進んでいないタスクも算入される。**「進捗率」「完了度」として提示してはならない**(R-S4/R-S6 と同型)。
- **算術和を禁じる**。EV%(予算比率)と execCov(ノード数比率)は次元が異なり「EV%+execCov=全体進捗」は**禁止**
  (round2 の「done/doing/todo 算術分割」主張は撤回)。execCov と scheduleCoverage は同次元だが分子が重複しうる
  (implementing かつ scheduled の葉)ため和に意味はなく、やはり足さない。三者は**併置して対読み**する。
- **対読みパートナー**: EV%(達成率)・estimateCoverage(P2・合意領域の広さ)と三者併置。実際に仕掛が進んでいるかは
  **Track A**(リードタイム P6・予測完了の基準乖離 R-S7)と対で読む(execCov の false comfort 防止)。

### 3.3 コミット領域のみ(P0)と忠実度の開示
- **execCov 自身の要件として「合意済みのみ」を明記する**(R-U8/R-U13 は EV_abs/EV% の要件で execCov に自動適用
  されないため、新 R-S 要件文言に独立して書く)。EV% と同様 **合意(コミット)領域のみ**を語り、未合意のまま
  `implementing` の葉(TE05 の合意ゲート無し経路)は分子・分母とも対象外。これは **estimateCoverage(P2)が示す
  可視ギャップ(P0)** に現れる(EV% が未合意を除外するのと**思想として同じ**——条文は execCov 用に別途置く)。
- `implementing` を記録せず `ready→implemented` にスキップする経路(§2.5 は例示)では doing が立たず直接 done に
  なる——**execCov の忠実度は `implementing` が記録されることに依る**(凍結スロットが SPI の前提であるのと同型の
  開示)。

### 3.4 非干渉・非単調・平準化非依存
- **非干渉**: EV_abs/EV%/PV/SPI/CPI の**式を一切変更しない**(新規 read 要件の追加であって既存導出式の改変でない)。
- **再見積非依存(count-based の利点)**: ノード数比率ゆえ**見積値の改定では動かない**(状態遷移時のみ変化)。
  partial EV/見積加重で生じる「再見積で着手と無関係に動く非単調」(round2 指摘)は count-based で**消える**。
  分解(decompose で葉が増減)では分母が動くが、これは構造変化に伴う正直な変動(EV%/カバレッジ全般と同型)。
- **平準化非依存(値)**: 値は lifecycle 状態(ログから決定的)と最新見積のみに依り、スロット/平準化(P7/P8)に
  依らない(partial EV の P8 伝播問題が起きない)。ただし `implementing` 遷移の**タイミング**は運用・スケジュール
  進行に間接依存する(値の計算手順は非依存だが軌跡は運用次第)——開示。

### 3.5 MODEL の触れる要素(確定対象)
- **新 R-S 要件1件**(executionCoverage の導出＋ EV%/estimateCoverage との対読み＋ de-rate 規律)。
- **§3** に executionCoverage の定義と §3.2–3.4 の規律を明記。
- **新公理・新イベント・新状態・新原理番号なし**(v15 最小性継承)。**R-U8/L47/P1/EV_abs/SPI/CPI/PV は変更不要**
  (execCov はそれらを読み変えない)。
- 版ヘッダ v15→**v16**、§6 来歴、§7 確認事項、`DECISIONS.md`。

---

## 4. accuracy-first の歯止め
ゲート PASS(独立採点者の残存 Critical/Important=0・R-U8 反証の再反論生存・FORK 裁定済)なしに MODEL は確定しない。
満たさなければ確定せず残課題を §7 と報告に正直に出す。

---

## レビュー来歴
- **round 1(2026-06-21)**: P-EARN を moira-adversary×3＋fact-checker で攻撃 → Critical 生存(R-U8 state-weight
  table・L47/算術同型・除去可能・未処理多数)→ **却下**。ユーザー FORK 裁定で P-EXECCOV へ収束。
- **round 2(2026-06-21)**: P-EXECCOV を moira-adversary×3 で攻撃 → **致命傷なし**。修正可能 finding を §3 に反映:
  算術分割主張の撤回・**定義を count-based 化**(scheduleCoverage と完全同型→R-U8 反証が自明・estimateCoverage と
  次元一致・**再見積非単調も消滅**)・分母0=0(honest empty)・de-rate 規律追加・スキップ/未合意は P0 可視ギャップ。
  R-U8 該当(FORK1)は **scheduleCoverage 構造同型**で反証(同一ラウンドで再反論に付す)。canon-home(FORK2)は
  **ユーザー裁定=正典 R-S 要件**。
- **round 3(2026-06-21)**: R-U8 反証を別 adversary に差し戻し再反論 → **反証は生存(健全)**
  (scheduleCoverage/estimateCoverage と構造同型・R-U8 の射程は EV% 稼得への state-weight 適用)。残存 Critical
  なし。完全性スイープで round2 全 finding の閉塞を確認。新規 Important 2件(estimateCoverage の分母集合差の開示・
  execCov の「合意済みのみ」を R-U8 参照でなく独立条文化)を §3.1/§3.3 にパッチ済。→ gate-judge へ。
- **gate-judge(round 3)**: **PASS**(残存 Critical/Important = 0)。独立採点者が coverage.ts/ev.ts/R-U8 を現物
  確認し、R-U8 反証(scheduleCoverage 構造同型)を健全と追認・EV 式非干渉を確認・canon-home FORK のユーザー裁定を
  確認・停止性 OK。→ **MODEL v16 確定**(R-S8 新設・§3 定義・R-S2 列挙・版ヘッダ・§6 来歴・§7#13・DECISIONS)。
