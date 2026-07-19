# 構成: sdd-workshop

> moira 関連の steering は専用リポジトリへ移転しました（2026-07-20、issue #42）。詳細は [`moira/README.md`](../../moira/README.md)。

## リポジトリ構成

```
sdd-workshop/
├── .claude/skills/   # cc-sdd 標準スキル + ワークショップ運用スキル
├── .kiro/            # steering・spec（ワークショップ中に生成）
├── atelier/          # コンテンツ制作場（対話ログ・ドラフト・スライド）
├── evm-studio/        # EVM ハンズオン用プロトタイプアプリ（server/client）
├── mockup/            # UI モックアップ（使い捨て）
├── CLAUDE.md
└── README.md
```

## atelier/ の内部構成

- `dialogues/` → `drafts/` → `slides/` — 対話セッション（`dialogue-session`）→ ドラフト抽出（`atelier-draft`）→ スライド化（`draft-to-slides`）の制作パイプライン
- `docs/` — 完成品の置き場、`learning/` — 学習メモ（詳細は `atelier/README.md`）

## spec の命名と scope

- 現行の `.kiro/specs/` は基本的に空（ワークショップ実施時にハンズオンで生成される）。
- `.kiro/specs/moira-*` は使い捨てアーカイブとして残置のみ（#40 裁定）。新規開発では使わない。

## Single Source of Truth

- ワークショップの進め方・モジュール構成はルート [`README.md`](../../README.md) が正とする。
- steering 各ファイルは事実を複製せず、詳細は各構成物内のドキュメント（`atelier/README.md` 等）を指す。
