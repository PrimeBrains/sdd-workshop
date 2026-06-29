# TODO アプリ playground（cc-sdd × Moira）

**シンプルな TODO アプリを cc-sdd で作りながら、その開発が Moira（EVM 管理基盤）にどう写るかを体験する**
ためのターンキーなサンプルです。`/kiro-discovery` から開発を一通り回すだけで、Moira ダッシュボードに
[背骨フロー `new-feature-happy-path`](../../../.kiro/scenarios/flows/new-feature-happy-path.md) と同じ
「達成率（EV%）の正直な弧」が立ち上がります。

このフォルダには cc-sdd 一式（`.claude/skills/kiro-*`・`.claude/agents`・`.kiro/settings`）と、
kiro ライフサイクルを Moira に橋渡しする独自スキル [`moira-track`](.claude/skills/moira-track/SKILL.md)、
そして体験を方向づける [`CLAUDE.md`](CLAUDE.md) が同梱済みです。

## セットアップ（1 度だけ）

`moira` CLI をグローバルに入れます（レジストリ公開は不要）。

```bash
# sdd-workshop の中で
cd moira/backend  && npm install && npm run build
cd ../frontend    && npm install && npm run build
cd ../cli         && npm install && npm run build && npm link   # → グローバル `moira`
```

確認: 任意の場所で `moira help` が出れば OK。

## 始め方

1. **この `todo-playground/` フォルダを Claude Code でワークスペースのルートとして開く**
   （配下の `.claude` / `.kiro` / `CLAUDE.md` が有効になる）。
2. そのまま開発を始めるだけ:

   ```
   /kiro-discovery "シンプルな TODO アプリ。まずはタスクの追加と一覧から"
   ```

3. あとは cc-sdd の流れ（`/kiro-spec-init` → `requirements` → `design` → `tasks` → `/kiro-impl`）を進める。
   各フェーズの節目で `CLAUDE.md` の規約に従って **`/moira-track <phase>`** が呼ばれ、Moira にイベントが記録されます。
4. いつでも現状を見る:

   ```bash
   moira show     # ターミナルに EVM 導出（達成率・カバレッジ・レビュー待ち）
   moira ui       # ブラウザでダッシュボード（自分のログ）
   ```

## 背骨フローとの対応（何が見えるか）

| cc-sdd の節目 | `/moira-track` | Moira で見える信号（背骨の弧） |
|---|---|---|
| discovery 完了 | `discovery` | フィーチャー＋3 フェーズが**未見積**で誕生（見積カバレッジ 0%） |
| 見積を決める | `estimate` | 提案→**合意**で分母確定（カバレッジ 100%・達成率 0%） |
| requirements 承認 | `requirements` | 作成完了で達成率が**上がる**／差し戻すと**後退**（無償でない） |
| design / tasks 承認 | `design` / `tasks` | さらに前進。tasks 承認で**実装ノードが未見積で誕生**→カバレッジ低下（見かけ 100% の正直化） |
| 実装の見積合意 | `estimate-impl` | 分母が増え達成率が**正直に低下**（100%→44% 相当） |
| 実装→レビュー→承認 | `impl` | 完了で達成率が上がり、最後に人間が**フィーチャーを承認**＝本物の 100% |

> 見かけ 100% が見積カバレッジ低下で露呈し、新規見積で達成率が落ち、実装完了で本物の 100% に至る——
> という「正直な弧」を、自分の手で回して体験できます。

## 注記

- 書き込み経路が CLI（`moira-track` が叩く）である理由は [ADR-0001](../../../.kiro/adr/0001-moira-cli-write-path.md)。
  Moira の正典モデルは変更していません（4 イベント・5 判断・human 限定合意）。
- `.moira/` は初期化済み（空のイベント列）で同梱。開発を進めると**あなたのイベント**で埋まります（ローカル変更）。
- 5 つの人間判断（見積合意・割当・容量・スコープ・見積深さ）は `moira-track` が**確認を取ってから**記録します。
