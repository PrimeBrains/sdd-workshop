# Moira 画面アーキテクチャ — 被覆表とラフ画面構成
# Moira UI Architecture — Coverage Matrix and Rough Screen Composition

> 本書は **MODEL（思想）と `.kiro/`（実装）の橋渡し設計**である。正典（MODEL-class）ではない**派生設計文書**であり、§6 来歴・§7 確認事項・版ヘッダは持たない。ただし要件 ID で `moira/MODEL.md`（v16）に接地し、ユーザー指示により **doc-refine の独立敵対ゲートを通してから確定**する（末尾「確定来歴」参照）。
> ラフ画面の視覚化は `moira/ui-mockups/index.html`（自己完結 HTML、ブラウザで開ける）。本書はその設計図と被覆の根拠を担う。

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
- **役割（管理者/開発者）はモデル外。** MODEL は境界を「人間 vs エージェント」でのみ引き、人間内部の権威・役割はスコープ外（MODEL §2.1）。よって「管理者向け/開発者向け」は画面の分割軸ではなく、**同一導出への actor フィルタ／初期プリセット**に降格する（根拠は §2.1「人間内部の権威はスコープ外」が主、P4「三キューは同一クエリ」の精神が従）。役割で物理分割して別系統計算すると、同一導出が乖離する——本書ではこれを「二つの真実」と呼ぶ（本書独自の語。PROTOTYPE-EVALUATION 所見1「真実源が可変状態」の画面層版）——これを禁止する。
- **read と write の責務分離。** 層A（3ダッシュボード）は導出の read。write（人間のコミット行為）は各文脈ビュー内に**単一定義**で置き、横断の発見・行為動線は層B（decision インボックス）が**集約・ルーティング**する（自前で再計算しない）。
- **警告は acknowledge で消えない（MODEL §2.1）。** 警告は現在の導出状態への述語で、条件が真の間だけ可視ギャップとして残り、**条件を偽化する入力（4イベント追記 or c 変更）でのみ消える**。提示は顕著さを抑制（畳む・淡色化・並び替え）してよいが、**可視ギャップの会計から警告を除いてはならない**（P0、falsifiable な線）。

---

## 3. 5つのサーフェス / Five Surfaces

**層A = R-S2 が予約する「三ダッシュボード」（read 提示先）**

- **`spec-value`（仕様・価値）** — フェーズノード（feature ─ req/design/tasks/impl；MODEL §2.6）・トレーサビリティ（木+relate）・見積カバレッジ（P2）・現行有効集合の EV%（R-S5）・見積合意（proposed→agreed）。
- **`schedule-time`（スケジュール・時間）** — 木×DAG 射影・生きた予測スケジュール（P7、各サブ単位の予測完了）・凍結 PV・割当（R-T5）・未割当バックログ（P0）。**全 actor 共通の母 view**。注: これは A1 上の射影（projection）であって「WBS」という一級実体ではない。
- **`health`（健全性・EVM）** — EV_abs/EV% の区別表示（R-S5）・PV/AC・SPI/CPI（MODEL §3）・スケジュールカバレッジ de-rate（R-S6）。

**層B = ダッシュボードでない、MODEL が別途要求する面**

- **`decision インボックス`（横断・行為）** — 5コミット判断のうち4つ（見積合意・割当・スコープ/期日・見積の深さ。5番目=c 宣言は capacity config 面；§2.1#5）と、**判断・行為を要する警告**を集約し、各行から文脈ビューの write へ deep-link する read 派生のルーティング面。R-S6/R-S4 のような **de-rate 型**（行為でなく解釈の割引）は inbox の行為項目にせず、該当ダッシュボードの常時メトリクス修飾として表出する。**自前状態（dismiss フラグ等）を持たない**。
- **`capacity·calendar config`（二層目データ c）** — c(i,d) の per-date 入力・理由付き改定・α_i 契約レート view・R-U14 履歴。c 宣言の write はここ（MODEL §2.1#5・A4・R-U14）。

> 「3ダッシュボード」（R-S2 の数の予約）と「2つの非ダッシュボード面」（write/config）はカテゴリが異なる。後者は導出を描く提示先でなく、行為と構成入力のレーンであり、R-S2 の "three" を侵さない。

---

## 4. 被覆表（割付の網羅性）/ Coverage Matrix

本書の合言葉は「必要かつ十分」だが、ここで示すのは**割付の網羅性**（MODEL が surface を要求する全項目に host があり空セルが無いこと）であって**十分性の*証明*ではない**（網羅は帰納で証明不能＝MODEL §5/P2 と一貫。MODEL は v10 で「未処理ケースが残らない」型の過大主張を撤回している）。判定は「3という数」でなく**空セルの有無**で行う。

### 4.1 R-S2 導出（13）× host サーフェス

| R-S2 導出 | 主 host | 副 host |
|---|---|---|
| 各ノード状態 | spec-value | schedule-time（Gantt 上） |
| EV%（現行進捗） | spec-value | health |
| EV_abs（累積EV） | health | — |
| 見積カバレッジ（P2） | spec-value | — |
| 実行カバレッジ（R-S8） | spec-value（**三者併置で対読み**：EV%・見積カバレッジ・実行カバレッジ——三者とも spec-value が host） | health（EVM 文脈で EV%・実行カバレッジを再掲） |
| PV（ベースライン） | health | schedule-time（同一ベースラインを参照・再計算しない） |
| AC | health | — |
| SPI | health | — |
| CPI | health | — |
| 各キュー（P4：作業/レビュー/エージェント） | schedule-time（actor フィルタで作業/レビュー/エージェントの三キューをカバー） | decision インボックス（判断待ち＝同一クエリの actor フィルタ・再計算なし） |
| 生きた予測スケジュール（各サブ単位の予測完了） | schedule-time | — |
| 未割当バックログ | schedule-time（P0） | decision インボックス（参照のみ） |
| スケジュール・バッファ残量/消費率（R-T6） | health（CCPM フィーバー的可視化） | — |

> 注: 三キュー（作業/レビュー/エージェント）は P4 により**同一クエリの actor フィルタ違い**ゆえ、被覆上は **1 導出**として数える。v14 の「11」に対し、v16 で実行カバレッジ(R-S8)とスケジュール・バッファ残量/消費率(R-T6)の 2 件が追加され「13」。

### 4.2 警告（9）× 集約 × 文脈ビュー（write）× 消滅トリガー

inbox は**判断・行為を要する警告**を集約する。R-S6 は de-rate 型（行為でなく解釈の割引）ゆえ inbox には集約せず health の常時メトリクス修飾として表出する（§3。よって inbox 集約は8件、R-S6 は health 常駐＝計9件すべてに host がある）。

| 警告 | 集約 | 文脈ビュー（write） | 消滅トリガー（MODEL §2.1） |
|---|---|---|---|
| R-U12 矛盾合意 | inbox | spec-value | いずれかの人間が他 actor の直近 agreed 値と一致する凍結値で `agreed` 再発行（transition）。現行 latest-wins 値で判定 |
| R-U13 未合意完了 | inbox | spec-value | 即時事後合意／再見積(R-E3)→事後合意／cancel（いずれもイベント） |
| R-T3 過負荷 | inbox | schedule-time（再割当）＋config（c 改定） | 条件偽化＝再割当（transition）or c 変更（R-S2）；c=0 日 AC 等の点事象は実装定義の窓から外れて偽化（aging out） |
| R-T4 期日超過（超過量を表示） | inbox | health（判断）＋ schedule-time/spec-value（実行） | スコープ削減／要員追加／期日変更（イベント）で導出スケジュールが期日内 |
| R-S3 thrashing | inbox | spec-value（再見積）／health | EV_abs↑ or AC が sustained window 内で非増に転じる（窓は実装定義） |
| R-S6 SPI de-rate（de-rate 型＝inbox 非集約） | health（常時メトリクス修飾） | schedule-time（割当付与） | 割当付与（transition）でスケジュールカバレッジが上がり条件偽化 |
| R-S7 スロット陳腐化（原因別） | inbox＋schedule-time | schedule-time（再ベースライン／据え置き受容）＋config（c 起因分） | 理由付き再ベースライン（イベント） or 生きた予測の再収束（乖離閾値は実装定義）。据え置き受容は消さない |
| R-C3 キャンセル孤児 | inbox | spec-value／schedule-time | 辺除去/付替（relate）or 後続 cancel（transition） |
| P5 at-risk | inbox | spec-value（起点ノード）＋ health/schedule-time（解放済み後続） | 当該ノードの implemented 再到達（後続自身の完了では消えない） |

### 4.3 区別表示規則（6）× host

MODEL が提示方法を個別に規定する要件群（R-S4/R-S5/R-S6/R-S7 および R-U9/P0 の可視ギャップ）を**区別表示規則**としてまとめ host を割り付ける（混同すると嘘になる二読み——累積/現行、コミット済/未コミット、低カバレッジでの割引——を分離する）。

| 規則 | host |
|---|---|
| R-S5 累積EV(EV_abs) と 現行進捗(EV%) の区別表示 | health（分離ゾーン：現行 SPI/CPI／累積・サンク・supersede 履歴） |
| R-U9/P0 可視ギャップ：見積カバレッジ | spec-value |
| R-U9/P0 可視ギャップ：未割当バックログ | schedule-time |
| R-S4 低カバレッジで EV を de-rate | spec-value（＋ health の EV%） |
| R-S6 低スケジュールカバレッジで SPI を de-rate | health |
| R-S7 陳腐化スロットを原因別に提示 | schedule-time＋inbox |

→ **空セルなし。** 全 R-S2 導出（13）・全警告（9）・全区別表示（6）に ≥1 の host がある。よって**割付は網羅的**（「必要かつ十分」を目指す下限であって、十分性の証明ではない）。網羅性そのものは帰納では証明不能であり（MODEL §5/P2 と一貫）、本表は「現時点の MODEL v16 が surface を求める項目を漏れなく割り付けた」ことを主張するに留める。

---

## 5. ラフ画面構成 / Rough Screen Composition

視覚化は `moira/ui-mockups/index.html`（自己完結 HTML・ブラウザで開ける・各ゾーンに対応 MODEL 要件 ID のバッジ）。以下は各面の意図（ゾーン → host する導出/警告/行為）。

**spec-value（仕様・価値 / 初期プリセット: 開発者）**
- 上部: 見積カバレッジ（P2）バー。低カバレッジ時は EV% を de-rate 表示（R-S4）。**三者併置（EV%・見積カバレッジ・実行カバレッジ R-S8）の主 host**——実行カバレッジ＝合意済み有効葉のうち `implementing` 中のノード数比率（EV% と算術和しない＝仕掛中の量≠出来高）。
- 本体: ノード木 feature ─ req/design/tasks/impl の状態＋EV%、トレーサビリティ（木+relate）、現行有効集合（R-S5）。
- 行為: 見積合意 proposed→agreed（人間のみ；R-U4）、再見積（R-E3）、見積の深さ判断（R-E2b）。
- 警告 → inbox: R-U12 矛盾合意、R-U13 未合意完了、R-C3 起点、P5 起点。

**schedule-time（スケジュール・時間 / 母 view・全 actor）**
- 上部: actor フィルタ（人間/エージェント/自分）。
- 本体: Gantt（木×DAG 射影＋生きた予測 P7）、凍結 PV（health と同一ベースラインを参照）。
- 可視ギャップ: 未割当バックログ（P0）。
- 行為: 割当 transition（R-T5 単一被割当者）、着手。
- 警告 → inbox: R-T3 過負荷、R-S7 陳腐化（原因別）、P5 解放済み後続。

**health（健全性・EVM / 初期プリセット: 管理者）**
- 上段: SPI（スケジュールカバレッジで de-rate；R-S6）／CPI、PV・EV_abs・AC（予算次元 MD）。
- 区別ゾーン（R-S5）: 「現行進捗 EV%」と「累積EV EV_abs／サンク／supersede 履歴」を分離表示。
- 実行カバレッジ(R-S8): EVM 文脈で EV% と並べて再掲（執行中量の確認。EV% と算術和しない＝仕掛中の量≠出来高）。三者併置（EV%・見積カバレッジ・実行カバレッジ）の主 host は spec-value（§4.1）。
- トレンド（SPI/CPI）・CCPM fever・スケジュール・バッファ残量/消費率（R-T6;スケジュール・カバレッジと対で de-rate）。
- 行為: スコープ/期日判断（R-T4）、再ベースライン。
- 警告 → inbox: R-T4 期日超過（超過量つき）、R-S3 thrashing。

**decision インボックス（横断・行為 / プリセット中立・actor フィルタで全員）**
- 「新規（未確認）」と「据え置き・既知」を区別表示（畳むが**会計には残す**；P0。件数サマリ＝全N件・うち据え置きM件 で会計算入を可視化）。
- 各行は文脈ビューの write へ deep-link（例 R-T4→[スコープ削減/要員/期日]、R-U13→[合意/再見積/cancel]、R-C3→[辺除去/付替/後続cancel]）。
- **自前状態を持たない**：行為が追記され導出が再評価されると条件が偽化した項目は自動的に消える（dismiss フラグを作らない）。

**capacity·calendar config（二層目データ c / プリセット中立・c 宣言は管理側）**
- 人 × 暦グリッドで c(i,d) ∈ [0,1.0] を per-date 入力、理由付き改定。**契約割当の改定**（reason=契約）は §2.1#5 のコミット判断、**暦由来の改定**（祝日/休暇/一時減）は可用性入力であり、両者を区別して扱う。
- α_i 契約レート view（c の reason=契約 成分）、R-U14 履歴（追記専用・理由付き・タイムスタンプ）。
- c 変更は P7 再導出をトリガー（R-S2）。陳腐化スロット（R-S7）の c 起因分へ相互リンク。

---

## 6. 実装の規律 / Implementation Disciplines

1. **層B は自前状態を持たない。** decision インボックスはキャッシュ/事前計算/dismiss フラグを持たず、同一導出（R-S2）の read 派生フィルタに徹する。破ると「真実源が可変状態」（PROTOTYPE 所見1）の画面版に転落する。
2. **deep-link は再計算でなく参照。** インボックスやサブ view が描く数値は、3ダッシュボードと同一のクエリ（P4）を参照する。二系統計算を禁ずる。
3. **選択肢列挙は導出層に一本化。** 各警告の取りうる行為（R-T4 の3択、R-U13 の3択、R-C3 の3行動）は導出層で一度だけ定義し、インボックスと文脈ビューで二重実装しない。
4. **横断判断は複数 deep-link を許す。** スコープ/期日（R-T4）は health と schedule-time の両文脈を要するため、片面飛びにしない。
5. **提示は会計から警告を除かない（P0 の falsifiable な線）。** 顕著さの抑制（畳む・淡色化・並び替え）は可だが、可視ギャップのカウント/リストから落とすのは P0 違反。

---

## 7. 未決・次の一手 / Open Items & Next Steps

- 本書を seed に `.kiro/specs/moira-dashboards`（および MODEL→`.kiro/steering`）へ移行（README の段階遷移）。
- 検証シナリオ **S4（健全性のリアルタイム把握）** を一本貫く最小バックエンド（イベント→導出→表示の型）。
- 高フィデリティのデザイン磨き込みは視覚識別が確定してから（本書のスコープ外）。

---

## 確定来歴 / Gate Provenance

**doc-refine ゲート通過（2026-06-19）— 独立採点者の残存 Critical/Important = 0。**
- 一次資料（ユーザー確定 SOURCE_SET）: `moira/MODEL.md`(v14) を主、`moira/PROTOTYPE-EVALUATION.md`・`moira/DECISIONS.md` を補助。
- Round 1: `doc-adversary`×3（攻撃角 G1–G4）＋ `doc-fact-checker`。fact-checker は本数（R-S2 導出11／警告9／区別表示6）・全要件IDの実在・HTML バッジ非捏造・現行版 v14 を CONFIRMED。
- 決着した主要指摘:
  - **Critical**: ①「4コミット判断」→ MODEL §2.1 は5つ ⇒「5つのうち4つを inbox 集約・5番目=c 宣言は config 面」に修正。②「9警告を集約」vs R-S6 が inbox 非集約の自己矛盾 ⇒ **ユーザー裁定 FORK「判断型と de-rate 型を区別」**を反映（inbox 集約8件＋R-S6 は health 常時修飾＝計9件すべてに host）。③「必要十分」の過大主張（MODEL が v10 で撤回した型）⇒ 見出し「割付の網羅性」・「十分性の証明ではない」へ軟化。
  - **Important（一次資料 CORRECTED 1件含む）**: 「二つの真実」は PROTOTYPE-EVALUATION に非存在 ⇒「本書独自の語。所見1『真実源が可変状態』の画面層版」と明記。消滅トリガーの精度（R-U12 現行 latest-wins 判定／R-S3 sustained window／P5 後続完了では消えない／R-U13 三択／R-S7 再収束閾値は実装定義／R-T3 aging-out）、「11」の根拠（三キュー=P4 同一クエリで1導出）、役割=フィルタの根拠（§2.1 主・P4 従）、§4.3 区別表示の定義、§5 config の契約改定/暦改定の区別、HTML（health に PV/EV_abs タイル・凡例「行為への導線」・inbox に R-U12/P5＋件数サマリで P0 可視化・キュー射影注記・サンプル日付・プリセット例示注記）。
- Round 2: `doc-gate-judge` が現物再検証し **PASS**（11/9/6 一致、9件全 host、HTML↔md 被覆一致、新規 Critical なし）。
- 非ブロッキングで残した Suggestion: §2/§6 の原則↔実装規律の一部再述、フォントのプラットフォーム差、α_i と c が乖離する例の未図示、MODEL 改版時の本書更新契機。
- 本書は MODEL-class ではない派生設計物。MODEL が改版された場合は本書の被覆表を再点検し、必要なら再度 doc-refine を通す。

**v14→v16 被覆表更新（moira-model-update Phase 0・0e 陳腐化解消）：**
- §4.1: R-S2 導出数を 11→13 に更新（実行カバレッジ R-S8 + スケジュール・バッファ残量/消費率 R-T6 の 2 件追加）。
- §5 health: 三者対読み（EV%・見積カバレッジ・実行カバレッジ）と R-T6 バッファ残量/消費率を追記。
- §4.3: R-S5 の表示名を「累積EV(EV_abs)」に統一（ユーザー裁定「累積EV のほうがわかりやすい」）。
- 版参照を v14→v16 に更新。警告数（9）・区別表示規則（6）は v14→v16 で変更なし。
