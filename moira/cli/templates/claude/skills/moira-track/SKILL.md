---
name: moira-track
description: >
  cc-sdd のライフサイクル節目（discovery / 見積 / 要件定義・設計・タスクの作成完了→承認 / 実装）を
  moira CLI のイベントとして記録するブリッジ。「moira に反映」「進捗を moira に記録」「moira-track」
  「フェーズ完了を track して」「moira と突き合わせて」などで起動。背骨フロー new-feature-happy-path の
  moira-progress 継ぎ目の実体。sync フェーズで .kiro との突き合わせ（drift）と追いつき記録も行う。
allowed-tools: Bash, Read, Glob, AskUserQuestion
argument-hint: <phase> [--feature <id>]  (phase = discovery|estimate|requirements|design|tasks|estimate-impl|impl|sync)
metadata:
  origin: "custom"
---

# moira-track Skill

> **managed file**: この skill は `moira adapter install` が設置する配布物（正本は sdd-workshop
> `moira/cli/templates/`）。手で編集すると次回 install で skip される（`moira adapter status` 参照）。

cc-sdd（`/kiro-*`）の各フェーズが完了した節目で、その事実を **`moira` CLI** で追記専用イベントとして
記録するアダプタ。これにより開発者は `/kiro-discovery` から回すだけで、Moira ダッシュボードに
達成率（EV%）・見積カバレッジ・lifecycle の「正直な弧」が `new-feature-happy-path` と同じ筋で立ち上がる。

> **このスキルの正体**: 背骨フロー [`new-feature-happy-path`](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/scenarios/flows/new-feature-happy-path.md) §5 と
> [ADR-0001](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/adr/0001-moira-cli-write-path.md) が名指す **`moira-progress` 継ぎ目の実体**（配布は [ADR-0002](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/adr/0002-cc-sdd-moira-adapter.md)）。
> `kiro-spec-*` は moira を知らない — その起動/完了を moira の状態遷移に写すのが本スキルの役割。
> スキルは **emit の振り付け**だけを行い、判断はしない。`moira` CLI が唯一の書き込み口・`.moira/events.json` が真実源。

## アダプタの5層（役割分担）

| 層 | 置き場所 | 役割 |
|---|---|---|
| **いつ発火するか（規約）** | `.kiro/steering/moira-track.md` の発火トリガー表（steering として常時ロード） | 節目の取りこぼし防止の規約 |
| **いつ発火するか（検知）** | `.claude/hooks/moira-fire.mjs`（Claude Code hook） | `.kiro/specs/**` への書き込みを決定的に検知して発火を助言・セッション開始時に drift サマリを注入 |
| **何を emit するか（正しさ）** | 本スキル `SKILL.md` ＋ [`reference.md`](reference.md) | 正しいイベント列・5 判断の人間確認・着手ゲート・AC |
| **柵（deny＋助言）** | `.claude/hooks/moira-guard.mjs`（Claude Code hook） | 1 件を deny で強制・残りを additionalContext で助言（下記） |
| **突き合わせ（安全網）** | `moira adapter drift`（read-only）＋ 本スキル `sync` フェーズ | 発火ミスの事後検知と人間ゲート付き追いつき（[reference §J](reference.md)） |

**hooks（`.claude/hooks/moira-guard.mjs`）が押さえること**:
- **強制（deny・ブロッキング）**: `moira add` に `--parent` 無し → PreToolUse で **deny** し Claude に付け直させる（issue #5 の二重辺を封じる唯一の強制。ただし `bash -c "…"` 等での回避が原理的に可能な**ヒューリスティック柵**であり sandbox ではない）。
- **助言（additionalContext・非ブロッキング）**: `moira start` 前＝着手ゲート確認／`moira assign` 前＝ready 後退警告／`moira done` 後＝AC 記録／変更系コマンド後＝`moira ui` 再起動 を注意喚起する。**助言は無視可能ゆえ、正しさの最終責任は本スキル**（hooks はセーフティネットであって強制ではない）。

**hooks（`.claude/hooks/moira-fire.mjs`）が押さえること**:
- **発火検知（PostToolUse・非ブロッキング）**: `.kiro/specs/<feature>/spec.json`／`tasks.md` への書き込みを検知し、含意される `/moira-track <phase>` の発火を助言する（emit はしない — emit は本スキルの責務・5 判断の人間ゲートは不変）。
- **drift 注入（SessionStart・非ブロッキング）**: セッション開始時に `moira adapter drift --json` を 1 回だけ実行（fail-open）し、hard/needs-human があれば `/moira-track sync` を促す。

## 前提

- `moira` CLI がグローバルに入っていること（sdd-workshop `moira/cli` README の npm link セットアップ。未導入なら案内して停止）。
- カレントディレクトリは対象プロジェクトのルート（`.moira/` がここに作られる）。本スキル・hooks・steering 発火表は `moira adapter install` が設置する（`moira adapter status` で検査）。
- （任意）`.claude/settings.json` の hooks が有効だと footgun を deny/助言で補強する。hooks 未登録・非対応でも本スキルの規律だけで正しく回せる（hooks はセーフティネット）。

## Success Criteria

- 指定フェーズに対応する **正しい moira イベント**だけが追記される（過不足なし・先回りしない）。
- 人間のコミット判断（見積合意 `agree`・割当 `assign`・容量 `capacity`）は **人間の確認を得てから**実行する（`agree` は human 限定。MODEL の 5 判断は Critical Constraints 参照）。
- **着手ゲート**: どのノードも `moira start` は 見積 agreed＋担当＋着手予定日(slot) を満たしてからのみ発行する。
- **AC 記録**: 作業完了（`moira done`）したノードは必ず実コストを `moira cost` で記録する（実測・捏造しない）。
- **assign の順序**: baseline（assign＋slot）は必ず**着手前**に引く（完了済みノードに assign しない — EV% が後退する）。
- 実行後に `moira show` を要約し（達成率・カバレッジ・キューの変化）、必要なら `moira ui` を再起動して開発者が確認できる。

## ノード ID の規約（詳細は [reference §A](reference.md)）

- プロジェクト根 = **`<root>`**（`.moira/config.json` の `projectRoot`。`.moira/` 不在なら `[人間確認]` で ID を決めて `moira init --me <あなた> --root <root>` を先に実行する）。
- フィーチャー（spec）= `<feature>`（spec 名。親は `<root>`）。
- フェーズ子 = `<feature>/req` `<feature>/design` `<feature>/tasks`。実装 = `<feature>/impl-1…`、実装レビュー = `<feature>/review-impl`。
- `<feature>` = `--feature` 引数。無ければ `.kiro/specs/*/spec.json` の `feature_name`。**複数 spec なら勝手に選ばず `[人間確認]`**。

## 着手ゲート（`start` の不変条件）

`moira start <node>` は次の 3 条件を**すべて**満たすときのみ発行する（計画してから着手）。`moira show --json` で確認:

| 条件 | 見る場所 | 合格 |
|---|---|---|
| 見積 agreed | `nodeStates[]`（該当 node）の `estimate` | `"agreed"` |
| 担当あり | `unassignedBacklog` | `<node>` を含まない |
| slot あり | `forecast[]`（該当 node）の `frozenSlot` | `null` でない |

未充足なら **start を発行せず**、先に満たす: 見積未合意→`estimate` 手順（提案→`[人間確認]`→`moira agree`）、
担当・slot 未設定→`[人間確認]` のうえ `moira assign <node> --to <who> [--reviewer <who>] --slot <YYYY-MM-DD>`。
（なぜスキル層か・機械チェックの詳細は [reference §C](reference.md)。moira は順序を強制しない＝ADR-0001。）

## 完了時の AC 記録（`done` の義務）

`moira done <node>` を打ったら必ず `moira cost <node> <実工数md> [--actor <who>]`（AI 作業は `--actor agent:claude`）。
値は**実測**（不明なら人間に確認・捏造しない）。`moira cost` は **id 重複排除つき累積加算**なので同じ工数を二重計上しない。
効果: **CPI = EV_abs / AC** が `n/a` から立つ。（詳細は [reference §D](reference.md)。）

## フェーズ → moira CLI マッピング

各フェーズで以下を実行。`[人間確認]` は AskUserQuestion で確認してから。**すべての `moira add` に `--parent` 必須**
（省略は hook が deny／理由は [reference §E-1](reference.md)）。各フェーズの期待差分・背骨弧の対応は [reference §B/§H](reference.md)。

### `discovery`（`/kiro-discovery` 完了後）
1. `moira init --me <あなた> --root <root>`（既存なら no-op。`<root>` は `[人間確認]` で決めた ID）。
2. フィーチャー＋3フェーズ子を**未見積**で誕生（`--actor agent:claude`）:
   - `moira add <feature> --parent <root> --label "<日本語>" --actor agent:claude`
   - `moira add <feature>/req --parent <feature> --label "要件定義" --actor agent:claude`
   - `moira add <feature>/design --parent <feature> --label "設計" --actor agent:claude`
   - `moira add <feature>/tasks --parent <feature> --label "タスク分解" --actor agent:claude`
3. `moira show` → 見積カバレッジ **0%**。（背骨 #1）

### `estimate`（spec 着手前に見積を確定）
1. 各フェーズの見積案 `moira add <feature>/<phase> --parent <feature> --estimate <n> --actor agent:claude`（proposed＝AI 提案）。（背骨 #2）
2. `[人間確認]` 合意可否 → 合意分だけ `moira agree <feature>/<phase>`（human commit・背骨 #3）。
3. `[人間確認]` 割当・着手予定 → 着手予定フェーズを `moira assign <feature>/<phase> --to <あなた> --slot <YYYY-MM-DD>`（human commit）。
   前倒し一括でも着手直前でもよいが、**着手ゲートを start 前に満たす**こと。
4. `moira show` → 見積カバレッジ **100%**（分母確定）。slot を敷いた分は PV/SPI が立つ。

### `requirements`（`/kiro-spec-requirements`）
- 着手: 着手ゲート充足 → `moira start <feature>/req`（→ implementing）。未割当/未 slot なら先に `[人間確認]` で assign→slot。
- 作成完了（AI が要件定義を書き終える）: `moira done <feature>/req`（→ implemented＝**出来高獲得・EV% はここで上がる**）→ **`moira cost <feature>/req <実工数md>`（AC 必須）**。（背骨 #4）
- 承認（人間レビュー通過）: `moira accept <feature>/req`（→ accepted・**EV% は据え置き**＝承認は出来高を足さない）。（背骨 #7）
  次フェーズ（design）の着手は `/kiro-spec-design` 起動時に `design` フェーズとして start する（**前段 accept では次段を start しない**＝各フェーズが自分の start を持ち二重 start を避ける）。
- 差し戻し: `moira start <feature>/req`（implemented→implementing の後退）。再提出で `moira done` 再実行。
  達成率が後退し AC は残る（CPI 悪化・背骨 #5/#6 を任意再現）。

### `design` / `tasks`（`/kiro-spec-design` / `/kiro-spec-tasks`）
- requirements と同型（各フェーズの `start` はその `/kiro-spec-*` 起動時・着手ゲート充足後）: `start`（着手）→ 作成完了で `done`（EV% 上昇）→ **`cost`（AC 必須）**→ 承認で `accept`（EV% 据え置き）。（背骨 #8・#9）
- **`tasks` 承認の帰結**（核心）: 実装ノードを**未見積**で誕生（tasks.md の実装タスクに対応・[reference §A](reference.md)）:
  - `moira add <feature>/impl-1 --parent <feature> --label "実装-1" --actor agent:claude`（必要数だけ impl-2…）
  - `moira add <feature>/review-impl --parent <feature> --label "実装レビュー" --actor agent:claude`
  - → 見かけ 100% でも見積カバレッジが低下（正直化の入口）。

### `estimate-impl`（実装の見積合意）
1. 実装ノード**と実装レビュー**の見積案（再 add でも `--parent` 必須・`--actor agent:claude`）:
   `moira add <feature>/impl-1 --parent <feature> --estimate <n> --actor agent:claude` …（impl-2…）、
   `moira add <feature>/review-impl --parent <feature> --estimate <n> --actor agent:claude`。
   実装レビューも見積を持つ通常の作業ノード＝EV を獲得する「ノード化」経路（canon の子9葉・分母 28.5。[reference §H](reference.md)）。
2. `[人間確認]` → `moira agree <feature>/impl-1` … `moira agree <feature>/review-impl`（human commit）。分母が増え達成率が正直に低下（背骨 #10）。
3. `[人間確認]` 割当 → `moira assign <feature>/impl-1 --to agent:claude --reviewer <あなた> --slot <date>`、
   `moira assign <feature>/review-impl --to <あなた> --slot <date>`、依存辺 `moira relate <feature>/impl-1 <feature>/review-impl --kind dependency --policy implemented`。

### `impl`（`/kiro-impl`）
- 着手ゲート: 各 impl と review-impl は 見積 agreed＋担当＋slot 済みで start（review-impl も estimate-impl で見積 agreed 済みゆえゲートを通る）。
- 実装（AI 作業）: `moira start <feature>/impl-1 --actor agent:claude` → `moira done … --actor agent:claude` → **`moira cost … --actor agent:claude`（AC 必須）**。impl-2 も同様。（背骨 #11）
- 実装レビュー: `moira start <feature>/review-impl` → `moira done <feature>/review-impl` → `cost`（review-impl は見積 agreed 済みの作業ノードゆえ done で出来高を獲得する）。
- 承認: `moira accept <feature>/impl-1` `…/impl-2` `…/review-impl`（出来高は据え置き）。
- **フィーチャー完了（人間の最終サインオフ）**: 子が全 accepted になったのを確認し `moira accept <feature>`（背骨で唯一 feature が accepted に至る終端）。
  feature ノードは非リーフ（rollup）ゆえ lifecycle は pending のまま最終 accept で accepted へ飛ぶ（中間 implementing/implemented を経ない。EV/カバレッジは葉基底ゆえ影響なし）。

> `capacity`（容量）と `cancel`（スコープ縮小＝R-C2 sunk）は happy path の直線では**使わない**。日次容量を敷くなら
> `moira capacity <who> <date> <c>`（5 判断の容量＝`[人間確認]`）、ノードを取り止めるなら `moira cancel <node>`（スコープ判断）。

### `sync`（.kiro との突き合わせ・追いつき記録）

発火の取りこぼしを事後検知し、`.kiro` の現状に `.moira` ログを追いつかせる（契約の詳細は [reference §J](reference.md)）。

1. `moira adapter drift --json` を実行し、要約を提示（hard / needs-human / advisory / ok と主要な欠落）。
2. **`hard` の各項目**を依存順（feature 誕生 → req → design → tasks → impl 群）に、**通常フェーズと同じゲート**で追いつき emit する:
   - `missing-node` → 提案どおり `moira add … --parent …`（`--parent` 必須は不変）。
   - `behind` → 提案チェーン（start → done → cost → accept）。**done を再生したら cost は必ず実測値を人間に確認**（捏造しない）。
   - `needs-human` → 見積合意・割当が先。`[人間確認]` を経て `moira agree` / `moira assign … --slot` → 着手ゲート充足後に続きを emit。
3. `ahead`・`cancelled`・`unknown-node`・advisory は**報告のみ**（人間が求めたときだけ対処）。誤検知には `.moira/adapter.json` の `ignoreFeatures`/`ignoreNodes` を案内。
4. 追いつき後に `moira adapter drift` を再実行して **hard 0** を確認 → `moira show` を要約 → `moira ui` 再起動を案内。

> `moira adapter drift` は **read-only**（emit しない）。emit するのは本スキルだけであり、5 判断の人間ゲートは sync でも通常フェーズと同一。

## 実行後

1. `moira show` を実行し、達成率（EV%）・見積カバレッジ・レビュー待ちキューの変化を 3 行程度で要約して提示する。
2. **イベントを追記したら `moira ui` を再起動**（起動時スナップショットのためリロードでは反映されない・[reference §E-5](reference.md)）:
   旧サーバ停止（port 5180 の PID を kill）→ `moira ui --port 5180 --no-open`。（PostToolUse hook がこれを促す。）

## Critical Constraints

- **イベントは追記専用**。`moira` CLI 以外で `.moira/events.json` を編集しない。
- **`add` は常に `--parent` を明示**。省略すると親がプロジェクト根にフォールバックし二重 decompose 辺が生じる
  （描画破損・補償イベント無し＝[issue #5](https://github.com/PrimeBrains/sdd-workshop/issues/5)・復旧は seed 全再生＝[reference §F](reference.md)）。hook が deny する。
- **assign は lifecycle を必ず `ready` に戻す**（`emit.ts:75`）。**accepted/implemented/implementing のノードに `moira assign` を打たない** —
  EV_abs は現 lifecycle 判定（`ev.ts:16-29`）ゆえ EV% が黙って後退する。**baseline（assign＋slot）は必ず着手前**に引く（[reference §E-2/§E-3](reference.md)）。
- **5 判断は人間のまま**（MODEL §2.1）: ①見積合意 ②割当（assignee/reviewer 指名）③スコープ/期日・目標日 ④見積の深さ ⑤容量 c。
  CLI で直接触るのは `agree`（①）・`assign`（②）・`capacity`（⑤）＝必ず `[人間確認]` を経てから emit（`agree` を `--actor agent:*` で実行しない — fold が拒否）。
  ③スコープ/期日・④見積の深さ は専用 CLI 動詞を持たず、cc-sdd の各フェーズ承認と分解（`add`/`relate`/`cancel` の粒度）を通じて人間が握る（節目の人間承認がその代理）。
  作業系（`start`/`done`/`cost`/`add`）は AI 作業なら `--actor agent:claude`。
- **計画してから着手（着手ゲート）**・**作業完了で AC 記録**: 上記の各節を守る（未充足で start しない／done に cost を必ず添える）。
- **過不足なく**: 指定フェーズに対応するイベントだけを emit する。フェーズ跨ぎの先回り emit はしない（`sync` も drift が示した欠落のみ）。
- **モデルは変更しない**: 4 イベント・lifecycle・estimate-agreement のみを使う。ラベルは表示用（`.moira/labels.json`）。
  moira 本体（backend/frontend/cli/MODEL）は無改修 — 既知の制約は回避策で吸収し [reference §G](reference.md) に記録済み。

## Safety & Fallback

- `moira` 未導入（`command not found`）: sdd-workshop `moira/cli` README のセットアップ（backend/frontend build＋`npm link`）を案内して停止。
- `.moira/` 不在: `moira init` を先に（discovery フェーズは自動で行う。`<root>` は `[人間確認]`）。
- フィーチャー名が不明: `.kiro/specs/*/spec.json` を Glob/Read して `feature_name` を提示し、`--feature` を確認。
- 二重行など木の描画が壊れた: [reference §F](reference.md) の seed 全再生で復旧（`--parent` 徹底で再発防止）。
- `.kiro` と `.moira` の乖離が疑わしい: `sync` フェーズ（`moira adapter drift` → 人間ゲート付き追いつき）。
