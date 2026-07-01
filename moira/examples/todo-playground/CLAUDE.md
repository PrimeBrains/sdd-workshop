# TODO アプリ playground — cc-sdd × Moira 体験リポジトリ

これは **検証用のサンプルリポジトリ**です。シンプルな TODO アプリを cc-sdd（仕様駆動開発）で作りながら、
その開発ライフサイクルが **Moira**（仕様駆動 × チケット駆動 × EVM の管理基盤）にどう写るかを体験します。
`/kiro-discovery` から開発を一通り回すと、`.kiro/scenarios/flows/new-feature-happy-path.md` と同じ筋で
Moira の達成率（EV%）・見積カバレッジ・lifecycle の「正直な弧」が立ち上がります。

## このプロジェクト（作る対象）

- **製品**: ごくシンプルな TODO アプリ（タスクの追加・一覧・完了など）。技術スタックは discovery で決める。
- 目的は「動く TODO」そのものより、**SDD のフローと Moira の可視化を体験する**こと。

## cc-sdd ワークフロー（3 フェーズ承認）

`/kiro-discovery "<アイデア>"` → `/kiro-spec-init` → `/kiro-spec-requirements` → `/kiro-spec-design`
→ `/kiro-spec-tasks` → `/kiro-impl`。各フェーズは人間レビュー必須。詳細は各スキル（`.claude/skills/kiro-*`）。

- Steering: `.kiro/steering/`／Specs: `.kiro/specs/`
- 進捗確認: `/kiro-spec-status {feature}`

## 発火トリガー（これを見たら必ず打つ・発火漏れ防止）

打鍵は **Claude の責務**（ユーザーは叩かない）。次の「きっかけ」を見たら、対応する発火を**飛ばさない**:

| きっかけ（トリガー） | 必ず発火するもの | 柵 |
|---|---|---|
| cc-sdd の節目に到達（下の規約表の各行） | 対応する `/moira-track <phase>`（詳細は下表） | — |
| `moira add` を打つ | **必ず `--parent <正しい親>`**（省略は root 二重辺＝issue #5） | 🔒 hook が deny |
| ノードを **start する前** | **着手ゲート**: 見積 agreed＋担当＋着手予定日(slot) を確認。未充足なら 見積合意 → `moira assign --slot` を先に | 🔔 hook |
| `moira assign` を打つ | assign は lifecycle を **ready へ戻す**。**完了済み(accepted 等)に assign しない**・baseline は着手前 | 🔔 hook |
| ノードを **done した直後** | **AC 記録**: `moira cost <node> <実工数md>`（実測・捏造しない・累積加算） | 🔔 hook |
| moira に **イベントを追記した後** | `moira ui` を**再起動**（起動時スナップショットのためリロードでは反映されない） | 🔔 hook |
| **5 人間判断**に触れる（見積合意・割当・容量・スコープ・見積深さ） | emit 前に**人間へ確認**（`moira agree` は human 記録＝無断 AI 実行は人間の確約を偽装。`--actor agent:*` は fold が拒否） | — |

> ここは「いつ発火するか」の早見表。🔒 = `.claude/hooks/moira-guard.mjs` が **deny で強制**（`--parent` 無し add の1件のみ）／
> 🔔 = additionalContext で**助言**（無視可能ゆえ正しさの最終責任はスキル側。hooks はセーフティネット）。
> 発火の中身（正しいイベント列・着手ゲート/AC の判定手順）は `moira-track` スキルが持つ。

## Moira トラッキング規約（重要）

**cc-sdd の各フェーズの節目で、必ず `/moira-track <phase>` を呼んで Moira に記録すること。**
これが「kiro を回すだけで Moira が埋まる」体験の要。マッピングと emit の詳細は `moira-track` スキルが持つ。

| cc-sdd の節目 | 呼ぶもの |
|---|---|
| `/kiro-discovery` 完了（brief.md） | `/moira-track discovery --feature <name>` |
| spec 着手前に見積を決めた | `/moira-track estimate --feature <name>` |
| `/kiro-spec-requirements` 着手／承認 | `/moira-track requirements --feature <name>` |
| `/kiro-spec-design` 着手／承認 | `/moira-track design --feature <name>` |
| `/kiro-spec-tasks` 着手／承認（実装ノード誕生） | `/moira-track tasks --feature <name>` |
| 実装の見積合意 | `/moira-track estimate-impl --feature <name>` |
| `/kiro-impl` 実装→レビュー→承認 | `/moira-track impl --feature <name>` |

- **5 つの人間判断**（見積合意・割当・容量・スコープ・見積深さ）は、`moira-track` が**確認を取ってから** emit する。
  とくに見積合意（`moira agree`）は human として記録される（`--actor agent:*` は fold が拒否）ため、AI が無断で叩くと
  人間の確約を偽装してしまう——必ず人間の確認を取る。レビューで差し戻したら `moira-track requirements`
  を再度呼べば達成率が後退し「差し戻しは無償でない」が数値で見える。
- いつでも `moira show`（ターミナル）／`moira ui`（ブラウザ）で現状を確認できる。

## 開発ルール

- 思考は英語、生成物（requirements.md 等）は spec.json の language（既定 ja）で書く。
- 1% でも関係しそうなら該当スキルを必ず起動する。**発火トリガー**（上表）を飛ばさない — 各フェーズ後の `/moira-track`、start 前の着手ゲート、done 後の AC。
- 人間の承認なしにフェーズを先に進めない（3 フェーズ承認）。

## Moira をもっと知る

- 正典モデル: [`../../MODEL.md`](../../MODEL.md)／CLI: [`../../cli/README.md`](../../cli/README.md)
- 体験の手本（通しの弧）: [`../../../.kiro/scenarios/flows/new-feature-happy-path.md`](../../../.kiro/scenarios/flows/new-feature-happy-path.md)
