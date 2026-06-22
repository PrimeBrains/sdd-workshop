# moira-surface-spec-value 要件 早わかり

> requirements.md(EARS 形式の要件本文)を読む前に全体像を掴むための要約。詳細は [requirements.md](./requirements.md) へ。

## 目的

`moira-surface-spec-value` は、Moira 正典モデル `moira/MODEL.md`(凍結) を本番アーキテクチャへ落とす **CQRS 分解の Wave3（read サーフェス群）**の一つで、**「仕様・価値」軸の常駐 read-only ダッシュボード**を所有する spec である。MODEL が確定する「進捗・価値はすべて 4 イベントからの導出」というモデルに対し、本 spec はその導出を**読むだけ**で人間に提示する。本 spec は EV%・見積カバレッジ・実行カバレッジの**三者対読みの主 host**（UI-ARCHITECTURE §4.1）を務め、導出式・effective-set 導出・ready 判定・warning 確定・全 write は範囲外である（再定義・再計算しない）。

## 主要な要件の要点

- **ノード木の表示（要件1）**：feature ─ req/design/tasks/impl の所有木を `moira-scope-deps` の導出から読み、各ノードのライフサイクル状態と葉の見積状態（`proposed`/`agreed`）をアコーディオンで表示する。`implementing` ノードは兄弟より上位に出して目立たせる（提示の自由であり提示下限ではない——可視ギャップ会計から兄弟を落としてはならない）。`ready` ライフサイクル状態は `moira-core` 経由で供給されたものを表示し、木・状態のいずれも本サーフェスでは再導出しない。`ready-eligible` 述語は別概念であり提示の自由に属する（design が追加反映する場合は `moira-scope-deps` から読み本サーフェスでは計算しない）。ライフサイクル語彙は単一（`pending`/`ready`/`implementing`/`implemented`/`accepted`/`cancelled`）で語彙外の状態を作らない。
- **トレーサビリティと再利用 DAG ビューア（要件2）**：ノード間の依存辺と supersede 辺を区別して描く。supersede 辺は新→旧として提示し、旧ノードを現行有効集合から除外されたものとしてマークしつつ辺は表示し続ける。DAG ビューアは既存共有モジュール（`theme/atoms`・`schedule/gantt-geometry`）と同列の**共有提示モジュール**として提供し、いずれの surface spec も所有しない（`moira-surface-schedule` が同一部品を再利用できるようにする）。依存辺の充足ポリシーは `moira-scope-deps` の DAG 射影に同梱される辺属性として消費し、本サーフェスでは計算しない。
- **EV%（現行進捗）の提示（要件3）**：現行有効集合の EV%（`moira-evm` が導出）を現行進捗として表示する。EV% は現行有効集合の達成率として明示し、累積 EV（EV_abs）を含む全体出来高と混同させない。累積／現行の区別表示（R-S5）そのものは `moira-surface-health` が host するため、本サーフェスは EV_abs を host・描画しない。現行有効集合は `moira-scope-deps` が導出するものを読み、effective-set 導出を本サーフェスで実装しない。
- **見積カバレッジの表示と低カバレッジ de-rate（要件4）**：見積カバレッジ（`moira-evm` が導出）を必ず EV% と対で表示する。見積カバレッジが低い間は EV% の提示を割り引き、全体完了度として提示しない。「低い」かどうかの判定も導出層（`moira-evm`／R-S4）が供給する de-rate 標識を反映するのみで、閾値を本サーフェスに埋め込まない。未コミット領域（合意済み見積でない作業）は可視のギャップとして提示し、暗黙に完了と仮定しない。
- **実行カバレッジの提示と三者対読み（要件5）**：実行カバレッジ（R-S8: `moira-evm` が導出する合意済み有効葉の `implementing` ノード数比率）を EV% および見積カバレッジと三者併置で提示し、三者対読みの主 host を務める。参照実装は現状 実行カバレッジを未提示のため、既存の `executionCoverage` 導出を消費する**新規提示**として実装する。実行カバレッジを EV% と算術和して全体進捗として提示してはならず、仕掛中の量として提示する（R-S4/R-S6 同型の de-rate 規律）。未合意の `implementing` 葉はこの読みに含めず見積カバレッジのギャップとして現す。
- **見積カバレッジ＝行クリック葉明細（要件6）**：カバレッジ行（葉）のクリックで、見積状態（agreed/proposed）・スケジュール済みか・完了か・EV_abs 寄与の明細を展開する。各葉の EV_abs 寄与は `moira-core` が射影する per-node 属性（`frozenBudget`・lifecycle・`estimateState`）から合成する read-only 射影（UI-ARCHITECTURE §6.6(b) が許容する per-node 属性射影）であり、R-S2 集約導出値の再計算ではない。独自の状態別重みや部分加点は適用しない。未合意（proposed）の葉は被覆明細で視覚的に区別し、可視ギャップとする。
- **未合意フィルタ（要件7）**：見積が未だ `proposed` のノードを選び出すフィルタを提供する。述語は `proposed`/`agreed` 状態のみであり、停滞窓・時間しきい値という裁量ノブを持たない（純粋な状態述語）。フィルタ適用時は表示ノード集合を限定するのみで導出・保存状態を mutate しない。合意アクション（`proposed→agreed`）自体は本サーフェスで実行・提供せず、write skill（`moira-estimate-agree`）への深リンクのみを提供する。
- **深リンクの受理と着地（要件8）**：decision インボックス等の発信元から特定ノードを指す深リンクを受理し、ノード木内の当該ノードへ移動・可視化する（祖先展開含む）。対象が抑制表示状態（supersede 済み・`cancelled`・フィルタ非表示・アコーディオン畳み込み）にある場合も一時的に可視化して着地し、暗黙に失敗しない。着地時にメトリクスを再計算せず発信元と同一の導出を参照する。本 spec は着地（受理）のみを所有し、発信元（decision インボックス = `moira-surface-decision`）は所有しない。
- **read-only ダッシュボード規律（要件9）**：全値を `moira-core` の単一 R-S2 導出から読み、自前の真実源・可変な導出キャッシュ・dismiss/既読フラグを持たない。上流の導出更新時はサーフェスごとの二度目の再計算を行わず反映する。項目を抑制・畳み込みしても可視ギャップの会計から落とさない。共有提示部品（atoms/theme・DAG/Gantt ジオメトリ・read 側ラベル/warning/store リーダー）を通じて描画し、surface ごとに再実装しない。役割（管理者/開発者）は同一導出に対する actor フィルタ／初期プリセットとして扱い、役割別に別系統計算を走らせない。一時的な提示状態（アコーディオン展開/畳み・フィルタ ON/OFF・役割プリセット選択・深リンクハイライト・一時的可視化）は許容されるが、導出値の真実源にならず、可視ギャップ会計から項目を落とさず、warning の acknowledge/dismiss/既読状態を表さない。

## スコープ

**やること（本 spec が所有 — 提示と読みの規律）**
- ノード木（feature ─ req/design/tasks/impl のライフサイクル＋見積状態・アコーディオン・進行中上位・ready 表示の反映）。
- トレーサビリティ＋DAG ビューア（dependency 辺と supersede 辺の描き分け・共有モジュール参照）。
- EV%（現行進捗）・見積カバレッジ・実行カバレッジの**三者併置対読みの主 host**、低カバレッジ時の EV de-rate 表示。
- 見積カバレッジ／被覆マトリクスの**行クリック葉明細**（per-node 属性射影＝read-only）。
- **未合意フィルタ**（`proposed` のまま未 `agreed` のノード抽出。停滞窓を持たない純粋な状態述語）。
- 深リンク（ノード/起点指定）の受理と着地、可視ギャップの提示。
- read-only 規律（自前状態なし・参照のみ・二系統計算禁止・役割=actor フィルタ）。

**やらないこと（下流/上流/基盤が所有）**
- 指標式本体（EV_abs/EV%/見積カバレッジ/実行カバレッジ/PV/AC/SPI/CPI/sunk）＝`moira-evm`。
- tree+DAG/依存・supersede 辺/effective-set/ready(R-D1)/orphan(R-C3 読)/restoration(R-S5) の**導出**＝`moira-scope-deps`。
- 平準化・予測・スケジュール被覆・buffer＝`moira-schedule`。Gantt/担当表示＝`moira-surface-schedule`。
- SPI/CPI/PV/トレンド/バッファ可視化＝`moira-surface-health`。累積／現行の区別表示（R-S5）そのもの＝`moira-surface-health`。
- 集約スケジュールカバレッジの host＝`moira-surface-health`（本サーフェスの三者対読みに scheduleCoverage を含めない・write は持ち込まない）。
- 9 warning 確定・集約・行為列挙の単一定義＝`moira-health`。decision インボックス＝`moira-surface-decision`。
- 全 write（見積合意・再見積・割当・キャンセル・config 等の人間のコミット判断）＝moira-* write skill 群。
- emit/derive・二層データ・effective-set 導出・latest-wins・状態機械・凍結記録・R-S2 オーケストレータ＝`moira-core`。
