# SDD ワークショップ

Claude Code + Spec-Driven Development（仕様駆動開発）を実践で学ぶ社内ワークショップ用リポジトリです。

---

## ワークショップの目的

- SDD の考え方（仕様 = システム各部の「契約」）を腹落ちさせる
- cc-sdd スキルを使った要件 → 設計 → タスク → 実装のサイクルを体験する
- ステアリングにドメイン知識を注入してAIを強化する方法を学ぶ
- 仕様変更時の整合性維持コスト（保守の現実）を体感する
- テスト・レビューの判断基準を探究し、チームのガイドラインを作る
- チームで SDD を運用するためのブランチ戦略・オーナーシップ・段階的導入を学ぶ

---

## 対象者

- Claude Code を触ったことがある、または触り始めているエンジニア
- システム開発部・IT技術研究部のメンバー

---

## 事前準備

ワークショップ当日までに以下の環境を整えてください。

### 1. 必須ツール

- [Claude Code](https://claude.ai/download) のインストールと認証
- Node.js 20 以上

### 2. このリポジトリのクローン

```bash
git clone https://github.com/PrimeBrains/sdd-workshop.git
cd sdd-workshop
```

### 3. 動作確認

```bash
# Claude Code が起動できることを確認
claude --version
```

---

## モジュール構成（予定）

| # | タイトル | 形式 | 時間 | スキル |
|---|----------|------|------|--------|
| 0 | イントロダクション | 講義 | 15分 | — |
| 1 | なぜ仕様駆動開発か | 講義 | 30分 | — |
| 2 | cc-sdd ワークフロー全体像 | 講義 | 30分 | — |
| 3 | ハンズオン: Forward flow（新規機能） | 実習 | 60分 | `kiro-discovery` → `kiro-spec-init` → `kiro-spec-requirements` → `kiro-spec-design` → `kiro-validate-design` → `kiro-spec-tasks` → `kiro-impl` |
| 4 | ハンズオン: Backward flow（既存改修） | 実習 | 30分 | `kiro-validate-gap` → `kiro-spec-design` → `kiro-spec-tasks` → `kiro-impl` |
| 5 | ハンズオン: ステアリング強化 | 実習 | 30分 | `kiro-steering` / `kiro-steering-custom` <!-- TODO: アーキテクチャ詳細設計（クラス図・レイヤー責務）をステアリングに組み込む手法を題材にする。参考: MG_API-feature-2298/.claude/commands/analysis/design-architecture.md --> |
| 6 | ハンズオン: 仕様変更と保守 | 実習 | 40分 | `kiro-validate-gap` / `kiro-debug` |
| 7 | ハンズオン: テスト・レビュー実践 | 実習 | 40分 | `kiro-review` / `kiro-validate-impl` / `kiro-verify-completion` |
| 8 | ハンズオン: 大規模並列開発 | 実習 | 30分 | `kiro-spec-batch` <!-- TODO: 複数機能を並列スペック化→実装するフロー。チーム開発・大規模機能追加のユースケース --> |
| 9 | チーム運用 | 講義+ディスカッション | 40分 | — |
| 10 | まとめ・Q&A | — | 15分 | — |

**合計: 約6時間10分**（前半/後半の分割開催も可）

---

## このリポジトリの構成

```
sdd-workshop/
├── .claude/        # cc-sdd スキル
├── .kiro/          # cc-sdd テンプレート・仕様ファイル（ワークショップ中に生成）
├── CLAUDE.md       # Claude Code 設定
└── README.md       # このファイル
```

> コンテンツファイル（スライド、ハンズオン手順書、練習用アプリ）は順次追加予定です。

---

## 参考リンク

- [cc-sdd 公式ドキュメント（日本語）](https://github.com/PrimeBrains/cc-sdd/tree/main/docs/guides/ja)
- [仕様駆動開発の理想と現実、そして向き合い方（Speaker Deck）](https://speakerdeck.com/gotalab555/shi-yang-qu-dong-kai-fa-noli-xiang-toxian-shi-sositexiang-kihe-ifang)

---

## moira の移転

本リポジトリで育ててきたプロジェクト管理基盤 **moira** は、2026-07-20 に専用リポジトリ
**https://github.com/PrimeBrains/moira** へ移転しました（issue #42）。

以後の moira 関連の開発・ドキュメント参照は新リポジトリで行ってください。本リポジトリに
残る旧パスから新リポジトリへの対応表は [`moira/README.md`](moira/README.md) を参照してください。
