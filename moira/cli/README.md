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
| `moira report [--asOf <date>] [--prev <date>] [--days <n>] [--json] [--out <file>] [--save-dir <dir>]` | **朝会ダイジェスト**（issue #25・`moira-evm-digest` スキルの中核）: 現況ペア読み・前回比 Δ・期間の出来事・キュー・feature 別内訳・着地予測 vs 期日・直近 n 営業日の推移（既定 5、`--days 0` で省略）。「前回」は保存スナップショットではなく**同一ログの as-of 導出**（(ts,id) ≤ cut の prefix 再 fold・TE03）。`--prev` 既定 = 直前営業日（土日+日本の祝日をスキップ。祝日は同梱静的データ 2025–2027・範囲外は警告して土日のみ）。日境界は UTC 暦日（landing 導出と同一規律）。**保存**: `--out <file>` で任意パスへ、`--save-dir <dir>` で `<dir>/moira-report-<projectRoot>-<asOf>.md` を生成（dir は自動作成・stdout にも出力・保存先は stderr の `saved:`） | （読み取り） |
| `moira log` | イベント一覧 | （読み取り） |
| `moira ui [--asOf <date>] [--port <n>] [--no-open]` | ダッシュボード起動。**稼働中の追記は自動反映**（fs.watch→SSE。反映が見えなければブラウザをリロード——`/` は毎リクエスト最新を焼き込む。再起動は不要） | （読み取り） |
| `moira ui --portfolio <portfolio.json> [...]` | **ポートフォリオ表示**（issue #23・D-73）: 複数 home を読み取り専用で並置（案件並置＋人横断＋ドリルダウン）。読めた home を fs.watch（home 増減・起動時に読めなかった home の修復反映は再起動。ブラウザ再読込は常に最新）。下記「ポートフォリオ」参照 | （読み取り） |
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

## ポートフォリオ（複数 home の読み取り並置・issue #23）

複数案件を束ねて見る `moira ui --portfolio <portfolio.json>`（D-73・ADR-0005）:

```jsonc
{
  "schemaVersion": 1,
  "label": "部門ポートフォリオ",          // 任意（表示用）
  "homes": [
    { "path": "../proj-a" },             // home root（.moira を含むディレクトリ）or .moira ポインタ（1ホップ）
    { "path": "../proj-b", "label": "案件B" }   // label で表示名を上書き（既定は home の project label）
  ]
}
```

- **並置であって合成ではない**: 各 home はエントリごとに独立に解決・導出され、イベントログは
  マージされない（ADR-0003 の「複数 home のマージ・集計 API は存在しない」は解決系/ログ層の
  言明で、本機能後も真。提示層の件数合算はその射程外 — ADR-0005 Consequences）。
- 案件行の数値は、**同じ基準日なら**その案件を単独で `moira ui` したときと完全に同じ。
  既定の統一基準日（下記）は案件自身の config.asOf とは異なり得る点に注意。
- 横断で合算するのは**読めた案件の件数のみ**（レビュー待ち・構造エラー。件数はノード分解の
  粒度に依存するため案件間比較には向かない）。EV%/SPI/CPI の横断合成値は出さない
  （単位は共通で計算自体は可能だが採らない設計判断 — D-73/ADR-0005）。
- 人横断ビューは **Actor.id の一致のみ**で束ねる（容量整合の強制はしない — D-50。開示文言が常設される。
  「同日複数案件」は完了予定日/凍結スロットの同日一致であり容量超過の判定ではない）。
- 統一 asOf = `--asOf` > **読めた home** の config.asOf の最大 > 今日（帰結の開示は ADR-0005 Decision 6）。
- home 単位の読込失敗は**エラー行として表示**される（起動失敗になるのは portfolio.json 自体の
  不備＝読取不能/JSON 不正/スキーマエラー/home 重複と、読める home がゼロのとき）。

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
