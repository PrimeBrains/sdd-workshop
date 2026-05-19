# Research & Design Decisions: defect-pdca

## Summary

- **Feature**: `defect-pdca`
- **Discovery Scope**: Light Discovery — 新規プロセス基盤の導入だが、既存 `kiro-steering-custom` skill との連携 + `.kiro/` ディレクトリ構造の既存パターン踏襲で完結
- **Key Findings**:
  - 既存 `.claude/skills/kiro-*/SKILL.md` は frontmatter (`name` / `description` / `allowed-tools` / 任意で `argument-hint` `disable-model-invocation` `metadata`) + 本文という統一フォーマットを持つ。新 skill 2 つも同形式に従う
  - 既存 `kiro-impl` skill は `templates/` 配下に prompt テンプレを置き subagent dispatch する pattern を持つ → 新 skill でも `templates/` に entry テンプレ・review report テンプレを置けば違和感がない
  - `kiro-steering-custom` は `Write` / `Edit` を持ち、対話的に steering 追記を行う。新 skill 2 つは `Write` を `kiro-postmortem-add` (ledger 追記用) と `Read/Grep` を `kiro-postmortem-review` (集約用) でそれぞれ最小権限で持つ

## Research Log

### 既存 skill 構造の調査

- **Context**: 新 skill 2 つを既存 kiro-* family に違和感なく追加するため
- **Sources Consulted**: `.claude/skills/kiro-impl/SKILL.md`, `.claude/skills/kiro-steering-custom/SKILL.md`, `.claude/skills/kiro-debug/SKILL.md`
- **Findings**:
  - すべて YAML frontmatter で `name` / `description` / `allowed-tools` を持つ
  - `templates/` 配下に prompt テンプレ (markdown) を置くのは `kiro-impl` で確立されたパターン
  - `rules/` 配下に方針文書を置くのは `kiro-steering-custom` (steering-principles.md), `kiro-spec-*` (各種ガイド) で確立
  - skill 本文の構成: `## Role` / `## Core Mission` / `## Execution Steps` / `## Critical Constraints` / `## Output Description` / `## Safety & Fallback` がデファクト
- **Implications**: 新 skill 2 つは同構成を踏襲し、`templates/entry-template.md` (add 用)、`templates/review-report.md` (review 用)、`rules/taxonomy-reference.md` (両 skill 共有のタクソノミー定義) を持つ

### `/kiro-steering-custom` インターフェース調査

- **Context**: Try ハンドオフ経路を確定するため (R7.1)
- **Sources Consulted**: `.claude/skills/kiro-steering-custom/SKILL.md`, `rules/steering-principles.md`
- **Findings**:
  - `kiro-steering-custom` は対話的フロー: (1) ユーザーから domain/topic と要件をヒアリング → (2) `.kiro/settings/templates/steering-custom/` から template ロード → (3) codebase 分析 → (4) `.kiro/steering/{name}.md` 作成または編集
  - 入力 signature は緩い (Skill ツール経由で `args` 文字列を受ける)
  - 既存ファイル更新時は preservation rules がある (user sections を保持、additive)
- **Implications**: `/kiro-postmortem-review` は Try 1 件ごとに「topic name + body」を構造化文字列で渡し、ユーザーが対話的に承認して steering に書き込む形が自然。新 skill 側で steering ファイル名を提案 (例: `defect-patterns-assumption-error.md` or 既存 steering ファイルへの追記) し、最終決定は `kiro-steering-custom` に委ねる

### Ledger Markdown 構造の選定

- **Context**: Entry スキーマ (R2 の 10 項目 + メタ) を Markdown でどう構造化するか
- **Alternatives Considered**:
  1. YAML frontmatter (`---` で囲んだメタ + body 散文)
  2. H3 タイトル + H4 セクション (`### 0001: title` の下に `#### 発生機能` などを並べる)
  3. テーブル 1 行 1 entry (CSV 風)
  4. JSON ファイル (`defects.json`) + 自動 Markdown 生成
- **Selected Approach**: 2 (H3 + H4 セクション)
- **Rationale**:
  - 人間が ledger を直接読める (Git Diff / GitHub レンダリング / 普通の Markdown viewer)
  - YAML frontmatter (案 1) は metadata と body の境界が明確だが、10 項目の本文はリッチテキストを含むので frontmatter に押し込むと窮屈
  - テーブル (案 3) は行が長くなりすぎる (10 項目 + メタ = 12 列以上、各セル数行)
  - JSON (案 4) はパースは容易だが Git レビュー時の可読性が落ち、AI が編集する際の壊れやすさも増す
- **Trade-offs**: Markdown パースは正規表現ベースになり厳密性が落ちる。代わりに `Status:` 行や `Entry ID:` 行を機械可読な決まった位置に置くことで補う

### Entry ID 形式の選定

- **Context**: R2.3 でエントリ ID は monotonic int or ISO timestamp とされている
- **Alternatives Considered**:
  1. monotonic int (`0001`, `0002`, ...)
  2. ISO-8601 timestamp (`2026-05-19T10:30:00`)
  3. ハイブリッド (`0001-2026-05-19`)
- **Selected Approach**: 1 (zero-padded 4-digit monotonic int) + `created_at` 行で timestamp を別途記録
- **Rationale**:
  - 短くて参照しやすい (`#0003` で言及可能)
  - 同件調査 (R2.1 の項目 9) で entry ID を相互参照する際の取り回しが良い
  - timestamp は `created_at` 行で別途記録するので、両方の利点を享受
- **Trade-offs**: ID が ledger 全体の単調増加に依存するので、複数ブランチで append が走るとコンフリクトしうる → R10.2 (concurrent write 検知) で吸収

### State Machine 表現

- **Context**: R12.1 で 3 状態 (`recorded` / `reviewed` / `steered`) を ledger 上で可視化する必要
- **Selected Approach**: 各エントリの H3 タイトル直下に `Status: recorded | reviewed | steered` の 1 行を置く。`/kiro-postmortem-review` が承認後にこの行を Edit で書き換える
- **Rationale**: 機械可読 (grep 可能) かつ人間可読。ヘッダ位置を固定することでパースが安定

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| **Single ledger + 2 skill (採用)** | `.kiro/postmortem/defects.md` 1 ファイル + `/kiro-postmortem-add` + `/kiro-postmortem-review` の最小構成 | 単純・依存ゼロ・Git 管理可能・既存 kiro-* 規約と整合 | 1 ファイルが肥大化 (将来 N 千 entry で読み込み遅延) | エントリ数 100 件規模までは余裕。それ以上は分割 spec 化を検討 |
| 複数 ledger ファイル分割 | 機能別 / 月別に ledger を分割 | スケール耐性 | 集約分析時に複数ファイル参照が必要、State 管理が複雑化 | YAGNI、不採用 |
| DB ベース (SQLite) | DB に entry を格納 | 構造化・クエリ高速 | Git レビュー困難、新規依存追加、AI が直接編集できない | Markdown の可読性価値が大きく、不採用 |
| Skill 1 つに統合 | `/kiro-postmortem` 1 skill で add / review を mode 引数で切替 | 起動コマンドが少ない | mode 引数の判断ミスでリスクが上がる、skill 内部ロジックが肥大化 | 責務分離原則に反する、不採用 |

## Design Decisions

### Decision: 4 タクソノミーを 1 つの共有 reference ファイルにまとめる

- **Context**: R3 / R4 / R13 / R14 で計 36 ラベル + 定義表が定義されている。2 skill 双方からこれを参照する必要がある
- **Alternatives Considered**:
  1. 各 skill の `rules/` 配下に同じタクソノミー定義をコピーする
  2. `requirements.md` を唯一の source of truth とし skill から読み込む
  3. `.claude/skills/kiro-postmortem-add/rules/taxonomy-reference.md` を共有 reference として作り、`/kiro-postmortem-review` skill からも path 指定で読む
- **Selected Approach**: 3
- **Rationale**:
  - 1 ファイルが source of truth で重複なし
  - skill の `rules/` 配下に置くと skill 自身の prompt から参照しやすい
  - `requirements.md` を直接参照すると skill が spec 文書に依存する形になり、運用フェーズで重い (毎回 200 行超を読む)
- **Trade-offs**: `kiro-postmortem-review` skill が `kiro-postmortem-add` の `rules/` ファイルを path 指定で読むことになり skill 間に弱い依存が生じる。これは設計上明示する

### Decision: Ledger ヘッダはテンプレファイルから生成

- **Context**: Ledger 初回作成時に PDCA 運用ガイド・10 項目スキーマ説明・タクソノミー 4 軸定義表を全部含めるとヘッダだけで 200 行近い
- **Selected Approach**: `.claude/skills/kiro-postmortem-add/templates/ledger-header.md` をテンプレとして配置し、初回作成時にこの内容を `.kiro/postmortem/defects.md` の冒頭にコピーする
- **Rationale**: ヘッダ修正時はテンプレファイル 1 箇所を更新すれば次回作成時から反映。タクソノミー拡張時 (R3.4 / R13.4 / R14.5) は ledger 内のヘッダを直接 Edit する (テンプレと ledger の同期は手動 / 同一操作内で行う)

### Decision: AI 提案トリガーの実装位置

- **Context**: R9.5(b) 「同根本要因が 2 件以上未レビュー」を AI がどう検知するか
- **Alternatives Considered**:
  1. `/kiro-postmortem-add` 完了時に ledger 全体をスキャンしてトリガー判定
  2. 通常の AI 応答内で文脈から判断 (`/kiro-impl` 完了時など)
  3. settings.json hook で自動検知
- **Selected Approach**: 1 + 2 のハイブリッド (3 は R11.3 で Out of Boundary)
- **Rationale**: `/kiro-postmortem-add` 完了直後は ledger を読んだ直後で頻度判定がコスト最小。`/kiro-impl` 完了時は AI が trigger (a) を意識的に提案する (skill 間の依存追加なし、AI 振る舞いとしての推奨)

## Synthesis Outcomes

### Generalization

4 タクソノミー (R3/R4/R13/R14) は同じパターン:
- 固定ラベル集合 + 定義表 (定義 + 該当例)
- タクソノミー外ラベル記録時の拡張フロー (R3.4 / R13.4 / R14.5; R4 は AC なしだが概念は同じ)
- ledger ヘッダで文書化

このパターンを 1 つの構造 (`Taxonomy` 概念) として `rules/taxonomy-reference.md` で扱う。コード上の interface ではなく、文書上の構造化として表現。

### Build vs Adopt

| 要素 | Build / Adopt | 理由 |
|---|---|---|
| `/kiro-postmortem-add` skill | Build (新規) | 既存に該当 skill 無し |
| `/kiro-postmortem-review` skill | Build (新規) | 同上 |
| Ledger Markdown | Build (新規) | プロジェクト固有のスキーマ |
| Try → steering 反映 | Adopt (`/kiro-steering-custom`) | 既存 skill を流用、修正なし (R7.1) |
| 共有タクソノミー定義 | Build (新規 `rules/taxonomy-reference.md`) | requirements.md と二重管理になるが skill 運用負荷を優先 |

### Simplification

- 単一 ledger ファイル (DB 不要、サブディレクトリ不要)
- skill 内部に集約分析ロジックを持つが、複雑な ML / 統計は不要 (頻度カウントとクラスタリングのみ)
- back-reference は ledger 末尾の専用セクションに append (別ファイル不要)
- 状態管理は `Status:` 1 行で表現 (state machine 専用ファイル不要)

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Ledger ファイルが肥大化し読み込み遅延 | エントリ数 100 件規模まで余裕。それ以上は将来別 spec で分割アーカイブを検討 |
| タクソノミー定義の二重管理 (requirements.md と `rules/taxonomy-reference.md`) | タクソノミー変更時は両ファイルを同時に更新するルールを `rules/taxonomy-reference.md` の冒頭に明記 |
| `/kiro-steering-custom` への Try 渡し時のフォーマット不一致 | `/kiro-postmortem-review` の `templates/steering-handoff.md` で渡し方を固定 |
| AI が tigger 提案を過剰に出す (シグナル → ノイズ化) | R9.5 トリガーは明確に列挙、その外では AI は提案しない (R9.6) |
| 同一 entry が複数の Try に紐付くケースの取り扱い | `## Steering 反映ログ` の back-reference は entry ID を複数記述可能 (R7.2) |

## References

- 既存 skill family: `.claude/skills/kiro-impl/SKILL.md`, `.claude/skills/kiro-steering-custom/SKILL.md`, `.claude/skills/kiro-debug/SKILL.md`
- Steering: `.kiro/steering/requirements-style.md` (本設計の EARS 英文 + 和訳併記ルール)
- Existing template paths: `.claude/skills/kiro-impl/templates/{implementer,reviewer,debugger}-prompt.md` (新 skill の templates 配置パターン参照)
