# 受け入れシナリオ（acceptance scenarios）規約 v0.2

AI が生成した spec（`.kiro/specs/`）を、**人間がシナリオベースでレビュー**するための成果物を置く場所。

## なぜ存在するか

`requirements.md` は `moira/MODEL.md` を忠実に参照するため抽象度が高く、非専門家による直接レビューが困難。既存の敵対者ループ（`doc-refine` / `moira-model-update`）が見るのは **内的整合性** であって **外的妥当性** ではない。シナリオがこの欠落を埋める。

- **人間** … シナリオの妥当性（作るべきか／ユーザーが気づけるか）を所有・レビュー
- **moira 専門家エージェント** … MODEL 整合・正しさを検証。**モデルに属する判断はここへ委譲**
- **調停者** … 両者を調整し、未決事項を対話でユーザーに確認し、自己検証ループを回す

## ユニットとフロー（再利用可能な単位）

1 つのシナリオ単位は、より大きな複数のシナリオの異なる箇所で再利用される。よって**位置（stage 番号）を持たせない**。

- **ユニット** … `.kiro/scenarios/units/{slug}.md` — 原子的・再利用可能な振る舞い。`precondition` が成り立つ所ならどこにでも差し込める
- **フロー** … `.kiro/scenarios/flows/{slug}.md` — ユニットを順に合成した E2E。順序はフローが決める（`composes: [units/…]`）

`slug` は kebab-case。日付は付けない（生きた受け入れ基準だから）。

## frontmatter

```yaml
---
id: units/{slug}            # フローは flows/{slug}
title: （日本語一行）
status: draft | in-review | agreed   # spec の approvals に倣う
language: ja
actor: 開発者 | …
surfaces: [spec-value, …]   # 関与する画面（新規予定は名前(新規)と明記）
precondition: （このユニットが適用できる前提状態）
postcondition: （適用後に成り立つ状態）
touches_specs: […]          # 全列挙・範囲禁止（trace-notation.md）
touches_requirements: […]   # 全列挙。詳細トレーサビリティはここに集約し本文には書かない
composes: [units/…]         # フローのみ
---
```

## 必須セクション（ユニット）

1. **このユニットで確かめること** — 1〜2 行、平易
2. **前提（Given）** — precondition の状態（可能なら before 図）
3. **ふるまい（When / Then）** — **平易な言葉**。moira 専門用語・skill 実名は本文に出さない（どうしても要るものは一語ずつ最小注釈）
4. **画面の変化（Before → After）** — グラフィカル必須。**採用した 1 表現のみ**（下記）
5. **出力されるログ（どこに・何が）** — 実在の出力先で具体化
6. **受け入れ条件（EARS）** — 日本語 EARS（WHEN/WHILE … システムは … しなければならない）
7. **決定事項** — 対話で確定した決定**のみ**

## 書かないもの（レビュー負荷を上げない）

- **未決の FORK を本文に残さない**。対話で確認し、決定だけ §7 に書く。判断過程は会話ログ（`spec-conversations.md` 規約）へ
- モデルに属する判断（内部表現・公理整合など）は本文に書かず **moira 専門家へ委譲**
- トレーサビリティ詳細表・MODEL 規則の引用を本文に並べない（frontmatter に集約）
- 比較用の二重表現を agreed 版に残さない（対話中のみ）

## グラフィカル要件

§4 は言葉だけ禁止。最低限：

- **データ表**（Markdown）— HTML が剥がれても読める素の値
- **HTML モックアップ**（インラインスタイル・自己完結）— `moira/frontend` の実挙動に合わせる

画面化が新たに決まったサーフェスは「**(新規)**」と明記する。

## ログ要件（実在の出力先）

1. **プロジェクトの記録（イベントログ）** … `moira/backend` のイベントストア（`event-store.ts` / 型 `types.ts`）への追記。実 JSON を載せる
2. **会話ログ** … `spec-conversations.md` 規約に従い `.kiro/specs/{feature}/conversations/` 等へ（提示案・根拠・決定）
3. **人間が見る画面** … 現状 moira に履歴 UI は無い。画面で見せるなら新規サーフェス要件として明記

## status 遷移

`draft`（人間が起票）→ `in-review`（専門家が MODEL 整合を検証、調停者が未決を対話で解消）→ `agreed`（未決ゼロで凍結）。`agreed` 以降の変更は会話ログに理由を残す。
