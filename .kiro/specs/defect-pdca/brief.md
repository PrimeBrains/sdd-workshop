# Brief: defect-pdca

## Problem

AI 駆動の開発作業で発生する不具合 (実装ミス / 仕様の見落とし / レビューすり抜け / テストギャップ / 環境設定漏れ など) を、その場限りの個別修正で済ませると **同じ系統のミスが繰り返される** という痛みがある。今回のセッションだけでも以下のように、原因と教訓が分散したまま喪失する危険が顕在化した:

- `fmtMD` の `(n / 1_000_000)` を「自明な変換だからテスト不要」と判断 → ピュア関数テストの省略アンチパターン
- 要件文に実装詳細 `(n / 1_000_000).toFixed(1)` を埋め込んでいたためレビューが素通り
- `seed.ts` と `server/src/db/index.ts` で DB パスが分裂していた発見
- Playwright の `text=` セレクター + `first()` の組み合わせが、データが正常描画される瞬間に脆弱化
- フルランで前テストの DB 状態が次テストの前提を崩す e2e 状態依存

これらは個別バグだが、抽象すると「AI が陥りやすい判断パターン」の繰り返し。プロジェクト・チームとして学習を蓄積する仕組みがない。

## Current State

- `.kiro/steering/` に project-wide memory はあるが、**不具合事例とそこから得た教訓 (Try) が体系的に記録されていない**
- AI auto-memory (`MEMORY.md`) は個別会話の文脈にとどまり、PDCA の Check-Act が回らない
- 既存 `/kiro-steering-custom` skill は steering 追記の手段としてあるが、不具合 → Try 抽出 → steering 化の流れは未整備
- 結果として、AI は次回セッションで類似のミスを再度犯しうる

## Desired Outcome

- 不具合が発生したら、9 項目 (発生不具合 / 検知工程 / 検知すべき工程 / 未検知理由 / 要因分類 / 根本要因分類 / 根本要因詳細 / 同件調査 / 次回対応策) を埋めた entry が `.kiro/postmortem/defects.md` に追加される
- 一定数蓄積された ledger を `/kiro-postmortem-review` で集約分析でき、要因分類の頻度・同件パターン・横展開可能な Try が抽出される
- 抽出された Try は `/kiro-steering-custom` 経由で `.kiro/steering/*.md` に反映され、次セッション以降の AI 振る舞いを変える
- Plan (記録) → Do (集約) → Check (分析) → Act (steering 化) の PDCA が誰でも回せる

## Approach

**skill 化された ledger + 2 skill + 既存 steering-custom 連携**

1. **Ledger**: `.kiro/postmortem/defects.md` を追記型 Markdown ジャーナルとして配置。各 entry は 9 項目を H3 (または YAML frontmatter) で構造化し、機械可読 + 人間可読を両立。
2. **`/kiro-postmortem-add` skill**: 不具合発生時に起動。AI が現在の会話文脈と git diff から 9 項目を提案 → ユーザー補正 → ledger に append。
3. **`/kiro-postmortem-review` skill**: 任意タイミングで起動。ledger 全件を読み、要因分類の頻度分析・同件クラスタリング・Try 候補生成。出力された Try を `/kiro-steering-custom` に渡して steering 化を促す。
4. **既存 `/kiro-steering-custom`**: 修正せず再利用。Try を渡せば従来通り `.kiro/steering/*.md` に反映する。

これにより、PDCA の各フェーズが明確な skill / ファイルに対応し、運用が透明になる。

## Scope

- **In**:
  - `.kiro/postmortem/defects.md` ledger ファイルの設計と空テンプレ
  - Entry スキーマ (9 項目) の定義と Markdown テンプレ
  - `/kiro-postmortem-add` skill 定義 (`.claude/skills/kiro-postmortem-add/SKILL.md` + templates/)
  - `/kiro-postmortem-review` skill 定義 (`.claude/skills/kiro-postmortem-review/SKILL.md` + 集約分析ロジック)
  - 要因分類タクソノミー (例: requirements-error / design-error / impl-error / review-miss / test-gap / env-config / data-state-dep / ...)
  - 検知工程タクソノミー (requirements / design / impl / unit-test / review / integration-test / e2e / production / user-report)
  - PDCA 運用ガイドライン (どのタイミングで何を起動するか) を ledger 冒頭に文書化
- **Out**:
  - `/kiro-steering-custom` 自体の修正 (既存・流用)
  - 既存 spec (dashboard / evm-engine / progress-tracking / core-data-model) の修正
  - settings.json の hook 追加による完全自動化 (将来選択肢)
  - 過去の不具合の遡及登録 (運用開始以降の new entry のみが対象。ただし今回のセッションで明らかになった「fmtMD / seed 分裂 / e2e 脆弱性」3 件は **初期サンプルとして seed 登録** する)
  - 不具合の自動分類 (ML/LLM 推論ベースのカテゴリ化は別 spec)
  - 外部 issue tracker (GitHub Issues / Backlog) との同期

## Boundary Candidates

- **Schema layer**: Ledger エントリの 9 項目スキーマ + 分類タクソノミー定義 (機械可読性とテンプレ一貫性の責務)
- **Recording layer**: `/kiro-postmortem-add` skill の Plan-Do 担当 (不具合の構造化記録)
- **Analysis layer**: `/kiro-postmortem-review` skill の Check 担当 (集約・頻度分析・Try 抽出)
- **Distribution layer**: Try → `/kiro-steering-custom` 連携の Act 担当 (steering への反映)

## Out of Boundary

- **既存 skill の修正**: `/kiro-steering-custom`, `/kiro-spec-*`, `/kiro-impl` 等は触らない。連携先として外部呼び出しのみ
- **個別不具合の修正作業**: PDCA は記録と教訓抽出が責務。個別バグの fix は別の skill / フロー
- **AI auto-memory との統合**: `MEMORY.md` は会話ローカルな記憶として独立維持。`defects.md` は project-wide な不具合学習として並列存在
- **可視化ツール**: dashboard 化 / グラフ生成は将来検討。本 spec は ledger と分析 skill まで

## Upstream / Downstream

- **Upstream**:
  - `.kiro/steering/` (project memory) — Try の最終格納先
  - `/kiro-steering-custom` (既存 skill) — steering 反映の手段
  - 通常の開発フロー (`/kiro-impl`, `/kiro-debug`, ユーザー指摘等) — 不具合発生源
- **Downstream**:
  - 将来の `/kiro-spec-batch` / `/kiro-impl` セッション — steering 化された Try により振る舞いが変わる
  - 将来の `/kiro-postmortem-trend` 等の可視化拡張 (本 spec の Out)
  - チーム共有: ledger 自体をリポジトリ管理することで他開発者・他 AI セッションでも参照可能

## Existing Spec Touchpoints

- **Extends**: なし (新規プロセス基盤)
- **Adjacent**:
  - `kiro-steering-custom` skill — 出口インターフェースとして利用
  - dashboard / evm-engine / progress-tracking / core-data-model spec — 不具合発生元として参照されるが直接の修正対象ではない
  - `.kiro/steering/structure.md` — ファイル配置規約として Section 追加の可能性 (`.kiro/postmortem/` 配置の正当性)

## Constraints

- 既存 `.kiro/` ディレクトリ構造を破壊しない（`.kiro/postmortem/` を新規追加）
- skill 定義は `.claude/skills/kiro-*/SKILL.md` 規約に従う (既存 kiro-* skill と整合)
- Ledger は Markdown ファイル 1 つで完結（DB 不要、Git 管理可能、レビュー可能）
- 既存 `/kiro-steering-custom` skill の signature は変えない (Try 文字列を渡せばよい)
- Entry テンプレは日本語で記述 (steering / requirements と一貫性)
- 自動化は skill 起動までに留め、`settings.json` hook による自動 fire は Out
- 9 項目すべて必須入力。空項目を許すと PDCA の Check 段階で分析できない
