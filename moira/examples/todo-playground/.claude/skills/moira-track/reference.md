# moira-track リファレンス（エンジン深掘り）

> **managed file**: この文書は `moira adapter install` が設置する配布物（正本は sdd-workshop
> `moira/cli/templates/`）。手で編集すると次回 install で skip される（`moira adapter status` 参照）。

`SKILL.md` から必要時に読む詳細集。運用の中核は `SKILL.md`。**本書はエンジン汎用**の
着手ゲート機械チェック・AC 詳細・地雷カタログ・復旧手順・moira 本体側の既知制約・engine 接地表を
engine ソースに接地して収めた参照。**provider（方法論）固有**のノード ID 規約・フェーズ振り付け・
期待差分・drift 契約・背骨弧は [`provider-reference.md`](provider-reference.md) —
旧 §A→§P1、旧 §B→§P2、旧 §J→§P4、旧 §H→§P5 に移設（ADR-0003 Stage 2。§P3 発火トリガーは
Stage 2 新設＝機械可読設定の写し。**§P5 背骨弧は cc-sdd 版のみの拡張節** — custom provider の
生成版には §P1〜§P4 だけがある）。

> すべての行番号は sdd-workshop checkout の `moira/backend` `moira/cli` 参照実装に対する接地。**moira 本体は
> 変更しない**（[ADR-0001](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/adr/0001-moira-cli-write-path.md)）。ここは「なぜその手順か」の根拠置き場。

---

## §C 着手ゲートの機械チェック（`moira show --json`）

`moira start <node>` は次の 3 条件をすべて満たすときのみ正当（読み取りのみ・イベント追記なし）:

| 条件 | 見る場所（derive スナップショット） | 合格 |
|---|---|---|
| 見積 agreed | `nodeStates[]`（該当 `node`）の `estimate`（`node-states.ts:8`） | `"agreed"` |
| 担当あり | `unassignedBacklog`（計算 `derive.ts:80`・`forecast.ts:32-44`＝agreed かつ assignee===null；戻り値 `derive.ts:103`） | `<node>` を**含まない** |
| slot あり | `forecast[]`（該当 `node`）の `frozenSlot`（計算 `derive.ts:79`・`forecast.ts:13-30`〔frozenSlot は L25〕；戻り値 `derive.ts:102`） | `null` でない |

> ⚠ `unassignedBacklog` は **agreed のノードのみ**を列挙する。「含まない＝担当あり」は **見積 agreed を先に確認したうえで**成立する
> （未 agreed のノードは元々載らないため）。3 条件は上から順に確認する。

**なぜスキル層のゲートか**: CLI は段階順を強制しない（append-only・任意順で `start` を受理・ADR-0001）。
「計画（見積→割当→着手予定）してから着手」という EVM の筋は、ブリッジである本スキルが担保する（moira 無改修）。

---

## §D 完了時 AC 記録の詳細

`moira done <node>` を打ったら必ず `moira cost <node> <実工数md> [--actor <who>]`（AI 作業は `--actor agent:claude`）。

- **値は実測。捏造しない** — 手元に無ければ人間に確認（AC は 5 判断ではないが実測データゆえ勝手に埋めない）。
- `moira cost` は **累積加算＋同一イベント id の重複排除**（`fold.ts` の `cost` 分岐：`seenCostIds` で**同一イベントの再適用**を弾き、`ownCost += amount`）。
  弾かれるのはログ再生時の同一イベントであって、**コマンドの打ち直しは新 id の別イベント＝加算される** —
  同じ工数を二度打たない。分割計上したいときだけ複数回。
- AC は木を上へロールアップ（`AC(node)=ownCost+ΣAC(child)`＝実装 `ac.ts:19-26`・式コメント `ac.ts:1-4`）。**CPI = EV_abs / AC**（`indices.ts:15`・AC=0 のとき `null`）。
- 効果: done の AC を入れると CPI が `n/a` から立つ。漏らすと CPI 過大評価。

---

## §E 地雷カタログ（engine 接地）

### §E-1 `moira add` の `--parent`（issue #5 の地雷・CLI 側は解消済み）
- `--parent` 省略時の親決定（`cli/src/tree.ts` の `resolveAddParent`）: **既存ノードなら現在の有効親を再利用**（stderr に note）、
  **新規ノードのみ**プロジェクト根 `<root>` へフォールバック（stderr に warning・無音ではない）。
- かつては省略が常に root へ落ち、既存フェーズノードへの見積後付け再 add で `<root> → <feature>/<phase>` の
  **二重 decompose 辺**が生まれ木が二重表示された（[issue #5](https://github.com/PrimeBrains/sdd-workshop/issues/5)）。この footgun は CLI 側で解消済み。
- **規律は不変**: すべての `moira add` に `--parent` を明示する（明示が最も誤解が無い）。PreToolUse hook の deny も防御多層として維持。
- 誤って張ってしまった decompose 辺の復旧は §F。

### §E-2 `moira assign` は lifecycle を必ず `ready` に戻す
- `assignEvent` は `to: opts.to ?? 'ready'`（`emit.ts`）。CLI の `assign`（`cmdAssign`）は `assignEvent` に `to` を渡さない
  ため、**assign すると必ず `ready` へ遷移**する。
- 出来高 `EV_abs` は **現 lifecycle** で判定（`ev.ts:16` の `COMPLETED={implemented,accepted}`・`ev.ts:18-29`）。ラッチではない。
- → すでに `accepted`/`implemented`/`implementing` のノードに assign すると **`ready` へ後退し EV_abs が落ち、EV% が黙って下がる**。
- **回避**: **baseline（assign＋`--slot`）は必ず着手前**に引く。完了済み・着手中ノードには assign しない。PreToolUse hook が注意喚起。

### §E-3 PV は「見積 agreed かつ 着手予定日(slot)≤asOf」のリーフだけ
- `PV = Σ`（agreed・frozenSlot≠null・frozenSlot≤asOf のリーフの frozenBudget）（`pv.ts:27-30`）。
- 3 除外が効く（`pv.ts:1-13`）: scheduled-but-unagreed／agreed-but-unscheduled／**completed-but-never-scheduled**（frozenSlot=null）。
- → **着手予定日を敷いて初めて PV が立つ**。見積 agreed は EV% の**分母**、slot は **baseline(PV)** — 役割が別物。
- 完了済みで未スケジュールのノードは EV_abs には入るが PV には入らない（後追い assign は §E-2 で後退を招く）。だから baseline は着手前に。

### §E-4 見積合意は human 限定
- `moira agree` は常に `me`（human）を actor にする（`cmdAgree` は `--actor` を受けない）。加えて **fold が agent の合意を拒否**
  （`fold.ts` の estimate-agreement 分岐：R-U4 non-human actor attempted to agree … rejected）。→ `agree` を `--actor agent:*` で打たない（拒否される）。

### §E-5 `moira ui` は稼働中の追記を自動反映する
- `moira ui` は `.moira/` を fs.watch で監視し、追記を **SSE で開いているタブへ自動 push** する（issue #6 で解消）。
- `/`（トップ）は**毎リクエスト最新ログを焼き込む**ため、自動反映が見えない環境（fs.watch 不可等）でも
  **ブラウザのリロードで必ず最新化**される。**再起動は不要**。PostToolUse hook が変更系コマンド後にこの旨を注意喚起。

---

## §F 復旧手順（issue #5：誤った親付けの補償）

所属（木の親）は **latest-wins の置換**（MODEL §2.8「所属の latest-wins」・v20）。誤った親に付けてしまったノードは、
**正しい親の下へもう一度 `moira add` するだけ**で補償できる（追記 1 イベント・append-only 非違反）:

```bash
# 誤: moira add <feature>/req --estimate 0.5     ← --parent 忘れ（旧 CLI では root へ落ちた）
# 正: 正しい親を明示して再 add（見積を運ぶ必要はない — 所属だけが latest-wins で置換される）
moira add <feature>/req --parent <feature>
# 検証: 有効親が戻り、メトリクスは誤り前と一致
moira show
```

> 現行 CLI では `--parent` 省略時に**既存ノードの親を再利用**するため、この誤りは起きにくい（§E-1）。
> 二重所属という状態自体が fold で**表現不能**になった（多重辺ログも最後の親への単一所属として遡及治癒）ため、
> 旧手順（seed 全再生）は不要になった。

---

## §G moira 本体側の既知制約 ＋ アダプタの回避策（追跡記録）

**いずれも moira 本体は無改修**（ADR-0001・ユーザー指示）。アダプタ（SKILL/reference/hooks）が回避して吸収し、ここに恒久記録する。

| # | moira 側の制約 | 出典 | アダプタの回避策 |
|---|---|---|---|
| A | ~~decompose 辺の誤投入に補償イベントが無い~~ **解消済み（issue #5）**: 所属は latest-wins 置換（MODEL §2.8 v20）となり、誤親は正しい親への再 add で補償できる | `fold.ts`（childrenOf = 親ポインタの逆像）・`tree.ts` | `--parent` 明示の規律＋hook deny は防御多層として維持／補償は §F |
| B | `moira assign` が**必ず lifecycle を `ready` へ戻す**。accepted 済みへの assign で EV% が黙って後退 | `emit.ts:75`・`cmdAssign`（`commands.ts`・`to` を渡さない）・`ev.ts:16-29` | baseline は着手前（§E-2/§E-3）・完了済みへ assign しない＋ PreToolUse hook が注意喚起 |

> これらを moira 本体で解消するなら別タスク（`moira-model-update`／CLI 改修＋新 ADR）。本アダプタの射程外。

---

## §I engine-fact 接地表（主張 → 出典）

| 主張 | 出典（sdd-workshop checkout） |
|---|---|
| `--parent` 省略時: 既存ノードは現在親を再利用・新規のみ root（どちらも stderr に明示） | `moira/cli/src/tree.ts`（`resolveAddParent`）・`cmdAdd` |
| `assign` は lifecycle を必ず `ready` へ | `moira/cli/src/emit.ts`（`to: opts.to ?? 'ready'`）／`cmdAssign` は `to` を渡さない |
| EV_abs は現 lifecycle（implemented/accepted）で判定・agreed のみ | `moira/backend/src/derivations/ev.ts:16-29` |
| EV% = EV_abs / Σ(agreed リーフの latestEstimate) | `moira/backend/src/derivations/ev.ts:50-64` |
| PV は agreed＋slot≤asOf のみ・completed-but-never-scheduled 除外 | `moira/backend/src/derivations/pv.ts:1-13,27-30` |
| 見積合意は human 限定（agent は fold が拒否） | `cmdAgree`（`moira/cli/src/commands.ts`）／`moira/backend/src/fold.ts` の R-U4 拒否 |
| cost は id 重複排除つき累積加算 | `moira/backend/src/fold.ts` の `cost` 分岐（`seenCostIds`） |
| AC=ownCost+ΣAC(child)・CPI=EV_abs/AC（AC=0 で null） | `moira/backend/src/derivations/ac.ts:19-26`（式コメント `:1-4`）／`moira/backend/src/derivations/indices.ts:15` |
| `moira ui` は稼働中の追記を自動反映（fs.watch→SSE）・`/` は毎リクエスト最新を焼き込む | `moira/cli/src/ui-server.ts`（`serveUi`/`createSseHub`/`watchMoiraDir`） |
| ログ home の解決（--dir > MOIRA_DIR > .moira ポインタ/上位探索 > cwd） | `moira/cli/src/home.ts`（`resolveMoiraHome`）・ADR-0003 |
| 着手ゲートの読み元（nodeStates/unassignedBacklog/forecast） | `moira/backend/src/derivations/node-states.ts:8`／`forecast.ts:13-44`／`derive.ts:79-103` |
| drift の突き合わせ実装（read-only・方法論語彙は provider に閉じる・宣言的設定は registry で解決） | `moira/cli/src/adapter/drift/core.ts`／`providers/cc-sdd.ts`／`providers/registry.ts`・`provider-config.ts` |
