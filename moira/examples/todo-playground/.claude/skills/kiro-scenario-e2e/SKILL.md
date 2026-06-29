---
name: kiro-scenario-e2e
description: >
  agreed な受け入れシナリオ unit（.kiro/scenarios/units/*.md）から、実行可能な Playwright E2E spec を
  生成し、独立照合者＋敵対者＋falsifiable ゲートを通してから確定するスキル（計器③ E2E・シナリオ回帰）。
  シナリオの §2/§5 を忠実転記した決定的 fixture を作り、§6 EARS 全節をアサートする spec を生成し、
  実走して green（回帰固定）／xfail（未実装＝test.fail トリップワイヤ）／discrepancy に分類、各 green の
  非空虚を証明、e2e-scenario-checker（著者≠照合者）と doc-adversary で攻撃、doc-gate-judge で PASS 判定。
  「シナリオから E2E を生成」「scenario を E2E 化」「計器③ の spec を起こす」で起動。
  AI は fixture を捏造しない（§2/§5 の転記のみ）。実装と矛盾する失敗は discrepancy としてユーザーに上申する。
  Opus 4.8+ / effort max を強く推奨する高コスト操作。
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, Skill
argument-hint: <unit slug or .kiro/scenarios/units パス> [--rounds N]
model: opus
metadata:
  origin: "custom"
---

# kiro-scenario-e2e

Turn an **`agreed`** acceptance-scenario unit (`.kiro/scenarios/units/{slug}.md`) into an
**executable Playwright E2E spec** that regresses the scenario against the real app — the
realization of **計器③ (E2E・シナリオ回帰)** in `.kiro/steering/moira-verification.md`.

The spec asserts the scenario's **full target**. Observables the slice already renders become
**green regression locks** (計器③ preservation); observables the unit explicitly marks
"(スライス未描画)"/(新規) ride as **`test.fail()` expected-failure tripwires** (the browser analog of
the `it.fails` PR-DONE-LOCK★) that flip CI red the moment the slice implements them. A failing
assertion the unit does **not** mark as unimplemented is a **discrepancy** — escalated, never
silently xfail'd.

**Hard guardrails (the担保 — why a generated test is trustworthy):**
1. **Faithful fixture, no fabrication.** The fixture is a transcription of the unit's §2 (Given) +
   §5 (event JSON) only — composing prior units' stages. The AI invents no events. A vitest
   derive-golden (`e2e/fixtures/*.test.ts`) proves the fixture derives to the unit's stated numbers
   BEFORE any browser assert depends on it.
2. **Full target + tripwire.** Every §6 EARS clause is accounted for in `SPEC_META` as
   green / xfail / deferred (no silent omission); the coverage gate enforces this.
3. **Non-vacuity.** Every green assert is shown to FAIL against the before/mutated fixture (a
   companion test) — the browser edition of `testing-conventions.md`「偽 pass を防ぐ」.
4. **Author ≠ verifier.** An independent `e2e-scenario-checker` classifies each clause, `doc-adversary`
   attacks fixture-faithfulness / non-vacuity / xfail-justification, and `doc-gate-judge` renders the
   falsifiable PASS/FAIL. The author context does not grade its own homework.
5. **Honest framing.** This is "bounded falsification + regression lock", NOT proof of validity
   (`moira-verification.md` 正直枠). Domain validity stays with the human scenario review.

**This English file is the convention shell only. The full, normative procedure lives in
[`SKILL.ja.md`](./SKILL.ja.md)** (project language) — follow it, do not duplicate it here. It reuses
the falsifiable gate / three-party separation from [`../doc-refine/review-gate.md`](../doc-refine/review-gate.md)
and the adversary `doc-adversary` / judge `doc-gate-judge`, plus the dedicated `e2e-scenario-checker`.

Output: `moira/frontend/e2e/specs/{slug}.spec.ts` + `{slug}.meta.ts` (+ any new fixture stages),
finalized only after the gate PASSes; the coverage gate allowlist and map are updated.
