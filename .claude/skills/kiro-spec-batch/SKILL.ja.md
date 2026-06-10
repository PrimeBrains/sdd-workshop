---
name: kiro-spec-batch
description: Create complete specs (requirements, design, tasks) for all features in roadmap.md using parallel subagent dispatch by dependency wave.
allowed-tools: Read, Glob, Grep, Agent
---

# kiro-spec-batch スキル

## コアミッション
- **成功基準**:
  - すべてのフィーチャーが完全なスペックファイル（spec.json, requirements.md, design.md, tasks.md）を持つ
  - 依存順序が守られている（上流スペックが下流より先に完了）
  - 独立したフィーチャーはサブエージェント派遣により並列処理される
  - スペック横断の一貫性が検証されている（データモデル、インターフェース、命名）
  - `## Specs (dependency order)` のパースを壊さずに混合ロードマップのコンテキストを理解する
  - コントローラーのコンテキストは軽量に保つ（重い作業はサブエージェントが担う）

## 実行ステップ

### Step 1: ロードマップの読み込みと検証

1. `.kiro/steering/roadmap.md` を読む
2. `## Specs (dependency order)` セクションをパースして以下を抽出する:
   - フィーチャー名
   - 1 行の説明
   - 各フィーチャーの依存関係
   - 完了ステータス（`[x]` = 完了、`[ ]` = 未着手）
3. 存在する場合、コンテキストとして以下も読む:
   - `## Existing Spec Updates`
   - `## Direct Implementation Candidates`
   これらを依存ウェーブの実行に含めないこと。順序付けと一貫性レビューのための参考情報に留める。
4. `## Specs (dependency order)` の未着手フィーチャーごとに `.kiro/specs/<feature>/brief.md` の存在を確認する
5. brief.md が欠落している場合は停止して報告する: "Missing brief.md for: [list]. Run `/kiro-discovery` to generate briefs first."

### Step 2: 依存ウェーブの構築

依存関係に基づき、未着手フィーチャーをウェーブにグループ化する。

- **Wave 1**: 依存がない（またはすべての依存が完了済み `[x]` の）フィーチャー
- **Wave 2**: 依存がすべて Wave 1 内または完了済みのフィーチャー
- **Wave N**: 依存がすべて先行ウェーブ内または完了済みのフィーチャー

実行プランを表示する:
```
Spec Batch Plan:
  Wave 1 (parallel): app-foundation
  Wave 2 (parallel): block-editor, page-management
  Wave 3 (parallel): sidebar-navigation, database-views
  Wave 4 (parallel): cli-integration
  Total: 6 specs across 4 waves
```

ロードマップに `## Existing Spec Updates` や `## Direct Implementation Candidates` が含まれる場合、ユーザーが分解の全体像を見られるよう、バッチ対象外の項目として別途言及する。

### Step 3: ウェーブの実行

各ウェーブについて、ウェーブ内のすべてのフィーチャーを Agent ツール経由の**並列サブエージェント**として派遣する。

**ウェーブ内の各フィーチャーについて**、以下のプロンプトでサブエージェントを派遣する。

```
Create a complete specification for feature "{feature-name}".

1. Read the brief at .kiro/specs/{feature-name}/brief.md for feature context
2. Read the roadmap at .kiro/steering/roadmap.md for project context
3. Execute the full spec pipeline. For each phase, read the corresponding skill's SKILL.md for complete instructions (templates, rules, review gates):
   a. Initialize: Read .claude/skills/kiro-spec-init/SKILL.md, then create spec.json and requirements.md
   b. Generate requirements: Read .claude/skills/kiro-spec-requirements/SKILL.md, then follow its steps
   c. Generate design: Read .claude/skills/kiro-spec-design/SKILL.md, then follow its steps
   d. Generate tasks: Read .claude/skills/kiro-spec-tasks/SKILL.md, then follow its steps
4. Set all approvals to true in spec.json (auto-approve mode, equivalent of -y flag)
5. Report completion with file list and task count
```

**ウェーブ内のすべてのサブエージェント完了後**:
1. 各フィーチャーに spec.json, requirements.md, design.md, tasks.md が揃っていることを確認する
2. 失敗したフィーチャーがあればエラーを報告し、成功したフィーチャーで続行する
3. ウェーブ完了を表示する: "Wave N complete: [features]. Files verified."
4. 次のウェーブへ進む

### Step 4: スペック横断レビュー

全ウェーブ完了後、スペック横断の一貫性レビューのために**単一のサブエージェント**を派遣する。これは最も価値の高い品質ゲートであり、スペック単位のレビューゲートでは捕捉できない問題を検出する。

**サブエージェントのプロンプト**:

```
You are a cross-spec reviewer. Read ALL generated specs and check for consistency across the entire project.

Read these files for every feature in the roadmap:
- .kiro/specs/*/design.md (primary: contains interfaces, data models, architecture)
- .kiro/specs/*/requirements.md (for scope and acceptance criteria)
- .kiro/specs/*/tasks.md (for boundary annotations only -- read _Boundary:_ lines, skip task descriptions)
- .kiro/steering/roadmap.md

Reading priority: Focus on design.md files (they contain interfaces, data models, architecture). For requirements.md, focus on section headings and acceptance criteria. For tasks.md, focus on _Boundary:_ annotations.

Check the following:

1. **Data model consistency**: Do all specs that reference the same entities (tables, types, interfaces) define them consistently? Are field names, types, and relationships aligned?

2. **Interface alignment**: Where spec A produces output that spec B consumes (APIs, events, shared state), do the contracts match exactly? Are request/response shapes, event payloads, and error codes consistent?

3. **No duplicate functionality**: Is any capability specified in more than one spec? Flag overlaps.

4. **Dependency completeness**: Does every spec's design.md reference the correct upstream specs? Are there implicit dependencies not declared in roadmap.md?

5. **Naming conventions**: Are component names, file paths, API routes, and database table names consistent across all specs?

6. **Shared infrastructure**: Are shared concerns (authentication, error handling, logging, configuration) handled in one spec and correctly referenced by others?

7. **Task boundary alignment**: Do task _Boundary:_ annotations across specs partition the codebase cleanly? Are there files claimed by multiple specs?
8. **Roadmap boundary continuity**: If roadmap includes `Existing Spec Updates` or `Direct Implementation Candidates`, do the generated new specs avoid absorbing that work by accident?
9. **Architecture boundary integrity**: Do the specs preserve clean responsibility seams, avoid shared ownership, keep dependency direction coherent, and include enough revalidation triggers to catch downstream impact?
10. **Change-friendly decomposition**: Has any spec absorbed multiple independent seams that should probably be split instead of kept together?

Output format:
- CONSISTENT: [list areas that are well-aligned]
- ISSUES: [list each issue with: which specs, what's inconsistent, suggested fix]
- If no issues found: "All specs are consistent. Ready for implementation."
```

**レビューサブエージェントが結果を返した後**:
- **重大 / 重要な問題が見つかった場合**: 影響を受ける各スペックに対して修正サブエージェントを派遣し、提案された修正を適用する。問題が本質的に分解の問題（例: 境界の重複、1 つのスペックが複数の独立した継ぎ目を抱えている）である場合は、ローカルで取り繕わずに停止し、ロードマップ / ディスカバリーに立ち戻る。修正後にスペック横断レビューを再実行する（修正ラウンドは最大 3 回）。
- **軽微な問題のみの場合**: ユーザーへの周知のために報告し、Step 5 へ進む。
- **問題なしの場合**: Step 5 へ進む。

### Step 5: 完了処理

1. `.kiro/specs/*/tasks.md` を Glob してすべてのスペックの存在を確認する
2. 完了した各スペックについて spec.json を読み、phase と approvals を確認する
3. roadmap.md を更新する: 完了したスペックを `[x]` にする
4. roadmap.md に `Existing Spec Updates` や `Direct Implementation Candidates` が含まれる場合、それらには手を付けず、別の場所で明示的に完了していない限り、残りのフォローアップ項目として言及する

最終サマリーを表示する:
```
Spec Batch Complete:
  ✓ app-foundation: X requirements, Y design components, Z tasks
  ✓ block-editor: ...
  ✓ page-management: ...
  ...
  Total: N specs created, M tasks generated
  Cross-spec review: PASSED / N issues found (M fixed)
  Existing spec updates pending: <count or none>
  Direct implementation candidates pending: <count or none>

Next: Review generated specs, then start implementation with /kiro-impl <feature>
```

## 重要な制約
- **コントローラーは軽量に保つ**: メインコンテキストでは roadmap.md の読み込みと brief.md の存在確認のみを行う。スペック生成はすべてサブエージェント内で行う。
- **ウェーブ順序は厳守**: 先行ウェーブのすべてのフィーチャーが完了するまで、次のウェーブを開始しないこと。
- **ウェーブ内は並列**: 同一ウェーブ内のすべてのフィーチャーは、逐次ではなく Agent ツール経由で並列に派遣しなければならない。
- **ウェーブの中途半端な打ち切り禁止**: ウェーブ内のフィーチャーが失敗しても、報告前にそのウェーブの他のフィーチャーを完了させること。
- **完了済みスペックはスキップ**: roadmap.md で `[x]` のフィーチャー、または tasks.md が既存のフィーチャーはスキップする。
- **バッチ実行の正は `## Specs (dependency order)`**: 他のロードマップセクションはコンテキストであり、ウェーブの入力ではない。

## 安全策とフォールバック

**サブエージェントの失敗**:
- エラーをログに残し、失敗したフィーチャーをスキップする
- ウェーブ内の残りのフィーチャーで続行する
- サマリーで失敗したフィーチャーを報告する
- 提案: "Run `/kiro-spec-quick <feature> --auto` manually for failed features."

**循環依存**:
- 依存グラフにサイクルがある場合、サイクルを報告して停止する
- 提案: "Fix dependency ordering in roadmap.md"

**ロードマップが見つからない場合**:
- 停止して報告する: "No roadmap.md found. Run `/kiro-discovery` first."
