# Moira デモンストレーション記録（Take 2）

> このファイルは Moira のデモセッションの記録です。ユーザーのプロンプト、Claude の処理・応答、
> 特に実行した **moira CLI コマンド**を時系列で残し、あとから見返せるようにします。
>
> - セッション開始日: **2026-07-01**（Take 2・discovery からやり直し）
> - 対象リポジトリ: `moira/examples/todo-playground`（cc-sdd × Moira 体験用 playground）
> - 記録方針: 各ステップを「① プロンプト → ② Claude の処理 → ③ 応答要旨 → ④ 実行した moira コマンドと結果」の順で残す
> - **前回の記録（Take 1）は [`demo-log.take1.md`](demo-log.take1.md) に保全**。Take 1 で得た知見は
>   `moira-track` スキル・playground `CLAUDE.md` に反映済み（下の「引き継ぐ規律」参照）。

---

## 目次

- [Step 0: リセット — Take 1 を保全し discovery からやり直し](#step-0-リセット--take-1-を保全し-discovery-からやり直し)
- [Step 1: /kiro-discovery — brief.md 作成と moira への最初の記録](#step-1-kiro-discovery--briefmd-作成と-moira-への最初の記録)
- [Step 2: /kiro-spec-init — spec.json と requirements.md の雛形作成](#step-2-kiro-spec-init--specjson-と-requirementsmd-の雛形作成)
- [Step 3: /moira-track estimate — 見積の提案→合意で分母を確定（背骨 #2→#3）](#step-3-moira-track-estimate--見積の提案合意で分母を確定背骨-23)
- [Step 4: /kiro-spec-requirements — 要件生成＋着手→出来高獲得→AC（背骨 #4）](#step-4-kiro-spec-requirements--要件生成着手出来高獲得ac背骨-4)
- [Step 5: 差し戻し→修正→再提出 — requirements-style 適用（背骨 #5→#6）](#step-5-差し戻し修正再提出--requirements-style-適用背骨-56)

---

## 取り決め（このセッション以降）

- **`/moira-track <phase>` の打鍵は Claude の責務**。ユーザーは明示的に叩かない。各 cc-sdd 節目に達したら
  Claude が自発的に記録する（2026-07-01 ユーザー指示）。
- ただし **5つの人間判断**（見積合意・割当・容量・スコープ・見積深さ）は emit 前にユーザー確認を取る。
  とくに見積合意 `moira agree` は human 限定（AI では拒否）。

### Take 1 から引き継ぐ規律（SKILL.md / CLAUDE.md に反映済み）

Take 1 のデバッグで確立し、`moira-track` スキルと playground `CLAUDE.md` に恒久化した規律。Take 2 では最初から守る:

1. **`moira add` は常に `--parent <feature>` を明示**する（省略すると root へフォールバックし二重 decompose 辺が生まれる＝issue #5 の罠）。
2. **着手ゲート**: ノードを `start` する前に「見積 agreed ＋ 担当 ＋ 着手予定日(slot)」の 3 条件を満たす（未充足なら先に見積合意・割当・slot）。
3. **AC 記録**: ノードを `done` した直後に必ず `moira cost <node> <実工数md>`（実測・捏造しない・累積加算）。
4. **UI 再起動**: moira にイベントを追記したら `moira ui` を再起動（起動時スナップショットのためリロード不可）。
5. **発火トリガー早見表**（playground `CLAUDE.md`）を毎節目で参照し、発火漏れを防ぐ。

---

## Step 0: リセット — Take 1 を保全し discovery からやり直し

**① ユーザーのプロンプト**

> いったん成果物とログを元に戻して、discoveryからやり直そう

**② Claude の処理**

- 不可逆操作のため範囲を確認（`AskUserQuestion`）:
  - **リセット範囲** → 「成果物とログのみ戻す（改善は残す）」。`SKILL.md` / `CLAUDE.md` のプロセス改善は保持。
  - **demo-log** → 「Take 1 として保全し新ログを開始」。
- 最終コミット（`9d885ac`）のベースラインを確認: `events.json = []`（空シード）/ `labels.json = todo-app・you のみ`（spec ノード誕生前）。
- リセット実行:
  1. moira UI 停止（port 5180）。
  2. `git checkout HEAD -- .moira/events.json .moira/labels.json` → moira を discovery 前の空シードへ。
  3. `.kiro/specs/task-add-and-list/`（brief / requirements / design / research / spec.json）を削除。
  4. `.moira/events.broken.json`（Take 1 のデバッグ証跡）を削除。
  5. `demo-log.md` → `demo-log.take1.md` に退避し、本ファイルを新規作成。
- **保持したもの**: `.claude/skills/moira-track/SKILL.md` と playground `CLAUDE.md` のプロセス改善（--parent 根治・着手ゲート・AC 義務化・発火トリガー早見表）。

**③ 応答要旨**

- moira を完全な空シードへ（`moira show` で全指標 0・ノードなし・キュー空）。spec 成果物は消去。
- Take 1 の記録は `demo-log.take1.md` に、そこで得た規律は SKILL.md / CLAUDE.md に温存 → **同じ罠を踏まず綺麗にやり直せる状態**。
- 次アクション: `/kiro-discovery "TODOアプリ"` から再開。

**④ 実行した moira コマンド**

```bash
# moira UI 停止（port 5180 の PID を特定して kill）
$ taskkill //F //PID <pid>

# moira を最終コミットの空シードへ
$ git checkout HEAD -- .moira/events.json .moira/labels.json
$ cat .moira/events.json     # → []
$ cat .moira/labels.json     # → todo-app / you のみ

# spec 成果物・デバッグ証跡を削除／demo-log を退避
$ rm -rf .kiro/specs/task-add-and-list
$ rm -f .moira/events.broken.json
$ mv demo-log.md demo-log.take1.md

$ moira show
  EV%  0% | estimate coverage 0%   (pair-read R-S4)
  SPI  n/a | schedule coverage 0%   (pair-read R-S6)
  EV_abs 0 | PV 0 | AC 0 | CPI n/a | exec coverage 0%
  review queue [] | agent queue [] | unassigned []
  # ← ノードなし・完全な空シード（discovery 前）
```

**変更ファイル**: `.moira/events.json`（→ `[]`）, `.moira/labels.json`（→ base）
**削除**: `.kiro/specs/task-add-and-list/`（一式）, `.moira/events.broken.json`
**退避**: `demo-log.md` → `demo-log.take1.md`
**保持**: `.claude/skills/moira-track/SKILL.md`, `moira/examples/todo-playground/CLAUDE.md`（プロセス改善）

> メモ: UI 再起動は空シードでは省略可（次の discovery → moira-track で最初のイベントが立ってから再起動する）。

---

## Step 1: /kiro-discovery — brief.md 作成と moira への最初の記録

**① ユーザーのプロンプト**

> `/kiro-discovery "TODOアプリ"`

**② Claude の処理**

- **Step 1 軽量スキャン**: specs 空・steering は `product.md` のみ・ソースコードなし → 実質グリーンフィールド。
- **Step 2 パス判定**: 単一スコープの小さな機能に収まる → **Path C（新規・単一スコープ）**。コードベース無しのため探索サブエージェントは省略。
- **`product.md` 回収**: who/why/スコープ/制約が記載済み（In=追加/一覧/完了・取消/削除、Out=認証・共有・通知等、制約=軽量スタック・最初の1フィーチャーを通す）。推測できない本当の決定＝**境界**と**スタック**の2点のみ `AskUserQuestion`。
  - 境界 → **「追加と一覧のみ」**（feature `task-add-and-list`。完了/削除は後続に回す最小の縦スライス）。
  - スタック → **React + Vite + localStorage**（+ TypeScript / Vitest。バックエンド無し）。
- **Viability**: React18+Vite+TS+localStorage+Vitest は枯れた標準構成でショーストッパー無しと判断。
- **Step 7**: `.kiro/specs/task-add-and-list/brief.md` を Write（Path C 形式）。
- **発火トリガー**: 「discovery 完了（brief.md）」の節目 → `/moira-track discovery --feature task-add-and-list` を自発発火（Claude の責務）。discovery は 5 判断（agree/assign/capacity）に触れないので `--actor agent:claude` で自律実行。

**③ 応答要旨**

- Path C 確定。brief.md 作成。moira にフィーチャー＋3フェーズ子（req/design/tasks）を**未見積**で誕生 → 見積カバレッジ **0%**（背骨 #1）。
- 次アクション: `/kiro-spec-init task-add-and-list`（見積を決める節目が来たら `/moira-track estimate`）。

**④ 実行した moira コマンド**

```bash
# CLI 疎通・現状（空シード）確認
$ moira show
  EV% 0% | estimate coverage 0% | ... （ノードなし）

# discovery マッピング: init（no-op）→ feature＋3フェーズ子を未見積で誕生
$ moira init --me you --root todo-app        # → already exists, no-op
$ moira add task-add-and-list         --parent todo-app          --label "タスクの追加と一覧" --actor agent:claude
$ moira add task-add-and-list/req     --parent task-add-and-list --label "要件定義"        --actor agent:claude
$ moira add task-add-and-list/design  --parent task-add-and-list --label "設計"           --actor agent:claude
$ moira add task-add-and-list/tasks   --parent task-add-and-list --label "タスク分解"      --actor agent:claude
# → + decompose ×4（すべて --parent 明示で二重辺の罠を回避）

$ moira show
  EV% 0% | estimate coverage 0%          # ← 背骨 #1: 分母未確定
  nodes: 5件すべて pending/proposed（未見積）

# UI 再起動（イベント追記後・起動時スナップショットのため）
$ moira ui --port 5180 --no-open         # → http://localhost:5180 (4 events)
```

**作成ファイル**: `.kiro/specs/task-add-and-list/brief.md`
**変更ファイル**: `.moira/events.json`（decompose ×4 追記）, `.moira/labels.json`（node ラベル4件追加）
**UI**: http://localhost:5180 で起動中（4 events）

---

## Step 2: /kiro-spec-init — spec.json と requirements.md の雛形作成

**① ユーザーのプロンプト**

> `/kiro-spec-init task-add-and-list`

**② Claude の処理**

- `brief.md` 既存を確認（discovery が作成済み）。who/現状/変えたいこと の3要素を brief から回収し、明確化質問はスキップ。
- テンプレート（`.kiro/settings/templates/specs/init.json` / `requirements-init.md`）を読み、プレースホルダを置換（feature_name / timestamp / language=ja / project description）。
- `spec.json`（phase=initialized・approvals 全 false）と `requirements.md`（Project Description のみ・Requirements は未生成）を Write。
- **moira 非発火**: spec-init は moira-track のマッピング（discovery/estimate/requirements/…）に無い＝節目でないためイベントを追記しない。

**③ 応答要旨**

- feature `task-add-and-list` を初期化。requirements 本体は次フェーズ（`/kiro-spec-requirements`）で生成。
- 次アクション: `/kiro-spec-requirements task-add-and-list`。加えて「spec 着手前に見積を決める」節目が来たら `/moira-track estimate`（5判断の見積合意＝要ユーザー確認）。

**④ 実行した moira コマンド**

```bash
# なし（spec-init は moira の節目ではない）
$ date -u   # timestamp 取得のみ → 2026-07-02T04:12:27Z
```

**作成ファイル**: `.kiro/specs/task-add-and-list/spec.json`, `.kiro/specs/task-add-and-list/requirements.md`
**moira**: 変更なし（4 events のまま）

---

## Step 3: /moira-track estimate — 見積の提案→合意で分母を確定（背骨 #2→#3）

**① ユーザーのプロンプト**

> `/moira-track estimate`（パス A：見積を先に確定してから要件定義に着手）

**② Claude の処理**

- **背骨 #2（提案）**: 3フェーズの見積案を **proposed**（AI 提案）で emit。`moira show` → coverage **まだ 0%**（提案≠合意＝正直さの肝）。
- **5判断の登場**: ①見積合意（`moira agree`＝human 限定）と ②割当（`moira assign`）は emit 前にユーザー確認（`AskUserQuestion`）。
  - 見積合意 → **3件とも合意**（req=1.0 / design=1.0 / tasks=0.5 md）。
  - req 割当 → **担当=中尾・slot=今日(2026-07-02)**。
- **背骨 #3（合意）**: `moira agree` ×3（human commit）→ coverage **0%→100%**（分母確定）。`moira assign req`（human commit）→ req が `ready`（着手ゲート3条件充足）。
- assign 前 hook が「ready 後退警告」を助言（未着手ノードなので問題なし＝baseline を着手前に引く正しい順序）。
- UI 再起動時に 5180 が旧プロセスで塞がっていたため PID kill → 再起動（footgun 記録）。

**③ 応答要旨**

- 見積カバレッジ 0%→100%。req は着手ゲート通過（ready）。PV 1・SPI 0.00・schedule coverage 33%（slot を敷いた req 1件分だけ計画価値）。
- design・タスク分解は unassigned（着手直前に assign する方針）。次アクション: `/kiro-spec-requirements task-add-and-list`。

**④ 実行した moira コマンド**

```bash
# 背骨 #2: 見積案を proposed で emit（AI 提案）
$ moira add task-add-and-list/req    --parent task-add-and-list --estimate 1   --actor agent:claude
$ moira add task-add-and-list/design --parent task-add-and-list --estimate 1   --actor agent:claude
$ moira add task-add-and-list/tasks  --parent task-add-and-list --estimate 0.5 --actor agent:claude
$ moira show
  estimate coverage 0%      # ← 提案だけでは分母は確定しない（背骨 #2）

# 背骨 #3: 見積合意（human 限定）＋ req 割当（human）
$ moira agree task-add-and-list/req      # ✓ [human commit]
$ moira agree task-add-and-list/design   # ✓ [human commit]
$ moira agree task-add-and-list/tasks    # ✓ [human commit]
$ moira assign task-add-and-list/req --to 中尾 --slot 2026-07-02   # → human:中尾 [human commit]
$ moira show
  EV% 0% | estimate coverage 100%        # ← 合意で分母確定（背骨 #3）
  SPI 0.00 | schedule coverage 33% | PV 1
  req: ready/agreed（着手ゲート3条件充足） | unassigned [設計, タスク分解]

# UI 再起動（5180 が旧プロセスで塞がっていたため PID kill してから）
$ netstat -ano | grep :5180   # → PID 15052
$ taskkill //F //PID 15052
$ moira ui --port 5180 --no-open   # → http://localhost:5180 (11 events)
```

**変更ファイル**: `.moira/events.json`（add×3 + agree×3 + assign×1 = 7 追記／計 11 events）, `.moira/labels.json`（actor `中尾` 追加）
**UI**: http://localhost:5180（11 events）

---

## Step 4: /kiro-spec-requirements — 要件生成＋着手→出来高獲得→AC（背骨 #4）

**① ユーザーのプロンプト**

> `/kiro-spec-requirements task-add-and-list`

**② Claude の処理**

- **着手（moira start）**: req は着手ゲート3条件充足済み（agreed＋中尾＋slot）→ `moira start task-add-and-list/req --actor agent:claude`（→ implementing）。ドラフトは AI が書くので作業系は `--actor agent:claude`。
- **要件生成**: EARS ルール／レビューゲート／テンプレートを読み、グリーンフィールドゆえサブエージェント探索は省略。WHAT のみ（localStorage 等の HOW は design へ）で 3 要件（追加／一覧／永続化）＋ Boundary Context を生成。
- **レビューゲート**: 機械チェック（数値ID・各要件に EARS AC・実装用語なし）＋判断（中核ジャーニー／エラー系／境界の被覆）→ PASS。`requirements.md` を確定 Write。`spec.json` を `phase: requirements-generated`・`approvals.requirements.generated: true` に更新。
- **作成完了（moira done）**: `moira done task-add-and-list/req`（→ implemented＝**出来高獲得**）。EV% **0%→40%**（EV_abs 1 / 分母 2.5）。req は review queue [要件定義] へ。
- **AC 記録（義務）**: 実工数は AI で測れないため `[人間確認]`（`AskUserQuestion`）→ **0.5 md**（見積 1.0 より少）で記録。`moira cost req 0.5`（累積加算）→ CPI **n/a→2.00**。

**③ 応答要旨**

- 背骨 #4 の弧: 着手（implementing）→ 出来高獲得（implemented・EV% 上昇）→ AC 記録（CPI 立つ）。
- 要件は**まだ承認前**（review queue）。次は人間レビュー → 承認なら `moira accept req`（背骨 #7・EV% 据え置き）→ `/kiro-spec-design`。

**④ 実行した moira コマンド**

```bash
# 着手（着手ゲート充足済み）
$ moira start task-add-and-list/req --actor agent:claude    # → implementing

# 作成完了 → 出来高獲得
$ moira done task-add-and-list/req --actor agent:claude     # → implemented
$ moira show
  EV% 40% | estimate coverage 100%     # ← 背骨 #4: EV% がここで初めて上がる
  SPI 1.00 | EV_abs 1 | PV 1 | AC 0 | CPI n/a
  review queue [要件定義]

# AC 記録（done 直後の義務・実測 0.5md を人間確認のうえ）
$ moira cost task-add-and-list/req 0.5 --actor agent:claude   # += 0.5 MD
$ moira show
  EV% 40% | EV_abs 1 | AC 0.5 | CPI 2.00   # ← CPI が n/a から立つ

# UI 再起動
$ taskkill //F //PID <5180の旧PID>
$ moira ui --port 5180 --no-open   # → http://localhost:5180 (14 events)
```

**作成/変更ファイル**: `.kiro/specs/task-add-and-list/requirements.md`（本体生成）, `.kiro/specs/task-add-and-list/spec.json`（phase/approvals 更新）
**moira**: `.moira/events.json`（start+done+cost = 3 追記／計 14 events）
**UI**: http://localhost:5180（14 events）

---

## Step 5: 差し戻し→修正→再提出 — requirements-style 適用（背骨 #5→#6）

**① ユーザーのプロンプト**

> `V:\Users\prb00133\Desktop\github\sdd-workshop\.kiro\steering\requirements-style.md` をここにもコピーして遵守してください

**② Claude の処理**

- **不適合の特定**: 既存 requirements.md の AC が「英文中に日本語混在」（❌悪い例3）だったことを確認。`requirements-style.md` のルール（英文 EARS 1行 + `- 和訳:` 1行のペア）に違反。
- **steering コピー**: `requirements-style.md` を playground の `.kiro/steering/` にコピー（以降の全フェーズで遵守）。
- **差し戻し（背骨 #5）**: `moira start task-add-and-list/req`（implemented→implementing）。EV% **40%→0% 後退**。AC 0.5 は残る（sunk）。CPI **2.00→0.00**。
- **修正・再提出（背骨 #6）**: 全 AC を「英文 EARS + `- 和訳:` ペア」に書き直し。`moira done req`（implementing→implemented）→ EV% **0%→40% 回復**。追加 AC 0.25 md（人間確認のうえ）を `moira cost` で累積加算→ 累積 AC **0.75 md**・CPI **1.33**。

**③ 応答要旨**

- 差し戻しは無償でない: EV% は後退し AC は残る（CPI 悪化）。正直な弧が Moira で可視化。
- requirements-style.md は playground の steering に永続化。今後の全フェーズ（design/tasks）でも遵守。
- 次アクション: 人間レビューで承認 → `moira accept req`（背骨 #7・EV% 据え置き）→ `/kiro-spec-design`。

**④ 実行した moira コマンド**

```bash
# 差し戻し（背骨 #5）: implemented → implementing
$ moira start task-add-and-list/req --actor agent:claude
$ moira show
  EV% 0% | EV_abs 0 | AC 0.5 | CPI 0.00    # ← EV% 後退・AC は残る

# 再提出（背骨 #6）: implementing → implemented
$ moira done task-add-and-list/req --actor agent:claude
$ moira show
  EV% 40% | EV_abs 1 | AC 0.5 | CPI 2.00   # ← EV% 回復

# 追加 AC 記録（rework 分 0.25md・人間確認のうえ）
$ moira cost task-add-and-list/req 0.25 --actor agent:claude   # += 0.25 MD
$ moira show
  EV% 40% | EV_abs 1 | AC 0.75 | CPI 1.33  # ← 累積 AC で CPI が正直に低下

# UI 再起動（17 events）
$ taskkill //F //PID <旧PID> && moira ui --port 5180 --no-open
```

**作成ファイル**: `.kiro/steering/requirements-style.md`（コピー）
**変更ファイル**: `.kiro/specs/task-add-and-list/requirements.md`（EARS + 和訳ペアに全面修正）
**moira**: `.moira/events.json`（start+done+cost = 3 追記／計 17 events）
**UI**: http://localhost:5180（17 events）

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
