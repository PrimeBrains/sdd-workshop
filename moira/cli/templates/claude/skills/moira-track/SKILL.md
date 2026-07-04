---
name: moira-track
description: >
  開発方法論のライフサイクル節目（既定 provider は cc-sdd: discovery / 見積 / 要件定義・設計・タスクの
  作成完了→承認 / 実装）を moira CLI のイベントとして記録するブリッジ。「moira に反映」「進捗を moira に
  記録」「moira-track」「フェーズ完了を track して」「moira と突き合わせて」などで起動。背骨フロー
  new-feature-happy-path の moira-progress 継ぎ目の実体。sync フェーズで成果物との突き合わせ（drift）と
  追いつき記録も行う。どの節目がどのフェーズかは .claude/moira-provider.json と provider-reference.md が定める。
  外部チケット（GitHub/GitLab/Backlog/Jira の issue）を渡されて作業が始まるときは ticket 入口
  （チケット駆動フロー・エンジン汎用）で起動する。
allowed-tools: Bash, Read, Glob, AskUserQuestion
argument-hint: <phase>|ticket <ref> [--feature <id>]  (phase = provider の phases。cc-sdd 既定 = discovery|estimate|requirements|design|tasks|estimate-impl|impl|sync。ticket はエンジン汎用のチケット駆動入口)
metadata:
  origin: "custom"
---

# moira-track Skill

> **managed file**: この skill は `moira adapter install` が設置する配布物（正本は sdd-workshop
> `moira/cli/templates/`）。手で編集すると次回 install で skip される（`moira adapter status` 参照）。

開発方法論（provider）の各フェーズが完了した節目で、その事実を **`moira` CLI** で追記専用イベントとして
記録するアダプタ。これにより開発者は普段のプロセスを回すだけで、Moira ダッシュボードに
達成率（EV%）・見積カバレッジ・lifecycle の「正直な弧」が `new-feature-happy-path` と同じ筋で立ち上がる。

> **このスキルの正体**: 背骨フロー [`new-feature-happy-path`](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/scenarios/flows/new-feature-happy-path.md) §5 と
> [ADR-0001](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/adr/0001-moira-cli-write-path.md) が名指す **`moira-progress` 継ぎ目の実体**（配布は [ADR-0002](https://github.com/PrimeBrains/sdd-workshop/blob/main/.kiro/adr/0002-cc-sdd-moira-adapter.md)・宣言的 provider 化は ADR-0003）。
> フロー文書 §5 は本スキル以前の断面で「⚠ 未実装（仮称）」と注記したまま — 本スキルがその実体化だが、
> 想定された**自動 emit ではなく**、hooks の決定的検知＋本スキルの振り付けによる**手動ブリッジ**である点は異なる（正直な差分）。
> 方法論側のツール（cc-sdd なら `kiro-spec-*`）は moira を知らない — その起動/完了を moira の状態遷移に写すのが本スキルの役割。
> スキルは **emit の振り付け**だけを行い、判断はしない。`moira` CLI が唯一の書き込み口・`.moira/events.json` が真実源。

**文書の分担**（3 分冊 ＋ 機械可読設定）:

| 文書 | 中身 |
|---|---|
| 本書 `SKILL.md` | エンジン汎用の運用規律（着手ゲート・AC・5 判断・sync の振り付け・制約） |
| [`provider-reference.md`](provider-reference.md) | **provider（方法論）固有のすべて**: ノード ID 規約・フェーズ→emit の振り付け・期待差分・drift 契約 |
| [`reference.md`](reference.md) | エンジン深掘り: 着手ゲートの機械チェック・AC 詳細・地雷カタログ・復旧・engine 接地表 |
| `.claude/moira-provider.json` | 機械可読の provider 設定（発火トリガー・phases・ノードスキーム・標準辺 — hooks/drift が読む） |

> **cc-sdd は既定 provider**: 本書と `reference.md` は provider を問わず逐語配布され、例示・既定値
> （`.kiro/steering/` のパス・argument-hint の phases 等）は cc-sdd 語彙で書かれている。custom provider では
> **`provider-reference.md`（設定から生成）と `.claude/moira-provider.json` が正** — 例示の cc-sdd 語彙は読み替える。

## アダプタの5層（役割分担）

| 層 | 置き場所 | 役割 |
|---|---|---|
| **いつ発火するか（規約）** | `.kiro/steering/moira-track.md` の発火トリガー表（steering として常時ロード） | 節目の取りこぼし防止の規約 |
| **いつ発火するか（検知）** | `.claude/hooks/moira-fire.mjs`（Claude Code hook） | provider 設定の triggers に基づき成果物への書き込みを決定的に検知して発火を助言・セッション開始時に drift サマリを注入・プロンプト中のチケット参照を検知して ticket 入口を助言 |
| **何を emit するか（正しさ）** | 本スキル `SKILL.md` ＋ [`provider-reference.md`](provider-reference.md) ＋ [`reference.md`](reference.md) | 正しいイベント列・5 判断の人間確認・着手ゲート・AC |
| **柵（deny＋助言）** | `.claude/hooks/moira-guard.mjs`（Claude Code hook） | 1 件を deny で強制・残りを additionalContext で助言（下記） |
| **突き合わせ（安全網）** | `moira adapter drift`（read-only）＋ 本スキル `sync` フェーズ | 発火ミスの事後検知と人間ゲート付き追いつき（[provider-reference §P4](provider-reference.md)。drift 非対応（`unsupported`）provider では使えず、発火規約＋hooks のみが防衛線） |

**hooks（`.claude/hooks/moira-guard.mjs`）が押さえること**:
- **強制（deny・ブロッキング）**: `moira add` に `--parent` 無し → PreToolUse で **deny** し Claude に付け直させる（issue #5 の footgun を封じる唯一の強制。ただし `bash -c "…"` 等での回避が原理的に可能な**ヒューリスティック柵**であり sandbox ではない）。
- **助言（additionalContext・非ブロッキング）**: `moira start` 前＝着手ゲート確認／`moira assign` 前＝ready 後退警告／`moira done` 後＝AC 記録／変更系コマンド後＝`moira ui` は自動反映（再起動不要・見えなければリロード）を注意喚起する。**助言は無視可能ゆえ、正しさの最終責任は本スキル**（hooks はセーフティネットであって強制ではない）。

**hooks（`.claude/hooks/moira-fire.mjs`）が押さえること**:
- **発火検知（PostToolUse・非ブロッキング）**: provider 設定（`.claude/moira-provider.json`）の triggers が定める成果物への書き込みを検知し、含意される `/moira-track <phase>` の発火を助言する（emit はしない — emit は本スキルの責務・5 判断の人間ゲートは不変。設定が不在/破損のときは内蔵の cc-sdd 既定へ fail-open）。
- **drift 注入（SessionStart・非ブロッキング）**: セッション開始時に `moira adapter drift --json` を 1 回だけ実行（fail-open）し、hard/needs-human があれば `/moira-track sync` を促す。
- **チケット検知（UserPromptSubmit・非ブロッキング）**: プロンプト中の外部チケット参照（GitHub/GitLab/Backlog/Jira の issue URL、または意図キーワード同伴の `#N`/`KEY-N`）を決定的に検知し、`/moira-track ticket <ref>` の発火を助言する（エンジン汎用 — provider 設定は参照しない・emit はしない。ADR-0004）。

## 前提

- `moira` CLI がグローバルに入っていること（sdd-workshop `moira/cli` README の npm link セットアップ。未導入なら案内して停止）。
- ログ home は `--dir`（グローバル）→ `MOIRA_DIR` → `.moira` ポインタファイル/上位探索 → カレント の順で解決される（multi-repo・ADR-0003。単一リポは従来どおりカレント直下の `.moira/`）。本スキル・hooks・provider 設定・steering 発火表は `moira adapter install` が設置する（`moira adapter status` で検査）。
- （任意）`.claude/settings.json` の hooks が有効だと footgun を deny/助言で補強する。hooks 未登録・非対応でも本スキルの規律だけで正しく回せる（hooks はセーフティネット）。

## Success Criteria

- 指定フェーズに対応する **正しい moira イベント**だけが追記される（過不足なし・先回りしない）。
- 人間のコミット判断（見積合意 `agree`・割当 `assign`・容量 `capacity`）は **人間の確認を得てから**実行する（`agree` は human 限定。MODEL の 5 判断は Critical Constraints 参照）。
- **着手ゲート**: どのノードも `moira start` は 見積 agreed＋担当＋着手予定日(slot) を満たしてからのみ発行する。
- **AC 記録**: 作業完了（`moira done`）したノードは必ず実コストを `moira cost` で記録する（実測・捏造しない）。
- **assign の順序**: baseline（assign＋slot）は必ず**着手前**に引く（完了済みノードに assign しない — EV% が後退する）。
- 実行後に `moira show` を要約する（達成率・カバレッジ・キューの変化）。稼働中の `moira ui` には追記が自動反映される（未起動なら起動を案内）。

## ノード ID とフェーズの振り付け（provider 固有 → provider-reference）

- ノード ID の規約・`<feature>` の解決手順は [provider-reference §P1](provider-reference.md)。
  複数候補があるときは**勝手に選ばず `[人間確認]`**。
- 各フェーズで **何を emit するか**（イベント列・人間ゲート・`moira show` の期待差分）は
  [provider-reference §P2](provider-reference.md)（フェーズ → moira CLI マッピング）に従う。**すべての `moira add` に `--parent` 必須**
  （省略は hook が deny／理由は [reference §E-1](reference.md)）。

## チケット駆動の入口（`/moira-track ticket <ref>` — エンジン汎用）

外部チケット（GitHub / GitLab / Backlog / Jira …）に書かれた障害・新規要件を起点に作業が始まるフロー
（ADR-0004）。チケットは**ノードの読み出し専用射影**（MODEL A1・D-19）— イベント 4 種・lifecycle・
5 判断はそのままに、どの実行パターンでも**節目のイベントが漏れなく残る**よう振り付ける。
チケットシステムへの**書き戻しは一切しない**（状態同期・コメント投稿は本スキルの射程外）。
この入口は provider に依存しない（`ticket` は provider の phase ではない — custom provider でもそのまま使える）。

チケット参照（moira-fire hook の UserPromptSubmit 検知、または人間の明示発火）を受けたら、emit の前に:

1. **チケット内容を read-only で取得**（`gh issue view` 等の読み取りコマンド。読めなければ人間に要約を確認）。
2. **ノード ID を提案**（チケット由来 ID 規約 — multi-repo での番号衝突を避けるため repo 名を含める）:
   - GitHub `github.com/<owner>/<repo>/issues/<N>` → `gh-<repo小文字>-<N>`
   - GitLab `…/<repo>/-/issues/<N>` → `gl-<repo小文字>-<N>`
   - Jira `…/browse/<KEY>-<N>`・Backlog `…/view/<KEY>-<N>` → キーを小文字化した `<key>-<N>`（キー自体がプロジェクトスコープ）
   - 裸 `#N` → repo 名は git remote から補完（ローカル設定・ネットワーク不要）。取れなければ `[人間確認]`。
   - 既存 feature の改修・不具合なら**新ノードでなく合流先**を提案する（複数候補は `[人間確認]`）。
3. **進め方を `[人間確認]`**（AskUserQuestion・1 回）: **A** 既存パイプラインに合流 / **B** plan→実行 / **C** 直接実行。
   どのパターンでも**誕生は一度だけ** — emit 前に `moira log` で既存ノードの有無を確認する。

### A. 既存パイプラインに合流（provider の振り付けが定義済みのとき）

チケットは provider の**最初のフェーズへの入力**（cc-sdd なら discovery の素材）。
[provider-reference §P2](provider-reference.md) の振り付けをそのまま実行し、feature ノードの
`--label` にチケット URL を含める（例: `--label "<要約> (<url>)"`）。以降は通常フローと同一 —
ticket 入口で**先回り emit しない**（二重誕生禁止）。

### B. plan→実行（パイプライン未定義・計画は立てる）

単一ノードの lifecycle で完結してよい（フェーズ子展開の省略は分解の深さ＝人間判断④・A1 射程）:

1. 誕生＋見積提案: `moira add <ticket-id> --parent <root> --estimate <n> --label "<要約> (<url>)" --actor agent:claude`（proposed）。
   見積がまだ立たないなら `--estimate` 無しで誕生し、計画後に再 add で提案する（**再 add でも `--parent` 必須**）。
   分解が要るなら子ノード `moira add <ticket-id>/impl-N --parent <ticket-id> …`（深さは人間判断④）。
2. `[人間確認]` → `moira agree <ticket-id>`（human 限定）→ `moira assign <ticket-id> --to <who> --slot <YYYY-MM-DD>`。
3. 着手ゲート充足を確認 → `moira start <ticket-id> --actor agent:claude` → 作業 →
   `moira done <ticket-id> --actor agent:claude` → **`moira cost <ticket-id> <実測md> --actor agent:claude`** →
   人間レビュー通過で `moira accept <ticket-id>`。

### C. 直接実行（最小儀式）

**イベント列は B と同一**。`[人間確認]` を 1 回に束ねるだけ
（「見積 <n>md 合意・担当 <who>・slot <date> でよいか」→ 承認後に `agree`＋`assign` を連続 emit → 即 `start`）。
**省略されるのは儀式であってゲートではない** — 着手ゲート・AC 記録・5 判断の人間確認は B と同一。

### 事後・注意

- emit 後は通常どおり `moira show` を要約（EV%・カバレッジの変化）。
- provider の drift（cc-sdd builtin 等）はチケット由来ノードを `unknown-node`（**報告のみ**）と分類する —
  A1 射程では正当（[provider-reference §P4](provider-reference.md)）。恒常運用なら `.moira/adapter.json` の
  `ignoreFeatures`/`ignoreNodes` への登録を案内する。
- チケットの状態変化（クローズ等）は moira に自動反映**されない**し、moira の完了もチケットへ書き戻さ**ない**
  （read-only 射影・D-19）。チケットのクローズ等は人間の指示によるプロセス側の操作であり、moira の記録とは独立。

## 着手ゲート（`start` の不変条件）

`moira start <node>` は次の 3 条件を**すべて**満たすときのみ発行する（計画してから着手）。`moira show --json` で確認:

| 条件 | 見る場所 | 合格 |
|---|---|---|
| 見積 agreed | `nodeStates[]`（該当 node）の `estimate` | `"agreed"` |
| 担当あり | `unassignedBacklog` | `<node>` を含まない |
| slot あり | `forecast[]`（該当 node）の `frozenSlot` | `null` でない |

> ⚠ 3 条件は**上から順に**確認する（`unassignedBacklog` は agreed のノードしか列挙しない —
> 理由と機械チェックの詳細は [reference §C](reference.md)）。

未充足なら **start を発行せず**、先に満たす: 見積未合意→見積フェーズの手順（提案→`[人間確認]`→`moira agree`）、
担当・slot 未設定→`[人間確認]` のうえ `moira assign <node> --to <who> [--reviewer <who>] --slot <YYYY-MM-DD>`。
（なぜスキル層か・機械チェックの詳細は [reference §C](reference.md)。moira は順序を強制しない＝ADR-0001。）

## 完了時の AC 記録（`done` の義務）

`moira done <node>` を打ったら必ず `moira cost <node> <実工数md> [--actor <who>]`（AI 作業は `--actor agent:claude`）。
値は**実測**（不明なら人間に確認・捏造しない）。`moira cost` の重複排除は**同一イベント id 単位**（ログ再生の冪等性）
— **コマンドを打ち直すと新イベントとして加算される**ので、同じ工数を二度打たない（分割計上したいときだけ複数回）。
効果: **CPI = EV_abs / AC** が `n/a` から立つ。（詳細は [reference §D](reference.md)。）

## `sync`（成果物との突き合わせ・追いつき記録）

発火の取りこぼしを事後検知し、成果物の現状に `.moira` ログを追いつかせる（provider の期待状態マッピングは
[provider-reference §P4](provider-reference.md)）。

1. `moira adapter drift --json` を実行し、要約を提示（hard / needs-human / advisory / ok と主要な欠落）。
2. **`hard` の各項目**を依存順（feature 誕生 → 各フェーズ → 実装群）に、**通常フェーズと同じゲート**で追いつき emit する:
   - `missing-node` → 提案どおり `moira add … --parent …`（`--parent` 必須は不変）。
   - `behind` → 提案チェーン（start → done → cost → accept）。**done を再生したら cost は必ず実測値を人間に確認**（捏造しない）。
   - `needs-human` → 見積合意・割当が先。`[人間確認]` を経て `moira agree` / `moira assign … --slot` → 着手ゲート充足後に続きを emit。
3. `ahead`・`cancelled`・`unknown-node`・advisory は**報告のみ**（人間が求めたときだけ対処）。誤検知には `.moira/adapter.json` の `ignoreFeatures`/`ignoreNodes` を案内。
4. 追いつき後に `moira adapter drift` を再実行して **hard 0** を確認 → `moira show` を要約（稼働中の `moira ui` には自動反映される）。

> `moira adapter drift` は **read-only**（emit しない）。emit するのは本スキルだけであり、5 判断の人間ゲートは sync でも通常フェーズと同一。
> provider の drift モードが `unsupported` の場合、drift は明示エラーになる（存在しない突き合わせを捏造しない） — sync は使えず、発火規約と hooks だけが防衛線になる。

## 実行後

1. `moira show` を実行し、達成率（EV%）・見積カバレッジ・レビュー待ちキューの変化を 3 行程度で要約して提示する。
2. 稼働中の `moira ui` には**追記が自動反映される**（fs.watch→SSE・[reference §E-5](reference.md)）。反映が見えなければ
   ブラウザをリロード（`/` は毎リクエスト最新を焼き込む）。**再起動は不要**。（PostToolUse hook がこの旨を注意喚起。）

## Critical Constraints

- **イベントは追記専用**。`moira` CLI 以外で `.moira/events.json` を編集しない。
- **`add` は常に `--parent` を明示**（明示が最も誤解が無い）。所属は latest-wins 置換のため二重辺は生じなくなり
  （[issue #5](https://github.com/PrimeBrains/sdd-workshop/issues/5) 解消済み）、誤った親付けは正しい親への再 add で補償できる（[reference §F](reference.md)）。hook の deny は防御多層として維持。
- **assign は lifecycle を必ず `ready` に戻す**（`emit.ts:75`）。**accepted/implemented/implementing のノードに `moira assign` を打たない** —
  EV_abs は現 lifecycle 判定（`ev.ts:16-29`）ゆえ EV% が黙って後退する。**baseline（assign＋slot）は必ず着手前**に引く（[reference §E-2/§E-3](reference.md)）。
- **5 判断は人間のまま**（MODEL §2.1）: ①見積合意 ②割当（assignee/reviewer 指名）③スコープ/期日・目標日 ④見積の深さ ⑤容量 c。
  CLI で直接触るのは `agree`（①）・`assign`（②）・`capacity`（⑤）＝必ず `[人間確認]` を経てから emit
  （`agree` に `--actor` フラグは無く常に human 記録。agent 名義の合意はそもそも fold が拒否する — 人間の確約を AI が偽装しない）。
  ③スコープ/期日・④見積の深さ は専用 CLI 動詞を持たず、方法論の各節目の承認と分解（`add`/`relate`/`cancel` の粒度）を通じて人間が握る（節目の人間承認がその代理。期日/目標日そのものは `moira deadline`＝human commit）。
  作業系（`start`/`done`/`cost`/`add`）は AI 作業なら `--actor agent:claude`。
- **計画してから着手（着手ゲート）**・**作業完了で AC 記録**: 上記の各節を守る（未充足で start しない／done に cost を必ず添える）。
- **過不足なく**: 指定フェーズに対応するイベントだけを emit する。フェーズ跨ぎの先回り emit はしない（`sync` も drift が示した欠落のみ）。
- **モデルは変更しない**: 4 イベント・lifecycle・estimate-agreement のみを使う。ラベルは表示用（`.moira/labels.json`）。
  moira 本体（backend/frontend/cli/MODEL）は無改修 — 既知の制約は回避策で吸収し [reference §G](reference.md) に記録済み。

## Safety & Fallback

- `moira` 未導入（`command not found`）: sdd-workshop `moira/cli` README のセットアップ（backend/frontend build＋`npm link`）を案内して停止。
- `.moira/` 不在: `moira init` を先に（provider の最初のフェーズが自動で行う。`<root>` は `[人間確認]`）。
- フィーチャー名が不明: [provider-reference §P1](provider-reference.md) の解決手順（成果物を Glob/Read して候補提示）→ `--feature` を確認。
- 誤った親付けで木が壊れて見える: [reference §F](reference.md) の再 add 補償で復旧（`--parent` 徹底で再発防止）。
- 成果物と `.moira` の乖離が疑わしい: `sync` フェーズ（`moira adapter drift` → 人間ゲート付き追いつき）。
