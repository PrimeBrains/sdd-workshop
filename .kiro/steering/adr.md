# ADR（Architecture Decision Record）規約

プロジェクト横断のアーキテクチャ決定を `.kiro/adr/` に記録する。
spec 内の決定は design.md（Boundary Commitments 等）に書き、**複数 spec に影響する決定・spec の外で行った決定**だけを ADR に昇格させる。

## 置き場と命名

- ディレクトリ: `.kiro/adr/`
- ファイル名: `NNNN-<kebab-slug>.md`（例 `0001-event-log-persistence.md`）。NNNN は 4 桁連番で欠番を作らない
- テンプレート: `.kiro/adr/template.md`

## フォーマット

YAML frontmatter（機械可読部）+ 本文（人間可読部）の二部構成。

```yaml
---
id: 1
title: 決定の短い表題
status: accepted        # proposed | accepted | deprecated | superseded
date: 2026-06-10
app: moira              # 所属アプリ（spec.json の app と同じ語彙）。リポジトリ横断の決定は null
specs: [moira-core]     # 関連 spec（なければ []）
requirements: []        # 関連要件。trace-notation.md のクロス spec 形式（例 moira-core/1.2）
supersedes: null        # 置き換える ADR の id
superseded_by: null     # 置き換えられた場合の ADR の id
---
```

本文セクションは `## Context`（背景・制約）/ `## Decision`(決定内容と理由) / `## Consequences`（正負の帰結）の 3 つを必須とし、`## Alternatives`（棄却案）は任意。

## ライフサイクル

- `proposed` で起票 → 合意で `accepted`
- 決定を覆すときは**既存 ADR を編集せず**新しい ADR を起こし、旧 ADR の `status: superseded` と `superseded_by` を更新する（履歴を消さない）
- frontmatter の `status` / `date` / 相互参照はツール／エージェントがパースするため、キー名と値の語彙を変えない
