---
id: 1
title: MVP の書き込み経路はスタンドアロン moira CLI（将来 write skill 群へ置換）
status: accepted
date: 2026-06-30
app: moira
specs: [moira-core]
requirements: []
supersedes: null
superseded_by: null
---

# ADR-0001: MVP の書き込み経路はスタンドアロン moira CLI（将来 write skill 群へ置換）

## Context

`moira/MODEL.md`(v19) を本番へ落とす CQRS 分解では、**書き（イベント発行・オーケストレーション）は
Claude Code skill ×14**（`.claude/skills/moira-*`）と定めている（`.kiro/steering/roadmap.md`）。
一方で「Moira を自分のリポジトリにインストールして起動し、TODO アプリ案件を管理してみたい」という
MVP 要望に対し、write skill 群はまだ未整備で、参照実装（`moira/backend`/`moira/frontend`）は
read（導出・ダッシュボード）と固定 demo データに閉じており、進捗を記録する書き込み口が無い。

背骨シナリオ（`.kiro/scenarios/flows/new-feature-happy-path.md` §5・`units/impl-completed.md` §7）も、
`kiro-spec-*` の起動/完了が moira のイベントを emit する機構を **`moira-progress`（仮称・⚠未実装）** と
明示しており、この継ぎ目が空いている。

## Decision

MVP の書き込み経路として、**4イベントを emit する単機能コマンド群を持つスタンドアロン `moira` CLI**
（`moira/cli/`、`npx`/`npm link` 配布・レジストリ公開なし）を導入する。各リポジトリは `.moira/`
（events/capacity/labels/config）だけを持ち、CLI 本体は sdd-workshop チェックアウトに残る（global CLI モデル）。

- CLI は **MODEL を変更しない**: 4イベント（transition/decompose/relate/cost）・5判断・
  「見積合意は human 限定（fold が agent 合意を拒否）」をそのまま用いる。
- ラベル等の表示情報は MODEL 外ゆえ**イベントに載せず** `.moira/labels.json` に分離する。
- CLI は emit プリミティブとして設計し（安定 argv・`--json`・終了コード・human 固定の判断コマンド）、
  ユーザーの独自スキル/フックから呼べる。playground ではブリッジスキル `moira-track` が
  `kiro-*` ライフサイクル → CLI 呼び出しを担い、`moira-progress` 継ぎ目の MVP 版を埋める。

これは roadmap の「書 = skill」設計意図と**分岐する暫定措置**であり、本 ADR で明示的に記録する。

## Consequences

- 正: 公開作業なしで「自分のリポジトリで Moira を起動」が即体験できる。エンジン（`moira-backend`）は
  バレル＋型定義を備えた消費可能パッケージになり、将来の write skill / 本番化の土台になる。
- 正: write skill 群が未整備でも、背骨フローの `moira-progress` 継ぎ目を CLI で実体化して E2E 体験が成立する。
- 負（受容したトレードオフ）: 設計意図（write=skill）と一時的に二重化する。CLI は状態機械の厳格
  バリデーションを行わない（構造違反は fold が拒否するが、段階順は強制しない）。永続は JSON ファイルのみ。
- 将来: write skill 群（`moira-*`）が整備されたら、CLI は「skill が内部で叩く emit プリミティブ」へ
  役割を移すか skill に吸収する。その時点で本 ADR を `superseded` にし新 ADR を起こす。

## Alternatives

- **write skill 群を先に実装** — 設計意図に忠実だが MVP には重く、未確定論点（永続・配布）を巻き込む。棄却。
- **read 専用（events.json を手書き）** — 最小だが「進捗を記録して管理」という MVP の核を満たさない。棄却。
- **npm レジストリ公開パッケージ** — 正式だが社内/公開レジストリへの publish 権限・運用が要る。MVP では過剰。棄却。
