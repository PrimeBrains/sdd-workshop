# 仕様駆動・チケット駆動・EVM 統合モデル v14
# Unified Model: Spec-Driven × Ticket-Driven × EVM (v14)

> 合言葉 / Motto: **必要かつ十分 (Necessary and Sufficient)**
>
> 本書はアーキテクチャ以前の「思想の確定」であり、実装技術には立ち入らない。
> v14 は、警告(R-U12/R-U13/R-T3/R-T4/R-S3/R-S6/R-S7/R-C3 および P5 の at-risk)の**持続と消滅の意味論**を §2.1 で明文化した版である。各警告は**現在の導出状態**に対する述語であり、条件が真である限り成立し、**条件を偽化する入力(4イベントの追記 または c の変更; R-S2)**が起きた時にのみ消える。人間が「見て受容し何もしない(イベント無し)」のは正当な**非コミット**だが警告を**消さない**(条件が真なら可視ギャップ P0 として残る;信号の隠蔽は §0/P0 に反する);**コミット(イベント)**だけが条件を偽化して消す(「acknowledge では消えず、commit で消える」)。本システムは acknowledge/dismiss/既読を**可変状態として持たない**(根拠は A2 でなく**最小性**;顕著さの制御は提示の責務だが、可視ギャップの会計から警告を除いてはならない=falsifiable な線)。主な修正: §2.1(警告持続メタ条項を新設)、R-U12(現行 latest-wins 値での判定・解消は agreed 再発行)、R-S7(「確認」=据え置き受容で標識を解除しない・消滅は再ベースラインか再収束のみ)、R-T4(受容は消さない・超過量を伴わせる)、P5(at-risk は現在状態で判定・implemented 再到達で消滅)、R-T3(c 変更も偽化トリガー・点事象は窓で消える)、§5(acknowledge 不在を意図的省略に追加)、§7#9(本件を解消として開示・S/N は提示責務・β 上位互換パスを開示)。新公理・新イベント・新状態・新**要件番号**・新原理番号は増やさず、既存条項の意味論明確化に留める。
> *v14 makes explicit, in §2.1, the persistence-and-clearing semantics of warnings (R-U12/R-U13/R-T3/R-T4/R-S3/R-S6/R-S7/R-C3 and P5's at-risk). Each warning is a predicate over the CURRENT derived state; it holds while its condition is true and clears only when an input falsifies that condition (a four-event append OR a c change; R-S2). A human who sees and accepts a warning but emits no event is making a legitimate NON-commitment that does NOT clear it (while true it persists as a visible gap, P0; hiding a true signal violates §0/P0); only a COMMITMENT (an event) clears it ("acknowledge does not clear; commit does"). The system holds NO acknowledge/dismiss/seen mutable state — on grounds of minimality, not A2; salience is presentation's job but no warning may be removed from the visible-gap accounting (falsifiable line). Key edits: §2.1 (new warning-persistence clause), R-U12 (judged on current latest-wins values; resolved by re-emitting an aligned agreed), R-S7 ("confirm" = keep-baseline non-commit that does not clear the flag; cleared only by re-baseline or re-convergence), R-T4 (acceptance does not clear; carry the overrun magnitude), P5 (at-risk judged on current state; cleared by re-reaching `implemented`), R-T3 (c change is also a falsifying trigger; point events age out of the window), §5 (acknowledge-absence added to intentional omissions), §7#9 (this item disclosed as resolved; S/N is presentation's responsibility; β upgrade path disclosed). No new axioms, events, states, requirement-numbers, or principle-numbers — existing clauses are clarified.*

---

## 0. 一文の定義 / One-Sentence Definition

**プロジェクトとは、見積を持つノードの木とポリシー付きの辺で結ばれた DAG の上を流れる4種の追記専用イベント列であり、進捗・スケジュール・健全性はすべてその導出である。システムは観測・導出・警告に徹し、コミットメントを伴う判断(見積の合意・割当・スコープ/期日の決定)は人間に残す。**

*A project is an append-only stream of four event kinds over a tree of estimated nodes and a policy-bearing DAG; progress, schedule, and health are all derivations. The system observes, derives, and warns; commitment-bearing decisions — estimate agreement, assignment, and scope/deadline calls — remain with humans.*

---

## 1. 公理 / Axioms

**A1 — 単一実体.** 存在するのは spec とその分解である**ノード**のみ。チケットは射影。
*The only entities are the spec and its nodes; tickets are projections.*

**A2 — 単一データ.** 唯一のデータは**追記専用イベントログ**。イベントは4種:`transition`/`decompose`/`relate`/`cost`。（ここで「データ」は**ノードのワークデータ**＝進捗・状態・スコープ・コストの単一真実源を指す。人間資源の構成入力 c〔A4〕は導出を駆動する別層で、自前の追記専用履歴を持つ〔R-U14〕；§5「二層データ」。）
*The only data is an append-only log of four event kinds. ("Data" here is the single source of NODE work data — progress, state, scope, cost. The human-resource configuration input c (A4) is a separate tier that drives derivation, with its own append-only history (R-U14); see §5 "two-tier data.")*

**A3 — ノードと二重グラフ.** ノードは見積を持ち状態機械上にある。木(価値集約)と DAG(時間制約、辺ごとに充足ポリシー)が重なる。
*Nodes hold estimates and sit on state machines; a value tree and a policy-bearing constraint DAG overlay them.*

**A4 — 単一希少資源.** 希少資源は**人間**のみ。各人間は**日次容量 c(i,d) ∈ [0, 1.0] MD/日**を持つ——暦日 d に当該プロジェクトへ投下できる時間量。c は人間が与える入力（§2.1 #5）であり、未指定日は **1.0MD/日**（後方互換）。各 c の改定は**理由付き**（契約・祝日・休暇・一時減 等）で記録する。c は当該プロジェクトへ投下できる**時間量**であり、能力（スキル・習熟度）ではない——**システムは人間の能力をモデル化しない**。それは日々成長し、伴走・教育という柔軟性で運用される領域であり、硬いルールで縛らない。承認点は cc-sdd ゲートに従う。
**契約レート α_i は導出 view:** 「その人の契約上の割当率」は、c のうち **reason=契約** に帰属する成分（暦・一時要因を除いて c が戻る値）として**導出**される。α_i は一級パラメータではなく報告・説明のための view であり、導出（P7/R-T3/§3/R-S7）は常に c を直接用いる（v13 で v12 の α_i スカラーを per-date の c に一般化した。「α と暦」の二因子分離は、どの導出も積 α×暦 しか参照せず冗長で、かつ圧縮勤務で a>1 を要求して破綻するため不採用）。
**c と AC の関係:** c は**計画上の容量上限**であり、AC（実績コスト）の記録を制約しない。AC は実際に費やしたアテンション時間を正直に記録する（A6）。c を超える AC が計上された場合（**c=0 の日に働いた場合を含む**）、R-T3 が過負荷として検知する。**c は slot 次元（いつ完了するか）に効き、予算の*総額*次元（見積 MD）には効かない**——c=0.5 の人が見積 5MD のタスクをやっても Σ予算は 5MD のまま（EV_abs・PV の総額は不変）、所要の実日数が伸びる。ただし **PV(t) の時間配分**（各時点でいくら計上されるか）は c が決める:所要が伸びれば完了予定が後ろにずれ PV カーブが後ろ倒しになる(これが c の存在意義＝time-phased PV の正直化)。
**c の定義域 [0, 1.0] の根拠:** 上限 1.0MD/日 は標準稼働日の容量を単位とする（A6）。残業等の一時超過は AC に正直に反映されるが、計画容量 c は標準稼働を上限とする——超過労働を計画に恒常的に織り込むことは P0（正直な計測）に反する。**c=0 は定義域内**——祝日・休暇・非稼働日は c=0 で表す（v12 の α_i スカラーが 0 を排除したのと対照的に、c は per-date ゆえ 0 を含む）。非一様な日次配分（曜日で容量が異なる。例: 月1.0・火0）も c(月)=1.0, c(火)=0 と表現でき、曜日差も per-date の c がそのまま表す（標準稼働日を超える真の圧縮勤務＝1日>1.0MD は計画 c でなく AC に出る；上記上限）。**恒久的にプロジェクトへ投下しない**人間は c=0 ではなく**割当解除（§2.4）**で表す——恒久離脱は未割当バックログとして可視化され（P0）、一時的不在（c=0）は割当を保ったままスケジュールに穴として現れる。両者は異なる事実であり、恒久/一時の境界は人間（P0）が引く（モデルは規定しない）。
**c の記録:** c はノードレベルのイベントログ（A2）とは異なる**プロジェクト構成入力**であり、4イベントのどれでもない（c は人間資源の属性であってノードの属性ではない；A1）。実装は c の変更履歴を理由付き・追記専用・タイムスタンプ付きで追跡可能に維持しなければならない（R-U14）。c の変更は P7 スケジュール再導出をトリガーする。
**複数プロジェクトへのまたがり:** c は単一プロジェクト視点で定義される。複数プロジェクトにわたる Σc の整合性は本モデルのスコープ外であり、組織レベルのリソース管理の責務である。
*The only scarce resource is humans. Each human has a **daily capacity c(i,d) ∈ [0, 1.0] MD/day** — the time investable in this project on calendar date d. c is a human-provided input (§2.1 #5); unspecified days default to 1.0MD/day (backward compatible). Each c revision is recorded with a reason (contract / holiday / leave / temporary-reduction …). c is the amount of time investable, NOT capability; the system does NOT model human capability (growth-oriented, run by mentoring flexibility, not hard rules).*
*The **contract rate α_i is a derived view**: the component of c attributable to reason=contract (the value c reverts to absent calendar/temporary factors). α_i is not a primitive parameter but a reporting view; derivations (P7/R-T3/§3/R-S7) always use c directly (v13 generalizes v12's scalar α_i into per-date c. The "rate × calendar" two-factor split is rejected: no derivation reads the factors apart — only the product — and it breaks on compressed schedules requiring a>1).*
*c is a planning capacity cap; it does NOT constrain AC. AC honestly records attention-time spent (A6). When AC exceeds c (including work on a c=0 day), R-T3 detects overload. **c affects the slot dimension (when work completes), not the budget TOTAL (estimate in MD)** — a c=0.5 person doing a 5MD task keeps Σbudget 5MD (EV_abs and PV totals unchanged); elapsed duration lengthens. But c does set PV(t)'s time-phasing (how much is planned at each t): a longer duration pushes planned completion later and shifts the PV curve — precisely c's purpose (honest time-phased PV). The domain [0, 1.0] caps at the standard workday (A6); overtime appears in AC, not c. **c=0 is in-domain** — holidays/leave/non-working days are c=0 (unlike v12's scalar α_i which excluded 0; c is per-date so includes 0). Non-uniform daily availability (e.g. c(Mon)=1.0, c(Tue)=0) and weekday-varying capacity are expressed directly by per-date c (true compressed work beyond a standard day — >1.0/day — appears in AC, not c; see the cap above). Permanent non-participation is expressed via unassignment (§2.4), NOT c=0 — permanent departure surfaces as unassigned backlog (P0), temporary absence (c=0) keeps the assignment and shows as a schedule gap; the permanent/temporary boundary is a human (P0) call, not modeled. c is a project configuration input distinct from the node-level event log (A2) and is none of the four events (c is an attribute of the human resource, not of a node; A1); implementations must maintain auditable, reason-stamped, append-only, timestamped change history (R-U14). c changes trigger P7 re-derivation. Cross-project Σc consistency is out of scope.*

**A5 — 三つの(非)対称.** 人間とエージェントは、**表現において対称**(同一ログ・同一の提案者役割)、**資源において非対称**(各人間の日次容量 c(i,d) を上限とする平準化対象は人間のみ、エージェントは遊休可)、**権限において非対称**(見積の確定=合意は人間のみ)。
*Symmetric in representation; asymmetric in resource (only humans leveled, each at their daily capacity c(i,d); agents idle-tolerant) and authority (only humans finalize estimates).*

**A6 — 単一通貨(アテンション時間).** 実コストは**人間アテンション時間**で記録する。希少資源は人間(A4)であり、コストの支配項は人間時間だからである。金額は本モデルの UC が要求しないため持たない(必要が生じれば cost の付帯情報として後付けできるが、一次の管理通貨はアテンション時間に一本化する)。
*Actual cost is recorded in a single currency: human attention-time. The scarce resource is humans (A4) and the dominant cost term is human time; money is not modeled because no use case here requires it (it can later ride as ancillary cost metadata if needed).*

> **導出を調整する裁量パラメータは存在しない。** 重み・留保率・ready 閾値・スキルは、見積データ・ノード化・辺ごとのポリシー・人間判断へ還元され消滅した。c（各人間の日次容量; A4）は裁量的な調整値ではなく、雇用契約・組織的アサインメント・暦に基づく**外的事実**の入力であり、ここで廃止されたパラメータ群には含まれない。
> *No discretionary tuning parameters. Weights, reserve, ready-threshold, and skills all dissolved into estimates, node structure, per-edge policy, and human judgment. c (each human's daily capacity; A4) is NOT a tuning parameter — it is an external fact input based on employment/organizational assignment and calendar, and is not among the dissolved knobs.*

---

## 2. 基本構造 / Core Structures

### 2.1 メタ原理:システムは警告し、人間が決める / Meta-Principle: System Warns, Human Commits
コミットメントを伴う判断は、システムが自動化せず、必ず人間が行う。システムは観測・導出・警告に徹する。
1. **見積の合意** — AI が提案、人間が確定(A5)。
2. **割当** — 誰がどのタスクをやるかは人間が決める(§2.4)。
3. **スコープ/期日の決定** — 期日超過時、要員追加か機能削減かは人間が決める(R-T4)。
4. **計画の精度(見積の深さ)** — 見積をどこまで見積もるか、ノード化するか畳むかは人間が決める(§2.3, R-E2b)。
5. **人間ごとの容量 c の宣言（契約割当）** — 各人間が当該プロジェクトへ投下できる容量 c を人間が与える(A4)。コミット判断にあたるのは c の**契約割当**の改定（reason=契約）——「この人を 0.5 で割り当てる」という組織的決定であり、契約レート α_i はその成分の*読み出し view*（人間が与えるのは c であって α_i ではない）。暦由来の改定（祝日は外的事実、休暇は本人/組織の予定）は可用性の入力であり、ここでの希少な「コミット判断」は契約割当の決定を指す。

これらは「人間の能力という、日々変わり柔軟性で回っている領域」をルールで殺さないための設計であり、希少資源たる人間判断を**意図的に投下する点**である。

**警告は持続する導出であり、acknowledge 状態を持たない(非コミットの正直な帰結).**
本システムの警告(R-U12/R-U13/R-T3/R-T4/R-S3/R-S6/R-S7/R-C3 および P5 の at-risk)はすべて**現在の導出状態**に対する述語であり、イベント追記時および構成入力 c の変更時(R-S2)に再評価される。各警告は**その条件が現在真である限り**成立し、**条件を偽化する入力(4イベントの追記 または c の変更)**が起きた時にのみ消える(歴史的事実そのものではなく現在状態で判定する——例: R-U12 は「現行 latest-wins の agreed 値が actor 間で食い違う」、P5 at-risk は「implemented 到達後に後退遷移があり、まだ implemented に再到達していない」)。
人間が警告を**見て受容し、何もしない(イベントを起こさない)ことは正当な非コミット**だが、それは条件を偽化しないため警告を**消さない**——条件が真なら警告は可視のギャップ(P0)として残るのが正直である(§0/P0。条件が依然真なのに信号を隠す dismiss/snooze は、true positive を隠蔽してアラート疲れと誤った安心を招く反パターンであり、§0/P0 に反する)。一方、人間が**コミット判断(合意・割当・スコープ/期日・再見積・再ベースライン・辺操作・キャンセル・c 宣言)を下すと、それは入力の追記**であり、条件を偽化して警告を消す。つまり「acknowledge(イベント無し)では消えず、commit(イベント)で消える」。
**本システムは acknowledge/dismiss/既読を可変状態として持たない。** その根拠は A2 ではなく**最小性**である(acknowledge はノードのワークデータでないため A2 が直接禁じるものではない——c と同様に別層たりうる——が、これを駆動する UC が現時点で無いため持たない;§5・§7 の β 上位互換パス)。警告の**顕著さ**の制御(「据え置き・既知」と「新規」の区別、淡色化・グループ化・並び替え)は**提示(presentation)の自由**だが、いかなる提示も警告を**導出状態と可視ギャップの会計から除いてはならない**(falsifiable な線: 会計・カウントから落とせば P0 違反。畳む・沈めるのは可、消すのは不可)。
*Warnings are persistent derivations with no acknowledge state. Every warning (R-U12/R-U13/R-T3/R-T4/R-S3/R-S6/R-S7/R-C3 and P5's at-risk) is a predicate over the CURRENT derived state, re-evaluated on event append and on c change (R-S2); it holds while its current condition is true and clears only when an input (a four-event append OR a c change) falsifies that condition — judged on current state, not the historical fact (e.g. R-U12 = "the current latest-wins agreed values diverge across actors"; P5 at-risk = "a backward transition occurred after `implemented` and `implemented` has not been re-reached"). A human who sees and accepts a warning but takes no action (emits no event) is making a legitimate NON-commitment; this does NOT clear the warning — while the condition is true it honestly persists as a visible gap (P0); hiding a still-true signal (dismiss/snooze) is the alert-fatigue anti-pattern and violates §0/P0. A human COMMITMENT (agree / assign / scope-deadline / re-estimate / re-baseline / edge op / cancel / declare c) is an input append and clears the warning by falsifying its condition. So: acknowledge (no event) does not clear; commit (event) does. The system holds NO acknowledge/dismiss/seen mutable state — on grounds of minimality, not A2 (acknowledge is not node work data, so A2 does not forbid it — like c it could be a separate tier — but no UC currently drives it; see §5 and §7's β upgrade path). Salience control (distinguishing "standing/known" from "new", collapsing, grouping, sorting) is presentation freedom, but no presentation may remove a warning from the derived state or the visible-gap accounting (falsifiable line: dropping it from the count violates P0; collapsing/de-emphasizing is fine, removing is not).*

**構造とコミットの境界:** モデルは「**何を表現できるか**(ノード・辺・イベント・導出)」という**構造**を確定する。一方「**どこまで踏み込むか**(分解の粒度・割当・スコープ・見積の深さ)」という**コミット判断**は人間に委ねる。これは曖昧さではなく役割分担であり、構造は厳密に固定され、コミットは P0 に従って人間が担う。
*The model fixes STRUCTURE (what can be represented); COMMITMENT decisions (granularity, assignment, scope, estimation depth) are delegated to humans under P0. This is division of labor, not vagueness.*
*Four commitment-bearing decisions are never automated: estimate agreement, assignment, scope/deadline calls, and planning precision (estimation depth). These are the deliberate loci where scarce human judgment is spent.*

**人間内部の権威はスコープ外.** 本モデルは合意の権威境界を「人間かエージェントか」(I6/R-U4)で引く。人間集合**内部**の権威・オーナーシップ(誰がリードか、誰が最終決定者か)は A4 の延長としてモデル化せず、運用(P0)に委ねる。同一ノードに複数の人間が矛盾する `agreed` を並行発行した場合、I3 `(ts,id)` latest-wins が現行値を機械的に決定するが、**システムは矛盾合意を異常として検知し警告する**(§0「観測・導出・警告に徹する」と一貫;R-U12)。解決は人間が行う。
*Human-internal authority is out of scope. The model draws the authority boundary at "human vs agent" (I6/R-U4). Authority WITHIN the human set (who leads, who is the final decision-maker) is not modeled, as an extension of A4, and is delegated to operations (P0). If multiple humans issue conflicting `agreed` on the same node, I3 `(ts,id)` latest-wins mechanically determines the current value, but the system detects and warns of the contradiction (consistent with §0 "observe, derive, warn"; R-U12). Resolution is by humans.*

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

**単一被割当者は意図的な仕様である.** 一タスクには一人の被割当者のみを持つ(latest-wins は置換であって追加ではない)。ペアリング/モブプログラミング(一作業単位への同時複数人)は消費する UC が無く(最小性 §5)、構造としてモデル化しない。cost 軸(P3)は複数 actor の帰属を表せるが、計画軸(割当・平準化)は単一 assignee に一本化する——この非対称は設計どおりである。
*Single assignee per task is intentional (latest-wins replaces, not appends). Pairing/mobbing is structurally out of scope (no UC; minimality §5). The cost axis (P3) can attribute multiple actors; the planning axis is single-assignee by design — this asymmetry is intended.*

### 2.5 状態語彙と `implemented` の意味 / State Vocabulary and the Meaning of `implemented`
- task 層の状態機械(例):`pending → ready → implementing → implemented → accepted`(+ 終端 `cancelled`;**`cancelled` はいずれの非終端状態からも到達可能**——`accepted → cancelled` は feature 取り下げ(R-C1)を含む)。
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
- **supersede と cancel の競合:** ノードが supersede **された後に** `cancelled` へ遷移した場合、R-C2(cancelled は active basis から除外)が優先する——cancelled は終端であり、supersede の累積 basis 保持(本節)より強い。EV_abs は R-C2 に従いサンクとして導出される。supersede 辺自体は履歴として残る(append-only)。
*When a superseded node is later cancelled, R-C2 (exclusion from active basis) takes priority — terminal cancelled overrides the supersede cumulative-basis rule. EV_abs is derived as sunk per R-C2. The supersede edge remains as history (append-only).*

**supersede 元のキャンセルによる旧ノードの復帰:** supersede 辺の**新ノード(源)**が `cancelled` へ遷移した場合、当該 supersede 辺は現行有効集合の導出で**不活性**となる(R-S5 導出規則)——置換が取り消されたため、旧ノードは被 supersede を脱し現行有効集合に復帰する。supersede 辺自体はログに残る(append-only)。EV_abs の扱い:新ノードの出来高は R-C2 によりサンクとなり、旧ノードの出来高は累積 basis に不変で残る(既に保持されている)。
*Restoration by cancellation of the superseding node: when the NEW node (source of the supersede edge) transitions to `cancelled`, the supersede edge becomes inert for currently-effective-set derivation (R-S5 derivation rule) — the old node re-enters the set because its replacement is no longer active. The supersede edge remains on the log (append-only). EV_abs: the new node's earned value becomes sunk per R-C2; the old node's earned value remains in the cumulative basis (already retained).*

### 2.8 4イベント / The Four Events
| event | 意味 / meaning |
|---|---|
| `transition` | 状態機械上の遷移。ノードのライフサイクル、見積の `proposed→agreed` 合意、作業開始時の**被割当者の名指し**を担う。対象状態機械を明示(I5)。被割当者・ベースライン凍結属性(予算/スロット;§3)等の付帯データを属性として載せうる(状態機械の一部ではない凍結記録) |
| `decompose` | ノードの子と見積を設定/改訂(提案・再ベースライン、理由必須) |
| `relate` | DAG 辺の追加/削除。辺は**種別**(依存 / 置換=supersede)と、依存辺には**充足ポリシー**を持つ |
| `cost` | 実コストを計上(加算、id で dedup) |

### 2.9 不変条件 / Invariants
- **I1 見積整合:** 親の最新見積 = Σ(**合意済みの**子の最新見積)(原始的見積は葉のみ)。未見積で誕生した子(例:tasks 完了で生まれた直後の実装ノード)は est(impl) 合意までこの Σ から除外され、その不足は**カバレッジ低下**として可視化される(§2.3)。整合は「合意済みの領域」で常に成立し、未見積の窓は破れではなくギャップとして現れる。完了済みでも未合意のノードは本 Σ から除外される(R-U8/R-U13 参照)。
- **I2 非循環:** 循環を生む `relate` は拒否。依存辺・置換辺(supersede)の**全種別**を対象とする。
- **I3 大域順序:** event id は大域ソート可能、`(ts,id)` で決定的マージ。
- **I4 完了施錠:** 完了サブ単位のベースライン寄与は完了時点で**施錠**され、以後の再ベースラインを受け付けない。**ただし施錠対象は確定済みの次元のみ**:予算は合意済み(`agreed`)の場合のみ施錠され、スロットはスケジュール済みの場合のみ施錠される。未合意のまま完了した場合、予算次元は空であり I4 は空虚に成立する——その異常は R-U13 で警告される(初期確定契機と詳細は §3 導出指標。完了は新値の付与でなく施錠)。**完了済みノードに対して事後合意(`proposed→agreed`)が発行された場合、合意時点で予算次元が確定し I4 により即座に施錠される**(完了は既に成立しているため、確定と施錠は同時に発生する)。
- **I5 遷移の被指示性:** すべての `transition` は対象状態機械を明示する。
- **I6 合意権限:** `proposed→agreed` の行為者は `human`。複数の人間が同一ノードに矛盾する `agreed` を発行した場合、I3 `(ts,id)` latest-wins が現行値を機械的に決定する。**人間内部の権威裁定はスコープ外**(§2.1)。矛盾の検知と警告は R-U12 による。

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
**絶対出来高** `EV_abs(node) = Σ(完了サブ単位の凍結見積=ベースライン予算)`(単位はアテンション時間 MD;§3 導出指標の定義を参照)。**達成率** `EV%(node) = EV_abs / Σ(合意済みサブ単位の最新見積) ∈ [0,1]`。葉では tasks.md チェック項目の見積消化。重みテーブルなし。R-U8 により EV_abs は合意済みの完了サブ単位のみを算入するため、合意済み領域に収まり EV% ≤ 1 が保たれる(状態機械は合意ゲートを持たないため、未合意のまま完了に到達する経路は構造上存在する——その場合の EV_abs 除外は R-U8 が担保し、ベースラインの扱いは §3 導出指標の定義を参照;R-U13)。**SPI/CPI/PV は絶対量**(EV_abs と同次元の PV/AC)で計算し、進捗の割合は EV% で読む(次元を混同しない)。**本書で無印の「EV」は EV%(達成率)を指す**;絶対量が要る箇所(SPI/CPI/累積稼得・R-S3)は EV_abs と明記する。
*EV has two forms over the agreed-only basis: absolute earned EV_abs = Σ(completed frozen) in attention-time, and achievement EV% = EV_abs / Σ(agreed latest) ∈ [0,1]. R-U8 admits only agreed completed sub-units into EV_abs, so EV_abs stays within the agreed region and EV% ≤ 1 (the state machine has no agreement gate, so completing without agreement is structurally reachable — R-U8 handles the exclusion; baseline treatment is per §3 derived indices; R-U13). SPI/CPI/PV use the absolute EV_abs (same dimension as PV/AC); progress percentage uses EV%. Bare "EV" in this document means EV%; places needing the absolute (SPI/CPI/cumulative-earned/R-S3) say EV_abs. No weight table.*

**P2 — 見積カバレッジ.**(EV と必ず対で読む)
`coverage = Σ(合意済み見積ノード) / Σ(既知ツリーの全ノード)`。**既知ツリーのみを測り、未発見作業は原理的に測れない。** カバレッジは**現行有効集合**の既知ツリーで測り、supersede 済み旧ノードを分母に二重計上しない(累積稼得 EV_abs とは別)。低カバレッジ時の EV% は「霧の中の既知部分の達成度」にすぎない。
*Coverage measures the known tree only; undiscovered work is unmeasurable. EV is always read paired with coverage.*

**P3 — AC は同型に集約.** `AC(node) = 自ノードの cost + Σ AC(children)`。行為者に帰属。

**P4 — 三キューは同一クエリ.** エージェント作業キュー/人間レビューキューは、同一 DAG×ログへの actor フィルタ違い。

**P5 — EV の非単調性は三因の正直な信号.**(意図的逸脱)
(a) 後退遷移、(b) 上方再見積、(c) 新規合意見積の算入。いずれも発見・手戻りを EV に正直に映す。EV の信頼性はカバレッジに従属。
なお後退遷移は `implemented`(=仕様FIX)到達の**前後で意味が異なる**:到達前の design 差し戻しは正常な開発フロー、到達後の差し戻しは「仕様FIX判定の誤り」という異常であり、後者こそ後続を at-risk として警告すべき真の対象である。この at-risk 警告は**現在状態**で判定する:「当該ノードが implemented 到達後に後退し、まだ implemented(以降)に再到達していない」が真の間だけ成立し、再到達した時に偽化して消える(後続自身の完了では消えない——先行の誤判定が未解消のまま後続が進んだ事実は別の信号として残る)。§2.1 警告持続。
*EV may fall from backward transitions, upward re-estimation, or newly-agreed estimates; all honest. A backward transition before `implemented` is normal flow; after it is an anomaly (mis-certified spec-fix) and is the true target of the at-risk warning. The at-risk warning is judged on current state — "the node backslid after reaching `implemented` and has not re-reached `implemented`" — and clears when it re-reaches `implemented` (a successor's own completion does not clear it; §2.1 warning-persistence).*

**P6 — 滞留時間 ≠ コスト.** ts 差はリードタイム。コストは `cost` のみ。

**P7 — スケジュールは人間接点が律速・割当尊重.**(A4+A5)
スケジュールは、人間が与えた割当のもとでの **c 平準化**（各人間の日次容量 c(i,d) を上限とする資源制約。c=0 の日はその人の容量が無い）として導出。平準化は c(i,d) を消費して各サブ単位の完了予定スロットを定める（充填の具体ヒューリスティクスは実装依存; P8）。エージェント作業は平準化対象外でスラックを持たず、通常は人間接点の間隙を埋める。**ただしエージェントタスクが依存連鎖上で人間タスクを律速する場合(A→H)、A のリードタイム(P6)はクリティカルパス計算に算入される**——クリティカルパスは全依存連鎖のうち最長のパスであり、人間タスクは c 平準化（資源制約）の対象、エージェントタスクは非平準化だがリードタイム(P6)でパス長に寄与する。
*Schedule = **c leveling** (resource-constrained to each human's daily capacity c(i,d); a c=0 day means no capacity) over human-given assignments; leveling consumes c(i,d) to place each sub-unit's planned-completion slot (the fill heuristic is implementation-dependent; P8). Agent work fills gaps. However, when an agent task rate-limits a human task on the dependency chain (A→H), A's lead time (P6) enters the critical path — the critical path is the longest path through the full DAG — human tasks are c-leveled (resource-constrained), agent tasks are not leveled but contribute their lead time (P6) to path length.*

**P8 — スケジュールは発見的・増分的・非最適.** 平準化はイベント毎に増分再計算する実行可能解であり、最適解ではない。**最適解を追わない理由は計算複雑性にある**:資源制約付きスケジューリング/資源平準化の最適化は NP困難であり、最適解を多項式時間で求められない。これは「最適化を諦めて実行可能解で足りる」という設計選択を正当化するものであって、増分解そのものの多項式性を主張するものではない(増分解の計算可能性は実装上の別問題)。
*A feasible heuristic, recomputed incrementally; not optimal. NP-hardness of resource-constrained scheduling / resource leveling justifies NOT pursuing the optimum (accepting a feasible heuristic); it does not by itself claim the incremental solution is polynomial — that is a separate implementation concern.*

**凍結スロットの選定は実装に依存する:** 同一ログに対しても平準化の実装が異なれば異なるスロットが凍結されうる(§3「同一ログ・同一実装に対してのみ保証」はこれを正直に認めたもの)。PV→SPI の値はモデルが一意に定めるのではなく、モデルが規定する**構造**(凍結機構)と**実装**(平準化アルゴリズム)の組み合わせで定まる。この実装依存性は P8 の「非最適」の帰結であり、除去ではなく開示で対処する。
*Frozen-slot selection is implementation-dependent: the same log under different leveling implementations may freeze different slots (§3's "guaranteed only for the same log and same implementation" acknowledges this). PV→SPI values are determined by the combination of MODEL-specified STRUCTURE (freezing mechanism) and IMPLEMENTATION (leveling algorithm). This implementation-dependence is a consequence of P8's "non-optimal" stance and is addressed by disclosure, not removal.*

**導出指標の定義(EVM のベースライン)/ Derived indices (the EVM baseline).**
**ベースライン(PMB)は時間配分された予算であり、二つの契機で二次元が確定する。** ① **値(予算)**は見積ノードが `agreed` になった時、その**凍結見積値**(R-U7)で確定する。② **計画スロット(いつ完了予定か)**は、当該サブ単位が**初めてスケジュールに載った時**(初回の割当が付き P7 平準化に入った時)の完了予定で確定する。EVM の PMB は予算×スケジュールであり、時間配分にはスケジュールが要るので、スロットは合意時ではなく初回スケジュール載り時に決まる(「見積合意で PV が FIX」という直観は、**予算値**が合意で確定するという正しい部分を、スロット次元まで精密化したものである)。
**確定の機構(正直な記述・第5〜7ラウンドの是正):** ベースラインの二次元は、確定の契機に**ログへ凍結記録される**——値は合意 `transition` の属性、スロットは初回スケジュール載せの `transition` の属性として(R-U7 が凍結見積値を記録するのと同型)。これは P7/P8 平準化の**再導出ではなく**、追記後は不変な**凍結属性**である。平準化は発見的・非決定的(P8)なので**どの完了予定が記録されるかはその一回の平準化に依存する**が、記録後はその値が正本として固定され以後動かない——非決定性を*除去*するのではなく*凍結*する(再生は同一ログ・同一実装に対してのみ保証)。新たな**イベント種別や可変状態は増やさない**(属性は既存イベントに載り、追記専用ゆえ不変;A2)。「合意時点で全部 FIX/凍結値だけで足りる/純導出で記録不要」という旧主張はいずれも不正確であり撤回する。確定後、暫定割当変更や supersede はベースラインを動かさない(生きた予測スケジュール P7/P8 だけが動く)。完了(I4)したサブ単位は**確定済みの次元が施錠**され(予算は合意済みの場合のみ、スロットはスケジュール済みの場合のみ;I4)、以後の再ベースラインを受け付けない。
**スロット凍結の契機(どの「初回スケジュール」を基準とするか)はコミット領域の選択(P0)。** 早期の暫定割当で凍結するか、より確度の高い着手(`→implementing`)時点で凍結するかは**プロジェクトの方針**であり、モデルは構造(初回スケジュール載せ `transition` に記録)を固定し、どの「初回」を基準とするかを人間に委ねる(辺ポリシー既定と同型)。早期に凍結した低情報スロットは理由付き再ベースラインで更新できる。**凍結スロットは凍結時点の容量 c(i,d) を織り込んだ完了予定であり、以後の c 変更で遡及的には動かない(凍結の本義)。後の c 変更が生きた予測の完了をスロットから乖離させた場合は、再ベースラインではなく R-S7 の陳腐化標識として現れる。**
- **PV(t)** = ベースライン上その時点で完了予定のサブ単位の**ベースライン予算**総和(MD)。合意済みだが未スケジュール(未割当)のサブ単位はスロット未確定ゆえ PV に入らず、スケジュールに載った時点で PV に算入される(それまでは**可視のギャップ**;P0)。PV のスロットは P7 が c(i,d) を消費して置くため、**c=0 の日には計画作業が載らない**(暦の穴が PV に反映される)。**完了したがスケジュールに一度も載らなかったサブ単位(c=0 の日にのみ働いて完了した場合を含む)**は、EV_abs(完了予算)には載るがスロット未凍結ゆえ PV には載らない——「合意済み・未スケジュール完了」であり(「スケジュール済み・未合意」の逆ケース)、スケジュール・カバレッジ低下として R-S6 が SPI をデレートして可視化する(分子 EV_abs と分母 PV の領域非対称は本節末尾の CPI と同型)。
- **スケジュール済み・未合意ノード(半凍結ベースライン)の扱い:** 割当済み(スロット凍結)だが未合意(予算未確定)のサブ単位は、**PV に算入しない**——PV の被加算項はベースライン予算(合意時の凍結値)であり、未合意ノードは予算を持たないため被加算項が存在しない。このノードが実スロットを消費する(生きた予測スケジュール P7/P8 に載る)事実と、PV に寄与しない事実との乖離は、**見積カバレッジの低下**(P2)として可視化される——「スケジュール済みだが未合意」は「スケジュールに載ったが EVM 的には未計画」という可視のギャップ(P0)である。SPI もこのノードを含まない(分子 EV_abs は R-U8 で除外、分母 PV も本節で除外)。合意時に予算が確定すれば PV に算入され、ギャップが閉じる。
*Scheduled-but-unagreed sub-units (slot frozen, budget not yet fixed) are excluded from PV — the addend is the baseline budget (the agreed frozen value), which does not exist for unagreed nodes. The gap between consuming a real schedule slot (live forecast P7/P8) and contributing nothing to PV is surfaced as reduced estimate coverage (P2) — "scheduled but unagreed" is a visible gap (P0) meaning "scheduled but not yet EVM-planned." SPI likewise excludes them (numerator by R-U8, denominator by this clause). Once agreed, the budget enters PV and the gap closes.*
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
(合意はノード一括だが、EV_abs 消化はチェック項目別(P1)、状態遷移はノード別(§2.5)である。一チェック項目が差し戻された場合、後退遷移はノード全体に適用され(チェック項目に個別の状態機械は無い)、EV_abs はノード単位で調整される。**これは粒度の設計上の非対称であり、項目層の状態機械を持たないことの帰結**である。項目層の精密な巻き戻しは構造コストが高く、ノード単位の後退が正直な信号(P5)として機能する。)
*(Agreement is node-batch; EV_abs consumption is per checklist-item (P1); transitions are per node (§2.5). If a checklist item is rejected, the backward transition applies to the whole node (no per-item state machine) and EV_abs adjusts at node level. This is a deliberate granularity asymmetry — a consequence of not maintaining per-item state machines. Node-level regression serves as an honest signal (P5).)*

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

**R-U11.** The system shall subject only human resources to **c(i,d) MD/day leveling** (each human's daily capacity; default 1.0MD/day on unspecified days) and leave agent resources unconstrained.
本システムは **c(i,d) MD/日 平準化**（各人間の日次容量; 未指定日 1.0MD/日）を人間資源にのみ適用し、エージェント資源を制約対象外としなければならない。

**R-U12 (Unwanted).** If two or more **distinct** human actors emit `proposed→agreed` transitions on the same estimate node with **differing frozen values**, then the system shall raise a **contradiction-agreement warning** identifying the conflicting actors and values. Detection is actor-based: different actors + different values = warning, regardless of temporal proximity. The system shall not auto-resolve; the human decides (P0). The latest-wins value (I3) remains the current value pending human resolution. Detection is over the CURRENT effective agreed values (each distinct actor's latest), not the mere historical existence of a past divergence: the warning clears when a human re-emits an `agreed` (a transition) whose frozen value aligns the current values across actors — leaving latest-wins in place without such an event is not a resolution, and the warning persists while the current divergence holds (§2.1 warning-persistence). No new event kind is required.
二人以上の**異なる**人間が同一見積ノードに**異なる凍結値**で `proposed→agreed` を発行した場合、本システムは**矛盾合意警告**を発し、競合する行為者と値を特定しなければならない。検知は行為者ベース:異なる行為者 + 異なる値 = 警告(時間的近接性は問わない)。自動解決はせず人間が決定する(P0)。人間の解決を待つ間、I3 latest-wins の値が現行値として扱われる。検知は**現行の有効な agreed 値**(各 actor の直近値)に対して行い、過去に矛盾が存在したという歴史的事実そのものではない:警告は、人間が現行値を actor 間で揃える凍結値で `agreed`(transition)を改めて発行した時に消える——そのイベント無しに latest-wins を放置することは解消ではなく、現行の矛盾が続く限り警告は残る(§2.1 警告持続)。新たなイベント種別は不要。

**R-U13 (Unwanted).** If a node reaches a completed state (`implemented` or `accepted`) while its estimate remains `proposed` (not `agreed`), the system shall raise an **unagreed-completion warning**. The node's EV_abs contribution remains excluded (R-U8) and its baseline budget remains unfixed (§3, I4); the warning prompts the human to re-estimate (R-E3) then retroactively agree, immediately agree, or cancel.
ノードが見積 `proposed`(未合意)のまま完了状態(`implemented` または `accepted`)に到達した場合、本システムは**未合意完了警告**を発しなければならない。当該ノードの EV_abs 寄与は除外のまま(R-U8)であり、ベースライン予算は未確定(§3, I4)である。警告は人間に**再見積(R-E3)を経た事後合意、即時事後合意、またはキャンセル**を促す。

**R-U14 (Ubiquitous).** The system shall maintain an auditable, reason-stamped change history of each human's daily capacity c(i,d) — the contract-rate view α_i being its reason=contract component — enabling reproducible schedule derivation (P7); point-in-time forecast reproduction requires the c values as-of that time (valid-time), which the history provides. c is a project configuration input distinct from the node-level event log (A2); its change history need not conform to the four event types but must be append-only and timestamped.
本システムは各人間の日次容量 c(i,d) の理由付き変更履歴を追跡可能に維持しなければならない（契約レート view α_i はその reason=契約 成分）——これによりスケジュール導出（P7）の再現性が**可能になる**（過去時点の予測再現には当該時点で有効だった c 値（valid-time）が要り、本履歴がそれを提供する。再現性の最終的担保は valid-time スナップショット保持に依存する; §7）。c はノードレベルのイベントログ（A2）とは異なるプロジェクト構成入力であり、その変更履歴は 4 イベント種別に準拠する必要はないが、追記専用かつタイムスタンプ付きでなければならない。

### 4.1 見積(一様)/ Estimation (Uniform)

**R-E1 (Event).** When any work phase (req, design, tasks, implementation) requires an estimate, the system shall represent the estimation as a node preceding that phase via a DAG edge, taking the prior phase's artifact as input (the first being fed by project-external givens such as roadmap or brief).
任意の作業フェーズ(req・design・tasks・実装)が見積を要するとき、本システムはその見積を、当該フェーズに DAG 辺で先行するノードとして表現し、前段フェーズの成果物を入力としなければならない(最初の見積は roadmap/brief 等のプロジェクト外部の所与を入力とする)。

**R-E1b (Ubiquitous).** The system shall treat the implementation estimate as a node distinct from the tasks node, taking tasks.md as input, and shall not fold the implementation estimate into a decompose.
本システムは実装見積を、tasks ノードとは別個の、tasks.md を入力とするノードとして扱い、実装見積を decompose に内包させてはならない。

**R-E2 (Event).** When an estimation node produces values, the system shall record them via `decompose`; when an estimate is agreed, the system shall record it via a `transition` of the estimate-agreement machine (actor=human).
見積ノードが値を産出したとき本システムは `decompose` で記録し、見積が合意されたとき見積合意機械の `transition`(actor=human)で記録しなければならない。

**R-E2b (Optional).** Where an estimation activity is itself substantial, the system shall allow it to be represented as a node — estimated and leveled into PV — and where it is light, allow it to be folded and recorded as a cost when incurred; the choice, and the depth of estimating an estimate, is a human commitment decision (P0), not a fixed rule.
見積活動自体が相応に重い場合、本システムはそれをノードとして表現し(見積もって PV に含める)、軽微な場合は畳んで発生時に cost として計上することを許可しなければならない。いずれにするか、および見積を見積もる深さは、規則ではなく人間のコミット判断(P0)である。
(ノード化と畳むの選択は CPI(=EV_abs/AC)の分子に影響する——ノード化すれば完了時に EV_abs に寄与し、畳めば AC のみに寄与する。この摂動は R-E2b が畳む対象を軽微な場合に限るため**抑制される**(ただし有界性の定量的保証はない)が、**異なるモデル化選択間の CPI の直接比較には注意を要する**。R-S3 は thrashing 誤発火を抑止するが、CPI 値の正規化は行わない。)
*(The node-vs-fold choice affects CPI numerator: nodized work contributes to EV_abs on completion; folded work contributes to AC only. R-E2b limits folding to light activities, suppressing (though without a quantitative bound) the perturbation, but direct CPI comparison across different modeling choices requires caution. R-S3 suppresses thrashing false positives but does not normalize CPI.)*

**R-E3 (Optional).** Where a node's spec is later fixed, the system shall allow re-estimation by any actor to update the latest value, preserving the frozen value and reason, with the new value returning to `proposed` until a human agrees.
ノードの仕様が後に確定する場合、本システムは任意の行為者による再見積を許可し、凍結値と理由を保持し、新値を人間合意まで `proposed` に戻さなければならない。

**R-E4 (Unwanted).** If remaining work grows or a newly-agreed estimate enters the basis, then the system shall allow EV to decrease and surface it as a discovery/scope-growth signal.
残作業が増える、または新規合意見積が basis に加わる場合、本システムは EV の低下を許容し発見/スコープ増大の信号として顕在化しなければならない。

### 4.2 進捗・状態 / Progress and State

**R-S1 (Event).** When a sub-unit is completed, the system shall freeze its estimate contribution as of completion.
サブ単位完了時、本システムはその見積寄与を完了時点で凍結しなければならない。

**R-S2 (Event).** When any event is appended, the system shall make the updated derived state — node states, EV% and EV_abs, estimate coverage, PV (baseline), AC, SPI, CPI, queues, live forecast schedule (including each sub-unit's predicted completion), unassigned backlog — available to all three dashboards from the same log. (A node's baseline budget fixes at agreement and its slot at first scheduling; neither moves thereafter except by explicit re-baseline of an incomplete node; the live forecast schedule is what recomputes. Re-derivation is triggered by event append AND by configuration-input (c) changes (A4), since c is not itself an event.)
イベント追記時、本システムは更新後の導出状態(各ノード状態・EV%・EV_abs・見積カバレッジ・PV(ベースライン)・AC・SPI・CPI・各キュー・生きた予測スケジュール〔各サブ単位の予測完了を含む〕・未割当バックログ)を同一ログから三ダッシュボードへ提供しなければならない(各ノードのベースライン予算は合意時、スロットは初回スケジュール載り時に確定し、以後は未完了ノードの明示的な再ベースラインを除き動かない。再計算されるのは生きた予測スケジュールであり、その契機はイベント追記に加え構成入力 c の変更(A4)でもある——c 自体はイベントではないため)。

**R-S3 (Unwanted).** If a node's EV_abs (absolute earned) is non-increasing while its AC **continues to rise over a sustained window**, then the system shall flag the node as thrashing; a one-off cost from a folded estimation activity (R-E2b) landing without an estimate is expected and shall not by itself raise the flag.
ノードの EV_abs(絶対出来高)が増えない一方 AC が**継続的な期間にわたり**増え続ける場合、本システムはスラッシュとして警告しなければならない。畳んだ見積活動(R-E2b)が見積なしに一度だけ計上する cost は想定内であり、それ単独ではスラッシュとして警告してはならない。

**R-S4 (State).** While coverage is low, the system shall de-rate the interpretation of EV and not present it as project-wide completion.
カバレッジが低い間、本システムは EV の解釈を割り引き、全体完了度として提示してはならない。

**R-S5 (Ubiquitous).** The system shall derive and display the currently-effective set (leaves not superseded) distinctly from EV, so that work that was earned but later superseded is not misread as an active feature. **Derivation rule:** when a superseding node transitions to `cancelled`, the system shall ignore that supersede edge when computing the currently-effective set — the old node returns to the set because its replacement is no longer active. The supersede edge itself remains on the log (append-only) but is operationally inert for the effective-set derivation.
本システムは現行有効集合(supersede されていない葉)を EV とは区別して導出・表示し、出来高として計上されたが後に supersede された作業が、現行有効な機能と誤読されないようにしなければならない。**導出規則:** supersede 元(新ノード)が `cancelled` へ遷移した場合、本システムは現行有効集合の算出時に当該 supersede 辺を無視する——旧ノードは、置換先が活動中でなくなったため集合に復帰する。supersede 辺自体はログに残る(append-only)が、有効集合の導出上は不活性となる。

**R-S6 (State).** While schedule coverage (the share of agreed work that is scheduled) is low, the system shall de-rate SPI and not present it as whole-project schedule progress, surfacing the unscheduled-but-agreed work as a visible gap.
スケジュール・カバレッジ(合意済み作業のうちスケジュール済みの割合)が低い間、本システムは SPI の解釈を割り引き、全体の対計画進捗として提示してはならず、未スケジュールの合意作業を可視のギャップとして示さなければならない。スケジュール・カバレッジが構造的に低い(未割当バックログが恒常的に大きい)場合、SPI は恒久的にデレートされ、SPI ではなく未スケジュールのギャップが主たるスケジュール信号となる。

**R-S7 (State).** While a sub-unit's **live-forecast completion (the live forecast schedule of R-S2/P7) diverges from its frozen baseline slot** — regardless of cause (an assignment change, or a capacity c(i,d) change such as a newly-declared holiday/leave) — the system shall flag the baseline slot as potentially stale and surface the stale-slot count, **attributed by cause**, as a visible gap alongside schedule coverage (R-S6), prompting the human to re-baseline or confirm. Here "confirm" is the human's deliberate NON-commitment to keep the baseline; it does NOT clear the stale flag — while the divergence holds the stale slot persists as a visible gap (this honestly preserves EVM variance against the baseline; §2.1 warning-persistence). The flag clears only when a reason-stamped re-baseline (an event) re-draws the frozen slot, or the live forecast re-converges to the slot (the divergence condition is falsified). "Bulk confirm" is presentation salience (mark-as-seen), distinct from "bulk re-baseline" which is a batch of events. This reuses the already-derived live forecast (R-S2, which includes per-sub-unit predicted completion) and introduces no new prediction algorithm; the divergence threshold is implementation-defined (as in R-T3). A broad capacity change (e.g. an org-wide holiday) may stale many slots at once; the cause-attributed count keeps this honest, and bulk confirm/re-baseline is an implementation affordance.
**生きた予測の完了（R-S2/P7 の生きた予測スケジュール）が凍結ベースライン・スロットと乖離する**サブ単位について——原因（割当変更でも、新たに宣言された祝日・休暇などの容量 c(i,d) 変更でも）を問わず——本システムはベースライン・スロットを陳腐化の可能性ありとして標識し、陳腐化スロット数を**原因別に**スケジュール・カバレッジ(R-S6)と並ぶ可視のギャップとして提示し、人間に再ベースラインまたは確認を促さなければならない。ここで『確認(据え置き受容)』はベースラインを意図的に維持する人間の**非コミット**であり、陳腐化標識を**解除しない**——乖離が続く限り陳腐化スロットは可視のギャップとして残る(これはベースライン対比の variance を正直に保つ EVM の本義に沿う;§2.1 警告持続)。標識が消えるのは、理由付き**再ベースライン(イベント)**で凍結スロットを引き直した時、または生きた予測がスロットへ**再収束(乖離条件の偽化)**した時のみ。『一括確認』は提示上の顕著さ操作(mark-as-seen)であり、イベント群である『一括再ベースライン』とは性質が異なる。これは既に導出済みの生きた予測(R-S2。各サブ単位の予測完了を含む)を再利用するもので、新たな予測アルゴリズムを導入しない（乖離の閾値は R-T3 同様に実装定義）。広範な容量変更（例: 全社的祝日）は多数のスロットを一斉に陳腐化させうるが、原因別カウントがこれを正直に保ち、一括確認・一括再ベースラインは実装の便宜とする。(R-S7 と R-S6 は独立した可視のギャップである:R-S6 はスケジュール・カバレッジの低さで SPI をデレートし、R-S7 は陳腐化スロットを個別に標識する。両方が同時に該当しうる。なお記録された c と実態の乖離〔drift〕は R-S7 では検知できない——予測も凍結スロットも記録値から導くため; §7。)

### 4.3 スケジュール・期日・割当 / Schedule, Deadline, Assignment

**R-T1 (Ubiquitous).** The system shall derive the schedule as a **c(i,d)-leveled**, critical-path-priority heuristic over the human-provided assignments and the DAG, recomputed incrementally on each event.
本システムはスケジュールを、人間が与えた割当と DAG の上での **c(i,d) 平準化**・クリティカルパス優先の発見的解として導出し、イベント毎に増分再計算しなければならない（増分再計算は発見的・実行可能解の維持であって、毎回の大域最適化を要求しない; P8）。

**R-T2 (Ubiquitous).** The system shall display agent work as schedulable spans between human touchpoints even though agent work is not leveled, and shall include agent task lead time (P6) in dependency-chain path-length calculations — agent work is not leveled, but its time consumption contributes to the critical path when it rate-limits human successors.
本システムはエージェント作業を、平準化対象外でも人間接点間の実行可能スパンとして表示し、**エージェントタスクのリードタイム(P6)を依存連鎖のパス長計算に算入**しなければならない(エージェントは平準化されないが、依存連鎖上の時間消費は人間後続を律速する場合クリティカルパスに寄与する)。

**R-T3 (Unwanted).** If the human-provided assignment cannot fit **c(i,d) leveling** for some person over some window — including AC recorded on a c=0 day — then the system shall raise an over-allocation alert identifying the person and window for the human to rebalance (the alert threshold/window is implementation-defined). The alert clears when its condition no longer holds — via a re-assignment (transition) or a c change (a c-driven re-derivation, R-S2); a point event such as AC on a c=0 day ages out of the implementation-defined window rather than persisting forever (§2.1 warning-persistence).
人間が与えた割当が、ある人物・ある期間で **c 平準化**に収まらない場合（c=0 の日に AC が計上された場合を含む）、本システムは当該人物と期間を特定する過負荷アラートを発し、人間が再調整できるようにしなければならない（発火閾値・期間は実装定義）。アラートは条件が偽化した時に消える——割当変更(transition)または c の変更(R-S2 の c 起因再導出)による;c=0 の日の AC のような点事象は、永久に残るのではなく実装定義の窓から外れて消える(§2.1 警告持続)。

**R-T4 (Unwanted).** If the derived schedule exceeds the external deadline, then the system shall alert only and not automatically add resources or cut scope; the human decides. The alert carries the overrun magnitude (derived completion − deadline) so a change in magnitude is discernible as new information; accepting the overrun with no action does not clear the alert — it persists while the derived schedule exceeds the deadline (§2.1 warning-persistence), clearing only when a commitment (scope cut / added resource / deadline change) brings the derived schedule within the deadline.
導出スケジュールが外部期日を超える場合、本システムはアラートのみを行い、要員追加やスコープ削除を自動で行ってはならない。判断は人間が行う。アラートには**超過量(導出完了−期日)**を伴わせ、量の変化が新情報として識別できるようにする;超過を受容して行動しないことはアラートを消さない——導出スケジュールが期日を超える限りアラートは可視ギャップとして残り(§2.1 警告持続)、コミット(スコープ削減・要員追加・期日変更)で導出スケジュールが期日内に収まった時にのみ消える。(導出スケジュールはエージェント区間のリードタイムを含む(R-T2)。これにより、エージェント作業が人間を律速する場合も期日超過アラートが正しく発火する。)

**R-T5 (Event).** When a task is to be worked, the system shall record its **single** assignee as a property of the lifecycle transition into the active state, and shall permit a provisional assignee to be set ahead of time for planning. The assignee is always one person; naming a new assignee replaces the previous one (§2.4).
タスクが着手されるとき、本システムは**単一の**被割当者を作業開始ライフサイクル遷移の属性として記録し、計画のため事前の暫定被割当者の設定を許可しなければならない。被割当者は常に一人であり、名指しの追記は置換である(§2.4)。

### 4.4 スコープ変更 / Scope Change

**R-C1 (Event).** When a feature is withdrawn or a node's scope is removed, the system shall emit a `transition` to terminal `cancelled` rather than deleting any event. When a node-level cancellation is emitted, the system shall evaluate cancel-orphan impact per R-C3.
feature 取り下げ時またはノード単位のスコープ削除時、本システムはイベントを削除せず終端 `cancelled` への `transition` を発行しなければならない。ノード単位のキャンセルが発行されたとき、本システムは R-C3 に従いキャンセル孤児影響を判定する。

**R-C2 (Ubiquitous).** The system shall exclude cancelled nodes from the active basis and derive sunk EV_abs as the sum of earned value over cancelled-state nodes without storing it separately.
本システムは取り消しノードを稼働 basis から除外し、サンク EV_abs を取り消し状態ノードの出来高総和として別途保存せず導出しなければならない。

**R-C3 (Event).** When a predecessor node transitions to `cancelled`, the system shall evaluate each **dependency edge** (not supersede edges) whose source is the cancelled node: if the edge's satisfaction threshold (R-D1/R-D2) becomes permanently unsatisfiable (the source is terminal `cancelled` and cannot reach the required state), the system shall emit a **cancel-orphan warning** identifying the blocked successor, the unsatisfied edge, and the available actions: remove the edge (`relate`), redirect to an alternative predecessor (`relate`), or cancel the successor (`transition`). The system shall **not auto-cancel** in any case — whether all or some predecessors are cancelled, the human decides (P0). Evaluation terminates finitely because the DAG is acyclic (I2). Tree-child nodes are evaluated through their DAG dependency edges, not through the ownership tree; a parent's cancellation triggers R-C3 only if the parent is also a DAG predecessor of the child.
先行ノードが `cancelled` へ遷移したとき、本システムは当該ノードを源とする各**依存辺**(supersede 辺を除く)を評価しなければならない:辺の充足閾値(R-D1/R-D2)が永久に充足不能(源が終端 `cancelled` で要求状態に到達不能)である場合、本システムは**キャンセル孤児警告**を発し、被ブロック後続・未充足辺・取りうる行動(辺の除去(`relate`)、代替先行への付け替え(`relate`)、後続のキャンセル(`transition`))を特定する。全先行 cancelled でも一部先行 cancelled でも**自動キャンセルせず**、人間が決定する(P0)。評価は DAG が非循環(I2)ゆえ有限に終了する。木の子ノードは所有木ではなく DAG 依存辺を通じて評価される——親のキャンセルは、親が当該子の DAG 先行でもある場合にのみ R-C3 を発火する。

### 4.5 依存・整合 / Dependencies and Integrity

**R-D1 (Event).** When a node's predecessors satisfy that edge's threshold policy, the system shall mark the node `ready`. If a predecessor transitions to `cancelled` (terminal) and the threshold becomes permanently unsatisfiable, the system shall follow R-C3.
先行群が辺の閾値ポリシーを満たしたとき、本システムは当該ノードを `ready` とマークしなければならない。**先行が cancelled(終端)へ遷移し閾値が永久充足不能になった場合は R-C3 に従う。**

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

**c(i,d) の必要性（v12 で α_i 導入 → v13 で c へ一般化）:** v11 までの固定容量 1.0MD/日 に対し、容量入力は二つの UC のために要る——(i) 部分参加チーム（0.2〜1.0MD/日 混在）、(ii) 祝日・休暇・部分稼働日。いずれも「正直な time-phased PV」を要求する。容量なしでは P7 が全員フル稼働前提の楽観スケジュールを出し、R-T3 が部分参加・休暇に対して**偽陰性**を生み、PV が非稼働日に計画進捗を割り付けて**偽の SPI** を生む（EVM の PV は time-phased で、ベースラインは暦の穴を反映すべき——暦は schedule に属し、率に時間平均で畳み込むべきでない。ただしこの是正は SPI の偽信号の**一因**を除くものであり、SPI には終盤で値が収束する等の別の既知限界が残る）。P0 で吸収可能だが、その場合システムの導出指標が**意図的に不正確**になり P0「コミット領域のみを正直に語る」に反する。
**なぜ単一 c か（α×暦 の二因子でなく）:** どの導出（P7/R-T3/§3/R-S7）も容量の値（積）しか参照せず、α と暦を**個別参照する導出が存在しない**＝二因子分離は最小性に反し冗長。決定打は**非一様な日次配分**——曜日で容量が異なり平均がどの単日とも一致しない場合（例: 月1.0・火0 で平均0.5）、スカラー α の二因子では α=0.5×a(月) に a(月)=2（a>1）を要求して破綻するが、単一 per-date の c は c(月)=1.0,c(火)=0 と素直に表す（標準稼働日を超える**真の圧縮勤務**＝1日>1.0MD は両形式とも計画 c では表せず AC に出る；A4。ここで二因子を破るのは「圧縮」ではなく前者の非一様配分である点を明確化する）。**c は暦日ごとに独立な任意関数ではなく、理由付き改定で区間的に変わる**（祝日・休暇期間・契約変更はいずれも区間、曜日パターンは周期的区間）——R-U14 の理由付き履歴がこの区間境界を記録し、自由度は「人×改定区間」（疎）であって「人×暦日」（密）ではない。契約 vs 一時の意味区別は c の**変更理由**（R-U7 の理由付き凍結値・decompose の理由必須と同型の境界づけられたメタデータ）で表現でき、新たな乗法構造を要しない。**契約レート α_i は c からの名前付き導出 view**（A4）——SPI/EV%/CPI と同様、導出を駆動しないが人間向けに名付けられた読み出しであり、reason ラベルは進捗・スケジュールの中核導出には効かず R-S7 の原因別表示と報告に効く（空虚な P0 溶解ではない；最小性上は α_i view を削り reason のみ残す案も検討したが、契約レートの名前付き view 保持はユーザー裁定）。v5 で廃止した裁量パラメータ（重み・留保率・スキル）は導出を恣意的に調整する値だったが、c は雇用契約・組織アサイン・暦に基づく外的事実の入力で質的に異なる（**容量＝投下できる時間量であって能力ではない**；A4 の能力非モデル化を保持。c に優先度・習熟は入れない）。
*c(i,d) necessity (α_i added in v12 → generalized to c in v13): against v11's fixed 1.0MD/day, a capacity input is needed for two UCs — (i) fractional-allocation teams (0.2–1.0 MD/day mix) and (ii) holidays/leave/partial-availability days — both demanding honest time-phased PV. Without it, P7 produces optimistic schedules, R-T3 yields false negatives for part-timers/leave, and PV assigns planned progress to non-working days producing false SPI (EVM PV is time-phased; the baseline must reflect calendar gaps — the calendar belongs to the schedule, not to a smoothed rate; this fix removes ONE source of false SPI signal, while SPI retains other known limits e.g. end-of-project convergence). Why single c, not α×calendar: no derivation reads the factors apart — only the product — so the split is redundant (minimality), and the two-factor form breaks on compressed schedules (requires a>1), whereas single per-date c expresses c(Mon)=1.0,c(Tue)=0 directly. The contract-vs-temporary meaning rides as a change reason (isomorphic to R-U7 reason-stamped values / decompose reason-required); α_i is its derived view (A4). Unlike v5's dissolved tuning knobs (weights, reserves, skills), c is an external fact (employment/assignment/calendar) — capacity is time available, NOT capability (A4's no-capability-modeling holds; no priority/proficiency in c).*

**二層データの正直な開示（A2 の射程）:** A2「唯一のデータ＝4イベント追記専用ログ」は**ノードのワークデータ**（進捗・状態・スコープ・コスト）の単一真実源を指す。プロジェクト構成入力 c(i,d) はそれとは別の第二の永続層であり、自前の追記専用・理由付き履歴（R-U14）を持つ——v12 で α_i について既に成立していた区別を v13 が per-date の c へ一般化したもので、新たに A2 を破るのではない。c はノードの属性ではない（A1）ため4イベントに載せず（第5イベントを足さない）、本節「4イベントで閉じる」は**ノード領域について**閉じる、と読む。
*Two-tier data (honest scope of A2): A2's "single data = the four-event append-only log" refers to NODE work data (progress, state, scope, cost). The configuration input c(i,d) is a second persistent tier with its own append-only, reason-stamped history (R-U14) — v13 generalizes to per-date c the carve-out already true for α_i in v12; it does not newly break A2. c is not a node attribute (A1), so it is not one of the four events (no fifth event added); "closed under four events" here is read as closed over the node domain.*

**意図的に持たないもの:**
- 審議過程 → `cause` が指す spec 文書の責務。
- 重み/留保率/能力(スキル・習熟度)→ 全廃（c は外的事実入力であり本項の廃止対象ではない。上記参照）。
- 五つの判断（見積合意・割当・スコープ/期日・見積の深さ・c の契約成分の宣言）の自動化 → 持たない(P0/§2.1)。
- 警告の acknowledge/dismiss/既読（可変状態）→ 持たない(最小性)。条件が真の警告は可視ギャップとして持続し、顕著さの制御は提示の責務(§2.1)。受容の監査証跡が UC 化すれば、c(R-U14)と同型の**追記専用 acknowledgment 層**として後付け可能(β 上位互換パス;§7)。
- 未発見作業の測定 → 原理的に不能(P2)。
- 人間内部の権威・オーナーシップ → A4 の延長としてスコープ外(§2.1)。矛盾合意は警告のみ(R-U12)。
- ペアリング/モブプログラミングの構造的表現 → 消費する UC が無く最小性に反するため持たない(§2.4)。
- 日内（時刻帯）スケジューリング → 持たない。c は日次粒度であり、「午前のみ」は c=0.5（半日容量）として表す。時刻帯の順序制約（午後だけ着手可 等）はモデル化しない。
- 組織暦と個人暦の合成機構 → 入力編集（実装）の責務。モデルは解決済みの c(i,d) を保持し、組織休日を各人の c へ展開する機構（カレンダー継承等）は実装に委ねる。
- 複数プロジェクトにわたる Σc の整合性 → 本モデルは単一プロジェクト視点であり、クロスプロジェクトのリソース整合は組織レベル管理の責務(A4)。

---

## 6. レビュー来歴 / Review Provenance

**v13→v14(警告の持続・消滅意味論の明文化 / moira-model-update スキル):** Moira 実装の画面アーキ(decision インボックス＝行為面案 C を採用)検討中に、独立敵対ゲートが MODEL 本体の穴を検出した:confirm/受容型の警告解決(R-S7 確認・R-T4 受容・R-U12 放置)はイベントを生まないため、導出駆動の集約面が項目を消すには dismiss=第5の可変状態(⊥精神)を要するか永久滞留するかの二択になる、というもの。
敵対レビュー(Round 1):moira-adversary ×3(V1–V6)＋ moira-fact-checker。fact-checker は EVM ベースライン据え置き=variance 保持(PMI/ANSI-EIA748)、EARS State 意味論(Mavin)、アラート疲れ=true positive 隠蔽の害(SRE/FDA)を NO_OBJECTION で裏取り。
中核の是正(著者が反証でなく**精度不足を認めてパッチ**):(i) 警告の「条件」は**現在の導出状態**であり歴史的事実そのものではない(R-U12 は現行 latest-wins 値、P5 at-risk は implemented 再到達前で判定)。(ii)「acknowledge(イベント無し)では消えず、commit(イベント)で消える」を明確化(R-U13 事後合意・R-C3 辺操作・R-T4 スコープ削減は commit=イベントゆえ消える=整合)。(iii) 偽化トリガーに c 変更を含める(R-S2 と整合)、c=0 日 AC 等の点事象は実装定義の窓で aging out。(iv)「acknowledge を持たない」根拠を A2 から**最小性**へ訂正(acknowledge はノードのワークデータでなく c と同じく別層たりうるため A2 は直接禁じない)。(v) P0 の抜け穴を封鎖:提示は顕著さを抑制してよいが可視ギャップの会計から警告を除いてはならない(falsifiable な線)。
**ユーザー裁定 FORK(confirm/S-N の扱い):** α(acknowledge 状態を持たず提示で顕著さ制御)/ β(c 同型の追記専用 acknowledgment 層)/ γ(Open Item) を具体ケース付きで AskUserQuestion に回し、ユーザーは **α＋β 上位互換パスの §7 開示**を選択。本文は §2.1(α)・§5(α＋β 参照)・§7#9(β 上位互換パス開示)に反映。
主な修正:§2.1(警告持続メタ条項を新設)、R-U12/R-S7/R-T4/P5/R-T3(現在状態判定・消滅トリガー・「確認=非コミット」の明確化)、§5(acknowledge 不在を意図的省略に追加)、§7#9(持続・S/N・β パス開示)。新公理・新イベント・新状態・新要件番号・新原理番号は増やしていない(既存条項の意味論明確化に留める)。独立採点者(moira-gate-judge)の残存 Critical/Important = 0。

**v12→v13(α_i スカラー → 日次容量 c(i,d) 一般化 / moira-model-update スキル):** 「暦(祝日/休暇/稼働日)と α_i の関係」の議論から、α_i(スカラー割当率)を**人間ごとの日次容量 c(i,d) ∈ [0,1.0] MD/日**(既定 1.0、理由付き append-only 改定、区間定数)へ一般化し、祝日・休暇・部分稼働日を正直に time-phased PV へ反映する。
敵対レビュー(Round 1): moira-adversary ×3 が V1–V6 で攻撃し、moira-fact-checker が EVM/資源スケジューリングの土台事実(乗算分解・time-phased PV・calendar/units 分離)を MS Project/Oracle/PMI/ANSI-EIA748 で CONFIRMED。中核 Critical は「容量を α×暦 の二因子に分けるか、単一 c か」——どの導出も積しか参照せず二因子は冗長、かつ非一様な日次配分で α×a は a>1 を要求して破綻、と判明。
**ユーザー裁定 FORK:** 「単一容量 c／二因子 α×a／v12 維持」を AskUserQuestion で回し、ユーザーは**単一容量 c(α_i は導出 view)**を選択。
主な是正(Round 1+2): A4 を c へ一般化(c=0 込み・slot 次元のみ・能力非モデル化保持)、§2.1#5(人間が与えるのは c であり α_i ではない)、P7/R-U11/R-T1/R-T3 を c 平準化へ、R-U14 を c 履歴へ、R-S2 に「各サブ単位の予測完了」と「c 変更も再導出契機」を明記、R-S7 を**予測終端の乖離(cause-agnostic)**へ一般化、§3(c は PV(t) 時間配分に効き予算総額に効かない・c=0 完了の SPI 領域非対称)、§5(c 必要性・最小性＝区間定数・二層データ・スコープ外)、§7(drift 非検知・暦既定・洪水・再現性・恒久 c=0 の二経路を開示)。
**撤回(V3・追記専用ゆえ旧行は不変、本行で明記):** (i) 下記 v11→v12 行の「α_i staleness 警告は R-U14+P0 で十分(R-S7 のようなトリガー条件が α_i には存在しない)」を撤回——v13 の cause-agnostic R-S7 は、記録された c(α 成分含む)の変更が凍結ベースラインを無効化する場合を予測終端の乖離として検知する(記録と実態の drift は依然非検知; §7#4)。(ii) v12 が α_i を「一級パラメータ」とした位置づけを撤回し、c からの名前付き導出 view へ降格(SPI/EV%/CPI と同型)。
Round 2 で著者の 3 反証を別の moira-adversary が再challenge: 「R-S7 は新アルゴリズム不要」は不健全と判明しパッチへ転換(R-S2 に予測完了を明記)、「c は死んだ定義でない」は骨格健全だが c→PV 接続を明記、「洪水は一括で捌ける」はカウントの正直さは健全・一括適用は実装と決着。相反 Critical(α_i view の冗長性)は採点者がユーザー裁定＋既存 named view(SPI 等)との同型性で保持を裁定(棄却理由明記)。
新公理・新イベント・新状態・新**要件番号**は増やしていない(R-S7/R-T3 は既存番号の意味論拡張、v12 §7#4 開示の撤回を伴う)。独立採点者(moira-gate-judge)の残存 Critical/Important = 0。

**v11→v12(α_i パラメータ化 / moira-model-update スキル):** ユーザーが「人間は 0.2MD/日〜1.0MD/日 とまちまち」と指摘し、部分参加チームへの正直なスケジューリングを求めた。A4 の固定容量 1.0MD/日 を人間ごとの割当率 α_i ∈ (0, 1.0] MD/日 にパラメータ化。
敵対レビュー(Round 1): moira-adversary ×3 が V1–V6 攻撃角で攻撃し Critical 5 件・Important 15+ 件を検出。
- **C1(L40 矛盾)**: L40「大域ノブは存在しない」と α_i の矛盾 → L40 を「導出を調整する裁量パラメータは存在しない」に修正し、α_i は外的制約入力として区別を明記。**パッチ修正。**
- **C2(恣意的区別)**: 廃止パラメータ(留保率等)と α_i の質的違いが恣意的 → §5 に必要性論証追加:廃止パラメータは構造的代替で還元可能だったが α_i の機能を還元する代替は存在しない。**パッチ修正。**
- **C3(V1 必要性反証)**: α_i を除去しても MODEL は成立する(v11=証拠) → 著者反証:v11 は原初 UC(フルタイムチーム)で gate-pass;新 UC(部分参加)では α_i なしで P7/R-T3 が虚偽出力 → **再反論 adversary が反証の健全性を確認。Critical 消滅。**
- **C4(A2 記録手段不在)**: α_i の記録手段が 4 イベントにない → R-U14 を新設(α_i はプロジェクト構成入力として追跡)。A4 に記録方法と A2 との関係を明記。**パッチ修正。**
- **C5(V5 空虚性)**: v11+P0 ≈ v12+α_i → 著者反証:R-T3 偽陰性(0.2MD/日 の人に 0.5MD 割当でも未検知)という具体的機能差で非同等を示す → **再反論 adversary が反証の健全性を確認。Critical 消滅。**
- Important: α_i-AC 関係未定義/上限 1.0 根拠/A5 未更新/§2.1 未追加/§5 未論証/α_i=0 排除根拠/クロスプロジェクトスコープ等 → すべてパッチ修正。α_i staleness 警告は R-U14+P0 で十分と判断(R-S7 のようなトリガー条件が α_i には存在しないため)。
独立採点者(moira-gate-judge)の残存 Critical/Important = 0。新公理・新イベント・新状態は増やしていない。新要件 R-U14(α_i 変更追跡)1 件。

**v10→v11(思考実験 04–10 による独立敵対レビュー → moira-model-update スキル):** 7 本の思考実験(TE 04–10)が MODEL v10 に対し計 15 件の穴(Critical 2 / Important 13)を露呈させ、各 TE は自己検証ループ(fact-checker + 反転 adversary×3 + gate-judge)でゲート通過済み。2 件の設計分岐(FORK 09/10)はユーザーが Option A を裁定。主な是正:
- **キャンセル伝播と孤児警告**(04-C1):R-C1 のスコープをノード単位に拡張、R-C3(キャンセル孤児警告)を新設、R-D1 にキャンセル先行の分岐を追加。R-C1 のスコープ(04-I1)、supersede×cancel の優先規則(04-I2)、`accepted→cancelled` 遷移の明示(04-I2)も併せて是正。
- **半凍結ベースラインの閉塞**(05-C1):スケジュール済み・未合意ノードの PV 除外規則を §3 に追加、I4 を合意条件化、R-U13(未合意完了警告)を新設。P1 の偽の普遍命題を修正(05-I1)。
- **スロット選定の実装依存性の開示**(06-I1)、**ベースライン陳腐化の可視化**(06-I2:R-S7 新設)。
- **エージェント律速のクリティカルパス算入**(07-I1/07-I2):P7・R-T2 を修正しエージェントのリードタイムをパス長に算入、R-T4 偽陰性を構造的に解消。
- **CPI モデル化依存性の開示**(08-I1)、**粒度非対称の明示**(08-I2)。
- **矛盾合意警告**(09-I1/09-FORK:R-U12 新設、人間内部権威スコープ外の disclaimer を §2.1 に追加)。
- **単一被割当者の明示**(10-I1/10-FORK:§2.4・R-T5 修正、ペアをスコープ外として §5 に追加)。
敵対レビュー(Round 1):moira-adversary ×3 が攻撃し Critical 3 件(FORK として 3 件ユーザー裁定)・Important 12 件を検出。全 Critical をパッチ修正(FORK 裁定反映)、全 Important をパッチ修正、6 件を反証で退却(re-challenge adversary が反証の健全性を確認)。
新公理・新イベント・新状態は増やしていない。新要件は R-C3・R-S7・R-U12・R-U13 の 4 件(いずれも既存構造の上の警告・可視化)。独立採点者(moira-gate-judge)の残存 Critical/Important = 0。

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

「完全に閉じた」という宣言はしない(本モデル自身の P2「未発見は測れない」と一貫させる)。v13 確定までに、α_i スカラーの c(i,d) 一般化で独立敵対者の Critical 群（容量の二因子分離の冗長性・圧縮勤務での破綻・cause-agnostic R-S7 と旧開示の衝突 等）を決着させた（中核分岐＝単一容量 c か二因子か、はユーザー裁定で単一 c）。v14 では、警告の持続・消滅意味論を §2.1 で明文化し、confirm/受容型解決の表現問題を決着させた(警告は現在状態の述語として条件が真の間だけ持続し、acknowledge 可変状態を持たない＝α 裁定)。以下は v14 時点で認識している残余の開示:

1. **凍結スロットの選定一意性**(06-I1 由来):スロット値は実装依存であり、モデルは選定手続きを規定しない(P8 の帰結として開示済み)。実装間の PV/SPI 比較可能性は保証されない。
2. **CPI のモデル化選択依存**(08-I1 由来):ノード化 vs 畳むの選択が CPI に影響する。摂動は抑制されるが定量的有界性の保証はなく、正規化規則は持たない(開示済み)。
3. **粒度の非対称**(08-I2 由来):合意=ノード一括、EV 消化=チェック項目別、後退=ノード別。項目層の状態機械は持たない(設計選択として明示済み)。

4. **容量 c の陳腐化と drift**(v12→v13 で更新):(a) 記録された c の*変更*が凍結ベースラインを無効化する場合は、v13 で R-S7（予測終端の乖離、cause-agnostic）が検知する——v12 の「α_i にトリガー条件が存在しない」という開示は、この範囲で**撤回・更新**された（§6 v12→v13）。(b) ただし**記録された c と実態の乖離（drift）**——記録上 c=1.0 だが実際は休んでいた等——は依然として構造的トリガーを持たない。予測も凍結スロットも*記録値*から導くため、記録が現実とずれても R-S7 は沈黙する。これは契約成分（α view）でも暦成分でも対称で、認識と更新は P0 + R-U14（理由付き変更追跡）に委ねる。
5. **c の未指定日と暦の取りこぼし**(v13):c は未指定日を 1.0MD/日（既定）とするため、将来の祝日・休暇を入れ忘れると P7 が楽観スケジュールを出す。これは**無警告で適用される楽観既定**（drift と同様、構造的検知を持たない——P2 の見積カバレッジのような既知/未知の境界表示は無い）であり、暦の保守は P0 に委ねる。
6. **広範な c 変更によるスロット陳腐化の洪水**(v13):全社的祝日の宣言は多数の凍結スロットを一斉に陳腐化させうる。R-S7 は陳腐化スロット数を**原因別**に提示してこれを正直に保つが、大量スロットの一括確認・一括再ベースラインは実装の便宜であり、モデルは個別の再ベースライン構造のみを規定する。
7. **過去予測の再現と c の valid-time**(v13):過去時点の生きた予測を再現するには、その時点で有効だった c 値が要る。R-U14 の追記専用・理由付き履歴がこれを提供するが、c は日次・人数規模で α_i スカラーより高頻度であり、point-in-time 再現には valid-time スナップショット保持が要る（実装上の要件として開示。R-U14 が確保するのは履歴保持＝再現の*可能化*であり、再現性の最終担保はこの実装責務に依存する）。
8. **恒久離脱の二経路と c=0 永続**(v13):恒久離脱は割当解除（§2.4、未割当バックログとして可視）で表すのが規範だが、将来全日 c=0 でも表現でき、これを構造的に禁じる不変条件は置かない（恒久/一時の境界は P0; A4）。c=0 永続で割当が残ると、未割当バックログには出ず「割当済みだが進まないタスク」＋R-S7 のスロット陳腐化として現れる——表現選択の非決定性は P0 に委ねる残余。
9. **警告の持続・消滅と S/N、acknowledge の不在**(v14):警告は**現在の導出状態に対する述語**として、条件が真である限り可視ギャップに残り、条件を偽化する入力(4イベント追記 または c 変更)が起きた時のみ消える(§2.1)。「見て受容し何もしない(イベント無し)」は条件を偽化せず警告を消さない——これは正直だが、長寿命・大規模では真だが据え置き受容された警告(R-S7 据え置きスロット・R-S3 正当な長期作業 等)が単調に蓄積し S/N が低下しうる。本モデルは acknowledge/dismiss を**可変状態として持たず**(最小性;§5)、「据え置き・既知」と「新規」の区別・畳み込み・並び替え等の**顕著さ制御は提示(presentation)の責務**とする——ただし提示は警告を可視ギャップの会計から除いてはならない(P0;falsifiable な線)。**β 上位互換パス**:受容の監査証跡(誰がいつ何を据え置き受容したか)が UC 化した場合、c(R-U14)と同型の**追記専用・理由付き acknowledgment 層**を後付けし、警告の活性述語を「条件が真 ∧ 最終条件変化以降に未確認」へ拡張できる(acknowledgment はノードのワークデータでない別層ゆえ A2 非違反)。現時点では駆動する UC が無いため持たない(α 裁定)。

構造・語彙・既定値は実用上安定しており、次の段階として本モデルを前提とした具体的アーキテクチャの検討に進める。今後さらなる綻びが見つかれば、本書は moira-model-update スキルを通して追記的に更新される(追記専用の精神)。
*We do not declare the model "fully closed" (consistent with the model's own P2). As of v13, the Critical/Important findings from generalizing scalar α_i into per-date c(i,d) are resolved (the core fork — single capacity c vs two factors — was adjudicated by the user as single c). Residual disclosures: (1) frozen-slot selection is implementation-dependent; (2) CPI is modeling-choice-dependent; (3) granularity asymmetry; (4) recorded-c CHANGES that invalidate a baseline are now caught by R-S7 (forecast-end divergence), but recorded-vs-reality DRIFT has no structural trigger (P0 + R-U14), symmetric for contract and calendar components; (5) unspecified-day c defaults to 1.0 (missing-calendar optimism, a coverage-like gap); (6) a broad c change can stale many slots at once (cause-attributed count; bulk handling is implementation); (7) point-in-time forecast reproduction needs valid-time c snapshots; (8) permanent departure has two encodings (unassignment vs persistent c=0); (9) warnings are current-state predicates that persist while true and clear only when an input (a four-event append or a c change) falsifies the condition, with NO acknowledge/dismiss mutable state (minimality) — salience is presentation's job but never drops a warning from the visible-gap accounting (P0); an R-U14-isomorphic append-only acknowledgment tier (β) is the disclosed upgrade path if audit-of-acceptance becomes a UC. Structure, vocabulary, and defaults are practically stable; the next stage is concrete architecture.*
