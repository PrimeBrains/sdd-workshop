# Moira デモンストレーション記録

> このファイルは Moira のデモセッションの記録です。ユーザーのプロンプト、Claude の処理・応答、
> 特に実行した **moira CLI コマンド**を時系列で残し、あとから見返せるようにします。
>
> - セッション開始日: **2026-07-01**
> - 対象リポジトリ: `moira/examples/todo-playground`（cc-sdd × Moira 体験用 playground）
> - 記録方針: 各ステップを「① プロンプト → ② Claude の処理 → ③ 応答要旨 → ④ 実行した moira コマンドと結果」の順で残す

---

## 目次

- [Step 0: 記録ファイルの作成](#step-0-記録ファイルの作成)
- [Step 1: /kiro-discovery "TODOアプリ"](#step-1-kiro-discovery-todoアプリ)
- [Step 2: moira-track discovery（背骨 #1）](#step-2-moira-track-discovery背骨-1)
- [Step 3: moira ui 再起動](#step-3-moira-ui-再起動)
- [Step 4: moira-track estimate（背骨 #2・#3）](#step-4-moira-track-estimate背骨-23)
- [Step 5: 二重行の不具合診断と復旧（issue #5）](#step-5-二重行の不具合診断と復旧issue-5)
- [Step 6: moira-track スキルの修正（罠の根治）](#step-6-moira-track-スキルの修正罠の根治)
- [Step 7: /kiro-spec-requirements（着手・背骨 #4 前半）](#step-7-kiro-spec-requirements着手背骨-4-前半)
- [Step 8: 要件表記を steering スタイルへ修正（EARS 英日併記）](#step-8-要件表記を-steering-スタイルへ修正ears-英日併記)
- [Step 9: 要件定義の承認 → EV% 0%→33%（背骨 #4）](#step-9-要件定義の承認--ev-033背骨-4)
- [Step 10: スケジュールを敷いて PV を立てる（設計・タスク分解の着手予定）](#step-10-スケジュールを敷いて-pv-を立てる設計タスク分解の着手予定)
- [Step 11: 着手ゲートを moira-track スキルに追加（未見積・未割当・未スケジュールなら start しない）](#step-11-着手ゲートを-moira-track-スキルに追加未見積未割当未スケジュールなら-start-しない)
- [Step 12: AC（実コスト）記録を義務化（done とセットで必ず moira cost）](#step-12-ac実コスト記録を義務化done-とセットで必ず-moira-cost)
- [Step 13: 発火トリガー早見表を CLAUDE.md に集約（発火漏れ防止）](#step-13-発火トリガー早見表を-claudemd-に集約発火漏れ防止)
- [Step 14: /kiro-spec-design（着手・設計生成／背骨 #5 前半）](#step-14-kiro-spec-design着手設計生成背骨-5-前半)

---

## 取り決め（このセッション以降）

- **`/moira-track <phase>` の打鍵は Claude の責務**。ユーザーは明示的に叩かない。各 cc-sdd 節目に達したら
  Claude が自発的に記録する（2026-07-01 ユーザー指示）。
- ただし **5つの人間判断**（見積合意・割当・容量・スコープ・見積深さ）は emit 前にユーザー確認を取る。
  とくに見積合意 `moira agree` は human 限定（AI では拒否）。

---

## Step 0: 記録ファイルの作成

**① ユーザーのプロンプト**

> これからmoiraのデモンストレーションを実施します。このセッションにおける私のプロンプトと、あなたの処理と応答、特にmoiraのcliコマンドをマークダウンファイルに記録して、あとで見返せるようにしたい。まずは記録用のファイルを作成して

**② Claude の処理**

- このデモ記録ファイル `demo-log.md` を `todo-playground` 直下に作成。
- 以降の各ステップをこのファイルに追記していく方針を確立。

**③ 応答要旨**

- 記録用テンプレートを用意。次のプロンプトから、プロンプト／処理／応答／moira コマンドを構造化して追記していく。

**④ 実行した moira コマンド**

- （なし）

---

## Step 1: /kiro-discovery "TODOアプリ"

**① ユーザーのプロンプト**

> `/kiro-discovery TODOアプリ`

**② Claude の処理**

- `kiro-discovery` スキルを起動。軽量スキャン（Step 1）を実行:
  - `.kiro/specs/*/spec.json` → 該当なし（グリーンフィールド）
  - `.kiro/steering/` → `product.md` のみ存在
  - `.moira/` → 初期化済み（`events.json` ほか空のイベント列）
- steering `product.md` と `README.md` を読み込み、製品像を確認。
- **アクションパス判定 = Path C（単一スコープの新規フィーチャー）**。
- product.md が discovery に委ねている 2 決定（技術スタック・初回スコープ）を `AskUserQuestion` で確認。
  - 技術スタック → **React + Vite + localStorage**
  - 初回スコープ → **追加 + 一覧**
- フィーチャー名を **`task-add-and-list`** に決定し、`.kiro/specs/task-add-and-list/brief.md` を作成。

**③ 応答要旨**

- グリーンフィールド確認 → Path C。React + Vite + localStorage / 「追加 + 一覧」で確定。
- brief.md を作成（Problem / Approach / Scope In-Out / Boundary Candidates / Constraints）。
- 次アクション: `/kiro-spec-init task-add-and-list`。その前後で `/moira-track discovery` を呼ぶ規約。

**④ 実行した moira コマンド**

- （なし — discovery フェーズでは moira への記録は次の `/moira-track discovery` で行う）

---

## Step 2: moira-track discovery（背骨 #1）

**① ユーザーのプロンプト**

> （明示指示なし）取り決めにより Claude が discovery 完了の節目を自発的に記録。
> 直前のユーザー指示: 「moira-trackは私が明示的にたたくことなく、あなたのほうで節目ごとに打鍵する責務を負ってほしい」

**② Claude の処理**

- `moira-track` スキルを `discovery --feature task-add-and-list` で起動。
- CLI 稼働確認（`moira help`）／`.moira/config.json`（me=you, root=todo-app）／`events.json`（空）を点検。
- `moira init`（既存につき no-op）→ フィーチャー＋3フェーズ子ノードを未見積で誕生（actor=agent:claude）。
- `moira show` で discovery 節目の状態を確認。

**③ 応答要旨**

- 背骨 #1 の状態を再現: フィーチャー `task-add-and-list` ＋ req/design/tasks の3フェーズが**未見積**で誕生。
- **見積カバレッジ 0% / EV% 0%**、全ノード pending・proposed。分母（見積）はまだ無い。

**④ 実行した moira コマンド**

```bash
$ moira help                        # CLI 稼働確認（exit 0）
$ moira init --me you --root todo-app
.moira/ already exists here — nothing to do.

$ moira add task-add-and-list       --parent todo-app          --label "タスクの追加と一覧" --actor agent:claude
$ moira add task-add-and-list/req    --parent task-add-and-list --label "要件定義"           --actor agent:claude
$ moira add task-add-and-list/design --parent task-add-and-list --label "設計"               --actor agent:claude
$ moira add task-add-and-list/tasks  --parent task-add-and-list --label "タスク分解"         --actor agent:claude
+ decompose todo-app → task-add-and-list (unestimated)
+ decompose task-add-and-list → task-add-and-list/req (unestimated)
+ decompose task-add-and-list → task-add-and-list/design (unestimated)
+ decompose task-add-and-list → task-add-and-list/tasks (unestimated)

$ moira show
Moira — derived snapshot @ 2026-07-01   (TODO アプリ（playground）)
  EV%  0% | estimate coverage 0%   (pair-read R-S4)
  SPI  n/a | schedule coverage 0%   (pair-read R-S6)
  EV_abs 0 | PV 0 | AC 0 | CPI n/a | exec coverage 0%
  review queue [] | agent queue [] | unassigned []
nodes:
  pending  proposed  タスクの追加と一覧 (task-add-and-list)
  pending  proposed  設計 (task-add-and-list/design)
  pending  proposed  要件定義 (task-add-and-list/req)
  pending  proposed  タスク分解 (task-add-and-list/tasks)
  pending  proposed  TODO アプリ（playground） (todo-app)
```

---

## Step 3: moira ui 再起動

**① ユーザーのプロンプト**

> ui反映されていないので再起動して

**② Claude の処理**

- 原因特定: `moira ui` は起動時に `repo.loadEvents()` を読み込んで静的に焼き込む（`injectFixture`）設計。
  → 既存サーバは discovery 前の空イベント列を掴んだままで、新イベントが反映されない。
- 稼働プロセスを特定: PID 28856 が port **5180**（既定ポート）で待ち受け。
- 旧サーバを停止（`taskkill //F //PID 28856`）→ ポート解放を確認。
- 新イベント列を焼き込んだサーバを **同一 port 5180** でバックグラウンド再起動（`--no-open` で重複タブ回避）。

**③ 応答要旨**

- 旧 PID 28856 停止 → 新 PID 21332 が 5180 で稼働。起動ログに `4 events` を確認（discovery の4イベント）。
- ブラウザ http://localhost:5180 を再読み込みで反映。

**④ 実行した moira コマンド**

```bash
$ taskkill //F //PID 28856          # 旧 moira ui サーバ停止（port 5180 解放）

$ moira ui --port 5180 --no-open    # 新イベント列を焼き込んで再起動（バックグラウンド）
Moira dashboard → http://localhost:5180   (asOf=2026-07-01, 4 events)
Press Ctrl+C to stop.
# → PID 21332 が 5180 で LISTENING
```

> メモ: `moira ui` は起動時スナップショット。イベントを追記したら **その都度リロードではなく再起動**が必要。
> 以降 `/moira-track` を回すたびに UI を最新化するには、同じ手順（旧サーバ停止 → `moira ui` 再起動）を踏む。

---

## Step 4: moira-track estimate（背骨 #2・#3）

**① ユーザーのプロンプト**

> 見積提案して
> （AskUserQuestion への回答）「すべて0.5MDずつにしましょう」

**② Claude の処理**

- `moira-track` の estimate 振り付け。まず req/design/tasks を **各 1 人日**で提案 emit（actor=agent:claude）。
  → `moira show` で **提案しても見積カバレッジは 0% のまま**（proposed ≠ agreed）を確認・提示。
- 「見積合意」は 5 人間判断のひとつ・`moira agree` は human 限定のため、AskUserQuestion で合意可否を確認。
- ユーザーが「すべて 0.5MD ずつ」に調整 → **0.5 で提案し直し**、その値で `moira agree`（human commit）を実行。
- `moira show` で分母確定を確認。

**③ 応答要旨**

- 背骨 #2（提案）→ #3（合意）の弧を再現。**見積カバレッジ 0%→100%**、3フェーズが `agreed`。
- **EV% は 0% のまま**（分母は確定したが未完了＝正直）。schedule coverage は割当前なので 0%、未割当キューに3件。

**④ 実行した moira コマンド**

```bash
# --- 最初の提案（各1人日）: カバレッジは動かない（提案≠合意）---
$ moira add task-add-and-list/req    --estimate 1 --actor agent:claude
$ moira add task-add-and-list/design --estimate 1 --actor agent:claude
$ moira add task-add-and-list/tasks  --estimate 1 --actor agent:claude
$ moira show
  EV%  0% | estimate coverage 0%      # ← proposed のまま。分母は増えない

# --- ユーザー調整（0.5MD）で提案し直し → 合意（human commit）---
$ moira add task-add-and-list/req    --estimate 0.5 --actor agent:claude
$ moira add task-add-and-list/design --estimate 0.5 --actor agent:claude
$ moira add task-add-and-list/tasks  --estimate 0.5 --actor agent:claude
$ moira agree task-add-and-list/req       # ← human 限定（AIでは拒否）
$ moira agree task-add-and-list/design
$ moira agree task-add-and-list/tasks
✓ agreed estimate task-add-and-list/req [human commit]
✓ agreed estimate task-add-and-list/design [human commit]
✓ agreed estimate task-add-and-list/tasks [human commit]

$ moira show
  EV%  0% | estimate coverage 100%   (pair-read R-S4)   # ← 分母確定
  SPI  n/a | schedule coverage 0%    (pair-read R-S6)
  review queue [] | agent queue [] | unassigned [設計, 要件定義, タスク分解]
nodes:
  pending  proposed  タスクの追加と一覧 (task-add-and-list)
  pending  agreed    設計 (task-add-and-list/design)
  pending  agreed    要件定義 (task-add-and-list/req)
  pending  agreed    タスク分解 (task-add-and-list/tasks)
  pending  proposed  TODO アプリ（playground） (todo-app)
```

> 学び: **提案（proposed）は分母に入らない。人間の合意（agreed）で初めてカバレッジが立つ。**
> 「見かけ上いつでも見積済みに見える」ごまかしを、estimate-agreement が構造的に防いでいる。

---

## Step 5: 二重行の不具合診断と復旧（issue #5）

**① ユーザーのプロンプト**

> https://github.com/PrimeBrains/sdd-workshop/issues/5　おそらくdecompose辺の貼り方をミスっていて、
> 要件定義、設計、タスク分解の行が複数出てしまっています

**② Claude の処理（根本原因分析）**

- `gh issue view 5` と `.moira/events.json` を突き合わせて診断。
- **根本原因 = 私の打鍵ミス**: Step 4 の estimate 提案で `moira add task-add-and-list/req --estimate 1`（および 0.5）を
  **`--parent` 省略**で実行 → 親がプロジェクト根 `todo-app` にフォールバックし、`todo-app → .../req` という
  **2本目の decompose 辺**が6件（e5–e10）生成された。
- 各フェーズノードが「feature 配下」と「root 直下」に**二重に木へ出現** → UI で行が重複。
  `moira show` はフラット表示（node id で dedup）のため見えなかった。
- **切り分け**: estimate も parent ポインタも latest-wins のため**メトリクスは無傷**（100%/0% は正）。壊れたのは木の描画のみ。
- **issue #5 と一致**: append-only は意図的設計だが、**decompose 辺を打ち消す補償イベントが無い**
  （`fold.ts` は `childrenOf` に追記のみ・除去なし／`relate --remove` は dependency・supersede 辺のみ）。
  補償手段の被覆漏れ。issue #5 の「発見元」がまさにこの playground フロー。

**③ 応答要旨・復旧**

- ユーザー選択 = **「seed から全再生」**（issue #5 が小規模ログの唯一の回復策と明記）。
- 壊れたログを `.moira/events.broken.json` に証拠退避 → `events.json` を seed `[]` に戻す →
  **全 `moira add` に `--parent` を付けて**再実行（discovery 4件 + estimate 0.5 の3件 + agree 3件 = 10 events）。
- 検証: `"parent": "todo-app"` は feature ノード自身の1件だけ（正）。req/design/tasks は `task-add-and-list` 配下のみ。
  **二重辺消滅・メトリクス不変（EV% 0% / カバレッジ 100%）**。UI 再起動で反映。

**④ 実行した moira コマンド**

```bash
$ gh issue view 5 --repo PrimeBrains/sdd-workshop   # 診断: 既知の設計ギャップと一致

# --- 復旧: seed から全再生 ---
$ cp .moira/events.json .moira/events.broken.json   # 壊れたログを証拠退避（append-only 外の操作＝seed復旧のみ許容）
$ printf '[]\n' > .moira/events.json                # seed に戻す

# discovery 再生（★今度は全て --parent を付ける）
$ moira add task-add-and-list        --parent todo-app          --label "タスクの追加と一覧" --actor agent:claude
$ moira add task-add-and-list/req    --parent task-add-and-list --label "要件定義"           --actor agent:claude
$ moira add task-add-and-list/design --parent task-add-and-list --label "設計"               --actor agent:claude
$ moira add task-add-and-list/tasks  --parent task-add-and-list --label "タスク分解"         --actor agent:claude
# estimate 0.5 再生（★--parent を付ける）
$ moira add task-add-and-list/req    --parent task-add-and-list --estimate 0.5 --actor agent:claude
$ moira add task-add-and-list/design --parent task-add-and-list --estimate 0.5 --actor agent:claude
$ moira add task-add-and-list/tasks  --parent task-add-and-list --estimate 0.5 --actor agent:claude
# agree（human commit）
$ moira agree task-add-and-list/req
$ moira agree task-add-and-list/design
$ moira agree task-add-and-list/tasks

$ moira show
  EV%  0% | estimate coverage 100%   (pair-read R-S4)   # ← メトリクス不変
  unassigned [設計, 要件定義, タスク分解]
# 検証: grep '"parent": "todo-app"' → feature ノード自身の1件のみ（二重辺なし）

# UI 再起動
$ taskkill //F //PID <old>
$ moira ui --port 5180 --no-open     # → 10 events（クリーン）
```

> 学び①: **`moira add` で既存ノードを再度触るときも `--parent` を必ず付ける**。省略すると root にフォールバックし
> 二重 decompose 辺が生まれる。moira-track スキルの estimate 手順（`moira add <feature>/<phase> --estimate <n>`）は
> `--parent` を省いた例示になっており、**この playground でハマる罠**。→ スキル側の改善余地（issue #5 と併せて）。
> 学び②: append-only では decompose 辺の誤投入は**補償イベントが無く**、小規模ログは seed 全再生でしか直せない（issue #5）。

---

## Step 6: moira-track スキルの修正（罠の根治）

**① ユーザーのプロンプト**

> A. moira-track スキルの修正

**② Claude の処理**

- `.claude/skills/moira-track/SKILL.md` で `--parent` を省いた `moira add ... --estimate` 例示を grep（2箇所ヒット）。
  - 行55: `estimate` 手順の `moira add <feature>/<phase> --estimate <n>`
  - 行75: `estimate-impl` 手順の `moira add <feature>/impl-1 --estimate <n>`
- 両方に `--parent <feature>` を追加。加えて:
  - `estimate` 手順に ⚠ 注記（再 add でも `--parent` 必須／省略で root 二重辺／issue #5）を追加。
  - Critical Constraints に一般則「**`add` は常に `--parent` を明示**」を1項追加。
- SKILL.ja.md は存在せず（このスキルは SKILL.md 単一）、同期対象なし。

**③ 応答要旨**

- 罠を根治。今後 `/moira-track estimate` / `estimate-impl` を回すと、例示どおり打鍵しても二重辺が生じない。
- 併せて moira 本体の根治（issue #5 の補償イベント）は別タスク（moira-model-update 経由）として温存。

**④ 実行した moira コマンド**

- （なし — スキル文書の修正のみ。moira イベントの追記は無し）

**変更ファイル**: `.claude/skills/moira-track/SKILL.md`（estimate 例＋⚠注記／estimate-impl 例／Critical Constraints 1項）

---

## Step 7: /kiro-spec-requirements（着手・背骨 #4 前半）

**① ユーザーのプロンプト**

> `/kiro-spec-requirements task-add-and-list`

**② Claude の処理**

- 責務として先に moira-track の **requirements（着手）** を記録: `moira start task-add-and-list/req`（→ implementing）。
- kiro-spec-requirements スキルを実行。ears-format / review-gate / requirements テンプレを読み込み。
- spec.json が未作成（/kiro-spec-init を飛ばした）と判明 → init.json テンプレから **spec.json を新規作成**
  （language=ja、phase=requirements-generated、requirements.generated=true）。
- brief.md + product.md から requirements.md を生成（EARS・日本語）。レビューゲート通過:
  数値ID / 各要件に受け入れ基準 / 実装用語なし（localStorage 等を「端末内に保存」へ）/ 網羅 / 境界明示。
- `moira show` で状態確認 → UI 再起動。

**③ 応答要旨**

- 要件4本を生成: (1) 追加 (2) 一覧表示 (3) 永続化 (4) 応答性。境界（In/Out/Adjacent）を明示。
- Moira: req が **implementing**、**exec coverage 0%→33%**（1/3 が実行中）。ただし **EV% は 0% のまま**
  ＝「着手＝実行中であって、まだ出来高は稼いでいない」。**done/accept は人間の承認後**（次ステップ）。

**④ 実行した moira コマンド**

```bash
$ moira start task-add-and-list/req        # 要件定義の着手（→ implementing）
• task-add-and-list/req → implementing

$ moira show
  EV%  0% | estimate coverage 100%
  EV_abs 0 | PV 0 | AC 0 | CPI n/a | exec coverage 33%   # ← 0%→33%（1/3 実行中）
  unassigned [設計, 要件定義, タスク分解]
  implementing agreed  要件定義 (task-add-and-list/req)   # ← implementing に

$ taskkill //F //PID <old>; moira ui --port 5180 --no-open   # → 11 events
```

**生成ファイル**: `.kiro/specs/task-add-and-list/requirements.md`, `.kiro/specs/task-add-and-list/spec.json`

> 学び: **exec coverage（実行中）と EV%（達成率）は別物**。着手で exec は上がるが、達成率は 0% のまま。
> EV% が上がるのは **人間が承認して done/accept が入る瞬間**（背骨 #4 後半）。「やり始めた ≠ 稼いだ」。

---

## Step 8: 要件表記を steering スタイルへ修正（EARS 英日併記）

**① ユーザーのプロンプト**

> V:\...\sdd-workshop\.kiro\steering\requirements-style.md にしたがって表記を修正して

**② Claude の処理**

- ワークスペース根の steering `requirements-style.md` を読み込み（※ playground ではなく sdd-workshop 直下）。
- 規約: EARS は形式の決定性のため**英文**で書き、直後に `- 和訳:` を 1 レベル下げて併記。
  Introduction / Objective / Boundary Context は日本語のみで可。`shall` 訳は spec 内で統一。
- 現状の受け入れ基準は「英文トリガー語＋日本語変数部の混在」（規約の❌悪い例3）と判明 → 全 AC を
  **「英文 EARS 1行 ＋ `- 和訳:` 1行」ペア**に書き換え（`shall`=「する」で統一）。
- spec.json の updated_at を更新。phase/approvals は不変（requirements-generated / 未承認）。

**③ 応答要旨**

- requirements.md の全 Acceptance Criteria（R1×5・R2×4・R3×3・R4×2）を英日併記に修正。散文は日本語のまま。
- レビュー継続中の修正（req は implementing のまま）＝ **moira イベントなし・EV% 不変**。差し戻しではなく生成前の整形。

**④ 実行した moira コマンド**

- （なし — 要件文書の表記修正のみ。moira の状態は変化なし）

**変更ファイル**: `.kiro/specs/task-add-and-list/requirements.md`（表記）, `spec.json`（updated_at）

> メモ: このスタイルはリポジトリの steering が記録済みのため恒久メモリには保存しない（重複回避）。

---

## Step 9: 要件定義の承認 → EV% 0%→33%（背骨 #4）

**① ユーザーのプロンプト**

> 承認

**② Claude の処理**

- 人間の承認を受け、責務として moira-track の **requirements（承認）** を実行。
- spec.json を `phase: requirements-approved` / `approvals.requirements.approved: true` に更新。
- `moira done task-add-and-list/req`（→ implemented＝出来高獲得）→ `moira accept task-add-and-list/req`（→ accepted）。
- 実工数（cost）は未計測のため skip（AC=0・CPI=n/a のまま。捏造しない）。
- `moira show` で EV% 上昇を確認 → UI 再起動。
- **設計の start は保留**: 各フェーズの `moira start` は、その kiro コマンド（`/kiro-spec-design`）起動時に打つ方針で
  統一（req も `/kiro-spec-requirements` 起動時に start した）。承認時点では design を start しない。

**③ 応答要旨**

- **EV% 0% → 33%**（EV_abs 0.5 / 分母 1.5）＝正直な弧の最初の上昇。req は accepted。
- exec coverage は 0% に戻る（実行中ノードなし）。design/tasks は未着手・agreed のまま。

**④ 実行した moira コマンド**

```bash
$ moira done task-add-and-list/req      # 出来高獲得（→ implemented）
• task-add-and-list/req → implemented
$ moira accept task-add-and-list/req    # 承認（→ accepted）
• task-add-and-list/req → accepted

$ moira show
  EV%  33% | estimate coverage 100%   (pair-read R-S4)   # ← 0%→33%
  EV_abs 0.5 | PV 0 | AC 0 | CPI n/a | exec coverage 0%
  accepted     agreed  要件定義 (task-add-and-list/req)   # ← accepted に

$ taskkill //F //PID <old>; moira ui --port 5180 --no-open   # → 13 events
```

**変更ファイル**: `.kiro/specs/task-add-and-list/spec.json`（phase / requirements.approved）

> 学び: **承認＝人間の手番で初めて EV% が動く**（0%→33%）。着手（exec coverage）では達成率は動かなかった。
> 「差し戻しは無償でない／承認で初めて稼ぐ」という正直な弧が、ここで数値として立ち上がった。

---

## Step 10: スケジュールを敷いて PV を立てる（設計・タスク分解の着手予定）

**① ユーザーのプロンプト**

> 要件定義のスケジュールを立てて、PVを出したい

**② Claude の処理**

- PV 導出仕様を確認（`backend/src/derivations/pv.ts` / `coverage.ts` / `ev.ts`、`cli/src/emit.ts` / `commands.ts`）。
  **PV = Σ（agreed かつ 着手予定日(frozenSlot)≠null かつ frozenSlot≤asOf のリーフの frozenBudget）**。
  → **着手予定日(slot)を敷いて初めて PV が立つ**。
- **要注意の発見**: 要件定義(req)は既に `accepted`。素直に `moira assign` を打つと壊れる:
  - CLI の `assign` は lifecycle を必ず `ready` に落とす（`emit.ts:75` の `to ?? 'ready'`・宛先フラグ無し）。
  - EV_abs は `reachedImplemented` ラッチではなく**現 lifecycle**で判定（`ev.ts:24`）。
  - → req が `accepted`→`ready` に後退し **EV% が 33%→0%** に落ちる（再 done/accept が必要・弧が乱れる）。
  - さらに「**完了したのに未スケジュール → EV_abs には入るが PV には入れない**」はモデルの意図的な正直さ（`pv.ts:9`）。
- → **正直な筋 = これから着手する design/tasks に着手予定日を敷く（baseline を先に引く）。req は触れない。**
- スケジュール＝**割当は5人間判断のひとつ**。`AskUserQuestion` で確認 → **Option A（設計=今日 / タスク=明日、担当=you）**確定。

**③ 応答要旨**

- design slot=2026-07-01（今日 ≤ asOf）→ PV に算入。tasks slot=2026-07-02（明日 > asOf）→ 今はまだ PV 外。
- 結果: **PV 0→0.5 / SPI n/a→1.00 / schedule coverage 0%→67%**。**EV% は 33% 維持**（req 不変）。
  design/tasks は lifecycle `ready` へ。未割当キューは `[要件定義]` のみ（req は agreed だが未スケジュール＝正直）。

**④ 実行した moira コマンド**

```bash
# --- 割当＋着手予定（human commit）。req は accepted のため触れない ---
$ moira assign task-add-and-list/design --to you --slot 2026-07-01
→ assigned task-add-and-list/design to human:you slot 2026-07-01 [human commit]
$ moira assign task-add-and-list/tasks  --to you --slot 2026-07-02
→ assigned task-add-and-list/tasks to human:you slot 2026-07-02 [human commit]

$ moira show
  EV%  33% | estimate coverage 100%   (pair-read R-S4)
  SPI  1.00 | schedule coverage 67%   (pair-read R-S6)   # ← PV 0→0.5 / SPI n/a→1.00 / cov 0→67%
  EV_abs 0.5 | PV 0.5 | AC 0 | CPI n/a | exec coverage 0%
  review queue [] | agent queue [] | unassigned [要件定義]
  ready      agreed  設計 (task-add-and-list/design)      # ← ready に
  accepted   agreed  要件定義 (task-add-and-list/req)      # ← 不変（触れていない）
  ready      agreed  タスク分解 (task-add-and-list/tasks)   # ← ready に（slot=明日）

# UI 再起動（15 events）
$ taskkill //F //PID 13068 ; moira ui --port 5180 --no-open   # → 15 events
```

**変更ファイル**: （なし — moira イベントの追記のみ。spec 文書は不変）

> 学び①: **PV は「着手予定日(slot)を敷く」ことで立つ**。見積合意(agreed)は EV% の**分母**、slot は **baseline(PV)**——役割が別物。
> 学び②: **完了済みノードは後追いでスケジュールできない**。CLI の `assign` が lifecycle を `ready` に戻すため EV% が後退し、
> モデルも「completed-but-never-scheduled は PV から除外」と正直に扱う（`pv.ts:9`）。だから **baseline は着手前に引く**のが筋。
> req が PV に入らないことは **schedule coverage 67%（<100%）が正直に告げている**（SPI は R-S6 でこのカバレッジと対で読む）。

---

## Step 11: 着手ゲートを moira-track スキルに追加（未見積・未割当・未スケジュールなら start しない）

**① ユーザーのプロンプト**

> （前プロンプトを interrupt）見積、担当割り当て、スケジュールをしないとタスクに着手できないようにしてほしい
> `.claude\skills\moira-track\SKILL.md` にルール足せばいいのかな？ moira はここでは修正しない

**② Claude の処理**

- 方針確認: **moira エンジンは順序を強制しない**（追記専用・任意順で `start` を受理する）。ゆえに「見積→割当→
  スケジュール→着手」という順序規律は **moira-track スキル層のゲート**として敷くのが正しい（MODEL/CLI は触らない）。
- ゲートが機械チェック可能かを `moira show --json` で確認（イベント追記なし・読み取りのみ）:
  - 見積 agreed → `nodeStates[].estimate === "agreed"`
  - 担当あり → `unassignedBacklog` に `<node>` を含まない
  - slot あり → `forecast[].frozenSlot !== null`
- `.claude/skills/moira-track/SKILL.md` を編集（計 7 箇所）:
  - **新設「着手ゲート（`start` の不変条件）」節**（3 条件＋チェック表＋「なぜスキル層か」）。
  - Success Criteria に着手ゲート 1 項。
  - `estimate` 手順 3 を「着手予定フェーズを assign（前倒し可）／着手ゲートを start 前に満たす」に一般化。
  - `requirements` / `design` / `tasks` / `impl` の各 `start` にゲート参照を追記。
  - Critical Constraints に「計画してから着手（着手ゲート）」1 項。

**③ 応答要旨**

- 「見積→割当→スケジュール→着手」を **`start` 前の不変条件（着手ゲート）** としてスキルに明文化。**moira は無改修**。
- 今後 `/moira-track requirements|design|tasks|impl` は、`start` 前に `moira show --json` で 3 条件を確認し、
  未充足なら先に満たす（割当・slot は 5 判断の「割当」＝人間確認）。
- これは Step 10 で判明した「req が未スケジュールのまま accepted → PV が立たない（completed-but-never-scheduled は
  PV 除外）」の再発を、着手前に構造的に防ぐ。

**④ 実行した moira コマンド**

```bash
$ moira show --json    # 調査のみ（イベント追記なし）。着手ゲートのチェック元を確認:
                       #   nodeStates[].estimate / unassignedBacklog / forecast[].frozenSlot
```

**変更ファイル**: `.claude/skills/moira-track/SKILL.md`（「着手ゲート」節を新設＋Success Criteria / Critical Constraints / `estimate` 手順 /各 `start` 手順に反映）

> 学び: moira の「順序非強制」は意図的（追記専用・latest-wins）。**「計画してから着手」という規律は、モデルの不変条件
> ではなくワークフロー（スキル）の責務**。エンジンを固くせずスキルに落とすことで、体験リポジトリの規律を保ちつつ
> MODEL の純度（4 イベント・任意順）を守れる。着手ゲートは「割当」を人間判断のまま強制する導線でもある。

---

## Step 12: AC（実コスト）記録を義務化（done とセットで必ず moira cost）

**① ユーザーのプロンプト**

> あとACの記録も漏れてるから追加してほしい。作業が終わったら必ずACを入れる。

**② Claude の処理**

- AC(実コスト)の記録規律を moira-track スキルに追加（**moira 本体は無改修**）。着手ゲートと対になる **完了時の義務**として設計。
- backend で累積/上書きを確認: `moira cost` は `ownCost += amount`（**累積加算**・イベント id で重複排除／`fold.ts:180`）、
  AC は木を上にロールアップ（`ac.ts`＝`AC(node)=ownCost+ΣAC(child)`）、**CPI = EV_abs / AC**。
- 捏造回避を明記: AC 値は**実測**。手元になければ**人間に確認してから**記録（AC 値は 5 判断ではないが実測データなので勝手に埋めない）。
- `.claude/skills/moira-track/SKILL.md` を編集（計 6 箇所）:
  - **新設「完了時の AC 記録（`done` の義務）」節**（累積加算・二重計上禁止・CPI が立つ効果）。
  - Success Criteria に AC 1 項／Critical Constraints に「作業完了で AC を記録（記録漏れ禁止）」1 項。
  - `requirements` / `design` / `tasks` / `impl` の各 `done` 後の cost を「実工数があれば」→**「必ず」**に変更（順序も `done → cost → accept` に整理）。

**③ 応答要旨**

- 「作業完了(`done`)したら必ず AC を記録」をスキルに明文化。これで **CPI が `n/a` から立ち**、コスト効率が可視化される。
- 値は実測・捏造しない（不明なら人間に確認）。`moira cost` は累積加算なので同じ工数を二重計上しない。
- moira エンジンは無改修（着手ゲートと同じくスキル層の規律）。

**④ 実行した moira コマンド**

```bash
# 調査のみ（backend 実装確認・イベント追記なし）:
#   fold.ts:180  cost → ownCost += amount（累積・id dedup）
#   ac.ts        AC(node)=ownCost+ΣAC(child) / CPI=EV_abs/AC
```

**変更ファイル**: `.claude/skills/moira-track/SKILL.md`（「完了時の AC 記録」節を新設＋Success Criteria / Critical Constraints /各フェーズの cost 手順を義務化）

> 学び: EV(出来高)・PV(計画)・AC(実コスト) の 3 本が揃って初めて EVM が回る。**着手ゲート（start 前＝計画）と AC 記録（done 時＝実績）** は対で、
> 前者が PV/SPI を、後者が AC/CPI を漏らさず立てる導線。どちらも **moira は無改修＝スキル層の規律**。

---

## Step 13: 発火トリガー早見表を CLAUDE.md に集約（発火漏れ防止）

**① ユーザーのプロンプト**

> 発火のきっかけを端的にCLAUDE.mdにまとめて、発火漏れがないようにして

**② Claude の処理**

- デモで実際に起きた**発火漏れ**（Step 4/9 で割当・slot をスキップ → PV が立たず／AC をスキップ → CPI が n/a）を
  二度と起こさないよう、**常時ロードされる** playground の `CLAUDE.md` に「発火トリガー」早見表を新設。
- 「きっかけ → 必ず発火するもの」の 5 行に集約:
  1. cc-sdd 節目に到達 → 対応する `/moira-track <phase>`
  2. ノードを **start する前** → 着手ゲート（見積 agreed＋担当＋slot）
  3. ノードを **done した直後** → AC 記録（`moira cost`）
  4. moira にイベント追記後 → `moira ui` 再起動
  5. 5 人間判断に触れる → emit 前に人間へ確認
- 開発ルールの「/moira-track を飛ばさない」を「**発火トリガー（上表）を飛ばさない**（start 前ゲート・done 後 AC 含む）」に拡張。

**③ 応答要旨**

- 発火の**「いつ」**を CLAUDE.md（常時コンテキスト）に一望化。発火の**「中身」**（正しいイベント列・判定手順）は `moira-track` スキルが持つ、と役割分担を明記。
- これで start 前ゲート・done 後 AC も含め、デモで漏れた発火が構造的に拾われる。

**④ 実行した moira コマンド**

- （なし — `CLAUDE.md` の文書追加のみ。moira の状態は変化なし）

**変更ファイル**: `moira/examples/todo-playground/CLAUDE.md`（「発火トリガー」節を新設＋開発ルール 1 項を更新）

> 学び: 発火漏れ対策は 2 層に分ける。**「いつ発火するか」は常時ロードの CLAUDE.md に早見表**で（漏れ検知）、
> **「何を発火するか」は該当スキルに詳細**で（正しい実行）。前者があるだけで、スキル起動前でも節目を取りこぼさない。

---

## Step 14: /kiro-spec-design（着手・設計生成／背骨 #5 前半）

**① ユーザーのプロンプト**

> `/kiro-spec-design task-add-and-list`

**② Claude の処理**

- **着手ゲート確認**（`moira show --json`・読み取りのみ）: design の 3 条件を検証 —
  `estimate="agreed"` ✓ ／ `unassignedBacklog` に design 無し（＝割当済み）✓ ／ `forecast[].frozenSlot="2026-07-01"` ✓。要件も承認済み（`approvals.requirements.approved=true`）。→ **充足**。
- 責務として moira-track の **design（着手）** を記録: `moira start task-add-and-list/design`（→ implementing）→ UI 再起動。
- kiro-spec-design スキルを実行。コンテキスト収集（requirements.md / spec.json / steering product.md / trace-notation.md / design.md テンプレ / research.md テンプレ / design-principles.md）。
- **フィーチャー型判定 = Simple Addition**（グリーンフィールドだが単一ユーザー・ローカル完結の単純 UI/永続化。技術スタックは discovery で確定済み）→ **最小 discovery**（外部 API 調査なし・パターン確認のみ）。詳細化するのは破損耐性(3.3)と重複タイトルの独立性(1.5)の 2 点に絞る。
- Synthesis: **State-first ＋ Storage Repository** を採用（React state を真実の源、localStorage は保存先の鏡、永続化は load/save に隔離）。依存方向 `types → storage → hooks → components → App → main` を強制。
- `research.md` / `design.md` を生成し、**レビューゲート**を実行:
  - メカニカル: 全 14 要件 ID が Traceability に存在 ✓／Boundary 4 節記入 ✓／File Structure Plan 具体パス ✓／境界↔ファイル整合（削除・編集を示すファイル無し）✓／孤児コンポーネント無し ✓／ref-list 文法（範囲・ワイルドカード・括弧混入なし）✓。
  - 判断: 外部依存（localStorage / randomUUID）明示・隠れた共有所有なし（UI は localStorage 直接不可）・投機的抽象なし。→ **PASS**（spec gap なし）。
- spec.json を `phase: design-generated` / `approvals.design.generated: true`（approved は false のまま）へ更新。

**③ 応答要旨**

- 設計を 6 コンポーネント（`Task` 型 / `taskStorage` / `useTasks` / `TaskForm` / `TaskList` / `TaskItem` ＋ `App`）に分解。全 14 要件を Traceability で被覆。追加フロー・起動復元フロー（破損→空一覧）を Mermaid で明示。
- Moira: design が **implementing**、**exec coverage 0%→33%**（1/3 実行中）。ただし **EV% は 33% 維持**（設計はまだ done/accept していない＝「着手＝実行中、まだ稼いでいない」）。**承認は次ステップ**（背骨 #5 後半）。
- 次アクション: ユーザーが design.md をレビュー → 承認で `moira done → cost → accept`（EV% 33%→67% の見込み）。差し戻しなら要件同様に後退が数値で見える。

**④ 実行した moira コマンド**

```bash
$ moira show --json      # 着手ゲート確認（読み取りのみ・イベント追記なし）
                         #   design: estimate=agreed / 割当済み / frozenSlot=2026-07-01 → 充足

$ moira start task-add-and-list/design      # 設計の着手（→ implementing）
• task-add-and-list/design → implementing

$ moira show
  EV%  33% | estimate coverage 100%   (pair-read R-S4)     # ← EV% は不変（着手では動かない）
  SPI  1.00 | schedule coverage 67%   (pair-read R-S6)
  EV_abs 0.5 | PV 0.5 | AC 0 | CPI n/a | exec coverage 33%  # ← exec 0%→33%（design 実行中）
  review queue [] | agent queue [] | unassigned [要件定義]
  implementing agreed  設計 (task-add-and-list/design)      # ← implementing に

# UI 再起動（16 events）
$ taskkill //F //PID 14060 ; moira ui --port 5180 --no-open   # → 16 events
```

**生成ファイル**: `.kiro/specs/task-add-and-list/design.md`, `.kiro/specs/task-add-and-list/research.md`
**変更ファイル**: `.kiro/specs/task-add-and-list/spec.json`（phase / design.generated）

> 学び: Step 7（要件着手）と同じ弧の再現 —— **着手（`moira start`）は exec coverage を上げるが EV% は動かさない**。
> 「やり始めた ≠ 稼いだ」。設計で EV% が 33%→67% に動くのは、**人間がレビューして承認し done/accept が入る瞬間**（背骨 #5 後半）。
> また **着手ゲートが機能した**: design は Step 10 で slot/担当、Step 4 で見積 agreed を先に満たしていたため、`start` が正当に通った。

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
