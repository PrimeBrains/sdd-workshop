---
name: moira-adapter-gen
description: >
  プロジェクト別の Moira アダプタ（宣言的 provider 設定＋multi-repo 設置）をインタビュー駆動で生成する
  authoring スキル（ADR-0003 Stage 3・issue #14）。「アダプタを生成」「provider を作る」「moira を
  別プロジェクト/別プロセスに導入」「multi-repo で moira を使いたい」「moira-adapter-gen」などで起動。
  成果物は .claude/moira-provider.json（スキーマ機械検証済み — 意味の正しさはスモークで確認）＋
  各作業リポジトリへの adapter install（--provider/--home）＋振り付けの追記。非 cc-sdd プロセス対応の
  主要な入口（手書き設定＋install --provider でも可能だが、本スキルは検証とスモークまで面倒を見る）。
  ※プロセスが cc-sdd のまま multi-repo にしたいだけなら本スキルは不要 — 各リポジトリで
  `moira adapter install --home <ptr>` を打つだけで足りる（ADR-0003 Stage 1）。
  高能力モデル（Opus 4.8+ / Fable）での実行を推奨（インタビュー→設定生成は意味理解を要する）。
allowed-tools: Bash, Read, Write, Glob, Grep, AskUserQuestion
argument-hint: "[プロジェクト名 or 記入済み interview-template.md のパス]"
metadata:
  origin: "custom"
---

# moira-adapter-gen — プロジェクト別アダプタの生成

対象プロジェクトの**開発プロセス**（どの成果物がどの節目を示すか）と**リポジトリ構成**（ログ home 1 箇所×
作業リポジトリ N 個）をインタビューし、**宣言的 provider 設定**を生成して各リポジトリへ設置する。
本スキルは sdd-workshop 側の **authoring ツール**であり、配布物（`moira adapter install` の管理対象）ではない
（生成の成果＝設定と設置物だけが対象リポジトリに残る）。

> 前提知識（必ず Read）: 設定スキーマ＝`moira/cli/src/adapter/provider-config.ts`（schema v1・正）、
> 設置の仕組み＝[ADR-0003](../../../.kiro/adr/0003-multi-repo-log-home-and-declarative-providers.md)、
> cc-sdd の実例＝`moira/cli/templates/claude/moira-provider.json`。

## 不変条件（生成される provider が何であっても守る）

- **1 プロジェクト = 1 ログ home**（D-50）。インタビューで 2 つ目のプロジェクトが出たら**別 home として
  別セッションに分ける**よう案内し、複数 home のマージ・集計は拒否する（multi-repo ≠ multi-project）。
- **5 人間判断**（見積合意・割当・容量・スコープ/期日・見積深さ）・`--parent` 明示・append-only・
  着手ゲート・AC 実測は provider に依らず不変（エンジン汎用 — 配布される SKILL.md/reference.md が担保）。
- **drift は捏造しない**: 成果物→ノード状態の対応を宣言できないなら `drift.mode: "unsupported"` を選ぶ
  （明示エラーになる — 存在しない突き合わせを提供しない）。
- 設定は**必ず** `moira adapter validate-provider` で機械検証してから設置する。

## 手順

### 0. 振り分けガード

- プロセスが **cc-sdd そのもの**なら本スキルは不要: 単一リポは `moira adapter install`、multi-repo は
  各リポジトリで `moira adapter install --home <homeへの相対パス>` だけで足りる（既定の cc-sdd provider が
  そのまま使える）。ここで案内して終了する。
- 非 cc-sdd／カスタム語彙のときだけ続行。

### 1. インタビュー（[人間確認] の連続 — 勝手に決めない）

[`interview-template.md`](interview-template.md) をユーザーに提示し、記入してもらう（または
AskUserQuestion で対話的に埋める）。項目:

1. **プロジェクト名・projectRoot ID・me**（担当者 ID）
2. **ログ home の場所** — 既存 `.moira` か新規か。**1 つだけ**（D-50。2 つ目は拒否）
3. **参加リポジトリ一覧** — パス・役割（設計/実装/インフラ…）・home への相対パス（ポインタに書く値。相対推奨）
4. **フェーズ語彙と完了 artifact** — phases（**sync も明示的に含める** — 自動付与は無い）・
   `detect`（方法論の存在マーカーのパス）・各フェーズの完了を示すファイル（リポジトリごとの path 正規表現＋
   判定方法: 存在 / JSON フィールド〔`when.anyTrue` に入れる dotted path まで〕 / チェックボックス）＋
   **presence drift 用に「存在すべきノード（`{feature}` 置換・親つき）」** → `triggers` / `drift.presence.rules` へ
5. **feature ID の抽出規則** — パスの名前付き捕獲 `(?<feature>…)`。**リポジトリ間の ID 衝突回避**:
   各リポジトリが主張する feature 空間 → `scope.claim`。構文は **`<id>` 完全一致 か `<prefix>/*`（末尾のみ）**
   — 中間ワイルドカードは実装に存在しない（feature 単位で列挙。同一 BL を複数リポジトリで扱う場合、
   どのリポジトリがどのフェーズ子を持つかまで確認）
6. **ノード ID スキーム** — フェーズ子 suffix・implPrefix・review ノードの有無（`nodeScheme`）
7. **5 人間判断の割当** — ①見積合意②割当③スコープ/期日④見積深さ⑤容量 を誰が承認するか
   （振り付けの `[人間確認]` 文言に反映）
8. **標準依存辺** — cc-sdd の 4 辺既定（req→design/design→tasks=accepted・tasks→impl-*=accepted・
   impl-*→review-impl=implemented）を使うか、`edges` をカスタムするか（policy は常に明示）
9. **drift モード** — `builtin`（cc-sdd のみ）/ `presence`（artifact 存在→ノード存在の宣言）/ `unsupported`

### 2. 設定生成 → 機械検証

回答から `.claude/moira-provider.json`（schema v1）を**リポジトリごと**に生成する
（`scope.claim`・`triggers`・`detect`・`drift.presence.rules` はリポジトリ役割で異なりうる。
共通なのは phases / nodeScheme / edges 程度）。生成したら必ず:

```bash
moira adapter validate-provider <生成した config.json>   # エラーは全件一括表示
```

正規表現には必ず `(?<feature>…)` を含める（バリデータが強制）。トリガー message の
プレースホルダは `{file}` `{feature}` `{phase}` `{checked}` `{total}`。

> ⚠ **検証はスキーマ（構造）のみ**: パターンが実在の成果物に一致するか・`scope.claim` が実ノードを
> 覆うか等の**意味の正しさは検査されない**。手順 6 のスモークで必ず実挙動を確認する。

### 3. ログ home の初期化（未初期化なら・[人間確認]）

```bash
moira --dir <home> init --me <me> --root <projectRoot> --label "<プロジェクト名>"
```

### 4. 各作業リポジトリへ設置

```bash
moira adapter install --dir <repo> --provider <そのrepo用 config.json> --home <homeへの相対パス>
```

- `--home` は作業リポジトリに `.moira` **ポインタファイル**（`home: <path>`）を書く（既存 `.moira` が
  あれば温存・上書きしない）。ポインタは**相対パス推奨**（絶対パスは clone 位置依存 — コミットしない）。
- custom provider の install は `provider-reference.md`（設定から生成・§P2 は「⚠ 未著」）と steering を
  レンダリングで差し替え、SKILL.md/reference.md（エンジン汎用）は逐語設置する。

### 5. 振り付け（§P2）の執筆 — 本スキルの中核付加価値

設置された `<repo>/.claude/skills/moira-track/provider-reference.md` の **§P2「⚠ 未著」を、
インタビュー 4/7/8 の回答から実際の振り付けに置き換える**: フェーズごとに
「発行イベント列（誕生 add → 見積提案/agree → assign+slot → start/done/cost/accept）・
どこに `[人間確認]` が入るか・標準辺の敷設タイミング」を書く。cc-sdd 版
（`moira/cli/templates/claude/skills/moira-track/provider-reference.cc-sdd.md` §P2）が体裁の見本。

> この手編集は managed file の**ユーザー改変**扱いになり、以後の `moira adapter install` は
> skip（温存）する。**裏面の開示**: 同じファイルの §P1/§P3/§P4 は設定由来のレンダリング — 手編集後は
> provider 設定を変えて再 install しても**ファイル全体が skip され再レンダリングされない**。設定変更を
> 反映したいときは `--force`（手書き §P2 は `.moira-adapter.bak` に退避される — 貼り戻すこと）。
> 手書き部と設定由来部のファイル分離は将来改善として ADR-0003 に記録。

### 6. スモーク検証（全リポジトリ）

```bash
moira adapter status --dir <repo>       # provider id・ファイル intact
moira adapter drift  --dir <repo>       # presence/builtin のみ（unsupported は明示エラーが正）
moira --dir <home> show                 # 全リポジトリの作業が 1 本の木に載るか
```

トリガーの実挙動確認: 対象 artifact をダミー編集 → moira-fire hook が `/moira-track <phase>` を
助言することを確認（またはユーザーの通常作業で確認してもらう）。

### 7. 締め

- 生成した設定・ポインタ・振り付けの一覧と、**既知の限界**（drift の深さ＝presence は存在検知のみ／
  hooks は上位探索をしない＝ポインタ必須／`MOIRA_DIR` の常設は誤爆リスク）をユーザーに報告する。
- 設定ファイル群のコミットはユーザーの依頼があるときのみ（各対象リポジトリの運用に従う）。

## Safety & Fallback

- `moira` CLI 未導入 → sdd-workshop `moira/cli` README のセットアップを案内して停止。
- インタビューの回答が schema v1 で表現できない（例: 1 ファイル内の複雑な状態機械からのフェーズ判定）→
  無理に DSL へ押し込まず、`drift.mode: "unsupported"` ＋ triggers は表現できる範囲だけ宣言し、
  「コード provider の追加（`moira/cli/src/adapter/providers/`）が必要」と正直に報告する。
- 生成した設定の検証エラーが解消できない → 該当項目をユーザーに差し戻す（推測で埋めない）。
