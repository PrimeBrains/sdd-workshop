# 仕様駆動・チケット駆動・EVM 統合モデル v10
# Unified Model: Spec-Driven × Ticket-Driven × EVM (v10)

> 合言葉 / Motto: **必要かつ十分 (Necessary and Sufficient)**
>
> 本書はアーキテクチャ以前の「思想の確定」であり、実装技術には立ち入らない。
> v10 は、独立した敵対者によるレビュー(moira-model-update スキル)で v9 の構造的綻びを是正した版である。主な是正:金額通貨の撤去(最小性)、I1 に未見積子の除外を明示、`implemented` を「判定であって保証でない」と明確化、supersede の累積/現行有効の分離規則、暫定割当の上書き機序、派生指標(SPI/CPI/PV)の定義、過剰な自己評価の撤回。新公理・新イベント・新状態は増やしていない(A6 二通貨は一通貨へ縮約)。
> *v10 corrects structural gaps in v9 found by an independent adversary (the moira-model-update skill): drops the money currency (minimality), excludes unestimated children in I1, clarifies `implemented` as a judgment not a guarantee, separates cumulative-earned from currently-effective for supersede, specifies provisional-assignee overwrite, defines derived indices (SPI/CPI/PV), and retracts overstated self-scores. No new axioms, events, or states (A6 reduced from two currencies to one).*

---

## 0. 一文の定義 / One-Sentence Definition

**プロジェクトとは、見積を持つノードの木とポリシー付きの辺で結ばれた DAG の上を流れる4種の追記専用イベント列であり、進捗・スケジュール・健全性はすべてその導出である。システムは観測・導出・警告に徹し、コミットメントを伴う判断(見積の合意・割当・スコープ/期日の決定)は人間に残す。**

*A project is an append-only stream of four event kinds over a tree of estimated nodes and a policy-bearing DAG; progress, schedule, and health are all derivations. The system observes, derives, and warns; commitment-bearing decisions — estimate agreement, assignment, and scope/deadline calls — remain with humans.*

---

## 1. 公理 / Axioms

**A1 — 単一実体.** 存在するのは spec とその分解である**ノード**のみ。チケットは射影。
*The only entities are the spec and its nodes; tickets are projections.*

**A2 — 単一データ.** 唯一のデータは**追記専用イベントログ**。イベントは4種:`transition`/`decompose`/`relate`/`cost`。
*The only data is an append-only log of four event kinds.*

**A3 — ノードと二重グラフ.** ノードは見積を持ち状態機械上にある。木(価値集約)と DAG(時間制約、辺ごとに充足ポリシー)が重なる。
*Nodes hold estimates and sit on state machines; a value tree and a policy-bearing constraint DAG overlay them.*

**A4 — 単一希少資源.** 希少資源は**人間**のみ。人間は 1.0MD/日 の容量を持つ。**システムは人間の能力(スキル・習熟度)をモデル化しない**——それは日々成長し、伴走・教育という柔軟性で運用される領域であり、硬いルールで縛らない。承認点は cc-sdd ゲートに従う。
*The only scarce resource is humans (1.0MD/day capacity). The system does NOT model human capability — it is growth-oriented and run by human flexibility (mentoring), not hard rules.*

**A5 — 三つの(非)対称.** 人間とエージェントは、**表現において対称**(同一ログ・同一の提案者役割)、**資源において非対称**(平準化対象は人間のみ、エージェントは遊休可)、**権限において非対称**(見積の確定=合意は人間のみ)。
*Symmetric in representation; asymmetric in resource (only humans leveled) and authority (only humans finalize estimates).*

**A6 — 単一通貨(アテンション時間).** 実コストは**人間アテンション時間**で記録する。希少資源は人間(A4)であり、コストの支配項は人間時間だからである。金額は本モデルの UC が要求しないため持たない(必要が生じれば cost の付帯情報として後付けできるが、一次の管理通貨はアテンション時間に一本化する)。
*Actual cost is recorded in a single currency: human attention-time. The scarce resource is humans (A4) and the dominant cost term is human time; money is not modeled because no use case here requires it (it can later ride as ancillary cost metadata if needed).*

> **調整可能な大域ノブは存在しない。** 重み・留保率・ready 閾値・スキルは、見積データ・ノード化・辺ごとのポリシー・人間判断へ還元され消滅した。
> *No tunable global knobs; weights, reserve, ready-threshold, and skills all dissolved.*

---

## 2. 基本構造 / Core Structures

### 2.1 メタ原理:システムは警告し、人間が決める / Meta-Principle: System Warns, Human Commits
コミットメントを伴う判断は、システムが自動化せず、必ず人間が行う。システムは観測・導出・警告に徹する。
1. **見積の合意** — AI が提案、人間が確定(A5)。
2. **割当** — 誰がどのタスクをやるかは人間が決める(§2.4)。
3. **スコープ/期日の決定** — 期日超過時、要員追加か機能削減かは人間が決める(R-T4)。
4. **計画の精度(見積の深さ)** — 見積をどこまで見積もるか、ノード化するか畳むかは人間が決める(§2.3, R-E2b)。

これらは「人間の能力という、日々変わり柔軟性で回っている領域」をルールで殺さないための設計であり、希少資源たる人間判断を**意図的に投下する点**である。

**構造とコミットの境界:** モデルは「**何を表現できるか**(ノード・辺・イベント・導出)」という**構造**を確定する。一方「**どこまで踏み込むか**(分解の粒度・割当・スコープ・見積の深さ)」という**コミット判断**は人間に委ねる。これは曖昧さではなく役割分担であり、構造は厳密に固定され、コミットは P0 に従って人間が担う。
*The model fixes STRUCTURE (what can be represented); COMMITMENT decisions (granularity, assignment, scope, estimation depth) are delegated to humans under P0. This is division of labor, not vagueness.*
*Four commitment-bearing decisions are never automated: estimate agreement, assignment, scope/deadline calls, and planning precision (estimation depth). These are the deliberate loci where scarce human judgment is spent.*

### 2.2 見積 = 合意状態を持つ提案 / Estimate = Agreement-Bearing Proposal
- 見積はボトムアップで形成され**常に変動しうる**。人間・AI・過去実績・FP 法など出所を問わず同格の**提案**。
- 各見積は状態機械 `proposed → agreed` を持ち、**`agreed` への遷移は人間のみ**(A5)。
- **合意の粒度はタスク/feature ノード単位**。配下チェック項目は AI が提案・積み上げ、ノードの合意で一括確定(cc-sdd "tasks approved" ゲートと一致、人間のボトルネック化を回避)。
- 見積は**最新値**(EVM 用)と**理由付き凍結値**(説明責任用)を持つ。

### 2.3 一様な見積 / Uniform Estimation
すべての見積は**同型の営み**である:**前段の成果物をインプットとし、人間と AI が擦り合わせ、人間が合意する**(`proposed → agreed`)。見積の種類による区別(「アンカー」対「導出」など)は無い。
- 連鎖:`est(req) → req → est(design) → design → est(tasks) → tasks → est(impl) → impl群`。各作業フェーズは、その工数を見積もる est ノードに先行される。
- インプット:est(req) は roadmap/brief など**プロジェクト外部の所与**を、est(design) は requirements を、est(tasks) は design を、est(impl) は **tasks.md** を入力とする。
- **est(impl) は tasks ノードとは別個のノード**である。tasks ノードは「タスク分解という作業」、est(impl) は「tasks.md を入力に実装を見積もる作業」で、両者は別。実装見積を decompose に内包させない。
- これらは cc-sdd への**明示的拡張**(cc-sdd 自体は見積ステップを規定しない)。

**無限後退の底(二つの後退をともに閉じる):**
1. **入力の後退** — 見積の入力を遡ると roadmap/brief というプロジェクト外部の所与に接地して止まる。
2. **工数の後退** — est ノード自身も作業なので工数を持つ。これを見積もるか否かは**案件の軽重に応じた人間の判断**(P0)である:重い見積作業(数MD規模)は独立ノードとして見積もり PV に含め、軽微なもの(軽微なエンハンス・修正等)はその場で置いて畳む。後退は、人間が「これ以上見積もる価値がない」と判断して止める——**規則による底打ちではなく、実務上の判断による停止**。
   この停止は**空虚な「何でも人間任せ」ではない**:後退の各段で、AI が前段の所与(roadmap/brief→requirements→…)を入力に見積案を**提案**し、人間はその提案を見て一段で合意するか更に分けるかを判断する。ここで二つの後退は**性質が異なる**:**入力の後退(後退1)は外部所与に構造的に接地して止まる**(これは構造が強制する)。一方**工数の後退(深さ)の停止は構造が強制するのではなく、AI 提案を見た人間の判断で有限化される**——AI が接地した入力から具体的に提案するので判断は実質的(空虚でない)だが、停止性を構造で「保証」するとまでは主張しない。経験的には深さは 0〜1 段で収束する(規範でなく観測)。

**生成順とカバレッジの動き:**
tasks 完了 → feature を主語とする decompose が実装ノードを**未見積のまま誕生**させる(既知ツリーが増え、**カバレッジが低下** = 「未見積の作業を発見した」)→ est(impl) が tasks.md を入力に見積を産み(decompose で記録)→ 人間が合意(**カバレッジ回復**、EV の分母が拡張)。見積という営みが、カバレッジの増減として可視化される。

*All estimates share one shape: take the prior artifact as input, human+AI reconcile, human agrees. est(impl) is a separate node after tasks (input = tasks.md), not internal to decompose. Regress is closed twice: inputs ground in external givens (roadmap/brief); estimation-activity effort is bounded and cost-recorded, not recursively spiked. Birth of impl nodes drops coverage; est(impl) agreement recovers it — estimation made visible as coverage movement.*

### 2.4 割当 = 人間が与える入力 / Assignment = a Human-Provided Input
- タスクは要求スキルを持たず、要員はスキルを持たない。**誰がどのタスクをやるかは人間が外から与える**。
- 割当は**作業に入るライフサイクル遷移の被割当者として記録**される(`pending→ready` や `→implementing` の `transition` が assignee を名指す)。計画のため**事前の暫定割当**も同じ仕組みで設定できる。暫定割当の**変更**は、ログを書き換えず、被割当者を改めて名指す `transition` を追記して行う(append-only。`(ts,id)` 順で最新の名指しが現行の割当)。開始時の確定も同じく最新の名指しで表れる。第5イベントは不要。
- エージェントは自明に自己割当(任意のエージェントがエージェントタスクを実行)。人間は明示的に名指す。
- 割当のないタスクは**可視のギャップ**(未割当バックログ)として現れ、スケジュールに載らない。

### 2.5 状態語彙と `implemented` の意味 / State Vocabulary and the Meaning of `implemented`
- task 層の状態機械(例):`pending → ready → implementing → implemented → accepted`(+ 終端 `cancelled`)。
- **`implemented` の意味を確定する:`implemented` ≔ 実装完了 ∧ 仕様FIX。** すなわち「実装をやり切った結果、仕様の欠陥による design 差し戻しはもう起きないと**判定した**」状態。これは規約上の**判定であって保証ではない**:判定が誤っていれば到達後にも仕様は動きうる。その事象を P5 は「仕様FIX判定の誤り」という異常として警告対象に扱う(だからこそ P5 は到達前/後で後退遷移の意味を分ける)。R-D2 既定で `implemented` を閾値に解放された後続も、この異常時には P5 により at-risk として警告される。
- `implemented → accepted` の遷移は**人間による成果物の品質確認**(task 層ではコードレビュー、フェーズノードでは成果物レビュー。例:req の「要件承認」§2.6)であり、仕様を動かさない。
- この意味確定により、後続タスクが依存する情報(確定した仕様)は `implemented` 到達時に揃う(ただし上記のとおり仕様FIX は判定であり、誤判定なら後から動きうる。その異常は P5 が警告し、解放済み後続は at-risk となる)。

### 2.6 フェーズもノードである / Phases are Nodes Too
cc-sdd の requirements/design/tasks は、feature の**子ノード**として表す。各フェーズ・ノードは task 層と同じ lifecycle 状態機械を再利用する(新状態は不要)。
- 木(所属):`feature ─┬ req ├ design ├ tasks └ 実装タスク群`。フェーズと実装タスクは feature の子として同列。
- DAG(論理依存):`req → design → tasks`、および `design → 実装タスク`。木は所属、DAG は論理依存を表し、両者を混同しない。
- **「requirements 承認」= req ノードの `implemented→accepted`(actor=human)。** 仕様作業がそのまま進捗(EV)に乗るので、「仕様を書くのも進捗」が正確に実現する。
- **二段 decompose:** ① 立ち上げ時、feature が decompose でフェーズ・ノードを生む。② tasks ノードが `accepted` に達したことを契機に、**feature を主語とする** decompose が実装タスク群を feature の子として生む(tasks ノードは分解作業を表す兄弟であり、実装タスクの親ではない)。decompose の**主語**(誰の子を作るか)は feature、**契機**(何が先行するか)は tasks ノードの完了であり、両者は別。

### 2.7 supersede:エンハンスによる既存変更 / Supersede: Modifying Completed Work
エンハンス(追加要件)は **root 直下の新しい feature ノード**として立て、独自の req→design→tasks→実装サイクルを回す。既存 feature の確定履歴は汚さない。
- エンハンスが既存の完了ノードを**変更**する場合、当該ノードを後退遷移で再オープンしない(後退遷移は却下=失敗の意味で、P5 のスラッシュ信号を汚すため)。
- 代わりに**新ノードを立て、`新ノード →(supersede)→ 旧ノード` の置換辺**を張る。旧ノードは accepted のまま不変(append-only の精神)。
- supersede は新イベントではなく、`relate` が張る**辺の種別**(依存 / 置換)の一つ。依存辺は時間制約で `ready` 判定に使い、置換辺は価値・履歴関係で `ready` 判定には使わない。
- 旧ノードの EV_abs(出来高)は過去の事実として不変(二重計上ではなく、実際に二回働いたことの正直な反映)。**supersede は cancelled とは異なる**:cancelled は active basis から除外される(R-C2)が、**supersede された旧ノードは累積出来高 EV_abs の basis に残る**(働いた事実は消えない)。
- したがって二つの読みを**明示的に分離**する(R-S5):**累積稼得**(EV_abs、supersede 済みを含む過去の総出来高)と、**現行進捗**(現行有効集合=supersede されていない葉だけで測る達成率 EV%)。長寿命プロジェクトで累積 EV_abs が履歴とともに膨らんでも、現行進捗は現行有効集合で読むため希釈されない。**カバレッジ(P2)と対で読むのは現行進捗(現行有効集合の EV%)**であり、累積稼得 EV_abs は基底が異なるため coverage と独立に読む。ダッシュボードはこれらを区別表示する。

### 2.8 4イベント / The Four Events
| event | 意味 / meaning |
|---|---|
| `transition` | 状態機械上の遷移。ノードのライフサイクル、見積の `proposed→agreed` 合意、作業開始時の**被割当者の名指し**を担う。対象状態機械を明示(I5)。被割当者・ベースライン凍結属性(予算/スロット;§3)等の付帯データを属性として載せうる(状態機械の一部ではない凍結記録) |
| `decompose` | ノードの子と見積を設定/改訂(提案・再ベースライン、理由必須) |
| `relate` | DAG 辺の追加/削除。辺は**種別**(依存 / 置換=supersede)と、依存辺には**充足ポリシー**を持つ |
| `cost` | 実コストを計上(加算、id で dedup) |

### 2.9 不変条件 / Invariants
- **I1 見積整合:** 親の最新見積 = Σ(**合意済みの**子の最新見積)(原始的見積は葉のみ)。未見積で誕生した子(例:tasks 完了で生まれた直後の実装ノード)は est(impl) 合意までこの Σ から除外され、その不足は**カバレッジ低下**として可視化される(§2.3)。整合は「合意済みの領域」で常に成立し、未見積の窓は破れではなくギャップとして現れる。
- **I2 非循環:** 循環を生む `relate` は拒否。依存辺・置換辺(supersede)の**全種別**を対象とする。
- **I3 大域順序:** event id は大域ソート可能、`(ts,id)` で決定的マージ。
- **I4 完了施錠:** 完了サブ単位のベースライン寄与(予算・スロット)は完了時点で**施錠**され、以後の再ベースラインを受け付けない(初期確定契機と詳細は §3 導出指標。完了は新値の付与でなく施錠)。
- **I5 遷移の被指示性:** すべての `transition` は対象状態機械を明示する。
- **I6 合意権限:** `proposed→agreed` の行為者は `human`。

（旧 v9 の「I7 置換の向き」は R-D7 と I2 に吸収し、不変条件から降格した〔v9→v10、最小性〕。）

---

## 3. 原理(定理)/ Principles (Derived)

**P0 — コミット領域のみを語る / Speak Only of the Committed Region.**(メタ原理 §2.1 の測定面)
導出メトリクスは**コミット済みの領域**についてのみ語り、未コミット領域は常に**可視のギャップ**として示し、決して暗黙に仮定しない。
- EV は**合意済み見積**の領域のみを語る → 残りは**見積カバレッジ**として可視化。
- スケジュールは**割当済み**タスクのみを語る → 残りは**割当カバレッジ**(未割当バックログ)として可視化。
EV(進捗の軸)とスケジュール(時間の軸)は直交し、各々独立のコミット領域を持つ(あるタスクは合意済みだが未割当でありうる)。
*Derived metrics speak only of the committed region; the uncommitted region is always a visible gap. EV's committed region (agreed estimates) and the schedule's (assigned tasks) are orthogonal.*

**P1 — EV は合意済みのみ、絶対量と達成率の二形.**
**絶対出来高** `EV_abs(node) = Σ(完了サブ単位の凍結見積=ベースライン予算)`(単位はアテンション時間 MD;§3 導出指標の定義を参照)。**達成率** `EV%(node) = EV_abs / Σ(合意済みサブ単位の最新見積) ∈ [0,1]`。葉では tasks.md チェック項目の見積消化。重みテーブルなし。完了サブ単位は必ず合意(`agreed`)を経て完了するため EV_abs は合意済み領域に収まり、EV% ≤ 1 が保たれる。**SPI/CPI/PV は絶対量**(EV_abs と同次元の PV/AC)で計算し、進捗の割合は EV% で読む(次元を混同しない)。**本書で無印の「EV」は EV%(達成率)を指す**;絶対量が要る箇所(SPI/CPI/累積稼得・R-S3)は EV_abs と明記する。
*EV has two forms over the agreed-only basis: absolute earned EV_abs = Σ(completed frozen) in attention-time, and achievement EV% = EV_abs / Σ(agreed latest) ∈ [0,1]. Completed sub-units are always `agreed` first, so EV_abs stays within the agreed region and EV% ≤ 1. SPI/CPI/PV use the absolute EV_abs (same dimension as PV/AC); progress percentage uses EV%. Bare "EV" in this document means EV%; places needing the absolute (SPI/CPI/cumulative-earned/R-S3) say EV_abs. No weight table.*

**P2 — 見積カバレッジ.**(EV と必ず対で読む)
`coverage = Σ(合意済み見積ノード) / Σ(既知ツリーの全ノード)`。**既知ツリーのみを測り、未発見作業は原理的に測れない。** カバレッジは**現行有効集合**の既知ツリーで測り、supersede 済み旧ノードを分母に二重計上しない(累積稼得 EV_abs とは別)。低カバレッジ時の EV% は「霧の中の既知部分の達成度」にすぎない。
*Coverage measures the known tree only; undiscovered work is unmeasurable. EV is always read paired with coverage.*

**P3 — AC は同型に集約.** `AC(node) = 自ノードの cost + Σ AC(children)`。行為者に帰属。

**P4 — 三キューは同一クエリ.** エージェント作業キュー/人間レビューキューは、同一 DAG×ログへの actor フィルタ違い。

**P5 — EV の非単調性は三因の正直な信号.**(意図的逸脱)
(a) 後退遷移、(b) 上方再見積、(c) 新規合意見積の算入。いずれも発見・手戻りを EV に正直に映す。EV の信頼性はカバレッジに従属。
なお後退遷移は `implemented`(=仕様FIX)到達の**前後で意味が異なる**:到達前の design 差し戻しは正常な開発フロー、到達後の差し戻しは「仕様FIX判定の誤り」という異常であり、後者こそ後続を at-risk として警告すべき真の対象である。
*EV may fall from backward transitions, upward re-estimation, or newly-agreed estimates; all honest. A backward transition before `implemented` is normal flow; after it is an anomaly (mis-certified spec-fix) and is the true target of the at-risk warning.*

**P6 — 滞留時間 ≠ コスト.** ts 差はリードタイム。コストは `cost` のみ。

**P7 — スケジュールは人間接点が律速・割当尊重.**(A4+A5)
スケジュールは、人間が与えた割当のもとでの 1.0MD 平準化として導出。エージェント作業は平準化対象外でスラックを持たず、人間接点の間隙を埋める。クリティカルパスは人間タスクの連鎖。
*Schedule = 1.0MD leveling over human-given assignments; agent work fills gaps; critical path is human-anchored.*

**P8 — スケジュールは発見的・増分的・非最適.** 平準化はイベント毎に増分再計算する実行可能解であり、最適解ではない。**最適解を追わない理由は計算複雑性にある**:資源制約付きスケジューリング/資源平準化の最適化は NP困難であり、最適解を多項式時間で求められない。これは「最適化を諦めて実行可能解で足りる」という設計選択を正当化するものであって、増分解そのものの多項式性を主張するものではない(増分解の計算可能性は実装上の別問題)。
*A feasible heuristic, recomputed incrementally; not optimal. NP-hardness of resource-constrained scheduling / resource leveling justifies NOT pursuing the optimum (accepting a feasible heuristic); it does not by itself claim the incremental solution is polynomial — that is a separate implementation concern.*

**導出指標の定義(EVM のベースライン)/ Derived indices (the EVM baseline).**
**ベースライン(PMB)は時間配分された予算であり、二つの契機で二次元が確定する。** ① **値(予算)**は見積ノードが `agreed` になった時、その**凍結見積値**(R-U7)で確定する。② **計画スロット(いつ完了予定か)**は、当該サブ単位が**初めてスケジュールに載った時**(初回の割当が付き P7 平準化に入った時)の完了予定で確定する。EVM の PMB は予算×スケジュールであり、時間配分にはスケジュールが要るので、スロットは合意時ではなく初回スケジュール載り時に決まる(「見積合意で PV が FIX」という直観は、**予算値**が合意で確定するという正しい部分を、スロット次元まで精密化したものである)。
**確定の機構(正直な記述・第5〜7ラウンドの是正):** ベースラインの二次元は、確定の契機に**ログへ凍結記録される**——値は合意 `transition` の属性、スロットは初回スケジュール載せの `transition` の属性として(R-U7 が凍結見積値を記録するのと同型)。これは P7/P8 平準化の**再導出ではなく**、追記後は不変な**凍結属性**である。平準化は発見的・非決定的(P8)なので**どの完了予定が記録されるかはその一回の平準化に依存する**が、記録後はその値が正本として固定され以後動かない——非決定性を*除去*するのではなく*凍結*する(再生は同一ログ・同一実装に対してのみ保証)。新たな**イベント種別や可変状態は増やさない**(属性は既存イベントに載り、追記専用ゆえ不変;A2)。「合意時点で全部 FIX/凍結値だけで足りる/純導出で記録不要」という旧主張はいずれも不正確であり撤回する。確定後、暫定割当変更や supersede はベースラインを動かさない(生きた予測スケジュール P7/P8 だけが動く)。完了(I4)したサブ単位は値もスロットも施錠され、以後の再ベースラインを受け付けない。
**スロット凍結の契機(どの「初回スケジュール」を基準とするか)はコミット領域の選択(P0)。** 早期の暫定割当で凍結するか、より確度の高い着手(`→implementing`)時点で凍結するかは**プロジェクトの方針**であり、モデルは構造(初回スケジュール載せ `transition` に記録)を固定し、どの「初回」を基準とするかを人間に委ねる(辺ポリシー既定と同型)。早期に凍結した低情報スロットは理由付き再ベースラインで更新できる。
- **PV(t)** = ベースライン上その時点で完了予定のサブ単位の**ベースライン予算**総和(MD)。合意済みだが未スケジュール(未割当)のサブ単位はスロット未確定ゆえ PV に入らず、スケジュールに載った時点で PV に算入される(それまでは**可視のギャップ**;P0)。
- **EV_abs** = 完了サブ単位の**ベースライン予算**総和(=EVM の EV=完了作業の予算価値)。完了時(I4)に施錠された予算を用い、**PV と同一のベースライン予算次元(MD)を共有**する(予算の一致であって時間軸の一致ではない);完了後の再ベースラインは完了済みノードの PV・EV_abs をともに動かさない。再ベースラインが影響するのは**未完了**サブ単位のみ。
- **SPI = EV_abs / PV**、**CPI = EV_abs / AC**(予算次元 MD で揃う)。ただし PV は**スケジュール済み領域のみ**を覆うので、SPI はその領域内の進捗率であり、**未スケジュールの合意作業を含む全体の対計画進捗ではない**(標準 EVM の全 PMB 対比とは異なる)。ゆえに SPI は**スケジュール・カバレッジ**(合意済みのうちスケジュール済みの割合)と必ず対で読む——EV% を見積カバレッジと対で読むのと同じ規律(R-S6)。CPI(=EV_abs/AC)の AC は領域に依らず集計されるが、分子 EV_abs(完了のみ)と分母 AC(仕掛コスト含む;P6)は領域が非対称で、仕掛が多い時点では悲観側に振れる(標準 EVM と同じ性質)。
- **再ベースライン**は、R-U7 同型の**凍結属性の改訂**(理由必須)として明示的に行い、未完了サブ単位のベースライン**予算またはスロット**を動かす(暫定割当の付け替え・取り消しはベースラインを動かさず生きた予測 P7/P8 だけを動かす;ベースライン・スロットを引き直すには理由付き再ベースラインが要る)。最新値(latest)は予測(EAC 等)・達成率 EV%・カバレッジを駆動する。
- **凍結ベースライン(PV/SPI 用)と生きた予測スケジュール(P7/P8、割当・期日用に増分再計算)は別物**である(標準 EVM の PMB と EAC/forecast の分離)。
*The PMB is a time-phased budget whose two dimensions fix at two moments: (1) the value (budget) fixes at `agreed` (its R-U7 frozen value); (2) the planned slot fixes at first scheduling (first assignment puts it into P7 leveling). A PMB is budget×schedule and time-phasing needs a schedule, so the slot is set at first scheduling, not at agreement (the "PV fixes at agreement" intuition is right for the budget, refined here for the slot). Mechanism (honest, 5th–7th-round correction): both dimensions are FROZEN-RECORDED on the log at their fixing event — value on the agreement `transition`, slot on the first-scheduling `transition` — exactly as R-U7 records the frozen estimate value. They are NOT re-derivations of P7/P8 leveling; they are immutable recorded attributes, so even though leveling is heuristic/non-deterministic (P8), the recorded value is authoritative and reproducible. No new event kind or mutable state (attributes ride existing events, immutable once appended; A2). The earlier claims ("all fixed at agreement / value alone suffices / pure derivation, nothing recorded") were inaccurate and are retracted. After fixing, provisional-reassignment or supersede do not move the baseline (only the live forecast P7/P8 moves). A completed (I4) sub-unit locks both value and slot. PV(t) = baseline budget of sub-units planned complete by t; agreed-but-unscheduled sub-units have no slot and stay out of PV (a visible gap, P0) until scheduled. EV_abs uses the I4-locked budget, sharing PV's budget dimension. SPI/CPI below. The frozen baseline (PV/SPI) is distinct from the live forecast schedule (P7/P8) — the PMB-vs-EAC separation.*

---

## 4. 要件(EARS)/ Requirements (EARS)

### 4.0 ユビキタス / Ubiquitous

**R-U1.** The system shall treat the spec and its node decomposition as the single source of truth and represent every ticket as a projection of a node.
本システムは spec とそのノード分解を唯一の真実とし、あらゆるチケットをノードの射影として表現しなければならない。

**R-U2.** The system shall persist all state changes solely as append-only events of the four kinds and reject direct mutation of stored state.
本システムは全状態変化を4種の追記専用イベントとしてのみ永続化し、保存状態への直接変更を拒否しなければならない。

**R-U3.** The system shall represent every estimate as a proposal carrying a `proposed`/`agreed` state, regardless of its source.
本システムは出所を問わずあらゆる見積を `proposed`/`agreed` 状態を持つ提案として表現しなければならない。

**R-U4.** The system shall permit only a human actor to transition an estimate to `agreed`.
本システムは見積を `agreed` へ遷移させる行為を人間にのみ許可しなければならない。

**R-U5.** The system shall require human agreement at the task/feature node level, rolling up checklist-item estimates to be agreed en masse, aligned with the cc-sdd "tasks approved" gate.
本システムは人間の合意をタスク/feature ノード単位で要求し、配下チェック項目を一括合意として積み上げ、cc-sdd ゲートと一致させなければならない。

**R-U6.** The system shall not model human skills or proficiency, and shall treat task assignment as a human-provided input.
本システムは人間のスキルや習熟度をモデル化せず、タスク割当を人間が与える入力として扱わなければならない。

**R-U7.** The system shall record each estimate with a latest value for EVM and a reason-stamped frozen value for accountability, requiring a change reason on every frozen-value revision.
本システムは各見積を EVM 用最新値と説明責任用の理由付き凍結値で記録し、凍結値改訂毎に理由を必須としなければならない。

**R-U8.** The system shall derive achievement EV% at every level as EV_abs / Σ(agreed latest estimates) — where EV_abs = Σ(completed frozen estimates) — excluding un-agreed and un-estimated work, using no state-weight table.
本システムは達成率 EV% を全階層で「EV_abs ÷ 合意済み最新見積」(EV_abs = 完了凍結見積の総和)として導出し、未合意・未見積を除外し、重みテーブルを用いてはならない。

**R-U9.** The system shall present every derived metric as speaking only of its committed region and shall display the uncommitted region as a visible gap — estimate coverage for EV, and unassigned backlog for the schedule.
本システムは各導出メトリクスをそのコミット領域についてのみ語るものとして提示し、未コミット領域を可視のギャップ(EV には見積カバレッジ、スケジュールには未割当バックログ)として表示しなければならない。

**R-U10.** The system shall record actual cost in a single currency — human attention-time — and never fold it into EV.
本システムは実コストを人間アテンション時間の単一通貨で記録し、それを EV に混入させてはならない。

**R-U11.** The system shall subject only human resources to 1.0 MD/day leveling and leave agent resources unconstrained.
本システムは 1.0MD/日 平準化を人間資源にのみ適用し、エージェント資源を制約対象外としなければならない。

### 4.1 見積(一様)/ Estimation (Uniform)

**R-E1 (Event).** When any work phase (req, design, tasks, implementation) requires an estimate, the system shall represent the estimation as a node preceding that phase via a DAG edge, taking the prior phase's artifact as input (the first being fed by project-external givens such as roadmap or brief).
任意の作業フェーズ(req・design・tasks・実装)が見積を要するとき、本システムはその見積を、当該フェーズに DAG 辺で先行するノードとして表現し、前段フェーズの成果物を入力としなければならない(最初の見積は roadmap/brief 等のプロジェクト外部の所与を入力とする)。

**R-E1b (Ubiquitous).** The system shall treat the implementation estimate as a node distinct from the tasks node, taking tasks.md as input, and shall not fold the implementation estimate into a decompose.
本システムは実装見積を、tasks ノードとは別個の、tasks.md を入力とするノードとして扱い、実装見積を decompose に内包させてはならない。

**R-E2 (Event).** When an estimation node produces values, the system shall record them via `decompose`; when an estimate is agreed, the system shall record it via a `transition` of the estimate-agreement machine (actor=human).
見積ノードが値を産出したとき本システムは `decompose` で記録し、見積が合意されたとき見積合意機械の `transition`(actor=human)で記録しなければならない。

**R-E2b (Optional).** Where an estimation activity is itself substantial, the system shall allow it to be represented as a node — estimated and leveled into PV — and where it is light, allow it to be folded and recorded as a cost when incurred; the choice, and the depth of estimating an estimate, is a human commitment decision (P0), not a fixed rule.
見積活動自体が相応に重い場合、本システムはそれをノードとして表現し(見積もって PV に含める)、軽微な場合は畳んで発生時に cost として計上することを許可しなければならない。いずれにするか、および見積を見積もる深さは、規則ではなく人間のコミット判断(P0)である。

**R-E3 (Optional).** Where a node's spec is later fixed, the system shall allow re-estimation by any actor to update the latest value, preserving the frozen value and reason, with the new value returning to `proposed` until a human agrees.
ノードの仕様が後に確定する場合、本システムは任意の行為者による再見積を許可し、凍結値と理由を保持し、新値を人間合意まで `proposed` に戻さなければならない。

**R-E4 (Unwanted).** If remaining work grows or a newly-agreed estimate enters the basis, then the system shall allow EV to decrease and surface it as a discovery/scope-growth signal.
残作業が増える、または新規合意見積が basis に加わる場合、本システムは EV の低下を許容し発見/スコープ増大の信号として顕在化しなければならない。

### 4.2 進捗・状態 / Progress and State

**R-S1 (Event).** When a sub-unit is completed, the system shall freeze its estimate contribution as of completion.
サブ単位完了時、本システムはその見積寄与を完了時点で凍結しなければならない。

**R-S2 (Event).** When any event is appended, the system shall make the updated derived state — node states, EV% and EV_abs, estimate coverage, PV (baseline), AC, SPI, CPI, queues, live forecast schedule, unassigned backlog — available to all three dashboards from the same log. (A node's baseline budget fixes at agreement and its slot at first scheduling; neither moves thereafter except by explicit re-baseline of an incomplete node; the live forecast schedule is what recomputes per event.)
イベント追記時、本システムは更新後の導出状態(各ノード状態・EV%・EV_abs・見積カバレッジ・PV(ベースライン)・AC・SPI・CPI・各キュー・生きた予測スケジュール・未割当バックログ)を同一ログから三ダッシュボードへ提供しなければならない(各ノードのベースライン予算は合意時、スロットは初回スケジュール載り時に確定し、以後は未完了ノードの明示的な再ベースラインを除き動かない。イベント毎に再計算されるのは生きた予測スケジュールである)。

**R-S3 (Unwanted).** If a node's EV_abs (absolute earned) is non-increasing while its AC **continues to rise over a sustained window**, then the system shall flag the node as thrashing; a one-off cost from a folded estimation activity (R-E2b) landing without an estimate is expected and shall not by itself raise the flag.
ノードの EV_abs(絶対出来高)が増えない一方 AC が**継続的な期間にわたり**増え続ける場合、本システムはスラッシュとして警告しなければならない。畳んだ見積活動(R-E2b)が見積なしに一度だけ計上する cost は想定内であり、それ単独ではスラッシュとして警告してはならない。

**R-S4 (State).** While coverage is low, the system shall de-rate the interpretation of EV and not present it as project-wide completion.
カバレッジが低い間、本システムは EV の解釈を割り引き、全体完了度として提示してはならない。

**R-S5 (Ubiquitous).** The system shall derive and display the currently-effective set (leaves not superseded) distinctly from EV, so that work that was earned but later superseded is not misread as an active feature.
本システムは現行有効集合(supersede されていない葉)を EV とは区別して導出・表示し、出来高として計上されたが後に supersede された作業が、現行有効な機能と誤読されないようにしなければならない。

**R-S6 (State).** While schedule coverage (the share of agreed work that is scheduled) is low, the system shall de-rate SPI and not present it as whole-project schedule progress, surfacing the unscheduled-but-agreed work as a visible gap.
スケジュール・カバレッジ(合意済み作業のうちスケジュール済みの割合)が低い間、本システムは SPI の解釈を割り引き、全体の対計画進捗として提示してはならず、未スケジュールの合意作業を可視のギャップとして示さなければならない。スケジュール・カバレッジが構造的に低い(未割当バックログが恒常的に大きい)場合、SPI は恒久的にデレートされ、SPI ではなく未スケジュールのギャップが主たるスケジュール信号となる。

### 4.3 スケジュール・期日・割当 / Schedule, Deadline, Assignment

**R-T1 (Ubiquitous).** The system shall derive the schedule as a 1.0 MD-leveled, critical-path-priority heuristic over the human-provided assignments and the DAG, recomputed incrementally on each event.
本システムはスケジュールを、人間が与えた割当と DAG の上での 1.0MD 平準化・クリティカルパス優先の発見的解として導出し、イベント毎に増分再計算しなければならない(増分再計算は発見的・実行可能解の維持であって、毎回の大域最適化を要求しない;P8)。

**R-T2 (Ubiquitous).** The system shall display agent work as schedulable spans between human touchpoints even though agent work is not leveled.
本システムはエージェント作業を、平準化対象外でも人間接点間の実行可能スパンとして表示しなければならない。

**R-T3 (Unwanted).** If the human-provided assignment cannot fit 1.0 MD leveling for some person over some window, then the system shall raise an over-allocation alert identifying the person and window for the human to rebalance.
人間が与えた割当が、ある人物・ある期間で 1.0MD 平準化に収まらない場合、本システムは当該人物と期間を特定する過負荷アラートを発し、人間が再調整できるようにしなければならない。

**R-T4 (Unwanted).** If the derived schedule exceeds the external deadline, then the system shall alert only and not automatically add resources or cut scope; the human decides.
導出スケジュールが外部期日を超える場合、本システムはアラートのみを行い、要員追加やスコープ削除を自動で行ってはならない。判断は人間が行う。

**R-T5 (Event).** When a task is to be worked, the system shall record its assignee as a property of the lifecycle transition into the active state, and shall permit a provisional assignee to be set ahead of time for planning.
タスクが着手されるとき、本システムは被割当者を作業開始ライフサイクル遷移の属性として記録し、計画のため事前の暫定被割当者の設定を許可しなければならない。

### 4.4 スコープ変更 / Scope Change

**R-C1 (Event).** When a feature is withdrawn, the system shall emit a `transition` to terminal `cancelled` rather than deleting any event.
feature 取り下げ時、本システムはイベントを削除せず終端 `cancelled` への `transition` を発行しなければならない。

**R-C2 (Ubiquitous).** The system shall exclude cancelled nodes from the active basis and derive sunk EV_abs as the sum of earned value over cancelled-state nodes without storing it separately.
本システムは取り消しノードを稼働 basis から除外し、サンク EV_abs を取り消し状態ノードの出来高総和として別途保存せず導出しなければならない。

### 4.5 依存・整合 / Dependencies and Integrity

**R-D1 (Event).** When a node's predecessors satisfy that edge's threshold policy, the system shall mark the node `ready`.
先行群が辺の閾値ポリシーを満たしたとき、本システムは当該ノードを `ready` とマークしなければならない。

**R-D2 (Ubiquitous).** The system shall store the satisfaction threshold as a per-edge property and shall apply a default by edge type when unspecified: `accepted` for spec-phase edges (req→design→tasks), and `implemented` (= code-complete ∧ spec-fixed) for implementation-task edges — because a spec phase depends on human-accepted requirements while an implementation chain depends only on the fixed spec.
本システムは充足閾値を辺ごとの属性として保持し、未指定時は辺種別ごとの既定を適用しなければならない:仕様フェーズ辺(req→design→tasks)は `accepted`、実装タスク辺は `implemented`(=実装完了 ∧ 仕様FIX)。仕様フェーズは人間承認済みの要件に依存し、実装連鎖は確定した仕様にのみ依存するためである。

**R-D3 (Unwanted).** If a `relate` event would introduce a cycle, then the system shall reject it.
`relate` が循環を生む場合、本システムはこれを拒否しなければならない。

**R-D4 (Event).** When a node decomposes, the system shall treat each inbound edge as a **logical predicate over the children — "all leaves beneath the source satisfy the policy" — not as physically multiplied edges**, and retain each outbound edge at the node level. Predicate evaluation avoids combinatorial edge growth at scale.
ノード分解時、本システムは各流入辺を、子に対する**論理述語**(「源の配下の全葉がポリシーを満たす」)として扱い——物理的に辺を増殖させてはならない——各流出辺をノード水準で保持しなければならない。述語評価により大規模での辺の組合せ的増殖を避ける。

**R-D5 (Unwanted).** If two events share a timestamp, then the system shall order them deterministically by globally-sortable event id.
2イベントが同一時刻のとき、本システムは大域ソート可能 id で決定的に順序付けしなければならない。

**R-D6 (Ubiquitous).** The system shall require every `transition` to name the state machine it advances.
本システムはすべての `transition` に対象状態機械の明示を要求しなければならない。

**R-D7 (Event).** When an enhancement modifies a completed node, the system shall represent the change as a new node plus a supersede edge from the new node to the old, shall keep the old node immutable, and shall not reopen it by backward transition. The supersede edge points new→old; its direction follows from the append-only generation order and its acyclicity is enforced by I2 (no separate invariant needed).
エンハンスが完了済みノードを変更するとき、本システムはその変更を新ノードと、新ノードから旧ノードへの supersede 辺として表現し、旧ノードを不変に保ち、後退遷移で再オープンしてはならない。supersede 辺の向きは新→旧であり、追記専用の生成順から一意に従う。その非循環は I2 が担保する(独立した不変条件は不要)。

---

## 5. 必要十分性の根拠 / Justification

**各イベントの必要性(反証の失敗):**
- `transition` — ライフサイクル・見積合意・割当の名指しを担う。除去不能。
- `decompose` — 親子・見積の設定/改訂・再ベースライン・スパイク完了。除去不能。
- `relate` — feature 横断の先行関係、辺ごとポリシー、および supersede(置換)関係。除去不能。
- `cost` — 遷移なき実装中の連続コスト(滞留時間では代替不能;P6)。除去不能。

**フェーズと supersede に新イベントは不要:** フェーズは feature の子ノードとして既存 lifecycle を再利用し、supersede は `relate` の辺種別として表す。4イベントで閉じる。

**十分性(検証の限界を明示):** 本書の全設計決定・二つの思考実験(フェーズ移行/エンハンス)・一様な見積モデルが、4イベント + 二重グラフ + 不変条件群で表現できることを確認した。これは**「複数ラウンドの独立敵対レビューで未処理ケースを検出しなかった」**という意味であって、「未処理ケースが原理的に残らない」ことの証明ではない(網羅性は帰納では証明できない。本モデル自身の P2「未発見は測れない」と一貫させ、過大主張を避ける)。フェーズ=ノード・supersede・一様な見積は新公理・新イベント・新状態を要さない。

**割当に第5イベントは不要:** 割当は「作業開始遷移の被割当者」として `transition` に載る(暫定割当も同じ)。4イベントで閉じる。

**意図的に持たないもの:**
- 審議過程 → `cause` が指す spec 文書の責務。
- 重み/留保率/能力(スキル・習熟度)→ 全廃。
- 三つの判断(見積合意・割当・スコープ/期日)の自動化 → 持たない(P0)。
- 未発見作業の測定 → 原理的に不能(P2)。

---

## 6. レビュー来歴 / Review Provenance

**v9→v10(独立敵対レビュー / moira-model-update スキル):** 著者自身が敵対者を兼ねた v1–v9 と異なり、利害のない独立した敵対者(moira-adversary)＋独立採点者(moira-gate-judge)が v9 を攻撃し、自己レビューが見落とした構造的綻びを是正した。主な是正:
- **金額通貨を撤去**(A6/R-U10):消費する UC が無く最小性に反したため、アテンション時間の単一通貨へ縮約。
- **I1 に未見積子の除外を明示**:実装ノード誕生〜est(impl) 合意の窓で I1 が破れて見えた点を、「合意済みの子のみ Σ、未見積はカバレッジ低下」として整合化。
- **`implemented` を判定であって保証でないと明確化**(§2.5):「実装完了∧仕様FIXは必然に同時」という断定が P5 の異常検知と矛盾していた点を是正。
- **supersede の累積/現行有効を分離**(§2.7/R-S5):supersede に cancelled(R-C2)相当の basis 規則が無かった点を、「累積稼得は basis 保持・現行進捗は現行有効集合」と明示。
- **暫定割当の上書き機序**(§2.4)・**R-D4 を述語評価と明示**・**R-S3 のスラッシュ誤発火を抑止**・**派生指標(PV/SPI/CPI)の定義追加と EVM ベースラインの明確化**(PMB は二次元:予算=合意時、計画スロット=初回スケジュール載り時に、それぞれ既存 `transition` の凍結属性として**ログへ記録**(R-U7 同型;純導出でなく記録ゆえ平準化の非決定性に依存しない)。完了で施錠。SPI は**スケジュール済み領域限定の部分集合指標**ゆえスケジュール・カバレッジ(R-S6)と対で読む。過剰主張〔合意時に全 FIX/純導出で記録不要/全 PMB 標準 SPI〕は撤回)・**P8 に NP困難の根拠**。
- **過剰な自己評価の撤回**:旧§6「6次元すべてで満点」と旧§7「すべて完了/完全に閉じた」は反証不能な自賛であり、本レビューが反例(上記是正項目)を生成したことで誤りと判明したため撤回。確定基準は「独立採点者の残存 Critical/Important = 0」とする。
独立敵対者が複数の構造的綻びを出した事実は、自己採点(v1–v9 の「満点」)だけでは見落としが残りうることを示している(自己採点が一般に無効という断定ではなく、独立採点が識別力を足すという経験的観察)。

（注:以下の各版の「計N ラウンド」は当時の**自己申告値**で、著者が敵対者を兼ねた自己レビューの反復回数を指す。独立に検証された値ではなく、v10 の確定基準＝独立採点者ゲートとは別物である。）

計16ラウンドの自己レビューを経た。v8→v9 の主要転換:
- **「見積の見積」を P0 に還元:** 規則による底打ち(v8 の R-E2b「有限 cost・再帰スパイク禁止」)を撤回。見積活動をノード化して PV に含めるか畳むか、どこまで深く見積もるかは、案件の軽重に応じた**人間のコミット判断**(P0 第4項)。無限後退は規則でなく実務判断で止まる。
- **誤った歴史的主張の撤回:** 「仕様駆動が見積コストの構造を変えた」は誤り。軽微な変更で見積の見積を省くのは従来からの実務。
- **構造とコミットの境界を明示:** モデルは構造(表現可能なもの)を固定し、コミット判断(粒度・割当・スコープ・見積の深さ)を人間に委ねる。これは曖昧さでなく役割分担。

計14ラウンドを経た。v7→v8 の主要転換:
- **見積を一様な営みに再定式化:** すべての見積(req/design/tasks/impl)は「前段の成果物を入力に、人間と AI が擦り合わせ、人間が合意」する同型の活動。「アンカー対導出」という二分(v7 起草時に私が誤って導入)を廃止。
- **実装見積を tasks とは別個の独立ノード化:** tasks=分解作業、est(impl)=tasks.md を入力に実装を見積もる作業。v7 の「実装見積は decompose に内包」を覆す。
- **無限後退を二重に閉じる:** 入力の後退は roadmap/brief 等の外部所与に接地、工数の後退は見積活動を有限 cost 計上として底打ち。
- **見積をカバレッジの動きとして可視化:** 実装ノード誕生でカバレッジ低下(未見積の発見)、est(impl) 合意で回復。

計12ラウンドの敵対的内部レビューを経た。v6→v7 の主要転換(二つの思考実験の反映):
0a. **フェーズ=ノード:** requirements/design/tasks を feature の子ノードとし、既存 lifecycle を再利用。「requirements 承認」= req ノードの `implemented→accepted`。仕様作業がそのまま EV に乗る。木=所属、DAG=論理依存を分離。二段 decompose(feature→フェーズ、tasks 完了→実装タスク)。
0b. **supersede:** エンハンスは root 直下の新 feature。既存変更は後退遷移でなく新ノード + 置換辺(`relate` の辺種別)。旧ノード不変、EV_abs は過去の事実として保持。現行有効集合を区別表示(R-S5)。エンハンス(前進)と却下(後退)を意味論的に分離。
0c. **辺ポリシーを辺種別ごとの既定に一般化**(R-D2):仕様フェーズ辺=accepted、実装タスク辺=implemented。

参考:v5→v6 の主要転換:
1. **`implemented` の意味を確定:** 「実装完了 ∧ 仕様FIX」。実装し切った時点で仕様はもう動かない(両者は同時)。新状態の追加ではなく既存語彙の意味確定。
2. **辺ポリシーの既定値を `implemented` に確定**(R-D2)。後続が依存するのは確定した仕様であり、人間のコードレビューは後続をブロックしない。`accepted` は楽観が成り立たない特別な依存にだけ明示する。
3. **後退遷移の責務を鋭利化**(P5):`implemented` 到達前は正常、到達後は異常(仕様FIX誤判定)。at-risk 警告の真の対象が明確に。

この最終手は、状態の**意味**(時間軸=後続解放)を変えながら EV(価値軸)に一切触れない。木/DAG の二重グラフ分離が変更を局所化することの確証である。
*The final move changed a state's meaning (time axis) without touching EV (value axis), confirming that the tree/DAG separation localizes change.*

v3→v5 の転換(参考):重み・留保率・能力の全廃、見積の提案化と人間合意、コミット領域原理、割当の人間返却。

v1–v9 は著者自身による自己採点で「6次元満点」と称していたが、これは識別力を欠く自賛であり v10 で撤回した(独立敵対レビューが複数の綻びを検出した)。v10 の確定基準は**独立採点者(moira-gate-judge)による残存 Critical/Important = 0**であり、満点宣言ではない。
*The "10/10 on six dimensions" self-score of v1–v9 was a non-discriminating self-assessment, retracted in v10 (an independent adversary found real gaps). v10's bar is "zero surviving Critical/Important per an independent judge", not a perfect-score claim.*

---

## 7. 確認事項 / Open Items

「完全に閉じた」という宣言はしない(本モデル自身の P2「未発見は測れない」と一貫させる)。v10 確定までに独立敵対レビューが出した Critical/Important は、是正または明示的反証で決着させた。構造・語彙・既定値は実用上安定しており、次の段階として本モデルを前提とした具体的アーキテクチャの検討に進める。今後さらなる綻びが見つかれば、本書は moira-model-update スキルを通して追記的に更新される(追記専用の精神)。
*We do not declare the model "fully closed" (consistent with the model's own P2). As of v10, all Critical/Important findings from independent adversarial review are resolved. Structure, vocabulary, and defaults are practically stable; the next stage is concrete architecture. Further gaps, if found, are folded in via the moira-model-update skill (append-only).*
