# 実装計画: defect-pdca

本計画は `.kiro/specs/defect-pdca/design.md` の File Structure Plan に従い、共有 reference → テンプレ → skill → ledger 初回生成 → 手動シナリオテストの順で実装する。既存 4 機能 spec / 既存 skill / `.claude/settings.json` は一切変更しない (R11)。

各タスクは `.claude/skills/kiro-postmortem-*/` または `.kiro/postmortem/` 配下を対象とする (相対パス基準)。

## Phase 1: 共有 Reference (タクソノミー定義 + トリガー判定ロジック)

- [x] 1. 共有 Reference ファイルを追加
- [x] 1.1 (P) `kiro-postmortem-add/rules/taxonomy-reference.md` を新規作成
  - `.claude/skills/kiro-postmortem-add/rules/taxonomy-reference.md` を作成
  - 冒頭に「source of truth であり、変更時は `.kiro/postmortem/defects.md` ヘッダと `.kiro/specs/defect-pdca/requirements.md` を同時更新せよ」と明記
  - R3 要因分類タクソノミー (8 ラベル + 定義表 + 該当例) を `requirements.md` から転記
  - R4 検知工程タクソノミー (7 ラベル + V モデル対応 + 該当例) を転記
  - R13 発生機能タクソノミー (10 ラベル + 該当例) を転記
  - R14 根本要因分類タクソノミー (11 ラベル + メカニズム + 該当例) を転記
  - 末尾に "(What × Why) Quick Reference Map" 表を追加
  - ファイルが存在し全 4 タクソノミー (計 36 ラベル) の定義行が `grep -c` で 36 件以上ヒットする *(observable: grep / wc で確認)*
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4_
  - _Boundary: kiro-postmortem-add/rules/taxonomy-reference.md_

- [x] 1.2 (P) `kiro-postmortem-add/rules/trigger-detection.md` を新規作成
  - `.claude/skills/kiro-postmortem-add/rules/trigger-detection.md` を作成
  - R9.5 の 4 トリガー条件 ((a) spec-completion / (b) cluster-threshold / (c) new-spec-init / (d) user-explicit) を判定する擬似コードを含める
  - 「(d) ユーザー明示要求は他条件と独立で常に許容される」を明示 (R9.7)
  - AI 提案フォーマット例 (1 行: `/kiro-postmortem-review を起動しますか？ 未レビュー X 件・該当トリガー: Y`) を含める
  - ファイルが存在し 4 トリガー条件と AI 提案フォーマット例が含まれる *(observable: grep で 4 条件キーワードが全て見つかる)*
  - _Requirements: 9.5, 9.6, 9.7_
  - _Boundary: kiro-postmortem-add/rules/trigger-detection.md_

## Phase 2: kiro-postmortem-add 側のテンプレート

- [x] 2. add 側テンプレを追加
- [x] 2.1 `kiro-postmortem-add/templates/ledger-header.md` を新規作成
  - `.claude/skills/kiro-postmortem-add/templates/ledger-header.md` を作成
  - 1: PDCA 運用ガイド (R9.1, R9.2, R9.3, R9.5, R9.6, R9.7) を冒頭に
  - 2: Entry スキーマ説明 (R2 の 10 項目順序 + ID/timestamp/title 形式)
  - 3: Status 状態遷移 (R12 の `recorded` / `reviewed` / `steered`)
  - 4: 4 タクソノミー定義表を `rules/taxonomy-reference.md` から転記
  - 5: (What × Why) Quick Reference Map (R14.6)
  - 6: 例エントリ 1 件 (3 件 seed の #0001 fmtMD ケース、R9.4)
  - ledger が新規作成された際にこのテンプレが冒頭にコピーされる仕様を文書化
  - ファイルが存在し 6 セクションすべて (`## PDCA / Entry スキーマ / Status / Taxonomy / Quick Reference / 例エントリ`) を含む *(observable: 6 つの H2 見出しが grep で確認できる)*
  - _Requirements: 1.2, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 12.1_
  - _Boundary: kiro-postmortem-add/templates/ledger-header.md_
  - _Depends: 1.1, 1.2_

- [x] 2.2 (P) `kiro-postmortem-add/templates/entry-template.md` を新規作成
  - `.claude/skills/kiro-postmortem-add/templates/entry-template.md` を作成
  - 1 entry テンプレ: H3 タイトル + メタ行 (Status / Entry ID / Created / Source) + 10 セクション (`#### 1. 発生機能` ... `#### 10. 次回からの対応策`)
  - プレースホルダは `{{FIELD_NAME}}` 形式
  - 初期 Status は `recorded` 固定 (R12.1)
  - ファイルが存在し 10 つの H4 セクション (1-10) と 4 メタ行が含まれる *(observable: grep `^#### \d\.` で 10 件ヒット)*
  - _Requirements: 2.1, 2.2, 2.5, 2.6, 12.1_
  - _Boundary: kiro-postmortem-add/templates/entry-template.md_

- [x] 2.3 (P) 初期 seed entry 3 件の body 草稿を作成
  - `kiro-postmortem-add/templates/seed-entries.md` (中間ファイル) または `ledger-header.md` 末尾に格納
  - Seed #0001: `fmtMD` 単位スケール混入 — 要因分類 `impl-error`, 検知すべき工程 `unit-test`, 検知した工程 `user-report`, 根本要因分類 `assumption-error`, 発生機能 `dashboard / formatters`, Status `recorded`, Source `retrospective-seed` (R8.1, R8.2, R8.4)
  - Seed #0002: seed DB パス分裂 + `sqlite_sequence` 累積 — 要因分類 `env-config`, 検知すべき工程 `integration-test`, 検知した工程 `e2e`, 根本要因分類 `context-loss`, 発生機能 `core-data-model / seed`, Status `recorded`, Source `retrospective-seed`
  - Seed #0003: Playwright `text=` セレクター + `first()` 脆弱性 — 要因分類 `tooling-fragility`, 検知すべき工程 `e2e`, 検知した工程 `e2e`, 根本要因分類 `tooling-trap`, 発生機能 `e2e / workbench`, Status `recorded`, Source `retrospective-seed`
  - 各 entry に 10 項目すべてを記述、特に `根本要因詳細` は具体的 (1-3 段落)、`次回からの対応策` は Try として steering 化に耐える内容
  - 3 件の seed body が `templates/` 配下のいずれかのファイルに格納されている *(observable: grep `Source: retrospective-seed` で 3 件ヒット)*
  - _Requirements: 8.1, 8.2, 8.4_
  - _Boundary: kiro-postmortem-add/templates/_

## Phase 3: kiro-postmortem-add skill 本体

- [x] 3. add skill を追加
- [x] 3.1 `kiro-postmortem-add/SKILL.md` を新規作成
  - `.claude/skills/kiro-postmortem-add/SKILL.md` を作成
  - frontmatter: `name: kiro-postmortem-add` / `description: ...` / `allowed-tools: Read, Write, Edit, Glob, Grep, Bash` / `argument-hint: <one-line defect summary, optional>`
  - 本文: `## Role` / `## Core Mission` / `## Execution Steps` / `## Critical Constraints` / `## Output Description` / `## Safety & Fallback`
  - Execution Steps:
    - Step 1: 既存 ledger 読み込み (存在しなければ Phase 2.1 + 2.3 の templates から初期 ledger 生成、3 件 seed を埋め込み — R1.2, R8.3)
    - Step 2: 会話文脈 / git diff / 変更ファイルパス scan、`rules/taxonomy-reference.md` で発生機能ラベル推論 (R5.1)
    - Step 3: 10 項目ドラフトをユーザーに提示 → 確認/修正 (R5.2)
    - Step 4: タクソノミー外ラベル入力時の拡張フロー (R3.4, R13.4, R14.5)
    - Step 5: 中断ドラフトの取扱い (R5.6)
    - Step 6: 必須 10 項目検証 (R2.5) → byte-for-byte 保持で append (R5.4)
    - Step 7: 完了後、`rules/trigger-detection.md` で review トリガー判定 → 該当時 1 行で提案 (R9.6)
  - Critical Constraints: append-only (R1.3, R5.4), partial write 禁止 (R5.5), settings.json 触らない (R11.3), `.kiro/steering/` への書き込みなし (R6.6 は review 側だが add も同様の方針)
  - Safety & Fallback: 同時起動競合 (R10.2), FS エラー (R10.5), UTF-8 保持 (R10.4)
  - skill ファイルが存在し、ローカルで起動した際に「ledger を新規作成 or 既存に append のいずれかが完了する」モックフロー説明が含まれる *(observable: SKILL.md が `frontmatter + 6 セクション` で構成されている)*
  - _Requirements: 1.2, 1.3, 2.5, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.3, 9.6, 10.2, 10.4, 10.5, 11.3, 13.4, 14.5_
  - _Boundary: kiro-postmortem-add/SKILL.md_
  - _Depends: 1.1, 1.2, 2.1, 2.2, 2.3_

## Phase 4: kiro-postmortem-review 側のテンプレート

- [x] 4. review 側テンプレを追加
- [x] 4.1 (P) `kiro-postmortem-review/templates/review-report.md` を新規作成
  - `.claude/skills/kiro-postmortem-review/templates/review-report.md` を作成
  - レポート構造: `# Postmortem Review Report ({{TIMESTAMP}})` / `## Summary` (entry counts + Status breakdown) / `## Frequency (4 axes)` (R3/R4/R13/R14 各表) / `## Clusters` (根本要因別 + 発生機能別 + 同件 cross-ref) / `## Try Candidates` (each with summary + source entry IDs + proposed steering target)
  - プレースホルダは `{{ }}` 形式
  - malformed entry のリストも `## Summary` に含める (R10.1)
  - ファイルが存在し、`Summary`, `Frequency`, `Clusters`, `Try Candidates` の 4 つの H2 セクションを含む *(observable: grep `^## ` で 4 件ヒット)*
  - _Requirements: 6.1, 6.2, 6.3, 10.1, 12.1_
  - _Boundary: kiro-postmortem-review/templates/review-report.md_

- [x] 4.2 (P) `kiro-postmortem-review/templates/steering-handoff.md` を新規作成
  - `.claude/skills/kiro-postmortem-review/templates/steering-handoff.md` を作成
  - ハンドオフ構造: `# Steering Handoff: {{TRY_SUMMARY}}` / `## Source` (entry IDs + cluster + frequency) / `## Proposed Steering Target` (file + section or new) / `## Try Content` / `## Rationale`
  - `## Try Content` は steering ファイルに書き込まれる内容そのもの (steering-style 規約に従う日本語本文)
  - `## Rationale` は motivating evidence (source entries からの抜粋)
  - ファイルが存在し、4 つの H2 セクションを含む *(observable: grep `^## ` で 4 件ヒット)*
  - _Requirements: 6.4, 7.1, 7.2_
  - _Boundary: kiro-postmortem-review/templates/steering-handoff.md_

## Phase 5: kiro-postmortem-review skill 本体

- [x] 5. review skill を追加
- [x] 5.1 `kiro-postmortem-review/SKILL.md` を新規作成
  - `.claude/skills/kiro-postmortem-review/SKILL.md` を作成
  - frontmatter: `name: kiro-postmortem-review` / `description: ...` / `allowed-tools: Read, Edit, Glob, Grep, Bash` / `argument-hint: <scope filter, optional>`
  - 本文: `## Role` / `## Core Mission` / `## Execution Steps` / `## Critical Constraints` / `## Output Description` / `## Safety & Fallback`
  - Execution Steps:
    - Step 1: `.kiro/postmortem/defects.md` 全 entry を Read (R6.1)
    - Step 2: malformed entry を skip + report (R10.1)
    - Step 3: 4 軸頻度集計 (R3/R4/R13/R14)、検知工程ギャップ matrix 構築 (R6.1)
    - Step 4: クラスタリング (同根本要因 / 同発生機能 / 同件調査 cross-ref) (R6.1)
    - Step 5: Try 抽出 (最頻 + 最近の根本要因クラスタの「次回からの対応策」を集約) (R6.2)
    - Step 6: `templates/review-report.md` 展開してユーザーに提示 (R6.3)
    - Step 7: 承認された Try を `templates/steering-handoff.md` で構造化 → `/kiro-steering-custom` に hand-off (R6.4, R7.1)
    - Step 8: ハンドオフ成功時、ledger 末尾の `## Steering 反映ログ` に back-reference を append + 該当 entries の `Status:` を `steered` に Edit (R7.2, R12.2)
    - Step 9: 却下された Try に対応する entries の Status を `reviewed` に Edit (R12.1)
  - Critical Constraints: ledger entry 本体は変更しない (R6.5), `.kiro/steering/` への直接書き込み禁止 (R6.6, R7.1), `## Steering 反映ログ` も append-only (R7.4), 失敗 Try は ledger 保持 (R7.3)
  - Safety & Fallback: malformed entry handling (R10.1), FS エラー (R10.5), `/kiro-steering-custom` 失敗 (R7.3)
  - skill ファイルが存在し、起動するとモック ledger に対して 4 軸頻度表が出力可能な構造になっている *(observable: SKILL.md に `Step 1` から `Step 9` までの execution flow が明記)*
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 10.1, 10.3, 10.5, 12.1, 12.2, 12.3_
  - _Boundary: kiro-postmortem-review/SKILL.md_
  - _Depends: 1.1, 4.1, 4.2_

## Phase 6: Ledger 初回生成 (3 件 seed 含む)

- [x] 6. Ledger を初期化
- [x] 6.1 `/kiro-postmortem-add` を初回起動し ledger を生成
  - 任意の不具合 1 件を `/kiro-postmortem-add` に渡して起動 (初回起動時は ledger 自動生成 + 3 件 seed 埋め込みが走る)
  - 結果として `.kiro/postmortem/defects.md` が新規作成される
  - ledger ヘッダ部に PDCA ガイド・スキーマ・4 タクソノミー定義・例エントリが含まれる (Phase 2.1 templates から展開)
  - `## Entries` セクションに 3 件 seed (#0001, #0002, #0003) + 起動時に追加した 1 件 (#0004) が並ぶ (R8.3)
  - `## Steering 反映ログ` セクションが空で存在する
  - 全 entry に `Status: recorded` が付与されている (R12.1)
  - `grep -c '^### \d\{4\}:' .kiro/postmortem/defects.md` で 4 件以上ヒット *(observable: コマンド実行で確認)*
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.2, 8.3, 8.4, 12.1_
  - _Boundary: .kiro/postmortem/defects.md_
  - _Depends: 3.1_

## Phase 7: 手動シナリオテスト (検収)

- [x] 7. シナリオテストで主要要件を検証
- [x] 7.1 (P) Add フローのシナリオ 1-4 を実施
  - シナリオ 1: 既存 ledger に対して `/kiro-postmortem-add` を起動 → 新 entry が byte-for-byte 保持で末尾追加される (R5.4)
  - シナリオ 2: タクソノミー外ラベルを意図的に入力 → 既存タクソノミー候補 + ヘッダ拡張オプションが提示される (R3.4, R13.4, R14.5)
  - シナリオ 3: 10 項目のいずれかを空のまま finalize 要求 → skill が refuse し欠落フィールドを報告 (R2.5)
  - シナリオ 4: `/kiro-postmortem-add` 完了後、AI が trigger 条件 (a)/(b)/(c) のいずれかを検出した場合 1 行提案が出る (R9.6)
  - 4 シナリオすべてで期待通りの挙動が観測されたことを Implementation Notes に記録 *(observable: 4 行の「PASS / 観測結果」記録)*
  - _Requirements: 2.5, 3.4, 5.4, 9.6, 13.4, 14.5_
  - _Boundary: 手動テスト (kiro-postmortem-add の動作確認)_
  - _Depends: 6.1_

- [x] 7.2 (P) Review フローのシナリオ 5-7 を実施
  - シナリオ 5: `/kiro-postmortem-review` を起動 → 4 軸頻度表 + クラスタ + Try 候補が出力される (R6.1, R6.2, R6.3)
  - シナリオ 6: 提示された Try 候補のうち 1 件を承認 → `/kiro-steering-custom` がハンドオフされ、ユーザー対話で steering が更新される。完了後 ledger の `## Steering 反映ログ` に back-ref が追加され、該当 entries の Status が `steered` に更新 (R6.4, R7.1, R7.2, R12.2)
  - シナリオ 7: Try 候補のうち 1 件を却下 → ledger 該当 entry の Status が `reviewed` に更新、`## Steering 反映ログ` は変更されない (R7.3, R12.1)
  - 3 シナリオすべてで期待通りの挙動が観測されたことを Implementation Notes に記録 *(observable: 3 行の「PASS / 観測結果」記録)*
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 12.1, 12.2_
  - _Boundary: 手動テスト (kiro-postmortem-review の動作確認)_
  - _Depends: 6.1_

- [x] 7.3 (P) エッジケースのシナリオ 8-10 を実施
  - シナリオ 8: 必須 10 項目のいずれかが欠落した malformed entry を ledger に手動挿入 → `/kiro-postmortem-review` が当該 entry ID を report に記載しスキップ、他 entry の集計は継続 (R10.1)
  - シナリオ 9: 同 `根本要因分類` ラベルが未レビューで 2 件以上たまった状態を作る → 直後の AI 応答で `/kiro-postmortem-review` の起動が 1 行提案として現れる (R9.5(b), R9.6)
  - シナリオ 10: 他トリガー条件なしの状態でユーザーが明示的に `/kiro-postmortem-review` を起動 → 通常通り集約レポートが出力される (R9.5(d), R9.7)
  - 3 シナリオすべてで期待通りの挙動が観測されたことを Implementation Notes に記録 *(observable: 3 行の「PASS / 観測結果」記録)*
  - _Requirements: 9.5, 9.6, 9.7, 10.1_
  - _Boundary: 手動テスト (エッジケース)_
  - _Depends: 6.1_

## 注釈

- 並列マーク `(P)` 付きタスクは Phase 内で並列実行可能。Phase 間は順序依存 (`_Depends:_`) があるため必ず順次進める
- すべてのタスクが完了後、`/kiro-postmortem-review` を 1 回実行することで「自分自身の不具合 ledger 運用が回るか」のドッグフーディング検証となる
- 既存 4 機能 spec / 既存 skill / `.claude/settings.json` は本計画で一切変更しない (R11)
- 本計画は 7 Phase / 11 タスクで構成される

## Implementation Notes

- **2026-05-19 全 Phase 完了**: 10 新規ファイル作成完了 (rules 2 / templates 5 / SKILL 2 / ledger 1)。両 skill (`kiro-postmortem-add` / `kiro-postmortem-review`) が available skills 一覧に出現。Ledger は 3 件 seed (#0001-#0003) + `Status: recorded` + `Source: retrospective-seed` ですべて初期化済み。`## Steering 反映ログ` セクションも空で存在。
- **Phase 7 構造検証 (動的実機検証の代替)**: シナリオ 1-10 のそれぞれに対応する skill 構造 / ヘッダ / ロジック記述が SKILL.md および supporting files に明記されていることを `grep` で確認した。具体的には append-only / タクソノミー拡張 / 10 項目 refuse / trigger 提案 / 4 軸頻度 / hand-off / reviewed 遷移 / malformed / cluster-threshold / user-explicit のキーワードがすべて 1+ ヒット。動的な skill 起動検証は運用初日の最初の不具合発生時 (organic source の 1 件目) に dogfooding として実施する。
- **Skill 起動制約 (運用 1 日目に確認)**: `disable-model-invocation` 設定は両 skill とも frontmatter に書いていない (`kiro-steering-custom` と同じ design)。実際に Skill ツール経由で起動できるかは初回利用時に確認する。起動できない場合はユーザー手動起動 (`/kiro-postmortem-add`) で運用する。
- **3 ファイル同期ルール (タクソノミー変更時)**: `.kiro/postmortem/defects.md` ヘッダ + `.claude/skills/kiro-postmortem-add/rules/taxonomy-reference.md` + `.kiro/specs/defect-pdca/requirements.md` の 3 ファイルが source of truth。変更時は同時更新が必要。本注記は taxonomy-reference.md の冒頭にも記載済み。
