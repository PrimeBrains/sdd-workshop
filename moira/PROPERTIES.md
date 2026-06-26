# Moira プロパティ目録（不変条件カタログ）v0.2

状態: **全23プロパティ agreed（人間批准済み・v0.2）**。方針は [.kiro/steering/moira-verification.md](../.kiro/steering/moira-verification.md)、正典は [MODEL.md](MODEL.md)。

本目録は、MODEL の不変条件（オラクル）を**人間がレビューできる平易な一文**に落とし、実行可能なテスト（PBT・境界モデル検査・否定）の**一次仕様**とするもの。実行テストはこの一文の形式化した射影を目指す。

## レビューの仕方（これだけ）

- **「平易な一文」列だけ**を読み、「うん、それが私の意図」か「いや違う」を判定する。コードは見なくてよい。
- AI（**実装とは別エージェント**）が一文を `proposed` で起こし、人間が `agreed` で批准／差し戻す。＝MODEL 自身の `proposed→agreed` 規律をプロパティに自己適用。
- 専門用語・skill 実名は本文に出さない（シナリオ README と同等の言語規約）。

## 規約

- **根拠は安定 clause ID（A/I/P/R/§）で参照**（行番号は使わない）。定義は MODEL に従い、矛盾時は MODEL が勝つ。
- 各行は「**固定する量**」と「**意図的に FREE な量**」を必ず持つ（何を縛り何を開けるかを人間が見える化）。
- **レビュー**列: `proposed`（AI 起案・人間未批准）/ `agreed`（人間批准済み）。
- 計器: **PBT**=参照実装に対する性質テスト／**MC**=MODEL を仕様とする境界モデル検査／**DENY**=書かない・否定プロパティ。

---

## A. PBT（参照実装 `moira/backend` に対する性質）

| ID | 根拠 | 人間がレビューする一文 | 固定する量 | 意図的に FREE | レビュー |
|---|---|---|---|---|---|
| PR-EVPCT-RANGE | R-U8・P1 | **見積に人が合意しないまま完了した作業は、出来高(EV)として計上しない**（EV は合意済み領域だけを語り、未合意分はカバレッジ低下として可視化）。その結果、達成率 EV% は常に 0〜100% に収まる（合意済みがゼロなら EV%=0 と定義） | EV%∈[0,1]／未合意完了は EV_abs 非算入／分母 0 時 EV%=0 | 具体的な EV% 値・木の形 | agreed |
| **PR-DONE-LOCK ★** | I4・R-E3 | いったん**完了して出来高が確定した**作業の出来高(EV_abs)は、後から何をしても**額自体は減らない**（キャンセルで active→sunk に分類が移ることはあるが額は不変——分類は PR-CANCEL-SUNK）。完了済みを変えたいときは**新しい行を立てて差し替え**（旧行の出来高は累積に残る）。見積のやり直しで出来高や率が動くのは、**まだ完了していない**作業だけ | 完了ノードの EV_abs 不変（額） | 未完了ノードの EV%・カバレッジは動いてよい | agreed |
| PR-I1-ROLLUP | I1 | 親の見積は、**合意済みの子**の見積の合計に一致する。まだ見積もっていない子は『カバレッジ低下』として現れ、整合の破れにはしない | 親=Σ(合意済み子) | 未見積子の存在（カバレッジで表現）・木の深さ | agreed |
| PR-AC-ROLLUP | P3 | 実コスト(AC)はツリーを下から積み上げた合計。各ノードのACは「**そのノードに直接付いたコスト＋子のACの合計**」で、コストは普通*実際に作業する葉*に付くため、集約だけの親ノードのACは実質「子のACの合計」になる | AC=自コスト+ΣAC(子)（任意の木で成立） | 具体額・どのノードにコストが付くか | agreed |
| PR-CANCEL-EXCL | R-C2 | タスクをキャンセルしても、有効分の出来高(EV_abs)は**増えない**。キャンセルは稼働対象から外れる | EV_abs 非増・active basis 除外 | サンク EV_abs の値 | agreed |
| PR-CANCEL-SUNK | R-C2・A2・P3 | キャンセルしても**費やした実コスト(AC)は消えない**（コストは事実・追記専用）。出来高は偽装せず、完了済みサブ単位分のみサンクに出る——未完了ならサンク EV_abs=0 | ①AC は cancelled コストを保持（A2 追記専用・P3 集約）②サンク EV_abs＝完了済み稼得のみ（R-C2・R-U8） | サンク額 | agreed |
| PR-CANCEL-INVISIBLE | R-C2・P4 | キャンセル済みノードは作業キュー・レビューキュー・未割当バックログの**いずれにも現れない**（『これ何だっけ?』を生まない） | 全キュー・バックログから除外 | 表示順・分類 | agreed |
| PR-CUM-GE-EFF | R-S5 | 過去に実際に働いた**累積出来高**は、**現行有効分**の出来高を下回らない（置換された旧タスクの働きは累積に残る） | 累積EV ≥ 現行有効EV | 差の値 | agreed |
| PR-COST-NEUTRAL | P6・R-U10 | コストを足しても実コスト(AC)が増えるだけで、達成率(EV%)・出来高(EV_abs)・予定価値(PV)・SPI は**動かない**（CPI は AC が分母なので動く——これは正しい挙動） | cost 追記で EV%/EV_abs/PV/SPI 不変 | AC 増分・CPI の変動 | agreed |
| PR-COST-DEDUP | §2.8 | 同じコスト記録(同じ id)を二重に入れても**二重計上されない**。一方、本当に二度働いた(別 id)場合はちゃんと加算される | 同 id は no-op／別 id は加算 | 額 | agreed |
| PR-PV-EXCL | §3 | 予定価値(PV)には、**合意済みかつスケジュール済み**のタスクだけが入る。どちらか片方だけのタスクは入らず、可視ギャップになる | PV は合意済み AND スケジュール済みの 2 条件。キャンセル除外は effective-set 経由（PR-CANCEL-EXCL） | 具体 PV 値 | agreed |

### メタモルフィック（PBT）

| ID | 根拠 | 人間がレビューする一文 | 固定する量 | 意図的に FREE | レビュー |
|---|---|---|---|---|---|
| PM-ORDER-INV | I3 | イベントの**記録順を入れ替えても**（同じ時刻・同じ id の並びを保つ限り）、導出結果は完全に同じになる | (ts,id) 保存の並べ替えで導出同一 | 入力配列の物理順 | agreed |
| PM-SCALE-INV | P1 | 全タスクの**見積と実コストを同じ単位で測り直す**（例: 日→時間、k=8）と、出来高・予定価値・実コストはすべて k 倍になるが、**達成率・SPI・CPI・各カバレッジは変わらない**（誰も余計に働いていない＝物差しを変えただけ）。完了予定日などの**時間軸は k 倍にならない＝対象外** | 見積 AND コストの単位換算スケール則（EV%/SPI/CPI/カバレッジ不変）／時間軸は非対象 | k 値 | agreed |
| PM-CAP-MONO | §3 | 容量 c を下げると、どのタスクの完了**予測**も早くはならず、**予算総額は変わらない** | c 減で予測非早期化・予算総額不変 | 具体日付 | agreed |

---

## B. MC（MODEL を仕様とする境界モデル検査）

スコープを明示し、その範囲を全数列挙する。連続量（日付・c・予算）は対象に入れない。

| ID | 根拠 | 人間がレビューする一文 | 固定する量 | 検証スコープ | レビュー |
|---|---|---|---|---|---|
| MC-LIFECYCLE | §2.5 | ライフサイクルは決められた順路しか辿れない。**不正な遷移**（例: 受入済みから実装中へ）が、完了としての出来高を生むことは**ない** | 不正遷移が完了寄与を生まない | ノード1・遷移列≤6 | agreed |
| MC-CONFLICT | I3・R-U12 | 2人が同じタスクに違う値で合意しても（**時刻が同一でも異なっても**）、現行値は決定的に1つに定まり、**矛盾警告が立つ** | 全順序で現行値決定的＋警告 | ノード1・actor2・イベント2 | agreed |
| MC-IDUNIQ | I3 | 2つの別々のイベントが**同じ時刻・同じ id** を持つこと（順序が非決定になる）は起きてはならない（拒否されるか決定的に扱われる） | (ts,id) 衝突の排除／決定性 | 小スコープ全順序 | agreed |
| MC-SUP-CANCEL | §2.7・R-S5・R-C2 | supersede と cancel が**どんな順序で到着しても**、有効集合は正しく、出来高の二重計上も誤った脱落も起きない | 全到着順で有効集合正・EV_abs 整合 | ノード2・イベント≤4 | agreed |

---

## C. DENY（書かない／否定プロパティ）

「やること」だけでなく「**意図的にやらないこと**」も記録する。これが無いと正しい挙動を誤ってバグ報告してしまう。否定プロパティは**到達 witness 必須**（条件を実際に踏んだ上で『黙る』ことを確認）。

| ID | 根拠 | 人間がレビューする一文 | 種別 | レビュー |
|---|---|---|---|---|
| DN-MONOTONIC | P5・R-E4・R-E3 | 達成率は**下がることがある**（手戻り・上方再見積・新規合意）。分母縮小で**上がる**こともある（合意→未合意復帰で分母が縮む）。これは正直な信号でバグではない。ゆえに『増える一方』とも『減る一方』とも**決してテストしない** | テスト禁止 | agreed |
| DN-IMPL-DATES | P8・§7 | 完了予測・プロジェクト導出完了・バッファの**絶対値**は実装依存。MODEL 不変条件として固定しない（実装特性の golden 固定は別枠で可） | テスト禁止（別枠 golden は可） | agreed |
| DN-CAL-SILENT | §7（暦の穴） | 将来の休暇を入れ忘れても、システムは**警告しない**（既定1.0で楽観計算）。意図した穴で暦保守は人間の責任。検知を期待せず『黙る』ことを確認する | 否定（witness 付き） | agreed |
| DN-DRIFT-SILENT | §7（ドリフト） | 記録上の c と実態のズレ（記録1.0だが実は休んでいた等）は**検知しない**。予測も凍結スロットも記録値から導くため。認識は人間の責任 | 否定（witness 付き） | agreed |
| DN-MATURITY-BLIND | §7（前倒し） | 前倒し見積を早期合意するとカバレッジは回復するが、それが情報の薄い見積か成熟した見積かを**システムは区別しない**。成熟度の軸は持たない | 否定（witness 付き） | agreed |

---

## clause → property 被覆

各 clause family ごとに bound（プロパティが根拠として引く）/ 未 bound を一覧する。未 bound は可視ギャップとして残し、増分で埋める。

### A系（公理 6 本）

| clause | bound by | 備考 |
|---|---|---|
| A1 | — | 未 bound: 構造公理（ノードのみが存在する） |
| A2 | PR-CANCEL-SUNK | 追記専用——間接 bound（コスト保持の根拠） |
| A3 | — | 未 bound: 構造公理（木＋DAG） |
| A4 | — | 未 bound: 構造公理（c の定義）。PM-CAP-MONO が c を操作するが A4 自体は bind していない |
| A5 | — | 未 bound: 三つの非対称。I6/R-U4 で個別に bind |
| A6 | PR-CANCEL-SUNK | 単一通貨——間接 bound（コストは事実の根拠） |

### I系（不変条件 6 本）

| clause | bound by | 備考 |
|---|---|---|
| I1 | PR-I1-ROLLUP | ロールアップ整合 |
| I2 | — | **未 bound: 非循環。MC セクションに直接テストなし** |
| I3 | PM-ORDER-INV・MC-CONFLICT・MC-IDUNIQ | (ts,id) 決定的順序 |
| I4 | PR-DONE-LOCK | 完了施錠 |
| I5 | — | **未 bound: 遷移の被指示性（R-D6 と対）** |
| I6 | — | **未 bound: 合意権限（人間のみ。R-U4 と対）** |

### P系（原理 9 本）

| clause | bound by | 備考 |
|---|---|---|
| P0 | — | 未 bound: メタ原理（コミット領域のみを語る） |
| P1 | PR-EVPCT-RANGE・PM-SCALE-INV | EV% 導出 |
| P2 | — | **未 bound: 見積カバレッジ（葉基底）。テスト追加候補** |
| P3 | PR-AC-ROLLUP・PR-CANCEL-SUNK | AC 集約 |
| P4 | PR-CANCEL-INVISIBLE | 三キュー同型 |
| P5 | DN-MONOTONIC | 非単調 EV% |
| P6 | PR-COST-NEUTRAL・PR-CANCEL-SUNK | 滞在≠コスト |
| P7 | — | **未 bound: スケジュールは人間接点律速** |
| P8 | DN-IMPL-DATES | スケジュールは発見的（NP 困難） |

### R-U系（ユビキタス要件 14 本）

| clause | bound by | 備考 |
|---|---|---|
| R-U1 | — | 未 bound: ノード＝唯一の実体 |
| R-U2 | — | 未 bound: 追記専用・直接 mutation 拒否 |
| R-U3 | — | 未 bound: 見積＝proposed/agreed を持つ提案 |
| R-U4 | — | 未 bound: 合意は人間のみ（I6 と対） |
| R-U5 | — | 未 bound: ノード単位合意 |
| R-U6 | — | 未 bound: スキルモデル化しない |
| R-U7 | — | 未 bound: 凍結値・理由付き改訂 |
| R-U8 | PR-EVPCT-RANGE | EV%（合意済みのみ算入） |
| R-U9 | — | 未 bound: コミット領域のみ・可視ギャップ |
| R-U10 | PR-COST-NEUTRAL | コストを EV に折り込まない |
| R-U11 | — | 未 bound: 人間のみ c 平準化 |
| R-U12 | MC-CONFLICT | 矛盾合意検知 |
| R-U13 | — | 未 bound: 未合意完了警告 |
| R-U14 | — | 未 bound: c の変更履歴追跡 |

### R-E系（見積要件 6 本）

| clause | bound by | 備考 |
|---|---|---|
| R-E1 | — | 未 bound: 見積値は被見積ノードに乗る |
| R-E1b | — | 未 bound: est(impl) は tasks.md 入力 |
| R-E2 | — | 未 bound: 見積記録は decompose + transition |
| R-E2b | — | 未 bound: 見積作業のノード化（P0 判断） |
| R-E3 | PR-DONE-LOCK・DN-MONOTONIC | agreed→proposed 復帰（未完了限定） |
| R-E4 | DN-MONOTONIC | 残余作業増大→EV 低下 |

### R-S系（進捗・状態要件 8 本）

| clause | bound by | 備考 |
|---|---|---|
| R-S1 | — | 未 bound: 完了時凍結 |
| R-S2 | — | 未 bound: 再導出契機 |
| R-S3 | — | 未 bound: スラッシュ検知 |
| R-S4 | — | 未 bound: 低カバレッジ時 de-rate |
| R-S5 | PR-CUM-GE-EFF・MC-SUP-CANCEL | 累積 EV ≥ 有効 EV |
| R-S6 | — | 未 bound: スケジュールカバレッジ de-rate |
| R-S7 | — | **未 bound: 乖離フラグ・原因帰属・解除条件** |
| R-S8 | — | 未 bound: 実行カバレッジ |

### R-T系（時間・スケジュール要件 6 本）

| clause | bound by | 備考 |
|---|---|---|
| R-T1 | — | 未 bound: c 平準化スケジュール導出 |
| R-T2 | — | 未 bound: エージェント作業のスパン表示 |
| R-T3 | — | 未 bound: 過負荷検知 |
| R-T4 | — | 未 bound: 期日超過検知 |
| R-T5 | — | 未 bound: 暫定割当 |
| R-T6 | — | 未 bound: バッファ導出 |

### R-C系（キャンセル要件 3 本）

| clause | bound by | 備考 |
|---|---|---|
| R-C1 | — | 未 bound: cancelled 発行（transition to terminal） |
| R-C2 | PR-CANCEL-EXCL・PR-CANCEL-SUNK・PR-CANCEL-INVISIBLE・MC-SUP-CANCEL | active basis 除外・サンク EV_abs |
| R-C3 | — | 未 bound: キャンセル孤児警告 |

### R-D系（依存・整合要件 7 本）

| clause | bound by | 備考 |
|---|---|---|
| R-D1 | — | 未 bound: 先行充足で ready |
| R-D2 | — | 未 bound: 辺ポリシー既定 |
| R-D3 | — | 未 bound: 循環拒否（I2 と対） |
| R-D4 | — | 未 bound: 論理述語評価 |
| R-D5 | — | 未 bound: 同一 ts の id 決定的順序（I3 と対） |
| R-D6 | — | 未 bound: 状態機械名指し義務（I5 と対） |
| R-D7 | — | 未 bound: supersede edge ≠ backward transition |

### §系（構造規約）

| clause | bound by | 備考 |
|---|---|---|
| §2.5 | MC-LIFECYCLE | 状態語彙・lifecycle 状態機械 |
| §2.7 | MC-SUP-CANCEL | supersede 力学 |
| §2.8 | PR-COST-DEDUP | 4 イベント（コスト dedup） |
| §3 | PR-PV-EXCL・PM-CAP-MONO | EVM 原理・導出定義 |
| §7 | DN-CAL-SILENT・DN-DRIFT-SILENT・DN-MATURITY-BLIND・DN-IMPL-DATES | 未解決・開放項目 |

> §0/§1/§2.1-§2.4/§2.6/§2.9/§4/§5/§6 はメタ的記述または番号付き clause（A/I/P/R）と同型。独立にテストする対象ではなく、上記の番号付き clause 被覆で間接カバーされる。

### 外的妥当性（受け入れシナリオ）

| シナリオ | 対応プロパティ | 状態 |
|---|---|---|
| cancel-task-midway | PR-CANCEL-EXCL・PR-CANCEL-SUNK・PR-CANCEL-INVISIBLE | draft |
| estimate-spec-agreed | — | agreed |
| estimate-spec-proposed | — | agreed |
| assign-spec-provisional | — | agreed |

---

## 被覆サマリー

| family | 全 clause 数 | bound 数 | 未 bound 数 | bound 率 |
|---|---|---|---|---|
| A系 | 6 | 2 | 4 | 33% |
| I系 | 6 | 3 | 3 | 50% |
| P系 | 9 | 6 | 3 | 67% |
| R-U | 14 | 3 | 11 | 21% |
| R-E | 6 | 2 | 4 | 33% |
| R-S | 8 | 1 | 7 | 13% |
| R-T | 6 | 0 | 6 | 0% |
| R-C | 3 | 1 | 2 | 33% |
| R-D | 7 | 0 | 7 | 0% |
| **合計** | **65** | **18** | **47** | **28%** |

未 bound clause は可視ギャップとして残し、批准後に増分で埋める。**R-T 系と R-D 系は全 clause が未 bound** であり、次版の優先候補。

---

## v0.1→v0.2 変更点

doc-refine（敵対的レビュー Round 1）で検出した以下を修正。**一文の意図を変更したものは `proposed` に戻して再批准を要求**している。

1. **現状列を廃止、レビュー列（proposed/agreed）を追加**——テスト実装状態は陳腐化するため人間の一文レビュー事実のみ保持（ユーザー裁定）。
2. **被覆報告を clause family 別に完全化**——v0.1 は 40+ clause が bound/unbound いずれにも未列挙だった。全 65 clause を網羅。
3. **PR-CANCEL-SUNK**: 根拠を A6/P6→A2/P3 に修正（A6 は単一通貨・P6 は滞在≠コストであり AC 保持の直接根拠ではない）。一文を簡潔化。→ `proposed`
4. **PR-PV-EXCL**: 固定列「3除外」→「2条件」に修正。3つ目（cancelled 除外）は PV 固有でなく effective-set 経由。→ `proposed`
5. **PM-CAP-MONO**: 「凍結スロットは動かない」を除去（定義上不変であり空虚）。根拠から R-S7 を除去（PM-CAP-MONO は R-S7 の中核要件=乖離フラグ・原因帰属を検証しない）。R-S7 は未 bound に移動。→ `proposed`
6. **PM-SCALE-INV**: 「見積を k 倍」→**単位換算フレーム**（見積と実コストを同じ単位で測り直す=日→時間）に再framing。EV%/SPI/CPI/カバレッジすべて不変。「コストのみ非スケールだと CPI が壊れる」敵対者指摘への対応＝出来高(EV)は努力でなく予算ベースゆえ見積と共にスケールする、を人間批准で確定。
7. **MC-CONFLICT**: 「同時刻に」→「時刻が同一でも異なっても」に修正（R-U12 は temporal proximity を問わない）。→ `proposed`
8. **DN-MONOTONIC**: R-E3 の上昇機序（分母縮小→EV%上昇）を追記。→ `proposed`
9. **PR-COST-NEUTRAL**: CPI は AC 分母ゆえ cost 追記で動くことを明記。→ `proposed`
10. **PR-EVPCT-RANGE**: 分母ゼロケース（合意済みゼロ→EV%=0）を明記。意図不変のため `agreed` 維持。
11. **PR-DONE-LOCK**: キャンセルによる active→sunk 分類移動の carve-out を明記。意図不変のため `agreed` 維持。
12. **MC-LIFECYCLE**: 「絶対にない」→「ない」に調整。意図不変のため `agreed` 維持。
13. **moira-naming.md 参照を除去**: P2 定義がノード基底のまま陳腐化（MODEL v18 は葉基底）。正典は MODEL に一本化。
14. **「実行テストはこの一文の*射影*」→「形式化した射影を*目指す*」に正直化**。

## 次手（批准が通ったら）

最小パイロット（ログのみ・実装変更ゼロ）: **PR-EVPCT-RANGE / PR-I1-ROLLUP / PR-CANCEL-EXCL / PR-AC-ROLLUP / PM-ORDER-INV** ＋ 決定打 **PR-DONE-LOCK★**（現実装が赤になることを実走で確認）。生成器2つ（イベントログ＋容量 c）を敵対的構成・一級レビュー対象として用意する（[moira-verification.md](../.kiro/steering/moira-verification.md)）。
