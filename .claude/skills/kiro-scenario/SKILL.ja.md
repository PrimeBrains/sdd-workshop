---
name: kiro-scenario
description: >
  人間が自分で書いた「ふるまい（When / Then）」を起点に、AI が現実（.kiro/specs・moira/MODEL.md・
  参照実装）へ接地し、受け入れシナリオ単位（.kiro/scenarios/units/{slug}.md）として描き起こして、
  独立敵対者による falsifiable な検証ループを通してから draft→agreed に確定するスキル。
  「受け入れシナリオを書く」「シナリオを検証ループにかける」「ふるまいを単位に起こして固める」で起動。
  ふるまい（When/Then）の発案（0→1）は人間——AI は §3 を発案せず、人間が語った内容を忠実に転記する
  （新規シナリオの規律。既存 unit の変更は、変更 issue に人間が書いたふるまい記述を発案として扱ってよい）。
  MODEL レベルの矛盾は確認のうえ moira-model-update へ委譲する。Opus 4.8+ / effort max を強く推奨する高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebSearch, WebFetch, Skill
argument-hint: <slug or 既存ユニットパス> [--rounds N]
model: opus
metadata:
  origin: "custom"
  shared-rules: "scenario-vectors.md"
---

# kiro-scenario — 人間が書いたふるまいを単位に起こし、敵対者ループで確定する

人間が自分で書いた**ふるまい（When / Then）**を種に、AI が現実へ接地して受け入れシナリオ単位
（`.kiro/scenarios/units/{slug}.md`）を描き起こし、**独立した敵対者による falsifiable な確定ゲート**を
通してから `draft→agreed` に確定する。役割分担は `.kiro/scenarios/README.md`：**人間=シナリオの妥当性**
（作るべきか／ユーザーが気づけるか）、**専門家エージェント=MODEL 整合**、**調停者（本スキルの主コンテキスト）
=両者の調整と自己検証ループ**。

> **ガードレール（最重要）:** §3 のふるまい（When/Then）の**0→1＝「何を確かめるか」の発案・判断は人間が行う。**
> 守るべき線は「§3 に AI が一文字も書かないこと」ではなく、**ふるまいを発案するのが人間であること**。
> したがって——**人間が自分の言葉で（口頭でも箇条書きでも）ふるまいを語ったなら、AI はそれを §3 の When/Then に
> 要約・転記してよい**。条件は (a) 人間の語りに忠実で AI が新しいふるまいを混入させないこと、(b) 足した線引き
> （boundary）は明示してユーザー確認に回すこと、(c) 人間が読み返して「自分の意図だ」と確定（ratify）すること。
> **人間がふるまいを語っていない**（「ディスカバリーのシナリオを作って」だけ等）なら、AI は §3 を発案してはならず、
> 種テンプレを出して停止する。これを破り **AI がふるまいを 0→1 で発案**すると、「AI が書いた仕様を AI が作った
> シナリオで通す」自己採点に退化し、外的妥当性の検証というシナリオの存在意義が失われる。
>
> **既存 unit の変更の緩和（2026-07-19 改訂・issue #39）**: 既存 unit の変更でも**発案が人間である
> ことは変わらない**——緩和されるのは発案の受け取り方だけ。**既存 unit**（`.kiro/scenarios/units/` に
> 実在し §3 が記入済みの unit。種テンプレのみの seed は「新規」扱い）の変更では、**変更 issue に人間が
> 自分の言葉で書いたふるまい記述（verbatim 原文）**を発案として扱ってよく、AI がそれに忠実に §3 を
> 改稿する（忠実性の条件 (a)(b) は同じ。人間の読み返し確定は、変更管理フロー起動時は HA 事前批准記録
> ＋採点者の意図整合検査が代替する）。**発案根拠にできるのは人間の原文のみ**——変更管理フロー P1 の
> AI 書き起こし文（明確化された変更要求文）は発案根拠にしない（AI 文経由の発案ロンダリングを塞ぐ）。
> issue が機械起票等で**人間のふるまい記述を含まない**場合のみ、人間に発案を求める（変更管理フローでは
> 前半集約セッションで聞く）。新規シナリオは従来どおり——人間が語るまで AI は §3 を発案しない。

規律は補助ファイルに分かれている。**派遣・判定の前に必ず読む**：
- `scenario-vectors.md`（本スキル所有）— シナリオ攻撃角 SC1–SC7 ＋ ESCALATE 規則。
- `../doc-refine/review-gate.md`（参照）— falsifiable 確定ゲート、三者分離、同一ラウンド内の反証再反論、相反裁定、一次資料確定、停止性。
- `../doc-refine/model-and-subagent-policy.md`（参照）— 推奨モデル/effort（best-effort）、サブエージェント派遣、ラウンド内コスト上限。
- `../doc-refine/adversarial-vectors.md`（参照）— 一般文書 攻撃角 G1–G4（SC の前に当てる土台）。

> 第3の写しを作らないため、ゲート/方針/一般攻撃角は `doc-refine` のものを**パス参照で再利用**する
> （所有するのは `scenario-vectors.md` のみ）。

## 引数
- `<対象>`: シナリオ slug（例 `discovery-spec-proposed`）または既存ユニットパス（`.kiro/scenarios/units/<slug>.md`）。
- `--rounds N`: 上限ラウンド（既定 3、**N ≥ 2 を強制**。N<2 は拒否）。

## 手順（規範）

### 0. 起動前提（best-effort）
`../doc-refine/model-and-subagent-policy.md` に従い、Opus 4.8+ / effort max を推奨表示（機械強制はしない）。
以降に派遣するサブエージェントは**敵対者・採点者（`doc-adversary`/`doc-gate-judge`）= `model: opus`、事実検証 worker（`doc-fact-checker`）= `model: sonnet`**とし、プロンプトで「最大徹底度・真に敵対的・不確実なら破れている側に倒せ」を課す。

### 1. 人間の種（HUMAN SEED — ガードレール）
slug を `.kiro/scenarios/units/{slug}.md` に解決し、**「人間がふるまいを 0→1 で発案したか」**を判定する（発案の所在＝起動引数・直前までの会話・**既存 unit の変更なら変更 issue に人間が書いたふるまい記述**のいずれかで、人間が自分の言葉で「何を確かめたいか／何が起きてほしいか」を語っているか）。
- **発案がある（人間が自分の言葉でふるまいを語っている）が §3 が未記入**なら：その語りを §3 の When/Then に**忠実に要約・転記する**（新しいふるまいを足さない。線引き＝boundary を足す場合は明示してユーザー確認に回す）。転記後は**ユーザーに読み返し・確定（ratify）を求める**。**変更管理フロー起動時**は、When/Then の発案・確定が HA で完了している（intent-ratification の ③ に記録済み）なら、その記録を ratify として扱いここでの読み返し確定を省略できる（HA が覆っていなければ従来どおり求める）。確定されるまでは draft の種であり、確定後に**不可侵の人間意図**として扱い、以降の描き起こし・パッチで改変しない。
- **発案がない**（ファイルが**無い**／§3「ふるまい（When / Then）」が空・プレースホルダのまま／会話にも人間の語りが無く「〜のシナリオを作って」だけ）なら：`templates/unit-seed.template.md` を読み、`{{SLUG}}`/`{{TITLE}}` を置換して当該パスに **`Write`（種だけ）し、ここで停止**する。ユーザーに「§3 のふるまいを自分の言葉で発案して（語って）ください」と告げる。**AI は §3 を発案しない**（人間の語りが無い状態で AI が spec/MODEL からふるまいを作り出すことは禁止）。
- **既存 unit の変更**（§3 記入済みの unit＋変更 issue に人間が verbatim で書いたふるまい記述がある）なら: その**原文**を発案として §3 を**改稿してよい**（ガードレールの緩和条項。P1 の AI 書き起こし文は根拠にしない）。改稿後はユーザーの読み返し確定を得る（変更管理フロー起動時は HA 事前批准記録＋採点者の意図整合検査が代替）。「§3 不可侵」の意味は**人間発案の範囲外で AI が改変しない**ことであり、人間の issue 記載に基づく改稿を禁じない。
  **既存 unit の変更だが issue に人間のふるまい記述が無い**（機械起票等）なら: 次項の「先へ進む」に落とさず、**人間に発案を求める**（変更管理フローでは前半集約セッションで聞く）。
- 既に §3 が**人間によって書かれている／前段で確定済み**で、かつ §3 の変更を要しない（または上記 2 項に該当しない）なら先へ進む。以降、**§3 は不可侵の人間意図**として扱い、描き起こし・パッチで改変しない。**§3 の変更を要する場合は上記 2 項が本項に優先する**。

### 2. 現実への接地（GROUND）
§3 のふるまいが触れる現実を読む：関連する `.kiro/specs/*`（requirements 等）、`moira/MODEL.md`、参照実装
（`moira/backend/src/types.ts`・`moira/backend/src/fixtures/tiny-project.ts`・`moira/frontend/src/surfaces/`・`moira/UI-ARCHITECTURE.md`）。
- 実在の **4イベント**（`transition`/`decompose`/`relate`/`cost`；`types.ts` の型）、**サーフェス**、**ログの3つの出力先**、
  **継ぎ目 `⟿`**（spec/skill を跨ぐ箇所）、**未実装 `⚠`**（今ない skill）を同定する。
- `touches_specs` / `touches_requirements` を `.kiro/steering/trace-notation.md` に従い**全列挙**で確定する
  （範囲・ワイルドカード・注釈・自由文 禁止。各 ID が実在することを確認）。
- **接地の一次資料セットを `AskUserQuestion` でユーザーに確定させ、その記録を残す**
  （これが後段ゲートの `SOURCE_SET_CONFIRMED` の根拠。`doc-fact-checker` の `SOURCE_SET: OK` は『リストが渡った』ことしか意味しない）。
  **変更管理フロー起動時**: HA で一次資料セットが確定済みなら、その記録を確定記録として扱いここでの `AskUserQuestion` は省略してよい（`../doc-refine/review-gate.md`「変更管理フロー連携」。HA が覆っていない資料が新たに要る場合は従来どおり）。

### 3. 単位を描き起こす（RENDER）
`templates/unit.template.md` を雛形に、`.kiro/scenarios/README.md` v0.2 と gold 単位
`.kiro/scenarios/units/estimate-spec-proposed.md` の様式に一致させて `.kiro/scenarios/units/{slug}.md` を描く：
- frontmatter（`status: draft`、新規サーフェスは `名前(新規)`、トレース全列挙）。
- §1 平易な一行 / §2 前提（Given）＋ before 表 / **§3 人間の When/Then をそのまま差し込む（手順1で正当に確定・改稿された版。以降の改変禁止）** /
  §4 画面 Before→After を **HTML インラインスタイルのモックアップ と Markdown データ表の両方**で（`moira/frontend` の実挙動に一致）/
  §5 ログを **3つの実在の出力先**（イベントストア JSON＝`types.ts` 形 ／ 会話ログ ／ 画面。新規画面は `(新規)`）で /
  §6 受け入れ条件を**日本語 EARS**（WHEN/WHILE … システムは … しなければならない/してはならない；`.kiro/steering/requirements-style.md`）で /
  §7 は確定まで空。
- §3/§6 に moira 専門用語・skill 実名・MODEL 記号を本文へ出さない（必要なら最小の注釈に留める＝README）。

### 4. 検証ループ（三者分離・`doc-*` を再利用）
ラウンドは `--rounds N`（既定 3、N≥2）まで。1ラウンド = 「敵対派遣 → 分岐振り分け → 事実検証 → パッチ → 採点」。

- **4a 敵対派遣:** `doc-adversary` を**並列・独立**に起動する。既定 = Claude `doc-adversary`（`model: opus`）1 体＋codex レビュー 1 本（独立ベンダー・read-only）（`../doc-refine/model-and-subagent-policy.md` のコスト上限内）。最重要対象でユーザー明示時のみ Claude 2 体＋codex 1 本に増強可。codex 不在環境は Claude 2 体で代替し、多様性欠如を報告に明記する。
  各体に渡す：対象ユニット、**「§3 は人間意図——書き換えるな」の明示**、接地の一次資料、攻撃角
  ＝`../doc-refine/adversarial-vectors.md` の G1–G4 を土台に `scenario-vectors.md` の **SC1–SC7**。互いの結論は見せない。
- **4b 分岐のユーザールーティング:** 敵対者が `FORK` とした、または分岐と認めた**人間の意図に属する判断**は、
  著者が勝手に決めず `AskUserQuestion` でユーザーに回す。**変更管理フロー（`moira-change` P4）起動時**は
  `../doc-refine/review-gate.md`「変更管理フロー連携」に従う: HA 事前批准記録が分岐・一次資料確定・
  読み返し確定（ratify）を実質的に覆うなら記録で決着とし、覆わない genuine fork はフローの fork バッチ
  （HB）へ回す（裁定を得る前に確定はできない）。採点（4f）では批准記録を採点者に渡し、意図整合検査を
  判定に含めさせる。
- **4c 事実検証:** 敵対者の `CLAIMS_FOR_FACT_CHECK` と §4/§5 のパス・event 形などの事実主張を `doc-fact-checker` に渡す
  （ステップ2で確定した一次資料を明示）。CORRECTED/UNVERIFIABLE は修正対象。同一主張群の反復は最大3巡。
- **4d MODEL エスカレーション（確認してから委譲）:** `ESCALATE: moira-model-update` とタグされた指摘
  （矛盾の所在が**シナリオ文書側でなく MODEL 正典側**＝MODEL 自身の曖昧/自己矛盾/未規定）が出たら：
  1. **`AskUserQuestion` で確認**——「MODEL 正典側の矛盾を検出。`moira-model-update` を回しますか？」。
  2. YES なら **Skill ツールで `moira-model-update` を起動**し、矛盾（人間の §3 ＋ 違反する MODEL 規則 ＋ 当該指摘）を渡す。
     当該スキルが自身のループ（敵対→FORK→gate）を回し、`moira/MODEL.md`/`DECISIONS.md` を確定して Verdict を返す。
  3. 戻ったら **MODEL/specs を再読し §4/§5 を再接地**、裁定結果を §7 に**決定として**記録（出所＝MODEL §/DECISIONS/会話ログを添える；FORK としては残さない）、4a へ戻る。
  - **本スキルは `moira/MODEL.md` を編集しない。** 正典の改訂は常に `moira-model-update` の責務。
- **4e パッチ（著者のみ）:** 指摘・訂正・ユーザー決定を反映して**主コンテキストだけ**がシナリオ文書をその場編集する。
  レビューワーは書き換えない（`doc-*` は Write/Edit を持たない）。Critical/Important を**反証で退ける**場合は、
  その反証を**同一ラウンド内で別の `doc-adversary` に差し戻して再反論**させる（先送り禁止；`../doc-refine/review-gate.md`）。
- **4f 採点:** `doc-gate-judge` を1体起動し、`../doc-refine/review-gate.md` 基準で PASS/FAIL を取る。FAIL なら次ラウンド（4a へ）。**例外（変更管理フロー起動時）**: 採点で未決が AWAITING-HB の保留のみなら、次ラウンドの敵対派遣は行わず、HB 裁定を得て反映したのち**同一ラウンドとして採点を再実行**する（ラウンド番号を進めない——`../doc-refine/review-gate.md`「変更管理フロー連携」）。

### 5. 確定（CONFIRM・ゲート通過後のみ）
次が**すべて**満たされたら確定：**反論されない Critical = 0、かつ Important は全件 disposition 済み**（修正／健全な反証／追跡付き deferred〔後続 issue への参照＋owner＋再評価条件、その issue が open で生きていること〕。deferred は報告に全件列挙）／相反指摘は裁定済／**一次資料がユーザー確定済（SOURCE_SET_CONFIRMED）**／
全 FORK ルーティング済／**全 MODEL エスカレーション解決済**／停止性。満たせば：
- ユニットの `status` を `draft` → `agreed` に上げる。
- §7 決定事項に**確定した決定のみ**を書く（委譲して裁定された MODEL 由来の決定は、出所＝MODEL §/DECISIONS/会話ログの参照を添えて記す。gold 単位 §7 と同形）。
- **会話ログ**を `.kiro/steering/spec-conversations.md` 規約で書く（横断 → `.kiro/conversations/{YYYY-MM-DD}-{slug}.md`、単一 spec 固有 → `.kiro/specs/{feature}/conversations/…`）。
  frontmatter（created_at/title/bindings〔scenario ＋ あれば model/decision〕/source）＋ 要約（論点/選択肢/決定/理由）＋（あれば）覆った判断 ＋ 生ログ。
- コミット/push は CLAUDE.md / リポのブランチ運用に従い、**ユーザーが依頼したときのみ**行う（`main` 直コミットは避ける）。

### 5b. 確定しない場合（正直化）
上限ラウンド打ち切り時に未決着の Critical または disposition されない Important が残るなら**確定しない**（打ち切りを PASS にしない。停止規則・撤回条件は review-gate.md）。
`status` は `draft`/`in-review` のまま、残課題を §7 と報告に正直に出す。

## 自己適用時の注意
本スキル自身・`scenario-vectors.md`・テンプレートを磨く場合は、`doc-refine` の自己適用ガイド（開始時スナップショットを
プロンプトに埋め、土台と対象を版で分離）に倣う。

## 既存スキルとの境界
- `kiro-spec-*`：spec（requirements/design/tasks）を生成する。本スキルはその**受け入れシナリオ**を人間の種から起こす。
- `doc-refine`：本スキルが再利用する**汎用文書レビュー機構**（`doc-*` 三者＋ゲート/方針/一般攻撃角の所有元）。
- `moira-model-update`：Moira **正典モデル専用**の確定ゲート。本スキルの **MODEL エスカレーション先**（本スキルは MODEL を編集しない）。
- `kiro-review` / `kiro-verify-completion`：**実装**のレビュー/完了検証。本スキルは実装でなく受け入れシナリオ文書が対象。
- **flow（複数ユニットの E2E 合成）は本スキルのスコープ外**（v1）。将来 `kiro-scenario-flow` が `composes:` で担う。

## 出力フォーマット（Scenario Verdict）

```md
## Scenario Verdict
- TARGET: <units/{slug} のパス>
- SEED_STATUS: emitted-and-stopped（種テンプレを出して停止）| human-filled（人間の §3 で進行）
- GROUNDING: <接地した spec/MODEL/impl と確定した一次資料セット>
- ROUNDS: <各ラウンドの 敵対→パッチ 要約>
- FORKS_RAISED: <ユーザーに回した分岐と決着>
- MODEL_ESCALATIONS: <moira-model-update へ委譲した件と Verdict、無ければ none>
- GATE: <doc-gate-judge の最終判定。反論されない Critical = 0・Important 全件 disposition 済みの証跡＋SOURCE_SET_CONFIRMED>
- FINAL: <確定（agreed）＋会話ログのパス／または「確定せず：残課題」>
```
