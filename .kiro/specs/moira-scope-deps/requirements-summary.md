# moira-scope-deps 要件 早わかり

> requirements.md(EARS 形式の要件本文)を読む前に全体像を掴むための要約。詳細は [requirements.md](./requirements.md) へ。

## 目的

`moira-scope-deps` は、Moira 正典モデル `moira/MODEL.md`(SSOT) を本番アーキテクチャへ落とす **CQRS 分解の Wave1（読/導出 spec）**。プロジェクトの **構造（木）と依存（DAG）の二重グラフ** 上で、tree+DAG の読み出し・依存/supersede 辺の種別分離・ready-eligible 導出・述語評価・cancel 孤児検出・restoration の読み出しを所有する。

設計の最上位原則は **「core は構造・不変条件・機構だけを所有し、評価は下流 spec が持つ」**（"構造境界 core"）。本 spec は `moira-core` が定義する横断概念（emit/derive 契約・effective-set 導出規則・状態機械・辺の構造保持・非循環 enforce 等）を **消費**し、その上で ready-eligible/orphan/restoration を **導出して出す**だけである。`ready` 状態そのものは `moira-progress` が emit する lifecycle 状態であり、本 spec は適格性データを読み・導出するだけ（**ready 二語分離: 状態=lifecycle / 適格性=本 spec 導出**）。MODEL の文言は変えず・新概念は足さず、構造・依存の読み出し落とし込みに徹する。

## 主要な要件の要点

- **木と DAG の二重グラフ読み出し（要件1）**: 所属を表す木（価値の木）と論理依存を表す DAG を、同一ノード上に重なる二つの区別されたグラフとして読み出す。フェーズノードと実装タスクは所有木上で feature の子として表現し、仕様フェーズ依存連鎖と実装依存は DAG 辺として別に読み出す。`moira-core` が導出する現行有効集合と有効葉を基底として消費し、effective-set 導出規則を再定義しない（この非再定義制約は本 spec の全導出に横断適用される）。
- **辺種別の分離（要件2）**: 各 DAG 辺を、`moira-core` が `relate` イベント上に記録した種別（依存 または supersede）とともに読み出す。依存辺は充足ポリシーを持ち ready 判定に使い、supersede 辺は ready 判定に使わず価値・履歴関係としてのみ扱う。supersede 辺は新→旧を指し、旧ノードは不変で後退遷移による再オープンはされない。辺の非循環は `moira-core`（I2）に依拠する。
- **ready-eligible の導出と充足閾値ポリシー（要件3）**: 先行群が辺の閾値ポリシーを満たしたとき、ノードを **ready-eligible（先行充足述語）** として導出する。本 spec は `ready` とマークしたり lifecycle 遷移を emit したりしない（`ready` 状態は `moira-progress` が `moira-core` の状態機械上で emit する）。充足閾値述語の **評価** は本 spec 所有で、辺ごとの閾値属性と辺種別別既定（仕様フェーズ辺は `accepted`、実装タスク辺は `implemented`）を読み出して評価する（辺ごとの policy/既定値の **記録** は `moira-core` 所有。**構造=core / 評価=scope-deps**）。先行が `cancelled` で永久充足不能なら cancel 孤児評価（要件5）に従う。ready-eligible 判定は projected 状態の導出読みでありイベントを発行しない。
- **述語評価と辺の非増殖（要件4）**: ノードが分解されたとき、各流入辺を「源配下の **全葉（cancelled 葉を含む）** がポリシー充足」という論理述語として評価する。母集合は全葉であり、現行有効集合の有効葉ではない。cancelled 葉は永久充足不能ゆえ、その辺は cancel 孤児検出（要件5）へ接続する。辺の非物理増殖と流出辺のノード水準保持は `moira-core` が構造的に enforce する。
- **cancel 孤児の検出（要件5）**: 先行ノードが終端 `cancelled` へ遷移したとき、当該 cancelled ノードを源とする依存辺（supersede 辺を除く）を評価する。充足閾値が永久充足不能になった場合、被ブロック後続・未充足辺・取りうる行動（辺の除去・代替先行への付替・後続のキャンセル）を特定する検出データを生成する。いかなるノードも **自動キャンセルしない**（判断は人間に委ね、検出を `moira-health` と `moira-cancel-scope` 向けのデータとして顕在化する）。木の子ノードは所有木ではなく DAG 依存辺を通じて評価し、親のキャンセルが孤児評価を発火するのは親が当該子の DAG 先行でもある場合のみ。孤児評価は `moira-core`（I2）が担保する非循環に依拠して有限終了する。ノード単位 cancel（R-C1）は孤児評価の発火契機として読み出すのみで、cancel 自体は発行しない。
- **restoration の読み出し（要件6）**: `moira-core` が導出する現行有効集合（supersede されておらず cancelled でない有効葉）を二重グラフ読み出しの基底として消費する。supersede 元（新ノード）が `cancelled` へ遷移したとき、当該 supersede 辺を effective-set 導出上で不活性として読み出し、旧ノードが現行有効集合へ復帰するものとして `moira-core` の導出規則を消費する（非再定義制約が適用される）。supersede 辺は不活性でもログ上に残る（append-only）。現行有効集合（ノードの構造的集合）を read-only に出力し、UI/提示は `moira-surface-*` 所有、累積と現行の進捗基底区別および EV_abs/sunk 会計は `moira-evm` 所有で本 spec では導出しない。

## スコープ

**やること（本 spec が所有 — 評価・導出・読み出し）**
- **tree+DAG 二重グラフ読み出し**: 木（所属）と DAG（論理依存）の区別した読み出し。core の effective-set 出力の消費（非再定義）。
- **辺種別分離**: 依存辺と supersede 辺の種別ごとの読み出し（ready 判定には依存辺のみ使用）。
- **ready-eligible 導出**: 先行充足述語の導出と充足閾値ポリシーの評価（R-D1/R-D2/R-D4 の述語評価・閾値適用は本 spec 所有）。
- **述語評価**: 流入辺を論理述語として評価（辺非増殖。母集合=全葉、cancelled 葉含む）。
- **cancel 孤児の検出（読み）**: cancelled 先行を源とする依存辺の永久充足不能判定、被ブロック後続/未充足辺/取りうる行動の特定。自動キャンセルしない。
- **restoration の読み出し面**: supersede 元 cancelled 時の旧ノード復帰を core の effective-set 導出に接地して読み出す。

**やらないこと（上流/下流が所有）**
- effective-set の導出規則そのもの（supersede/cancel 復帰の定義）= `moira-core`。
- 辺の追加/削除・supersede/cancel/ready 遷移の emit = `moira-relate-edit`/`moira-cancel-scope`/`moira-progress`（書き skill）。
- 辺の構造保持（型/policy 記録・非循環 enforce・辺非増殖の構造 enforce）= `moira-core`。
- 9 warning の確定・集約・clearance・行為列挙 = `moira-health`（本 spec は orphan 検出データを提供するのみ）。
- sunk EV_abs の金額導出（R-C2 の EV_abs 側）= `moira-evm`（cancelled の active basis 除外の集合意味論は `moira-core` の effective-set 導出規則が定義し本 spec が消費）。
- 指標式（EV%/見積カバレッジ/PV/SPI 等）= `moira-evm`/`moira-schedule`。
- tree+DAG ビューア・アコーディオン等の UI = `moira-surface-*`。
