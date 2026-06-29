---
name: moira-track
description: >
  cc-sdd のライフサイクル節目（discovery / 見積 / 要件定義・設計・タスクの作成完了→承認 / 実装）を
  moira CLI のイベントとして記録するブリッジ。「moira に反映」「進捗を moira に記録」「moira-track」
  「フェーズ完了を track して」などで起動。背骨フロー new-feature-happy-path の moira-progress 継ぎ目の実体。
allowed-tools: Bash, Read, Glob, AskUserQuestion
argument-hint: <phase> [--feature <id>]  (phase = discovery|estimate|requirements|design|tasks|estimate-impl|impl)
metadata:
  origin: "custom"
---

# moira-track Skill

cc-sdd（`/kiro-*`）の各フェーズが完了した節目で、その事実を **`moira` CLI** で追記専用イベントとして
記録する。これにより開発者は `/kiro-discovery` から開発を回すだけで、Moira ダッシュボードに
達成率（EV%）・見積カバレッジ・lifecycle の「正直な弧」が `new-feature-happy-path` と同じ筋で立ち上がる。

> このスキルは **emit の振り付け**だけを行い、判断はしない。`moira` CLI が唯一の真実源（`.moira/events.json`）。
> モデルの 5 判断（見積合意・割当・容量・スコープ・見積深さ）は **人間が確認してから** emit する。
> 詳細は [ADR-0001](../../../../../.kiro/adr/0001-moira-cli-write-path.md)。

## 前提

- `moira` CLI がグローバルに入っていること（playground README のセットアップ。未導入なら案内して停止）。
- カレントディレクトリはこの playground（`.moira/` がここに作られる）。

## Success Criteria

- 指定フェーズに対応する **正しい moira イベント**だけが追記される（過不足なし）。
- 5 判断（`agree` / `assign` / `capacity`）は **人間の確認を得てから**実行する。
- 実行後に `moira show` の要約を提示し、達成率・カバレッジの弧が期待どおり動いたことを開発者が確認できる。

## ノード ID の規約

- フィーチャー（spec）= `<feature>`（spec 名。例 `todo-add`）。親はプロジェクト根 `todo-app`。
- フェーズ子ノード = `<feature>/req` `<feature>/design` `<feature>/tasks`。
- 実装ノード = `<feature>/impl-1` `<feature>/impl-2` …、実装レビュー = `<feature>/review-impl`。
- `<feature>` は `--feature` 引数、無ければ最新の `.kiro/specs/*/spec.json`（`name`）から判定。

## フェーズ → moira CLI マッピング（正典イベント列 e001–e072 に対応）

各フェーズで以下を実行する。`[人間確認]` の手順は AskUserQuestion で開発者に確認してから実行する。

### `discovery`（`/kiro-discovery` 完了後 — brief.md が出来た）
1. `moira init --me <あなた> --root todo-app`（既存なら no-op）。
2. フィーチャーとフェーズ子ノードを**未見積**で誕生（actor=AI 提案）:
   - `moira add <feature> --parent todo-app --label "<日本語ラベル>" --actor agent:claude`
   - `moira add <feature>/req --parent <feature> --label "要件定義" --actor agent:claude`
   - `moira add <feature>/design --parent <feature> --label "設計" --actor agent:claude`
   - `moira add <feature>/tasks --parent <feature> --label "タスク分解" --actor agent:claude`
3. `moira show` → 見積カバレッジ **0%**・全 pending を確認。（背骨 #1）

### `estimate`（spec 着手前に見積を確定）
1. 各フェーズの見積（人日）を提案し、`moira add <feature>/<phase> --estimate <n>`（提案＝proposed）。（背骨 #2）
2. `[人間確認]` 見積に合意してよいか確認 → 合意分のみ `moira agree <feature>/<phase>`（**human commit**・背骨 #3）。
3. `[人間確認]` 担当と着手予定を確認 → `moira assign <feature>/req --to <あなた> --slot <YYYY-MM-DD>` 等（**human commit**）。
4. `moira show` → 見積カバレッジ **100%**・分母確定を確認。

### `requirements`（`/kiro-spec-requirements`）
- 着手時: `moira start <feature>/req`。
- 人間が**承認**したら: `moira done <feature>/req`（implemented＝出来高獲得）→ `moira accept <feature>/req`
  → 実工数があれば `moira cost <feature>/req <md>` → 次段着手 `moira start <feature>/design`。（背骨 #4・#7）
- レビューで**差し戻し**たら: `moira start <feature>/req`（implemented→implementing の後退）。再提出で `moira done` を再実行。
  これで達成率が後退し、AC は残り CPI が悪化する（背骨 #5・#6 の弧が有機的に再現）。

### `design` / `tasks`（`/kiro-spec-design` / `/kiro-spec-tasks`）
- `requirements` と同型: `start` →（承認で）`done` → `accept` → `cost` → 次段 `start`。（背骨 #8・#9）
- **`tasks` 承認の帰結**（§2.6・背骨 #9 の核心）: 実装ノードを**未見積**で誕生させる:
  - `moira add <feature>/impl-1 --parent <feature> --label "実装-1" --actor agent:claude`
  - 必要数だけ impl-2… と、`moira add <feature>/review-impl --parent <feature> --label "実装レビュー" --actor agent:claude`
  - これで見かけ 100% でも見積カバレッジが 100%→<100% に下がる（正直化の入口）。

### `estimate-impl`（実装の見積合意）
1. 実装ノードの見積を提案 `moira add <feature>/impl-1 --estimate <n>` …。
2. `[人間確認]` → `moira agree <feature>/impl-1` …（**human commit**）。分母が増え達成率が正直に低下（背骨 #10）。
3. `[人間確認]` 割当 → `moira assign <feature>/impl-1 --to agent:claude --reviewer <あなた> --slot <date>`、
   実装レビューは `moira assign <feature>/review-impl --to <あなた> --slot <date>`、
   依存辺 `moira relate <feature>/impl-1 <feature>/review-impl --kind dependency --policy implemented` 等。

### `impl`（`/kiro-impl`）
- 実装着手・完了（AI 作業）: `moira start <feature>/impl-1 --actor agent:claude` → 完成で `moira done <feature>/impl-1 --actor agent:claude`（出来高獲得）。impl-2 も同様。（背骨 #11 前半 44%→72%→93%）
- 実装レビュー: `moira start <feature>/review-impl` → `moira done <feature>/review-impl`（レビュー作業も出来高＝本物の100%）。
- 承認: `moira accept <feature>/impl-1` `…/impl-2` `…/review-impl`（出来高は据え置き）。
- **フィーチャー完了（人間の最終サインオフ）**: 子が全 accepted になったのを確認し `moira accept <feature>`。
  これは自動導出ではなく人間の手番（背骨 #11 終端＝唯一 feature が accepted に至る）。
- 実工数があれば各 `moira cost … <md>`。

## 実行後

必ず最後に `moira show` を実行し、達成率（EV%）・見積カバレッジ・レビュー待ちキューの変化を 3 行程度で要約して提示する。
ダッシュボードで見るなら `moira ui` を案内する。

## Critical Constraints

- **イベントは追記専用**。過去を書き換えない（`moira` CLI 以外で `.moira/events.json` を編集しない）。
- **5 判断は人間のまま**: `agree`/`assign`/`capacity` は `[人間確認]` を経てから emit。`agree` を `--actor agent:*` で
  実行しない（エンジンが拒否する）。作業系（`start`/`done`/`cost`/`add`）は AI 作業なら `--actor agent:claude`。
- **過不足なく**: 指定フェーズに対応するイベントだけを emit する。フェーズを跨いだ先回り emit はしない。
- **モデルは変更しない**: 4 イベント・lifecycle・estimate-agreement のみを使う。ラベルは表示用（`.moira/labels.json`）。

## Safety & Fallback

- `moira` 未導入（`command not found`）: playground README のセットアップ（backend/frontend build＋`npm link`）を案内して停止。
- `.moira/` 不在: `moira init` を先に実行（discovery フェーズは自動で行う）。
- フィーチャー名が不明: `.kiro/specs/*/spec.json` を Glob/Read して `name` を提示し、`--feature` を確認。
