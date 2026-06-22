# Requirements Document

## Introduction

`moira-core` は Moira 正典モデル `moira/MODEL.md`(v16, 凍結) を本番アーキテクチャへ落とす **CQRS 分解の Wave0** であり、全 read spec（×10）と全 write skill（×14）が依存する **基盤契約**を凍結する spec である。具体的には次を所有する:

1. **emit/derive 契約** — 4 イベント（`transition`/`decompose`/`relate`/`cost`）の追記、構成入力（capacity c・期日・目標日）の追記、および同一ログからの導出読み出し。
2. **データモデル** — イベント型、ノード ライフサイクル状態機械（`ready` を含む lifecycle 状態の保持。`ready` は状態として保持するのみで、先行充足から導く ready-eligible は `moira-scope-deps` 所有＝二語分離）、見積合意機械（人間限定）、effective-set（supersede×cancel 復帰規則）、辺の型・既定 policy の構造保持（評価は下流）、`(ts,id)` latest-wins、二層データの境界。
3. **構造不変条件の機械的担保** — I1–I6 と R-D7 の**構造**面（旧ノードの append-only 不変・supersede 非循環 I2・非人間 agreed の拒否 I6）を畳み込み（fold）が enforce する。core が拒否するのは構造違反（循環 I2／非人間 agreed I6）のみであり、**一般の後退遷移は遷移の合法性として拒否せず**、ログに記録したうえで意味的異常（仕様FIX判定の誤り等）の警告は下流（P5／`moira-health`）に委ねる（MODEL P5 忠実）。
4. **永続化方式の決定** — 追記専用ログ・第二層の永続層境界（永続化 TBD の所在は本 spec 設計）。

本 spec は MODEL を唯一の真実源（SSOT）とし、MODEL の文言を変えず・新概念を足さず、その実装落とし込み（emit→derive 契約と二層データ構造）に徹する。参照実装（`moira/backend/src`・`moira/frontend/src/moira`）の seam に整合させ、出力スキーマは MODEL 準拠とする。

数式・magic number は本書に埋め込まない（指標の定義式の正典は MODEL §3／`moira-naming.md`、実装詳細は design 以下に置く）。指標式そのものの所有は `moira-evm`、平準化/予測ロジックは `moira-schedule` に委ね、core は両者を束ねる契約・effective-set・二層入力・凍結属性記録を提供する。

## Boundary Context

- **構造境界 core（最上位原則・doc-refine ユーザー裁定 2026-06-22）**: core は**構造／不変条件／機構のみ**を所有する——イベント・辺の型／policy の構造保持・effective-set 機構（supersede／cancelled 除外を含む現行有効集合の導出）・latest-wins（I3）・循環拒否（I2／R-D3）・cancelled 終端遷移の受理と fold（R-C1 構造面）・R-S2 オーケストレータ・シーム契約（値は持たない）・凍結記録・R-S5 累積／現行 basis 機構。**評価／値／式はすべて下流**が所有する——辺述語の ready-eligible 評価（R-D1/D2/D4）＝`moira-scope-deps`、EV 系の式＝`moira-evm`、平準化／予測＝`moira-schedule`、警告確定＝`moira-health`。core は辺の型・既定 policy を**保持**するが ready／閾値を**評価しない**。
- **ready 二語分離**: `ready` は **lifecycle 状態**であり、`moira-progress` が `transition` で emit する。先行充足述語（先行群が辺ポリシーを満たすか）から導く **ready-eligible** は別語彙で `moira-scope-deps` が導出する。core は lifecycle 状態機械に `ready` 状態を保持するのみで、ready-eligibility を導出しない。
- **In scope（core が所有）**: emit/derive/capacity-write/config-write の API 契約、イベント型と第二層スキーマ、ノード/見積 ライフサイクル状態機械（`ready` を含む lifecycle 状態の保持）、追記専用ログ層・畳み込み層・導出オーケストレータ・read 層の責務境界、`(ts,id)` 決定的マージ（I3/R-D5）、辺の型・既定 policy の**構造保持**（R-D2 既定値の記録）と辺の非物理増殖（node 水準保持・R-D4 構造面）、循環 relate 拒否（I2/R-D3）、cancelled 終端遷移の**受理と fold**（R-C1 構造面）、非人間 agreed の構造的拒否（I6；R-U4 の人間承認オーケストレーションは `moira-estimate-agree` 所有）、effective-set 導出と supersede×cancel 復帰（R-S5）、累積／現行 basis 機構（R-S5）、ベースライン二次元の凍結 **記録機構**（予算=合意時 R-U7、スロット=初回スケジュール時、I4 完了施錠）、R-D7 の**構造面**（旧ノードの append-only 不変・supersede 非循環 I2）、**チケット射影の不変条件（R-U1=ノードが SSOT／チケットは読み出し専用射影・チケット→ノードの逆書き込み経路なし；射影の対象・多重度・メカニズムは `moira-ticket-project`/0b 所有で core は規定しない）**、二層データの再導出契機（イベント追記 AND c・期日・目標日 変更）、永続化方式の決定。
- **Out of scope（下流が所有）**: 辺述語の評価＝ready-eligible 導出・辺種別ごと既定閾値の**適用**（R-D1/D2/D4）= `moira-scope-deps`、指標式本体（EV_abs/EV%/見積被覆/実行カバレッジ(R-S8)/PV/AC/SPI/CPI/sunk）= `moira-evm`、平準化(P7/P8)・予測・slot 充填・スケジュールバッファ(R-T6) 導出 = `moira-schedule`、tree+DAG 表示・ready-eligible/orphan(R-C3)/restoration(R-S5) 読み = `moira-scope-deps`、`ready` 状態遷移の emit = `moira-progress`、後退遷移の意味的異常検知（P5 at-risk）・9 warning 確定・集約・行為列挙 = `moira-health`、spec-unit 正規化 = `moira-ingestion-adapter`、全 read サーフェス（UI）、全 write skill（イベント発行・オーケストレーション・人間承認ステップ）。
- **Adjacent expectations**: core が **定義**する横断概念（effective-set / latest-wins / 二層データ / 4 イベント emit / derive 契約 / 凍結属性記録）を、下流の read spec/write skill が **消費**する。core の API 契約・スキーマ・導出契約の形が変われば全下流が再検証を要する（基盤契約ゆえ contract shape の安定性が最優先）。

## Requirements

### Requirement 1: 単一実体・単一データ（A1/A2・二層データ）

**Objective:** モデル設計者として、唯一の実体をノードに、唯一のノードワークデータを 4 イベント追記専用ログに、構成入力を別の第二層に固定したい。それにより全下流が同一の真実源と二層境界に依拠できる。

#### Acceptance Criteria

1. The system shall treat nodes — the spec and its decomposition — as the only entities, and shall treat any work unit that is performed and earns value (EV_abs), including ops tasks, bug fixes, and ad-hoc work, as a feature node on the same log, derivations, and lifecycle.
   - 和訳: システムは、spec とその分解であるノードを唯一の実体として扱い、遂行され出来高(EV_abs)を生むあらゆる作業単位（運用タスク・バグ修正・ad-hoc 作業を含む）を、同一ログ・導出・ライフサイクルに乗る feature ノードとして扱わなければならない。
2. The system shall not represent a derived accounting quantity such as a buffer as a node, deriving it instead from configuration inputs and derived completion.
   - 和訳: システムは、バッファのような導出される会計量をノードとして表現してはならず、構成入力と導出完了から導出しなければならない。
3. The system shall persist all node work-data state changes solely as append-only events of the four kinds (`transition`/`decompose`/`relate`/`cost`).
   - 和訳: システムは、ノードのワークデータの全状態変化を、4 種（`transition`/`decompose`/`relate`/`cost`）の追記専用イベントとしてのみ永続化しなければならない。
4. The system shall persist the capacity input c(i,d) and the project deadline/target date as a second data tier distinct from the four-event node log, each as its own append-only, reason-stamped, timestamped history, and shall not introduce a fifth event for them.
   - 和訳: システムは、capacity 入力 c(i,d) とプロジェクトの期日/目標日を、4 イベントのノードログとは異なる第二データ層として、それぞれ追記専用・理由付き・タイムスタンプ付きの履歴で永続化し、これらのために第5イベントを足してはならない。
5. The system shall preserve the persisted log unchanged, never deleting an event, so that any scope removal is recorded as a new event rather than a mutation.
   - 和訳: システムは、永続化されたログをイベント削除せず不変に保ち、スコープ削除も mutation ではなく新イベントの追記として記録されるようにしなければならない。

### Requirement 2: 追記専用 emit API と保存状態の不変性（R-U2/A2）

**Objective:** write skill 作者として、4 イベントを追記するだけの単一の書き込み口がほしい。それにより保存状態への直接 mutate を構造的に不可能にできる。

#### Acceptance Criteria

1. When a caller emits one of the four events, the system shall append it to the log and shall reject any direct mutation of stored derived state.
   - 和訳: 呼び出し元が 4 イベントのいずれかを emit したとき、システムはそれをログへ追記し、保存された導出状態への直接 mutation を拒否しなければならない。
2. When a caller appends a capacity entry c(i,d), the system shall record it into the second tier with its reason and timestamp without using any of the four events.
   - 和訳: 呼び出し元が capacity エントリ c(i,d) を追記したとき、システムは 4 イベントを用いずに、理由とタイムスタンプ付きで第二層へ記録しなければならない。
3. When a caller appends a project deadline or target date, the system shall record it into the second tier with its reason and timestamp without using any of the four events.
   - 和訳: 呼び出し元がプロジェクトの期日または目標日を追記したとき、システムは 4 イベントを用いずに、理由とタイムスタンプ付きで第二層へ記録しなければならない。
4. The system shall expose the emit/append operations as the only write path; reads shall never mutate the log or any stored state.
   - 和訳: システムは emit/追記操作を唯一の書き込み経路として公開し、読み出しはログまたは保存状態を一切 mutate してはならない。
5. When conflicting second-tier entries are appended for the same key — c(i,d) per (human, date), or the project-level deadline/target date — the system shall resolve the current value by the I3-isomorphic `(ts,id)` latest-wins rule, the arbitration of authority WITHIN the human set being out of scope (§5).
   - 和訳: 同一キー（c(i,d) は (human, date) ごと、期日/目標日はプロジェクトレベル単一）に対し矛盾する第二層エントリが追記されたとき、システムは現行値を I3 同型の `(ts,id)` latest-wins 規則で決定しなければならない。人間集合の内部権威の裁定はスコープ外（§5）である。

### Requirement 3: 4 イベントのスキーマと意味（§2.8）

**Objective:** 全 spec/skill 作者として、4 イベントそれぞれの意味とスキーマを一意に固定したい。それにより誰が emit しても同じ畳み込み結果になる。

#### Acceptance Criteria

1. The system shall represent a `transition` event as a state-machine transition that carries lifecycle transitions, estimate `proposed→agreed` agreement, and the naming of a single assignee, and shall make the `transition` the structural carrier of non-state-machine recorded data (assignee, frozen baseline budget, frozen baseline slot) as attributes; the obligatory occasion on which each such attribute must be recorded is ruled uniquely by Requirement 7 (budget at agreement = 7.2, slot at first scheduling = 7.3), this AC governing only that a `transition` is the place such attributes may ride.
   - 和訳: システムは `transition` イベントを、ライフサイクル遷移・見積 `proposed→agreed` 合意・単一被割当者の名指しを担う状態機械遷移として表現し、状態機械の一部でない記録データ（被割当者・凍結ベースライン予算・凍結ベースライン・スロット）を属性として載せる構造的な場としなければならない。各属性が記録されねばならない契機（予算＝合意時 7.2、スロット＝初回スケジュール時 7.3）は Requirement 7 が一意に律するものとし、本 AC は `transition` がそうした属性を載せうる場であることのみを規定する。
2. The system shall represent a `decompose` event as the setting/revision of a node's children and estimates, requiring a change reason.
   - 和訳: システムは `decompose` イベントを、ノードの子と見積の設定/改訂として表現し、変更理由を必須としなければならない。
3. The system shall represent a `relate` event as the add/remove of a DAG edge carrying its edge kind (dependency / supersede), with a satisfaction policy on dependency edges.
   - 和訳: システムは `relate` イベントを、種別（依存 / 置換 supersede）を持つ DAG 辺の追加/削除として表現し、依存辺には充足ポリシーを持たせなければならない。
4. The system shall represent a `cost` event as an accumulative actual-cost entry deduplicated by event id and attributed to its actor.
   - 和訳: システムは `cost` イベントを、event id で重複排除し行為者に帰属する加算的な実コスト計上として表現しなければならない。
5. The system shall record actual cost in the single currency of human attention-time (MD) and never fold it into EV.
   - 和訳: システムは実コストを人間アテンション時間（MD）の単一通貨で記録し、それを EV に混入させてはならない。

### Requirement 4: 見積は合意状態を持つ提案・非人間 agreed の構造的拒否（R-U3/I6/A5）

**Objective:** モデル設計者として、あらゆる見積を出所を問わず提案として表し、非人間による `agreed` 遷移を構造的に拒否したい。それにより権限の非対称（合意は人間のみ）を構造で担保できる。なお R-U4 が定める人間承認のオーケストレーション（誰がいつ承認するかの write 手続き）は `moira-estimate-agree` skill が所有し、core は I6＝非人間 agreed を fold で構造的に拒否する不変条件のみを担う。

#### Acceptance Criteria

1. The system shall represent every estimate, regardless of its source, as a proposal carrying a `proposed`/`agreed` state on the estimate-agreement machine.
   - 和訳: システムは、出所を問わずあらゆる見積を、見積合意機械上の `proposed`/`agreed` 状態を持つ提案として表現しなければならない。
2. When a `transition` to `agreed` is emitted by a human actor, the system shall record the agreement (the human-only authority gate, I6); the freezing of the node's baseline budget on this agreement transition is ruled uniquely by Requirement 7.2 (R-U7/§3) and is not restated here.
   - 和訳: 人間の行為者が `agreed` への `transition` を emit したとき、システムは合意を記録しなければならない（人間限定の権限ゲート、I6）。この合意 `transition` におけるベースライン予算の凍結は Requirement 7.2（R-U7/§3）が一意に律するものとし、本 AC では再述しない。
3. If a `transition` to `agreed` is emitted by a non-human (agent) actor, then the system shall reject it as a fold-enforced structural invariant (I6) and surface a structural error, the human-approval orchestration of agreement (R-U4) being owned by the `moira-estimate-agree` write skill rather than by core.
   - 和訳: 非人間（エージェント）の行為者が `agreed` への `transition` を emit した場合、システムはこれを fold で enforce する不変条件（I6）として拒否し、構造エラーとして顕在化しなければならない。合意の人間承認オーケストレーション（R-U4）は core ではなく `moira-estimate-agree` write skill が所有する。
4. When a re-estimation revises a node's value, the system shall return the estimate to `proposed` until a human agrees again.
   - 和訳: 再見積がノードの値を改訂したとき、システムは人間が再度合意するまで見積を `proposed` に戻さなければならない。

### Requirement 5: ノード ライフサイクル状態機械・機械明示・cancelled 受理／後退遷移記録（§2.5/R-D6/I5/R-C1/R-D7）

**Objective:** 全 transition writer として、すべてのノードが同一の lifecycle 状態機械に乗り、各 transition が対象機械を明示することを保証したい。あわせて、cancelled 終端への遷移を受理して畳み込み、一般の後退遷移は遷移合法性として拒否せず記録のみ行い（意味的異常の警告は下流 P5/health に委ねる）、core が拒否するのは構造違反（循環 I2・非人間 agreed I6）のみに限りたい。それにより遷移の被指示性が破れず、かつ MODEL P5（後退遷移は記録し下流が警告）に忠実な遷移受理ができる。

#### Acceptance Criteria

1. The system shall apply one lifecycle state machine — `pending → ready → implementing → implemented → accepted`, with terminal `cancelled` reachable from any non-terminal state — uniformly to all nodes regardless of decomposition depth.
   - 和訳: システムは、`pending → ready → implementing → implemented → accepted`（終端 `cancelled` はいずれの非終端状態からも到達可能）という単一のライフサイクル状態機械を、分解の深さに依らず全ノードへ一様に適用しなければならない。
2. The system shall require every `transition` to name the state machine it advances (`lifecycle` or `estimate-agreement`).
   - 和訳: システムは、すべての `transition` に対象状態機械（`lifecycle` または `estimate-agreement`）の明示を要求しなければならない。
3. When a node first reaches `implemented`, the system shall record that it has reached `implemented` so that downstream backward-transition anomaly detection (P5) can distinguish before/after.
   - 和訳: ノードが初めて `implemented` に到達したとき、システムは `implemented` 到達を記録し、下流の後退遷移異常検知（P5）が到達前後を区別できるようにしなければならない。
4. The system shall treat `implemented` as the recorded judgement "code-complete ∧ spec-fixed", a judgement and not a guarantee, leaving the spec movable thereafter as an anomaly for downstream warning.
   - 和訳: システムは `implemented` を「実装完了 ∧ 仕様FIX」という記録上の判定（保証ではない判定）として扱い、到達後も仕様が動きうることを下流警告の対象たる異常として残さなければならない。
5. When a lifecycle `transition` to terminal `cancelled` is emitted — reachable from any non-terminal state, including `accepted → cancelled` as feature withdrawal — the system shall accept it (never deleting any event) and fold it into the derived state, the cancel-orphan impact evaluation (R-C3) being owned downstream by `moira-scope-deps` and the cancel emit by `moira-cancel-scope`, core enforcing only acceptance and folding of the terminal transition.
   - 和訳: 終端 `cancelled` へのライフサイクル `transition`（いずれの非終端状態からも到達可能。feature 取り下げとしての `accepted → cancelled` を含む）が emit されたとき、システムはそれをイベント削除せず受理し、導出状態へ畳み込まなければならない。キャンセル孤児影響の判定（R-C3）は下流の `moira-scope-deps` が、cancel の emit は `moira-cancel-scope` が所有し、core は終端遷移の受理と畳み込みのみを enforce する。
6. When a backward lifecycle transition is emitted, the system shall record it append-only without rejecting it on grounds of transition legality, rejecting only structural violations (a cycle, I2; a non-human `agreed`, I6); the semantic-anomaly detection of a backward transition (the mis-certified spec-fix at-risk, P5) is owned downstream by `moira-health`, core not enforcing transition legality (MODEL P5-faithful).
   - 和訳: 後退ライフサイクル遷移が emit されたとき、システムはそれを遷移合法性を理由に拒否せず append-only で記録し、拒否するのは構造違反（循環 I2・非人間 agreed I6）のみに限らなければならない。後退遷移の意味的異常検知（仕様FIX判定の誤りによる at-risk、P5）は下流の `moira-health` が所有し、core は遷移合法性を enforce しない（MODEL P5 忠実）。

### Requirement 6: 単一被割当者の latest-wins 記録（§2.4・R-U6）

**Objective:** assign 系 write skill 作者として、被割当者を作業開始遷移の属性として単一・置換で記録したい。それにより第5イベントなしで割当を表せる。

#### Acceptance Criteria

1. The system shall record a node's single assignee as a property of a lifecycle `transition`, and shall allow a provisional assignee to be set ahead of time.
   - 和訳: システムは、ノードの単一被割当者をライフサイクル `transition` の属性として記録し、事前の暫定被割当者の設定を許可しなければならない。
2. When a new assignee is named on a later `transition`, the system shall replace the previous assignee by `(ts,id)` latest-wins rather than appending an additional assignee.
   - 和訳: 後続の `transition` で新しい被割当者が名指されたとき、システムは被割当者を追加するのではなく `(ts,id)` latest-wins で前任を置換しなければならない。
3. The system shall not model human skills or proficiency, and shall treat assignment as a human-provided input received via the emit path.
   - 和訳: システムは人間のスキルや習熟度をモデル化せず、割当を emit 経路で受け取る人間が与える入力として扱わなければならない。

### Requirement 7: 凍結見積値と理由付き改訂・ベースライン凍結記録（R-U7/I4）

**Objective:** rebaseline/estimate 系 write skill 作者として、見積を EVM 用最新値と説明責任用の凍結値で持ち、ベースラインの二次元を確定契機にログへ記録したい。それにより再導出の非決定性に依らず正本が固定される。なお完了時の見積寄与の凍結値そのものの算出（R-S1）は `moira-evm` が所有し、core は I4＝完了時に確定済み次元を施錠する機構と R-U7 凍結値の記録のみを担う（R12 AC3 と同じ「seam は core・値は downstream」パターン）。

#### Acceptance Criteria

1. The system shall record each estimate with a latest value (for EVM) and a reason-stamped frozen value (for accountability), requiring a change reason on every frozen-value revision.
   - 和訳: システムは各見積を、EVM 用の最新値と説明責任用の理由付き凍結値で記録し、凍結値改訂のたびに変更理由を必須としなければならない。
2. When a node's estimate becomes `agreed`, the system shall freeze its baseline budget value, recorded as an attribute of the agreement `transition`.
   - 和訳: ノードの見積が `agreed` になったとき、システムはそのベースライン予算値を、合意 `transition` の属性として記録して凍結しなければならない。
3. When a first-scheduling `transition` carries a baseline slot (the judgement of which scheduling is the first being emitted by `moira-schedule`), the system shall record that frozen baseline slot as a non-state-machine attribute of that `transition` and shall keep it immutable on later schedulings except by an explicit reason-stamped re-baseline; core enforces the recording and immutability, while schedule judges which scheduling is the first.
   - 和訳: 初回スケジュール載せの `transition`（どのスケジューリングが初回かの判定は `moira-schedule` が emit する）がベースライン・スロットを載せたとき、システムはその凍結ベースライン・スロットを当該 `transition` の状態機械の一部でない属性として記録し、明示的な理由付き再ベースラインを除き以後のスケジューリングで不変に保たなければならない。core は記録と不変性を enforce し、どのスケジューリングが初回かは schedule が判定する。
4. When a sub-unit is completed, the system shall lock the already-fixed baseline dimensions (budget only if agreed, slot only if scheduled) as of completion (I4) and refuse any further re-baseline of completed dimensions, the computation of the frozen estimate-contribution value at completion (R-S1) being owned by `moira-evm` while core enforces the lock and immutability.
   - 和訳: サブ単位が完了したとき、システムは既に確定済みのベースライン次元（予算は合意済みの場合のみ、スロットはスケジュール済みの場合のみ）を完了時点で施錠し（I4）、完了済み次元の以後の再ベースラインを拒否しなければならない。完了時の凍結見積寄与値の算出（R-S1）は `moira-evm` が所有し、core は施錠と不変性を enforce する。

### Requirement 8: 決定的マージと大域順序（I3/R-D5）

**Objective:** 永続層/畳み込み層作者として、同一ログ・同一実装で再導出が再現することを保証したい。それにより全下流が決定的な真実源を共有できる。

#### Acceptance Criteria

1. The system shall make every event id globally sortable and shall merge events deterministically by `(ts,id)`.
   - 和訳: システムは、すべての event id を大域ソート可能とし、`(ts,id)` でイベントを決定的にマージしなければならない。
2. If two events share a timestamp, then the system shall order them deterministically by globally-sortable event id.
   - 和訳: 2 イベントが同一時刻のとき、システムは大域ソート可能 id で決定的に順序付けしなければならない。
3. The system shall fold the same log under the same implementation into the same projected state, never mutating its input log during the fold.
   - 和訳: システムは、同一ログを同一実装の下で同一の projected 状態へ畳み込み、畳み込み中に入力ログを一切 mutate してはならない。

### Requirement 9: 辺の構造／policy 保持と循環拒否（I2/R-D3・R-D2/R-D4 構造面）

**Objective:** relate 系 write skill 作者として、辺の型・充足ポリシー・既定値を構造として保持させ、循環辺を構造的に拒否させたい。それにより大規模でも辺を物理増殖させずに辺関係を表現でき、述語の評価そのものは下流に委ねられる。なお充足述語の評価（先行充足＝ready-eligible の判定）と未指定時の既定閾値の**適用**（R-D1/D2/D4）は下流の `moira-scope-deps` が所有し、core は辺の型・既定 policy を**保持**するが ready／閾値を**評価しない**（構造境界 core）。

#### Acceptance Criteria

1. If a `relate` event would introduce a cycle across any edge kind (dependency or supersede), then the system shall reject it and surface a structural error.
   - 和訳: `relate` イベントがいずれかの辺種別（依存または置換）で循環を生む場合、システムはこれを拒否し、構造エラーとして顕在化しなければならない。
2. When a node decomposes, the system shall structurally retain each outbound edge at the node level and shall not physically multiply edges across the children, preserving the edge as the structural carrier of the logical predicate ("all leaves beneath the source satisfy the policy"); the evaluation of that predicate over the children is the responsibility owned downstream by `moira-scope-deps` (R-D4), which core's node-level structure enables but core itself does not evaluate.
   - 和訳: ノードが分解されたとき、システムは各流出辺をノード水準で構造的に保持し、子に対して辺を物理的に増殖させてはならず、辺を論理述語（「源の配下の全葉がポリシーを満たす」）の構造的な担い手として保つ。当該述語を子に対して評価する責務は下流の `moira-scope-deps`（R-D4）が所有し、core のノード水準の構造はそれを可能にするが core 自身は評価しない。
3. The system shall store the satisfaction threshold and edge kind as per-edge properties of the `relate` schema, and shall retain the per-edge-type default value (R-D2) as recorded structure; the per-edge storage and default retention being core's schema contract, the application of a default by edge type when unspecified — and any evaluation of the threshold against successor state — is the predicate-evaluation responsibility owned downstream by `moira-scope-deps` (roadmap R-D1–D4), which core's schema enables but does not itself evaluate.
   - 和訳: システムは充足閾値と辺種別を `relate` スキーマの辺ごとの属性として保持し、辺種別ごとの既定値（R-D2）を記録された構造として保持しなければならない——辺ごとの保持と既定値の保持は core のスキーマ契約である。未指定時に辺種別ごとの既定を**適用する**こと、および閾値を後続状態に対して**評価する**ことは下流の `moira-scope-deps`（roadmap R-D1–D4）が所有する述語評価の責務であり、core のスキーマはそれを可能にするが core 自身は評価しない。

### Requirement 10: supersede と現行有効集合の導出（R-S5/R-D7/§2.7）

**Objective:** read spec（evm/scope-deps/schedule/health）作者として、現行有効集合を出来高と区別して導出する単一の基盤がほしい。それにより supersede された旧作業が現行機能と誤読されない。

#### Acceptance Criteria

1. The system shall derive the currently-effective set as the leaves not superseded (R-S5/§2.7), distinctly from the cumulative EV (EV_abs) basis, so that work earned but later superseded is not misread as a currently-effective feature. (The precise two-stage derivation — compute the effective nodes, then take those with no effective child, so that an intermediate node whose children are all superseded/cancelled becomes an effective leaf — is a design-level elaboration of this MODEL wording, fixed in design.md, not at the AC level, to keep this AC within the MODEL text.)
   - 和訳: システムは現行有効集合を、supersede されていない葉（R-S5/§2.7）として、累積EV(EV_abs) basis とは区別して導出し、出来高として計上されたが後に supersede された作業が現行有効な機能と誤読されないようにしなければならない。（「まず effective ノードを算出し、次に effective な子を持たないものを採る——子が全て supersede/cancelled された中間ノードは現行有効葉になる」という精密な二段導出は、本 MODEL 文言の design レベルの敷衍であり、本 AC を MODEL 文言内に留めるため AC ではなく design.md で確定する。）
2. When an enhancement is recorded as a new node plus a supersede edge pointing new→old, the system shall keep the old node append-only immutable (never deleting or mutating its accepted history); the representation discipline of choosing a new node + supersede edge over reopening the old node by backward transition is a write-skill convention (`moira-relate-edit`/`moira-decompose-author`, R-D7), and any backward transition that is nonetheless emitted on the old node is recorded — not rejected on grounds of transition legality (Requirement 5.6) — with its anomaly warning owned downstream by `moira-health` (P5); core enforces only the old node's append-only immutability and the edge's acyclicity (I2), not a backward-transition prohibition.
   - 和訳: エンハンスが新ノードと、新→旧を指す supersede 辺として記録されたとき、システムは旧ノードを append-only で不変に保たなければならない（その accepted 履歴を削除・mutate しない）。旧ノードを後退遷移で再オープンする代わりに新ノード＋supersede 辺を選ぶ表現上の規律は write skill の規約（`moira-relate-edit`/`moira-decompose-author`、R-D7）であり、それでもなお旧ノードに後退遷移が emit された場合は——遷移合法性を理由に拒否せず（Requirement 5.6）——記録され、その異常警告は下流の `moira-health`（P5）が所有する。core が enforce するのは旧ノードの append-only 不変と辺の非循環（I2）のみであり、後退遷移の禁止ではない。
3. When a superseding (new) node transitions to `cancelled`, the system shall ignore that supersede edge when computing the currently-effective set, so the old node re-enters the set, while the supersede edge remains on the log.
   - 和訳: supersede 元（新）ノードが `cancelled` へ遷移したとき、システムは現行有効集合の算出時に当該 supersede 辺を無視し、旧ノードが集合へ復帰するようにし、supersede 辺自体はログに残さなければならない。
4. The system shall keep the supersede edge acyclic via the no-cycle invariant (I2) without a separate directional invariant, the new→old direction following from the append-only generation order.
   - 和訳: システムは supersede 辺の非循環を、独立した向きの不変条件を設けず非循環不変条件（I2）で担保し、新→旧の向きは追記専用の生成順から従わせなければならない。

### Requirement 11: I1 見積整合と未見積子の除外（I1）

**Objective:** 導出層作者として、親の最新見積を合意済み子の総和として保ち、未見積子をカバレッジ低下として現したい。それにより整合は合意済み領域で常に成立する。

#### Acceptance Criteria

1. The system shall keep a parent's latest estimate equal to the sum of its agreed children's latest estimates, with primitive estimates only on leaves.
   - 和訳: システムは、親の最新見積を合意済みの子の最新見積の総和に等しく保ち、原始的見積を葉のみに置かなければならない。
2. The system shall exclude a child born without an estimate (e.g. an implementation node just created on tasks completion) from this I1 sum until its implementation estimate is agreed; the resulting shortfall surfacing as a coverage drop (estimate coverage P2) is owned downstream by `moira-evm`, core enforcing only the sum-exclusion invariant.
   - 和訳: システムは、未見積で誕生した子（例: tasks 完了で生まれた直後の実装ノード）を、その実装見積が合意されるまでこの I1 総和から除外しなければならない。その不足がカバレッジ低下（見積カバレッジ P2）として顕在化することは下流の `moira-evm` が所有し、core は総和除外の不変条件のみを enforce する。
3. The system shall exclude a completed-but-unagreed node from this I1 sum until it is agreed; the consequent exclusion of its EV_abs contribution (an EV_abs metric owned by `moira-evm`, R-U8) and the unagreed-completion warning (R-U13) are downstream, core enforcing only the structural sum-exclusion regardless of downstream warning.
   - 和訳: システムは、完了済みだが未合意のノードを、合意されるまでこの I1 総和から除外しなければならない。その帰結としての EV_abs 寄与の除外（EV_abs メトリクスは `moira-evm` 所有、R-U8）および未合意完了警告（R-U13）は下流が所有し、core は下流警告の有無に関わらず構造的な総和除外のみを enforce する。

### Requirement 12: オーケストレータ・シーム契約と再導出契機（R-S2/P0）

**Objective:** read サーフェス作者として、同一ログから R-S2 の導出群を読み出す単一のオーケストレータ・シームがほしい。core はこのシームを開ける（値は下流が供給）だけで、各導出値の算出・所有は持たず、消費者ごとの再計算は禁止し、再導出契機はイベント追記または構成入力（c・期日・目標日）変更に限る。それにより各サーフェスが二度目の計算をせず、未コミット領域を可視ギャップとして読める。

#### Acceptance Criteria

1. When any event is appended, the system shall make the updated derived state available from the same log to all read consumers as a single derivation, never as a second recalculation per consumer.
   - 和訳: イベントが追記されたとき、システムは更新後の導出状態を、同一ログから全 read 消費者へ単一の導出として提供し、消費者ごとの二度目の再計算として提供してはならない。
2. When a configuration input (c, deadline, or target date) changes, the system shall re-derive, since these inputs are not themselves events.
   - 和訳: 構成入力（c・期日・目標日）が変化したとき、システムは再導出しなければならない（これらの入力はイベント自体ではないため）。
3. The system shall provide a single orchestrator seam binding the derivation items that MODEL R-S2 enumerates — node states, EV% and EV_abs, estimate coverage, execution coverage (R-S8), PV (baseline), AC, SPI, CPI, queues, live forecast schedule, unassigned backlog, and schedule buffer remaining/consumption (R-T6) — such that all items are surfaced to all three dashboards from the same log through this single orchestrator that holds no source of truth and no hidden mutable cache between layers; core opens the orchestrator seam and holds none of these values, the computation and ownership of each item being downstream — the EV/coverage/PV/AC/SPI/CPI/sunk family by `moira-evm` (which owns execution coverage R-S8), and the forecast/buffer/unassigned-backlog/queues family by `moira-schedule` (which owns the schedule buffer R-T6 and the P4 queues).
   - 和訳: システムは MODEL R-S2 が列挙する導出項目（ノード状態・EV%・EV_abs・見積カバレッジ・実行カバレッジ(R-S8)・PV(ベースライン)・AC・SPI・CPI・各キュー・生きた予測スケジュール・未割当バックログ・スケジュールバッファ残量/消費率(R-T6)）を束ねる単一オーケストレータのシームを提供し、これら全項目が、層間に真実源も隠れた可変キャッシュも持たない当該単一オーケストレータ経由で同一ログから三ダッシュボードへ提示されるようにしなければならない。core はオーケストレータのシームを開けるがこれら項目のいずれの値も保持せず、各項目の算出と所有は下流にある——EV/被覆/PV/AC/SPI/CPI/sunk 系は `moira-evm`（実行カバレッジ R-S8 を所有）、予測/バッファ/未割当バックログ/queues 系は `moira-schedule`（スケジュールバッファ R-T6 と P4 queues を所有）。
4. The system shall present every derived metric as speaking only of its committed region and shall expose the uncommitted region as a visible gap, not implicitly assumed.
   - 和訳: システムは各導出メトリクスをそのコミット領域についてのみ語るものとして提示し、未コミット領域を暗黙に仮定せず可視ギャップとして公開しなければならない。

### Requirement 13: チケットは射影（A1/R-U1）

**Objective:** ticket 系 write skill / surface 作者として、チケットをノードの読み出し専用射影として扱う契約がほしい。それによりチケットからノードへの逆書き込み経路が存在しないことを保証できる。

#### Acceptance Criteria

1. The system shall treat the spec and its node decomposition as the single source of truth and shall represent every ticket as a read-only projection of a node.
   - 和訳: システムは spec とそのノード分解を唯一の真実とし、あらゆるチケットをノードの読み出し専用射影として表現しなければならない。
2. If an external ticket-side change is to be reflected, then the system shall accept it only as a re-emission of the four events via an ingestion path, providing no direct ticket→node write-back.
   - 和訳: 外部チケット側の変更を反映する場合、システムはそれを取り込み経路経由の 4 イベントの再発行としてのみ受理し、チケットからノードへの直接の逆書き込みを提供してはならない。
3. The system shall not prescribe projection target, multiplicity, or mechanism, leaving them to the projecting implementation.
   - 和訳: システムは射影の対象・多重度・メカニズムを規定せず、射影する実装に委ねなければならない。

### Requirement 14: 永続化方式と再現可能な再導出（A2/R-U14・tech.md 決定基準）

**Objective:** プロジェクトとして、追記専用ログと第二層を永続化しつつログからの再導出が再現可能な永続化方式を決定したい。それにより S4 縦スライスを本番永続層へ昇格できる。

#### Acceptance Criteria

1. The system shall persist the append-only event log such that the deterministic `(ts,id)` order is naturally preserved across reload.
   - 和訳: システムは、決定的 `(ts,id)` 順序が再ロードをまたいで自然に保たれるように、追記専用イベントログを永続化しなければならない。
2. The system shall persist the second tier (c(i,d), deadline, target date) as an independent tier with its own append-only, reason-stamped, timestamped history.
   - 和訳: システムは第二層（c(i,d)・期日・目標日）を、独自の追記専用・理由付き・タイムスタンプ付き履歴を持つ独立 tier として永続化しなければならない。
3. The system shall reproduce the same derived state from the persisted log under the same implementation, holding no derived state as a source of truth.
   - 和訳: システムは、永続化されたログから同一実装の下で同一の導出状態を再現し、導出状態を真実源として保持してはならない。
4. The system shall maintain the c(i,d) change history sufficient to enable reproducible schedule derivation, the change history not required to conform to the four event kinds.
   - 和訳: システムは、スケジュール導出の再現を可能にするのに十分な c(i,d) の変更履歴を維持しなければならない（変更履歴は 4 イベント種別に準拠する必要はない）。

## MODEL Traceability

各 AC（要件 ID `<Req番号>.<AC番号>`）の MODEL（SSOT）出所。見出し括弧の自由記述に依存せず、下流 design.md の Requirements Traceability と検証ツールが `<Req.AC> ↔ MODEL R-*/§` を機械照合するための正典対応表。MODEL 記号（R-*/§/A/P/I）は SSOT への参照であり、trace-notation の要件 ID ref-list（spec 間参照）とは別系統。下流所有が確定している項目は「下流所有」を付す。

| AC | MODEL 出所 | 注 |
|---|---|---|
| 1.1 | A1 | |
| 1.2 | A1 | |
| 1.3 | §2.8, A2 | |
| 1.4 | A2, §5 | 二層データ |
| 1.5 | A2 | append-only 不変 |
| 2.1 | R-U2, A2 | |
| 2.2 | §5, R-U14 | 第二層 capacity |
| 2.3 | §5, R-T6 | 第二層 期日/目標日（R-T6 設定面） |
| 2.4 | R-U2, A2 | read は read-only |
| 2.5 | §5, I3 | 第二層の同一キー矛盾を `(ts,id)` latest-wins で解決; 人間内部権威裁定はスコープ外 |
| 3.1 | §2.8 | 凍結属性の記録契機は Req7 が律する |
| 3.2 | §2.8 | |
| 3.3 | §2.8, R-D3 | |
| 3.4 | §2.8, R-U10 | |
| 3.5 | §2.8, A6 | |
| 4.1 | R-U3, A5 | |
| 4.2 | I6 | 人間限定の合意権限ゲート; budget 凍結は 7.2 に一本化（R-U7/§3） |
| 4.3 | I6 | R-U4 人間承認オーケストレーションは `moira-estimate-agree` 所有 |
| 4.4 | R-E3, R-U3 | |
| 5.1 | §2.5, R-D6 | |
| 5.2 | R-D6, I5 | |
| 5.3 | §2.5, P5 | P5 検出は下流所有 |
| 5.4 | §2.5 | spec 可動異常は下流警告 |
| 5.5 | R-C1, §2.5 | cancelled 終端遷移の受理＋fold は core; R-C3 孤児判定は `moira-scope-deps`、emit は `moira-cancel-scope` 所有 |
| 5.6 | R-D7, P5, I6 | 後退遷移は記録のみ（拒否しない）; 拒否は構造違反（I2/I6）のみ; P5 at-risk 検知は `moira-health` 所有 |
| 6.1 | §2.4, R-U6 | |
| 6.2 | §2.4, I3 | latest-wins |
| 6.3 | R-U6, A4 | 能力非モデル化 |
| 7.1 | R-U7 | |
| 7.2 | R-U7, §3 | 予算凍結=合意時 |
| 7.3 | §3 | スロット凍結=初回スケジュール（初回判定は `moira-schedule` 所有） |
| 7.4 | I4 | 完了施錠; R-S1 凍結見積寄与値の算出は `moira-evm` 所有 |
| 8.1 | I3, R-D5 | |
| 8.2 | I3, R-D5 | |
| 8.3 | A2, R-D5 | fold 不変 |
| 9.1 | I2, R-D3 | |
| 9.2 | R-D4 | 辺の node 水準保持・非物理増殖は core の構造; 述語評価は `moira-scope-deps` 所有 |
| 9.3 | R-D2 | 閾値・辺種別・既定値の per-edge 保持は core のスキーマ契約; 未指定時の既定「適用」と閾値評価は `moira-scope-deps` 所有（roadmap R-D1–D4） |
| 10.1 | R-S5, §2.7 | effective-set |
| 10.2 | R-S5, R-D7, I2 | 旧ノード append-only 不変＋辺の非循環(I2)のみ core enforce; 後退遷移禁止は enforce しない(5.6)、表現規律は `moira-relate-edit`/`moira-decompose-author` 所有 |
| 10.3 | R-S5, §2.7 | restoration |
| 10.4 | I2, R-D7 | 非循環 |
| 11.1 | I1 | |
| 11.2 | I1 | core は総和除外を enforce; coverage drop 顕在化（P2 見積カバレッジ）は `moira-evm` 所有 |
| 11.3 | I1 | core は総和除外を enforce; EV_abs 寄与除外（R-U8）と R-U13 警告は下流（`moira-evm`/`moira-health`）所有 |
| 12.1 | R-S2 | |
| 12.2 | R-S2, A4 | 構成入力変更で再導出 |
| 12.3 | R-S2 | seam のみ core; 値は下流所有（exec被覆 R-S8=`moira-evm`, buffer R-T6・queues P4=`moira-schedule`）。R-S2 実列挙=13項目で schedule被覆は含まない（roadmap §要件カバレッジ） |
| 12.4 | P0 | 可視ギャップ |
| 13.1 | A1, R-U1 | |
| 13.2 | R-U1 | 取り込みは `moira-ingestion-adapter`/spec-ingest 所有 |
| 13.3 | R-U1 | |
| 14.1 | A2, R-U14 | |
| 14.2 | §5, R-U14 | |
| 14.3 | A2 | 導出は真実源にしない |
| 14.4 | R-U14, A4 | c 変更履歴 |
