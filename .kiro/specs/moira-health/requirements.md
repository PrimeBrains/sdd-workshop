# Requirements Document

## Introduction

`moira-health` は Moira 正典モデル `moira/MODEL.md`(v20) を本番アーキテクチャへ落とす **CQRS 分解の Wave2** であり、MODEL の中核思想「システムは観測・導出・警告に徹し、コミットメントを伴う判断は人間に残す」(§0/§2.1) のうち **警告(warning)の確定・集約・clearance(消滅)** を単一の責務として所有する read=導出 spec である。具体的には次を所有する:

1. **9 警告の確定・集約** — R-U12/R-U13/R-T3/R-T4/R-S3/R-S6/R-S7/R-C3 および P5 at-risk を、上流 derivation(`moira-evm`/`moira-schedule`/`moira-scope-deps`)が出す検出データを受けて**現在の導出状態に対する述語**として確定し集約する(判断型 8 件を decision インボックスへ集約、de-rate 型 R-S6 は inbox 非集約＝常駐メトリクス修飾という集約形に分類する; R-S6 の SPI de-rate 消費は `moira-evm`、提示は `moira-surface-health` が所有し health は分類のみ; UI-ARCHITECTURE §4.2/§3)。
2. **clearance(消滅トリガー)の単一定義** — 各警告が「条件を偽化する入力(4 イベント追記 または 構成入力 c/期日/目標日 変更)」でのみ消え、acknowledge(イベント無し)では消えないこと(§2.1 警告持続)。
3. **行為列挙(取りうる行為)の単一定義** — 各警告が提示する行為候補を**導出層に一度だけ**定義し、下流(`moira-surface-decision`/`moira-evm-digest`)は読むだけにする(UI-ARCHITECTURE §6)。
4. **可視ギャップ会計の保証** — 警告を可視ギャップの会計から除いてはならない(P0 falsifiable な線)。acknowledge/dismiss/seen の可変状態を持たない(最小性; §5)。

本 spec は MODEL を唯一の真実源(SSOT)とし、MODEL の文言を変えず・新概念を足さず、その実装落とし込み(警告の確定・集約・clearance・行為列挙)に徹する。各警告の**検出ロジック自体**は各導出 spec が所有し(roadmap Boundary Strategy「warning 述語: 検出データは各 derivation、警告確定/集約は moira-health」)、本 spec は検出データを集約・確定する。`moira-core` の derive 契約(同一ログ・同一実装で再現する R-S2 導出群)を消費し、自前の真実源・可変状態を持たない。

数式・magic number・閾値(thrashing の sustained window・過負荷の発火窓・R-S7 の乖離閾値・低カバレッジの de-rate 閾値)は本書に埋め込まない(これらは検出側 derivation が所有し実装定義)。

## Boundary Context

- **In scope（health が所有）**: 9 警告の確定・集約(検出データの受け口)、各警告を**現在の導出状態に対する述語**として導出すること、再評価契機(イベント追記 AND 構成入力 c/期日/目標日 変更; R-S2)、clearance(消滅トリガー)の単一定義(条件偽化入力でのみ消滅・acknowledge では消えない)、判断型(8 件)の集約と de-rate 型(R-S6)の集約対象外＝常駐メトリクス修飾という集約形への分類(R-S6 の SPI de-rate 消費・提示は health の責務でなく `moira-evm`／`moira-surface-health` が所有)、各警告の**行為列挙(取りうる行為)の単一定義**(導出層に一度だけ)、可視ギャップ会計からの除去禁止(P0)、acknowledge/dismiss/seen 可変状態の不在(最小性)。
- **Out of scope（上流/下流が所有）**: 各警告の**検出述語/ロジック本体**= R-T3/R-T4/R-S6/R-S7 → `moira-schedule`、R-S3 → `moira-evm`、R-C3 依存辺評価 → `moira-scope-deps`、R-U12/R-U13/P5 の基礎状態(agreed 値・lifecycle・reachedImplemented) → `moira-core`(状態機械/projected)。emit/derive/二層データ/effective-set/latest-wins/状態機械/凍結記録 の**契約定義**= `moira-core`(本 spec は消費)。指標式本体 = `moira-evm`、leveler/予測/buffer 導出 = `moira-schedule`。警告の**提示**(レイアウト・畳み込み・淡色化・並び替え・deep-link) = surface spec(本 spec は提示の下限=何を surface すべきか・会計に残すこと のみ)。警告→サーフェスの **host/ルーティング**(どのダッシュボードへ載せるか、各警告の文脈ビュー= deep-link 先〔例: R-C3 の spec-value／schedule-time〕の決定) = 提示(`moira-surface-decision`／各ダッシュボード)の責務であり、health は集約形(判断型=decision インボックス集約 か de-rate 型=常駐メトリクス修飾 か)のみを定義する。**「既読/既知」と「新規」の seen 状態の区別・判定** = 提示層の責務(§2.1 顕著さの制御);health は seen の真実源を持たず、条件が真の警告を会計に残す件数のみを語る。警告解消の**書き(commit)** = write skill(reschedule/cancel-scope/estimate-agree 等; 検出=読 / 解消=書 の分離)。
- **Adjacent expectations**: 本 spec は上流 derivation(evm/schedule/scope-deps)の検出データと `moira-core` の derive(R-S2)を**消費**する。検出側の述語が真を返す条件が変われば本 spec の集約結果も変わる。本 spec が**定義**する行為列挙・集約形を、下流の `moira-surface-decision`・`moira-evm-digest` が**消費**する(導出層に一本化; 二重実装禁止)。検出データの形・derive 契約が変われば本 spec が再検証を要する。

## Requirements

### Requirement 1: 警告は現在の導出状態に対する述語（§2.1・R-S2）

**Objective:** 健全性ダッシュボード作者として、9 警告すべてを「現在の導出状態に対する述語」として導出する単一の基盤がほしい。それにより歴史的事実の蓄積でなく、今真である条件だけが警告として現れる。

#### Acceptance Criteria

1. The system shall derive every warning (R-U12, R-U13, R-T3, R-T4, R-S3, R-S6, R-S7, R-C3, and P5 at-risk) as a predicate over the current derived state, not over the mere historical existence of a past condition.
   - 和訳: システムは、すべての警告(R-U12・R-U13・R-T3・R-T4・R-S3・R-S6・R-S7・R-C3 および P5 at-risk)を、過去に条件が存在したという歴史的事実そのものではなく、**現在の導出状態に対する述語**として導出しなければならない。
2. When any of the four events is appended, the system shall re-evaluate every warning predicate against the updated derived state.
   - 和訳: 4 イベントのいずれかが追記されたとき、システムは更新後の導出状態に対してすべての警告述語を再評価しなければならない。
3. When a configuration input (c, deadline, or target date) changes, the system shall re-evaluate every warning predicate, since these inputs are not themselves events.
   - 和訳: 構成入力(c・期日・目標日)が変化したとき、システムはすべての警告述語を再評価しなければならない(これらの入力はイベント自体ではないため)。
4. The system shall derive every warning by consuming the upstream derivations' detection data and `moira-core` derive output, holding no source of truth and no hidden mutable cache of its own.
   - 和訳: システムはすべての警告を、上流 derivation の検出データと `moira-core` の derive 出力を消費して導出し、自前の真実源も隠れた可変キャッシュも持ってはならない。

### Requirement 2: clearance は条件偽化入力でのみ・acknowledge では消えない（§2.1 警告持続）

**Objective:** モデル設計者として、警告が「commit(イベント)で消え、acknowledge(イベント無し)では消えない」ことを単一定義したい。それにより true positive を隠す dismiss/snooze の反パターン(§0/P0)を構造的に排除できる。

#### Acceptance Criteria

1. As the result of the re-evaluation defined in R1 (over the same input set R1 enumerates — four-event append or configuration-input change), the system shall clear a warning only when that re-evaluation finds an input has falsified the warning's current condition; while the condition stays true the warning persists.
   - 和訳: R1 が定義する再評価(R1 が列挙する同一入力集合——4 イベント追記 または 構成入力変更——を契機とする)の結果として、システムは、ある警告を、その再評価が「入力が当該警告の現在条件を偽化した」と判定したときに**のみ**消さなければならない。条件が真のままなら警告は持続する。
2. While a warning's condition remains true, the system shall keep the warning present even when a human has seen and accepted it without emitting any event (a legitimate non-commitment).
   - 和訳: 警告の条件が真である間、システムは、人間がそれを見て受容しイベントを起こさない(正当な非コミット)場合でも、警告を残さなければならない。
3. The system shall not maintain any acknowledge, dismiss, or seen mutable state for warnings.
   - 和訳: システムは、警告に対する acknowledge・dismiss・既読の可変状態を一切保持してはならない。
4. The system shall expose, for each warning, the clearance condition that falsifies it (the commitment input that makes it disappear), as derived data.
   - 和訳: システムは各警告について、それを偽化する clearance 条件(消滅させるコミット入力)を導出データとして提示しなければならない。

### Requirement 3: 行為列挙の単一定義（UI-ARCHITECTURE §6・行為列挙の単一定義）

**Objective:** surface-decision / evm-digest 作者として、各警告の取りうる行為を導出層から読むだけにしたい。それにより行為候補が複数の読み手で二重実装されず「二つの真実」を招かない。

#### Acceptance Criteria

1. The system shall hold here, once, the concrete action enumeration for every action-bearing warning as read-only derived data: R-U13 = {retroactive agreement, re-estimate (R-E3) then agree, cancel}; R-T4 = {scope cut, added resource, deadline change}; R-S7 = {reason-stamped re-baseline, confirm}; R-C3 = {remove the edge (`relate`), redirect to an alternative predecessor (`relate`), cancel the successor (`transition`)}; and the per-warning requirements (R6/R7/R8) shall reference this enumeration rather than re-stating the concrete action lists.
   - 和訳: システムは、行為を伴う各警告の**具体的な行為列挙**をここに一度だけ読み出し専用の導出データとして保持しなければならない: R-U13＝{即時事後合意・再見積(R-E3)→合意・cancel}、R-T4＝{スコープ削減・要員追加・期日変更}、R-S7＝{理由付き再ベースライン・確認}、R-C3＝{辺の除去(`relate`)・代替先行への付け替え(`relate`)・後続のキャンセル(`transition`)}。各警告要件(R6/R7/R8)は、具体的な行為リストを再掲せず**この列挙を参照**しなければならない。
2. The system shall be the single authoritative location of these action enumerations and shall expose them as read-only derived data for downstream consumers to read without recomputation; no downstream surface or skill shall re-define a warning's action enumeration.
   - 和訳: システムは、これらの行為列挙の**唯一の正本所在**であり、それらを下流の消費者が再計算せず読み出せる読み出し専用の導出データとして提示しなければならない。いかなる下流サーフェスや skill も警告の行為列挙を再定義してはならない。

### Requirement 4: 判断型警告の集約と de-rate 型の区別（UI-ARCHITECTURE §4.2/§3・R-S6）

**Objective:** decision インボックス作者として、判断・行為を要する警告だけを集約し、解釈の割引にすぎない de-rate 型を常駐メトリクス修飾へ分けたい。それにより inbox が行為項目に絞られ、9 件すべてに host が確保される。

#### Acceptance Criteria

1. The system shall aggregate the eight judgement/action warnings (R-U12, R-U13, R-T3, R-T4, R-S3, R-S7, R-C3, and P5 at-risk) into the decision-inbox collection.
   - 和訳: システムは、判断・行為を要する 8 件の警告(R-U12・R-U13・R-T3・R-T4・R-S3・R-S7・R-C3 および P5 at-risk)を decision インボックス集合へ集約しなければならない。
2. The system shall classify the de-rate-type warning R-S6 (SPI de-rate) as a standing-metric-modifier aggregation form rather than a decision-inbox item, so that all nine warnings have a host (eight inbox + R-S6 standing). The system shall not itself consume R-S6 to de-rate SPI nor present it; the SPI de-rate consumption is owned by `moira-evm` and its presentation by `moira-surface-health` (検出=読 / 解消=書, and host/routing/presentation = 提示の責務).
   - 和訳: システムは、de-rate 型の警告 R-S6(SPI de-rate)を、decision インボックス項目ではなく**常駐メトリクス修飾という集約形**として分類し、9 件すべての警告に host があるようにしなければならない(inbox 8 件＋R-S6 常駐＝計 9)。システムは R-S6 を自ら消費して SPI を de-rate してはならず、また提示してもならない。SPI の de-rate 消費は `moira-evm` が、その提示は `moira-surface-health` が所有する(検出=読 / 解消=書、host/ルーティング/提示=提示の責務)。

### Requirement 5: 可視ギャップ会計からの除去禁止（P0・falsifiable な線）

**Objective:** モデル設計者として、いかなる提示も警告を可視ギャップの会計から落とさないことを保証したい。それにより顕著さの抑制は許しつつ、true positive の隠蔽(P0 違反)を構造的に防げる。

#### Acceptance Criteria

1. The system shall keep every warning whose condition is true in the visible-gap accounting (the count and list), even while presentation de-emphasizes, collapses, groups, or re-sorts it.
   - 和訳: システムは、提示が淡色化・畳み込み・グループ化・並び替えをしている間も、条件が真であるすべての警告を可視ギャップの会計(カウントとリスト)に残さなければならない。
2. The system shall not remove a still-true warning from the derived state or the visible-gap accounting under any presentation choice.
   - 和訳: システムは、いかなる提示上の選択の下でも、依然真である警告を導出状態または可視ギャップ会計から除去してはならない。
3. The system shall expose a visible-gap count that includes standing (still-true, persisting across re-derivations) warnings together with newly-true ones, so that accounting inclusion is observable.
   - 和訳: システムは、据え置き(条件が真のまま再導出をまたいで持続している)警告を新規に真になった警告とともに含む可視ギャップ件数を提示し、会計算入が観測可能であるようにしなければならない。

### Requirement 6: 矛盾合意・未合意完了・at-risk の確定（R-U12・R-U13・P5）

**Objective:** spec-value 文脈の読み手として、合意/状態起因の 3 警告を core の projected 状態から確定したい。それにより矛盾合意・未合意完了・仕様FIX 誤判定の at-risk を現在状態で集約できる。

#### Acceptance Criteria

1. If two or more distinct human actors hold differing current frozen agreed values on the same estimate node (evaluated over the current latest-wins values per I3), then the system shall raise an R-U12 contradiction-agreement warning identifying the conflicting actors and values, and shall clear it when a human re-emits an `agreed` whose frozen value aligns the current values across actors.
   - 和訳: 二人以上の**異なる**人間が同一見積ノードに**異なる**現行凍結 agreed 値を持つ場合(現行 latest-wins 値で判定; I3)、システムは競合する行為者と値を特定する R-U12 矛盾合意警告を発し、いずれかの人間が現行値を actor 間で揃える凍結値で `agreed` を再発行したとき消さなければならない。
2. If a node reaches a completed state (`implemented` or `accepted`) while its estimate is still `proposed` (not agreed), then the system shall raise an R-U13 unagreed-completion warning carrying R-U13's action enumeration as defined once by R3.
   - 和訳: ノードが見積 `proposed`(未合意)のまま完了状態(`implemented` または `accepted`)に到達した場合、システムは R-U13 未合意完了警告を発し、R3 が一度だけ定義する R-U13 の行為列挙を伴わなければならない。
3. While a node has reached `implemented` and has backslid afterward without re-reaching `implemented`, the system shall raise a P5 at-risk warning, and shall clear it only when the node re-reaches `implemented` (not on a successor's own completion).
   - 和訳: ノードが `implemented` に到達した後に後退し、まだ `implemented` 以降に再到達していない間、システムは P5 at-risk 警告を発し、当該ノードが `implemented` へ再到達したときに**のみ**消さなければならない(後続自身の完了では消さない)。
4. The system shall not auto-resolve an R-U12 contradiction; the latest-wins value (I3) remains the current value pending human resolution, and authority within the human set remains out of scope.
   - 和訳: システムは R-U12 の矛盾を自動解決してはならない。人間の解決を待つ間 latest-wins 値(I3)が現行値として残り、人間集合内部の権威裁定はスコープ外である。

### Requirement 7: スケジュール起因警告の確定（R-T3・R-T4・R-S7）

**Objective:** schedule-time 文脈の読み手として、`moira-schedule` の検出データから過負荷・期日超過・スロット陳腐化の 3 警告を確定したい。それにより検出ロジックを再実装せず集約と clearance だけを担える。

#### Acceptance Criteria

1. While the schedule's detection data reports an over-allocation that the human-provided assignment cannot fit `c(i,d)` leveling for some person over some window (including AC on a c=0 day), the system shall raise an R-T3 over-allocation warning identifying the person and window, and shall clear it when the schedule detection data no longer reports the over-allocation (e.g. after a re-assignment (transition) or a c change falsifies the condition). The falsification mechanism and any implementation-defined window are owned by the schedule detection side; health consumes the detection result and does not define the window.
   - 和訳: schedule の検出データが、人間が与えた割当をある人物・ある期間で `c(i,d)` 平準化に収められない過負荷(c=0 の日の AC を含む)を報告している間、システムは当該人物と期間を特定する R-T3 過負荷警告を発し、schedule の検出データが当該過負荷を報告しなくなったとき(例: 再割当(transition)または c の変更が条件を偽化した後)に消さなければならない。偽化の機序や実装定義の窓は schedule 検出側が所有し、health は検出結果を消費するのみで窓を定義しない。
2. While the derived schedule exceeds the external deadline, the system shall raise an R-T4 deadline-overrun warning carrying the overrun magnitude (derived completion − deadline) and R-T4's action enumeration as defined once by R3, clearing it only when a commitment brings the derived schedule within the deadline; accepting the overrun without action shall not clear it.
   - 和訳: 導出スケジュールが外部期日を超える間、システムは超過量(導出完了 − 期日)と、R3 が一度だけ定義する R-T4 の行為列挙を伴う R-T4 期日超過警告を発し、コミットによって導出スケジュールが期日内に収まったときに**のみ**消さなければならない(超過を受容して行動しないことはこれを消さない)。
3. While a sub-unit's live-forecast completion diverges from its frozen baseline slot, the system shall raise an R-S7 stale-slot warning, surface the stale-slot count attributed by cause (assignment change vs c change), and carry R-S7's action enumeration as defined once by R3, clearing it only when a re-baseline event re-draws the slot or the live forecast re-converges; confirm (deliberate non-commitment) shall not clear it.
   - 和訳: あるサブ単位の生きた予測完了が凍結ベースライン・スロットと乖離する間、システムは R-S7 スロット陳腐化警告を発し、陳腐化スロット数を**原因別**(割当変更 vs c 変更)に提示し、R3 が一度だけ定義する R-S7 の行為列挙を伴い、再ベースライン(イベント)がスロットを引き直すか生きた予測が再収束したときに**のみ**消さなければならない(確認=意図的な非コミットはこれを消さない)。
4. The system shall surface R-S7 as a visible gap independent of R-S6, since both may hold at once (R-S6 de-rates SPI by low schedule coverage while R-S7 flags individual stale slots).
   - 和訳: システムは R-S7 を R-S6 とは独立した可視ギャップとして表出しなければならない(両方が同時に該当しうる——R-S6 はスケジュールカバレッジの低さで SPI を de-rate し、R-S7 は個別の陳腐化スロットを標識する)。

### Requirement 8: thrashing とキャンセル孤児の確定（R-S3・R-C3）

**Objective:** 健全性の読み手として、`moira-evm`/`moira-scope-deps` の検出データから thrashing とキャンセル孤児を確定したい。それにより空回りと孤立後続を集約し、誤発火を抑止しつつ行為候補を提示できる。

#### Acceptance Criteria

1. While a node's EV_abs is non-increasing and its AC continues to rise over a sustained window (per the evm detection data), the system shall raise an R-S3 thrashing warning, and shall not raise it for a one-off cost from a folded estimation activity (R-E2b) **or a folded review activity (§7#18(b))** landing without an estimate (MODEL R-S3 本文と一致；2026-07-04 追いつき＝畳んだレビュー carve-out の取りこぼし解消・moira-evm Req11.2 と同期).
   - 和訳: ノードの EV_abs が増えない一方 AC が継続的な期間にわたり増え続ける間(evm の検出データに従う)、システムは R-S3 thrashing 警告を発し、畳んだ見積活動(R-E2b)**または畳んだレビュー作業(§7#18(b))**が見積なしに一度だけ計上する cost に対してはこれを発してはならない（carve-out は各回の畳み cost を単独で免責するのみで、反復差し戻しによる持続的 AC 増での正当な発火は妨げない）。
2. While a predecessor node is terminal `cancelled` and a dependency edge's satisfaction threshold from it has become permanently unsatisfiable (per the scope-deps detection data), the system shall raise an R-C3 cancel-orphan warning identifying the blocked successor and the unsatisfied edge, carrying R-C3's action enumeration as defined once by R3.
   - 和訳: 先行ノードが終端 `cancelled` であり、そこからの依存辺の充足閾値が永久に充足不能になっている間(scope-deps の検出データに従う)、システムは R-C3 キャンセル孤児警告を発し、被ブロック後続・未充足辺を特定し、R3 が一度だけ定義する R-C3 の行為列挙を伴わなければならない。
3. The system shall not auto-cancel a successor under R-C3 in any case — whether all or some predecessors are cancelled, the human decides.
   - 和訳: システムは R-C3 の下で後続を自動キャンセルしてはならない——全先行 cancelled でも一部先行 cancelled でも人間が決定する。
4. The system shall consume the R-C3 orphan detection data from `moira-scope-deps` (already restricted to dependency edges excluding supersede edges, with tree-children evaluated through their DAG dependency edge rather than the ownership tree per MODEL R-C3) and aggregate it as a warning, without itself re-defining the edge-type restriction or the tree-vs-DAG evaluation rule.
   - 和訳: システムは、R-C3 の孤児検出データを `moira-scope-deps` から消費し(同データは MODEL R-C3 に従い、supersede 辺を除く依存辺に限定され、木の子ノードは所有木ではなく DAG 依存辺を通じて評価済み)、それを警告として集約しなければならない。health は辺種別の限定や木 vs DAG の評価規則を自ら再定義してはならない。
