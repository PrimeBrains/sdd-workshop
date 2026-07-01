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
