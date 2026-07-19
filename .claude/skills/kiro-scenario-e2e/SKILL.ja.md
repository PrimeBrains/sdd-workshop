---
name: kiro-scenario-e2e
description: >
  agreed な受け入れシナリオ unit から実行可能な Playwright E2E spec を生成し、独立照合者＋敵対者＋
  falsifiable ゲートを通して確定するスキル（計器③）。fixture は §2/§5 の忠実転記、spec は §6 EARS 全節を
  アサート、実走して green/xfail/discrepancy に分類、各 green の非空虚を証明、e2e-scenario-checker と
  doc-adversary で攻撃、doc-gate-judge で PASS 判定。Opus 4.8+ / effort max 推奨の高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, Skill
argument-hint: <unit slug or .kiro/scenarios/units パス> [--rounds N]
model: opus
metadata:
  origin: "custom"
---

# kiro-scenario-e2e — agreed シナリオから E2E を生成し、敵対者ループで確定する

`agreed` な受け入れシナリオ unit（`.kiro/scenarios/units/{slug}.md`）を種に、**実行可能な Playwright E2E
spec** を起こし、対象アプリ（`moira/frontend`）に対する**シナリオ回帰**として固める。これは
`.kiro/steering/moira-verification.md` の **計器③（E2E・シナリオ回帰）** の実体化であり、
**妥当性の preservation（回帰固定）であって establishment ではない**——ドメイン妥当性は人間のシナリオ
レビューが持つ（本スキルは「宣言スコープ内の高被覆 falsification ＋回帰固定」までを担い『担保』とは言わない）。

> **ガードレール（最重要）：担保の5本柱**
> 1. **忠実 fixture（捏造禁止）。** fixture は unit の §2(Given)＋§5(イベント JSON) の**転記のみ**で、先行 unit の
>    stage を compose して作る。AI はイベントを発明しない。derive-golden（vitest）で「fixture が unit の数値へ
>    derive する」ことを **spec 作成前に**証明する。
> 2. **全目標＋トリップワイヤ。** §6 EARS の**全節**を `SPEC_META` に green/xfail/deferred で計上（黙殺禁止）。
>    実装済み観測＝green 回帰固定、unit が「(スライス未描画)」/(新規) と明示する観測＝`test.fail()` 期待失敗
>    トリップワイヤ（スライスが追いつくと予期せず pass→CI 赤→昇格）。
> 3. **非空虚。** 各 green は before/mutated fixture で**必ず落ちる**ことを companion test で示す（偽 pass 排除）。
> 4. **著者≠照合者。** `e2e-scenario-checker` が節ごとに照合、`doc-adversary` が攻撃、`doc-gate-judge` が PASS/FAIL。
> 5. **正直枠。** validity は判定しない。未印付けの失敗は **discrepancy** としてユーザーに上申（自動 xfail 禁止）。

---

## 0. 前提と入力

- 入力＝**1本の `agreed` unit**（slug かパス）。`status: draft` を渡されたら**拒否**し、`kiro-scenario` で
  agreed 化してから来るよう促す（draft は不可侵の人間意図が未確定）。
- 高コスト操作。Opus 4.8+ / effort max 推奨。
- 関連正典：`.kiro/scenarios/README.md`（unit 構造）／`moira-verification.md`（計器③・正直枠）／
  `testing-conventions.md`（「e2e を整合性検証の代替にしない」「偽 pass を防ぐ」）。

## 1. unit を読み、観測を棚卸す

unit の §2(Given 表)・§3(When/Then)・§4(画面の変化 Before→After)・§5(イベント JSON)・§6(EARS)・§7(決定事項) を読む。
特に §4 の **「(スライス未描画)」「(新規)」注記**と、frontmatter の `surfaces` を拾う。§6 の各 EARS 箇条を 1..N と
番号付けし（`coverage-check.test.ts` が §6 の `- **WHEN**/**WHILE**` 箇条数を数えて突き合わせる）、各節の**観測可能な事実**
（どのサーフェスの・どの testid の・どの値）に翻訳する。

## 2. fixture を忠実転記する（捏造禁止）

`moira/frontend/e2e/fixtures/` の既存資産で組む：
- `builders.ts`：`makeLog()`（`decompose/agree/dep/life`・単調 ts・Date.now/Math.random 不使用）と `TARO`/`CLAUDE`。
- `stages.ts`：**1 unit = 1 stage**（その unit の §5 の delta を転記）。新 unit には stage を追記する。
- `scenario-fixtures.ts`：stage を**シナリオ順に compose**して断面（Before/During/After/Given）を作る。
- node id は §5 と一致（`F/req` 等）。値（estimate/frozenBudget）は §2/§5 のまま。**§5 に無いイベントを足さない。**

**derive-golden（必須・spec より先）**：`e2e/fixtures/scenario-fixtures.test.ts`（vitest）に、その断面が unit の
述べる数値（EV%・estimateCoverage・evAbs 等）へ derive することを `toBeCloseTo` で固定するケースを足し、
`npx vitest run e2e/fixtures/scenario-fixtures.test.ts` で green を確認する。ここで落ちたら**転記ミス**——直す
（unit と矛盾するなら §6 後述の discrepancy としてユーザーへ）。これが「integration で先に潰す」。

## 3. 各 EARS 節を green/xfail/deferred に分類する（スライス現物で判定）

**推測しない。** `moira/frontend/src` の該当サーフェス（`surfaces/spec/SpecValueSurface.tsx` 等・`theme/atoms.tsx` の
バッジ）を読み、その観測が**今描画されるか**を一次情報で決める：

- **green** — 現スライスが描画する。`*.spec.ts` で `test()` の硬いアサートにし、**非空虚 companion**（before/mutated で
  落ちる）を必ず添える。
- **xfail** — unit が「(スライス未描画)」/(新規) と**明示**し、スライス現物でも不在。`test.fail()` トリップワイヤにする
  （存在を期待するアサート → 今は失敗 → 期待失敗で pass。実装されると予期せず pass → CI 赤 → 昇格）。`SPEC_META` の note に
  unit の行 ref を書く。
- **deferred** — このサーフェス/このスペックでは観測対象でない（別サーフェス・write 規律・本 fixture に対象ノード無し）。
  `SPEC_META` に note 付きで計上（テストは書かない）。
- **discrepancy（自動 xfail 禁止）** — 失敗するのに unit が未実装と明示していない場合。**ユーザーに上申**：スライス側のバグか／
  シナリオ側の陳腐か／転記ミスか。AskUserQuestion で裁定を仰ぐ。勝手に xfail で隠さない。
- **ラベル差** — 同一状態の英語ラベル（`agreed`/`implemented`）と シナリオ日本語（`承認済み`/`レビュー待ち`）の差は
  **xfail でなく discrepancy**（実装は在る・表記が違う）。spec はスライスの実描画（英語）をアサートし、`SPEC_META` に
  ラベル差を記録、ラベル方針はユーザーに上申。

## 4. spec と meta を書く

- `moira/frontend/e2e/specs/{slug}.meta.ts`：`SPEC_META`（`scenarioUnit`/`surfaces`/`clauses[]`）。`clauses` は §6 と**同数**・
  1..N 全網羅・xfail/deferred は note 必須（`coverage-check.test.ts` が強制）。
- `moira/frontend/e2e/specs/{slug}.spec.ts`：`helpers.ts`（`navTo/selectGanttRow/setAsOf/loadFixture`）と
  `selectors.ts`（`metric/specRow/covRow/estimateBadge/lifecycleBadge/inspectorField` 等）を使う。green は厳密値
  （`toHaveText('100%')`・`toHaveText('24.0%')`——スライスの実描画書式に一致させる）。xfail は `test.fail('…', async…)`。
  各 green に非空虚 companion（before/mutated fixture で逆値）を添える。
- testid 語彙が足りなければ `src` 側に**最小限**追加（`Pill`/`Card`/`SummaryStat` の optional `testid`、行や指標へ
  `data-testid`）。追加は「unit がアサートする要素」に限定し、DOM 構造は変えない。

## 5. 実走して分類を検証する

```
npx vitest run e2e/fixtures/scenario-fixtures.test.ts   # 転記 golden
npm run test:e2e -- e2e/specs/{slug}.spec.ts            # ブラウザ実走（要 chromium-headless-shell）
npm run e2e:coverage                                    # §6 全節計上・agreed 被覆ゲート
```

期待：green は pass、xfail は「expected failure」、suite 全体は green。**xfail が "Expected to fail, but passed" に
なったら**＝その観測はもう実装されている → green へ昇格（discrepancy として扱い meta/spec を直す）。green が落ちたら
回帰 or 分類誤り。非空虚 companion が**落ちずに**通ったら偽 pass の疑い → アサートを締める。

## 6. 独立照合（著者≠照合者）→ 敵対 → ゲート

`--rounds`（既定 2）回す：
1. **`e2e-scenario-checker`**（Agent）を派遣：unit・spec・meta・fixture・スライスを渡し、各節を
   `GREEN / XFAIL-JUSTIFIED / DISCREPANCY` で照合（fixture 忠実性・非空虚・xfail 正当性・昇格漏れ）。
2. **`doc-adversary`**（Agent）を派遣：fixture 捏造・偽 pass・xfail で失敗隠蔽・§6 取りこぼし・ラベル差の見逃しを攻撃角に、
   穴を重大度分類で出させる（`../doc-refine/review-gate.md` の三者分離・falsifiable ゲートに準拠）。
3. 指摘を**修正 or 明示反証**で決着（DISCREPANCY はユーザー裁定を仰いだ上で spec/meta/fixture か、必要なら
   `kiro-scenario`／実装側へ差し戻し）。
4. **`doc-gate-judge`**（Agent）に PASS/FAIL を仰ぐ：「反論されない Critical = 0、Important は全件 disposition（修正／健全な反証／追跡付き deferred）」かつ「全 DISCREPANCY が
   裁定済み・全 xfail が unit 明示に裏打ち・全 green が非空虚」。FAIL なら 1 に戻る。

## 7. 確定

- ゲート PASS で spec/meta/fixture を確定。`coverage-check.test.ts` の `KNOWN_UNCOVERED` から当該 slug を外す（被覆へ昇格）。
- `npm run test:cov`（derive-golden＋coverage ゲート）と `npm run test:e2e` が green であることを最終確認
  （`kiro-verify-completion` の鮮度ゲート）。
- 必要なら `moira-verification.md` の計器③ 整備状況を更新（被覆本数）。コミットはユーザー指示時のみ。

## 鉄則

- **fixture を捏造しない**（§2/§5 転記のみ）。derive-golden を spec より先に green に。
- **黙って省かない**（全 EARS 節を meta に計上）。**自動で xfail に隠さない**（未印付けの失敗は discrepancy→ユーザー）。
- **非空虚を証明する**（before/mutated で落ちる）。「見える/存在する」だけの緩アサートは禁止。
- **著者≠照合者を守る**（checker/adversary/judge は別主体）。自分のテストを自分で合格させない。
- **正直枠**：validity は人間レビュー。`担保`と言わず「回帰固定＋有界 falsification」と言う。
