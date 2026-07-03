# Requirements / Design / Tasks 記述スタイル

`.kiro/specs/*/{requirements,design,tasks}.md` を書くときの言語スタイル規約。
本プロジェクトは `spec.json.language: ja` を採用しているが、EARS だけは形式の決定性を保つため英文で書く。読み手の理解負荷を下げるため、**英文 EARS 文の直後に和訳を併記する**。

---

## なぜ二言語併記か

- EARS のトリガー語 (`When` / `If` / `While` / `Where` / `The [system] shall`) は英語仕様。日本語訳でブレが入ると要件のテスタビリティが落ちる。
- 一方で本リポジトリの一次言語は日本語であり、レビュー時の認知負荷は和訳がある方が低い。
- 英文だけ・和訳だけ・英日が文中で混ざる、のいずれも避ける。**英文 1 行 + 和訳 1 行のペア** で並べる。

---

## 適用範囲

| ドキュメント | 適用範囲 |
|---|---|
| `requirements.md` | Acceptance Criteria の各箇条書きに適用。Introduction / Objective / Boundary Context は日本語のみで OK |
| `design.md` | EARS 形式を使う制約・不変則・契約記述に適用。設計理由・図・コンポーネント説明は日本語のみで OK |
| `tasks.md` | Task 本文・詳細 bullet は日本語のみで OK。EARS は通常出現しないため対象外。`_Requirements:_` 参照行はそのまま |

`Introduction` / `Objective` / `Boundary Context` / `Notes` 等の散文セクションは **日本語のみ** で書く。英訳併記は不要 (冗長になる)。

---

## 推奨フォーマット

### Acceptance Criteria（番号付きリスト）

````markdown
#### Acceptance Criteria

1. The system shall persist all state changes solely as append-only events of the four kinds.
   - 和訳: システムは、全状態変化を 4 種の追記専用イベントとしてのみ永続化する。
2. When an estimate is agreed, the system shall record it via a transition emitted by a human actor.
   - 和訳: 見積が合意されたとき、システムは人間が発行する transition でそれを記録する。
````

- インデント付き `- 和訳:` を **1 つ下のレベル** に付ける。
- 英文の末尾に句点 `.` を入れ、和訳の末尾は句点 `。` を入れる。
- バッククォートで囲んだ識別子・ファイルパスは英文・和訳の両方で同じ表記をそのまま使う (翻訳しない)。

### 散文セクション（日本語のみ）

````markdown
**Objective**: 開発者として、進捗を追記専用ログから正直に導出したい。

#### Acceptance Criteria
1. The system shall ...
   - 和訳: ...
````

`Objective` は和訳併記しない (日本語 1 行のみ)。

---

## 良い例 / 悪い例

### ❌ 悪い例 1: 英文 EARS のみ (和訳なし)
````markdown
1. The system shall validate input before persisting.
````
和訳がないと日本語話者のレビューで読み飛ばされる。

### ❌ 悪い例 2: 日本語のみ (EARS 不使用)
````markdown
1. システムは永続化前に入力を検証する。
````
EARS のトリガー語が消え、要件パターン (Ubiquitous / Event-driven 等) が不明瞭になる。

### ❌ 悪い例 3: 英文中に日本語が混在
````markdown
1. The system shall 入力を validate してから persist する.
````
読みづらく、機械可読性も失う。

### ✅ 良い例: 英文 EARS + 和訳併記
````markdown
1. The system shall validate input before persisting it.
   - 和訳: システムは入力を検証してから永続化する。
````

---

## 適用開始

本 playground の全 spec（`.kiro/specs/*`）の requirements / design は本ルールに従う。既存の spec も本ルール
適用時に書き直す（例: `task-add-and-list` の requirements.md を英文 EARS + 和訳併記へ改訂）。

---

## 用語の固定

EARS トリガー語の和訳は混乱を避けるため固定する:

| EARS | 和訳 |
|---|---|
| `When [event]` | 〜したとき / 〜が発生したとき |
| `If [trigger]` | 〜ならば / 〜の場合 |
| `While [precondition]` | 〜である間 |
| `Where [feature is included]` | 〜が含まれる場合 |
| `The [system] shall [response]` | [system] は [response] する |

`shall` は「する」「しなければならない」のいずれでも構わないが、1 つの spec 内では統一する。
