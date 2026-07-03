# Moira デモンストレーション記録（Take 3・アダプタ駆動）

> このファイルは Moira のデモセッションの記録です。ユーザーのプロンプト、Claude の処理・応答、
> 特に実行した **moira CLI コマンド**を時系列で残し、あとから見返せるようにします。
>
> - セッション開始日: **2026-07-03**（Take 3・**cc-sdd → Moira アダプタ**を使って discovery からやり直し）
> - 対象リポジトリ: `moira/examples/todo-playground`（cc-sdd × Moira 体験用 playground）
> - 記録方針: 各ステップを「① プロンプト → ② Claude の処理 → ③ 応答要旨 → ④ 実行した moira コマンドと結果」の順で残す
> - **前回までの記録は保全**: Take 1 → [`demo-log.take1.md`](demo-log.take1.md) / Take 2 → [`demo-log.take2.md`](demo-log.take2.md)。
>   両 Take で得た知見は `moira-track` スキル・playground `CLAUDE.md` に反映済み（下の「引き継ぐ規律」参照）。

---

## 目次

- [Step 0: リセット — アダプタを検証し空シードから discovery をやり直す](#step-0-リセット--アダプタを検証し空シードから-discovery-をやり直す)
- [Step 1: discovery — `/kiro-discovery "TODOアプリ"` で 1 本目の brief と Moira の空木](#step-1-discovery--kiro-discovery-todoアプリ-で-1-本目の-brief-と-moira-の空木)
- [Step 2: spec-init — `/kiro-spec-init` で spec.json / requirements.md を初期化（moira 発火なし）](#step-2-spec-init--kiro-spec-init-で-specjson--requirementsmd-を初期化moira-発火なし)
- [Step 3: estimate — `/moira-track estimate` で分母 1.5md 確定・req に着手ゲート](#step-3-estimate--moira-track-estimate-で分母-15md-確定req-に着手ゲート)
- [Step 4: requirements — `/kiro-spec-requirements` で着手→完了→AC・EV% 0%→33%](#step-4-requirements--kiro-spec-requirements-で着手完了aceV-0-33)
- [Step 5: 差し戻し — mid-demo steering 投入で要件書き直し・EV% 後退→復帰・AC 累積（背骨 #5/#6）](#step-5-差し戻し--mid-demo-steering-投入で要件書き直しeV-後退復帰ac-累積背骨-56)

---

## Take 3 が Take 2 と違うところ（アダプタの製品化）

Take 1／Take 2 では `moira-track` スキル・hooks・steering 発火表を **手でコピー**して playground に敷いていた。
Take 3 では、これらを配布・検査・突き合わせる **cc-sdd → Moira アダプタ**（`moira adapter …`）を使う。
アダプタは `moira/cli/src/adapter/` に実装され（正本テンプレートは `moira/cli/templates/`）、次の 4 サブコマンドを持つ:

| コマンド | 役割 |
|---|---|
| `moira adapter install` | skill（moira-track）／hooks（moira-guard・moira-fire）／steering 発火表を設置し、`.claude/settings.json` へ hooks を非破壊マージ。冪等。 |
| `moira adapter status` | 導入状態（バージョン・ファイル改変・settings 反映・環境）を報告。 |
| `moira adapter drift` | `.kiro`（spec.json / tasks.md）と `.moira` ログを read-only で突き合わせ、欠落・先行を報告（emit しない）。 |
| `moira adapter uninstall` | manifest 記載の未改変ファイルと注入 hooks だけを surgical に除去。 |

> 設計判断は `.kiro/adr/0002-cc-sdd-moira-adapter.md`。この Take では**アダプタは既に設置済み**なので
> `uninstall`→`install` の再設置は行わず、`status`／`drift` で健全性を検証してから discovery に入る（ユーザー指示 2026-07-03）。

---

## 取り決め（このセッション以降）

- **`/moira-track <phase>` の打鍵は Claude の責務**。ユーザーは明示的に叩かない。各 cc-sdd 節目に達したら
  Claude が自発的に記録する。
- ただし **5つの人間判断**（見積合意・割当・容量・スコープ・見積深さ）は emit 前にユーザー確認を取る。
  とくに見積合意 `moira agree` は human 限定（AI では拒否）。
- 発火の取りこぼしは **アダプタの hooks が決定的に検知**する: `moira-fire.mjs` が `.kiro/specs/**` の編集検知と
  セッション開始時の drift 注入で助言し、`moira-guard.mjs` が `--parent` 無し add を deny する。
- 取りこぼしの突き合わせ・追いつきは `/moira-track sync`（read-only の検査は `moira adapter drift`）。

### Take 1／Take 2 から引き継ぐ規律（SKILL.md / CLAUDE.md に反映済み）

過去の Take のデバッグで確立し、`moira-track` スキルと playground `CLAUDE.md` に恒久化した規律。Take 3 では最初から守る:

1. **`moira add` は常に `--parent <feature>` を明示**する（省略すると root へフォールバックし二重 decompose 辺が生まれる＝issue #5 の罠）。※アダプタの `moira-guard.mjs` が `--parent` 無し add を deny して機械的にも防ぐ。
2. **着手ゲート**: ノードを `start` する前に「見積 agreed ＋ 担当 ＋ 着手予定日(slot)」の 3 条件を満たす（未充足なら先に見積合意・割当・slot）。
3. **AC 記録**: ノードを `done` した直後に必ず `moira cost <node> <実工数md>`（実測・捏造しない・累積加算）。
4. **UI 再起動**: moira にイベントを追記したら `moira ui` を再起動（起動時スナップショットのためリロード不可）。
5. **発火トリガー早見表**（`.kiro/steering/moira-track.md`・アダプタが設置）を毎節目で参照し、発火漏れを防ぐ。

---

## Step 0: リセット — アダプタを検証し空シードから discovery をやり直す

**① ユーザーのプロンプト**

> `moira/cli/src/adapter/` 一式にアダプタを作ったので、これを使ってデモを一からやり直したい

**② Claude の処理**

- **前提の修復（アダプタ再ビルド）**: グローバル `moira` は `moira/cli` への symlink だが、リンク先の `dist/` が
  古く `moira adapter` が「unknown command」だった（`dist/adapter/` 未生成）。`moira/cli` で `npm run build`（tsc）
  → symlink 経由で即反映され、`moira adapter install|status|drift|uninstall` が有効化。
- **不可逆操作のため範囲を確認**（`AskUserQuestion`）:
  - **進める範囲** → 「リセット＋Step0 のみ」。以降は各フェーズをユーザーが `/kiro-discovery` から順に回す。
  - **アダプタの見せ方** → 「設置済みのまま検証だけ」。`uninstall`→`install` の再設置はせず `status`／`drift` で健全性確認。
- **リセット実行**:
  1. moira UI（port 5180）を停止しようとしたが、**このセッションが起動していないプロセス**のため強制終了は保護でブロック。空シードでは UI 再起動は省略可のため残置（古い UI は Take 2 の EV% 40% を表示中）。
  2. `git checkout HEAD -- .moira/events.json .moira/labels.json` → moira を discovery 前の空シードへ。
  3. `.kiro/specs/task-add-and-list/`（Take 2 の brief / requirements / spec.json）を削除。
  4. `.kiro/steering/requirements-style.md`（Take 2 の Step 5 で途中投入した mid-demo 成果）を削除 → 差し戻しの弧を今回もう一度素の状態から再現できるようにする。
  5. `demo-log.md` → `demo-log.take2.md` に退避し、本ファイル（Take 3）を新規作成。
- **Step 0 検証（アダプタは設置済みのまま）**: `moira adapter status`（全 intact・hooks 4 件反映）／`moira adapter drift`（spec 未生成ゆえ ok 0・drift なし）／`moira show`（全指標 0 の空シード）を確認。
- **保持したもの**: `.claude/skills/moira-track/`（SKILL.md / reference.md）・`.claude/hooks/`（moira-guard / moira-fire）・`.kiro/steering/moira-track.md`・`.claude/settings.json` の hooks — いずれもアダプタ設置物（manifest `.claude/.moira-adapter.json` 管理）。playground `CLAUDE.md` のプロセス改善も保持。

**③ 応答要旨**

- CLI 再ビルドで `moira adapter` が復活。アダプタは設置済み・健全（status 全 intact・drift クリーン）。
- moira は完全な空シード（`moira show` で全指標 0・ノードなし・キュー空）。spec 成果物と mid-demo steering は消去。
- 過去 Take の記録は `demo-log.take1.md` / `demo-log.take2.md` に、そこで得た規律は SKILL.md / CLAUDE.md に温存 → **同じ罠を踏まず綺麗にやり直せる状態**。
- 次アクション: `/kiro-discovery "TODOアプリ"` から再開。UI は discovery で最初のイベントが立ってから、空いたポートで起動し直す（古い 5180 は手動停止）。

**④ 実行した moira コマンド**

```bash
# 前提修復: CLI 再ビルド（dist が古く moira adapter が無効だった）
$ cd moira/cli && npm run build          # tsc → symlink 経由で global moira に即反映

# moira を最終コミットの空シードへ
$ git checkout HEAD -- .moira/events.json .moira/labels.json
$ cat .moira/events.json     # → []
$ cat .moira/labels.json     # → todo-app / you のみ

# 途中成果を削除／demo-log を退避
$ rm -rf .kiro/specs/task-add-and-list
$ rm -f  .kiro/steering/requirements-style.md
$ mv demo-log.md demo-log.take2.md

# Step 0 検証: アダプタは設置済みのまま健全性を確認
$ moira adapter status
  adapter v0.2.0（bundled v0.2.0・up-to-date） installed at 2026-07-02T13:10:08Z
  ✓ intact  .claude/skills/moira-track/SKILL.md
  ✓ intact  .claude/skills/moira-track/reference.md
  ✓ intact  .claude/hooks/moira-guard.mjs
  ✓ intact  .claude/hooks/moira-fire.mjs
  ✓ intact  .kiro/steering/moira-track.md
  ✓ settings hooks 4 件反映済み
  env: .kiro ✓ / .moira ✓

$ moira adapter drift
  Summary: hard 0 / needs-human 0 / advisory 0 / ok 0   # ← spec 未生成ゆえ突き合わせ対象なし＝クリーン

$ moira show
  EV%  0% | estimate coverage 0%   (pair-read R-S4)
  SPI  n/a | schedule coverage 0%   (pair-read R-S6)
  EV_abs 0 | PV 0 | AC 0 | CPI n/a | exec coverage 0%
  review queue [] | agent queue [] | unassigned []
  # ← ノードなし・完全な空シード（discovery 前）
```

**変更ファイル**: `.moira/events.json`（→ `[]`）, `.moira/labels.json`（→ base）, `moira/cli/dist/**`（再ビルド）
**削除**: `.kiro/specs/task-add-and-list/`（一式）, `.kiro/steering/requirements-style.md`
**退避**: `demo-log.md` → `demo-log.take2.md`
**保持**: アダプタ設置物一式（skill / hooks / steering 発火表 / settings hooks・manifest 管理）, playground `CLAUDE.md`

> メモ: UI 再起動は空シードでは省略可（次の discovery → moira-track で最初のイベントが立ってから、空いたポートで起動する）。
> 古い UI（port 5180・PID 17176・Take 2 の EV% 40% を表示中）はこのセッションからは停止できないため、discovery 開始時にユーザーが手動で停止／再起動する。

---

## Step 1: discovery — `/kiro-discovery "TODOアプリ"` で 1 本目の brief と Moira の空木

**① ユーザーのプロンプト**

> `/kiro-discovery "TODOアプリ"`

**② Claude の処理**

- **軽量スキャン**: `.kiro/specs/` は空（spec グリーンフィールド）、steering は `product.md`＋`moira-track.md`、moira は空シード（全指標 0）。
- **文脈取り込み**: steering `product.md` を精読。who/why/outcome/scope/constraints はほぼ確定済み（シンプル TODO・目的は cc-sdd フロー＋Moira 可視化の体験・単一ユーザーローカル・技術は discovery で決める・**まず 1 フィーチャーを通す**）。
- **アクションパス判定**: steering が「まず 1 フィーチャーを通す」と明示 → **Path C（単一スコープの新規フィーチャー）**。TODO 全機能の多スペック分解（Path D）は採らない。
- **人間分岐の確認**（`AskUserQuestion`・demo の弧を決める 2 点）:
  - **1 本目の範囲** → 「追加＋一覧」（feature 名 `task-add-and-list`・最小縦スライス）。完了/削除は後続スペックへ。
  - **技術スタック** → 「Vanilla TS + Vite + localStorage」（フレームワークなし・最小依存）。
- **viability**: Vite + TS + localStorage は枯れた標準スタック（活発メンテ・ライセンス問題なし・localStorage はブラウザ標準）で showstopper なし → 重量級 subagent は不要と判断し省略。
- **成果物の書き出し**（Step 7）: `Write` で `.kiro/specs/task-add-and-list/brief.md` を作成（Problem / Current State / Desired Outcome / Approach / Scope / Boundary Candidates / Out of Boundary / Upstream・Downstream / Existing Spec Touchpoints / Constraints）。境界は ドメイン層 / 永続化層(localStorage) / UI 層 の 3 継ぎ目。
- **Moira 発火**（`/moira-track discovery`・**打鍵は Claude の責務**）: discovery は 5人間判断を含まないのでそのまま emit。`todo-app` を親に `task-add-and-list`＋3 フェーズ子（req/design/tasks）を**未見積**で誕生。全 `add` に `--parent` 明示（guard の deny 回避＝issue #5 の二重辺防止）。

**③ 応答要旨**

- Path C 確定。`brief.md` をディスクに作成（継続性の source of truth）。次コマンドは `/kiro-spec-init task-add-and-list`（fast path 希望なら `/kiro-spec-quick`）。
- Moira には空木が立った: フィーチャー＋req/design/tasks が pending/proposed（未見積）で誕生。**見積カバレッジ 0%（背骨 #1）**＝分母未確定の正直な起点。EV% 0%。
- 次アクション: `/kiro-spec-init` で要件フェーズへ。着手前に `/moira-track estimate` で見積合意（見積は人間判断ゲート）。

**④ 実行した moira コマンド**

```bash
# init は既存（config: projectRoot=todo-app, me=you）ゆえ no-op

# フィーチャー＋3フェーズ子を未見積で誕生（全 add に --parent 必須）
$ moira add task-add-and-list        --parent todo-app          --label "タスクの追加と一覧" --actor agent:claude
$ moira add task-add-and-list/req    --parent task-add-and-list --label "要件定義"       --actor agent:claude
$ moira add task-add-and-list/design --parent task-add-and-list --label "設計"          --actor agent:claude
$ moira add task-add-and-list/tasks  --parent task-add-and-list --label "タスク分解"     --actor agent:claude
  + decompose todo-app → task-add-and-list (unestimated)
  + decompose task-add-and-list → task-add-and-list/{req,design,tasks} (unestimated)

$ moira show
  EV%  0% | estimate coverage 0%   (pair-read R-S4)   # ← 背骨 #1: 分母未確定の正直な起点
  SPI  n/a | schedule coverage 0%
  EV_abs 0 | PV 0 | AC 0 | CPI n/a | exec coverage 0%
  review queue [] | agent queue [] | unassigned []
  nodes: todo-app / task-add-and-list / {req,design,tasks} = 全 pending・proposed(未見積)
```

**変更ファイル**: `.moira/events.json`（→ 4 decompose イベント）
**作成**: `.kiro/specs/task-add-and-list/brief.md`

> メモ: UI はイベントが立ったので再起動対象になったが、古い UI（port 5180・PID 17176）はこのセッションから停止不可。ユーザーが手動で `kill` → `moira ui --port 5180 --no-open` するか、空きポートで起動する。

---

## Step 2: spec-init — `/kiro-spec-init` で spec.json / requirements.md を初期化（moira 発火なし）

**① ユーザーのプロンプト**

> `/kiro-spec-init task-add-and-list`

**② Claude の処理**

- spec dir は discovery が作った `brief.md` のみ → その dir を再利用。テンプレート `init.json` / `requirements-init.md` を読む。
- `brief.md` が who / current / change の 3 要素を満たすので追加質問なし。
- `Write` で `spec.json`（phase=initialized・language=ja・approvals 全 false）と `requirements.md`（Project Description を brief から充填・Requirements 本体は次フェーズ）を作成。
- **Moira 発火判断**: spec-init は cc-sdd の準備ステップで、moira の状態遷移を伴う節目**ではない**（ノード誕生は discovery で済み・次の節目は見積 `estimate`）。PostToolUse hook が discovery 発火を助言したが、discovery は Step 1 で emit 済みゆえ**追加 emit なし**。過不足なく（先回りしない）の原則に従う。

**③ 応答要旨**

- feature 名 `task-add-and-list` で spec 構造を初期化。作成: `spec.json` / `requirements.md`。
- 次コマンドは `/kiro-spec-requirements task-add-and-list`。ただし要件フェーズが実際に着手（`moira start`）するには**着手ゲート**（見積 agreed＋担当＋slot）が要る → その前に `/moira-track estimate` で見積合意（人間判断ゲート）を取る。

**④ 実行した moira コマンド**

```
（なし — spec-init は moira の発火節目ではない。次の発火は estimate）
```

**作成**: `.kiro/specs/task-add-and-list/spec.json`, `.kiro/specs/task-add-and-list/requirements.md`

---

## Step 3: estimate — `/moira-track estimate` で分母 1.5md 確定・req に着手ゲート

**① ユーザーのプロンプト**

> `/moira-track estimate`

**② Claude の処理**

- **正典値の確認**: reference.md（:204, :213-214, :64）で背骨フロー `new-feature-happy-path` の playground 値＝**各フェーズ 0.5md・分母 1.5md**（req+design+tasks）を確認し、この弧に合わせた。
- **見積提案（AI）**: `moira add <phase> --estimate 0.5 --actor agent:claude` を req/design/tasks に発行（proposed）。提案だけでは分母に入らずカバレッジは **0% のまま**（**背骨 #2**: proposed≠agreed）。
- **人間判断ゲート**（`AskUserQuestion`・5 判断の ①見積合意 ②割当）:
  - **①見積合意** → 「3フェーズとも 0.5md で合意」。
  - **②割当・slot** → 「req を **中尾** に・着手予定日は今日（2026-07-03）」。design/tasks は各フェーズ着手時に割当（各フェーズが自分の start を持つ）。
- **emit**: `moira agree` を 3 フェーズに（human commit・`--actor agent:*` を付けない＝fold が拒否）。`moira assign task-add-and-list/req --to 中尾 --slot 2026-07-03`（human commit）。
- UI 再起動（旧 PID kill → `moira ui --port 5180 --no-open`）。

**③ 応答要旨**

- **見積カバレッジ 0%→100%**（分母 1.5md 確定＝**背骨 #3**）。EV% はまだ 0%（着手・出来高はこれから）。
- req に slot が立ち **PV 0.5 / schedule coverage 33% / SPI 0.00**（baseline が引かれた）。
- **req の着手ゲート充足**（見積 agreed＋担当 中尾＋slot）→ `/kiro-spec-requirements` で `start` 可能に。design/tasks は unassigned のまま（着手時に割当）。

**④ 実行した moira コマンド**

```bash
# 見積提案（AI・proposed。カバレッジはまだ 0%）
$ moira add task-add-and-list/req    --parent task-add-and-list --estimate 0.5 --actor agent:claude
$ moira add task-add-and-list/design --parent task-add-and-list --estimate 0.5 --actor agent:claude
$ moira add task-add-and-list/tasks  --parent task-add-and-list --estimate 0.5 --actor agent:claude
  → estimate coverage 0%   # 背骨 #2: proposed≠agreed

# 見積合意（human commit・--actor agent を付けない）
$ moira agree task-add-and-list/req      # ✓ agreed [human commit]
$ moira agree task-add-and-list/design   # ✓ agreed [human commit]
$ moira agree task-add-and-list/tasks    # ✓ agreed [human commit]

# 割当＋slot（human commit・着手前に baseline を引く）
$ moira assign task-add-and-list/req --to 中尾 --slot 2026-07-03
  → assigned to human:中尾 slot 2026-07-03 [human commit]

$ moira show
  EV%  0% | estimate coverage 100%   # 背骨 #3: 分母 1.5md 確定
  SPI  0.00 | schedule coverage 33%
  EV_abs 0 | PV 0.5 | AC 0 | CPI n/a | exec coverage 0%
  review queue [] | agent queue [] | unassigned [設計, タスク分解]
```

**変更ファイル**: `.moira/events.json`（estimate×3, agree×3, assign×1）, `.moira/labels.json`（actor `中尾` 追加）

> メモ: req は着手ゲート 3 条件（見積 agreed＋担当＋slot）を満たした。design/tasks は各フェーズ着手時に assign する。

---

## Step 4: requirements — `/kiro-spec-requirements` で着手→完了→AC・EV% 0%→33%

**① ユーザーのプロンプト**

> `/kiro-spec-requirements task-add-and-list`

**② Claude の処理**

- **着手**（着手ゲート充足済み）: `moira start task-add-and-list/req` → implementing。exec coverage 0%→33% だが **EV% は 0% のまま**（着手≠出来高）。req はスペックフェーズ（人間 中尾 所有・AI 起草）ゆえ `--actor` は既定。
- **要件生成**: EARS ルール／レビューゲート／テンプレートを読み、グリーンフィールド小規模ゆえ subagent なしで直接起草。3 要件を作成:
  - Requirement 1 タスクの追加（空タイトル拒否・追加後の入力クリア含む）
  - Requirement 2 タスクの一覧表示（追加順・空状態）
  - Requirement 3 再読み込み後の永続化（復元・初回空・破損データは空扱い）
- **レビューゲート**: 機械チェック（数値ID ✓／各要件に EARS AC ✓／AC に実装言語なし＝localStorage 等を AC に書かず「保存」で観測可能に ✓）→ 判断レビュー（網羅・境界明示）→ **PASS**。`requirements.md` を書き出し、`spec.json` を phase=requirements-generated / approvals.requirements.generated=true に更新。
- **完了**: `moira done task-add-and-list/req` → implemented。**EV% 0%→33%（背骨 #4）**＝EV_abs 0.5/分母 1.5。
- **AC 記録**（人間確認・実測）: 実工数を確認 → **0.3md（見積 0.5md より早かった）** → `moira cost task-add-and-list/req 0.3`。**CPI = 0.5/0.3 ≈ 1.67** が n/a から立つ。
- UI 再起動。

**③ 応答要旨**

- 要件定義 3 本を EARS で作成・レビューゲート通過。EV% が **0%→33%** に上昇（弧の核心: 着手では上がらず done で初めて出来高）。
- CPI 1.67（見積より早く完了＝コスト効率良）。SPI 1.00（slot どおり）。
- **承認（accept）は次の人間ステップ**（背骨 #7・EV% は据え置き）。承認したら `/kiro-spec-design` で設計フェーズへ。

**④ 実行した moira コマンド**

```bash
$ moira start task-add-and-list/req      # → implementing・exec coverage 33%・EV% 0%（着手≠出来高）
$ moira done  task-add-and-list/req      # → implemented・EV% 0%→33%（背骨 #4）
$ moira cost  task-add-and-list/req 0.3  # AC 0.3md（実測・見積0.5より早い）→ CPI 1.67

$ moira show
  EV%  33% | estimate coverage 100%
  SPI  1.00 | schedule coverage 33%
  EV_abs 0.5 | PV 0.5 | AC 0.3 | CPI 1.67 | exec coverage 0%
```

**変更ファイル**: `.moira/events.json`（start, done, cost）, `.kiro/specs/task-add-and-list/requirements.md`（本体）, `.kiro/specs/task-add-and-list/spec.json`（phase=requirements-generated）

> メモ: この時点で req は implemented。人間レビュー通過で `moira accept task-add-and-list/req`（EV% 据え置き＝承認は出来高を足さない）→ design フェーズの start は `/kiro-spec-design` 起動時に行う（前段 accept で次段を start しない）。

---

## Step 5: 差し戻し — mid-demo steering 投入で要件書き直し・EV% 後退→復帰・AC 累積（背骨 #5/#6）

**① ユーザーのプロンプト**

> `V:\...\sdd-workshop\.kiro\steering\requirements-style.md`のステアリング規則をこのリポジトリにも適用し、requirements.md を修正してください

**② Claude の処理**

- **steering 規則の把握**: 親リポジトリの `requirements-style.md` を読む。規約＝Acceptance Criteria は「**英文 EARS 1 行 ＋ 直下に `- 和訳:` 1 行のペア**」で書く（散文は日本語のみ）。現状の requirements.md は英日混在（悪い例 3）で不適合。
- **弧の識別**: これは req が implemented 済みの後に新 steering が入り要件をやり直す＝**差し戻しの弧（背骨 #5/#6）**。moira では req を `start` で後退→書き直し→再 `done`→rework 分 AC を累積。
- **① steering 設置**: `Write` で `.kiro/steering/requirements-style.md` を playground に作成（適用開始節のみ本リポジトリ向けに調整）。
- **② 後退**: `moira start task-add-and-list/req`（implemented→implementing）。**EV% 33%→0%**・ただし **AC 0.3 は残存** → CPI 0.00（**背骨 #5**: やり直しでも払ったコストは消えない）。
- **③ 書き直し**: requirements.md の全 AC を英文 EARS＋和訳併記へ改訂（要件の意味は不変・書式のみ）。レビューゲート再通過。
- **④ 再完了**: `moira done task-add-and-list/req`（→ implemented）。**EV% 0%→33% に復帰**（旧 AC 0.3 のまま一時 CPI 1.67）。
- **⑤ rework AC 累積**（人間確認・実測）: 追加工数を確認 → **+0.1md**（累計 0.4md）→ `moira cost task-add-and-list/req 0.1`（id 重複排除つき加算）。**CPI 1.67→1.25**（**背骨 #6**: 手戻りコストが正直に効率へ反映）。
- UI 再起動。

**③ 応答要旨**

- steering 規則を playground に設置し、requirements.md を英文 EARS＋和訳併記へ書き直した。
- Moira の弧: **EV% 33→0→33**（後退して復帰）、**AC 0.3→0.4**（rework 分を累積）、**CPI 1.67→0.00→1.25**（手戻りで効率が正直に悪化）。SPI 1.00 は不変（slot どおり）。
- 「見かけ上は同じ 33% でも、CPI が 1.67→1.25 に落ちた」＝**やり直しは達成率を戻せてもコスト効率には傷を残す**という正直さが可視化された。
- req は再び implemented。人間レビュー通過で `moira accept` → design フェーズへ。

**④ 実行した moira コマンド**

```bash
# ② 後退（差し戻し）
$ moira start task-add-and-list/req      # implemented→implementing・EV% 33%→0%・AC 0.3 残存・CPI 0.00（背骨 #5）

# （requirements.md を英文EARS+和訳へ書き直し）

# ④ 再完了
$ moira done  task-add-and-list/req      # →implemented・EV% 0%→33% 復帰

# ⑤ rework AC 累積（実測・加算）
$ moira cost  task-add-and-list/req 0.1  # AC 0.3+0.1=0.4 → CPI 1.67→1.25（背骨 #6）

$ moira show
  EV%  33% | estimate coverage 100%
  SPI  1.00 | schedule coverage 33%
  EV_abs 0.5 | PV 0.5 | AC 0.4 | CPI 1.25 | exec coverage 0%
```

**変更ファイル**: `.moira/events.json`（start, done, cost）, `.kiro/specs/task-add-and-list/requirements.md`（AC を英文 EARS+和訳へ）
**作成**: `.kiro/steering/requirements-style.md`（playground へ規則設置）

> メモ: 差し戻しは lifecycle を後退させ EV% を一時的に落とすが、AC は累積されるため戻ってきた後の CPI は元より低い（1.67→1.25）。これが「達成率 100% でも本当に無傷か」を CPI が別軸で正直に示す弧。

---

<!--
  追記テンプレート（コピーして使う）:

  ## Step N: <タイトル>

  **① ユーザーのプロンプト**

  > <プロンプト全文>

  **② Claude の処理**

  - <処理内容・呼んだスキル・判断>

  **③ 応答要旨**

  - <応答の要点>

  **④ 実行した moira コマンド**

  ```bash
  $ moira <...>
  <出力の要点>
  ```
-->
