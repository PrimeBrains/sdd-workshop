# トレーサビリティ表記法

`.kiro/specs/*/{requirements,design,tasks}.md` 間の参照を機械可読にするための表記規約。
AI エージェントと検証ツールがこの文法を正典としてパースする。

## ID 体系

- **要件 ID**: `<Requirement番号>.<AC番号>`（例 `1.2`）。`### Requirement 1` の `#### Acceptance Criteria` の 1 番目 = `1.1`
- **タスク ID**: tasks.md のチェックボックス番号（例 `3` / `3.2`）
- **設計要素**: design.md は番号でなく**コンポーネント名**（見出し / ファイルパス）で識別する

## 参照リストの文法

要件 ID を列挙する箇所はすべて次の文法に従う。**カバーする ID は省略せず全列挙する**:

```
ref-list = ID ("," SP ID)*
```

- ✅ `1.1, 1.3, 1.4, 1.5, 12.2`
- ❌ `1.3-1.5`（範囲表記禁止 — 生テキストの grep で中間 ID `1.4` がヒットしなくなる。人間も AI エージェントも grep で参照箇所を探すため、ツールを介さない可読性を優先する）
- ❌ `15.*`（ワイルドカード禁止 — 全 AC を個別に列挙する）
- ❌ `8.2（フォールバック処理の生成元）`（注記・括弧・自由記述の混入禁止 — 説明は Summary 列や本文へ書く）
- 列挙された各 ID は requirements.md に実在しなければならない

## 各ドキュメントの宣言箇所

| ドキュメント | 箇所 | 内容 |
|---|---|---|
| design.md | `## Requirements Traceability` テーブル（**必須セクション**） | Requirement 列に ref-list。全要件 ID をいずれかの行でカバーする |
| design.md | コンポーネント詳細の `\| Requirements \|` 行・サマリーテーブルの Req Coverage 列 | ref-list |
| tasks.md | `_Requirements: <ref-list>_` | タスクがカバーする要件 |
| tasks.md | `_Depends: <タスクID列挙>_` / `_Boundary: <コンポーネント/パス>_` | タスク間依存 / 担当境界 |
| ADR | frontmatter `specs:` / `requirements:` | 関連 spec・要件（詳細は [adr.md](adr.md)） |

クロス spec 参照が必要な場合のみ `<feature-name>/<ID>`（例 `moira-core/1.2`）を使う。

## 検証ルール（リンク切れの定義）

1. 参照された要件 ID が requirements.md に存在しない → **リンク切れ**
2. requirements.md の要件 ID が design.md の Traceability テーブルに現れない → **設計未カバー**
3. requirements.md の要件 ID がどの `_Requirements:_` にも現れない → **タスク未カバー**

## 適用範囲

Moira の新規 spec（`.kiro/specs/moira-*`）の生成・更新時に適用する。範囲表記（`1.1-1.6`）・ワイルドカードは新規記述で使用禁止（上記理由）。
