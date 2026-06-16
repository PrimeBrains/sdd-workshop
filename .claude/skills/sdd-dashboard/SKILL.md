---
name: sdd-dashboard
description: cc-sdd の spec ドキュメント(.kiro/specs / .kiro/steering)をブラウザで閲覧する spec-viewer ダッシュボードを起動・停止・状態確認する。「sdd-dashboard 起動して」「ダッシュボード起動」「spec 見せて」「spec 一覧見せて」「ダッシュボード停止」「ダッシュボード止めて」「ダッシュボードの状態」「ダッシュボード更新して」などの会話で発火する。カレントプロジェクトの .kiro/ を読み取り専用で可視化する薄い起動レイヤー。
---

# sdd-dashboard(spec-viewer 起動スキル)

cc-sdd で生成された spec ドキュメント群(`.kiro/specs/{feature}/` の requirements / design / tasks 等と spec.json、`.kiro/steering/`)を、ブラウザの Web UI で一覧・閲覧・俯瞰するためのローカルダッシュボード spec-viewer の **起動レイヤー**。

このスキル自身はアプリ本体を含まない。すべての起動・停止・状態確認・更新は同梱の `launcher.mjs`(node 標準モジュールのみ・依存ゼロ)に委譲し、Claude はその出力 JSON を解釈して会話に要約提示するだけの薄い層に徹する。

## 何をするスキルか

- ユーザーが会話で起動・停止・状態確認・更新を指示する。
- Claude は `launcher.mjs` を 1 回呼び出す。
- launcher が出力する 1 行 JSON を解釈し、URL 提示・案内・更新提案を会話で行う。

アプリは閲覧対象プロジェクトのファイルを一切変更しない(読み取り専用)。localhost のみで待ち受ける。

## 起動と構造化モデル生成(起動を先に・生成は更新/任意の追いつき)

「起動して」と「更新して(構造化モデルの生成)」を**分離する**。**起動を構造化モデルの生成でブロックしない**(要件 7.4)。

1. **「起動して」= launcher をすぐ叩く**。`launcher.mjs start` を実行するだけで、`spec-model` は実行しない。サーバ(consumer)は構造化モデルが無くても標準解析(#28 決定的パース)へ自動フォールバックするため、ダッシュボードは**即座に閲覧できる**。「モデル生成の前に、まずさっと起動したい」を満たす。
2. **「更新して」/「モデル(再)生成して」/「トレーサビリティを更新して」= `spec-model` を実行**。`spec-model` はカレントプロジェクト絶対パスを受け取り、各 spec の `requirements.md` / `design.md` / `tasks.md` を**サブエージェントへ委譲して**意味で読み取り、言語・書式に頑健な構造化モデル(JSON)を dashboard キャッシュ(`<root>/cache/<projectHash>/<feature>.json`)へ書き込む(対象プロジェクトには書かない・読み取り専用)。`GET /api/specs/{feature}/traceability` がそれを優先利用する。**起動済みなら再起動は不要**(次の表示要求から反映)。未起動なら続けて `launcher.mjs start`。
3. **任意の追いつき**: 起動後に、より精緻な(言語非依存の)トレーサビリティが欲しくなったら、ユーザーの判断で「更新して」を実行すればよい。起動はそれを待たない。

鮮度モデル(要件 7.1, 7.2):

- 「更新して」の指示で `spec-model` を(再)生成する。以後の表示に最新の構造化モデルが反映される。
- ブラウザ上の編集や対象ファイルの変更へ**ライブ自動追従はしない**。構造化モデルの生成・更新はユーザーの明示的な「更新/モデル生成」指示時にのみ行う。

生成の失敗・不在時のフォールバック(要件 7.4):

- 構造化モデルが無い・生成に失敗した・対象 spec が無い場合でも、サーバは標準解析(#28 決定的パース)へ自動フォールバックするため、空表示に転落しない。これにより「起動して」は常に成立する。

launcher は LLM フリーのまま不変:

- AI 実行は会話側(`spec-model` スキル)に閉じる。`launcher.mjs` は構造化モデルの生成も AI 実行も行わない(LLM フリーを維持する)ため、**`launcher.mjs` は変更しない**。

### ユーザーへの案内文言(起動時)

起動できたら、利用者には次の表現で案内する(内部語を出さず、「トレーサビリティ」1 概念の "簡易↔AI解析" の 2 段階で言い切る。`.kiro/steering/ux-principles.md` の文言原則に従う):

> 起動しました。すぐ閲覧できます。要件↔設計/タスクの対応(トレーサビリティ)は、いまは**簡易表示**です。**AI 解析でより正確にしたい**ときは「更新して」と言ってください。

- 利用者向けの案内に「構造化モデル」「標準解析」などの**内部語を混ぜない**(成果物/手段/結果がバラバラだと繋がらない)。主語は「トレーサビリティ」一つに固定し、**簡易表示(いま) ↔ AI 解析(更新で)** の対比だけで述べる。

## launcher 呼び出し規約

launcher は `<skill-dir>/launcher.mjs` にある(この SKILL.md と同じディレクトリ)。`<skill-dir>` はこのスキルが配置された絶対パスに読み替えること。`<カレントプロジェクト絶対パス>` は、ユーザーが今いる(ダッシュボードで見たい)プロジェクトのルート絶対パスを指す。

```bash
# 起動
node <skill-dir>/launcher.mjs start --project <カレントプロジェクト絶対パス>

# 停止
node <skill-dir>/launcher.mjs stop --project <カレントプロジェクト絶対パス>

# 状態確認
node <skill-dir>/launcher.mjs status --project <カレントプロジェクト絶対パス>

# 更新(配布スキル単体=キャッシュモードのとき。アプリ実体を最新へ更新)
node <skill-dir>/launcher.mjs update

# スキル同期(アプリ正本の SKILL.md 群を対象プロジェクトの .claude/skills/ へ最新化)
# update 後や、spec-model 未インストール時に実行する。`.kiro/` には触れない。
node <skill-dir>/launcher.mjs sync-skills --project <カレントプロジェクト絶対パス>
```

- `--project` には必ず**絶対パス**を渡す(相対パス・`~` は使わない)。
- 1 つの会話指示につき launcher の呼び出しは原則 1 回。出力 JSON が出たら追加で叩かない。
- 初回起動(配布スキル単体=キャッシュモード)はアプリの取得・ビルドで時間がかかる。launcher は進捗を stderr に出すので、ユーザーには「初回セットアップ中(アプリの取得・ビルド)です。少しお待ちください」と案内する。

## 出力 JSON の解釈と会話への要約提示ルール

launcher は stdout に **1 行 JSON** を出力する(進捗ログは stderr。混同しないこと)。`status` フィールドで分岐する。

| status | 意味 | 会話での提示 |
|--------|------|--------------|
| `started` | 新規に起動した | 既定ブラウザが開いた旨を伝え、`url` を必ず会話にも提示する(例: `http://127.0.0.1:<port>`)。 |
| `running` | 既に起動済み(二重起動せず既存を返した) | 「すでに起動しています」と伝え、`url` を提示する。 |
| `stopped` | 停止した / もともと未起動 | 停止した旨を伝える。`message: "not running"` のときは「起動していませんでした」と伝える。 |
| `ready` | キャッシュのセットアップ完了(setup) | セットアップ完了を伝える。 |
| `updated` | 更新完了(update) | 最新版へ更新した旨を伝える(`sha` があれば短縮 SHA を添えてよい)。`message` に「スキルを最新化するには `sync-skills` を実行」とあるので会話に反映し、必要なら実行を提案する。 |
| `skills-synced` | スキル同期完了(sync-skills) | 対象プロジェクトの `.claude/skills/` へスキルを最新化した旨を伝える(`synced` の相対パスを列挙してよい)。 |
| `error` | 失敗 | `message` をそのまま提示し、対処(例: `--project` の確認、`npm run build` 済みか)を促す。 |

追加フィールドの扱い:

- `url` / `port`: `started` / `running` で返る。URL は必ず会話に提示する(ブラウザ自動オープンに失敗しても、ユーザーが手動で開けるようにするため)。
- `updateAvailable: true`: アプリの新しいバージョンがリモートにある(キャッシュモードのみ)。**自動更新はしない**。会話で「新しいバージョンがあります。更新しますか?(`update` を実行します)」と **更新を提案**する。ユーザーが了承したら `node <skill-dir>/launcher.mjs update` を実行する。
- `message`: あれば内容をそのまま会話に反映する(更新提案文・初回セットアップ案内・エラー詳細など)。

`.kiro/` が対象プロジェクトに無い場合でも launcher の起動自体は成功する(`started` を返す)。UI 側に「spec が存在しない」案内が出る旨を必要に応じて添えてよい。

## 動作モード(launcher の自動判定)

launcher は配置状況からモードを自動判定する。Claude が意識して切り替える必要はない。

- **リポジトリ内モード**(ドッグフーディング・開発): `launcher.mjs` の隣にアプリのビルド成果物(`../server/dist/index.js`)があるとき。ローカルの成果物をそのまま使って即起動する。
- **配布スキル単体モード**(キャッシュモード): アプリ実体が隣に無いとき。`~/.sdd-dashboard/app` にアプリを `git clone` + `npm ci` + build してキャッシュし、以後はそこから起動する。初回はセットアップ待ちが発生し、2 回目以降は即起動。起動時にリモート最新コミットと比較して `updateAvailable` を判定する。
- アプリの取得元は環境変数 `SDD_DASHBOARD_REPO_URL` で上書きできる(既定: `git@github.com:PrimeBrains/sdd-dashboard.git`)。既定の SSH URL での取得に失敗した場合は HTTPS へ自動フォールバックする(明示指定時はフォールバックしない)。

`sync-skills` のスキル正本も同じモード判定に従う。キャッシュモードでは `~/.sdd-dashboard/app/skill/` を、リポジトリ内モードではリポの `skill/` を正本として、対象プロジェクトの `.claude/skills/` へコピーする。`update` でアプリ実体を更新しても**対象プロジェクトの SKILL.md コピーは自動同期されない**ため、`update` 後は `sync-skills` を明示実行する(launcher も `update`/`updateAvailable` の `message` でこれを促す)。

## 構造化モデルが未生成のとき(producer 未実行)の案内

起動後、対象プロジェクトの dashboard キャッシュに構造化モデルがまだ無い(producer = spec-model が一度も走っていない)場合、UI は標準解析で表示される。Claude は会話で利用者に**どちらにするか確認**する。

1. 「いまは標準解析で表示しています。AI 解析(構造化モデルによる、言語・書式に頑健なトレーサビリティ)に切り替えますか?」と尋ねる。
2. **切り替える**なら: `spec-model` を実行して構造化モデルを生成し、「更新して」(spec-model → launcher の順)で以後の表示に反映する。spec-model が**未インストール**(対象の `.claude/skills/spec-model/` が無い)なら、先に `sync-skills --project <絶対パス>` でスキルを設置してから実行する。
3. **そのままでよい**なら: 標準解析の表示のまま続行する(空表示にはならない)。

## 他プロジェクトへのインストール手順

dashboard を他プロジェクトで使うには、**2 つのスキルを同梱インストール**する。

1. **sdd-dashboard**(起動レイヤー / consumer): `SKILL.md` + `launcher.mjs` を `<対象>/.claude/skills/sdd-dashboard/` へ。
2. **spec-model**(producer): `SKILL.md` + `spec-model-cache.mjs` を `<対象>/.claude/skills/spec-model/` へ。

> **重要**: spec-model を入れないと、起動/更新時に AI 解析(構造化モデル)が生成されず、サーバは標準解析(決定的パース)へフォールバックする。空表示にはならないが、AI 解析ベースのトレーサビリティ等は得られない。AI 解析を使いたいなら spec-model も必ず同梱すること。

```bash
# 方法 A: コピー(推奨。git で扱いやすい)
# (1) sdd-dashboard(consumer)
mkdir -p <対象プロジェクト>/.claude/skills/sdd-dashboard
cp <この skill ディレクトリ>/SKILL.md <この skill ディレクトリ>/launcher.mjs \
   <対象プロジェクト>/.claude/skills/sdd-dashboard/

# (2) spec-model(producer)— これが無いと標準解析にフォールバックする
mkdir -p <対象プロジェクト>/.claude/skills/spec-model
cp <この skill ディレクトリ>/spec-model/SKILL.md <この skill ディレクトリ>/spec-model/spec-model-cache.mjs \
   <対象プロジェクト>/.claude/skills/spec-model/

# 方法 B: 配置済みの dashboard から sync-skills で一括同期(後述)
node <対象>/.claude/skills/sdd-dashboard/launcher.mjs sync-skills --project <対象プロジェクト絶対パス>
```

配置した先にはアプリ実体(`server/` `web/`)が無いため、launcher は自動的に**配布スキル単体モード(キャッシュモード)**で動作する。初回起動時に `~/.sdd-dashboard/app` へアプリを取得・ビルドし、以後はキャッシュから起動する。対象プロジェクトに Node.js / git / npm があれば追加セットアップは不要。

> 正本(source of truth)は本リポジトリの `skill/` ディレクトリ。`.claude/skills/sdd-dashboard/` `.claude/skills/spec-model/` 配下はそこからのコピーなので、`skill/SKILL.md` / `skill/launcher.mjs` / `skill/spec-model/*` を更新したら **対応するコピー先へ再コピー**して同期すること(二重管理に注意)。
