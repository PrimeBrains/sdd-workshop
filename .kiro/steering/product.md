# プロダクト: sdd-workshop

> moira 関連の steering は専用リポジトリへ移転しました（2026-07-20、issue #42）。詳細は [`moira/README.md`](../../moira/README.md)。

## これは何か

sdd-workshop は、Claude Code + Spec-Driven Development（仕様駆動開発）を実践で学ぶ**社内ワークショップ用の教材リポジトリ**である。プロダクトそのものではなく、ワークショップのコンテンツ制作物・ハンズオン用プロトタイプ・cc-sdd スキル群を収める。

## 対象者

- Claude Code を触ったことがある、または触り始めているエンジニア
- 仕様駆動開発の考え方をハンズオンで体験したい社内メンバー

## 主な構成物

- **atelier/** — ワークショップコンテンツ（対話ログ・ドラフト・スライド）の制作場。`atelier-draft` / `dialogue-session` / `draft-to-slides` スキルで生成する。
- **evm-studio/** — EVM（Earned Value Management）体験用のハンズオン・プロトタイプアプリ（server/client）。
- **mockup/** — UI モックアップ（使い捨てプロトタイプ）。
- **.claude/skills/** — cc-sdd 標準スキル群、およびワークショップ運用専用スキル（kiro-issue, commit-push, atelier 系, sdd-dashboard 等）。

## スコープ外

- moira（プロジェクト管理基盤）は本リポジトリのスコープ外。専用リポジトリ https://github.com/PrimeBrains/moira を参照する。
- `.kiro/specs/moira-*` は使い捨てアーカイブとして残置されているのみで、現行の開発対象ではない（#40 裁定）。
