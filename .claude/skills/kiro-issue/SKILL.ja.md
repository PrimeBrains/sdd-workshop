---
name: kiro-issue
description: >
  Turn kiro-discovery output (brief.md / roadmap.md) or the current conversation into
  GitHub Issues on the PrimeBrains/sdd-workshop repository and link them to the
  pj-sdd-workshop Project (Projects V2). A milestone (evm-studio / sdd-dashboard) is
  REQUIRED because it identifies which app the issue belongs to. Trigger aggressively on
  "issue にして", "起票して", "チケット化", "discovery の結果を issue 化",
  "sdd-workshop に issue 追加", or whenever the user finished brainstorming with
  kiro-discovery and wants to file the result. This is the natural follow-up to
  kiro-discovery.
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion, Agent
argument-hint: <feature-or-brief>
metadata:
  origin: "custom"
---

# kiro-issue — discovery の成果を sdd-workshop の Issue に起票する

`kiro-discovery` の壁打ち結果（あるいは自由な依頼）を、`PrimeBrains/sdd-workshop` の
GitHub Issue として 1 件以上起票し、各 Issue を `pj-sdd-workshop` プロジェクトに紐付け、
「どのアプリの作業か」を示す必須の milestone を付与する。

## 設計：役割分担

Issue 作成の冗長な部分（`gh issue create`、node id 取得、`addProjectV2ItemById`、
フィールド更新 mutation、一時エラーのリトライ）は出力が多く価値が低い。これらは
**main の会話コンテキストには持ち込まず**、派遣したサブエージェントの中で実行する。
main では、コードベースとユーザー判断が必要な部分だけを行う。

- **main コンテキスト**: brief を読む、Issue ドラフトを組み立てる、milestone を決める、
  ラベルを推定する、確認ゲートをユーザーと回す。
- **サブエージェント**（`sdd-issue-creator`）: 確定済み（承認済み）の Issue spec を受け取り、
  すべての gh / GraphQL 呼び出しを実行し、コンパクトな要約（番号・URL・各フィールドの結果）を返す。

サブエージェントに製品判断をさせたり、欠けたフィールドを埋めさせたりしないこと。
サブエージェントは承認済みの計画を実行するだけ。曖昧な点は派遣前に main でユーザーと解消する。

## 定数（このリポジトリ専用 — パラメータ化しない）

```
REPO              = PrimeBrains/sdd-workshop
PROJECT           = pj-sdd-workshop  (number 13)
DEFAULT_ASSIGNEE  = pbnakao
```

Projects V2 の id（PROJECT_ID / STATUS_FIELD_ID / Status option）は GraphQL を叩く
`sdd-issue-creator` agent 定義側に持たせている。一元管理してドリフトを避ける。

milestone はハードコードしない — 新しいアプリが増えてもこのスキルを編集せずに済むよう、
実行時に動的取得する。

ユーザー向けの文言（AskUserQuestion の選択肢・進捗・最終報告）はプロジェクトの言語規約に
従い **日本語** で出力する。以下の指示文は英語だが、生成する出力は日本語。

---

## main コンテキスト — ステップ

### 1. 入力ソースの判定

ユーザーが起票したい対象を見極める：

- feature 名の引数 → `.kiro/specs/<feature>/brief.md` を読む。
- 「全部」/ roadmap 参照 → `.kiro/steering/roadmap.md` を読み、`## Specs (dependency
  order)` 配下の feature を取り、各 `.kiro/specs/<feature>/brief.md` を読む。
- ディスク上に brief が無い（Path B の作業や、spec 化しなかったアイデア）→ 会話コンテキスト
  から Issue を組み立てる。brief があれば優先する（Problem / Desired Outcome / Scope が
  既に揃っているため）。

`Glob`/`Read` で brief を探す。パスの存在を前提にせず、必ず確認する。

### 2. Issue ドラフトの作成

各ソースについてドラフトを組み立てる：

- **title**: 簡潔な命令形の 1 行。brief の feature 名 / Problem 見出しを優先。
- **body**（Markdown）: brief の Problem / Current State / Desired Outcome / Approach /
  Scope（In/Out）を統合。ディスク上の brief が出典なら末尾に参照行を付ける。例：
  `> 出典: .kiro/specs/<feature>/brief.md`。spec の丸写しではなくチケットとして読める粒度に。

### 3. milestone の決定（必須・ブロッキング）

milestone はどのアプリの Issue かを示すため必須。一覧を動的取得する：

```bash
gh api repos/PrimeBrains/sdd-workshop/milestones --jq '.[].title'
```

brief のパス / roadmap / キーワードから候補を推定（例：EVM 系 brief → `evm-studio`、
dashboard 系 → `sdd-dashboard`）するが、**必ず下の確認ゲートでユーザーに milestone を
確定**させる。milestone を決められず、ユーザーも指定しない場合は **派遣しない** — 中断して
尋ねる。milestone の無い Issue は決して作らない。

### 4. ラベルの推定

Issue 内容をリポジトリ既存ラベルと照合する：

```bash
gh label list --repo PrimeBrains/sdd-workshop
```

既存ラベルから提案する（新機能は `enhancement`、不具合は `bug`、ドキュメントは
`documentation` が一般的）。既存ラベルのみ提案し、該当が無ければラベルを作らず「なし」とする。

### 5. 確認ゲート（Issue ごと）

各ドラフトを提示し、作成前に `AskUserQuestion` で確認する。提示内容：

- title
- body 要約（数行）
- **milestone**（必須フィールド — 目立たせる）
- labels（推定）
- Status = Todo（プロジェクトの既定ステータス）
- assignee（既定 `pbnakao`）

選択肢は「はい、この内容で」「修正する」（編集は自由入力）。**複数 Issue** の場合はバッチ
レビュー方式に従い、各 Issue を個別に提示・確認 → すべての verdict を集めてから、承認した
セットを最後にまとめて派遣する。却下された Issue は外す。未確認や milestone の無い Issue は
決して派遣しない。

### 6. 作成サブエージェントの派遣

セットが承認されたら、確定 spec を専用の **`sdd-issue-creator`** サブエージェント
（`.claude/agents/sdd-issue-creator.md` に定義）に渡す。手順・定数・ガードレール・出力
フォーマットはすべて agent 定義側に持たせてあるので、渡すのは承認済み Issue spec の JSON
だけでよい。`Agent` ツールで `subagent_type: "sdd-issue-creator"` を指定して派遣する：

```
Create these already-approved issues and report results as your JSON contract:

[
  {"title": "...", "body": "...", "milestone": "evm-studio",
   "labels": ["enhancement"], "assignee": "pbnakao", "status": "Todo"}
]
```

承認バッチ全体を 1 回の派遣で渡す（agent が内部でループする）。gh / GraphQL の手順をここに
再掲しないこと — 定義は agent 側に一元化し、二重管理によるドリフトを避ける。

### 7. 報告（日本語）

サブエージェントが返した JSON を日本語の要約に整形する：各 Issue の番号 + URL、milestone、
labels、assignee、プロジェクト（`pj-sdd-workshop`）、Status、warning。milestone 欠落で
スキップされた warning があれば、その旨を明確に伝え、milestone を決めたら再試行する旨を提案する。

---

## ガードレール

- **milestone は必須。** milestone の無い Issue は決して作らない。未決なら中断して尋ねる
  — デフォルト値で埋めない。
- **確認なしの作成は禁止。** `gh issue create` はユーザーがゲートで承認した後にのみ実行し、
  main ではなく派遣したサブエージェント内で行う。
- **サブエージェントは実行役、判断役ではない。** 製品判断（文言・milestone・ラベル）は先に
  main で確定させる。
- **定数はリポジトリ固有。** このスキルは意図的に `PrimeBrains/sdd-workshop` /
  `pj-sdd-workshop` にハードコードしている。他リポジトリへ一般化しない。
