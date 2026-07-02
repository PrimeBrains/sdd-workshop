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

## Moira トラッキング規約（発火はここが起点）

**cc-sdd の各フェーズの節目で、必ず `/moira-track <phase>` を呼んで Moira に記録すること。**
これが「kiro を回すだけで Moira が埋まる」体験の要。打鍵は **Claude の責務**（ユーザーは叩かない）。

- **発火トリガー表（正）**: [`.kiro/steering/moira-track.md`](.kiro/steering/moira-track.md) —
  節目→`/moira-track <phase>` の対応表と柵（🔒 deny／🔔 助言）の早見表。steering として常時ロードする。
- 発火の中身（正しいイベント列・着手ゲート・AC・5 判断の人間確認）は `moira-track` スキル（SKILL.md／reference.md）が持つ。
- 発火の取りこぼしは hooks が決定的に検知する: `.claude/hooks/moira-fire.mjs` が `.kiro/specs/**` の
  編集検知とセッション開始時の drift 注入で助言し、`moira-guard.mjs` が `--parent` 無し add を deny する。
- 取りこぼしの突き合わせ・追いつきは `/moira-track sync`（read-only の検査は `moira adapter drift`）。
- このアダプタ一式（skill／hooks／steering 表）は `moira adapter install` が設置する管理ファイル
  （状態確認: `moira adapter status`・正本は `moira/cli/templates/`）。

## 開発ルール

- 思考は英語、生成物（requirements.md 等）は spec.json の language（既定 ja）で書く。
- 1% でも関係しそうなら該当スキルを必ず起動する。**発火トリガー**（steering の表）を飛ばさない — 各フェーズ後の `/moira-track`、start 前の着手ゲート、done 後の AC。
- 人間の承認なしにフェーズを先に進めない（3 フェーズ承認）。

## Steering Configuration

- `.kiro/steering/` 全体をプロジェクトメモリとしてロードする（`moira-track.md` の発火トリガー表を含む）。

## Moira をもっと知る

- 正典モデル: [`../../MODEL.md`](../../MODEL.md)／CLI: [`../../cli/README.md`](../../cli/README.md)
- 体験の手本（通しの弧）: [`../../../.kiro/scenarios/flows/new-feature-happy-path.md`](../../../.kiro/scenarios/flows/new-feature-happy-path.md)
