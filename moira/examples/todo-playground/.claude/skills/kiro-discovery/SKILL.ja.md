---
name: kiro-discovery
description: Entry point for new work. Determines the best action path or work decomposition (update existing spec, create new spec, mixed decomposition, or no spec needed) and refines ideas through structured dialogue.
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Grep, Agent, WebSearch, WebFetch, AskUserQuestion
argument-hint: <idea-or-request>
metadata:
  origin: "cc-sdd"
---

# kiro-discovery スキル

## コアミッション
- **成功基準**:
  - 既存のプロジェクト状態に基づき、正しいアクションパスまたは作業分解を特定する
  - 推測ではなく質問を通じてユーザーの意図を明確化する
  - アウトプットは実行可能な次のステップである（単なる説明ではない）

## 実行ステップ

### Step 1: 軽量スキャン

アクションパスを判定するために**メタデータのみ**を収集する。この段階ではファイルの中身全体を読まないこと。

- **スペック一覧**: `.kiro/specs/*/spec.json` を Glob し、各 spec.json から `name`・`phase` フィールドと `approvals` の状態を読む。フィーチャー名と現在のステータスを記録する。
- **ステアリングの有無**: `.kiro/steering/` にどのファイル（product.md, tech.md, structure.md, roadmap.md）が存在するか確認する。この段階では中身を読まないこと。
- **ロードマップ確認**: `.kiro/steering/roadmap.md` が存在する場合は読む。前回のディスカバリーセッションで得たプロジェクトレベルのコンテキスト（アプローチ、スコープ、制約、スペック一覧）が含まれており、プロジェクトコンテキストの復元に使う。
- **トップレベル構造**: プロジェクトルートのディレクトリを一覧し、主要なディレクトリとファイルを把握する。サブディレクトリへの再帰は行わないこと。

このステップで消費するコンテキストは最小限に抑える。`specs/` が空でステアリングも存在しない場合は「グリーンフィールドプロジェクト」と記録して Step 2 へ進む。

### Step 2: アクションパスの判定

ユーザーのリクエストと Step 1 のメタデータに基づき、どのパスに該当するかを判定する。

**Path A: 既存スペックがカバーする**
- リクエストが既存スペックのドメイン内における拡張・改善・修正である
- リクエストの意味あるすべての部分が同じスペック境界に収まる
- 残る小さなフォローアップ作業は新しいスペックを作らず直接対応できる
- 以降のステップはスキップする

**Path B: スペック不要**
- リクエストがバグ修正、設定変更、単純なリファクタリング、または些細な追加である
- リクエストの意味ある部分のいずれも、新規または更新されたスペック境界を必要としない
- 既存スペックの更新も必要としない
- 以降のステップはスキップする

**Path C: 新規の単一スコープフィーチャー**
- リクエストが新規で、既存スペックと重複せず、1 つのスペックに収まる

**Path D: 複数スコープへの分解が必要**
- リクエストが複数ドメインにまたがる、または単一スペックで 20 以上のタスクを生むと見込まれる

**Path E: 混合分解**
- リクエストに、既存スペックの拡張・1 つ以上の新規スペック候補・任意の直接実装作業が混在する
- 真に新しいスペック境界が少なくとも 1 つ必要な場合のみこのパスを使う

Path C/D/E の場合、判定したパス（または混合分解）をユーザーに提示し、確認を得てから進める。
Path A/B の場合、次のアクションを推奨して停止する。

### Step 3: 深いコンテキストの読み込み

**Path C、D、E のみ対象。** ここでディスカバリーに必要なコンテキストを読み込む。

**メインコンテキスト内**（ユーザーとの対話に必須）:
- **ステアリングドキュメント**: product.md と tech.md を（存在すれば）読み、プロジェクトの目標・制約・技術スタックを把握する
- **関連スペック**: リクエストが既存スペックに隣接する場合、そのスペックの requirements.md を読み、境界の理解と重複の回避に使う

**Agent ツール経由でサブエージェントに委譲**（探索をメインコンテキストの外に保つ）:
- **コードベース探索**: サブエージェントを派遣してコードベースを探索させ、構造化されたサマリーを返させる。プロンプト例: "Explore this project's codebase. Summarize: (1) tech stack and frameworks, (2) directory structure and key modules, (3) patterns and conventions used, (4) areas relevant to [user's request]. Return a summary under 200 lines."
- サブエージェントは Read/Glob/Grep で探索し、結果を返す。メインコンテキストにはサマリーのみが入る。
- Path D/E の場合は、自然なドメイン境界、既存のモジュール分離、どの領域が既存スペックの拡張に見え、どこが新しい境界に見えるかの特定もサブエージェントに依頼する。
- Step 1 のトップレベルディレクトリ一覧で十分な小規模・自明なリクエストでは、サブエージェントの派遣をスキップする。

**コンテキスト予算**: メインコンテキストに読み込む合計を約 500 行未満に保つ。重い探索はサブエージェントが担う。

### Step 4: アイデアの理解

明確化のための質問を**一括ではなく順番に**行い、機能の詳細よりも境界の発見を優先する。

1. **誰が、なぜ**: 誰が問題を抱えているか？ どんな痛みを生んでいるか？
2. **望ましい結果**: 完了したとき、何が実現されているべきか？
3. **境界の候補**: この作業における自然な責務の継ぎ目はどこか？ 実装を独立して進められるよう、どこで分割できるか？
4. **境界外**: 関連していても、このスペックが明示的に所有すべきでないものは何か？
5. **既存か新規か**: どの部分が既存スペックの拡張に見え、どの部分が真に新しい境界に見えるか？
6. **上流 / 下流**: 既存のどのシステム・スペック・コンポーネントに依存するか？ 将来どんな作業がこれに依存しそうか？
7. **制約**: 技術・スケジュール・互換性の制約はあるか？

すでに読み込んだコンテキストから推測できない質問のみを行う。ステアリングドキュメントがすでに答えている質問はスキップする。ユーザーがすでに明確な説明を提供している場合は Step 5 へ進む。
ゴールは最終的なオーナーをこの時点で割り当てることではない。後にスペック・タスク・レビュースコープになり得る、最もクリーンな責務境界を発見することがゴールである。

### Step 5: アプローチの提案

トレードオフを添えて**2〜3 個の具体的なアプローチ**を提案する。

各アプローチについて:
- **アプローチ名**: 1 行のサマリー
- **動作の仕組み**: 技術的アプローチを 2〜3 文で
- **Pros**: このアプローチの良い点
- **Cons**: リスクや欠点
- **スコープ見積もり**: 大まかな複雑さ（small / medium / large）

技術調査が必要な場合（不慣れなフレームワーク、ライブラリ評価）は、Agent ツール経由でサブエージェントを派遣する。プロンプト例: "Research [topic]: compare options, check latest versions, note known issues. Return a summary of findings with recommendation." サブエージェントは WebSearch/WebFetch を使い、簡潔なサマリーを返す。生の検索結果がメインコンテキストに入ることはない。

1 つのアプローチを推奨し、理由を説明する。

**ユーザーがアプローチを選択した後**、Step 6 に進む前にサブエージェントを派遣して実現可能性を検証する。プロンプト例: "Verify the viability of this technical approach: [chosen tech stack / key libraries]. Check: (1) Are these technologies still actively maintained? (2) Any license incompatibilities (e.g., GPL contamination)? (3) Do the components actually work together for [use case]? (4) Any known showstoppers (critical bugs, security vulnerabilities, platform limitations)? Return only issues found, or 'No issues found' if everything checks out."

実現可能性チェックで問題が見つかった場合は、ユーザーに提示してアプローチ選択に立ち戻る。問題がなければ Step 6 へ進む。

### Step 6: 洗練と確認

- アプローチに関するユーザーの質問や懸念に対応する
- 必要に応じてスコープを絞る: より小さく届けられるインクリメントと、よりクリーンな責務の継ぎ目を優先する
- Path D/E の場合: 依存順序付きの作業分解を提案する
  - 境界に値する新規フィーチャー 1 つにつきスペック 1 つ
  - 既存スペックの拡張は、対象スペックとともに明示的に列挙する
  - 真に小さい直接実装項目は、無理にスペックに押し込まず別途列挙する
  - スペック / ワークストリーム間の依存関係を明示する
  - プロジェクトのニーズに応じて、垂直スライス（エンドツーエンドの価値）と水平レイヤー（1 レイヤーずつ）を比較検討する
- 最終的な方向性を確認する

### Step 7: ファイルをディスクに書き込む

**CRITICAL: 次のコマンドを提案する前に、必ず Write ツールでこれらのファイルを作成すること。会話のテキストはセッション境界を越えて残らない。このステップを飛ばすと、セッション終了時にディスカバリーの分析結果がすべて失われる。**

**Path C（単一スペック）の場合**:

Write ツールで `.kiro/specs/<feature-name>/brief.md` を以下の構造で作成する。

```
# Brief: <feature-name>

## Problem
[who has the problem, what pain it causes]

## Current State
[what exists today, what's the gap]

## Desired Outcome
[what should be true when done]

## Approach
[chosen approach and why]

## Scope
- **In**: [what this feature includes]
- **Out**: [what's explicitly excluded]

## Boundary Candidates
- [responsibility seam 1]
- [responsibility seam 2]

## Out of Boundary
- [explicit non-goals this spec does not own]

## Upstream / Downstream
- **Upstream**: [existing systems/specs this depends on]
- **Downstream**: [likely consumers or follow-on specs]

## Existing Spec Touchpoints
- **Extends**: [existing spec(s) this work updates, if any]
- **Adjacent**: [neighbor specs or modules to avoid overlapping]

## Constraints
[technology, compatibility, or other constraints]
```

**Path D（複数スペック分解）の場合**:

Write ツールで以下を作成する。
- `.kiro/steering/roadmap.md`
- `## Specs (dependency order)` に列挙されたすべてのフィーチャーについて `.kiro/specs/<feature>/brief.md`

以下のロードマップ構造を使う。

```
# Roadmap

## Overview
[Project goal and chosen approach -- 1-2 paragraphs]

## Approach Decision
- **Chosen**: [approach name and summary]
- **Why**: [key reasoning]
- **Rejected alternatives**: [what was considered and why it was rejected]

## Scope
- **In**: [what the overall project includes]
- **Out**: [what is explicitly excluded]

## Constraints
[technology, compatibility, timeline, or other project-wide constraints]

## Boundary Strategy
- **Why this split**: [why these spec boundaries improve independence]
- **Shared seams to watch**: [cross-spec boundaries needing careful review]

## Specs (dependency order)
- [ ] feature-a -- [one-line description]. Dependencies: none
- [ ] feature-b -- [one-line description]. Dependencies: feature-a
- [ ] feature-c -- [one-line description]. Dependencies: feature-a, feature-b
```

続いて、`## Specs (dependency order)` に列挙された**すべての**フィーチャーについて、Path C の brief フォーマットを使って `.kiro/specs/<feature>/brief.md` を作成する。これにより `/kiro-spec-batch` による並列スペック作成が可能になる。

**Path E（混合分解）の場合**:

Path D と同じロードマップ構造に、以下の追加セクションを加える。

```
## Existing Spec Updates
- [ ] existing-feature-a -- [one-line description of the extension]. Dependencies: none
- [ ] existing-feature-b -- [one-line description of the extension]. Dependencies: feature-a

## Direct Implementation Candidates
- [ ] small-item-a -- [why this stays direct implementation]
- [ ] small-item-b -- [why this stays direct implementation]

## Specs (dependency order)
- [ ] new-feature-a -- [one-line description]. Dependencies: none
- [ ] new-feature-b -- [one-line description]. Dependencies: new-feature-a
```

Path E のルール:
- `/kiro-spec-batch` が変更なしでパースできるよう、`## Specs (dependency order)` は**新規スペック専用**に保つ
- 既存スペックの拡張は `## Existing Spec Updates` に記録する
- 真にスペック不要な作業は `## Direct Implementation Candidates` に記録する
- `brief.md` は `## Specs (dependency order)` に列挙された**新規スペック**についてのみ作成する

**再エントリー（roadmap.md がすでに存在する場合）**:
Write ツールで次の新規スペックの brief.md を作成する。スコープや順序が変わった場合は Write ツールで roadmap.md を更新し、完了済み項目と過去のフェーズは保持する。

書き込み後、ファイルを読み戻して存在を確認する。

### Step 8: 次のステップを提案

次のコマンドを提案して停止する。このスキルから下流のスペック生成を自動実行しないこと。

- Path A: 既存スペックを更新するために `/kiro-spec-requirements {feature}`
- Path B: スペックを作成せず直接実装を推奨する
- Path C: デフォルトは `/kiro-spec-init <feature-name>`
  - 任意のファストパス: ユーザーが明示的にすぐ続行したい場合は `/kiro-spec-quick <feature-name>`
- Path D: デフォルトは `/kiro-spec-batch`（roadmap.md の依存順序に基づきすべてのスペックを並列作成）
  - 任意の慎重パス: 残りを一括処理する前に最初のスライスを検証したい場合は `/kiro-spec-init <first-feature-name>`
- Path E: 分解のうち新規スペック部分に基づいて次のコマンドを選ぶ
  - 新規スペックがちょうど 1 つの場合: `/kiro-spec-init <new-feature-name>`
  - 新規スペックが複数の場合: `/kiro-spec-batch`
  - 加えて、どの既存スペックを `/kiro-spec-requirements <feature>` で見直すべきかを示す
- 再エントリー: `/kiro-spec-init <next-feature-name>`、または複数のスペックが残っている場合は `/kiro-spec-batch`

分解の内容が既存スペックの更新と直接実装候補のみの場合、Path E を使わないこと。1 つの既存スペックが明確な受け皿である場合は Path A を優先するか、ロードマップエントリーを作らずに既存スペックの更新と直接実装作業を推奨する。

## 重要な制約
- **ディスク上のファイルが継続性の源泉**: Path C/D/E では、次のコマンドを提案する前に必要に応じて brief.md と roadmap.md を作成すること。ディスカバリーの結果を会話テキストだけに残さないこと。

## 安全策とフォールバック

**ロードマップがすでに存在する場合（再エントリー）**:
- 質問する前に roadmap.md を読んでプロジェクトコンテキストを復元する
- 完了済みスペックのステータスに基づいて次のスペックを決定する
- 次のスペックの brief.md のみを書く（ジャストインタイム）
- 実装経験に基づきスコープや順序が変わった場合は roadmap.md を更新する
- リクエストがプロジェクトを拡張する場合は、新規スペックを新しいフェーズとして追記し、既存の内容を上書きしないこと
