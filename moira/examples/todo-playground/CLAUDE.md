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

## Moira トラッキング規約（重要）

**cc-sdd の各フェーズの節目で、必ず `/moira-track <phase>` を呼んで Moira に記録すること。**
これが「kiro を回すだけで Moira が埋まる」体験の要。マッピングと emit の詳細は `moira-track` スキルが持つ。

| cc-sdd の節目 | 呼ぶもの |
|---|---|
| `/kiro-discovery` 完了（brief.md） | `/moira-track discovery --feature <name>` |
| spec 着手前に見積を決めた | `/moira-track estimate --feature <name>` |
| `/kiro-spec-requirements` 着手／承認 | `/moira-track requirements --feature <name>` |
| `/kiro-spec-design` 着手／承認 | `/moira-track design --feature <name>` |
| `/kiro-spec-tasks` 承認（実装ノード誕生） | `/moira-track tasks --feature <name>` |
| 実装の見積合意 | `/moira-track estimate-impl --feature <name>` |
| `/kiro-impl` 実装→レビュー→承認 | `/moira-track impl --feature <name>` |

- **5 つの人間判断**（見積合意・割当・容量・スコープ・見積深さ）は、`moira-track` が**確認を取ってから** emit する。
  とくに見積合意（`moira agree`）は人間のみ（AI では拒否される）。レビューで差し戻したら `moira-track requirements`
  を再度呼べば達成率が後退し「差し戻しは無償でない」が数値で見える。
- いつでも `moira show`（ターミナル）／`moira ui`（ブラウザ）で現状を確認できる。

## 開発ルール

- 思考は英語、生成物（requirements.md 等）は spec.json の language（既定 ja）で書く。
- 1% でも関係しそうなら該当スキルを必ず起動する。とくに各フェーズ後の `/moira-track` を飛ばさない。
- 人間の承認なしにフェーズを先に進めない（3 フェーズ承認）。

## Moira をもっと知る

- 正典モデル: [`../../MODEL.md`](../../MODEL.md)／CLI: [`../../cli/README.md`](../../cli/README.md)
- 体験の手本（通しの弧）: [`../../../.kiro/scenarios/flows/new-feature-happy-path.md`](../../../.kiro/scenarios/flows/new-feature-happy-path.md)
