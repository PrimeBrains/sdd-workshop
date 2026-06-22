# 設計調査ログ — moira-core

> 一次資料(SSOT): `moira/MODEL.md`(v16, 凍結)。参照実装(フォワード本番・プロト): `moira/backend/src`・`moira/frontend/src/moira`。
> 本ログは design.md の背景。結論は design.md に restate 済みで、design.md は単独で読める。

## 1. 調査スコープと分類

- **フィーチャー種別**: 既存システムの拡張(Extension)。`moira/backend`(S4 最小バックエンド・純 TS + Vitest)に emit/fold/derive/effective-set/latest-wins の seam が実証済み。core はこの seam を **正式契約として凍結**し、永続層境界を確定する。新規縦割りアーキの発明ではなく、既存 seam の formalization + 永続化決定。
- **discovery 種別**: Integration-focused(light)。既存 seam の所有境界確定が主眼。外部 API・新ライブラリの導入はない(永続化は標準 Node fs)。

## 2. 既存 seam の確認(参照実装)

| seam | 参照実装ファイル | core が凍結する契約 |
|---|---|---|
| 追記専用ログ | `event-store.ts`(`append`/`appendAll`/`all`/`sortEvents`) | emit API・`(ts,id)` 決定的順序(I3/R-D5) |
| 第二層 c(i,d) | `capacity-store.ts`(`append`/`capacityOf`/`lookup`・既定 1.0) | capacity-write API(A4/R-U14) |
| 第二層 期日/目標日 | (未実装) | config-write API(R-T6)。core で新設 |
| 畳み込み | `fold.ts`(状態機械適用・`wouldCycle`・凍結属性記録・非人間 agreed 拒否) | fold 契約・不変条件 enforce(I2/I3/I5/I6/R-D3/R-U4) |
| 型 | `types.ts`(4 イベント・`ProjectedState`・`DerivedState`) | スキーマ契約 |
| 導出オーケストレータ | `derive.ts`(同一ログから R-S2 導出群を束ねる) | derive API(R-S2/P0) |
| effective-set | `derivations/effective-set.ts`(supersede×cancel 復帰) | 現行有効集合の単一定義(R-S5) |
| ノード状態射影 | `derivations/node-states.ts` | ノード状態の素射影 |
| read 口 | `read/snapshot-cli.ts`・`read/http.ts` | 読み出し専用・可変状態なし |
| frontend 公開境界 | `store.tsx`(`appendEvent`/`appendCapacity`/`derive`)・`engine.ts` | surface が読む契約面(同一 derive を再利用) |

**重要**: `derive.ts` は指標式(ev/coverage/pv/ac/indices)・leveler/forecast を **呼び出して束ねる** が、それらの **式の正典は下流 spec**(evm/schedule)。core は「オーケストレータの契約 + 各導出関数のシグネチャ(入力 = `ProjectedState` + `EffectiveSet`、出力 = `DerivedState` の各フィールド)」を所有し、式本体は所有しない。これが共有シームの境界(roadmap §Boundary Strategy)。

## 3. アーキテクチャパターンの評価

検討した選択肢と採否:

- **(採用) 既存の三層 + 第二層を本番契約へ昇格**: 追記専用ログ層 → 畳み込み層(fold) → 導出層(derive オーケストレータ) → read 層。steering `structure.md`「コード組織」と一致。**理由**: MODEL の data → derivation → warn 構造をそのまま写し、二層データ(A2 + A4/R-T6)が自然に乗る。S4 で実証済みで再発明コストがゼロ。
- (却下) 導出状態を永続化する CQRS read-model: MODEL「観測・導出・警告に徹し、保存された派生状態を真実源にしない」(tech.md / §0)に反する。derivation は emit→derive であって再計算ではない、を破る。
- (却下) イベントごとの増分 fold: `fold.ts` コメントどおり S4 規模では full replay が correct-by-construction。増分は P8 非決定の最適化議論を持ち込み最小性に反する。core は full replay を契約とし、増分は将来の実装最適化(契約に出さない)。

## 4. 永続化方式の決定(TBD の所在 = 本 spec)

roadmap・tech.md が永続化決定を本 spec に委ねている。決定基準(tech.md): ①追記専用ログと決定的 `(ts,id)` 順序が自然に書ける、②ログからの再導出が再現可能、③ c の第二層を独立 tier として扱える。

**決定: ファイルベースの追記専用ログ(JSON 配列 / JSON Lines)を本番永続層の基準形とし、永続層を「ロード/追記/全件取得」の最小ポートに抽象化する。**

- 根拠①: `event-store.ts` の `loadJson`/`saveJson` が既に JSON ラウンドトリップを実証。`(ts,id)` 順序は **読み出し時に `sortEvents` で決定的に再構成**するため、ファイル上の物理順序に依存しない(ログが順不同でも再導出は同一)。
- 根拠②: `rederive.test.ts`・golden テストが「同一ログ → 同一導出」を担保する型。永続化は「ログを失わず往復できる」ことだけ満たせばよく、導出状態は一切永続化しない(真実源にしない)。
- 根拠③: c(i,d) は `capacity-store.ts` の独立ストアで第二層を実証済み。期日/目標日も同型の独立ストアを新設し、3 つの永続対象(イベントログ・capacity 履歴・config 履歴)を **それぞれ独立した追記専用ファイル**とする。
- **抽象化の境界**: core は具体ストレージ(ローカル JSON ファイル)を **基準実装**として確定しつつ、永続層を `LogStore`/`CapacityStore`/`ConfigStore` の **ポート(append/loadJson/all)** として定義する。DB 等への差し替えは「同一ポートの別実装」で可能(再導出再現性が満たされる限り)。デプロイ形態・DB 採否の最終確定は ADR(横断)へ委ね、core は「ポート契約 + ローカルファイル基準実装」を凍結する。
- **valid-time 再現(§7#7 開示)**: 過去時点の予測再現には当該時点で有効だった c 値が要る。capacity 履歴は `ts` 付き追記専用ゆえ valid-time スナップショットを保持でき、`capacityOf` の `ts` 比較がこれを提供する。core は履歴保持(再現の可能化)を契約とし、point-in-time 再現の最終担保はこの履歴に依る。

## 5. 設計シンセシス(一般化・build-vs-adopt・簡素化)

- **一般化**: capacity の第二層パターン(独立・追記専用・理由付き・タイムスタンプ・latest-by-ts)を、期日/目標日の config 層へ **そのまま一般化**(R-T6/R-U14 同型・§5「二層データ」)。両者は「4 イベント外の構成入力」という同一カテゴリ。新パターンを発明しない。
- **adopt**: `fold.ts` の不変条件 enforce(`wouldCycle` による I2/R-D3、非人間 agreed 拒否による I6/R-U4、frozenSlot の初回のみ凍結)はそのまま採用。core はこれを契約化するだけ。
- **簡素化**: 指標式・leveler・forecast・queues の **式本体は core に取り込まない**。core は `DerivedState` スキーマと derive オーケストレータの呼び出し契約だけを所有し、式は下流 spec が所有する関数として「プラグ」する。これにより core の境界が痩せ、下流の式変更が core 契約を揺らさない。
- **build(新設)**: config-store(期日/目標日 第二層)と、永続層ポートの明示化。参照実装に未実装の唯一の構造ギャップ。

## 6. リスクと開示(MODEL §7 と整合)

- 凍結スロット選定の実装依存(§7#1): core は frozenSlot の **記録機構**(初回スケジュール `transition` の属性として不変記録)のみ所有。どのスロットが記録されるかは leveler(schedule spec)の実装に依る。core は「記録後不変」だけを担保。
- 記録 c と実態の drift(§7#4b): core は記録値からのみ導出する。drift の構造的検知は持たない(P0 + R-U14 に委ねる)。これは仕様であって欠陥ではない。
- 増分 fold の計算可能性(P8): core は full replay を契約とし、増分最適化は契約外。
