---
name: moira-evm-digest
description: >
  moira のイベントログから朝会・定例向けの EVM ダイジェストを生成する（roadmap 書 skill #14 の
  前倒し参照実装・issue #25）。中核は読み取り専用 CLI `moira report`（現況ペア読み・前回営業日比 Δ・
  期間の出来事・レビューキュー・feature 別内訳・着地予測 vs 期日・直近 N 営業日の SPI/EV% 推移）。
  「朝会レポート」「定例レポート」「朝会ダイジェスト」「前回との差分」「EVM 推移」「SPI 推移」
  「進捗レポート出して」などで起動。CLI の stdout をそのまま貼る（独自整形しない）。
allowed-tools: Bash, Read
argument-hint: "[--asOf YYYY-MM-DD] [--prev YYYY-MM-DD] [--days N]"
metadata:
  origin: "custom"
---

# moira-evm-digest

Generate the morning-meeting EVM digest from a moira event log by running the
read-only `moira report` CLI and pasting its stdout verbatim.

**This English file is the convention shell only. The full, normative procedure lives
in [`SKILL.ja.md`](./SKILL.ja.md)** (project language). To avoid a second source of
truth, the procedure is NOT duplicated here — follow `SKILL.ja.md`.

In one line: resolve the log home (CLI does it: `--dir` > `MOIRA_DIR` > `.moira`
pointer > cwd) → run `moira report [--asOf] [--prev] [--days]` (prev defaults to the
previous business day — weekends + Japanese holidays skipped) → paste stdout AS-IS
(never re-format, never quote SPI/EV% detached from their coverage pair, never build
a per-developer EV scoreboard) → report stderr warnings separately → point deeper
questions at `moira report --json` / `moira show` / `moira ui`.

## Boundary with existing surfaces

- `moira show`: one-point snapshot (no diff, no trend).
- `moira ui`: interactive dashboard (browser).
- **this skill**: the paste-ready diff + trend digest for the morning meeting.
