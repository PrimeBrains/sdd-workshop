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
| `moira add <id> [--estimate <md>] [--parent <id>] [--label "..."] [--actor <who>]` | ノードを親の下に分解（未見積可）。`--parent` 省略時は**既存ノードなら現在の親を再利用**、新規ノードのみ root へ（どちらも stderr に明示; issue #5） | `decompose` |
| `moira agree <id> [--budget <md>]` | 見積合意（**human 限定**） | `transition`(estimate-agreement→agreed) |
| `moira assign <id> --to <who> [--reviewer <who>] [--slot <date>]` | 担当＋レビュー担当＋着手予定 | `transition`(lifecycle→ready) |
| `moira start\|done\|accept\|cancel <id> [--actor <who>]` | lifecycle 遷移 | `transition`(lifecycle) |
| `moira cost <id> <md> [--actor <who>]` | 実コスト記録 | `cost` |
| `moira relate <from> <to> [--kind dependency\|supersede] [--policy ...] [--remove]` | 辺の追加/削除 | `relate` |
| `moira capacity <who> <YYYY-MM-DD> <c> [--reason ...]` | 日次容量 c(i,d) | （capacity 層） |
| `moira show [--asOf <date>] [--startDate <date>] [--json]` | 導出スナップショット | （読み取り） |
| `moira log` | イベント一覧 | （読み取り） |
| `moira ui [--asOf <date>] [--port <n>] [--no-open]` | ダッシュボード起動。**稼働中の追記は自動反映**（fs.watch→SSE。反映が見えなければブラウザをリロード——`/` は毎リクエスト最新を焼き込む。再起動は不要） | （読み取り） |
| `moira adapter install\|status\|drift\|uninstall` | cc-sdd アダプタの設置・検査・突き合わせ（下記） | （drift/status/install は読み取り・emit なし） |

- **who**: 素の id（＝human）／`agent:claude`／`human:alice`。
- **5つの人間判断**（見積合意・割当・容量・スコープ/期日・見積深さ）は actor=human で記録される
  （`agree` は agent では fold に拒否される）。`start/done/cost/add` は `--actor agent:claude` で AI 作業を表せる。
- `moira deadline [<YYYY-MM-DD>] [--target <YYYY-MM-DD>] [--reason ...]` — プロジェクトの期日/目標日
  （R-T6 第二層・`.moira/dates.json` に追記専用履歴・latest-wins）。引数なしで現在値表示。

## ログ home の解決（multi-repo・ADR-0003）

作業リポジトリが複数（設計は repo A・実装は repo B）でも、**1 プロジェクトのログは 1 箇所**
（log home の `.moira/`）。全コマンドは home を次の優先順で解決する:

1. `moira --dir <log-home> <command> …` — **グローバルフラグ**（コマンド語の前。
   adapter サブコマンドの `--dir <work-repo>` とは別物で共存可: `moira --dir <home> adapter drift --dir <repo>`）
2. `MOIRA_DIR` 環境変数（CI・一時利用向け。シェル常設はプロジェクト切替時の誤爆に注意 — 常用はポインタ推奨）
3. **`.moira` ポインタファイル**: 作業リポジトリ直下の `.moira` が**ディレクトリでなく通常ファイル**のとき、
   1 行目 `home: <path>`（相対はポインタ置き場基準・**相対推奨**）が home のルートを指す。1 ホップのみ。
   ```
   # work-repo/.moira （ファイル）
   home: ../shared-project-home
   ```
   無ければ**上位ディレクトリを git 式に探索**。
4. カレントディレクトリ（単一リポの従来動作 — 何も設定しなければ挙動は不変）。

`moira init` は上位探索**しない**（git init と同じ入れ子意味論）: 対象 = `--dir` > `MOIRA_DIR` > カレント。
ポインタファイルの上での init は明示エラー（home 側で init する）。
hooks（moira-guard/moira-fire）は **MOIRA_DIR → ローカル `.moira` → ポインタ（1 ホップ）** で home を
見つける（**上位探索はしない** — CLI との意図的非対称・ADR-0003）。
なお **home はどの経路でも常に 1 つ**（複数プロジェクトの容量集計はしない — D-50）。

## 自動化・スキルからの呼び出し

各コマンドは「イベント1発ずつ」の emit プリミティブ。独自スキル・Claude Code hook・git フック・CI が
開発の節目で `moira <cmd>` を呼べば、ログが自然に溜まる。検証用 playground
（`../examples/todo-playground/`）の `moira-track` スキルが、`kiro-*` ライフサイクル → CLI 呼び出しの
ブリッジ実例。

## アダプタ（cc-sdd 連携）— `moira adapter`

任意の cc-sdd プロジェクトに「kiro を回すだけで Moira が埋まる」ブリッジ一式を設置する
（設計は [ADR-0002](../../.kiro/adr/0002-cc-sdd-moira-adapter.md)）:

| サブコマンド | 何をするか |
|---|---|
| `moira adapter install [--force] [--claude-md]` | `moira-track` スキル・hooks（guard=柵／fire=発火検知）・steering 発火表を設置し、`.claude/settings.json` へ hooks を**非破壊マージ**。冪等・manifest（`.claude/.moira-adapter.json`）でバージョン/改変を追跡 |
| `moira adapter status [--json]` | インストール状態（バージョン・ファイル intact/modified/missing・settings 反映・環境）を報告 |
| `moira adapter drift [--json] [--feature <f>] [--check]` | `.kiro`（spec.json/tasks.md）と `.moira` ログを **read-only** で突き合わせ、欠落（hard）・先行（advisory）・人間判断待ち（needs-human）と追いつきコマンド案を報告。`--check` は hard＋needs-human>0 で exit 1 |
| `moira adapter uninstall` | manifest 記載の未改変ファイルと注入 hooks エントリだけを外科的に除去 |

- 設置物の正本は本パッケージの `templates/`（npm link で配布・単一ソース）。
- **チケット駆動の入口**（[ADR-0004](../../.kiro/adr/0004-ticket-driven-flow-adapter.md)）: プロンプト中の
  チケット参照（GitHub/GitLab/Backlog/Jira の issue URL、意図キーワード同伴の `#N`/`KEY-N`）を
  fire hook（UserPromptSubmit）が検知して `/moira-track ticket <ref>` を助言する。振り付け
  （既存パイプライン合流 / plan→実行 / 直接実行）は `moira-track` スキルが持つ（エンジン汎用 —
  provider 設定は不要・チケットへの書き戻しはしない）。
- **drift は emit しない**。追いつき記録は `moira-track` スキルの `sync` フェーズが人間ゲート付きで振り付ける
  （5 人間判断・着手ゲート・AC 実測の規律は通常フェーズと同一）。
- ノード ID 規約（`<f>/req|design|tasks|impl-N|review-impl`）から外れた運用は
  `.moira/adapter.json` の `ignoreFeatures`/`ignoreNodes` で drift 対象から除外できる。

## データ（`.moira/`）

| ファイル | 役割 |
|---|---|
| `events.json` | 追記専用4イベントログ（単一真実源） |
| `capacity.json` | c(i,d) 第二層 |
| `dates.json` | 期日/目標日の第二層（R-T6・追記専用・理由付き・latest-wins） |
| `labels.json` | 表示用ラベル（**MODEL 外**・イベントには載せない） |
| `config.json` | projectRoot / me / 既定 asOf |

作業リポジトリ側の `.moira` が**通常ファイル**の場合はポインタ（`home: <path>`）であり、
データ本体は指し先の home にある（上記「ログ home の解決」）。
