# moira CLI

`moira` を**自分のリポジトリにインストールして起動**するための CLI。追記専用4イベントを記録し、
EVM 導出（`moira show`）と React ダッシュボード（`moira ui`）を立ち上げる。CLI 本体は sdd-workshop
チェックアウトに残り、各リポジトリは `.moira/`（イベントログ等）だけを持つ（git/eslint と同じモデル）。

> 書き込み経路が CLI である理由・設計意図（write=skill）との関係は
> [ADR-0001](../../.kiro/adr/0001-moira-cli-write-path.md) を参照。MODEL は一切変更していない。

## インストール（1度だけ・レジストリ公開不要）

```bash
# sdd-workshop 内で
cd moira/backend  && npm install && npm run build   # エンジン（型付き dist）
cd ../frontend    && npm install && npm run build   # ダッシュボード（moira ui が配信）
cd ../cli         && npm install && npm run build && npm link   # → グローバル `moira`
```

`npm link` でグローバルコマンド `moira` が入る（`npx moira …` でも可）。

## 使い方（任意のリポジトリで）

```bash
cd /path/to/my-todo-app

moira init --me me --label "TODO アプリ"        # .moira/ を作る
moira add add-task --estimate 3 --label "タスク追加"   # フィーチャー/ノードを分解（見積案）
moira agree add-task                            # 見積合意（人間の確約）
moira assign add-task --to me --slot 2026-06-22 # 担当＋着手予定（人間の確約）
moira start add-task                            # → implementing
moira done  add-task                            # → implemented（出来高 獲得）
moira accept add-task                           # → accepted
moira cost  add-task 4                          # 実コスト（人日）
moira show                                      # ターミナルに EVM 導出
moira ui                                        # ブラウザでダッシュボード（自分のログ）
```

## コマンド

| コマンド | 何をするか | 発行イベント |
|---|---|---|
| `moira init [--me <id>] [--label "<proj>"] [--root <id>] [--asOf <date>]` | `.moira/` を初期化 | — |
| `moira add <id> [--estimate <md>] [--parent <id>] [--label "..."] [--actor <who>]` | ノードを親の下に分解（未見積可） | `decompose` |
| `moira agree <id> [--budget <md>]` | 見積合意（**human 限定**） | `transition`(estimate-agreement→agreed) |
| `moira assign <id> --to <who> [--reviewer <who>] [--slot <date>]` | 担当＋レビュー担当＋着手予定 | `transition`(lifecycle→ready) |
| `moira start\|done\|accept\|cancel <id> [--actor <who>]` | lifecycle 遷移 | `transition`(lifecycle) |
| `moira cost <id> <md> [--actor <who>]` | 実コスト記録 | `cost` |
| `moira relate <from> <to> [--kind dependency\|supersede] [--policy ...] [--remove]` | 辺の追加/削除 | `relate` |
| `moira capacity <who> <YYYY-MM-DD> <c> [--reason ...]` | 日次容量 c(i,d) | （capacity 層） |
| `moira show [--asOf <date>] [--startDate <date>] [--json]` | 導出スナップショット | （読み取り） |
| `moira log` | イベント一覧 | （読み取り） |
| `moira ui [--asOf <date>] [--port <n>] [--no-open]` | ダッシュボード起動 | （読み取り） |

- **who**: 素の id（＝human）／`agent:claude`／`human:alice`。
- **5つの人間判断**（見積合意・割当・容量・スコープ・見積深さ）は actor=human で記録される
  （`agree` は agent では fold に拒否される）。`start/done/cost/add` は `--actor agent:claude` で AI 作業を表せる。

## 自動化・スキルからの呼び出し

各コマンドは「イベント1発ずつ」の emit プリミティブ。独自スキル・Claude Code hook・git フック・CI が
開発の節目で `moira <cmd>` を呼べば、ログが自然に溜まる。検証用 playground
（`../examples/todo-playground/`）の `moira-track` スキルが、`kiro-*` ライフサイクル → CLI 呼び出しの
ブリッジ実例。

## データ（`.moira/`）

| ファイル | 役割 |
|---|---|
| `events.json` | 追記専用4イベントログ（単一真実源） |
| `capacity.json` | c(i,d) 第二層 |
| `labels.json` | 表示用ラベル（**MODEL 外**・イベントには載せない） |
| `config.json` | projectRoot / me / 既定 asOf |
