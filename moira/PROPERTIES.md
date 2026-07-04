# Moira プロパティ目録（不変条件カタログ）v0.4

状態: **54プロパティ＝51 agreed＋3 proposed（要批准）**。要批准 3 件＝ PR-REPARENT-HEAL・PM-TREE-INV（v20 所属の latest-wins 由来・bb81ff2 で収載済み）・PR-THRASH（R-S3 の畳んだレビュー carve-out 追随のため `agreed` から再降格）。v0.3 時点の52件は全件人間批准済み。方針は [.kiro/steering/moira-verification.md](../.kiro/steering/moira-verification.md)、正典は [MODEL.md](MODEL.md)。

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
- **★impl-pending** 印: 参照実装（`moira/backend`、または表示側 `moira/frontend` の**純導出モジュール**）に当該導出がまだ無いため、実行テスト化は実装到達後（仕様＝MODEL に対しては今すぐレビュー可）。

---

## A. PBT（参照実装 `moira/backend` に対する性質）

| ID | 根拠 | 人間がレビューする一文 | 固定する量 | 意図的に FREE | レビュー |
|---|---|---|---|---|---|
| PR-EVPCT-RANGE | R-U8・P1 | **見積に人が合意しないまま完了した作業は、出来高(EV)として計上しない**（EV は合意済み領域だけを語り、未合意分はカバレッジ低下として可視化）。その結果、達成率 EV% は常に 0〜100% に収まる（合意済みがゼロなら EV%=0 と定義） | EV%∈[0,1]／未合意完了は EV_abs 非算入／分母 0 時 EV%=0 | 具体的な EV% 値・木の形 | agreed |
| **PR-DONE-LOCK** | I4・R-E3 | いったん**完了して出来高が確定した**作業の出来高(EV_abs)は、後から何をしても**額自体は減らない**（キャンセルで active→sunk に分類が移ることはあるが額は不変——分類は PR-CANCEL-SUNK）。完了済みを変えたいときは**新しい行を立てて差し替え**（旧行の出来高は累積に残る）。見積のやり直しで出来高や率が動くのは、**まだ完了していない**作業だけ | 完了ノードの EV_abs 不変（額） | 未完了ノードの EV%・カバレッジは動いてよい | agreed |
| PR-I1-ROLLUP | I1 | 親の見積は、**合意済みの子**の見積の合計に一致する。まだ見積もっていない子は『カバレッジ低下』として現れ、整合の破れにはしない | 親=Σ(合意済み子) | 未見積子の存在（カバレッジで表現）・木の深さ | agreed |
| PR-AC-ROLLUP | P3 | 実コスト(AC)はツリーを下から積み上げた合計。各ノードのACは「**そのノードに直接付いたコスト＋子のACの合計**」で、コストは普通*実際に作業する葉*に付くため、集約だけの親ノードのACは実質「子のACの合計」になる | AC=自コスト+ΣAC(子)（任意の木で成立） | 具体額・どのノードにコストが付くか | agreed |
| PR-CANCEL-EXCL | R-C2 | タスクをキャンセルしても、有効分の出来高(EV_abs)は**増えない**。キャンセルは稼働対象から外れる | EV_abs 非増・active basis 除外 | サンク EV_abs の値 | agreed |
| PR-CANCEL-SUNK | R-C2・A2・P3 | キャンセルしても**費やした実コスト(AC)は消えない**（コストは事実・追記専用）。出来高は偽装せず、完了済みサブ単位分のみサンクに出る——未完了ならサンク EV_abs=0 | ①AC は cancelled コストを保持（A2 追記専用・P3 集約）②サンク EV_abs＝完了済み稼得のみ（R-C2・R-U8） | サンク額 | agreed |
| PR-CANCEL-INVISIBLE | R-C2・P4 | キャンセル済みノードは作業キュー・レビューキュー・未割当バックログの**いずれにも現れない**（『これ何だっけ?』を生まない） | 全キュー・バックログから除外 | 表示順・分類 | agreed |
| PR-CUM-GE-EFF | R-S5 | 過去に実際に働いた**累積出来高**は、**現行有効分**の出来高を下回らない（置換された旧タスクの働きは累積に残る） | 累積EV ≥ 現行有効EV | 差の値 | agreed |
| PR-COST-NEUTRAL | P6・R-U10 | コストを足しても実コスト(AC)が増えるだけで、達成率(EV%)・出来高(EV_abs)・予定価値(PV)・SPI は**動かない**（CPI は AC が分母なので動く——これは正しい挙動） | cost 追記で EV%/EV_abs/PV/SPI 不変 | AC 増分・CPI の変動 | agreed |
| PR-COST-DEDUP | §2.8 | 同じコスト記録(同じ id)を二重に入れても**二重計上されない**。一方、本当に二度働いた(別 id)場合はちゃんと加算される | 同 id は no-op／別 id は加算 | 額 | agreed |
| PR-PV-EXCL | §3 | 予定価値(PV)には、**合意済みかつスケジュール済み**のタスクだけが入る。どちらか片方だけのタスクは入らず、可視ギャップになる | PV は合意済み AND スケジュール済みの 2 条件。キャンセル除外は effective-set 経由（PR-CANCEL-EXCL） | 具体 PV 値 | agreed |
| **PR-COVERAGE-LEAF** | P2・I1・R-S4 | 見積カバレッジは「**合意済みの有効な葉 ÷ 既知の有効な葉**」で測る。葉がぜんぶ合意済みなら 100% に達し、まとめ役の中間ノードは分母に数えない。supersede／キャンセルされた葉も分母に入らない | カバレッジ=合意済み有効葉/既知有効葉（葉基底）・全葉合意→100%・中間ノード非算入・supersede/cancelled 葉除外 | 木の形・葉の数 | agreed |
| **PR-COVERAGE-DISCOVERY** | R-E1b・R-E4・P2 | 実装作業が「**未見積の葉**」として現れるとカバレッジは下がり（＝やるべき作業を新たに発見した）、その葉に人が見積を合意するとカバレッジは戻る。この間、確定済みの出来高(EV_abs)は動かない | 未見積葉誕生でカバレッジ低下・合意で回復・EV_abs 不変 | 低下幅・回復タイミング・木の形 | agreed |
| **PR-EXECCOV** | R-S8 | 「**いま手をつけている作業の割合**」（実行カバレッジ）は、合意済みの有効な葉のうち着手中のものの数の比で測る。これは仕掛かりの“量”であって出来高ではないので、達成率(EV%)と足し算して全体進捗にしてはいけない。見積をやり直しても動かず、状態が変わったときだけ動く（着手中がゼロなら 0） | execCov=着手中の合意済み有効葉/合意済み有効葉（数比）・EV% と非加算・再見積で不動・分母 0→0 | 具体値・どの葉が着手中か | agreed |
| **PR-CAP-DOMAIN** | A4・R-U11 | 人の一日の容量は **0〜1.0** の範囲で、指定のない日は 1.0 として扱う。休暇（容量 0）の日には計画作業が載らない。容量は「使える時間」であって能力ではない | c∈[0,1.0]・未指定日=1.0・c=0 日は計画作業ゼロ・能力非モデル化 | 具体容量値・暦 | agreed |
| **PR-CAP-HISTORY** | R-U14・A4 | 各人の容量の変更は**理由付き・追記専用**の履歴として残り、過去のある時点のスケジュールを同じ入力からもう一度導ける | c 履歴=追記専用・理由付き・同入力で再現一致 | 変更回数・理由文言 | agreed |
| **PR-AGENT-UNLEVELED** | A5・R-U11・P7・R-T1 | 容量の制約（平準化）を受けるのは**人間だけ**で、エージェントは制約を受けず遊休してよい。人を増減させてもエージェントの予定本数は容量で削られない | 平準化対象=人間のみ・エージェント非制約 | 充填順・具体スロット | agreed |
| **PR-CRITPATH-AGENT** | R-T2・P7・P6 | プロジェクトの着地予想（導出完了日）は、依存関係のうち**最も長い経路＝クリティカルパス**で決まる。エージェント作業は容量平準化の対象外（人を増減しても予定本数は削られない）だが、その所要時間は**実際に経過する時間**なので、人間作業と同じく**無条件にパス長へ算入される**——後続が人間でも、後続が無い末尾のエージェント作業でも、完了日を正しく後ろへ動かす（『人間の後続を待たせている場合』はその代表例にすぎず、算入の条件ではない） | クリティカルパス＝依存辺のみの全依存連鎖の最長路（置換辺=supersede は除く）・エージェントのリードタイムも後続種別を問わず無条件にパス長へ算入（末尾エージェント含む）・対象は有効・割当済みの葉・容量平準化は人間のみ | 具体日数・どの経路が最長か | agreed |
| **PR-EDGE-POLICY** | R-D2 | 依存のつながりごとに「どこまで進めば次に進めるか」の閾値を持ち、指定がなければ種別ごとの既定（仕様フェーズのつながり＝承認済み、実装のつながり＝実装完了）を使う | 閾値=辺ごと属性・既定（仕様=accepted／実装=implemented） | 具体閾値の明示指定 | agreed |
| **PR-ASSIGNEE-REVIEWER** | R-T5・§2.4・§7#18(b) | 一つの作業の担当者(assignee)は**常に一人**で、新しく名指すと前の担当を置き換える。レビュー担当(reviewer)の**指名そのもの**は担当者とは別枠・人間限定で、名指しても容量平準化・出来高(EV)・予定価値(PV)・各カバレッジは**一切動かない**。ただし『動かない』のは*指名*の話であって、レビュー*作業そのもの*を（重ければ）通常の作業ノードとして立てた場合は、それは普通の作業ノードとして——その作業ノードの担当(assignee)を通じて——出来高・平準化に参加する（reviewer 指名の非干渉とは別物；軽ければ畳んで被レビューノードに cost 計上） | 担当(assignee)単一・latest-wins／reviewer *指名属性* は人間限定・別軸・会計非干渉（leveler/EV/PV/coverage を動かさない）／レビュー*作業ノード*化時の会計参加は当該作業ノードの assignee によるもので reviewer 属性とは別 | 担当・reviewer の具体人物・レビュー作業のノード化/畳み(P0) | agreed |
| **PR-FROZEN-REASON** | R-U7 | 見積は「**最新値**」と「**理由付きの凍結値**」を別々に持ち、凍結値を書き換えるときは必ず理由を要する | 最新値と凍結値を別保持・凍結改訂は理由必須 | 具体値・理由文言 | agreed |
| **PR-SUPERSEDE-SHAPE** | R-D7・§2.7・I2 | 完了済みを作り直すときは、古いノードを巻き戻さず、**新しいノードを立てて「新→旧」の置換辺**を張る。古いノードはそのまま不変で、その出来高は累積に残る。置換辺が循環を作ることはない | 置換=新ノード＋新→旧辺・旧不変・非循環 | ノード数・辺の数 | agreed |
| **PR-EVENTS-ONLY** | R-U2・A2・R-U1・§2.8 | 状態の変化は **4 種類の追記イベントだけ**で起こり、保存済みの状態を直接書き換えることはできない（同じイベント列を再生すれば同じ状態になる） | 状態変化=4 イベントのみ・直接変更拒否・再生決定的 | イベント内容 | agreed |
| **PR-REPARENT-HEAL** | §2.8(所属の latest-wins)・A2 | 間違った親に付けてしまった作業は、**正しい親の下へもう一度 decompose するだけ**で元に戻る（歴史は消さず追記で補償）。戻したあとの導出は、間違いが一度も無かった場合と一致する（履歴表示を除く） | 誤親付け＋補償再 decompose ≡ クリーンログ（activityLog 除く全導出の深い等価）・非空虚 witness（誤りが実際に木を動かしたこと） | 木の形・どの葉を誤親付けするか | proposed |
| **PR-THRASH** | R-S3 | 出来高(EV_abs)が増えないのに実コスト(AC)が**一定期間ずっと増え続ける**ときは空回りとして警告する。一方、**畳んだ見積作業または畳んだレビュー作業**のコストが一度だけ載るのは正常で、それ単独では警告しない | 持続的 AC 増＋EV_abs 不増→警告／単発の畳みコスト（見積・レビューとも）は非警告 | 閾値・期間長 | proposed |
| **PR-BUFFER-CLAMP ★** | R-T6・§3・R-T4 | バッファ残量は「**期日 − 見通し完了日**」で、マイナスにはせず 0 で止める（超過分は期日超過の警告側が持つ）。期日が無ければバッファは未定義、目標日が無ければ消費率は出さず残量のみ、目標日が期日より後なら構成エラーとして警告する | 残量=max(0,期日−D_pred)・消費率 clamp[0,1]・境界条件（期日/目標日の有無で N/A） | 具体日付・D_pred 絶対値 | agreed |

### メタモルフィック（PBT）

| ID | 根拠 | 人間がレビューする一文 | 固定する量 | 意図的に FREE | レビュー |
|---|---|---|---|---|---|
| PM-ORDER-INV | I3 | イベントの**記録順を入れ替えても**（同じ時刻・同じ id の並びを保つ限り）、導出結果は完全に同じになる | (ts,id) 保存の並べ替えで導出同一 | 入力配列の物理順 | agreed |
| PM-SCALE-INV | P1 | 全タスクの**見積と実コストを同じ単位で測り直す**（例: 日→時間、k=8）と、出来高・予定価値・実コストはすべて k 倍になるが、**達成率・SPI・CPI・各カバレッジは変わらない**（誰も余計に働いていない＝物差しを変えただけ）。完了予定日などの**時間軸は k 倍にならない＝対象外** | 見積 AND コストの単位換算スケール則（EV%/SPI/CPI/カバレッジ不変）／時間軸は非対象 | k 値 | agreed |
| PM-CAP-MONO | §3 | 容量 c を下げると、どのタスクの完了**予測**も早くはならず、**予算総額は変わらない** | c 減で予測非早期化・予算総額不変 | 具体日付 | agreed |
| **PM-REDERIVE-CONSISTENT** | R-S2・I3 | ログ全体から一気に導出しても、イベントを 1 件ずつ足しながら導出しても、結果は同じになる。容量・期日・目標日の変更も同じく再導出の契機になる | 一括導出=増分導出・構成入力（c・期日・目標日）変更も再導出契機 | 導出の物理手順 | agreed |
| **PM-BUFFER-DEADLINE-MONO ★** | R-T6 | 期日を**後ろへ動かす**と、バッファ残量は減らない（増えるか同じ）。見通し完了日が変わらない限り、期日を縮めずに残量が増えることはない | 期日↑でバッファ残量非減少 | 残量の具体値 | agreed |
| **PM-TREE-INV** | A3・§2.8(所属の latest-wins)・I3 | 所属は**木**である——どのノードも有効親は高々1つ、親子の帳簿は親ポインタの正確な逆像、親をたどる鎖は必ず途切れる（循環しない）。誤った親付けを何度重ねても、二重所属や循環は**表現されない**（循環を生む decompose は可視エラーで拒否） | 単一有効親・childrenOf=親ポインタの逆像・親鎖の停止（非循環）——任意の誤親付け追記の後も成立 | 木の形・誤親付けの回数と対象 | proposed |

---

## B. MC（MODEL を仕様とする境界モデル検査）

スコープを明示し、その範囲を全数列挙する。連続量（日付・c・予算）は対象に入れない。

| ID | 根拠 | 人間がレビューする一文 | 固定する量 | 検証スコープ | レビュー |
|---|---|---|---|---|---|
| MC-LIFECYCLE | §2.5 | ライフサイクルは決められた順路しか辿れない。**不正な遷移**（例: 受入済みから実装中へ）が、完了としての出来高を生むことは**ない** | 不正遷移が完了寄与を生まない | ノード1・遷移列≤6 | agreed |
| MC-CONFLICT | I3・R-U12 | 2人が同じタスクに違う値で合意しても（**時刻が同一でも異なっても**）、現行値は決定的に1つに定まり、**矛盾警告が立つ** | 全順序で現行値決定的＋警告 | ノード1・actor2・イベント2 | agreed |
| MC-IDUNIQ | I3 | 2つの別々のイベントが**同じ時刻・同じ id** を持つこと（順序が非決定になる）は起きてはならない（拒否されるか決定的に扱われる） | (ts,id) 衝突の排除／決定性 | 小スコープ全順序 | agreed |
| MC-SUP-CANCEL | §2.7・R-S5・R-C2 | supersede と cancel が**どんな順序で到着しても**、有効集合は正しく、出来高の二重計上も誤った脱落も起きない | 全到着順で有効集合正・EV_abs 整合 | ノード2・イベント≤4 | agreed |
| **MC-CYCLE-REJECT** | I2・R-D3・A3 | つながり（**依存・置換のどちらでも**）が循環を作る場合、その追加は拒否される | 循環を生む辺は拒否（全辺種別） | ノード≤4・辺≤6 | agreed |
| **MC-MACHINE-NAMED** | I5・R-D6 | すべての状態遷移は「**どの状態機械の遷移か**」を必ず名指す。名指さない遷移は無効 | 遷移は対象状態機械を明示 | 遷移列≤4・機械2種 | agreed |
| **MC-AGREE-HUMAN** | I6・R-U4・R-U3 | 見積を「合意済み」にできるのは**人間だけ**で、エージェントが合意しようとしても拒否される（出来高に算入されない） | agreed の行為者=human・エージェント合意拒否 | ノード1・actor2 | agreed |
| **MC-READY-THRESHOLD** | R-D1・R-D2・R-D4 | あるノードが着手可能(ready)になるのは、その先行群が辺の閾値（**配下の全葉が条件を満たす**という述語）を満たしたときだけ。分解しても辺は増殖させず述語で評価する | ready⇔先行が閾値充足（葉述語）・辺非増殖 | ノード≤4・辺≤4 | agreed |
| **MC-CANCEL-TERMINAL** | R-C1・§2.5 | キャンセルは**どの非終端状態からも到達できる終端遷移**として記録し、イベントは消さない（取り下げは削除でなく追記） | cancelled=終端・全非終端から到達可・削除なし | ノード1・遷移列≤6 | agreed |
| **MC-CANCEL-ORPHAN** | R-C3・R-D1・I2 | 先行をキャンセルして、その辺の条件が**永久に満たせなくなった**とき、システムは取り残された後続を警告するだけで、勝手にキャンセルはしない（判断は人間）。評価は有限で終わる | 永久充足不能→孤児警告・自動キャンセルなし・有限終了 | ノード≤3・辺≤4 | agreed |
| **MC-UNAGREED-DONE** | R-U13・R-U8・I4 | 見積が**未合意のまま完了**に達したノードは「未合意完了」として警告され、その出来高(EV_abs)は算入されず、ベースライン予算も未確定のまま | 未合意完了→警告・EV_abs 非算入・予算未確定 | ノード1・遷移列≤4 | agreed |
| **MC-OVERLOAD ★** | R-T3・A4 | 与えた割当が誰かの容量に収まらない（**容量 0 の日に実コストが付いた場合を含む**）と過負荷を警告する。割当変更や容量変更で条件が消えれば警告も消え、容量 0 日の単発実コストは一定期間で窓から外れて消える | 容量超過→過負荷警告・偽化入力で消滅・点事象は窓外で aging out | 人1・期間小スコープ | agreed |
| **MC-DEADLINE-ALERT** | R-T4・R-T6・§2.1 | 見通しスケジュールが期日を超えると、**超過量を添えて警告するだけ**で、要員追加やスコープ削減を勝手にはしない。受容して何もしないだけでは消えず、コミット（スコープ削減・要員追加・期日変更）で期日内に収まったときだけ消える | 期日超過→警告のみ・超過量付き・コミットで消滅 | ノード≤3・遷移列≤4 | agreed |

---

## C. DENY（書かない／否定プロパティ）

「やること」だけでなく「**意図的にやらないこと**」も記録する。これが無いと正しい挙動を誤ってバグ報告してしまう。否定プロパティは**到達 witness 必須**（条件を実際に踏んだ上で『黙る／単独で読まない』ことを確認）。

| ID | 根拠 | 人間がレビューする一文 | 種別 | レビュー |
|---|---|---|---|---|
| DN-MONOTONIC | P5・R-E4・R-E3 | 達成率は**下がることがある**（手戻り・上方再見積・新規合意）。分母縮小で**上がる**こともある（合意→未合意復帰で分母が縮む）。これは正直な信号でバグではない。ゆえに『増える一方』とも『減る一方』とも**決してテストしない** | テスト禁止 | agreed |
| DN-IMPL-DATES | P8・§7 | 完了予測・プロジェクト導出完了・バッファの**絶対値**は実装依存。MODEL 不変条件として固定しない（実装特性の golden 固定は別枠で可） | テスト禁止（別枠 golden は可） | agreed |
| DN-CAL-SILENT | §7（暦の穴） | 将来の休暇を入れ忘れても、システムは**警告しない**（既定1.0で楽観計算）。意図した穴で暦保守は人間の責任。検知を期待せず『黙る』ことを確認する | 否定（witness 付き） | agreed |
| DN-DRIFT-SILENT | §7（ドリフト） | 記録上の c と実態のズレ（記録1.0だが実は休んでいた等）は**検知しない**。予測も凍結スロットも記録値から導くため。認識は人間の責任 | 否定（witness 付き） | agreed |
| DN-MATURITY-BLIND | §7（前倒し） | 前倒し見積を早期合意するとカバレッジは回復するが、それが情報の薄い見積か成熟した見積かを**システムは区別しない**。成熟度の軸は持たない | 否定（witness 付き） | agreed |
| **DN-EV-ALONE** | R-S4・P2・P0 | カバレッジが低い間は、達成率(EV%)を「プロジェクト全体の完了度」として**単独で読まない・提示しない**（必ずカバレッジと対で読む）。ゆえに『EV 単独＝全体進捗』とは**テストしない**（低カバレッジを実際に踏んだ witness 付き） | 否定（witness 付き） | agreed |
| **DN-SPI-ALONE** | R-S6・§3 | スケジュール・カバレッジが低い間は、SPI を「全体の対計画進捗」として**単独で読まない**（未スケジュールの合意作業を可視ギャップとして示す）。『SPI 単独＝全体スケジュール進捗』とは**テストしない** | 否定（witness 付き） | agreed |
| **DN-CPI-MODELING** | R-E2b・§7 | 見積作業を**ノード化するか畳むか**で CPI は変わる（ノード化は完了時に EV_abs へ、畳むと AC のみ）。これは設計どおりで、異なるモデル化選択の間で CPI が一致するとは**期待せずテストしない** | テスト禁止（選択間 CPI 一致） | agreed |
| **DN-STALE-CONFIRM ★** | R-S7・§2.1 | 「見て確認したが据え置く」（＝非コミット）**だけ**では、ベースライン陳腐化の標識は消えない。乖離が続く限り可視ギャップとして残るのが正直であり、確認操作で標識が消えるとは**テストしない**（乖離を実際に踏んだ witness 付き） | 否定（witness 付き） | agreed |

---

## D. 構造・メタ条項（独立テスト対象でない＝具現で被覆）

「やること／やらないこと」とは別に、**型・イベントモデル・他プロパティに具現されており単独の falsifiable テスト対象にしない**条項を明示する。これが無いと「未 bound（穴）」と「設計上テスト対象にしない」が混ざり、被覆率を誤読する。各行は**どこに具現／どのプロパティが間接被覆するか**を示す。

| clause | 区分 | どこに具現／間接被覆 |
|---|---|---|
| A1 | 構造公理 | ノードのみが実体・チケットは読み取り専用射影。型・イベントモデルに具現。直接変更拒否は **PR-EVENTS-ONLY**(R-U2)、価値ロールアップは **PR-I1-ROLLUP**(I1) が間接被覆 |
| A5（表現の対称） | 公理（表現面） | 人間とエージェントの**表現対称**（同一ログ・同一の提案者役割）は型に具現。資源の非対称は **PR-AGENT-UNLEVELED**、権限の非対称は **MC-AGREE-HUMAN** が bind |
| P0 / R-U9 | メタ原理 | 「コミット領域のみを語り未コミットは可視ギャップ」は単独テストでなく、可視ギャップ系プロパティ（EV のカバレッジ・PR-PV-EXCL・DN-EV-ALONE・DN-SPI-ALONE 等）の**総体**として現れる |
| R-U1 | 構造（=A1） | spec/ノードが唯一の真実・チケットは射影。A1 と同一論点 |
| R-U3 | 構造 | 見積は出所を問わず `proposed`/`agreed` を持つ提案。型に具現。合意権限面は **MC-AGREE-HUMAN** |
| R-U5 | 設計上の非対称 | 合意はノード単位・チェック項目は一括（粒度の設計上の非対称；MODEL §7#3 で開示済み） |
| R-U6 | 構造 | スキル・習熟度をモデル化しない・割当は人間入力。型にスキル欄が無い＝具現。「容量は能力でない」は **PR-CAP-DOMAIN** が隣接被覆 |
| R-E1 | 構造 | 見積の値と `proposed`/`agreed` 状態は被見積ノードに乗る。型に具現（見積作業のノード化有無は R-E2b／**PR-COVERAGE-DISCOVERY**） |
| R-E2 | 構造（イベント） | 見積値は `decompose` で記録・合意は当該被見積ノード上の `transition`。イベント構造に具現。合意面は **MC-AGREE-HUMAN** |
| R-S1 | 被覆済み | 完了時に見積寄与を凍結＝I4。**PR-DONE-LOCK**（完了 EV_abs 不変）が bind |
| R-D5 | 被覆済み | 同一時刻は id で決定的順序＝I3。**PM-ORDER-INV・MC-IDUNIQ** が bind |
| R-D6 | 被覆済み | すべての遷移は状態機械を名指す＝I5。**MC-MACHINE-NAMED** が bind |

---

## clause → property 被覆

各 clause family ごとに bound（プロパティが根拠として引く）/ 構造・メタ（D 節で分類）/ 未 bound を一覧する。未 bound は可視ギャップとして残し、増分で埋める。

### A系（公理 6 本）

| clause | bound by | 備考 |
|---|---|---|
| A1 | （D 節：構造公理） | PR-EVENTS-ONLY(R-U2)・PR-I1-ROLLUP(I1) が間接被覆 |
| A2 | PR-CANCEL-SUNK・PR-EVENTS-ONLY・PR-REPARENT-HEAL | 追記専用——PR-EVENTS-ONLY が直接 bind、PR-CANCEL-SUNK がコスト保持・PR-REPARENT-HEAL が「補償も追記」で間接 |
| A3 | MC-CYCLE-REJECT・PR-I1-ROLLUP・PM-TREE-INV | 木（価値集約=I1・単一有効親と非循環=PM-TREE-INV〔v20 所属の latest-wins〕）＋DAG（非循環=I2/R-D3）の二重グラフ |
| A4 | PR-CAP-DOMAIN・PR-CAP-HISTORY・PM-CAP-MONO | c の定義域・履歴・容量効果 |
| A5 | PR-AGENT-UNLEVELED・MC-AGREE-HUMAN | 資源（人間のみ平準化）＋権限（人間のみ合意）。表現の対称は D 節 |
| A6 | PR-CANCEL-SUNK | 単一通貨——間接 bound（コストは事実の根拠） |

### I系（不変条件 6 本）

| clause | bound by | 備考 |
|---|---|---|
| I1 | PR-I1-ROLLUP・PR-COVERAGE-LEAF | ロールアップ整合・葉基底カバレッジ |
| I2 | MC-CYCLE-REJECT・PR-SUPERSEDE-SHAPE | 非循環（全辺種別） |
| I3 | PM-ORDER-INV・MC-CONFLICT・MC-IDUNIQ・PM-REDERIVE-CONSISTENT・PM-TREE-INV | (ts,id) 決定的順序 |
| I4 | PR-DONE-LOCK・MC-UNAGREED-DONE | 完了施錠・未合意完了の空虚成立 |
| I5 | MC-MACHINE-NAMED | 遷移の被指示性 |
| I6 | MC-AGREE-HUMAN | 合意権限（人間のみ） |

### P系（原理 9 本）

| clause | bound by | 備考 |
|---|---|---|
| P0 | （D 節：メタ原理） | 可視ギャップ系プロパティの総体として現れる |
| P1 | PR-EVPCT-RANGE・PM-SCALE-INV | EV% 導出 |
| P2 | PR-COVERAGE-LEAF・PR-COVERAGE-DISCOVERY | 見積カバレッジ（葉基底）・発見信号 |
| P3 | PR-AC-ROLLUP・PR-CANCEL-SUNK | AC 集約 |
| P4 | PR-CANCEL-INVISIBLE | 三キュー同型 |
| P5 | DN-MONOTONIC | 非単調 EV% |
| P6 | PR-COST-NEUTRAL・PR-CANCEL-SUNK・PR-CRITPATH-AGENT | 滞在≠コスト・リードタイム |
| P7 | PR-AGENT-UNLEVELED・PR-CRITPATH-AGENT | c 平準化・人間接点律速・クリティカルパス |
| P8 | DN-IMPL-DATES | スケジュールは発見的（NP 困難） |

### R-U系（ユビキタス要件 14 本）

| clause | bound by | 備考 |
|---|---|---|
| R-U1 | （D 節：構造） | ノード＝唯一の実体（=A1） |
| R-U2 | PR-EVENTS-ONLY | 追記専用・直接 mutation 拒否 |
| R-U3 | （D 節：構造） | 見積＝proposed/agreed を持つ提案。合意面は MC-AGREE-HUMAN |
| R-U4 | MC-AGREE-HUMAN | 合意は人間のみ（I6 と対） |
| R-U5 | （D 節：設計非対称） | ノード単位合意（§7#3 開示） |
| R-U6 | （D 節：構造） | スキルモデル化しない。PR-CAP-DOMAIN が隣接 |
| R-U7 | PR-FROZEN-REASON | 凍結値・理由付き改訂 |
| R-U8 | PR-EVPCT-RANGE・MC-UNAGREED-DONE | EV%（合意済みのみ算入） |
| R-U9 | （D 節：メタ） | コミット領域のみ・可視ギャップ（=P0） |
| R-U10 | PR-COST-NEUTRAL | コストを EV に折り込まない |
| R-U11 | PR-AGENT-UNLEVELED・PR-CAP-DOMAIN | 人間のみ c 平準化 |
| R-U12 | MC-CONFLICT | 矛盾合意検知 |
| R-U13 | MC-UNAGREED-DONE | 未合意完了警告 |
| R-U14 | PR-CAP-HISTORY | c の変更履歴追跡 |

### R-E系（見積要件 6 本）

| clause | bound by | 備考 |
|---|---|---|
| R-E1 | （D 節：構造） | 見積値は被見積ノードに乗る |
| R-E1b | PR-COVERAGE-DISCOVERY | est(impl) は別段・カバレッジ低下→回復 |
| R-E2 | （D 節：構造） | 見積記録は decompose + transition |
| R-E2b | DN-CPI-MODELING | 見積作業のノード化/畳む（P0 判断）・CPI 摂動 |
| R-E3 | PR-DONE-LOCK・DN-MONOTONIC | agreed→proposed 復帰（未完了限定） |
| R-E4 | DN-MONOTONIC・PR-COVERAGE-DISCOVERY | 残余作業増大→EV 低下 |

### R-S系（進捗・状態要件 8 本）

| clause | bound by | 備考 |
|---|---|---|
| R-S1 | （D 節：被覆済み=I4） | 完了時凍結。PR-DONE-LOCK が bind |
| R-S2 | PM-REDERIVE-CONSISTENT | 再導出契機（イベント＋構成入力変更） |
| R-S3 | PR-THRASH | スラッシュ検知・単発畳みコストの carve-out |
| R-S4 | DN-EV-ALONE | 低カバレッジ時 de-rate |
| R-S5 | PR-CUM-GE-EFF・MC-SUP-CANCEL | 累積 EV ≥ 有効 EV |
| R-S6 | DN-SPI-ALONE | スケジュールカバレッジ de-rate |
| R-S7 | DN-STALE-CONFIRM | 乖離標識・確認では非消滅（原因帰属・絶対値は DN-IMPL-DATES） |
| R-S8 | PR-EXECCOV | 実行カバレッジ |

### R-T系（時間・スケジュール要件 6 本）

| clause | bound by | 備考 |
|---|---|---|
| R-T1 | PR-AGENT-UNLEVELED・PM-REDERIVE-CONSISTENT | c 平準化スケジュール導出・増分再計算 |
| R-T2 | PR-CRITPATH-AGENT | エージェント作業のスパン・パス長算入 |
| R-T3 | MC-OVERLOAD ★ | 過負荷検知（impl-pending） |
| R-T4 | MC-DEADLINE-ALERT | 期日超過検知（実装到達 2026-07-04・issue #13＝着地導出＋期日判定。MC テスト化は後続） |
| R-T5 | PR-ASSIGNEE-REVIEWER | 単一担当・指名レビュー担当（会計非干渉） |
| R-T6 | PR-BUFFER-CLAMP ★・PM-BUFFER-DEADLINE-MONO ★ | バッファ**数値**導出（残量・消費率）が impl-pending。着地日・期日判定の read は実装済（issue #13） |

### R-C系（キャンセル要件 3 本）

| clause | bound by | 備考 |
|---|---|---|
| R-C1 | MC-CANCEL-TERMINAL | cancelled 発行（terminal・削除なし） |
| R-C2 | PR-CANCEL-EXCL・PR-CANCEL-SUNK・PR-CANCEL-INVISIBLE・MC-SUP-CANCEL | active basis 除外・サンク EV_abs |
| R-C3 | MC-CANCEL-ORPHAN | キャンセル孤児警告（基本形＝中止先行の直接後続への警告は実装到達・issue #12。辺閾値の葉述語まで含む「永久充足不能」の完全意味論は未実装。MC テスト化は後続） |

### R-D系（依存・整合要件 7 本）

| clause | bound by | 備考 |
|---|---|---|
| R-D1 | MC-READY-THRESHOLD・MC-CANCEL-ORPHAN | 先行充足で ready |
| R-D2 | PR-EDGE-POLICY・MC-READY-THRESHOLD | 辺ポリシー既定 |
| R-D3 | MC-CYCLE-REJECT | 循環拒否（I2 と対） |
| R-D4 | MC-READY-THRESHOLD | 論理述語評価（葉述語・辺非増殖） |
| R-D5 | （D 節：被覆済み=I3） | 同一 ts の id 決定的順序。PM-ORDER-INV・MC-IDUNIQ が bind |
| R-D6 | （D 節：被覆済み=I5） | 状態機械名指し義務。MC-MACHINE-NAMED が bind |
| R-D7 | PR-SUPERSEDE-SHAPE | supersede edge ≠ backward transition・新→旧・旧不変 |

### §系（構造規約）

| clause | bound by | 備考 |
|---|---|---|
| §2.5 | MC-LIFECYCLE・MC-CANCEL-TERMINAL | 状態語彙・lifecycle 状態機械 |
| §2.7 | MC-SUP-CANCEL・PR-SUPERSEDE-SHAPE | supersede 力学 |
| §2.8 | PR-COST-DEDUP・PR-EVENTS-ONLY・PR-REPARENT-HEAL・PM-TREE-INV | 4 イベント（コスト dedup・追記専用）＋所属の latest-wins（v20） |
| §3 | PR-PV-EXCL・PM-CAP-MONO・PR-EXECCOV・PR-BUFFER-CLAMP | EVM 原理・導出定義 |
| §7 | DN-CAL-SILENT・DN-DRIFT-SILENT・DN-MATURITY-BLIND・DN-IMPL-DATES・DN-CPI-MODELING | 未解決・開放項目 |

> §0/§1/§2.1-§2.4/§2.6/§2.9/§4/§5/§6 はメタ的記述または番号付き clause（A/I/P/R）と同型。独立にテストする対象ではなく、上記の番号付き clause 被覆で間接カバーされる。

### 外的妥当性（受け入れシナリオ）

| シナリオ | 対応プロパティ | 状態 |
|---|---|---|
| cancel-task-midway | PR-CANCEL-EXCL・PR-CANCEL-SUNK・PR-CANCEL-INVISIBLE | draft |
| estimate-spec-agreed | PR-COVERAGE-LEAF・PR-COVERAGE-DISCOVERY | agreed |
| estimate-spec-proposed | PR-COVERAGE-LEAF・MC-AGREE-HUMAN | agreed |
| assign-spec-provisional | PR-ASSIGNEE-REVIEWER | agreed |

---

## 被覆サマリー

bound＝falsifiable プロパティ（PBT/MC/DENY）が根拠として引く clause。構造・メタ＝D 節で「具現で被覆・独立テスト対象でない」と明示分類した clause。未 bound＝いずれでもない可視ギャップ。

| family | 全 clause 数 | bound | 構造・メタ | 未 bound | bound 率 |
|---|---|---|---|---|---|
| A系 | 6 | 5 | 1 | 0 | 83% |
| I系 | 6 | 6 | 0 | 0 | 100% |
| P系 | 9 | 8 | 1 | 0 | 89% |
| R-U | 14 | 9 | 5 | 0 | 64% |
| R-E | 6 | 4 | 2 | 0 | 67% |
| R-S | 8 | 7 | 1 | 0 | 88% |
| R-T | 6 | 6 | 0 | 0 | 100% |
| R-C | 3 | 3 | 0 | 0 | 100% |
| R-D | 7 | 5 | 2 | 0 | 71% |
| **合計** | **65** | **53** | **12** | **0** | **82%** |

未 bound（可視ギャップ）は v0.3 で **0** になった——全 clause が「falsifiable プロパティで bound」か「D 節で構造・メタとして明示分類」のいずれかに割り当てられた。**ただし bound のうち ★impl-pending（R-T3 過負荷・R-T6 バッファの数値導出〔残量・消費率〕・R-S7 の標識発火）は参照実装に当該導出が未実装**であり、実行テスト化は実装到達後（仕様＝MODEL に対しては今すぐレビュー可）。**R-T4 期日アラートは実装到達済み（issue #13・2026-07-04）**——着地曲線の導出（backend）＋期日判定（frontend の純導出モジュール・超過量付き・コミットで消滅）が実在し、★ を外した（MC テスト化は後続）。**R-C3 キャンセル孤児も基本形が実装到達済み（issue #12）**——中止先行の直接後続への警告（frontend 純導出・コミットで消滅）が実在し ★ を外した。ただし辺閾値の葉述語まで含む「永久充足不能」の完全意味論は未実装（正直な限定・MC テスト化は後続）。**D_pred の集約 read は着地導出（issue #13）で、クリティカルパスの read はガント強調（issue #16・公開導出）で実現済み**——v0.3 時点の「未実現は D_pred 集約 read とバッファ可視化の側」のうち残るのは**バッファ残量・消費率の数値導出のみ**。**批准の進捗**: v0.3 の52プロパティは全件 `agreed`。v0.4 時点は **54 プロパティ＝51 agreed＋3 proposed**（v20 追加の PR-REPARENT-HEAL・PM-TREE-INV、R-S3 追随で再降格の PR-THRASH——要批准）。

---

## v0.2→v0.3 変更点

未 bound の穴埋め。新規29プロパティ（PBT 14・メタモルフィック 2・MC 9・DENY 4）をすべて `proposed` で起案し、純構造・メタの 12 clause を新設 **D 節**で「具現で被覆・独立テスト対象でない」と明示分類した。これにより未 bound（silent gap）が 47→0 に。**新規プロパティは起案時は全件 `proposed`**——その後の人間一文レビューで**全件 `agreed` に批准済み**（PR-CRITPATH-AGENT の de-condition・PR-ASSIGNEE-REVIEWER の §7#18(b) 精緻化を含む）。

1. **A系**: A3（二重グラフ）を MC-CYCLE-REJECT＋PR-I1-ROLLUP、A4（c）を PR-CAP-DOMAIN／PR-CAP-HISTORY、A5（非対称）を PR-AGENT-UNLEVELED／MC-AGREE-HUMAN で bind。A1（純構造公理）は D 節へ。
2. **I系**: I2 を MC-CYCLE-REJECT、I5 を MC-MACHINE-NAMED、I6 を MC-AGREE-HUMAN で bind（全 6/6）。
3. **P系**: P2（葉基底カバレッジ）を PR-COVERAGE-LEAF／PR-COVERAGE-DISCOVERY、P7 を PR-AGENT-UNLEVELED／PR-CRITPATH-AGENT で bind。P0（メタ）は D 節へ。
4. **R-U系**: R-U2／R-U7／R-U11／R-U13／R-U14 を新プロパティで bind。R-U1/3/5/6/9 は D 節（構造・メタ）。
5. **R-E系**: R-E1b を PR-COVERAGE-DISCOVERY、R-E2b を DN-CPI-MODELING で bind。R-E1/E2 は D 節。
6. **R-S系**: R-S2／R-S3／R-S4／R-S6／R-S7／R-S8 を新プロパティで bind。R-S1（=I4）は D 節。
7. **R-T系（v0.2 で全未 bound）**: R-T1〜R-T6 を全 bind（PR-AGENT-UNLEVELED／PR-CRITPATH-AGENT／MC-OVERLOAD★／MC-DEADLINE-ALERT★／PR-ASSIGNEE-REVIEWER／PR-BUFFER-CLAMP★）。
8. **R-C系**: R-C1 を MC-CANCEL-TERMINAL、R-C3 を MC-CANCEL-ORPHAN★ で bind。
9. **R-D系（v0.2 で全未 bound）**: R-D1/2/3/4/7 を bind（MC-READY-THRESHOLD／PR-EDGE-POLICY／MC-CYCLE-REJECT／PR-SUPERSEDE-SHAPE）。R-D5（=I3）/R-D6（=I5）は D 節。
10. **★impl-pending の明示**: R-T3/R-T4/R-T6・R-S7 標識発火は参照実装に導出が未実装で、PBT/MC 実行は実装到達後。仕様（MODEL）に対するレビューは今すぐ可。クリティカルパス（PR-CRITPATH-AGENT）は leveler が cp／予測完了を既に算出済みで PBT 可（未実現は D_pred 集約 read とバッファ可視化）。
11. **被覆サマリーに「構造・メタ」列を新設**——「未 bound（穴）」と「設計上テスト対象にしない」を分離し、被覆率の誤読を防止。

## v0.3→v0.4 変更点（2026-07-04・issue #19 追いつき）

実装先行期間（issue #5〜#16・2026-07-02〜07-04）への追いつき。プロパティの新規追加はなし（v20 由来の2件は bb81ff2 で収載済み）。clause の bound/未bound 分類は不変（被覆サマリーの数値は据え置き）。

1. **ヘッダ・件数の是正**: v20（bb81ff2・2026-07-03）で PR-REPARENT-HEAL（PBT）・PM-TREE-INV（メタモルフィック）が `proposed` で収載され実質54件になっていたが、状態行が「全52 agreed」のまま取り残されていた。**54＝51 agreed＋3 proposed** に同期し、要批准3件を明示。
2. **PR-THRASH の R-S3 追随（同期漏れの是正）**: MODEL v19 編集（レビュー工数の作業ノード化・2026-06-26 e7b197a）で R-S3 の carve-out は「畳んだ見積活動**または畳んだレビュー作業**」に拡張されていたが、同日45分後の v0.3 全件批准（0f668dd）は旧文言のまま取りこぼした。一文を R-S3 本文に一致させ、`agreed`→`proposed` に再降格（改訂＝再批准の自己規律）。
3. **★impl-pending の見直し（issue #12/#13/#16 実装到達）**: MC-DEADLINE-ALERT の ★ を除去——着地曲線の導出（backend）＋期日判定（frontend の純導出モジュール・超過量付き・コミットで消滅）が実装に到達した。MC-CANCEL-ORPHAN の ★ も除去——中止先行の直接後続への孤児警告（frontend 純導出・自動キャンセルなし・コミットで消滅）が実装に到達した（辺閾値の葉述語まで含む「永久充足不能」の完全意味論は未実装＝正直な限定注記を R-C3 行に付す）。あわせて ★ の定義を「backend または frontend の純導出モジュール」に精緻化。残る ★ は R-T3 過負荷・R-T6 バッファ数値導出（期日判定ラベルは実装済みだが**残量・消費率の数値**が未実装）・R-S7 標識発火（乖離データの供給は実装済み・標識の発火が未実装）。
4. **binding 表の取りこぼし同期**: PR-REPARENT-HEAL・PM-TREE-INV が根拠として引く §2.8、PM-TREE-INV が引く I3 の行に両プロパティを追記。あわせて §2.8 行に従来から載っていた PR-EVENTS-ONLY の根拠列へ §2.8 を追記し、根拠列⇔被覆表の非対称を解消（一文は不変・bound 状態も不変）。
5. **陳腐化した次手の書き換え**: 「PR-DONE-LOCK が赤になることを確認する」等の v0.3 時点の計画記述を、実績（2026-07-02 fold ガード実装・GREEN 昇格）に置換。

版の規律: 件数・批准状態・★ の意味に触れる変更のため v0.4 に上げる（binding 不変でも版据え置きにしない）。**v0.4 の批准は上記 3 件の一文レビュー**（下記「次手」）。

## 次手（批准）

1. **v0.4 の要批准 3 件**: PR-REPARENT-HEAL・PM-TREE-INV（v20 所属の latest-wins 由来）・PR-THRASH（R-S3 の畳んだレビュー carve-out 追随・`agreed` からの再降格）。一文レビューで `agreed` へ。
2. 既往: v0.3 の52プロパティは人間批准済み。最小パイロット（PBT）は稼働済み——PR-DONE-LOCK は実装是正（2026-07-02・fold 完了ガード）で GREEN 回帰固定に昇格済み。以後、MODEL の制約・語彙・既定に触れる変更があれば、その bound プロパティを同一 run で再批准する（`moira-model-update`／`doc-refine`）。
3. **★impl-pending プロパティ**（R-T3 過負荷・R-T6 バッファ数値導出・R-S7 標識発火）は参照実装に当該導出が実装された時点で PBT/MC 化する。★ を外した MC-DEADLINE-ALERT・MC-CANCEL-ORPHAN の MC テスト化も後続。
