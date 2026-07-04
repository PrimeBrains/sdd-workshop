# moira-track provider リファレンス — cc-sdd

> **managed file**: この文書は `moira adapter install` が設置する配布物（正本は sdd-workshop
> `moira/cli/templates/` の `provider-reference.cc-sdd.md`・配布名は `provider-reference.md`）。
> 手で編集すると次回 install で skip される（`moira adapter status` 参照）。

**provider（方法論）固有のすべて**をここに集約する: ノード ID 規約・フェーズ→emit の振り付け・
期待差分・発火トリガー・drift 突き合わせ契約・背骨弧の対応。**エンジン汎用の規律**（着手ゲート・
AC 記録・地雷カタログ・復旧手順・接地表）は [`reference.md`](reference.md)、運用の中核は
[`SKILL.md`](SKILL.md)。機械可読の対応物は `.claude/moira-provider.json`（発火トリガー・
ノードスキーム・標準辺 — ADR-0003 Stage 2）。

> **節番号の規約**: §P1（ノード ID）・§P2（フェーズ振り付け）・§P3（発火トリガー）・§P4（drift 契約）は
> どの provider 版にも共通。**§P5（背骨弧）は cc-sdd 版のみの拡張節**（custom provider の生成版には無い）。

---

## §P1 ノード ID・フィーチャー解決

- **プロジェクト根** = `.moira/config.json` の `projectRoot`（以下 `<root>`。例: playground では `todo-app`）。フィーチャーの親。
  `.moira/` 不在なら `[人間確認]` で ID を決めて `moira init --me <あなた> --root <root>` を先に実行する。
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
- **チケット由来ノード**（チケット駆動の入口 — [SKILL.md](SKILL.md) 参照・エンジン汎用）: 外部チケットを
  起点に誕生するノードは `gh-<repo>-<N>` 等のチケット由来 ID 規約に従い、`--label` にチケット URL を含める。
  cc-sdd のパイプラインに合流する場合は本 §P1 の feature ノード規約が優先（URL はラベルで保持）。

---

## §P2 フェーズ → moira CLI マッピング（振り付け＋期待差分）

各フェーズの「発行イベント（順序）→ 人間ゲート → `moira show` 期待差分」。`[人間確認]` は
AskUserQuestion で確認してから。**すべての `moira add` に `--parent` 必須**（省略は hook が deny／
理由は [reference §E-1](reference.md)）。期待差分の数値は playground の実数（各フェーズ **0.5 人日**・
happy path は差し戻し無し）で示す。背骨弧との対応は §P5。

### `discovery`（`/kiro-discovery` 完了・brief.md ができた）
- 前提: `.moira/` 初期化済み（未なら `moira init --me <あなた> --root <root>`。`<root>` は `[人間確認]` で決めた ID）。
- 外部チケット起点（チケット駆動の入口 A・[SKILL.md](SKILL.md)）で合流する場合も手順は同一 —
  feature ノードの `--label` にチケット URL を含める（例: `--label "<要約> (<url>)"`）。ticket 入口側で先回り emit しない（二重誕生禁止）。
- 発行（**すべて `--actor agent:claude`・すべて `--parent` 必須**）:
  1. `moira add <feature> --parent <root> --label "<日本語>" --actor agent:claude`
  2. `moira add <feature>/req --parent <feature> --label "要件定義" --actor agent:claude`
  3. `moira add <feature>/design --parent <feature> --label "設計" --actor agent:claude`
  4. `moira add <feature>/tasks --parent <feature> --label "タスク分解" --actor agent:claude`
  5. フェーズ順序を標準依存辺として敷設（`[人間確認]` 不要 — 方法論の構造そのもの。policy は
     MODEL §4.5 R-D2 の辺種別既定を**常に明示**する — fold の未指定既定は一律 `implemented` で推論しないため）:
     - `moira relate <feature>/req <feature>/design --kind dependency --policy accepted`
     - `moira relate <feature>/design <feature>/tasks --kind dependency --policy accepted`
- 人間ゲート: なし（AI 提案の誕生・構造の敷設）。
- 期待差分: 見積カバレッジ **0%**・全 pending/proposed。（背骨 #1）

### `estimate`（spec 着手前に見積を確定）
- 前提: discovery 済み。
- 発行:
  1. 各フェーズに見積案（`moira add <feature>/<phase> --parent <feature> --estimate <n> --actor agent:claude`＝proposed）。
     **再 add でも `--parent` 必須**（[reference §E-1](reference.md)）。`--actor agent:claude` を付け discovery と actor 帰属を揃える。
  2. `[人間確認]` 合意可否 → 合意分だけ `moira agree <feature>/<phase>`（human commit）。
  3. `[人間確認]` 割当・着手予定 → 着手予定フェーズを `moira assign <feature>/<phase> --to <あなた> --slot <YYYY-MM-DD>`。
     前倒し一括でも各着手直前でもよいが、**着手ゲート（[reference §C](reference.md)）を start 前に満たす**こと。
- 人間ゲート: `agree`（見積合意）と `assign`（割当）は 5 判断 → **必ず `[人間確認]`**。
- 期待差分: **提案だけでは 0% のまま**（proposed≠agreed）。`agree` 後に見積カバレッジ **100%**（分母確定）。
  `assign --slot` を敷くと PV が立ち SPI/schedule coverage が動く（[reference §E-3](reference.md)）。（背骨 #2→#3）

### `requirements`（`/kiro-spec-requirements`）
- 着手: **着手ゲート（[reference §C](reference.md)）**充足を確認 → `moira start <feature>/req`（→ implementing）。
  未割当/未 slot なら先に `[人間確認]` で assign→slot。
- 作成完了（AI が要件定義を書き終える）: `moira done <feature>/req`（→ implemented＝**出来高獲得・EV% はここで上がる**）
  → **`moira cost <feature>/req <実工数md>`（[reference §D](reference.md) 必須）**。（背骨 #4）
- 承認（人間レビュー通過）: `moira accept <feature>/req`（→ accepted・**EV% は据え置き**＝承認は出来高を足さない）。（背骨 #7）
- 次フェーズの着手: design の start は `/kiro-spec-design` 起動時に `design` フェーズとして打つ（**前段 accept では次段を start しない**＝各フェーズが自分の start を持ち二重 start を避ける）。
- 差し戻し: `moira start <feature>/req`（implemented→implementing の後退）→ 再提出で `moira done` 再実行。
  達成率が後退し AC は残る（CPI 悪化）。（背骨 #5/#6 の弧を任意再現）
- 期待差分: 着手で exec coverage↑・**EV% は不変**（着手≠出来高）。**作成完了（done）で EV% 0%→33%**（EV_abs 0.5/分母 1.5）。承認（accept）は据え置き。

### `design` / `tasks`（`/kiro-spec-design` / `/kiro-spec-tasks`）
- requirements と同型（各フェーズの `start` はその `/kiro-spec-*` 起動時・ゲート確認後）: `start` → 作成完了で `done`（EV% 上昇）→ **`cost`（[reference §D](reference.md)）**→ 承認で `accept`（据え置き）。
- 期待差分: design 完了で **EV% 33%→67%**、tasks 完了で **67%→100%（見かけ）**。（背骨 #8・#9）
- **`tasks` 承認の帰結（核心）**: 実装ノードを**未見積**で誕生:
  - `moira add <feature>/impl-N --parent <feature> --label "実装-N" --actor agent:claude`（tasks.md の実装タスクに対応。
    タスクが1つなら impl-1、複数束ねるなら impl-1/impl-2…と分ける — §P1 の粒度）。
  - `moira add <feature>/review-impl --parent <feature> --label "実装レビュー" --actor agent:claude`。
  - 標準依存辺を敷設（各 impl-i について。policy 明示は discovery と同じ理由）:
    - `moira relate <feature>/tasks <feature>/impl-N --kind dependency --policy accepted`
    - `moira relate <feature>/impl-N <feature>/review-impl --kind dependency --policy implemented`
  - これで見かけ 100% でも見積カバレッジが **100%→<100%** に低下（正直化の入口）。（背骨 #9）
  - ※ fold は**重複辺を排除しない** — 再 emit・追いつきの前に `moira log` で既存 relate を確認する。

### `estimate-impl`（実装の見積合意）
- 発行:
  1. 実装ノード**と実装レビュー**の見積案（再 add でも `--parent` 必須・`--actor agent:claude`）:
     `moira add <feature>/impl-N --parent <feature> --estimate <n> --actor agent:claude`（impl-1,2…）、
     `moira add <feature>/review-impl --parent <feature> --estimate <n> --actor agent:claude`。
     review-impl も見積を持つ通常の作業ノード＝EV を獲得する「ノード化」経路（§P5 の注記も参照。
     省くと着手ゲートを通れず「レビュー作業も出来高」が成立しない）。
  2. `[人間確認]` → `moira agree <feature>/impl-N` … `moira agree <feature>/review-impl`（human commit）。分母が増え **達成率が正直に低下**。（背骨 #10）
  3. `[人間確認]` 割当 → `moira assign <feature>/impl-N --to agent:claude --reviewer <あなた> --slot <date>`、
     `moira assign <feature>/review-impl --to <あなた> --slot <date>`。
  4. 依存辺は tasks 節で敷設済み（§P2 tasks）— ここでは張らない（fold は重複辺を排除しない）。未敷設が判明したときのみ追いつきで張る。

### `impl`（`/kiro-impl`）
- 着手ゲート（[reference §C](reference.md)）: 各 impl と review-impl は 見積 agreed＋担当＋slot 済みで start（review-impl も estimate-impl で見積 agreed 済みゆえゲートを通る）。
- 実装（AI 作業）: `moira start <feature>/impl-N --actor agent:claude` → `moira done … --actor agent:claude`
  → **`moira cost … --actor agent:claude`（[reference §D](reference.md) 必須）**。impl ごとに繰り返す。
- 実装レビュー: `moira start <feature>/review-impl` → `moira done <feature>/review-impl` → `cost`（review-impl は見積 agreed 済みの作業ノードゆえ done で出来高を獲得する）。
- 承認: `moira accept <feature>/impl-N` … `moira accept <feature>/review-impl`（出来高は据え置き）。
- **フィーチャー完了（人間の最終サインオフ）**: 子が全 accepted になったのを確認し `moira accept <feature>`。
  背骨で唯一 feature が accepted に至る終端。feature ノードは非リーフ（rollup）ゆえ lifecycle は pending のまま最終 accept で accepted へ飛ぶ（中間状態を経ない・EV/カバレッジは葉基底ゆえ不変）。（背骨 #11）
- 期待差分: 実装完了で達成率が上がり、最後に**本物の 100%**（見積カバレッジも 100%）。

> `capacity`（容量）と `cancel`（スコープ縮小＝R-C2 sunk）は happy path の直線では**使わない**。日次容量を敷くなら
> `moira capacity <who> <date> <c>`（5 判断の容量＝`[人間確認]`）、ノードを取り止めるなら `moira cancel <node>`（スコープ判断）。

---

## §P3 発火トリガー（機械可読設定の写し）

`.claude/moira-provider.json` の `triggers` が moira-fire hook の検知規則（正本は設定側・ここは読み手向けの写し）:

| 成果物パターン | 発火 |
|---|---|
| `.kiro/specs/<feature>/spec.json` への書き込み（read: json — phase/approvals から節目を判定） | `/moira-track discovery\|requirements\|design\|tasks`（内容に応じ最も進んだ節目） |
| `.kiro/specs/<feature>/tasks.md` への書き込み（read: checkbox — 進捗を集計） | `/moira-track impl` |

セッション開始時は `moira adapter drift --json` を 1 回実行（fail-open）し、hard/needs-human があれば `/moira-track sync` を促す。
プロンプト中のチケット参照（issue URL / 意図キーワード同伴の `#N`）は UserPromptSubmit で検知され
`/moira-track ticket <ref>` が助言される（**エンジン汎用** — provider 設定の triggers ではなく hook 内蔵。ADR-0004）。

---

## §P4 drift 突き合わせ契約（`moira adapter drift` ↔ `sync` フェーズ）

`moira adapter drift` は `.kiro`（spec.json / tasks.md）と `.moira` ログを **read-only** で突き合わせる
（**emit しない** — emit は moira-track スキルだけ。実装は `moira/cli/src/adapter/`、cc-sdd 語彙は provider に閉じる）。
`sync` フェーズはこのレポートを入力に、**通常フェーズと同じゲート**で追いつき emit を振り付ける。
この表は TS 実装（`providers/cc-sdd.ts`・`drift/core.ts`）と本スキルが共有する単一の契約。

### 期待状態マッピング（provider `cc-sdd`）

| .kiro の証拠 | 期待（ノード ID 規約 §P1） | 遅れの扱い |
|---|---|---|
| `spec.json` が存在 | `<f>`・`<f>/req`・`<f>/design`・`<f>/tasks` が存在 | **hard**（discovery 未発火） |
| `approvals.<p>.generated=true`（または `phase` がそれ以降） | `<f>/<p>` ≥ implemented | **hard**（start/done 欠落） |
| `approvals.<p>.approved=true` | `<f>/<p>` = accepted | **hard**（accept 欠落） |
| `approvals.tasks.approved=true`（≒ `ready_for_implementation`） | `<f>/impl-*` が 1 つ以上 と `<f>/review-impl` が存在（**個数は不問**＝分解の深さは人間判断④） | **hard** |
| tasks.md のチェックボックス進捗 | impl-* の implemented 到達（タスク↔ノードの対応粒度は人間判断） | **advisory** |
| —（.kiro に痕跡が無い） | review-impl の完了・`<f>` の最終 accept・標準依存辺（relate はノードを生まず drift の照合対象外） | drift ではなく**次の一手**として提示 |

### ステータス分類と sync の扱い

| status | 意味 | sync の扱い |
|---|---|---|
| `missing-node` / `behind` | 成果物が含意する存在/進捗がログに無い（機械的に追いつける） | 提案チェーンを依存順に emit（**done 再生後の cost は実測を人間確認**） |
| `needs-human` | 追いつきに人間判断①（見積合意）/②（割当）が挟まる | `[人間確認]` を先に（`agree`/`assign --slot`）→ 着手ゲート充足後に続き |
| `ahead` | ログが成果物の根拠を超えて先行（口頭承認の未反映等） | 報告のみ |
| `cancelled` | moira 側で cancelled（スコープ判断③とみなす） | 報告のみ（意図的なら ignore 登録を案内） |
| `unknown-node` | どの feature 空間にも属さない（非 cc-sdd の作業単位など＝A1 射程では正当） | 報告のみ（ignore 登録を案内） |

### 導出不能なもの（drift は捏造しない）

見積値・合意（①）、担当/レビュアー/slot（②）、容量（⑤）、実測 AC、cancel（③）は `.kiro` から**導出できない**。
提案コマンドは `<md?>`／`<who?>`／`<YYYY-MM-DD?>`／`<実測md?>` のプレースホルダのまま出る — 値は人間が与える。
また、implementing 以上のノードに `assign` は**決して提案されない**（[reference §E-2](reference.md) の ready 後退地雷を suggested 側でも封じる）。

### レポート（`--json` schemaVersion 1）とエスケープ弁

- `features[].nodes[]` = `{ node, status, severity(hard|advisory), evidence, expected, actual, suggested[] }`。
  `suggested[].humanGate ∈ agree|assign|capacity|measure|null`。全体集計は `summary: { hard, advisory, needsHuman, ok }`。
- `moira adapter drift --check` は hard＋needs-human>0 で exit 1（CI 向け・advisory のみでは失敗しない）。`--feature <f>` で単一 feature に絞る。
- ノード ID 規約から外れた運用は `.moira/adapter.json` の `ignoreFeatures` / `ignoreNodes`（`<id>` 完全一致または `<prefix>/*`）で除外する。

---

## §P5 背骨弧との対応（cc-sdd 版のみの拡張節）

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
| #9 | tasks completed | `tasks` | 見かけ100%だが実装誕生で見積カバレッジ低下 | 80→96→100(見かけ)・カバレッジ 100→75% | 100(見かけ)・カバレッジ 100→<100% |
| #10 | estimate-impl agreed | `estimate-impl` | 分母増で**達成率が正直に低下**（非単調） | 100→44%・分母 12.5→28.5 | 見積次第で低下（例 100→50%台） |
| #11 | impl completed | `impl` | 実装完了→F accepted＝**本物の100%** | 44→72→93→100(本物) | 完了で上昇→本物 100% |

- **canon と cc-sdd 振り付けの木の形の差（正直な開示）**: canon は**子9葉・分母 28.5**
  （3 spec フェーズ＋そのフェーズ別レビュー3葉＋実装2＋実装レビュー1＝計9葉 — フェーズレビューを
  **ノード化**して EV を計上する参照形）。一方 **cc-sdd の本振り付けは6葉**
  （req/design/tasks/impl-N/review-impl — フェーズ承認は `accept`＝EV 中立で畳み、レビューを
  ノード化するのは実装レビューのみ）。ゆえに canon のフェーズレビュー加点弧（24→**32**・72→**80** 等）は
  cc-sdd では再現されない。**同一なのは honesty の弧**（提案≠分母・完了で稼得・承認は中立・
  実装誕生でカバレッジ低下・分母増で正直に低下・見かけ100%→本物100%）であって、木の形・分母ではない。
  review-impl のノード化は canon の「レビュー作業も出来高」経路（§7#18(b)）の cc-sdd 最小適用。
- playground の #10 以降の正確な EV% は、実装ノード数と合意見積に依存する（例値であって固定値ではない）。
