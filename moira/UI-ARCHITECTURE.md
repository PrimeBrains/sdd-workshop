# Moira 画面アーキテクチャ — 被覆表とラフ画面構成
# Moira UI Architecture — Coverage Matrix and Rough Screen Composition

> 本書は **MODEL（思想）と `.kiro/`（実装）の橋渡し設計**である。正典（MODEL-class）ではない**派生設計文書**であり、§6 来歴・§7 確認事項・版ヘッダは持たない。ただし要件 ID で `moira/MODEL.md`（v16）に接地し、ユーザー指示により **doc-refine の独立敵対ゲートを通してから確定**する（末尾「確定来歴」参照）。
> ラフ画面の視覚化は `moira/ui-mockups/index.html`（自己完結 HTML・中フィデリティ・ブラウザで開ける）。本書はその設計図と被覆の根拠を担う。**HTML は本書の CQRS 整合更新（2026-06-22）に同期済み**——行為ゾーンは「→ `moira-*` skill 起動の deep-link」表現、surface は read-only（write 非所有）。被覆一致の主張は v14 ゲート所見であり、CQRS 後は本文（md）が正・HTML は同期視覚化として整合させた（確定来歴の CQRS 節参照）。

---

## 1. 位置づけ / Context

`moira/MODEL.md` は「アーキテクチャ以前の思想の確定」であり実装技術に立ち入らない（MODEL §0）。一方、本システムをどの画面に落とすかは別レイヤの検討を要する——**ただしモデルと完全に独立ではない**。MODEL は提示の**下限**（必ず surface すべき導出・区別表示・警告）を既に強制している（R-S2 ほか）。

したがって画面設計は次の**三層**で考える:

| 層 | 中身 | 決め手 |
|---|---|---|
| ① 構造 | 実体（spec/ノード）・4イベント・導出の定義 | MODEL 既定・不可変 |
| ② 提示の下限 | R-S2 の導出群＋区別表示（R-S4/R-S5/R-S6/R-S7・R-U9/P0）＋警告群を**必ず surface** | **MODEL 既定・必須** |
| ③ 提示の自由 | レイアウト・グラフ種別・導線・役割別の束ね方 | UX 裁量 |

本書は②を MODEL から写像し、③で具体化する。`.kiro/specs/moira-*` への seed を前提とした中間成果物である。

---

## 2. 三層の規律と「軸で切る」原則 / Principles

- **分割軸は「役割」でなく「軸」。** 画面は `spec-value`（仕様・価値）／`schedule-time`（スケジュール・時間）／`health`（健全性・EVM）という**導出の軸**で切る。
- **役割（管理者/開発者）はモデル外＝同一単一導出への actor フィルタ。** MODEL は境界を「人間 vs エージェント」でのみ引き、人間内部の権威・役割はスコープ外（MODEL §2.1）。よって「管理者向け/開発者向け」は画面の分割軸でも別系統計算でもなく、**同一の単一導出に対する actor フィルタ／初期プリセット**である（根拠は §2.1「人間内部の権威はスコープ外」が主、P4「三キューは同一クエリ」の精神が従）。役割で物理分割して別系統計算すると、同一導出が乖離する——本書ではこれを「二つの真実」と呼ぶ（本書独自の語。PROTOTYPE-EVALUATION 所見1「真実源が可変状態」の画面層版）——これを禁止する。この線は **設計意図として** falsifiable：役割プリセットを各 surface のフィルタに**配線した上で**切り替えれば、同一導出の数値は一致しなければならない（不一致＝二つの真実＝違反）。
  - **実装状態の注記（過大主張回避）**: 参照実装 `app/WorkbenchShell.tsx` の preset（管理者/開発者）は現状 `setPreset` でボタン styling と footer ラベルを変えるのみで、(a) どの surface にも prop を渡さず、(b) body は surface で分岐し preset に依らず、(c) `derive()` をフィルタしない——**現状は cosmetic な no-op**で、駆動対象が無いため上記 falsifiable 線は今は vacuously true（テスト不能）。よって「切替で数値一致」は**未実装の設計意図であり、実装で各 surface のフィルタへ preset を配線することを前提条件とする**。現に機能している actor フィルタは `schedule-time` の KIND（全員/人間/エージェント）のみ（§5 参照）。
- **read と write の責務分離（CQRS）。** surface（app）は **read-only**——`derive()` の出力を読むだけで、自前の write も状態も持たない。**write（4 イベント追記＋構成入力 c／config の発行＝人間のコミット行為）は write skill（Claude Code skill）が所有**する。surface 上の「行為」ボタンは write を実装せず、対応する **write skill を起動する deep-link** にすぎない。横断の発見・行為動線は層B（decision インボックス）が **集約・ルーティング**し、各行から write skill 起動 deep-link へ繋ぐ（自前で再計算も write もしない）。CQRS マッピング: 読＝surface（spec-value／schedule-time／health／decision の 4 面）、書＝write skill 群（`.kiro/steering/roadmap.md` の `moira-*` skill）。
- **警告は acknowledge で消えない（MODEL §2.1）。** 警告は現在の導出状態への述語で、条件が真の間だけ可視ギャップとして残り、**条件を偽化する入力（4イベント追記 or c 変更）でのみ消える**。提示は顕著さを抑制（畳む・淡色化・並び替え）してよいが、**可視ギャップの会計から警告を除いてはならない**（P0、falsifiable な線）。

---

## 3. 5つのサーフェス / Five Surfaces

**層A = R-S2 が予約する「三ダッシュボード」（read 提示先）**

- **`spec-value`（仕様・価値）** — フェーズノード（feature ─ req/design/tasks/impl；MODEL §2.6）・トレーサビリティ（木+relate）・見積カバレッジ（P2）・現行有効集合の EV%（R-S5）・見積合意（proposed→agreed）。
- **`schedule-time`（スケジュール・時間）** — 木×DAG 射影・生きた予測スケジュール（P7、各サブ単位の予測完了）・凍結 PV・割当（R-T5）・未割当バックログ（P0）。**全 actor 共通の母 view**。注: これは A1 上の射影（projection）であって「WBS」という一級実体ではない。
- **`health`（健全性・EVM）** — EV_abs/EV% の区別表示（R-S5）・PV/AC・SPI/CPI（MODEL §3）・スケジュールカバレッジ de-rate（R-S6）。

**層B = ダッシュボードでない、MODEL が別途要求する面**

- **`decision インボックス`（横断・行為への deep-link）** — 5コミット判断のうち4つ（見積合意・割当・スコープ/期日・見積の深さ。5番目=c 宣言は capacity config 面；§2.1#5）と、**判断・行為を要する警告**を集約し、各行から **対応する write skill 起動の deep-link** へルーティングする read 派生面（surface 自身は write しない）。R-S6/R-S4 のような **de-rate 型**（行為でなく解釈の割引）は inbox の行為項目にせず、該当ダッシュボードの常時メトリクス修飾として表出する。**自前状態（dismiss フラグ等）を持たない**。これらの規律は参照実装 `surfaces/inbox/DecisionInboxSurface.tsx`（`computeInbox` の read 派生フィルタ・dismiss/既読/snooze ボタン無し・件数サマリで会計算入を可視化・de-rate 型を非集約と明記）に接地する。
- **`capacity·calendar config`（二層目データ c の READ ビュー＋write は deep-link）** — c(i,d) の per-date 表示・α_i 契約レート view・R-U14 履歴の **read ビュー**。これは独立した読 spec ではなく、c の READ 面である。c 宣言・理由付き改定の **write は `moira-capacity` skill への deep-link**で起動する（MODEL §2.1#5・A4・R-U14。surface は c を書かない）。

> 上記の CQRS マッピング: 読＝surface（spec-value／schedule-time／health／decision の **4 面**）、書＝write skill 群（roadmap.md の `moira-*`）。capacity·calendar config は読 spec ではなく **c の READ ビュー＋`moira-capacity` skill への write deep-link**。R-S2 が予約する「三ダッシュボード」（spec-value／schedule-time／health）の数は不変——decision インボックスと capacity READ ビューは導出を描く提示先でなく、行為起動と構成入力 read のレーンであり、R-S2 の "three" を侵さない。

---

## 4. 被覆表（割付の網羅性）/ Coverage Matrix

本書の合言葉は「必要かつ十分」だが、ここで示すのは**割付の網羅性**（MODEL が surface を要求する全項目に host があり空セルが無いこと）であって**十分性の*証明*ではない**（網羅は帰納で証明不能＝MODEL §5/P2 と一貫。MODEL は v10 で「未処理ケースが残らない」型の過大主張を撤回している）。判定は「3という数」でなく**空セルの有無**で行う。

> **網羅主張の母数（射程）**: 本表の網羅主張が対象とするのは **R-S2 導出（13）・警告（9）・区別表示規則（6）の 3 群**に限る。**capacity READ ビューが host する提示物（per-date c・α_i 契約レート view・R-U14 履歴・capacity heatmap）は本表の母数外**であり、別途 MODEL §2.1#5・A4・R-U14 に接地する（§3「capacity·calendar config」・§5 末尾）。母数を 3 群に限定するのは、capacity 系は導出（R-S2）ではなく二層目データ c の READ 面ゆえ——3 群の被覆と c の READ 被覆は別の根拠で立つ。

### 4.1 R-S2 導出（13）× host サーフェス

| R-S2 導出 | 主 host | 副 host |
|---|---|---|
| 各ノード状態 | spec-value | schedule-time（Gantt 上） |
| EV%（現行進捗） | spec-value | health |
| EV_abs（累積EV） | health | — |
| 見積カバレッジ（P2） | spec-value（見積カバレッジの主 host） | health（三者対読み内の **従属再掲**＝host でない） |
| 実行カバレッジ（R-S8） | spec-value（**三者併置で対読み**：EV%・見積カバレッジ・実行カバレッジ——三者とも spec-value が主 host。R-S8 三者対読みの主 host=spec-value 維持） | health（EVM 文脈で EV%・実行カバレッジを **従属再掲**＝host でない） |
| PV（ベースライン） | health | schedule-time（同一ベースラインを参照・再計算しない） |
| AC | health | — |
| SPI | health | schedule-time（**副 host**：SPI＋スケジュールカバレッジを対で表示し、低カバレッジ時はカバレッジバーを de-rate（淡色化）＋注記で SPI を全体進捗と読まないよう促す strip を描画。参照実装 `ScheduleTimeSurface.tsx` の de-rate は `derate={cov < 0.999}`（カバレッジバーの淡色化）であり SPI 値自体は素値表示。再計算でなく health と同一導出の read） |
| CPI | health | — |
| 各キュー（P4：作業/レビュー/エージェント） | schedule-time（actor フィルタで作業/レビュー/エージェントの三キューをカバー） | decision インボックス（判断待ち＝同一クエリの actor フィルタ・再計算なし） |
| 生きた予測スケジュール（各サブ単位の予測完了） | schedule-time | — |
| 未割当バックログ | schedule-time（P0） | decision インボックス（参照のみ） |
| スケジュール・バッファ残量/消費率（R-T6） | health（CCPM フィーバー的可視化） | — |

> 注: 三キュー（作業/レビュー/エージェント）は P4 により**同一クエリの actor フィルタ違い**ゆえ、被覆上は **1 導出**として数える。v14 の「11」に対し、v16 で実行カバレッジ(R-S8)とスケジュール・バッファ残量/消費率(R-T6)の 2 件が追加され「13」。**副 host を追加しても本数（13）は変わらない**（host の重複付与であって導出の追加ではない）。
>
> 注（CQRS 是正・host 割付）:
> - **SPI／R-S6 de-rate** は主 host=health・**副 host=schedule-time**。schedule-time は SPI＋スケジュールカバレッジを対で表示し、低カバレッジ時はカバレッジバーを淡色化（de-rate）＋注記する strip を描画する（参照実装 `ScheduleTimeSurface.tsx`：de-rate＝カバレッジバーの淡色化のみ・SPI 値は素値表示。health と同一導出の read であって再計算ではない）。
> - **スケジュールカバレッジ（集約）** の host は **health**（R-S6 の de-rate 消費元）。spec-value は **per-leaf のスケジュール済み標識（行明細）**のみで、集約スケジュールカバレッジは host しない。
> - **見積カバレッジ**の主 host=spec-value。health の三者対読み（EV%・見積カバレッジ・実行カバレッジ）は **従属再掲（host でない）**。
> - **実行カバレッジ（R-S8）** の三者対読み主 host=spec-value（既設）を維持。health は従属再掲。
> - **三キュー（P4）の副 host=decision インボックス**は、被覆の空セル回避には**不要**（主 host=schedule-time の actor フィルタで充足）。この副 host 列は**行為導線（判断待ちへの deep-link）の説明**であって割付網羅性には寄与しない。decision 面の規律群（三キュー副 host・heatmap 非 host・二重計上禁止・自前状態なし）は参照実装 `DecisionInboxSurface.tsx` に接地（§3）。

### 4.2 警告（9）× 集約 × write skill への deep-link（文脈面）× 消滅トリガー

inbox は**判断・行為を要する警告**を集約する。R-S6 は de-rate 型（行為でなく解釈の割引）ゆえ inbox には集約せず health の常時メトリクス修飾として表出する（§3。よって inbox 集約は8件、R-S6 は health 常駐＝計9件すべてに host がある）。

> CQRS 是正: 下表の中央列は**何を書くか（write）ではなく、どの surface 文脈からどの write skill へ deep-link するか**を示す。surface（spec-value／schedule-time／health／config 面）は read-only であり write を所有しない——表記は「{文脈 surface} → {`moira-*` write skill}」の起動経路である（§2 CQRS 原則・§5 各面と同一語彙。確定来歴 v16→CQRS 整合更新参照）。

| 警告 | 集約 | write skill への deep-link（文脈 surface → skill） | 消滅トリガー（MODEL §2.1） |
|---|---|---|---|
| R-U12 矛盾合意 | inbox | spec-value 文脈 → `moira-estimate-agree`（一致する凍結値で agreed 再発行） | いずれかの人間が他 actor の直近 agreed 値と一致する凍結値で `agreed` 再発行（transition）。現行 latest-wins 値で判定 |
| R-U13 未合意完了 | inbox | spec-value 文脈 → `moira-estimate-agree`（事後合意/再見積→合意）／`moira-cancel-scope`（cancel） | 即時事後合意／再見積(R-E3)→事後合意／cancel（いずれもイベント） |
| R-T3 過負荷 | inbox | schedule-time 文脈 → `moira-assign-schedule`（再割当）＋ config 文脈 → `moira-capacity`（c 改定） | 条件偽化＝再割当（transition）or c 変更（R-S2）；c=0 日 AC 等の点事象は実装定義の窓から外れて偽化（aging out） |
| R-T4 期日超過（超過量を表示） | inbox | health 文脈（判断）→ `moira-reschedule`/`moira-project-config`＋ schedule-time/spec-value 文脈（実行） | スコープ削減／要員追加／期日変更（イベント）で導出スケジュールが期日内 |
| R-S3 thrashing | inbox | spec-value 文脈 → `moira-estimate-agree`（再見積）／health 文脈（解釈） | EV_abs↑ or AC が sustained window 内で非増に転じる（窓は実装定義） |
| R-S6 SPI de-rate（de-rate 型＝inbox 非集約） | health（常時メトリクス修飾） | schedule-time 文脈 → `moira-assign-schedule`（割当付与） | 割当付与（transition）でスケジュールカバレッジが上がり条件偽化 |
| R-S7 スロット陳腐化（原因別） | inbox＋schedule-time | schedule-time 文脈 → `moira-rebaseline`（再ベースライン）／据え置き受容＋ config 文脈 → `moira-capacity`（c 起因分） | 理由付き再ベースライン（イベント） or 生きた予測の再収束（乖離閾値は実装定義）。据え置き受容は消さない |
| R-C3 キャンセル孤児 | inbox | spec-value／schedule-time 文脈 → `moira-relate-edit`（辺除去/付替）／`moira-cancel-scope`（後続 cancel） | 辺除去/付替（relate）or 後続 cancel（transition） |
| P5 at-risk | inbox | spec-value 文脈（起点ノード）＋ health/schedule-time 文脈（解放済み後続）→ `moira-progress`/`moira-relate-edit` | 当該ノードの implemented 再到達（後続自身の完了では消えない） |

### 4.3 区別表示規則（6）× host

MODEL が提示方法を個別に規定する要件群（R-S4/R-S5/R-S6/R-S7 および R-U9/P0 の可視ギャップ）を**区別表示規則**としてまとめ host を割り付ける（混同すると嘘になる二読み——累積/現行、コミット済/未コミット、低カバレッジでの割引——を分離する）。

| 規則 | host |
|---|---|
| R-S5 累積EV(EV_abs) と 現行進捗(EV%) の区別表示 | health（分離ゾーン：現行 SPI/CPI／累積・サンク・supersede 履歴） |
| R-U9/P0 可視ギャップ：見積カバレッジ | spec-value |
| R-U9/P0 可視ギャップ：未割当バックログ | schedule-time |
| R-S4 低カバレッジで EV を de-rate | spec-value（＋ health の EV%） |
| R-S6 低スケジュールカバレッジで SPI を de-rate | health（主）＋ schedule-time（副・カバレッジバーの淡色化＋対表示＋注記で全体進捗と読ませない strip＝`ScheduleTimeSurface.tsx`。数値割引でなく淡色化＋注記） |
| R-S7 陳腐化スロットを原因別に提示 | schedule-time＋inbox |

→ **空セルなし（母数=R-S2 導出13・警告9・区別表示6 の 3 群）。** 全 R-S2 導出（13）・全警告（9）・全区別表示（6）に ≥1 の host がある。よって**割付は網羅的**（「必要かつ十分」を目指す下限であって、十分性の証明ではない）。網羅性そのものは帰納では証明不能であり（MODEL §5/P2 と一貫）、本表は「現時点の MODEL v16 が surface を求める **この 3 群の**項目を漏れなく割り付けた」ことを主張するに留める。**capacity 系提示物（per-date c・α_i view・R-U14 履歴・heatmap）は本表の母数外**——c の READ 面として §3・§5 で別途 R-U14/A4 に接地する。

---

## 5. ラフ画面構成 / Rough Screen Composition

視覚化は `moira/ui-mockups/index.html`（自己完結 HTML・中フィデリティ・ブラウザで開ける・各ゾーンに対応 MODEL 要件 ID のバッジ）。**CQRS 整合更新（2026-06-22）に同期済み**——各面の行為ゾーンは「→ `moira-*` skill 起動の deep-link」表現で、surface は read-only（write 非所有）。以下は各面の意図（ゾーン → host する導出/警告/行為への deep-link）。

**spec-value（仕様・価値 / actor フィルタ初期プリセット: 開発者 — 物理分割でない・同一単一導出のフィルタ。注: 参照実装では preset を本 surface に未配線＝設計意図。現に機能する actor フィルタは schedule-time の KIND のみ）**
- 上部: 見積カバレッジ（P2）バー。低カバレッジ時は EV% を de-rate 表示（R-S4）。**三者併置（EV%・見積カバレッジ・実行カバレッジ R-S8）の主 host**——実行カバレッジ＝合意済み有効葉のうち `implementing` 中のノード数比率（EV% と算術和しない＝仕掛中の量≠出来高）。
- 本体: ノード木 feature ─ req/design/tasks/impl の状態＋EV%、トレーサビリティ（木+relate）、現行有効集合（R-S5）。
- 行為への deep-link（write skill 起動）: 見積合意 proposed→agreed（人間のみ・`moira-estimate-agree`；R-U4）、再見積（`moira-estimate-agree`/`moira-decompose-author`；R-E3）、見積の深さ判断（`moira-decompose-author`；R-E2b）。surface は write せず skill を起動する。
- 警告 → inbox: R-U12 矛盾合意、R-U13 未合意完了、R-C3 起点、P5 起点。

**schedule-time（スケジュール・時間 / 母 view・全 actor）**
- 上部: actor フィルタ（KIND: 全員/人間/エージェント。レビュー担当を選ぶ reviewer フィルタは per-node `reviewer` 選択でスライス未供給＝予約；視点 actor は要さない＝MODEL §7#18(f)）＋ **SPI＋スケジュールカバレッジ strip（R-S6 副 host）**——参照実装 `ScheduleTimeSurface.tsx` は SPI と scheduleCoverage を対で表示し、低カバレッジ時は**カバレッジバーを淡色化（`derate={cov < 0.999}`）＋注記**で SPI を全体進捗と読ませない（SPI 値自体は素値表示・health と同一導出の read・再計算なし）。
- 本体: Gantt（木×DAG 射影＋生きた予測 P7）、凍結 PV（health と同一ベースラインを参照）。per-leaf のスケジュール済み標識は行明細で表示（集約スケジュールカバレッジは health が host）。
- 可視ギャップ: 未割当バックログ（P0）。
- 行為への deep-link（write skill 起動）: 割当 transition（`moira-assign-schedule`；R-T5 単一被割当者）、着手（`moira-progress`）。surface は write せず skill を起動する。
- 警告 → inbox: R-T3 過負荷、R-S7 陳腐化（原因別）、P5 解放済み後続。

**health（健全性・EVM / actor フィルタ初期プリセット: 管理者 — 物理分割でない・同一単一導出のフィルタ。注: 参照実装では preset を本 surface に未配線＝設計意図。現に機能する actor フィルタは schedule-time の KIND のみ）**
- 上段: SPI（スケジュールカバレッジで de-rate；R-S6 **主 host**。副 host=schedule-time strip）／CPI、PV・EV_abs・AC（予算次元 MD）。集約スケジュールカバレッジは health が host。
- 区別ゾーン（R-S5）: 「現行進捗 EV%」と「累積EV EV_abs／サンク／supersede 履歴」を分離表示。
- 実行カバレッジ(R-S8): EVM 文脈で EV% と並べて **従属再掲**（執行中量の確認。EV% と算術和しない＝仕掛中の量≠出来高）。三者併置（EV%・見積カバレッジ・実行カバレッジ）の主 host は spec-value、health は従属再掲（§4.1）。
- 人別指標: **人別 CPI のみ**（コスト次元は actor 帰属可）。人別 SPI は非対象（MODEL §2.4 単一 assignee・PV は actor 非帰属）。
- トレンド（SPI/CPI）・CCPM fever・スケジュール・バッファ残量/消費率（R-T6;スケジュール・カバレッジと対で de-rate）。
- 行為への deep-link（write skill 起動）: スコープ/期日判断（`moira-reschedule`/`moira-project-config`；R-T4）、再ベースライン（`moira-rebaseline`）。surface は write せず skill を起動する。
- 警告 → inbox: R-T4 期日超過（超過量つき）、R-S3 thrashing。

**decision インボックス（横断・行為への deep-link / actor フィルタ中立プリセット・全員）**
- 「新規（未確認）」と「据え置き・既知」を区別表示（畳むが**会計には残す**；P0。件数サマリ＝全N件・うち据え置きM件 で会計算入を可視化）。
- 各行は **対応する write skill 起動の deep-link**（例 R-T4→`moira-reschedule`[スコープ削減/要員/期日]、R-U13→`moira-estimate-agree`[合意/再見積/cancel]、R-C3→`moira-cancel-scope`/`moira-relate-edit`[辺除去/付替/後続cancel]）。surface 自身は write しない。
- **capacity heatmap は host しない**：c 起因の判断（R-T3／R-S7 の c 起因分）は decision 面で heatmap を描かず、**capacity config 面（`moira-capacity` skill）への deep-link** へ送る。decision インボックスの commit レーンは **二重計上禁止**——同一判断点は 1 レーンのみ（同じ commit を複数行に重ねない）。
- **自前状態を持たない**：行為が追記され導出が再評価されると条件が偽化した項目は自動的に消える（dismiss フラグを作らない）。

**capacity·calendar config（二層目データ c の READ ビュー＋write は `moira-capacity` deep-link / c 宣言は管理側）**
- 人 × 暦グリッドで c(i,d) ∈ [0,1.0] を per-date **表示（read）**。c の入力・理由付き改定（write）は **`moira-capacity` skill 起動の deep-link**で行う（surface は c を書かない）。**契約割当の改定**（reason=契約）は §2.1#5 のコミット判断、**暦由来の改定**（祝日/休暇/一時減）は可用性入力であり、両者を区別して扱う。
- α_i 契約レート view（c の reason=契約 成分）、R-U14 履歴（追記専用・理由付き・タイムスタンプ）の read。
- c 変更（`moira-capacity` 経由の write）は P7 再導出をトリガー（R-S2）。陳腐化スロット（R-S7）の c 起因分・decision インボックスからの c 起因 deep-link はこの面へ着地する。capacity heatmap の host はこの面（decision 面ではない）。

---

## 6. 実装の規律 / Implementation Disciplines

1. **層B は自前状態を持たない。** decision インボックスはキャッシュ/事前計算/dismiss フラグを持たず、同一導出（R-S2）の read 派生フィルタに徹する。破ると「真実源が可変状態」（PROTOTYPE 所見1）の画面版に転落する。
2. **deep-link は再計算でなく参照。** インボックスやサブ view が描く数値は、3ダッシュボードと同一のクエリ（P4）を参照する。二系統計算を禁ずる。
3. **選択肢列挙は導出層に一本化。** 各警告の取りうる行為（R-T4 の3択、R-U13 の3択、R-C3 の3行動）は導出層で一度だけ定義し、インボックスと文脈ビューで二重実装しない。
4. **横断判断は複数 deep-link を許す。** スコープ/期日（R-T4）は health と schedule-time の両文脈を要するため、片面飛びにしない。
5. **提示は会計から警告を除かない（P0 の falsifiable な線）。** 顕著さの抑制（畳む・淡色化・並び替え）は可だが、可視ギャップのカウント/リストから落とすのは P0 違反。
6. **集約 derive() 所有指標 vs per-node 属性射影（projection）。** 区別する二系統がある——(a) **集約導出値**（R-S2 が所有する EV%/EV_abs/PV/AC/SPI/CPI/各カバレッジ等。derive() が一度だけ計算）は surface で**再計算してはならない**。(b) **per-node 属性射影**：per-node 属性（`frozenBudget`/`ac`）から表示用に per-task の値を合成する projection は **read-only として許容**する（属性の表示用写像であって、集約導出値の二系統計算ではない）。ただし許容射影には**二段**があり、潰してはならない——
   - **PV/EV は per-node 属性の射影**（`taskPv`＝`frozenBudget` を pv.ts の単一葉算入規則 `agreed ∧ scheduled ∧ frozenSlot ≤ asOf` で表示、`taskEv`＝agreed-completed の `frozenBudget`）。
   - **SV/CV はそれら表示値の差分による提示恒等式（`sv = EV − PV`／`cv = EV − AC`）であって canon index ではない**（参照実装 `surfaces/schedule/Inspector.tsx:55-56` のコメント「SV/CV are presentation identities (differences of the above), not canon indices」に一致）。SV/CV は一次属性からの直接射影ではなく、PV/EV 表示値の差分という一段下の派生である。
   - 参照実装 `Inspector.tsx` は SPI/CPI 指標はタスク単位で二値化するため project 全体は health で確認、と明記する。許容されるのは per-node 属性の射影（PV/EV）とその表示用差分（SV/CV）のみ——集約導出値（R-S2 所有）の per-node からの再合成は (a) の禁止に当たる。

---

## 7. 未決・次の一手 / Open Items & Next Steps

- 本書を seed に `.kiro/specs/moira-dashboards`（および MODEL→`.kiro/steering`）へ移行（README の段階遷移）。
- 検証シナリオ **S4（健全性のリアルタイム把握）** を一本貫く最小バックエンド（イベント→導出→表示の型）。
- 高フィデリティのデザイン磨き込みは視覚識別が確定してから（本書のスコープ外）。

---

## 8. ポートフォリオ・シェル（issue #23 追補 — **未ゲート**）

> **本節は既存本文とは別ゲートの追補**（2026-07-05・D-73/ADR-0005 とともに doc-refine 独立敵対ゲート PASS・人間未批准）。
> 上の §1–§7 の被覆表・ゲート所見（確定来歴）の射程は従来どおり**単一プロジェクトの 5 サーフェス**であり、本節はそれを変更しない。

- **位置づけ**: `moira ui --portfolio` 時のみ起動する**別のアプリルート**（`app/PortfolioShell.tsx`）。単一案件モードの `SurfaceId`・5 サーフェス・被覆表（§4）には一切触れない。ポートフォリオは**提示層の読み取り並置**であり、案件ごとに独立した derive がそれぞれ走る（`moira/portfolio-derive.ts`＝ポートフォリオモードの単一導出呼び出し点。fidelity gate と depcruise で機械固定）。
- **ビュー**: `案件並置`（1行1案件の会計並置＋読めた案件のみの件数合計行＋loadError 行）／`人横断`（Actor.id 一致での掛け持ち見える化・開示文言常設・読めない案件の除外も明示）／ドリルダウン（選択案件の fixture で既存 `MoiraProvider`＋`WorkbenchShell` を**統一 asOf で**再マウント＝既存本文の規律がそのまま適用される）。並置の数値が単独ビューと一致するのは**同じ asOf のとき**（ADR-0005 Decision 6/7 の開示参照）。
- **規律**: 横断の合成会計を出さない（EV%/SPI/CPI の重み付きロールアップ禁止＝裁量ノブの密輸）。読めない home はゼロを捏造せずエラー行。labels/roster レジストリは案件ごとに**state 変更の前に**インストール（live bridge と同じ順序規則）。
- 根拠: D-50・D-73・MODEL §5:433・ADR-0005。

---

## 確定来歴 / Gate Provenance

**doc-refine ゲート通過（2026-06-19）— 独立採点者の残存 Critical/Important = 0。**
- 一次資料（ユーザー確定 SOURCE_SET）: `moira/MODEL.md`(v14) を主、`moira/PROTOTYPE-EVALUATION.md`・`moira/DECISIONS.md` を補助。
- Round 1: `doc-adversary`×3（攻撃角 G1–G4）＋ `doc-fact-checker`。fact-checker は本数（R-S2 導出11／警告9／区別表示6）・全要件IDの実在・HTML バッジ非捏造・現行版 v14 を CONFIRMED。
- 決着した主要指摘:
  - **Critical**: ①「4コミット判断」→ MODEL §2.1 は5つ ⇒「5つのうち4つを inbox 集約・5番目=c 宣言は config 面」に修正。②「9警告を集約」vs R-S6 が inbox 非集約の自己矛盾 ⇒ **ユーザー裁定 FORK「判断型と de-rate 型を区別」**を反映（inbox 集約8件＋R-S6 は health 常時修飾＝計9件すべてに host）。③「必要十分」の過大主張（MODEL が v10 で撤回した型）⇒ 見出し「割付の網羅性」・「十分性の証明ではない」へ軟化。
  - **Important（一次資料 CORRECTED 1件含む）**: 「二つの真実」は PROTOTYPE-EVALUATION に非存在 ⇒「本書独自の語。所見1『真実源が可変状態』の画面層版」と明記。消滅トリガーの精度（R-U12 現行 latest-wins 判定／R-S3 sustained window／P5 後続完了では消えない／R-U13 三択／R-S7 再収束閾値は実装定義／R-T3 aging-out）、「11」の根拠（三キュー=P4 同一クエリで1導出）、役割=フィルタの根拠（§2.1 主・P4 従）、§4.3 区別表示の定義、§5 config の契約改定/暦改定の区別、HTML（health に PV/EV_abs タイル・凡例「行為への導線」・inbox に R-U12/P5＋件数サマリで P0 可視化・キュー射影注記・サンプル日付・プリセット例示注記）。
- Round 2: `doc-gate-judge` が現物再検証し **PASS**（11/9/6 一致、9件全 host、HTML↔md 被覆一致、新規 Critical なし）。**注: この「HTML↔md 被覆一致」所見は v14 ゲート時点のもの**——CQRS 更新（2026-06-22）では HTML を CQRS に同期し直した上で本文（md）を正とした（下記 CQRS 節参照）。
- 非ブロッキングで残した Suggestion: §2/§6 の原則↔実装規律の一部再述、フォントのプラットフォーム差、α_i と c が乖離する例の未図示、MODEL 改版時の本書更新契機。
- 本書は MODEL-class ではない派生設計物。MODEL が改版された場合は本書の被覆表を再点検し、必要なら再度 doc-refine を通す。

**v14→v16 被覆表更新（moira-model-update Phase 0・0e 陳腐化解消）：**
- §4.1: R-S2 導出数を 11→13 に更新（実行カバレッジ R-S8 + スケジュール・バッファ残量/消費率 R-T6 の 2 件追加）。
- §5 health: 三者対読み（EV%・見積カバレッジ・実行カバレッジ）と R-T6 バッファ残量/消費率を追記。
- §4.3: R-S5 の表示名を「累積EV(EV_abs)」に統一（ユーザー裁定「累積EV のほうがわかりやすい」）。
- 版参照を v14→v16 に更新。警告数（9）・区別表示規則（6）は v14→v16 で変更なし。

**v16→CQRS 整合更新（2026-06-22 moira-model-update／doc-refine。`.kiro/steering/roadmap.md` 改訂版に整合）：**
- **read/write 分離（CQRS）**: surface（app）を read-only（`derive()` を読むだけ・自前 write/状態なし）に統一。§2「write は各文脈ビュー内に単一定義」→「write は write skill が所有、surface は deep-link で起動（自前 write を持たない）」。§5 各面の「行為:」→「行為への deep-link（write skill 起動）:」に reframe（具体 skill 名を付記）。
- **5 サーフェスの CQRS マッピング明記**: 読＝surface 4 面（spec-value／schedule-time／health／decision）。capacity·calendar config は独立読 spec ではなく **c の READ ビュー＋`moira-capacity` skill への write deep-link**。R-S2「三ダッシュボード」予約は不変。
- **§4.1 host 割付是正**: SPI/R-S6 de-rate 主 host=health・**副 host=schedule-time 追記**（参照実装 `ScheduleTimeSurface.tsx` が SPI＋scheduleCoverage de-rate strip を描画）。scheduleCoverage 集約=health、spec-value は per-leaf 標識のみ。見積カバレッジ主 host=spec-value／health 三者対読みは従属再掲。実行カバレッジ R-S8 三者対読み主 host=spec-value（既設）維持。本数（導出13／警告9／区別6）は不変（副 host 追加は本数を変えない）。
- **§6 に projection 線追記（二段を区別）**: 集約 derive() 所有指標（再計算禁止）vs per-node 属性射影（read-only として許容）。許容射影は**二段**——(i) **PV/EV は per-node 属性（`frozenBudget`）の射影**、(ii) **SV/CV はそれら表示値の差分による提示恒等式（canon index ではない）**。参照実装 `surfaces/schedule/Inspector.tsx:55-56`「SV/CV are presentation identities (differences of the above), not canon indices」に一致させた（PV/EV と SV/CV を一括しない）。
- **role=actor フィルタ要件化（§2/§5）**: 役割（管理者/開発者）は同一単一導出への actor フィルタ／初期プリセット（物理分割でない・falsifiable=切替で数値一致・「二つの真実」禁止）。**実装状態の hedge を追記**——参照実装 `app/WorkbenchShell.tsx` の preset は現状 cosmetic な no-op（surface props/body 分岐/derive いずれにも未配線）で falsifiable 線は vacuously true。よって「切替で数値一致」は**未実装の設計意図（実装で各 surface のフィルタへ配線要）**と明記。現に機能する actor フィルタは `schedule-time` の KIND のみ。
- **SPI/R-S6 de-rate 表現の精密化（§4.1/§4.3/§5）**: 参照実装 `ScheduleTimeSurface.tsx` の de-rate は `derate={cov < 0.999}`（カバレッジバーの淡色化）で **SPI 値自体は素値表示**。「SPI を de-rate 描画」を「SPI＋カバレッジを対表示し、低カバレッジ時はカバレッジバーを淡色化＋注記で全体進捗と読ませない」に精密化（数値割引でない）。
- **§4 網羅主張の母数を限定**: 網羅主張の射程を **R-S2 導出13・警告9・区別表示6 の 3 群**に明示限定。**capacity READ ビューが host する提示物（per-date c・α_i view・R-U14 履歴・heatmap）は母数外**で、§3/§5 にて R-U14/A4 に別途接地。
- **decision インボックスを参照接地（§3/§4.1）**: 規律群（read 派生フィルタ・dismiss/既読/snooze 無し・de-rate 型非集約・件数サマリで会計算入可視化）を `surfaces/inbox/DecisionInboxSurface.tsx` に接地。**三キュー副 host=decision は被覆の空セル回避には不要**（主 host=schedule-time で充足）＝行為導線の説明であって割付網羅性には寄与しない、と明記。
- **HTML(ui-mockups/index.html) を CQRS に同期**: 行為ゾーン見出しを「行為（write・単一定義）／行為（write）」→「行為への deep-link（write skill 起動・surface は read-only）」へ、act チップを「→ `moira-*` skill 起動」表現へ、capacity を「c の read＋`moira-capacity` deep-link」へ、inbox を「対応 write skill へ deep-link」へ更新。**v14 ゲートの「HTML↔md 被覆一致」所見は CQRS 後の現物で再同期した上で本文（md）を正とする**旨を line 5/116・確定来歴 Round 2 注に明記。
- **capacity heatmap（§5）**: decision インボックスは heatmap を host せず、c 起因判断（R-T3／R-S7 の c 起因分）を capacity config 面へ deep-link。commit レーンは二重計上禁止（同一判断点は 1 レーン）。人別 SPI は非対象（MODEL §2.4）・人別 CPI のみ。
- MODEL 文言（数式・要件本文）は不変。本更新は派生設計文書の CQRS 整合のみ。**残存 Critical/Important = 0 は doc-refine gate 通過後に確定する**。
