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

# moira-evm-digest — 朝会 EVM ダイジェスト

moira のイベントログから、朝会・定例に貼れる EVM ダイジェストを出力する。
計算はすべて読み取り専用 CLI `moira report` が行う（イベントは一切 emit しない）。

**意味論の正典**は TE03（`moira/thought-experiments/03-daily-evm-rollup.md`）:
「前回」は保存スナップショットではなく（⊥A2）、**同一の追記専用ログを (ts,id) ≤ cut の
prefix で再 fold した as-of 導出**である。朝の関心は ①EVM 推移（ペア読み多系列）
②レビューキュー（P4 = 当日のアクションリスト）③警告、の3点。

## 手順

引数: `--asOf` / `--prev` / `--days`（いずれも任意。CLI の既定に任せるのが基本）。

1. **home の解決は CLI に任せる**（`--dir` > `MOIRA_DIR` > `.moira` ポインタ > カレント）。
   別 home を見るときだけ `moira --dir <home> report ...` とする。

2. **実行**:
   ```bash
   moira report            # asOf=今日(または config.asOf)、prev=直前営業日、推移=直近5営業日
   moira report --asOf 2026-07-06 --prev 2026-07-03 --days 10
   ```
   - `--prev` 既定 = **直前営業日**（土日＋日本の祝日をスキップ。祝日は CLI 同梱の
     静的データ 2025–2027。範囲外の日付は stderr に警告して土日のみスキップ）。
   - 週明けに金曜比としたい等は既定のままでよい（営業日スキップが自動で効く）。
   - `moira: unknown command: report` になったら CLI が旧ビルド。
     `cd <sdd-workshop>/moira/backend && npm run build && cd ../cli && npm run build` を案内。

3. **stdout をそのまま貼る — 独自に整形し直さない**（evmtools スキルと同じ規律）。
   - stderr の警告（祝日データ範囲外など）は本文と分けて別掲で報告する。
   - 数字の取捨選択・並べ替え・再計算をしない。CLI の出力が正。

4. **深掘りの誘導**: 詳細が要るときは `moira report --json`（schemaVersion 1）、
   一時点の詳細は `moira show`、対話的に見るなら `moira ui` を案内する。

## 正典の規律（禁止事項）

- **per-developer の EV スコアボードは作らない・求められても出さない**（TE03/A4:
  価値は木に、容量（コスト）は actor に帰属する。actor 別に許されるのは AC のみ）。
- **SPI/EV% をカバレッジから切り離して引用しない**（R-S4/R-S6 のペア読み）。CLI の
  出力は既に同一行にペアで載っている——分離して抜粋しない。
- **着地予測は観測であって判断ではない**（R-T4: 期日の判断は人間）。「間に合わない」等の
  断定はレポートに書き足さない。daysLate の数字を示すに留める。
- 出力の捏造をしない: CLI が動かない・home が無い場合はその事実を報告する
  （それらしいダイジェストを手で書かない）。

## 既存サーフェスとの境界

- `moira show`: 一時点のスナップショット（差分・推移なし）。
- `moira ui`: ブラウザの対話ダッシュボード。
- **本スキル**: 朝会に貼る「差分＋推移」ダイジェスト（roadmap 書 skill #14 の前倒し参照実装）。
