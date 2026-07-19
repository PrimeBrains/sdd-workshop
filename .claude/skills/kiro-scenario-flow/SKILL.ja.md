---
name: kiro-scenario-flow
description: >
  確定済みの受け入れシナリオ・ユニット（kiro-scenario が作る `.kiro/scenarios/units/{slug}.md`）を
  順に合成した E2E フロー文書（`.kiro/scenarios/flows/{slug}.md`）を生成・確定するスキル。
  どのユニットを・どの順で・どこからどこまで一つのフローにするか／何をスコープ外にするかは人間が明示承認し、
  通しのフロー固有の価値・観点（合成で初めて見える創発的性質）は AI が生成する。AI がドラフトを描いたら人間が
  レビューして批准（ratify）し、その AI 生成の通し価値・合成の健全性を独立敵対者の falsifiable 検証ループで
  固めてから draft→agreed に確定する。「E2E フローを書く」「ユニットを合成して通しを作る」で起動。
  メンバー側の欠陥は kiro-scenario へ、MODEL レベルの矛盾は moira-model-update へ委譲する。
  Opus 4.8+ / effort max を強く推奨する高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebSearch, WebFetch, Skill
argument-hint: <slug or 既存フローパス> [--rounds N]
model: opus
metadata:
  origin: "custom"
  shared-rules: "flow-vectors.md"
---

# kiro-scenario-flow — 確定ユニットを通しに合成し、敵対者ループで確定する

確定済みの受け入れシナリオ・ユニット（`kiro-scenario` が作る `.kiro/scenarios/units/{slug}.md`）を
**順に合成**して E2E フロー文書（`.kiro/scenarios/flows/{slug}.md`）を描き起こし、**独立した敵対者による
falsifiable な確定ゲート**を通してから `draft→agreed` に確定する。役割分担は `.kiro/scenarios/README.md`：
**人間=フローのスコープとドラフトの妥当性**（この通しを作るべきか／AI が描いた通し価値は本当に確かめたいものか）、
**専門家エージェント=MODEL 整合**、**調停者（本スキルの主コンテキスト）=両者の調整と自己検証ループ**。

> **ガードレール（最重要）— 人間所有は「発案」でなく「スコープ承認＋ドラフト批准」:**
> フローでは、kiro-scenario と違って **§3 の通しの価値（E2E 価値）を人間が 0→1 発案する必要はない**。
> 通しのフロー固有の価値・観点は**合成して初めて見える創発的性質**（各継ぎ目で正直な信号——カバレッジ低下・
> 見かけ100%の正直化・差し戻しの CPI——を保ったまま真の完了まで運べる、等）であり、**これは AI が生成してよい**。
> 代わりに、外的妥当性を守るアンカーは人間の次の2点に移る:
> 1. **スコープ承認（合成前）:** どのユニットを・どの順で・どこからどこまで一つのフローにするか／何をスコープ外
>    （寄り道＝別フロー）にするかを**人間が明示承認**する。これは発案でなく**選択・合成の承認**。
> 2. **ドラフト批准（描画後・ループ前）:** AI が生成した通しの価値（§1/§3）を**人間がドラフトレビューで批准（ratify）**
>    する——「これは本当に確かめたい通しだ」と読み返して承認する。
> この2点が無いまま AI 生成の通しを固めると、「AI が選んで・AI が価値を作り・AI が通す」自己採点に退化し、
> 外的妥当性の検証というフローの存在意義が失われる。**検証ループは、この AI 生成の通し価値・合成の健全性を
> 敵対的に検証するために回す**（ユニット個々のふるまいは既に各ユニットのループで agreed 済み——再検証しない）。

規律は補助ファイルに分かれている。**派遣・判定の前に必ず読む**：
- `flow-vectors.md`（本スキル所有）— フロー攻撃角 FC1–FC7 ＋ ESCALATE 規則。
- `../doc-refine/review-gate.md`（参照）— falsifiable 確定ゲート、三者分離、同一ラウンド内の反証再反論、相反裁定、一次資料確定、停止性。
- `../doc-refine/model-and-subagent-policy.md`（参照）— 推奨モデル/effort（best-effort）、サブエージェント派遣、ラウンド内コスト上限。
- `../doc-refine/adversarial-vectors.md`（参照）— 一般文書 攻撃角 G1–G4（FC の前に当てる土台）。

> 第3の写しを作らないため、ゲート/方針/一般攻撃角は `doc-refine` のものを**パス参照で再利用**する
> （所有するのは `flow-vectors.md` のみ）。単体ユニット攻撃角 SC1–SC7 はメンバーの確定時に当て済み
> （本スキルが攻めるのは **AI 生成のフロー固有内容＝メンバー間の継ぎ目と通しの価値**であって、メンバー自身ではない）。

## 引数
- `<対象>`: フロー slug（例 `new-spec-to-impl-complete`）または既存フローパス（`.kiro/scenarios/flows/<slug>.md`）。
- `--rounds N`: 上限ラウンド（既定 3、**N ≥ 2 を強制**。N<2 は拒否）。

## 手順（規範）

### 0. 起動前提（best-effort）
`../doc-refine/model-and-subagent-policy.md` に従い、Opus 4.8+ / effort max を推奨表示（機械強制はしない）。
以降に派遣するサブエージェントは**敵対者・採点者（`doc-adversary`/`doc-gate-judge`）= `model: opus`、事実検証 worker（`doc-fact-checker`）= `model: sonnet`**とし、プロンプトで「最大徹底度・真に敵対的・不確実なら破れている側に倒せ」を課す。

### 1. スコープ承認（HUMAN — 必須ゲート・発案ではない）
slug を `.kiro/scenarios/flows/{slug}.md` に解決する。フローの**範囲を人間に明示承認させる**（AI はここで通しの価値を発案しない——範囲を提案するだけ）：
- 候補ユニット群を `.kiro/scenarios/units/*.md` から同定し、`templates/flow-scope.template.md` を雛形に **スコープ提案**を組む：合成するユニット（順序・各 status・一行の役割）／**起点（先頭メンバーの precondition）と終点（末尾メンバーの postcondition）**＝どこからどこまで／**スコープ外**（この通しに含めない・別フロー後送りにするふるまいと理由）。
- `AskUserQuestion` で **ユニット集合・順序・起点/終点・スコープ外の線引きを人間に明示承認させ、その確定記録を残す**（これがゲートの `SCOPE_APPROVED` の根拠）。承認されるまで先に進まない。
- `composes:` の候補に**未 agreed メンバー**があれば、ここで人間に「(a) 先に `kiro-scenario` で agreed へ昇格／(b) フローを draft 据え置きで成熟を待つ」を確認する。
- **AI は通しの価値（§3）をこの段では書かない。** 範囲が承認されたら §2 へ。

### 2. 現実への接地（GROUND）
承認された範囲が合成する現実を読む：
- **README flows 規約**（`.kiro/scenarios/README.md` v0.2 の「ユニットとフロー」「frontmatter」`composes:`）。README に無いフロー固有の様式はユニット規約から写像する。
- **承認された各メンバーユニット**（`.kiro/scenarios/units/*.md`）を全て読む。各メンバーの `precondition`/`postcondition`/`status`/`touches_*`/§4 数値（EV%・カバレッジ）を抽出する。
- **postcondition→precondition の連鎖**を検算する：並び順で、前者の postcondition の累積が後者の precondition を満たすか、状態（lifecycle・承認・凍結）と数値（EV%・カバレッジ・人日）が継ぎ目で**連続**するかを確認する（飛び・段差・巻き戻しを同定）。
- **継ぎ目**を同定する：メンバー間の `⟿`（spec/skill を跨ぐ／前段の出力が次段の入力になる接続点）と `⚠`（未実装 skill を跨ぐ箇所）。**単体ユニットでは行使できない、通しでのみ突ける継ぎ目**を明確にする。
- **トレース合併**を確定する：フローの `touches_specs`/`touches_requirements` を、**全メンバーの当該リストの重複排除した全列挙の和**として算出する（`.kiro/steering/trace-notation.md` 準拠・範囲/ワイルドカード/注釈/自由文 禁止。各 ID が実在することを確認）。
- **接地の一次資料セットを `AskUserQuestion` でユーザーに確定させ、その記録を残す**
  （これが後段ゲートの `SOURCE_SET_CONFIRMED` の根拠。一次資料＝README・各メンバーユニット・trace-notation・関連 MODEL §。`doc-fact-checker` の `SOURCE_SET: OK` は『リストが渡った』ことしか意味しない）。

### 3. ドラフトを描く（RENDER — AI が通しの価値を生成）
`templates/flow.template.md` を雛形に、`.kiro/scenarios/README.md` v0.2 の様式に一致させて `.kiro/scenarios/flows/{slug}.md` を `status: draft` で描く。**ここで AI は通しのフロー固有の価値・観点を生成する**（合成で初めて見える創発的性質を言語化する——これは正当な AI 生成。次の §4 で人間の批准に回す）：
- frontmatter（`id: flows/{slug}`、`status: draft`、**`composes:` を承認順で全列挙**、トレースはメンバーの重複排除した和を全列挙）。
- §1 このフローで確かめること（**AI 生成の通しの E2E 価値**を 1〜2 行・平易） / §2 合成するユニット（`composes:` の順序＋各メンバーの一行役割＋連鎖の起点 precondition と終点 postcondition） / §3 **AI 生成の通しの When/Then**（単独ユニットの和では言えない創発性質を平易に） / §4 通しの変化 Before→After を **HTML インラインスタイルのモックアップ と Markdown データ表の両方**で（EV% 弧・カバレッジ・lifecycle の段階遷移を通しで・`moira/frontend` の実挙動に一致） / §5 継ぎ目と境界接続（メンバー間の `⟿`/`⚠` ＋ postcondition→precondition の連続を表で） / §6 通しの受け入れ条件を**日本語 EARS**（WHEN/WHILE … システムは … しなければならない/してはならない；`.kiro/steering/requirements-style.md`）で / §7 は確定まで空。
- §3/§6 に moira 専門用語・skill 実名・MODEL 記号を本文へ出さない（必要なら最小の注釈に留める＝README）。
- 本文の語りは **`composes:` と双方向で一致**させる。

### 4. ドラフト批准（HUMAN レビュー — 必須ゲート・ループ前）
描いたドラフトを**人間にレビューさせ、批准（ratify）を取る**（これが外的妥当性のアンカー。ループはここを通過するまで回さない）：
- ドラフト、特に **AI が生成した §1 の E2E 価値・§3 の通しの When/Then** を人間に提示し、「この通しは本当に確かめたいものか／通しの価値の述べ方は妥当か」を `AskUserQuestion` で問う。
- **批准されたら**：その記録を残し（ゲートの `DRAFT_RATIFIED` の根拠）、§5 へ。批准後の §1/§3 は人間が承認した通し価値として扱い、ループ中の**実質的改変時は再批准**を取る。
- **方向修正を求められたら**：その指示に従って §1/§3 を描き直し、再度この段で批准を取る（ループには入らない）。

### 5. 検証ループ（三者分離・`doc-*` を再利用）
**ループの目的＝ AI が生成したフロー固有の価値・観点（§1/§3）と合成の健全性を敵対的に検証すること。** ユニット個々のふるまいは既に各ユニットのループで agreed 済みゆえ再検証しない。ラウンドは `--rounds N`（既定 3、N≥2）まで。1ラウンド = 「敵対派遣 → 分岐振り分け → 事実検証 → パッチ → 採点」。

- **5a 敵対派遣:** `doc-adversary` を**並列・独立**に起動する。既定 = Claude `doc-adversary`（`model: opus`）1 体＋codex レビュー 1 本（独立ベンダー・read-only）（`../doc-refine/model-and-subagent-policy.md` のコスト上限内）。最重要対象でユーザー明示時のみ Claude 2 体＋codex 1 本に増強可。codex 不在環境は Claude 2 体で代替し、多様性欠如を報告に明記する。
  各体に渡す：対象フロー、**「§1/§3 は人間が批准済みの通し価値——方向そのものを覆すなら FORK でユーザーへ。捏造・過大主張は攻撃せよ」の明示**、接地の一次資料（README・各メンバーユニット・trace-notation）、攻撃角＝`../doc-refine/adversarial-vectors.md` の G1–G4 を土台に `flow-vectors.md` の **FC1–FC7**。互いの結論は見せない。
- **5b 分岐のユーザールーティング:** 敵対者が `FORK` とした、または分岐と認めた**人間の意図に属する判断**（特に FC4 の通し価値の方向・スコープの線引き）は、著者が勝手に決めず `AskUserQuestion` でユーザーに回す。
- **5c 事実検証:** 敵対者の `CLAIMS_FOR_FACT_CHECK`、および**連鎖（postcondition→precondition の連続）・トレース合併（重複排除の和）・数値（EV%/カバレッジ弧）**の事実主張を `doc-fact-checker` に渡す
  （ステップ2で確定した一次資料を明示）。CORRECTED/UNVERIFIABLE は修正対象。同一主張群の反復は最大3巡。
- **5d エスカレーション（確認してから委譲）:**
  - `ESCALATE: kiro-scenario` とタグされた指摘（欠陥の所在が**フロー文書側でなくメンバーユニット側**＝メンバーの postcondition/precondition 自体が誤り・メンバーが未 agreed）→ フロー文書のパッチで糊塗せず、**`AskUserQuestion` で確認のうえ当該メンバーを `kiro-scenario` で是正/昇格**する。戻ったらメンバーを再読して §2/§4/§5 を再接地し、5a へ戻る。
  - `ESCALATE: moira-model-update` とタグされた指摘（矛盾の所在が**フロー文書側でなく MODEL 正典側**＝MODEL 自身の曖昧/自己矛盾/未規定、特に継ぎ目の規定が正典に無い）→ **`AskUserQuestion` で確認**のうえ **Skill ツールで `moira-model-update` を起動**（矛盾＝該当指摘＋違反 MODEL 規則を渡す）。戻ったら MODEL/specs を再読し §4/§5 を再接地、裁定結果を §7 に**決定として**記録（出所＝MODEL §/DECISIONS/会話ログを添える）、5a へ戻る。
  - **本スキルは `moira/MODEL.md` も メンバーユニット文書も編集しない。** 正典の改訂は `moira-model-update`、メンバーの是正は `kiro-scenario` の責務。本スキルが編集するのはフロー文書のみ。
- **5e パッチ（著者のみ）:** 指摘・訂正・ユーザー決定を反映して**主コンテキストだけ**がフロー文書をその場編集する。
  レビューワーは書き換えない（`doc-*` は Write/Edit を持たない）。Critical/Important を**反証で退ける**場合は、その反証を**同一ラウンド内で別の `doc-adversary` に差し戻して再反論**させる（先送り禁止；`../doc-refine/review-gate.md`）。**§1/§3 の方向を実質的に変えるパッチは §4 の人間批准に差し戻す。**
- **5f 採点:** `doc-gate-judge` を1体起動し、`../doc-refine/review-gate.md` 基準で PASS/FAIL を取る。FAIL なら次ラウンド（5a へ）。

### 6. 確定（CONFIRM・ゲート通過後のみ）
次が**すべて**満たされたら確定：**反論されない Critical = 0、かつ Important は全件 disposition 済み**（修正／健全な反証／追跡付き deferred〔後続 issue への参照＋owner＋再評価条件、その issue が open で生きていること〕。deferred は報告に全件列挙）／相反指摘は裁定済／**スコープが人間承認済（SCOPE_APPROVED）**／**ドラフトが人間批准済（DRAFT_RATIFIED）。ループ中に §1/§3 を実質改変したなら再批准済**／**一次資料がユーザー確定済（SOURCE_SET_CONFIRMED）**／全 FORK ルーティング済／**全エスカレーション解決済（メンバー是正＋MODEL）**／**`composes:` の全メンバーが `agreed`**／停止性。満たせば：
- フローの `status` を `draft` → `agreed` に上げる。
- §7 決定事項に**確定した決定のみ**を書く（委譲して裁定された MODEL 由来の決定は、出所＝MODEL §/DECISIONS/会話ログの参照を添えて記す）。
- **会話ログ**を `.kiro/steering/spec-conversations.md` 規約で書く（横断 → `.kiro/conversations/{YYYY-MM-DD}-{slug}.md`、単一 spec 固有 → `.kiro/specs/{feature}/conversations/…`）。
  frontmatter（created_at/title/bindings〔flow ＋ あれば model/decision〕/source）＋ 要約（論点/選択肢/決定/理由）＋（あれば）覆った判断 ＋ 生ログ。
- コミット/push は CLAUDE.md / リポのブランチ運用に従い、**ユーザーが依頼したときのみ**行う（`main` 直コミットは避ける）。

### 6b. 確定しない場合（正直化）
上限ラウンド打ち切り時に未決着の Critical または disposition されない Important が残る、または `composes:` に未 agreed メンバーが残る、またはドラフト批准が取れていないなら**確定しない**（打ち切り・メンバー未成熟・未批准を PASS にしない。停止規則・撤回条件は review-gate.md）。
`status` は `draft`/`in-review` のまま、残課題（特に未成熟メンバーの slug と昇格手段）を §7 と報告に正直に出す。

## 任意・推奨：確定前の doc-refine ハードニング
本スキル自身は「正として参照される文書」を生むため、（任意・推奨）フロー確定前に `doc-refine` で 1 周ハードニングしてよい。本スキル自身・`flow-vectors.md`・テンプレートを磨く場合は、`doc-refine` の自己適用ガイド（開始時スナップショットをプロンプトに埋め、土台と対象を版で分離）に倣う。

## 既存スキルとの境界
- `kiro-scenario`：人間の種から**個々の受け入れシナリオ・ユニット**を起こす（人間がふるまいを発案）。本スキルはその**確定ユニットを合成**して E2E フローを起こす（通し価値は AI 生成・人間が批准）。本スキルの **メンバー是正 エスカレーション先**。
- `kiro-spec-*`：spec（requirements/design/tasks）を生成する。
- `doc-refine`：本スキルが再利用する**汎用文書レビュー機構**（`doc-*` 三者＋ゲート/方針/一般攻撃角の所有元）。
- `moira-model-update`：Moira **正典モデル専用**の確定ゲート。本スキルの **MODEL エスカレーション先**（本スキルは MODEL を編集しない）。
- `kiro-scenario-e2e`：シナリオ unit を Playwright 回帰に落とす（現状 unit 単位）。**フロー E2E の自動回帰は本スキル成立後の後続**。
- `kiro-review` / `kiro-verify-completion`：**実装**のレビュー/完了検証。本スキルは実装でなく E2E フロー文書が対象。

## 出力フォーマット（Flow Verdict）

```md
## Flow Verdict
- TARGET: <flows/{slug} のパス>
- SCOPE_APPROVED: <人間が承認したユニット集合・順序・起点/終点・スコープ外の記録>
- COMPOSES: <合成したユニット（順序）と各 status＝全 agreed か>
- DRAFT_RATIFIED: <人間がドラフト（§1/§3 の通し価値）を批准した記録。ループ中の実質改変→再批准の有無>
- GROUNDING: <接地した README/メンバー/MODEL/impl と確定した一次資料セット>
- CHAIN: <postcondition→precondition 連鎖と EV%/カバレッジ弧の連続性 検算結果>
- TRACE_MERGE: <touches_* がメンバーの重複排除の和である検算結果>
- ROUNDS: <各ラウンドの 敵対→パッチ 要約>
- FORKS_RAISED: <ユーザーに回した分岐と決着>
- ESCALATIONS: <kiro-scenario（メンバー是正）/ moira-model-update へ委譲した件と Verdict、無ければ none>
- GATE: <doc-gate-judge の最終判定。反論されない Critical = 0・Important 全件 disposition 済み ＋ SCOPE_APPROVED ＋ DRAFT_RATIFIED ＋ SOURCE_SET_CONFIRMED ＋ 全メンバー agreed>
- FINAL: <確定（agreed）＋会話ログのパス／または「確定せず：残課題（未成熟メンバー等）」>
```
