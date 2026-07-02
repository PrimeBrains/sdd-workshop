# moira-track リファレンス（深掘り）

> **managed file**: この文書は `moira adapter install` が設置する配布物（正本は sdd-workshop
> `moira/cli/templates/`）。手で編集すると次回 install で skip される（`moira adapter status` 参照）。

`SKILL.md` から必要時に読む詳細集。運用の中核は `SKILL.md`、これは**全マッピング・地雷カタログ・
復旧手順・背骨弧の対応・moira 本体側の既知制約・drift 突き合わせ契約**を engine ソースに接地して収めた参照。

> すべての行番号は sdd-workshop checkout の `moira/backend` `moira/cli` 参照実装に対する接地。**moira 本体は
> 変更しない**（[ADR-0001](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/adr/0001-moira-cli-write-path.md)）。ここは「なぜその手順か」の根拠置き場。

---

## §A ノード ID・フィーチャー解決

- **プロジェクト根** = `.moira/config.json` の `projectRoot`（以下 `<root>`。例: playground では `todo-app`）。フィーチャーの親。
- **フィーチャー（spec）ノード** = `<feature>`（spec 名。例 `task-add-and-list`）。親は `<root>`。
- **フェーズ子ノード** = `<feature>/req`・`<feature>/design`・`<feature>/tasks`。
- **実装ノード** = `<feature>/impl-1`・`<feature>/impl-2` …、**実装レビュー** = `<feature>/review-impl`。
- **`<feature>` の決定**:
  1. `--feature <id>` 引数があればそれ。
  2. 無ければ `.kiro/specs/*/spec.json` を Glob/Read し、`feature_name` を採る。
  3. **複数 spec があるとき**は勝手に選ばない。`spec.json` の `phase`／`updated_at` を提示して、
     どの feature を track するか `[人間確認]`（AskUserQuestion）で確定する。
- ラベル（`--label`）は表示専用で `.moira/labels.json` に入り、**イベントには載らない**（MODEL 外）。
  日本語ラベル（「要件定義」等）を付けると `moira show`/`ui` が読みやすい。

---

## §B フェーズ → イベント詳細マッピング

各フェーズの「前提 → 発行イベント（順序）→ 人間ゲート → `moira show` 期待差分」。数値は playground の実数
（各フェーズ **0.5 人日**・happy path は差し戻し無し）で示す。背骨弧との対応は §H。

### discovery（`/kiro-discovery` 完了・brief.md ができた）
- 前提: `.moira/` 初期化済み（未なら `moira init --me <あなた> --root <root>`。`<root>` は `[人間確認]` で決めた ID）。
- 発行（**すべて `--actor agent:claude`・すべて `--parent` 必須**）:
  1. `moira add <feature> --parent <root> --label "<日本語>" --actor agent:claude`
  2. `moira add <feature>/req --parent <feature> --label "要件定義" --actor agent:claude`
  3. `moira add <feature>/design --parent <feature> --label "設計" --actor agent:claude`
  4. `moira add <feature>/tasks --parent <feature> --label "タスク分解" --actor agent:claude`
- 人間ゲート: なし（AI 提案の誕生）。
- 期待差分: 見積カバレッジ **0%**・全 pending/proposed。（背骨 #1）

### estimate（spec 着手前に見積を確定）
- 前提: discovery 済み。
- 発行:
  1. 各フェーズに見積案（`moira add <feature>/<phase> --parent <feature> --estimate <n> --actor agent:claude`＝proposed）。
     **再 add でも `--parent` 必須**（§E-1）。`--actor agent:claude` を付け discovery と actor 帰属を揃える。
  2. `[人間確認]` 合意可否 → 合意分だけ `moira agree <feature>/<phase>`（human commit）。
  3. `[人間確認]` 割当・着手予定 → 着手予定フェーズを `moira assign <feature>/<phase> --to <あなた> --slot <YYYY-MM-DD>`。
     前倒し一括でも各着手直前でもよいが、**着手ゲート（§C）を start 前に満たす**こと。
- 人間ゲート: `agree`（見積合意）と `assign`（割当）は 5 判断 → **必ず `[人間確認]`**。
- 期待差分: **提案だけでは 0% のまま**（proposed≠agreed）。`agree` 後に見積カバレッジ **100%**（分母確定）。
  `assign --slot` を敷くと PV が立ち SPI/schedule coverage が動く（§E-3）。（背骨 #2→#3）

### requirements（`/kiro-spec-requirements`）
- 着手: **着手ゲート（§C）**充足を確認 → `moira start <feature>/req`（→ implementing）。
- 作成完了（AI 完了）: `moira done <feature>/req`（→ implemented＝**出来高獲得・EV% はここで上がる**）→ **`moira cost <feature>/req <実工数md>`（§D 必須）**。（背骨 #4）
- 承認（人間レビュー通過）: `moira accept <feature>/req`（→ accepted・**EV% は据え置き**＝承認は出来高を足さない）。（背骨 #7）
- 次フェーズの着手: design の start は `/kiro-spec-design` 起動時に `design` フェーズとして打つ（**前段 accept では次段を start しない**＝各フェーズが自分の start を持ち二重 start を避ける）。
- 差し戻し: `moira start <feature>/req`（implemented→implementing の後退）→ 再提出で `moira done` 再実行。
  達成率が後退し AC は残る（CPI 悪化）。（背骨 #5/#6 の弧を任意再現）
- 期待差分: 着手で exec coverage↑・**EV% は不変**（着手≠出来高）。**作成完了（done）で EV% 0%→33%**（EV_abs 0.5/分母 1.5）。承認（accept）は据え置き。

### design / tasks（`/kiro-spec-design` / `/kiro-spec-tasks`）
- requirements と同型（各フェーズの `start` はその `/kiro-spec-*` 起動時・ゲート確認後）: `start` → 作成完了で `done`（EV% 上昇）→ **`cost`（§D）**→ 承認で `accept`（据え置き）。
- 期待差分: design 完了で **EV% 33%→67%**、tasks 完了で **67%→100%（見かけ）**。
- **tasks 承認の帰結（核心）**: 実装ノードを**未見積**で誕生:
  - `moira add <feature>/impl-N --parent <feature> --label "実装-N" --actor agent:claude`（tasks.md の実装タスクに対応。
    タスクが1つなら impl-1、複数束ねるなら impl-1/impl-2…と分ける — §A の粒度）。
  - `moira add <feature>/review-impl --parent <feature> --label "実装レビュー" --actor agent:claude`。
  - これで見かけ 100% でも見積カバレッジが **100%→<100%** に低下（正直化の入口）。（背骨 #9）

### estimate-impl（実装の見積合意）
- 発行:
  1. 実装ノード**と実装レビュー**の見積案（再 add でも `--parent` 必須・`--actor agent:claude`）:
     `moira add <feature>/impl-N --parent <feature> --estimate <n> --actor agent:claude`（impl-1,2…）、
     `moira add <feature>/review-impl --parent <feature> --estimate <n> --actor agent:claude`。
     review-impl も見積を持つ通常の作業ノード＝EV を獲得する「ノード化」経路（canon の子9葉・分母 28.5。§H。省くと着手ゲートを通れず「レビュー作業も出来高」が成立しない）。
  2. `[人間確認]` → `moira agree <feature>/impl-N` … `moira agree <feature>/review-impl`（human commit）。分母が増え **達成率が正直に低下**。（背骨 #10）
  3. `[人間確認]` 割当 → `moira assign <feature>/impl-N --to agent:claude --reviewer <あなた> --slot <date>`、
     `moira assign <feature>/review-impl --to <あなた> --slot <date>`。
  4. 依存辺（任意）: `moira relate <feature>/impl-N <feature>/review-impl --kind dependency --policy implemented`。

### impl（`/kiro-impl`）
- 着手ゲート（§C）: 各 impl と review-impl は 見積 agreed＋担当＋slot 済みで start（review-impl も estimate-impl で見積 agreed 済みゆえゲートを通る）。
- 実装（AI 作業）: `moira start <feature>/impl-N --actor agent:claude` → `moira done … --actor agent:claude`
  → **`moira cost … --actor agent:claude`（§D 必須）**。impl ごとに繰り返す。
- 実装レビュー: `moira start <feature>/review-impl` → `moira done <feature>/review-impl` → `cost`（review-impl は見積 agreed 済みの作業ノードゆえ done で出来高を獲得する）。
- 承認: `moira accept <feature>/impl-N` … `moira accept <feature>/review-impl`（出来高は据え置き）。
- **フィーチャー完了（人間の最終サインオフ）**: 子が全 accepted になったのを確認し `moira accept <feature>`。
  背骨で唯一 feature が accepted に至る終端。feature ノードは非リーフ（rollup）ゆえ lifecycle は pending のまま最終 accept で accepted へ飛ぶ（中間状態を経ない・EV/カバレッジは葉基底ゆえ不変）。（背骨 #11）
- 期待差分: 実装完了で達成率が上がり、最後に**本物の 100%**（見積カバレッジも 100%）。

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
- `moira cost` は **id 重複排除つき累積加算**（`fold.ts:182-184`：`seenCostIds` で同一イベントを弾き、`ownCost += amount`。式コメントは `fold.ts:181`）。
  **同じ工数を二重計上しない**。分割計上したいときだけ複数回。
- AC は木を上へロールアップ（`AC(node)=ownCost+ΣAC(child)`＝実装 `ac.ts:19-26`・式コメント `ac.ts:1-4`）。**CPI = EV_abs / AC**（`indices.ts:15`・AC=0 のとき `null`）。
- 効果: done の AC を入れると CPI が `n/a` から立つ。漏らすと CPI 過大評価。

---

## §E 地雷カタログ（engine 接地）

### §E-1 `moira add` の `--parent` フォールバック（issue #5 の地雷）
- `--parent` 省略時、親は **プロジェクト根 `<root>` にフォールバック**する（`commands.ts:116`：`str(values.parent) ?? cfg.projectRoot`）。
- 既存フェーズノードへ見積を後付けする**再 add でも起きる** → `<root> → <feature>/<phase>` の二重 decompose 辺が生まれ、
  ノードが有効木に**二重表示**される（メトリクスは latest-wins で無傷、描画のみ破損）。
- **補償イベントが無い**（decompose 辺を打ち消す手段が CLI/MODEL に無い＝[issue #5](https://github.com/PrimeBrains/sdd-workshop/issues/5)）。
  → 復旧は §F の seed 全再生のみ。
- **回避**: すべての `moira add` に `--parent` を明示。PreToolUse hook が `--parent` 無しを **deny** して自己修正させる。

### §E-2 `moira assign` は lifecycle を必ず `ready` に戻す
- `assignEvent` は `to: opts.to ?? 'ready'`（`emit.ts:75`）。CLI の `assign`（`cmdAssign`）は `assignEvent` に `to` を渡さない
  （呼び出しは `commands.ts:170`／関数全体 `commands.ts:151-179`）ため、**assign すると必ず `ready` へ遷移**する。
- 出来高 `EV_abs` は **現 lifecycle** で判定（`ev.ts:16` の `COMPLETED={implemented,accepted}`・`ev.ts:18-29`）。ラッチではない。
- → すでに `accepted`/`implemented`/`implementing` のノードに assign すると **`ready` へ後退し EV_abs が落ち、EV% が黙って下がる**。
- **回避**: **baseline（assign＋`--slot`）は必ず着手前**に引く。完了済み・着手中ノードには assign しない。PreToolUse hook が注意喚起。

### §E-3 PV は「見積 agreed かつ 着手予定日(slot)≤asOf」のリーフだけ
- `PV = Σ`（agreed・frozenSlot≠null・frozenSlot≤asOf のリーフの frozenBudget）（`pv.ts:27-30`）。
- 3 除外が効く（`pv.ts:1-13`）: scheduled-but-unagreed／agreed-but-unscheduled／**completed-but-never-scheduled**（frozenSlot=null）。
- → **着手予定日を敷いて初めて PV が立つ**。見積 agreed は EV% の**分母**、slot は **baseline(PV)** — 役割が別物。
- 完了済みで未スケジュールのノードは EV_abs には入るが PV には入らない（後追い assign は §E-2 で後退を招く）。だから baseline は着手前に。

### §E-4 見積合意は human 限定
- `moira agree` は常に `me`（human）を actor にする（`commands.ts:133-149`・`--actor` なし）。加えて **fold が agent の合意を拒否**
  （`fold.ts:122-125`：R-U4 non-human actor attempted to agree … rejected）。→ `agree` を `--actor agent:*` で打たない（拒否される）。

### §E-5 `moira ui` は起動時スナップショット
- `cmdUi` は起動時に `repo.loadEvents()` を読み、fixture に**焼き込む**（`commands.ts:299`）。
- → イベントを追記しても**ブラウザ再読込では反映されない**。旧サーバ停止（port 5180 の PID を kill）→
  `moira ui --port 5180 --no-open` で**再起動**する。PostToolUse hook が変更系コマンド後に注意喚起。

---

## §F 復旧手順（issue #5：誤 decompose 辺の除去）

decompose 辺の誤投入は補償イベントが無い（§E-1）。小規模ログは **seed 全再生**でのみ回復:

```bash
# 1) 壊れたログを証拠退避（append-only 外の操作＝seed 復旧のみ許容）
cp .moira/events.json .moira/events.broken.json
# 2) seed（空）に戻す
printf '[]\n' > .moira/events.json
# 3) すべての moira add に --parent を付けて、これまでのイベントを順に再生
#    discovery → estimate(--estimate) → agree → assign → start/done/cost/accept …
# 4) 検証: 二重辺が消えたか / メトリクスが元どおりか（<root> は config.json の projectRoot）
grep '"parent": "<root>"' .moira/events.json   # feature ノード自身の1件のみが正
moira show                                        # EV%・カバレッジが復旧前と一致
# 5) UI 再起動（§E-5）
```

> latest-wins ゆえ **メトリクスは再生前後で不変**。壊れていたのは木の描画のみ。以後 `--parent` 徹底＋hook で再発防止。

---

## §G moira 本体側の既知制約 ＋ アダプタの回避策（追跡記録）

**いずれも moira 本体は無改修**（ADR-0001・ユーザー指示）。アダプタ（SKILL/reference/hooks）が回避して吸収し、ここに恒久記録する。

| # | moira 側の制約 | 出典 | アダプタの回避策 |
|---|---|---|---|
| A | decompose 辺の誤投入に**補償イベントが無い**。小規模ログは seed 全再生でしか直せない（issue #5） | `fold.ts`（childrenOf は追記のみ）・`commands.ts:116` | 常に `--parent` 明示（§E-1）＋ PreToolUse hook が `--parent` 無し add を deny／復旧は §F |
| B | `moira assign` が**必ず lifecycle を `ready` へ戻す**。accepted 済みへの assign で EV% が黙って後退 | `emit.ts:75`・`commands.ts:151-179`・`ev.ts:16-29` | baseline は着手前（§E-2/§E-3）・完了済みへ assign しない＋ PreToolUse hook が注意喚起 |

> これらを moira 本体で解消するなら別タスク（`moira-model-update`／CLI 改修＋新 ADR）。本アダプタの射程外。

---

## §H 背骨弧との対応

背骨フロー [`new-feature-happy-path`](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/scenarios/flows/new-feature-happy-path.md) は **弧の“形”**を定める正典。
playground はその形を**簡略な数値**で再現する（正確な値は人間が合意する見積で変わる）。

| 背骨 # | 段 | moira-track フェーズ | 見える信号（形） | canon の例値 | playground の例値 |
|---|---|---|---|---|---|
| #1 | discovery | `discovery` | F＋3フェーズ誕生・見積なし | 見積カバレッジ 0% | 同左 |
| #2/#3 | estimate proposed→agreed | `estimate` | 提案は分母に入らず、合意で分母確定 | カバレッジ 0→100%・分母 12.5 | カバレッジ 0→100%・分母 1.5 |
| #4 | requirements drafted | `requirements`（着手→承認） | 完了で EV% が初めて動く | 0→24% | 0→33% |
| #5/#6 | requirements returned | `requirements`（差し戻し） | 差し戻しで後退・AC 残り CPI 悪化 | 24→32→8%（2往復） | 任意再現（差し戻すたび後退） |
| #7 | requirements accepted | `requirements`（承認） | 承認は EV を足さない | 32% 据え置き | 33% 据え置き |
| #8 | design completed | `design` | 完了で前進 | 32→72→80% | 33→67% |
| #9 | tasks completed | `tasks` | 見かけ100%だが実装誕生で見積カバレッジ低下 | 96→100(見かけ)・カバレッジ 100→75% | 100(見かけ)・カバレッジ 100→<100% |
| #10 | estimate-impl agreed | `estimate-impl` | 分母増で**達成率が正直に低下**（非単調） | 100→44%・分母 12.5→28.5 | 見積次第で低下（例 100→50%台） |
| #11 | impl completed | `impl` | 実装完了→F accepted＝**本物の100%** | 44→72→93→100(本物) | 完了で上昇→本物 100% |

- **canon と playground の違い**: canon は 12.5→28.5md・9葉・実装2＋レビュー・差し戻し2往復。playground の happy path は
  各フェーズ 0.5md・差し戻し無しの最短経路（差し戻しはいつでも再現可能）。**「見かけ100%／本物100%」の正直化の弧は同一**。
- playground の #10 以降の正確な EV% は、実装ノード数と合意見積に依存する（例値であって固定値ではない）。

---

## §I engine-fact 接地表（主張 → 出典）

| 主張 | 出典（sdd-workshop checkout） |
|---|---|
| `--parent` 省略で親が projectRoot にフォールバック | `moira/cli/src/commands.ts:116` |
| `assign` は lifecycle を必ず `ready` へ | `moira/cli/src/emit.ts:75`／`moira/cli/src/commands.ts:170`（`to` を渡さない・全体 `:151-179`） |
| EV_abs は現 lifecycle（implemented/accepted）で判定・agreed のみ | `moira/backend/src/derivations/ev.ts:16-29` |
| EV% = EV_abs / Σ(agreed リーフの latestEstimate) | `moira/backend/src/derivations/ev.ts:50-64` |
| PV は agreed＋slot≤asOf のみ・completed-but-never-scheduled 除外 | `moira/backend/src/derivations/pv.ts:1-13,27-30` |
| 見積合意は human 限定（agent は fold が拒否） | `moira/cli/src/commands.ts:133-149`／`moira/backend/src/fold.ts:122-125` |
| cost は id 重複排除つき累積加算 | `moira/backend/src/fold.ts:182-184`（式コメント `:181`） |
| AC=ownCost+ΣAC(child)・CPI=EV_abs/AC（AC=0 で null） | `moira/backend/src/derivations/ac.ts:19-26`（式コメント `:1-4`）／`moira/backend/src/derivations/indices.ts:15` |
| `moira ui` は起動時に events を焼き込むスナップショット | `moira/cli/src/commands.ts:299` |
| 着手ゲートの読み元（nodeStates/unassignedBacklog/forecast） | `moira/backend/src/derivations/node-states.ts:8`／`forecast.ts:13-44`／`derive.ts:79-103` |
| drift の突き合わせ実装（read-only・cc-sdd 語彙は provider に閉じる） | `moira/cli/src/adapter/drift/core.ts`／`moira/cli/src/adapter/providers/cc-sdd.ts` |

---

## §J drift 突き合わせ契約（`moira adapter drift` ↔ `sync` フェーズ）

`moira adapter drift` は `.kiro`（spec.json / tasks.md）と `.moira` ログを **read-only** で突き合わせる
（**emit しない** — emit は本スキルだけ。実装は `moira/cli/src/adapter/`、cc-sdd 語彙は provider に閉じる）。
`sync` フェーズはこのレポートを入力に、**通常フェーズと同じゲート**で追いつき emit を振り付ける。
この表は TS 実装（`providers/cc-sdd.ts`・`drift/core.ts`）と本スキルが共有する単一の契約。

### 期待状態マッピング（provider `cc-sdd`）

| .kiro の証拠 | 期待（ノード ID 規約 §A） | 遅れの扱い |
|---|---|---|
| `spec.json` が存在 | `<f>`・`<f>/req`・`<f>/design`・`<f>/tasks` が存在 | **hard**（discovery 未発火） |
| `approvals.<p>.generated=true`（または `phase` がそれ以降） | `<f>/<p>` ≥ implemented | **hard**（start/done 欠落） |
| `approvals.<p>.approved=true` | `<f>/<p>` = accepted | **hard**（accept 欠落） |
| `approvals.tasks.approved=true`（≒ `ready_for_implementation`） | `<f>/impl-*` が 1 つ以上 と `<f>/review-impl` が存在（**個数は不問**＝分解の深さは人間判断④） | **hard** |
| tasks.md のチェックボックス進捗 | impl-* の implemented 到達（タスク↔ノードの対応粒度は人間判断） | **advisory** |
| —（.kiro に痕跡が無い） | review-impl の完了・`<f>` の最終 accept | drift ではなく**次の一手**として提示 |

### ステータス分類と sync の扱い

| status | 意味 | sync の扱い |
|---|---|---|
| `missing-node` / `behind` | .kiro が含意する存在/進捗がログに無い（機械的に追いつける） | 提案チェーンを依存順に emit（**done 再生後の cost は実測を人間確認**） |
| `needs-human` | 追いつきに人間判断①（見積合意）/②（割当）が挟まる | `[人間確認]` を先に（`agree`/`assign --slot`）→ 着手ゲート充足後に続き |
| `ahead` | ログが .kiro の根拠を超えて先行（口頭承認の未反映等） | 報告のみ |
| `cancelled` | moira 側で cancelled（スコープ判断③とみなす） | 報告のみ（意図的なら ignore 登録を案内） |
| `unknown-node` | どの feature 空間にも属さない（非 cc-sdd の作業単位など＝A1 射程では正当） | 報告のみ（ignore 登録を案内） |

### 導出不能なもの（drift は捏造しない）

見積値・合意（①）、担当/レビュアー/slot（②）、容量（⑤）、実測 AC、cancel（③）は `.kiro` から**導出できない**。
提案コマンドは `<md?>`／`<who?>`／`<YYYY-MM-DD?>`／`<実測md?>` のプレースホルダのまま出る — 値は人間が与える。
また、implementing 以上のノードに `assign` は**決して提案されない**（§E-2 の ready 後退地雷を suggested 側でも封じる）。

### レポート（`--json` schemaVersion 1）とエスケープ弁

- `features[].nodes[]` = `{ node, status, severity(hard|advisory), evidence, expected, actual, suggested[] }`。
  `suggested[].humanGate ∈ agree|assign|capacity|measure|null`。全体集計は `summary: { hard, advisory, needsHuman, ok }`。
- `moira adapter drift --check` は hard＋needs-human>0 で exit 1（CI 向け・advisory のみでは失敗しない）。`--feature <f>` で単一 feature に絞る。
- ノード ID 規約から外れた運用は `.moira/adapter.json` の `ignoreFeatures` / `ignoreNodes`（`<id>` 完全一致または `<prefix>/*`）で除外する。
