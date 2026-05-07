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

| # | タイトル | 形式 | 時間 |
|---|----------|------|------|
| 0 | イントロダクション | 講義 | 15分 |
| 1 | なぜ仕様駆動開発か | 講義 | 30分 |
| 2 | cc-sdd ワークフロー全体像 | 講義 | 30分 |
| 3 | ハンズオン: Forward flow（新規機能） | 実習 | 60分 |
| 4 | ハンズオン: Backward flow（既存改修） | 実習 | 30分 |
| 5 | ハンズオン: ステアリング強化 | 実習 | 30分 |
| 6 | ハンズオン: 仕様変更と保守 | 実習 | 40分 |
| 7 | ハンズオン: テスト・レビュー実践 | 実習 | 40分 |
| 8 | チーム運用 | 講義+ディスカッション | 40分 |
| 9 | まとめ・Q&A | — | 15分 |

**合計: 約5時間40分**（前半/後半の分割開催も可）

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
